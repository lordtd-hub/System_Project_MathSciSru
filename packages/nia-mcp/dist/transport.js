// Generated from src/transport.ts by Node24 stripTypeScriptTypes strip; do not hand-edit.
import { randomUUID } from "node:crypto";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { authorizeMcpRequest, createDemoMcp, DEMO_MCP_PATH, DemoMcpError, readMcpConfiguration,
                            } from "../../../src/lib/assistant/demoMcp.ts";
import { DEMO_READ_SCOPE } from "../../../src/lib/assistant/demoFixtures.ts";
                                                                                

export const MAX_MCP_BODY_BYTES = 65_536;
export const METADATA_PATH = "/.well-known/oauth-protected-resource" + DEMO_MCP_PATH;
const projectSchema = z.object({ id: z.string().regex(/^nia-demo-[0-9]{3}$/), titleTh: z.string(),
  status: z.enum(["DRAFT", "PROPOSAL_PENDING", "COMPLETED"]), updatedAt: z.string() }).strict();
const envelope = { schemaVersion: z.literal("1.0"), synthetic: z.literal(true), fixtureSet: z.literal("nia-demo-v1"),
  environment: z.enum(["local-test", "qa-preview"]) };
                                                                                                               
class TransportError extends Error {
           status        ;
           code        ;
  constructor(status        , code        ) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

async function boundedBody(request         ) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && !/^\d+$/.test(declaredLength)) throw new TransportError(400, "invalid_request");
  if (declaredLength !== null && Number(declaredLength) > MAX_MCP_BODY_BYTES) throw new TransportError(413, "request_too_large");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  let size = 0;
  const chunks               = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MCP_BODY_BYTES) { await reader.cancel(); throw new TransportError(413, "request_too_large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
  return combined;
}

/** Local validation factory only. No exported live route or process.env binding. */
export function createSyntheticMcpTransport({ env = {}, verifyRequest, now = Date.now, audit = () => {} }   
                                                                                                                           
  = {}) {
  const config = readMcpConfiguration(env);
  const adapter = createDemoMcp({ configuration: config, now });
  const challenge = config.state === "ready" ? `Bearer resource_metadata="${config.origin + METADATA_PATH}", scope="${DEMO_READ_SCOPE}"` : "Bearer";
  return async function handle(request         )                    {
    const requestId = randomUUID();
    function finish(response          ) {
      // SDK responses can have immutable headers; wrap without consuming a stream.
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store"); headers.set("X-Content-Type-Options", "nosniff"); headers.set("X-Request-Id", requestId);
      const result = new Response(response.body, { status: response.status, headers });
      try { audit({ requestId, status: result.status, method: request.method === "GET" || request.method === "POST" ? request.method : "OTHER" }); } catch { /* redacted audit failure */ }
      return result;
    }
    try {
      if (config.state !== "ready") throw new TransportError(config.state === "disabled" ? 404 : 503, config.state === "disabled" ? "not_found" : "service_unavailable");
      const url = new URL(request.url);
      if (url.origin !== config.origin || url.search) throw new TransportError(404, "not_found");
      const origin = request.headers.get("origin");
      if (origin && origin !== config.origin) throw new TransportError(403, "forbidden");
      if (url.pathname === METADATA_PATH) {
        if (config.mode !== "oauth") throw new TransportError(404, "not_found");
        if (request.method !== "GET") throw new TransportError(405, "method_not_allowed");
        return finish(Response.json({ resource: config.resource, authorization_servers: [config.issuer],
          scopes_supported: [DEMO_READ_SCOPE], bearer_methods_supported: ["header"] }));
      }
      if (config.mode === "oauth" && !verifyRequest) throw new TransportError(503, "service_unavailable");
      const grant = await authorizeMcpRequest(request, config, verifyRequest, now);
      const descriptors = adapter.definitions(grant);
      let sdkRequest = request;
      if (request.method === "POST") {
        if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new TransportError(415, "unsupported_media_type");
        const body = await boundedBody(request);
        sdkRequest = new Request(request.url, { method: request.method, headers: request.headers, body });
      }
      // No shared mutable identity: each request's callbacks close over its verified grant.
      const handler = createMcpHandler((server) => {
        for (const descriptor of descriptors) {
          server.registerTool(descriptor.name, {
            title: descriptor.title, description: descriptor.description,
            inputSchema: descriptor.name === "list_synthetic_projects" ? z.object({}).strict()
              : z.object({ id: z.string().regex(/^nia-demo-[0-9]{3}$/).max(12) }).strict(),
            outputSchema: descriptor.name === "list_synthetic_projects"
              ? z.object({ ...envelope, projects: z.array(projectSchema).length(3) }).strict()
              : z.object({ ...envelope, project: projectSchema }).strict(),
            annotations: descriptor.annotations,
            _meta: { securitySchemes: descriptor.securitySchemes }
          }, async (args) => {
            try { return await adapter.call(descriptor.name, args, grant); }
            catch (error) {
              const code = error instanceof DemoMcpError ? error.code : "service_unavailable";
              return { isError: true, content: [{ type: "text"         , text: code }],
                ...(error instanceof DemoMcpError && [401, 403].includes(error.status)
                  ? { _meta: { "mcp/www_authenticate": [challenge] } } : {}) };
            }
          });
        }
      }, { serverInfo: { name: "nia-synthetic-project-proof", version: "0.0.1-local" },
        instructions: "Two read-only invented project fixtures tools only. No live records, students, grades or administration.",
        verboseLogs: false, maxSubscriptions: 0 });
      return finish(await handler(sdkRequest));
    } catch (error) {
      const known = error instanceof TransportError || error instanceof DemoMcpError;
      const status = known ? error.status : 503;
      const code = known ? error.code : "service_unavailable";
      return finish(Response.json({ error: code, requestId }, { status, headers: {
        ...(status === 401 ? { "WWW-Authenticate": challenge } : {}),
        ...(status === 405 ? { Allow: "GET, POST" } : {})
      } }));
    }
  };
}


//# sourceURL=nia-mcp/src/transport.ts
