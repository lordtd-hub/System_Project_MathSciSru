import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

export const PROBE_PATH = "/api/assistant/connection-probe/mcp";
export const MAX_PROBE_BODY_BYTES = 8192;
export const PROBE_VALUE = Object.freeze({ service: "nia-connection-probe", version: "1.0.0", read_only: true });
const PROJECT = "prj_t1peGngMihIJB0VrS48TCb13YRyT";
const BRANCH = "codex/nia-synthetic-api-proof";
type Environment = Readonly<Record<string, string | undefined>>;
type Options = Readonly<{ environment?: Environment; now?: () => number }>;

function eligibleOrigin(env: Environment, timestamp: number): string | null {
  if (env.ENABLE_ASSISTANT_CONNECTION_PROBE !== "1" || env.VERCEL_ENV !== "preview" ||
    env.VERCEL_PROJECT_ID !== PROJECT || env.VERCEL_GIT_COMMIT_REF !== BRANCH) return null;
  const host = env.VERCEL_URL ?? "";
  if (!/^[a-z0-9][a-z0-9-]*-lordtd-hubs-projects\.vercel\.app$/.test(host)) return null;
  const text = env.ASSISTANT_CONNECTION_PROBE_EXPIRES_AT ?? "";
  const expires = Date.parse(text);
  if (!text.endsWith("Z") || !Number.isFinite(expires) || !Number.isFinite(timestamp) ||
    expires <= timestamp || expires - timestamp > 3_600_000) return null;
  return "https://" + host;
}
async function boundedBody(request: Request): Promise<Uint8Array<ArrayBuffer> | Response> {
  const declared = request.headers.get("content-length");
  if (declared !== null && !/^\d+$/.test(declared)) return Response.json({ error: "invalid_request" }, { status: 400 });
  if (declared !== null && Number(declared) > MAX_PROBE_BODY_BYTES) return Response.json({ error: "request_too_large" }, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = []; let length = 0;
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
export function createConnectionProbe({ environment = {}, now = Date.now }: Options = {}) {
  const sdk = createMcpHandler((server) => {
    server.registerTool("nia_connection_probe", {
      title: "Check the synthetic MCP connection",
      description: "Returns only fixed public service, version and read_only values. No database, personal records, Google or administration.",
      inputSchema: z.object({}).strict(),
      outputSchema: z.object({ service: z.literal("nia-connection-probe"), version: z.literal("1.0.0"), read_only: z.literal(true) }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { securitySchemes: [{ type: "noauth" }] }
    }, async () => ({ content: [{ type: "text" as const, text: JSON.stringify(PROBE_VALUE) }], structuredContent: { ...PROBE_VALUE } }));
  }, { serverInfo: { name: "nia-connection-probe", version: "1.0.0" },
    instructions: "One public fixed-output synthetic connection tool only; no private access or side effects.",
    verboseLogs: false, maxSubscriptions: 0 });
  return async function handle(request: Request): Promise<Response> {
    function finish(response: Response) {
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store"); headers.set("X-Content-Type-Options", "nosniff");
      return new Response(response.body, { status: response.status, headers });
    }
    try {
      const origin = eligibleOrigin(environment, now());
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
