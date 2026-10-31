// Generated from source/oauthQaRoutes.ts; preserved domain/auth logic.
import { OAUTH_BASE_PATH, OAUTH_DISCOVERY_PATH, readStandalonePolicy as readOAuthQaPolicy } from "./hostPolicy.js";
const paths = new Map([
    [
        "/oauth2/authorize",
        "GET"
    ],
    [
        "/oauth2/token",
        "POST"
    ],
    [
        "/oauth2/consent",
        "POST"
    ],
    [
        "/oauth2/revoke",
        "POST"
    ],
    [
        "/jwks",
        "GET"
    ],
    [
        "/get-session",
        "GET"
    ],
    [
        "/sign-in/social",
        "POST"
    ],
    [
        "/callback/google",
        "GET"
    ],
    [
        "/sign-out",
        "POST"
    ],
    [
        "/ui/login",
        "GET"
    ],
    [
        "/ui/consent",
        "GET"
    ],
    [
        "/.well-known/oauth-authorization-server",
        "GET"
    ]
]);
export function createOAuthQaRoutes({ environment, loadService, now = Date.now }) {
    let service;
    return async (request)=>{
        const fail = (status, error)=>Response.json({
                error
            }, {
                status,
                headers: {
                    "Cache-Control": "no-store",
                    "X-Content-Type-Options": "nosniff",
                    "Referrer-Policy": "no-referrer"
                }
            });
        const config = readOAuthQaPolicy(environment, now());
        if (config.state !== "ready") return fail(config.state === "disabled" ? 404 : 503, config.state === "disabled" ? "not_found" : "service_unavailable");
        const url = new URL(request.url);
        if (url.origin !== config.origin || url.hash || /%|\\|\/\//.test(url.pathname)) return fail(404, "not_found");
        const discovery = url.pathname === OAUTH_DISCOVERY_PATH;
        const path = discovery ? "/.well-known/oauth-authorization-server" : url.pathname.slice(OAUTH_BASE_PATH.length);
        if (!discovery && !url.pathname.startsWith(OAUTH_BASE_PATH + "/") || !paths.has(path)) return fail(404, "not_found");
        if (request.method !== paths.get(path)) return fail(405, "method_not_allowed");
        const origin = request.headers.get("origin");
        if (origin && origin !== config.origin) return fail(403, "forbidden");
        if (request.method === "POST" && ![
            "/oauth2/token",
            "/oauth2/revoke"
        ].includes(path) && origin !== config.origin) return fail(403, "forbidden");
        if (discovery && url.search) return fail(404, "not_found");
        const length = request.headers.get("content-length");
        if (length && (!/^\d+$/.test(length) || Number(length) > 16_384)) return fail(413, "request_too_large");
        try {
            let bounded = request;
            if (request.method === "POST") {
                const reader = request.body?.getReader();
                const chunks = [];
                let size = 0;
                if (reader) while(true){
                    const part = await reader.read();
                    if (part.done) break;
                    size += part.value.byteLength;
                    if (size > 16_384) {
                        await reader.cancel();
                        return fail(413, "request_too_large");
                    }
                    chunks.push(part.value);
                }
                const bytes = new Uint8Array(size);
                let offset = 0;
                for (const chunk of chunks){
                    bytes.set(chunk, offset);
                    offset += chunk.byteLength;
                }
                const type = request.headers.get("content-type")?.split(";")[0];
                const machine = [
                    "/oauth2/token",
                    "/oauth2/revoke"
                ].includes(path);
                if (type !== (machine ? "application/x-www-form-urlencoded" : "application/json")) return fail(415, "unsupported_media_type");
                if (path === "/sign-in/social") {
                    let body;
                    try {
                        body = JSON.parse(new TextDecoder("utf-8", {
                            fatal: true
                        }).decode(bytes));
                    } catch  {
                        return fail(400, "invalid_request");
                    }
                    if (!body || Array.isArray(body) || typeof body !== "object" || body.provider !== "google" || body.disableRedirect !== true || typeof body.oauth_query !== "string" || !body.oauth_query || body.callbackURL !== config.issuer + "/ui/login" || body.errorCallbackURL !== config.issuer + "/ui/login" || Object.keys(body).some((key)=>![
                            "provider",
                            "oauth_query",
                            "callbackURL",
                            "errorCallbackURL",
                            "disableRedirect"
                        ].includes(key))) return fail(400, "invalid_request");
                }
                bounded = new Request(request, {
                    body: bytes
                });
            }
            service ??= loadService(config).catch((error)=>{
                service = undefined;
                throw error;
            });
            const target = discovery ? new Request(config.issuer + path, bounded) : bounded;
            const response = await (await service).handle(target);
            const headers = new Headers(response.headers);
            headers.set("Cache-Control", "no-store");
            headers.set("Referrer-Policy", "no-referrer");
            headers.set("X-Content-Type-Options", "nosniff");
            headers.set("X-Frame-Options", "DENY");
            return new Response(response.body, {
                status: response.status,
                headers
            });
        } catch  {
            return fail(503, "service_unavailable");
        }
    };
}
