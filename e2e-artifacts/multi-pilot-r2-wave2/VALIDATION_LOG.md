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

- Commit and push to `qa-preview` - passed as `0774cd6` and follow-up `5e7f941`.
- Verify on the new QA preview that W2-10 can submit Progress 1 evidence/schedule through the late exception - passed.
- Resume Wave 2 from W2-10 Progress 1 recovery - passed; Progress 1 now complete for all 12 Wave 2 projects.

## 2026-05-13 - Phase 4 Progress 2 Live Verification

No app code changes were required during Phase 4 after the late-exception patch.

Live verification:

- Progress 2 opened.
- W2-01 to W2-12 submitted Progress 2 evidence and schedule proposals.
- W2-P2 schedules were approved by assigned teachers.
- Progress 2 scores were submitted by required reviewers.
- Progress 2 closed successfully.

Validation note:

- Last app-code validation before this phase: `typecheck`, `npm test`, `npm run build` all passed.
- Phase 4 changes after that point were pilot scripts and artifact notes only.

## 2026-05-13 - Phases 5-9 Live Verification

No app code changes were required during Phases 5-9.

Live verification:

- Final opened and completed for W2-01 to W2-12.
- W2-11 Final schedule reject/resubmit passed.
- Final scores were submitted by required reviewers.
- Final closed with ready 12 / submitted 12 / completed 12 / incomplete 0 / not-ready 0.
- W2-01 to W2-12 submitted report version 1.
- W2-12 report revision/version 2/latest-version approval passed.
- Advisor scores were submitted after report approval.
- Admin closeout completed all 12 Wave 2 projects.
- Evidence page showed Wave 2 readiness complete.
- CSV/XLSX exports for grades, projects, timeline, scores, reports, and audit returned HTTP 200.

Validation before committing this no-app-code loop:

- `cmd /c npm.cmd test` - passed, 81 files / 341 tests.
- QA secret scan over `e2e-artifacts`, `src`, `IMPLEMENTATION_PROGRESS.md`, `README.md`, and `.env.example` - passed for real secrets.
- Scan note: only placeholder `DIRECT_URL` references were found in `README.md` and `.env.example`; no real QA secret or pasted Supabase credential was found.
