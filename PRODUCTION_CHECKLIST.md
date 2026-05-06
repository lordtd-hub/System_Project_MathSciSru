# Production Checklist

## Authentication pilot

- [ ] Set `INITIAL_ADMIN_EMAIL` to the one real Admin account for the pilot.
- [ ] Confirm no other `@sru.ac.th` user becomes Admin automatically.
- [ ] Confirm new `@sru.ac.th` users land in the teacher claim flow.
- [ ] Confirm Admin approval is required before a teacher can access `/teacher` work pages.
- [ ] Confirm teacher profiles can start with empty `email` and are linked only after claim approval.
- [ ] Import the official student roster before pilot student login.
- [ ] Confirm imported students use generated emails: `{student_code}@student.sru.ac.th`.
- [ ] Confirm non-imported `@student.sru.ac.th` emails are blocked.
- [ ] Confirm `NODE_ENV=production` disables `/dev-login` actions and dev-session auth.

## Operational notes

- Keep `INITIAL_ADMIN_EMAIL`, Google OAuth values, `NEXTAUTH_SECRET`, and `DATABASE_URL` in production environment variables only.
- Use Google login for production access.
- Use `/admin/claims` to approve or reject teacher account claims.
- Use roster import as the source of truth for student account eligibility.

## Required environment variables

- [ ] `DATABASE_URL` points to the production PostgreSQL database, not local Docker.
- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are from the production Google OAuth client.
- [ ] `AUTH_URL` is the canonical production URL. Set `NEXTAUTH_URL` to the same value for compatibility.
- [ ] `AUTH_SECRET` is a strong production-only secret. Set `NEXTAUTH_SECRET` to the same value for compatibility.
- [ ] `AUTH_TRUST_HOST=true` is set on Vercel or any trusted reverse-proxy deployment.
- [ ] `INITIAL_ADMIN_EMAIL` is the one pilot Admin Google account.
- [ ] `STUDENT_EMAIL_DOMAIN=student.sru.ac.th`.
- [ ] `TEACHER_EMAIL_DOMAIN=sru.ac.th`.
- [ ] `NODE_ENV=production`.

## Migration and build readiness

- [ ] Run `npm install` in the deployment environment.
- [ ] Run `npm run preflight:production` with production environment variables before first deploy.
- [ ] Run `npx prisma generate` during build or before server start.
- [ ] Apply production migrations with `npm run prisma:deploy`.
- [ ] Do not run `prisma migrate dev` against production.
- [ ] Do not run `npm run dev:reset-demo`, `npm run prisma:seed:demo`, or `npm run e2e:lifecycle` against production data.
- [ ] If seed data is needed, run only the production-safe seed for master teachers/rubrics after reviewing it.
- [ ] Confirm `npm run build` passes with production env variables.

## Production safety

- [ ] `/dev-login` is unavailable in production.
- [ ] Demo cleanup scripts refuse non-local database URLs.
- [ ] No localhost URLs are configured in Google OAuth callback settings.
- [ ] Google OAuth local redirect URI is `http://localhost:3000/api/auth/callback/google`.
- [ ] Google OAuth production redirect URI is `https://<your-production-domain>/api/auth/callback/google`.
- [ ] Google OAuth authorized redirect URI matches the production callback path.
- [ ] Server logs do not include secrets, OAuth tokens, raw session cookies, or student private data.
- [ ] Raw Markdown/LaTeX display is sanitized and raw HTML is not executed.
- [ ] Material links remain restricted to Google Drive, Google Docs, or Google Classroom domains.
- [ ] Admin-only closeout remains server-side guarded and cannot be triggered by teachers/students.
- [ ] Course-level round uniqueness is preserved: one `AssessmentRound` per `courseOfferingId + roundType`.
