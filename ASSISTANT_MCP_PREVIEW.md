# Protected synthetic MCP Preview scaffold

Adds `/api/assistant/mcp` and `/.well-known/oauth-protected-resource/api/assistant/mcp` to the existing Next application. Node runtime, dynamic/no-store responses, production unconditionally disabled. Default feature flag is off. This is fixed synthetic data only: no DB, human session, Google or administrative operation.

SDK transport dependencies are isolated in packages/nia-mcp; root application manifests/lock remain unchanged. The new branch buildCommand installs the private lock with scripts disabled and validates the boundary before the existing app build. Regions and heartbeat cron are preserved. Do not merge or publish without review/approval.

Even if enabled in a matching Preview, anonymous mode is rejected. Proposed configuration names only (no operational values supplied): ENABLE_ASSISTANT_DEMO_MCP, ASSISTANT_DEMO_MCP_MODE=oauth, ASSISTANT_DEMO_ORIGIN, ASSISTANT_DEMO_PREVIEW_BRANCH, ASSISTANT_DEMO_EXPECTED_PROJECT_ID, ASSISTANT_DEMO_MCP_ISSUER, ASSISTANT_DEMO_MCP_OWNER_SUBJECT, ASSISTANT_DEMO_MCP_NOT_BEFORE, ASSISTANT_DEMO_MCP_EXPIRES_AT. Trial dates must be UTC and span at most one hour. Every request rechecks the fixed window, including older immutable deployments.

**Not operational yet:** mcpPreviewRuntime deliberately provides no OAuth verifier. Incomplete configuration/identity verification fails closed before loading the SDK; flags alone cannot grant access. Later integration must use an established authorization server, validate signature/issuer/audience/time/scopes and enforce the exact stable owner subject. ChatGPT authorization-code/PKCE/client registration and a real OAuth verifier remain separate approved work. An arbitrary REST API key is not an MCP OAuth provider.

No fake verifier or test credential is wired into runtime. Tests inject a fake transport/verifier only to verify Next/owner/deployment boundaries. The separate earlier SDK protocol proof passed31 in-memory tests, not a hosted ChatGPT connection. This scaffold still needs a real Next build/trace validation, approved Preview deployment, OAuth setup and owner plugin connection.
