# Full UI Redesign Master Plan

## Goal

Redesign the full web application UI while preserving the proven workflow logic from Wave 1 and Wave 2.

The redesign should make Admin, Teacher, and Student workflows easier to scan and act on at real course scale.

## Non-Negotiable Constraints

Do not change:

- auth logic;
- role guards;
- lifecycle transitions;
- scoring semantics;
- round eligibility semantics;
- report latest-version semantics;
- advisor score unlock semantics;
- Prisma schema;
- production configuration.

Keep:

- existing Mathematics & Statistics SRU logo;
- existing color theme from `src/app/globals.css` and `tailwind.config.ts`;
- existing Thai UI wording from current pages;
- Wave 1 and Wave 2 data as historical evidence;
- QA-only workflow for redesign verification.

## Phase 0 - Baseline Freeze

Create a rollback tag and branch before implementation.

Output:

- baseline tag;
- redesign branch;
- recorded QA preview;
- recorded current commit;
- recorded known UX debt.

See:

- `BASELINE_AND_ROLLBACK_PLAN.md`

## Phase 1 - Real App Mapping Audit

Audit current app routes and map:

- visible text;
- actions;
- forms;
- server actions;
- data source/query;
- role guard;
- mobile behavior;
- Figma coverage.

Output:

- updated `REAL_APP_SCREEN_INVENTORY.md`;
- route-by-route notes;
- screenshots if useful.

Stop condition:

- if a route has unclear business logic, document and do not redesign it yet.

## Phase 2 - Component Architecture

Create shared redesign components without replacing routes yet.

Suggested folder:

- `src/components/redesign/`

Suggested components:

- shell/header/sidebar;
- KPI card;
- queue/list/card;
- status/role badges;
- lifecycle round card;
- project review detail layout;
- evidence card;
- history timeline;
- danger zone;
- empty/locked states.

Validation:

- source tests for component names/patterns where useful;
- no business logic changes.

## Phase 3 - Teacher Redesign

Teacher has the strongest Figma coverage and the highest confirmed workload-density concern.

Order:

1. `/teacher` as Review Inbox.
2. `/teacher/schedules` as schedule approval queue.
3. `/teacher/advisor-requests` as advisor request queue.
4. `/teacher/proposals` using Project Review Detail pattern.
5. `/teacher/progress1`, `/teacher/progress2`, `/teacher/final` using scoring detail pattern.
6. `/teacher/reports` using report review detail pattern.
7. `/teacher/advisor-score` using advisor score detail pattern.

Must verify:

- needs-action appears first;
- waiting/completed are separate;
- role overlap is visible;
- unauthorized actions do not appear;
- mobile cards do not overflow.

## Phase 4 - Admin Redesign

Order:

1. `/admin` as operational overview.
2. `/admin/rounds` as lifecycle round management.
3. `/admin/round-exceptions`.
4. `/admin/proposals`.
5. `/admin/schedules`.
6. `/admin/reports`.
7. `/admin/closeout`.
8. `/admin/evidence`.

Must preserve:

- eligible vs not-yet-eligible separation;
- eligible-but-incomplete close guard;
- late/reopen exception visibility;
- Final grade-I warning;
- existing export routes and labels;
- existing close acknowledgement semantics.

## Phase 5 - Student Design Completion

Do not do a full Student redesign until missing Student design direction is written.

Required Student design docs/mockups:

1. Student Dashboard.
2. Evidence/Schedule page.
3. Report page.
4. Feedback/Result page.
5. Locked/Late/Recovery states.

Minimum implementation if no Figma student mockup exists:

- keep layout conservative;
- improve readability only;
- use current text;
- do not change workflow sequence.

## Phase 6 - Student Redesign

Order:

1. `/student`.
2. `/student/proposal`.
3. `/student/schedule`.
4. `/student/report`.
5. `/student/feedback`.
6. `/student/project` and `/student/origin` if needed.

Must verify:

- next action is clear;
- waiting state is truthful;
- locked state is not misleading;
- evidence saved still shows next step;
- report revision is understandable;
- completed state has no stale pending tasks.

## Phase 7 - Old-vs-New Regression

For each replaced page:

- compare old and new available actions;
- compare counts/statuses;
- confirm same role permissions;
- confirm same submit behavior;
- confirm post-submit state;
- confirm mobile behavior.

## Phase 8 - Full Redesign QA

Run:

```bash
cmd /c npm.cmd run typecheck
cmd /c npm.cmd test
cmd /c npm.cmd run build
```

Live QA:

- Admin rounds/closeout/evidence;
- Teacher inbox/detail/scoring;
- Student dashboard/schedule/report/feedback;
- unauthorized teacher check;
- export check;
- mobile viewport check.

## Phase 9 - Readiness Decision

Possible outcomes:

1. Ready for QA redesign pilot.
2. Patch Teacher/Admin density first.
3. Student design required before full replacement.
4. Roll back to baseline.

Production is out of scope until the redesign QA pass is explicitly approved.
