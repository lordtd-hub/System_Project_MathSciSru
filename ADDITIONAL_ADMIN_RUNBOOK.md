# Additional designated Google administrators

This change adds no account-management UI or database schema. Keep `INITIAL_ADMIN_EMAIL` unchanged. Owner-password provisioning and its exact existing owner ID remain unchanged.

`ADDITIONAL_ADMIN_EMAILS` is an optional comma-separated server configuration containing exact normalized `@sru.ac.th` addresses. An additional admin must also be an existing active User explicitly assigned `globalRole=ADMIN` by an authorized operator. Configuration alone cannot create or promote an admin. Google must supply a verified email and stable subject; student, personal Gmail and suffix/subdomain lookalikes cannot be designated.

An additional admin login preserves the assigned role without writing ADMIN again. A conditional update requires the same current User ID, normalized email, active state and existing ADMIN role, so a concurrent demotion/disablement is not overwritten. Normal teachers/students and the original initial administrator retain their existing login behavior.

Additional ADMIN sessions bypass the ordinary five-minute role cache and recheck the current database role/active state on every auth call. Removing the email designation and deploying that configuration clears ADMIN authorization on the next auth check, even for a fresh cached token. It does not log out or modify the original owner's Google session. A revoked additional user can sign in again with Google to resolve their ordinary teacher/pending-teacher role; an operator should also explicitly restore their approved non-admin database role. Already-running requests may finish.

## Proposed activation, not executed

After exact privilege-grant approval and successful tests/Preview:

1. Publish/deploy this patch with the optional configuration unset. Preserve `INITIAL_ADMIN_EMAIL`, existing auth settings, and both owner-password variables. No migration is required.
2. Set Production `ADDITIONAL_ADMIN_EMAILS=thanon.kor@sru.ac.th`, keeping any separately approved existing entries if any exist; do not overwrite an unexpected existing value. Redeploy the reviewed commit. Configuration alone grants no role.
3. In a guarded transaction, verify the existing target User `cmrk53rc30000ju04utck8day`, email `thanon.kor@sru.ac.th`, active TEACHER, and active linked teacher `cmou5ohop0005l704r3higgq1`. Change only that User's global role to ADMIN and record an audit event including previous/new role and approval reference. Abort on any mismatch, duplicate identity, unexpected existing ADMIN role or failed audit. Do not create a User or change email/teacher link.
4. Verify the original owner `cmp5b4o400000lb04mvhizepv` is still active ADMIN with the same teacher link. Verify the target role/audit and ask the target to use their own normal verified university Google login. Do not impersonate the target or alter anyone's session.

Rollback baseline for this patch is main `9e733dc0a0159f42a8d6c7a4688b386fb6fc64d1`, configured owner-password production deployment `PGmsgqC9r1uqahbVZwTAiZgguiqs`. To revoke the new grant, remove only the additional target designation and redeploy, then restore only the target's approved prior TEACHER role with an audit event. Reverting code alone is insufficient to clear a previously assigned database role; preserve owner-password access and all original-owner configuration. No academic records are changed.
