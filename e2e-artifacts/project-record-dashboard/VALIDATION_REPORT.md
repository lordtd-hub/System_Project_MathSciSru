# Project Record + Dashboard IA Cleanup Validation Report

## Validation Policy

After meaningful code changes, run:

- `npm run typecheck`
- targeted tests when available
- `npm test`
- `npm run build`

## Results

## Phase 1

- `npm run typecheck` - passed.
- `npx vitest run src/lib/projects/projectRecord.test.ts` - passed, 5 tests.

Note: Vite printed its existing CJS deprecation warning during the targeted test run. This is non-blocking and not introduced by the project-record service.

## Phase 2

- `npm run typecheck` - passed.
- `npx vitest run src/lib/projects/projectRecord.test.ts` - passed, 5 tests.

## Phase 3-6

- `npm run typecheck` - passed.
- `npx vitest run src/lib/projects/projectRecord.test.ts src/app/projectRecordSource.test.ts` - passed, 7 tests.

## Phase 7

- First full `npm test` found one pre-existing source-guard mismatch in `src/app/qaLoginSource.test.ts`: the test expected `manualDemoTeachers` in `prisma/qa-manual-reset-seed.ts`, but the current reset script delegates to `src/lib/qa/manualReset.ts`.
- Narrow fix: updated the source test to assert that the script calls `resetQaManualGuideData` and that the service contains `manualDemoTeachers`.
- `npm test` rerun - passed, 84 files / 365 tests.
- `npm run build` - passed. Existing warning remains: `src/lib/admin/teacherBaseline.ts` has an unused `initialAdminEmail` parameter.
- `npm run typecheck` rerun after build - passed. A parallel run with `next build` produced a transient `.next/types` race, so the authoritative typecheck result is the later standalone pass.

## QA Verification

- Commit pushed to `qa-preview`: `17fcead`
- QA preview: `https://system-project-math-sci-bcl42ddy1-lordtd-hubs-projects.vercel.app`
- Vercel deployment status: Ready.
- Live smoke result: blocked by Vercel Deployment Protection.
  - `/qa-login` returned `401 Unauthorized`.
  - `/projects/not-a-real-project` returned `401 Unauthorized`.
- No QA data was mutated.
- No browser window was opened or closed.

Live role verification remains pending until a valid protected-preview session is available.

## Encoding / Mojibake Check

All new source and markdown files must remain UTF-8. Do not copy Thai text from mojibake terminal output into source files. For CSV/export work later, include UTF-8 BOM and explicit `charset=utf-8` headers where applicable.
