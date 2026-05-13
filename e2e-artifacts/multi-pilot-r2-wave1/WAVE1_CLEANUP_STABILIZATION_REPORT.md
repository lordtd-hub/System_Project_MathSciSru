# MULTI-PILOT-R2 Wave 1 Cleanup Stabilization Report

Date: 2026-05-13
Branch: `qa-preview`

## Scope

This pass executes the remaining Wave 1 cleanup plan after the full controlled lifecycle had already passed:

Proposal -> Progress 1 -> Progress 2 -> Final -> Report -> Advisor Score -> Admin Closeout

The pass is stabilization only. It does not restart pilot data, does not touch production, and does not change lifecycle, scoring, eligibility, auth, or schema semantics.

## Phase 1 - Student Readability

Patched UI-only student readability:

- Added a shared student summary component for action / waiting / done / locked states.
- Added a compact status summary to `/student/schedule`.
- Added a compact status summary to `/student/report`.
- Added a read-only status summary and proper empty state to `/student/feedback`.
- Changed report review display from raw `PASS` to Thai user-facing wording.

Risk classification: Minor/UX stabilization. No business logic changes.

## Phase 2 - Project03 Recovery UX

Decision:

- Keep the existing audited late/reopen model.
- Do not add a new recovery architecture before Wave 2.
- Expose non-Proposal eligible-but-incomplete projects in `/admin/round-exceptions`.

Patch:

- `/admin/round-exceptions` now uses `getRoundEligibility`.
- For Progress 1, Progress 2, and Final, the page includes projects that were eligible for the selected round but incomplete when the round closed.
- Not-yet-eligible projects remain excluded from the recovery list.
- Existing `openLateRoundSubmissionForProject` remains the only action used for per-case reopen.

Expected Project03 result:

- Project03 should be visible as a Progress 1 eligible-but-incomplete recovery case after Progress 1 closure.
- Project03 should not be treated as a blocker for Progress 2 or Final.
- Project03 remains locked from later rounds unless Admin deliberately opens late access and the project completes the missed gate.

Risk classification: UI/operational visibility patch. No lifecycle/eligibility rule changed.

## Phase 3 - Evidence / Export Polish

Patched grade export readability:

- Grade export already existed as `grades`.
- Added `student_full_name_th` after first and last name columns.
- Kept weighted score columns unchanged:
  - `proposal_10_percent`
  - `progress1_10_percent`
  - `progress2_10_percent`
  - `final_10_percent`
  - `presentation_total_40_percent`
  - `advisor_25_percent`
  - `recorded_total_65_percent`

Risk classification: Export labeling/column clarity only. No score formula changed.

## Phase 4 - Admin / Teacher UX Debt Triage

Reviewed existing stabilization artifacts:

- `e2e-artifacts/teacher-workload-ux/VALIDATION_REPORT.md`
- `e2e-artifacts/admin-operational-ux/VALIDATION_REPORT.md`

Decision:

- No new high-risk Admin/Teacher patch is needed in this pass beyond Project03 recovery visibility.
- Defer deeper filters/tables and visual redesign until after Wave 2 planning.

Remaining minor debt:

- Teacher dashboard may still benefit from a larger visual redesign later.
- Admin round close/reset hierarchy can still be visually refined later.
- Dedicated recovery console would be cleaner than using the exception page for every recovery case.

## Phase 5 - Artifact / Worktree Hygiene

Observed worktree:

- Existing unrelated modified files:
  - `WEBAPP_REDESIGN_PLAN.md`
  - `e2e-artifacts/multi-pilot-r2-wave1/cdp-edge-guard.js`
- Existing untracked pilot artifacts and screenshots are still present.
- Runtime/browser/test output folders are already ignored:
  - `.edgepilot-cdp/`
  - `.playwright-cli/`
  - `.qa-chrome-profile/`
  - `test-results/`

Decision:

- Do not delete pilot evidence.
- Do not stage unrelated dirty files.
- Stage only files changed by this cleanup pass.

## Validation

- `cmd /c npm.cmd test -- studentReadabilityStabilization` - passed
- `cmd /c npm.cmd test -- roundExceptionsUx studentReadabilityStabilization` - passed
- `cmd /c npm.cmd test -- adminEvidence roundExceptionsUx studentReadabilityStabilization` - passed
- `cmd /c npm.cmd run typecheck` - passed
- `cmd /c npm.cmd test` - passed, 80 files / 332 tests
- `cmd /c npm.cmd run build` - passed, 35 routes generated
- Secret scan over cleanup artifacts and changed source files - passed for the QA secret; only a historical `AUTH_SECRET` documentation mention was found in `IMPLEMENTATION_PROGRESS.md`

Still required before marking complete:

- QA preview push.
- Live QA smoke verification on the new QA preview.

## Current Recommendation

Proceed to full local validation, QA preview push, and live QA smoke verification.

If validation and live QA pass, Wave 1 can be considered cleanup-stabilized enough for Wave 2 planning. Do not start Wave 2 execution until explicitly approved.
