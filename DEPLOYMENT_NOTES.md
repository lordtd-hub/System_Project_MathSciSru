# Deployment Notes

These notes prepare the app for production deployment. They do not deploy or configure cloud infrastructure.

## Target Assumptions

- Runtime: Next.js on Vercel or an equivalent Node.js host.
- Database: PostgreSQL, with Supabase PostgreSQL acceptable if connection pooling and SSL settings are configured by the hosting environment.
- Authentication: Google OAuth through Auth.js/NextAuth.
- Pilot access starts with exactly one real Admin account via `INITIAL_ADMIN_EMAIL`.

## Environment Variables

Required production variables:

- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_URL`
- `NEXTAUTH_URL`
- `AUTH_SECRET`
- `NEXTAUTH_SECRET`
- `AUTH_TRUST_HOST`
- `INITIAL_ADMIN_EMAIL`
- `STUDENT_EMAIL_DOMAIN`
- `TEACHER_EMAIL_DOMAIN`

Set `AUTH_URL` and `NEXTAUTH_URL` to the same production HTTPS URL. Set `AUTH_SECRET` and `NEXTAUTH_SECRET` to the same strong secret. On Vercel, set `AUTH_TRUST_HOST=true`.

## Build and Migration Flow

1. Install dependencies: `npm install`
2. Validate production env: `npm run preflight:production`
3. Generate Prisma client: `npx prisma generate`
4. Apply migrations: `npm run prisma:deploy`
5. Build app: `npm run build`
6. Start with the platform's Next.js production start command or `npm run start` for a local production smoke test.

Use `prisma migrate deploy` in production. Do not use `prisma migrate dev` against production data.

## Data Safety

- Do not run demo seed, demo cleanup, or E2E lifecycle scripts against production.
- `dev:reset-demo` and demo cleanup are local-only tools and must refuse non-local `DATABASE_URL` values.
- Student access is controlled by the imported roster.
- Teacher access is controlled by claim approval.
- Assessment rounds are course-level only; do not create per-project `AssessmentRound` rows.

## Auth Safety

- Google OAuth redirect settings must point at the production domain, not `localhost`.
- Local redirect URI: `http://localhost:3000/api/auth/callback/google`
- Production redirect URI: `https://<your-production-domain>/api/auth/callback/google`
- `/dev-login` must be unavailable when `NODE_ENV=production`.
- `INITIAL_ADMIN_EMAIL` should be removed or tightly controlled after the pilot if the institution moves to a broader Admin management process.

## Local Production Smoke Test

After `npm run build`, start the compiled app with production-like env values:

```powershell
$env:NODE_ENV="production"
$env:AUTH_SECRET="replace-with-a-long-local-smoke-secret"
$env:NEXTAUTH_SECRET=$env:AUTH_SECRET
$env:AUTH_URL="http://127.0.0.1:3101"
$env:NEXTAUTH_URL=$env:AUTH_URL
$env:AUTH_TRUST_HOST="true"
$env:GOOGLE_CLIENT_ID="local-smoke-client-id"
$env:GOOGLE_CLIENT_SECRET="local-smoke-client-secret"
$env:INITIAL_ADMIN_EMAIL="admin@sru.ac.th"
cmd /c npm.cmd run start -- --hostname 127.0.0.1 --port 3101
```

This smoke test verifies production startup behavior only. Real Google sign-in still requires real Google OAuth credentials and matching redirect URIs.

## Operational Order for First Pilot

1. Deploy with production environment variables.
2. Run migrations.
3. Seed or verify teacher master data/rubrics.
4. Sign in with `INITIAL_ADMIN_EMAIL`.
5. Create/activate the academic year, term, and course offering.
6. Import the official student roster.
7. Approve teacher claims from `/admin/claims`.
8. Start lifecycle testing with a small pilot group before wider use.
