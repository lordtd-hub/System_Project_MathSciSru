# Teacher Workload UX Audit

Date: 2026-05-13
Scope: MULTI-PILOT-R2 Wave 1 teacher-facing workload stabilization after full lifecycle completion.

## Guardrails

- UI/presentation changes only.
- No auth, lifecycle, scoring, round eligibility, Prisma schema, or production changes.
- Existing pilot data must not be reset.
- Unauthorized actions must remain hidden.

## Pages Inspected

- `src/app/teacher/page.tsx`
- `src/app/teacher/schedules/page.tsx`
- `src/app/teacher/proposals/page.tsx`
- `src/app/teacher/progress1/page.tsx`
- `src/app/teacher/progress2/page.tsx`
- `src/app/teacher/final/page.tsx`
- `src/app/teacher/reports/page.tsx`
- `src/app/teacher/advisor-score/page.tsx`
- `src/app/teacher/advisor-requests/page.tsx`

## Findings By Page

### Teacher dashboard

- Current state: already has a dashboard action queue and compact metrics.
- Needs action: advisor requests, schedule approvals, proposal/progress/final scoring, report review, advisor score.
- Waiting/completed: confirmed schedules and submitted proposal scores appear beside action items.
- Risk: dashboard is acceptable, but it can still feel dense when the same teacher is advisor, chair, and committee for multiple projects.
- Recommendation: keep dashboard behavior, avoid broad redesign, and rely on clearer downstream queue pages.

### `/teacher/schedules`

- Needs action: proposed schedules where this teacher is a required approver and has not approved/rejected.
- Waiting/completed: confirmed schedules and approvals already submitted by this teacher.
- Role overlap: advisor/chair/committee badges are present in dashboard, but schedule page can still require scanning long cards.
- Density issue: confirmed calendar appears before the actionable approval queue, so a teacher with many confirmed schedules must scroll to current work.
- Recommendation: put actionable approvals first, add compact workload summary, and keep confirmed calendar as a separate compact group.

### `/teacher/proposals`

- Needs action: evaluator assignments without submitted score.
- Completed: assignments with submitted score.
- Risk: submitted items still sit in the same list as pending items and use a similarly prominent navigation affordance.
- Recommendation: split into needs action and completed/read-only groups; make completed action secondary.

### `/teacher/progress1`

- Needs action: only projects with confirmed Progress 1 schedule and no submitted score for this teacher are fetched.
- Waiting/completed: not shown by query.
- Density issue: each scoring form is long; multiple projects make the page hard to scan before acting.
- Recommendation: add a compact queue summary and jump links above the forms.

### `/teacher/progress2`

- Same pattern as Progress 1.
- Recommendation: add compact queue summary and jump links above the forms.

### `/teacher/final`

- Same pattern as Progress 1/2.
- Recommendation: add compact queue summary and jump links above the forms.

### `/teacher/reports`

- Needs action: latest report version awaiting this teacher review.
- Waiting: teacher already reviewed current latest version, or a revision has already been requested and student must submit a new version.
- Completed: report approved.
- Returned / needs revision: latest version has a revision request.
- Risk: all projects render in one long sequence, so actionable review work is mixed with waiting/completed evidence.
- Recommendation: group by queue state and keep latest-version wording visible.

### `/teacher/advisor-score`

- Needs action: advisor score unlocked and not yet submitted.
- Waiting/locked: final/report prerequisites incomplete.
- Completed: advisor score submitted or project completed.
- Risk: editable, waiting, and completed projects are mixed in one list.
- Recommendation: group by queue state and show locked/waiting states as non-actionable.

### `/teacher/advisor-requests`

- Needs action: pending advisor requests.
- Completed: approved/rejected requests.
- Risk: page can become long if old approved/rejected requests remain visible.
- Recommendation: group pending first and keep historical requests separate. This can be patched if it shares the queue component safely.

## Cross-Cutting Issues

- Actionable work should always appear before passive evidence.
- Completed work should not look like fresh work.
- Waiting states need explicit labels so teachers do not keep looking for missing buttons.
- Role overlap should use compact badges: Advisor, Chair, Committee.
- High-count pages should use summary counts and compact lists before long forms.
- Mobile risk is mainly horizontal overflow from dense labels and long project titles; use wrap-safe badges and single-column stacking.
- Desktop risk is low-density card repetition; use grouped sections and compact item rows.

## Severity

- No blocker found in code inspection.
- No major authorization risk found in inspected UI because action visibility continues to depend on existing server-side queries and action guards.
- UX stabilization is still recommended before Wave 2 because teacher workload perception will degrade with 10+ projects.
