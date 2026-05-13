# MULTI-PILOT-R2 Wave 2 Validation Log

## 2026-05-13 - Start

Planning docs were committed as `a02ea8d`.

## 2026-05-13 - Phase 1 QA Setup Patch

Code patch:

- Added Wave 2 QA setup constants and scenario mix.
- Added `/qa-login` action to prepare a separate Wave 2 QA course offering.
- Added source/unit coverage for the Wave 2 setup boundary.

Validation:

- `cmd /c npm.cmd test -- src/lib/qa/multiPilotR2.test.ts` - passed.
- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- src/app/qaLoginSource.test.ts src/lib/qa/multiPilotR2.test.ts` - passed.
- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test` - passed, 80 files / 334 tests.
- `cmd /c npm.cmd run build` - passed.

Pending:

- Secret scan before commit - passed; no QA secret found. One false positive came from `task-first`.
- QA preview push - passed, commit `6d223c2`.
- New QA preview - `https://system-project-math-sci-daaspquy0-lordtd-hubs-projects.vercel.app`.
- Live QA verification and data preparation - passed.

Validation requirement:

- If no app code changes are made, run at least `npm test` before finalizing a no-code loop.
- If app code changes are made, run:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

Additional checks:

- Confirm QA secret is not written to artifacts.
- Confirm production config is not changed.
- Confirm unrelated dirty files are not staged.

## 2026-05-13 - Phase 3 Progress Recovery Patch

Code patch:

- Student schedule round availability now treats an open late exception as available for the affected assessment round.
- Teacher schedule queues now keep late-recovered schedules reviewable after the course-level round is closed.
- Teacher schedule review action now permits approve/reject when the project has an open late exception for the schedule round.
- Round eligibility no longer treats open late/excused exceptions as readiness blockers.
- Added source coverage for late-open Progress/Final recovery UI/action paths.

Validation:

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test` - passed, 80 files / 337 tests.
- `cmd /c npm.cmd run build` - passed.
- `rg -n "<QA secret>" e2e-artifacts src` - passed; no match found.

Pending:

- Commit and push to `qa-preview`.
- Verify on the new QA preview that W2-10 can submit Progress 1 evidence/schedule through the late exception.
- Resume Wave 2 from W2-10 Progress 1 recovery.
