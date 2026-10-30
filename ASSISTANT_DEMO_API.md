# Assistant synthetic read API — default disabled

This adds two Node.js Next.js Route Handlers, serving only three fixed invented fixtures:

- `GET /api/assistant/v1/demo/projects`
- `GET /api/assistant/v1/demo/projects/{id}` for nia-demo-001/002/003.

They return only project ID, Thai example title, status and fixed updatedAt, plus a synthetic marker, fixture set and schema version. There are no database, Google, owner-password, student/teacher identity, grading or lifecycle dependencies. This does not grant Admin functional parity.

The proposed wire contract is in [docs/assistant-demo-openapi.json](docs/assistant-demo-openapi.json). It defines no deployed server URL.

## Defaults and human-auth interaction

With no new configuration, every method returns 404. VERCEL_ENV=production returns 404 before any credential configuration is read, regardless of feature flags, QA login overrides, cookies or caller headers. These API Route Handlers do not render page layouts and do not call auth(), signIn(), Prisma or human server actions. Existing human authentication is unchanged. No middleware/proxy is present in the reviewed baseline; a future global middleware must preserve this separate, independently authenticated machine boundary.

All non-GET methods are explicitly exported so Next.js cannot synthesize a successful HEAD or OPTIONS. On an enabled configured QA route they return 405 with Allow: GET. Missing/invalid/future/expired credentials return 401; wrong machine principal/scope/audience/fixture set returns 403; unknown fixture/origin returns 404; unexpected query/body returns 400; quota returns 429; incomplete enabled configuration returns 503. Data and error responses are no-store JSON. No login redirects or cookies are issued.

## Server configuration — no values supplied by this change

Configuration uses server-only variables. Do not use NEXT_PUBLIC_ values or reuse AUTH_SECRET, owner passwords, Google credentials, QA_LOGIN_SECRET, CRON_SECRET or a database credential. Do not paste a plaintext token into chat, command arguments, this document or application source.

| Variable | Purpose |
|---|---|
| ENABLE_ASSISTANT_DEMO_API | Explicit opt-in; only exact 1 enables evaluation |
| ASSISTANT_DEMO_PREVIEW_BRANCH | Exact approved Preview branch |
| ASSISTANT_DEMO_EXPECTED_PROJECT_ID | Must match trusted VERCEL_PROJECT_ID |
| ASSISTANT_DEMO_ORIGIN | Exact approved HTTPS Preview origin, no path/query/credentials |
| ASSISTANT_DEMO_AUDIENCE | Exact audience for the dedicated machine credential |
| ASSISTANT_DEMO_CREDENTIAL_ID | Nonsecret audit identifier |
| ASSISTANT_DEMO_CREDENTIAL_SHA256 | SHA-256 digest of a separately provisioned high-entropy opaque Bearer value |
| ASSISTANT_DEMO_CREDENTIAL_NOT_BEFORE | ISO validity start |
| ASSISTANT_DEMO_CREDENTIAL_EXPIRES_AT | ISO expiry, at most one hour after validity start |
| ASSISTANT_DEMO_CREDENTIAL_REVOKED | Must explicitly equal 0 to accept the credential; missing/other values deny |

Preview additionally requires trusted VERCEL_ENV=preview and VERCEL_GIT_COMMIT_REF matching the approved branch. Local mode exists only for explicit development/test with ASSISTANT_DEMO_LOCAL_TEST=1, no VERCEL_ENV and a loopback HTTP origin. A missing or unrecognized environment fails closed. Configuration is snapshotted when the runtime module loads. No environment changes or credential issuance are part of this patch.

The verifier checks a 43–256 character URL-safe opaque token against the configured SHA-256 digest using timingSafeEqual, validates a maximum one-hour record window, revocation and current time, and assigns only the fixed nia-demo-reader/demo:projects:read/nia-demo-v1 capability. The API independently checks identity validity, audience and scope. The verifier is implemented, but has only been exercised with public fake test values, not a live credential or secret store.

## Operational limits and next approval

Audit output contains only request ID, operation, status and authenticated credential ID. It excludes tokens, request URLs/bodies, hashes, fixture payloads and human identity. Quota is 20 successful reads/minute per handler instance; it is best-effort, not distributed.

Environment rotation/redeployment does not revoke configuration on old deployments. Before an approved trial, agree how all old pilot deployments are disabled or centrally revoked; otherwise their finite expiry remains the bound. This patch does not implement a central credential store/revocation service or persistent machine audit ledger.

Before push/Preview approval: review the exact integrated commit, target project/team/branch and build-trigger implications; confirm branch-specific QA configuration and the permitted caller/secret-injection path. A new GitHub branch push may automatically trigger a Preview. Keep the feature off during that build. A one-hour credential and activation configuration require separate explicit approval after the exact resulting origin and stop procedure are known. Never promote this proof to production.

Tests use fake verifier identities and deterministic public fake inputs for the real hash verifier. They also import the actual route adapter modules while guarding against human-auth/database imports. They do not prove HTTP dispatch through a running Next.js server, Preview protection, live authentication or a connected chat caller. No new socket test is included here, because an earlier loopback connection was denied by the task sandbox.
