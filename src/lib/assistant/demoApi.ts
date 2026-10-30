import { randomUUID } from "node:crypto";
import { DEMO_FIXTURE_SET, DEMO_PRINCIPAL_ID, DEMO_READ_SCOPE, DEMO_ROOT, DEMO_SCHEMA_VERSION } from "./demoFixtures";
import { findSyntheticProject, listSyntheticProjects } from "./demoQueries";
import type { DemoConfiguration } from "./demoPolicy";
import { MAX_DEMO_CREDENTIAL_WINDOW_MS, type MachineIdentity, type MachineVerifier } from "./machineAuth";

export type DemoAuditEvent = Readonly<{
  requestId: string;
  operation: "demo:projects:read";
  status: number;
  credentialId?: string;
}>;
type DemoApiDependencies = {
  configuration?: DemoConfiguration;
  verifyBearer?: MachineVerifier;
  now?: () => number;
  audit?: (event: DemoAuditEvent) => void;
};

function validIdentity(identity: MachineIdentity, now: number) {
  return typeof identity.credentialId === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(identity.credentialId) &&
    Number.isFinite(identity.notBeforeEpochMs) && Number.isFinite(identity.expiresAtEpochMs) &&
    identity.expiresAtEpochMs > identity.notBeforeEpochMs &&
    identity.expiresAtEpochMs - identity.notBeforeEpochMs <= MAX_DEMO_CREDENTIAL_WINDOW_MS &&
    now >= identity.notBeforeEpochMs && now < identity.expiresAtEpochMs;
}

export function createDemoApi({ configuration = { state: "disabled" }, verifyBearer = () => null,
  now = Date.now, audit = () => {} }: DemoApiDependencies = {}) {
  // Configuration is trusted immutable server data, not an API request DTO.
  const config = Object.freeze({ ...configuration });
  let windowStart: number | undefined;
  let successfulReads = 0;

  return async function handle(request: Request): Promise<Response> {
    const requestId = randomUUID();
    const auditContext: { credentialId?: string } = {};
    function response(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) {
      const event: DemoAuditEvent = Object.freeze({ requestId, operation: "demo:projects:read", status,
        ...(auditContext.credentialId ? { credentialId: auditContext.credentialId } : {}) });
      try { audit(event); } catch { /* Do not leak logger exception contents. */ }
      return Response.json({ ...body, requestId }, { status, headers: {
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Request-Id": requestId, ...headers
      } });
    }
    const failure = (status: number, error: string, headers?: Record<string, string>) => response(status, { error }, headers);
    if (config.state === "disabled") return failure(404, "not_found");
    if (config.state !== "ready") return failure(503, "service_unavailable");

    const url = new URL(request.url);
    if (url.origin !== config.origin || (url.pathname !== DEMO_ROOT && !url.pathname.startsWith(`${DEMO_ROOT}/`))) {
      return failure(404, "not_found");
    }
    if (request.method !== "GET") return failure(405, "method_not_allowed", { Allow: "GET" });
    const match = /^Bearer ([A-Za-z0-9_-]{43,256})$/.exec(request.headers.get("authorization") ?? "");
    if (!match) return failure(401, "unauthorized", { "WWW-Authenticate": "Bearer" });
    let identity: MachineIdentity | null;
    try { identity = await verifyBearer(match[1]); } catch { return failure(503, "service_unavailable"); }
    const timestamp = now();
    if (!Number.isFinite(timestamp)) return failure(503, "service_unavailable");
    if (!identity || !validIdentity(identity, timestamp)) {
      return failure(401, "unauthorized", { "WWW-Authenticate": "Bearer" });
    }
    auditContext.credentialId = identity.credentialId;
    if (identity.principalId !== DEMO_PRINCIPAL_ID || identity.audience !== config.audience ||
      identity.fixtureSet !== DEMO_FIXTURE_SET || !Array.isArray(identity.scopes) || !identity.scopes.includes(DEMO_READ_SCOPE)) {
      return failure(403, "forbidden");
    }
    if (url.search || request.body !== null ||
      (request.headers.has("content-length") && request.headers.get("content-length") !== "0")) {
      return failure(400, "invalid_request");
    }
    const id = url.pathname === DEMO_ROOT ? undefined : url.pathname.slice(DEMO_ROOT.length + 1);
    const project = id ? findSyntheticProject(id) : undefined;
    if (id !== undefined && !project) return failure(404, "not_found");

    // Best-effort per-instance quota for synthetic data; not a distributed limit.
    if (windowStart === undefined || timestamp < windowStart || timestamp - windowStart >= 60_000) {
      windowStart = timestamp;
      successfulReads = 0;
    }
    if (successfulReads >= 20) return failure(429, "rate_limited", {
      "Retry-After": String(Math.max(1, Math.ceil((windowStart + 60_000 - timestamp) / 1000)))
    });
    successfulReads++;
    return response(200, { schemaVersion: DEMO_SCHEMA_VERSION, synthetic: true, fixtureSet: DEMO_FIXTURE_SET,
      environment: config.environment,
      ...(project ? { project } : { projects: listSyntheticProjects() })
    });
  };
}
