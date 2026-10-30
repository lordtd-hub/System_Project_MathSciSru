import { randomUUID } from "node:crypto";
import { DEMO_MCP_PATH, readMcpConfiguration, type OAuthRequestVerifier } from "./demoMcp";
import type { DemoEnvironment } from "./demoPolicy";

export const MCP_RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource" + DEMO_MCP_PATH;
type Audit = Readonly<{ requestId: string; status: number; method: "GET" | "POST" | "OTHER" }>;
type TransportModule = {
  createSyntheticMcpTransport(options: { env: DemoEnvironment; verifyRequest: OAuthRequestVerifier;
    now: () => number; audit: (event: Audit) => void }): (request: Request) => Promise<Response>;
};

/** Protected Preview only. Operational OAuth verification must be supplied separately.
 * No browser-session fallback, no anonymous mode and no default/fake verifier.
 */
export function createProtectedPreviewRoutes({ environment, loadTransport, verifyRequest, now = Date.now, audit = () => {} }: {
  environment: DemoEnvironment; loadTransport: () => Promise<TransportModule>; verifyRequest?: OAuthRequestVerifier;
  now?: () => number; audit?: (event: Audit) => void;
}) {
  const config = readMcpConfiguration(environment);
  let transport: Promise<(request: Request) => Promise<Response>> | undefined;
  return async (request: Request) => {
    function failure(status: number, error: string) {
      const requestId = randomUUID();
      try { audit({ requestId, status, method: request.method === "GET" || request.method === "POST" ? request.method : "OTHER" }); } catch { /* Never expose logger contents. */ }
      return Response.json({ error, requestId }, { status, headers: { "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff", "X-Request-Id": requestId,
        ...(status === 405 ? { Allow: request.url.includes(MCP_RESOURCE_METADATA_PATH) ? "GET" : "GET, POST" } : {}) } });
    }
    if (config.state === "disabled") return failure(404, "not_found");
    if (config.state !== "ready" || config.mode !== "oauth") return failure(503, "service_unavailable");
    const url = new URL(request.url);
    if (url.origin !== config.origin || url.search || ![DEMO_MCP_PATH, MCP_RESOURCE_METADATA_PATH].includes(url.pathname)) return failure(404, "not_found");
    const browserOrigin = request.headers.get("origin");
    if (browserOrigin && browserOrigin !== config.origin) return failure(403, "forbidden");
    if (!(["GET", "POST"].includes(request.method)) || (url.pathname === MCP_RESOURCE_METADATA_PATH && request.method !== "GET")) return failure(405, "method_not_allowed");

    // No identity value is read until the trusted environment is eligible.
    const owner = environment.ASSISTANT_DEMO_MCP_OWNER_SUBJECT ?? "";
    const startText = environment.ASSISTANT_DEMO_MCP_NOT_BEFORE ?? "";
    const endText = environment.ASSISTANT_DEMO_MCP_EXPIRES_AT ?? "";
    const notBefore = Date.parse(startText);
    const expiresAt = Date.parse(endText);
    const timestamp = now();
    if (!owner || owner.length > 255 || owner.trim() !== owner || Array.from(owner).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
      !startText.endsWith("Z") || !endText.endsWith("Z") ||
      !Number.isFinite(notBefore) || !Number.isFinite(expiresAt) || expiresAt <= notBefore || expiresAt - notBefore > 3_600_000 ||
      !Number.isFinite(timestamp) || !verifyRequest) return failure(503, "service_unavailable");
    // Every request rechecks the fixed trial window, including old immutable deployments.
    if (timestamp < notBefore || timestamp >= expiresAt) return failure(404, "not_found");
    const ownerVerifier: OAuthRequestVerifier = async (req) => {
      const grant = await verifyRequest(req);
      return grant?.subject === environment.ASSISTANT_DEMO_MCP_OWNER_SUBJECT ? grant : null;
    };
    try {
      transport ??= loadTransport().then((module) => module.createSyntheticMcpTransport({
        env: environment, verifyRequest: ownerVerifier, now, audit
      }));
      return await (await transport)(request);
    } catch { return failure(503, "service_unavailable"); }
  };
}
