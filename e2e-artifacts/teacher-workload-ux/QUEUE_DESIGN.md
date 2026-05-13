# Teacher Workload Queue Design

Date: 2026-05-13
Scope: teacher UX presentation semantics only.

## Queue Groups

1. Needs action
   - Teacher can act now.
   - Primary action is visually strongest.
   - Always first.

2. Returned / Needs revision
   - Student/project must revise before teacher can continue, or teacher has already returned the item.
   - Not presented as an active teacher task.

3. Waiting
   - Waiting for student, admin, another teacher, schedule confirmation, or round state.
   - Secondary/detail links only.

4. Completed
   - Teacher action for this step is done.
   - Read-only/detail links are secondary.

5. Locked / Not available
   - Prerequisites are not met.
   - No primary action.

## Filters

Use where the page contains mixed work:

- Round: Proposal / Progress 1 / Progress 2 / Final / Report / Advisor Score
- Role: Advisor / Chair / Committee
- Status: pending / waiting / completed / returned / locked

For this stabilization pass, filters may be represented as visible grouped counts rather than interactive controls when the page has only one dominant dimension.

## Badge Semantics

- Round badge: names the assessment/report area.
- Role badge: Advisor, Chair, Committee.
- Status badge:
  - Needs action: high-emphasis warning/red badge.
  - Waiting: muted/locked badge.
  - Completed: ok badge.
  - Returned: warning badge.
  - Locked: lock badge.

## Layout Rules

- Put Needs action first.
- Do not mix completed work with actionable work.
- Use compact rows/lists before long forms.
- Keep primary action on the right on desktop and full-width on mobile.
- Keep secondary/detail actions less prominent.
- Keep existing links and forms intact.
- Never show unauthorized actions.
- Do not change data queries except for UI-only ordering/grouping of already fetched data.

## Page Application

- Dashboard: keep existing action queue; avoid broad redesign.
- Schedules: needs-action approvals first, confirmed calendar second.
- Proposals: split pending score vs submitted score.
- Progress 1/2/Final: add compact queue summary and jump links before long scoring forms.
- Reports: group latest-version work into needs action, returned, waiting, completed.
- Advisor score: group editable, waiting/locked, completed.
- Advisor requests: pending first, historical decisions second when patched.

## Out Of Scope

- New lifecycle states.
- Scoring calculation changes.
- Round eligibility changes.
- Authorization changes.
- Database schema changes.
- Production deployment.
- Manual documentation screenshots.
