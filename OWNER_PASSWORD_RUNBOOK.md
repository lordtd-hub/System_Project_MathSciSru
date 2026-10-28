# Existing owner: independent password recovery (LOCAL ONLY)

No deployment, migration, owner credential/enrollment issuance or production write has occurred. Prior personal-Google recovery work remains separately preserved in `../auth-recovery` and `../owner-personal-google-recovery.patch`; this patch does not include it.

## What the owner will do

1. Receive a privately delivered, random, one-time setup code from a verified operator. It expires after **15 minutes** and cannot log in or access admin pages.
2. Open `/owner-setup`, enter the code and choose a personal password (15–128 Unicode characters; spaces allowed). The code itself cannot be reused as the password.
3. Open `/owner-login`, use the privately provisioned alias **lordtd@gmail.com** and that password to enter the SAME existing Sittichoke ADMIN identity.
4. Change the password later at `/account/password`, using the current password. All password sessions then require login again. Forgotten passwords require another explicitly approved operator enrollment; there is no email-based reset or self-claim.

The personal email is a login name only. Its text never grants a role or creates a User. No Gmail/Google/SMTP/Resend call is involved in this flow. The original university email, `google_sub`, `User.id`, teacher link, roles, projects, assessments, grades and records remain unchanged. Only credential state and authentication evidence/last-login fields are updated. Normal university Google login remains available.

## Precise scope

The stack is existing NextAuth JWT + Prisma/PostgreSQL. One optional `OwnerPasswordCredential` row references the already-existing owner `users.id`. A small schema migration adds this separate server-only credential table; it does not create/migrate users or move any course/grade data. There is no general signup, emergency-admin platform, broad Gmail allowance or privilege bootstrap.

Two server-only variables are needed: `ENABLE_OWNER_PASSWORD_LOGIN=1` and `OWNER_PASSWORD_USER_ID=<verified existing owner ID>`. Both are unset/disabled by default; row-level `enabled`, active ADMIN ownership and valid activated credential are additionally required. Existing DATABASE_URL/DIRECT_URL and AUTH_SECRET/AUTH_URL configuration remain; password operation does not require a configured or functioning Google client. Keep existing Google config, INITIAL_ADMIN_EMAIL, cookie/signing settings and university roles intact.

Google now additionally requires strict boolean `email_verified`, a stable subject, and an exact parsed domain of `sru.ac.th` or `student.sru.ac.th` before role bootstrap. Gmail, suffix lookalikes and multiple-@ malformed addresses remain denied, including if INITIAL_ADMIN_EMAIL is mistakenly set to an outsider. The one provisioned password alias is handled solely by the new credentials provider and then translated back to the original user's canonical identity. Domain audit found no middleware/alternate auth datastore; remaining domain occurrences are UI copy, roster generation, seed/test data and unchanged configuration validation.

## Operator verification and production approval gate

Do not run the operator command or apply the migration until the parent obtains action-specific approval for the confirmed target project/database, exact existing owner ID, exact alias, migration/deployment and private one-time-code delivery. A chat assertion or zero matching email rows is not authority to create/choose another admin.

Production code was fetched read-only by exact SHA **5c82e7d32fddcfae65465e1fe76a8f4d244c5cb1**. This isolated branch is based on that actual production commit; its auth/schema/dependencies matched the previous local baseline, while four unrelated production files were refreshed. Recorded target is Vercel `system-project-math-sci-sru.vercel.app`, project `prj_t1peGngMihIJB0VrS48TCb13YRyT`, team `team_owWWLQCk8lGloSsWh0LjRynQ`. Parent separately confirmed an existing authorized dashboard session. This child did no browser/session work.

The parent reports the owner-email SELECT in Supabase project `jwkvykuwihpvvmtlawlh` returned zero rows. That alone does not prove deletion or the correct production database. Actual production source uses only Prisma `DATABASE_URL`/`DIRECT_URL`; there is no Supabase Auth, alternate Data API auth adapter or Neon client in the deployed source. Source/templates cannot identify the runtime database project without authorized non-secret management evidence. Baseline seed creates teacher profiles; the User row is normally created on real login. A teacher-only/legacy QA identity is also possible and must be investigated, not inferred as the owner.

New non-secret documentary evidence: tracked `PRODUCTION_MAINTENANCE_LOG.md`, section **2026-07-29 — Supabase Data API exposure containment**, explicitly labels lines 11–12: Production `project-course-system`, Supabase project reference **moowtfeoxgmkerfrtxyz**. This is also present in the fetched production commit's tree. The same log identifies the Prisma/PostgreSQL backend. This makes the owner-scoped read-only lookup in that documented production project the next useful step; the zero-row result from `project-scoring` is not evidence against that account. The dated log is strong historical mapping, still requiring current runtime corroboration before mutation.

An authorized operator may corroborate the intended teacher with its actual linked User (read-only, no student/grade rows):

```sql
SELECT t.id AS teacher_id, t.email AS teacher_email, t.user_id,
       u.id AS user_id, u.email, u.global_role, u.active
FROM teachers t LEFT JOIN users u ON u.id = t.user_id
WHERE lower(t.email) = lower('sittichoke.son@sru.ac.th');
```

An already-valid original admin app session can also corroborate the server-issued User.id through normal authorized read-only app/session inspection, without cookie/token extraction or re-login. Still require the corresponding existing active ADMIN row in the CONFIRMED runtime database before provisioning. The password flow does not require a Google subject or Google proof; operator verification selects only the approved existing ID/email/role/active fields. The operator helper fails before secret generation/delivery if exact ID + current canonical email + active ADMIN state fail to match. It never creates a User.

