# Admin Operational UX Audit

Date: 2026-05-13
Scope: presentation/UI stabilization only after MULTI-PILOT-R2 Wave 1.

## Source of truth read first

- `PROJECT_SPEC.md`
- `IMPLEMENTATION_PROGRESS.md`
- `E2E_LIFECYCLE_REVIEW.md`
- `e2e-artifacts/multi-pilot-r2-wave1/REPORT.md`
- `e2e-artifacts/multi-pilot-r2-wave1/MANUAL_NOTES.md`
- `e2e-artifacts/multi-pilot-r2-wave1/PENDING_FROM_PROMPT.md`
- `e2e-artifacts/PILOT_FIX_STATUS.md`

## Pages inspected

- `/admin`
- `/admin/rounds`
- `/admin/proposals`
- `/admin/schedules`
- `/admin/closeout`
- `/admin/evidence`
- `/admin/evidence/exports/[kind]`

No `/admin/reports` route exists in the current source. Report review is teacher-facing; Admin report status appears through closeout/evidence.

## Operational risks

- `/admin/rounds`: open, close, and reset actions were visually close together. This made round state operations feel like equivalent buttons even though close/reset are higher-risk operations.
- `/admin/rounds`: the bucket logic was correct after Wave 1, but the first scan still required reading each round card to know whether the system was waiting on students, teachers, exceptions, or simple non-eligibility.
- `/admin/closeout`: projects ready for Admin completion, projects waiting for advisor score/report state, and completed projects appeared in one continuous list.
- `/admin/proposals`: summary warnings existed, but Admin decision work, missing teacher scores, fail-vote attention, decided items, and released feedback were not grouped as a single operational queue.
- `/admin/schedules`: all schedules were sorted chronologically, so pending, rejected, and confirmed schedules mixed together at scale.
- `/admin/evidence`: evidence export worked, but export cards did not explain what each file contained, which increases risk of downloading the wrong dataset under real operation.

## Queue/readability problems

- Large cards are acceptable for a few projects but become slow to scan around 40 projects.
- Actionable and historical items were sometimes adjacent without a strong section boundary.
- Completed items could dominate vertical space after a round or closeout phase finishes.
- Some state labels were present but not elevated into "what should Admin do now?" buckets.

## Scale risks under 40 projects

- Round cards remain manageable because there are four rounds, but each round needs a top-level operational summary.
- Schedule and closeout pages can grow linearly with projects; grouping is needed before a full redesign.
- Evidence tables already use horizontal scroll and are appropriate for audit data, but export meaning needs stronger labels.

## Mobile/desktop issues

- Existing responsive table/card behavior remains acceptable for stabilization.
- The main mobile risk is action hierarchy: destructive actions should not sit beside routine navigation without warning context.

## Unauthorized action visibility

- No source-level auth changes were made or required.
- Existing server-side Admin guards remain on all inspected pages.
- This pass did not add new backend routes or actions.

## Missing warning/acknowledgement clarity

- Round close acknowledgement exists and is lifecycle-correct.
- The UI needed clearer separation between open-round controls and close/reset controls.
- Final grade-I warning remains governed by existing round close guard logic.

## Patch direction

- Add a shared Admin operational summary/section component.
- Put "Needs admin action" and dangerous controls first and clearly separated.
- Keep waiting/completed/locked/not-eligible visible without making them look actionable.
- Do not change lifecycle, score, eligibility, auth, schema, or action semantics.
