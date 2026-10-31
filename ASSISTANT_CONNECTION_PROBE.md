# Nia connection probe — public synthetic output only

This independent MCP endpoint is an intermediate connection proof for the project system's reusable assistant integration. It exposes exactly one tool, `nia_connection_probe`, with an empty input object. Its fixed result is:

```json
{"service":"nia-connection-probe","version":"1.0.0","read_only":true}
```

No database, user data, Google, filesystem, administration or writes are involved. This public/no-auth tool does not grant access to any protected API. `/api/assistant/mcp`, REST/OAuth routes, credentials and their flags remain unchanged.

## Default off; Preview only

Route: `/api/assistant/connection-probe/mcp`.

Required server configuration for a separately approved temporary trial:

- `ENABLE_ASSISTANT_CONNECTION_PROBE=1`
- `ASSISTANT_CONNECTION_PROBE_EXPIRES_AT=<explicit UTC timestamp ending Z>`

It also requires genuine Vercel system metadata: environment `preview`, project `prj_t1peGngMihIJB0VrS48TCb13YRyT`, branch `codex/nia-synthetic-api-proof` and the exact request origin from `VERCEL_URL` under the existing team hostname. Do not spoof system metadata. Expired, missing, malformed or more-than-one-hour-ahead expiry closes the route; expiry is checked on every request. Production stays closed even with the flag enabled. Nothing is enabled by adding these files.

HTTP requests are bounded to8KiB; unsupported methods, unexpected path/query/origin, unknown tools and dynamic input are rejected. SDK logs are disabled; no request headers/cookies/tokens are logged. The tool is deliberately public fixed data during the approved window. Vercel deployment protection is separate: a protected Preview can still prevent ChatGPT reaching this route. Do not bypass or change that protection implicitly.

## Local verification and next real proof

Uses the existing private `mcp-handler2.3.0`, MCP Server SDK2.4.0 and Zod4.6.6 dependency boundary, without root package upgrades. Source: packages/nia-mcp/src/connectionProbe.ts; checked-in generated JS/types are adjacent to the existing protected transport, with a separate digest record. The original protected transport is unchanged.

Local verification must exercise actual MCP initialize, tools/list and tools/call, not just HTTP200. Publication/build, temporary probe configuration, credential-free remote checks and personal plugin creation/installation each require explicit authorization; none is implied by this document.

After installation, discover whether `nia_connection_probe` is actually available to the owner's Denia and require a real tool invocation/result. Do not assume an installed custom plugin hot-loads into the existing thread. OpenAI's documented new-Work-chat example is a supported reference experiment, not proof of this Denia surface or completion of the owner's integration goal.

Disable the flag and rebuild the Preview for normal rollback. An old immutable deployment retains its original configuration until its fixed expiry, so do not claim an immediate universal kill switch from changing only the branch flag. No DB or secret cleanup is needed for this probe. Keep the separate database/OAuth work preserved for the next protected integration stage.
