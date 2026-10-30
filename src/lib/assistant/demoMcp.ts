import { DEMO_FIXTURE_SET, DEMO_READ_SCOPE, DEMO_SCHEMA_VERSION } from "./demoFixtures";
import { findSyntheticProject, listSyntheticProjects } from "./demoQueries";
import { readDemoEnvironment, type DemoEnvironment } from "./demoPolicy";

export const DEMO_MCP_PATH = "/api/assistant/mcp";
const annotations = Object.freeze({ readOnlyHint: true, destructiveHint: false,
  idempotentHint: true, openWorldHint: false });
const projectSchema = { type: "object", additionalProperties: false,
  properties: { id: { type: "string", pattern: "^nia-demo-[0-9]{3}$" }, titleTh: { type: "string" },
    status: { type: "string", enum: ["DRAFT", "PROPOSAL_PENDING", "COMPLETED"] }, updatedAt: { type: "string" } },
  required: ["id", "titleTh", "status", "updatedAt"] };
const envelopeProperties = { schemaVersion: { const: DEMO_SCHEMA_VERSION }, synthetic: { const: true },
  fixtureSet: { const: DEMO_FIXTURE_SET }, environment: { enum: ["local-test", "qa-preview"] } };
const envelopeRequired = ["schemaVersion", "synthetic", "fixtureSet", "environment"];
export const demoToolDefinitions = Object.freeze([
  Object.freeze({ name: "list_synthetic_projects", title: "List invented demo projects",
    description: "List exactly three invented project fixtures for integration testing. Contains no students, grades or live records. Does not read or change a database. Cannot administer the real project system.",
    inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
    outputSchema: { type: "object", additionalProperties: false,
      properties: { ...envelopeProperties, projects: { type: "array", items: projectSchema, minItems: 3, maxItems: 3 } },
      required: [...envelopeRequired, "projects"] }, annotations }),
  Object.freeze({ name: "get_synthetic_project", title: "Read one invented demo project",
    description: "Read one invented fixture by its nia-demo-NNN ID. Returns only id, titleTh, status and updatedAt. No private records or admin capabilities. Unknown IDs do not search any live system.",
    inputSchema: { type: "object", properties: { id: { type: "string", pattern: "^nia-demo-[0-9]{3}$", maxLength: 12 } },
      required: ["id"], additionalProperties: false },
    outputSchema: { type: "object", additionalProperties: false, properties: { ...envelopeProperties, project: projectSchema },
      required: [...envelopeRequired, "project"] }, annotations })
]);

type Gate = ReturnType<typeof readDemoEnvironment>;
export type McpConfiguration = Exclude<Gate, { state: "ready" }> | Readonly<{
  state: "ready"; environment: "local-test" | "qa-preview"; origin: string;
  mode: "public-synthetic" | "oauth"; resource: string; issuer?: string;
}>;

/** This demo deliberately has no configurable data source and no admin tools. */
export function readMcpConfiguration(env: DemoEnvironment): McpConfiguration {
  const gate = readDemoEnvironment(env, env.ENABLE_ASSISTANT_DEMO_MCP === "1");
  if (gate.state !== "ready") return gate;
  const resource = gate.origin + DEMO_MCP_PATH;
  if (env.ASSISTANT_DEMO_MCP_MODE === "public-synthetic") {
    return Object.freeze({ ...gate, mode: "public-synthetic", resource });
  }
  if (env.ASSISTANT_DEMO_MCP_MODE !== "oauth") return Object.freeze({ state: "misconfigured" });
  try {
    const issuerValue = env.ASSISTANT_DEMO_MCP_ISSUER ?? "";
    const issuer = new URL(issuerValue);
    if (issuerValue.trim() !== issuerValue || issuer.protocol !== "https:" || issuer.username || issuer.password || issuer.search || issuer.hash) {
      return Object.freeze({ state: "misconfigured" });
    }
    // OAuth issuer comparison is exact; do not add a trailing slash or normalize it.
    return Object.freeze({ ...gate, mode: "oauth", resource, issuer: issuerValue });
  } catch { return Object.freeze({ state: "misconfigured" }); }
}

/** Trusted verifier output only. Raw headers, token claims or cookies are never this type.
 * A future OAuth resource-server verifier must validate the signature/introspection,
 * issuer and audience before constructing it. No operational implementation exists here.
 */
export type VerifiedOAuthGrant = Readonly<{
  issuer: string; resource: string; subject: string; scopes: readonly string[];
  notBeforeEpochMs: number; expiresAtEpochMs: number;
}>;
export type OAuthRequestVerifier = (request: Request) => Promise<VerifiedOAuthGrant | null>;
export class DemoMcpError extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 405 | 429 | 503, readonly code: string) { super(code); }
}

