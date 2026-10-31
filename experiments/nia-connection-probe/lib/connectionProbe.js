// Generated from ../source/connectionProbe.ts; do not hand-edit.
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

export const PROBE_PATH = "/api/mcp";
export const MAX_PROBE_BODY_BYTES = 8192;
export const PROBE_VALUE = Object.freeze({ service: "nia-connection-probe", version: "1.0.0", read_only: true });
const EXISTING_APP_PROJECT = "prj_t1peGngMihIJB0VrS48TCb13YRyT";
                                                                                      
                                                                
                                                                                                    

function eligibleOrigin(env             , timestamp        , scope                  )                {
  if (env.ENABLE_ASSISTANT_CONNECTION_PROBE !== "1" || env.VERCEL_ENV !== "production" ||
    !scope || !/^prj_[a-zA-Z0-9]{10,80}$/.test(scope.projectId) ||
    scope.projectId === EXISTING_APP_PROJECT || env.VERCEL_PROJECT_ID !== scope.projectId) return null;
  const host = scope.productionHost;
  if (!/^[a-z0-9][a-z0-9-]*\.vercel\.app$/.test(host) ||
    host === "system-project-math-sci-sru.vercel.app" ||
    env.VERCEL_PROJECT_PRODUCTION_URL !== host) return null;
  const text = env.ASSISTANT_CONNECTION_PROBE_EXPIRES_AT ?? "";
  const startText = env.ASSISTANT_CONNECTION_PROBE_STARTS_AT ?? "";
  const starts = Date.parse(startText);
  const expires = Date.parse(text);
  const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
  if (!utc.test(text) || !utc.test(startText) || !Number.isFinite(starts) ||
    !Number.isFinite(expires) || !Number.isFinite(timestamp) || timestamp < starts ||
    expires <= timestamp || expires <= starts || expires - starts > 3_600_000) return null;
  return "https://" + host;
}
async function boundedBody(request         )                                              {
  const declared = request.headers.get("content-length");
  if (declared !== null && !/^\d+$/.test(declared)) return Response.json({ error: "invalid_request" }, { status: 400 });
  if (declared !== null && Number(declared) > MAX_PROBE_BODY_BYTES) return Response.json({ error: "request_too_large" }, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts               = []; let length = 0;
  try {
    while (true) {
      const item = await reader.read(); if (item.done) break;
      length += item.value.byteLength;
      if (length > MAX_PROBE_BODY_BYTES) { await reader.cancel(); return Response.json({ error: "request_too_large" }, { status: 413 }); }
      parts.push(item.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return bytes;
}

/** Public fixed synthetic output only. No auth, database, files, user data or writes. */
export function createConnectionProbe({ environment = {}, now = Date.now, scope }          = {}) {
  const sdk = createMcpHandler((server) => {
    server.registerTool("nia_connection_probe", {
      title: "Check the synthetic MCP connection",
      description: "Returns only fixed public service, version and read_only values. No database, personal records, Google or administration.",
      inputSchema: z.object({}).strict(),
      outputSchema: z.object({ service: z.literal("nia-connection-probe"), version: z.literal("1.0.0"), read_only: z.literal(true) }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: "noauth" }] }
    }, async () => ({ content: [{ type: "text"         , text: JSON.stringify(PROBE_VALUE) }], structuredContent: { ...PROBE_VALUE } }));
  }, { serverInfo: { name: "nia-connection-probe", version: "1.0.0" },
    instructions: "One public fixed-output synthetic connection tool only; no private access or side effects.",
    verboseLogs: false, maxSubscriptions: 0 });
  return async function handle(request         )                    {
    function finish(response          ) {
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store"); headers.set("X-Content-Type-Options", "nosniff");
      return new Response(response.body, { status: response.status, headers });
    }
    try {
      const origin = eligibleOrigin(environment, now(), scope);
      if (!origin) return finish(Response.json({ error: "not_found" }, { status: 404 }));
      const url = new URL(request.url);
      if (url.origin !== origin || url.pathname !== PROBE_PATH || url.search) return finish(Response.json({ error: "not_found" }, { status: 404 }));
      if (!["GET", "POST"].includes(request.method)) return finish(Response.json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: "GET, POST" } }));
      const browserOrigin = request.headers.get("origin");
      if (browserOrigin && browserOrigin !== origin && browserOrigin !== "https://chatgpt.com") return finish(Response.json({ error: "forbidden" }, { status: 403 }));
      let sdkRequest = request;
      if (request.method === "POST") {
        if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return finish(Response.json({ error: "unsupported_media_type" }, { status: 415 }));
        const body = await boundedBody(request); if (body instanceof Response) return finish(body);
        sdkRequest = new Request(request.url, { method: "POST", headers: request.headers, body });
      }
      return finish(await sdk(sdkRequest));
    } catch { return finish(Response.json({ error: "service_unavailable" }, { status: 503 })); }
  };
}