## Approved activation sequence (not executed)

1. Independently review `owner-password-recovery.patch`, confirm the real target and existing ID, and test migration/flows against a disposable PostgreSQL database with synthetic users. The local unit/mock tests are not a real database migration rehearsal.
2. Check production migration history. Only the reviewed new migration should be pending; unexpected pending changes are a stop. Obtain approval and apply the new table migration through the existing trusted Prisma migration path. RLS is enabled and PUBLIC/anon/authenticated access revoked, with no public policies; verify the application's existing server DB role can access the new table without opening it to browser roles.
3. Deploy the reviewed code with feature disabled initially. After exact binding approval, apply the two owner-only variables and deploy them. An unprovisioned/pending row grants NO login. Keep the same auth secret and normal Google settings.
4. An already-authorized trusted operator runs `node_modules/.bin/tsx scripts/owner-password-operator.ts` from a private terminal with approved environment supplied by the existing management path, not pasted to chat or written into source. Arguments are `--mode provision`, `--user-id`, `--current-email`, `--login-email lordtd@gmail.com`, `--verification-reference <approved ticket>`, `--expected-app-origin https://system-project-math-sci-sru.vercel.app`, `--confirm-owner-provisioning`, and `--confirm-production` for hosted DBs. The ID/email must come from the verified EXISTING owner row, not guesses. These flags are operator safeguards, not a substitute for actual human verification/approval.
5. The command generates the real random code only after all ownership checks. It writes a fresh temporary delivery directory accessible only to the current Windows SID (or owner-only Unix mode), then a mode-0600 private file. It prints the path only, never the code/password/hash. Transfer its contents to the verified owner through the separately approved private delivery path; do not open it using assistant tools, paste it in chat, screenshot it or commit it. Delete that file after use. Enrollment itself issues no session: owner sets a password then logs in normally.
6. Verify read-only that login resolves to the original owner ID and original teacher roles/records, without grade mutations. Test university Google continuity separately with authorized synthetic/staging users. Revoke the enrollment and stop if the target identity differs.

Replacement is deliberately refused unless a new exact approval explicitly includes `--replace-existing`. Replacement clears the previous password and invalidates its sessions while creating a new pending enrollment. Do not rerun an interrupted/uncertain command blindly: inspect its non-secret audit outcome first, then obtain approval for replacement if needed. Transaction/file delivery failures do not silently fall back to a password or generic admin.

## Security, throttling and sessions

Passwords use independently salted Node scrypt N=131072/r=8/p=1, 64-byte keys and timing-safe comparison; no plaintext password is persisted. Random 256-bit enrollment codes are SHA-256 hashed in storage, expire after 15 minutes, and are consumed with atomic compare-and-set. Login/change recheck the current hash/version/admin state after expensive comparison, preventing stale-password races. Server actions require exact trusted configured Origin in addition to framework protection. Change target is derived from the authenticated session and current password, never a submitted user ID.

Eight attempts per 15-minute window are reserved atomically in PostgreSQL before password hashing, including unknown aliases; quota is shared across instances. Pending enrollment cannot have its setup quota exhausted through public login. A deliberate attacker can temporarily exhaust an activated owner's password quota; a window expiry permits retry. Scrypt uses about 128 MiB per KDF: resource/concurrency verification belongs in the approved staging rollout.

Each password JWT carries the credential version and is checked against the actual owner and credential row on every server auth call, skipping the ordinary role cache. Change, explicit replacement and revocation rotate that version. Disabled/deleted/demoted owner or disabled/revoked credential loses authorization on the next check. Existing ordinary Google sessions and their baseline role caching are unchanged. Already-running requests may complete.

Flag disable is a TEMPORARY gate: a signed JWT never presented while disabled could become valid again if the unchanged credential/version is reenabled. Permanent invalidation requires approved row revocation/version rotation. Operator revocation uses the same command with `--mode revoke`, `--user-id`, `--verification-reference`, `--expected-app-origin`, `--confirm-owner-revocation` and `--confirm-production`. It clears password/enrollment state and increments the version; no User/grade data changes. Rollback: gate off the feature and apply hosting config; if permanent revocation is intended, execute the approved revocation too, then optionally revert code. Retain the table/audit evidence; no destructive data rollback is needed.

Rollback compatibility is also explicit: every password JWT uses a non-email namespace in its legacy email claim and has no usable legacy role-cache timestamp, even if revocation races initial issuance. Canonical university email is restored only in the successfully revalidated app session. Therefore the previous email-based callback cannot reinterpret a password JWT as a normal Google session after a code rollback. This safeguard was independently reviewed and regression-tested, including the initial-issuance race.

## Validation status

Exact locked dependencies; generated local Prisma client and schema-to-schema SQL using explicit synthetic unreachable database URLs. No database connection, migration, production credential or operator command was executed. Full test/type/lint results and independent review are recorded in `../OWNER_PASSWORD_HANDOFF.md`. Windows private-delivery rehearsal PASSED with the installed PowerShell Core Security module and native icacls crosscheck; the synthetic file/directory were cleaned up. Real PostgreSQL migration/concurrency is BLOCKED by Docker Desktop startup: its Inference manager cannot access/remove the local dockerInference listener path. Normal startup was attempted as authorized; no reset, diagnostics upload, backend/security change, image pull or container was performed. Real owner login remains pending approved production activation.

References: [Auth.js Credentials](https://authjs.dev/getting-started/authentication/credentials), [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Node crypto](https://nodejs.org/api/crypto.html).