/** Transport-independent domain adapter, not an MCP wire-protocol implementation. */
export function createDemoMcp({ configuration = { state: "disabled" }, now = Date.now }: {
  configuration?: McpConfiguration; now?: () => number;
} = {}) {
  const config = Object.freeze({ ...configuration });
  let windowStart: number | undefined;
  let reads = 0;
  function authorize(grant?: VerifiedOAuthGrant | null) {
    if (config.state === "disabled") throw new DemoMcpError(404, "not_found");
    if (config.state !== "ready") throw new DemoMcpError(503, "service_unavailable");
    const timestamp = now();
    if (!Number.isFinite(timestamp)) throw new DemoMcpError(503, "service_unavailable");
    if (config.mode === "oauth") {
      if (!grant || !grant.subject || !Number.isFinite(grant.notBeforeEpochMs) || !Number.isFinite(grant.expiresAtEpochMs) ||
        grant.expiresAtEpochMs <= grant.notBeforeEpochMs || grant.expiresAtEpochMs - grant.notBeforeEpochMs > 3_600_000 ||
        timestamp < grant.notBeforeEpochMs || timestamp >= grant.expiresAtEpochMs) throw new DemoMcpError(401, "unauthorized");
      if (grant.issuer !== config.issuer || grant.resource !== config.resource || !Array.isArray(grant.scopes) ||
        !grant.scopes.includes(DEMO_READ_SCOPE)) throw new DemoMcpError(403, "forbidden");
    }
    return timestamp;
  }
  return Object.freeze({
    definitions(grant?: VerifiedOAuthGrant | null) {
      authorize(grant);
      // Return fresh descriptors so client mutation cannot extend the fixed catalog.
      return structuredClone(demoToolDefinitions).map((tool) => ({ ...tool,
        securitySchemes: config.state === "ready" && config.mode === "public-synthetic"
          ? [{ type: "noauth" as const }] : [{ type: "oauth2" as const, scopes: [DEMO_READ_SCOPE] }] }));
    },
    async call(name: string, args: unknown, grant?: VerifiedOAuthGrant | null) {
      const timestamp = authorize(grant);
      if (!args || typeof args !== "object" || Array.isArray(args)) throw new DemoMcpError(400, "invalid_arguments");
      const input = args as Record<string, unknown>;
      let payload: Record<string, unknown>;
      if (name === "list_synthetic_projects") {
        if (Object.keys(input).length) throw new DemoMcpError(400, "invalid_arguments");
        payload = { projects: listSyntheticProjects() };
      } else if (name === "get_synthetic_project") {
        if (Object.keys(input).length !== 1 || typeof input.id !== "string" || !/^nia-demo-[0-9]{3}$/.test(input.id)) {
          throw new DemoMcpError(400, "invalid_arguments");
        }
        const project = findSyntheticProject(input.id);
        if (!project) throw new DemoMcpError(404, "not_found");
        payload = { project };
      } else { throw new DemoMcpError(404, "unknown_tool"); }
      // Best effort per adapter instance; transport must retain this instance per process.
      if (windowStart === undefined || timestamp < windowStart || timestamp - windowStart >= 60_000) {
        windowStart = timestamp; reads = 0;
      }
      if (reads >= 20) throw new DemoMcpError(429, "rate_limited");
      reads++;
      const structuredContent: Record<string, unknown> = { schemaVersion: DEMO_SCHEMA_VERSION, synthetic: true,
        fixtureSet: DEMO_FIXTURE_SET, environment: config.state === "ready" ? config.environment : "unavailable", ...payload };
      return { content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }], structuredContent };
    }
  });
}

/** Outer request boundary. Fail closed unless a supported verifier is explicitly supplied. */
export async function authorizeMcpRequest(request: Request, config: McpConfiguration,
  verifyRequest: OAuthRequestVerifier = async () => null, now: () => number = Date.now) {
  const adapter = createDemoMcp({ configuration: config, now });
  if (config.state !== "ready") { adapter.definitions(); throw new DemoMcpError(503, "service_unavailable"); }
  const url = new URL(request.url);
  if (url.origin !== config.origin || url.pathname !== DEMO_MCP_PATH || url.search) throw new DemoMcpError(404, "not_found");
  const browserOrigin = request.headers.get("origin");
  if (browserOrigin && browserOrigin !== config.origin) throw new DemoMcpError(403, "forbidden");
  if (!["GET", "POST"].includes(request.method)) throw new DemoMcpError(405, "method_not_allowed");
  let grant: VerifiedOAuthGrant | null = null;
  if (config.mode === "oauth") {
    try { grant = await verifyRequest(request); } catch { throw new DemoMcpError(503, "service_unavailable"); }
  }
  adapter.definitions(grant);
  return grant;
}
