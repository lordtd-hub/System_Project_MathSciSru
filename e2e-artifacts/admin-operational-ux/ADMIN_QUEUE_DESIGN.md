# Admin Queue / Bucket Design

Date: 2026-05-13
Scope: Admin operational UX only. Preserve existing business logic.

## Required buckets

- Needs admin action: Admin can or should act now, such as final decision, open round, close ready round, or project closeout.
- Waiting on teachers: evidence exists but teacher approval/scoring/review is incomplete.
- Waiting on students: current round or workflow is eligible but student evidence/schedule/report is missing.
- Ready to close: current round or project has no current blockers and can be closed/confirmed by Admin.
- Completed: finished/read-only work kept visible as history, but separated from active work.
- Exception / Late / Returned: late access, rejected schedule, returned report, or abnormal attention state.
- Locked / Not eligible: not a blocker for the current round; visible for transparency only.

## Filter dimensions

- Round type: Proposal, Progress 1, Progress 2, Final.
- Status: pending, waiting, completed, returned.
- Eligibility: eligible, eligible-but-incomplete, not-yet-eligible.
- Exception state: open exception, late, returned/rejected, resolved.
- Dependency: waiting on Admin, waiting on student, waiting on teacher/advisor/committee.

## UX principles

- Actionable items appear before waiting or completed items.
- Dangerous actions are visually separated from routine buttons.
- "Ready" means the existing source of truth says it is ready; UI must not invent readiness.
- Completed items must not dominate the first screen.
- Late/exception cases use their own visual bucket.
- Missing prerequisites are explicit and should say who/what is blocking.
- Compact list/table patterns should be preferred where item count can grow.
- Empty states must say the truth, not imply false readiness.

## Applied patterns

- Shared `AdminOperationalSummary` for scan-level metrics.
- Shared `AdminQueueSection` for grouped queues.
- Shared `AdminDangerZone` for close/reset controls.
- Badges for operational bucket tone: action, waiting, ready, completed, exception, locked, danger.

## Page-level application

- `/admin/rounds`: add operational summary across all rounds and separate open controls from close/reset controls.
- `/admin/closeout`: split ready-to-close, waiting, and completed projects.
- `/admin/proposals`: summarize waiting decision, missing score, fail-vote attention, decided, and released feedback.
- `/admin/schedules`: group proposed, rejected, and confirmed schedule requests.
- `/admin/evidence`: clarify export meaning and add evidence readiness summary.

## Deferred redesign ideas

- Dedicated incomplete-project panel for non-Proposal recovery.
- More compact admin schedule table for 40+ projects.
- Filter controls for round/status/exception in schedules and evidence.
- Full visual redesign pass after Wave 2 planning, once operational semantics remain stable.
