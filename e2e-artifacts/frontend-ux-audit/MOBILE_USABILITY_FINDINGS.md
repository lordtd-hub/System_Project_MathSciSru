# Mobile Usability Findings

Date: 2026-05-14

Tested viewport: 390px portrait through Edge CDP.

## Result Summary

No audited Student, Teacher, or Admin route showed detected horizontal overflow at 390px. This is a good baseline. The remaining mobile issue is page length and information priority, not broken layout.

## Student Mobile

Status: mostly usable.

What works:

- Student dashboard stacks correctly.
- Current/waiting/completed/locked sections are readable.
- Proposal, schedule, report, and feedback pages render without horizontal overflow.
- Buttons are generally reachable.

What still feels hard:

- `/student/schedule` is long because it contains many correct sections.
- History and completed/locked rounds can push the active context farther down.
- Some repeated status cards feel heavier than the value they provide.

Recommendation:

- Preserve spacious forms.
- Collapse completed/locked/history sections.
- Keep only the next action and active warning above the fold.

## Teacher Mobile

Status: usable for quick checks, but dense for daily workload.

What works:

- Teacher dashboard, schedules, proposals, progress, final, reports, and advisor-score pages render without horizontal overflow.
- Compact agenda list avoids unbounded growth on the dashboard.
- Queue cards stack correctly.

What still feels hard:

- Dashboard still includes account/role and shortcut panels that do not help the teacher complete the next task.
- Many completed items can still make the page feel longer than necessary.
- Forms should remain large, but dashboard summaries should stay compact.

Recommendation:

- Put current work first.
- Keep long queues internally scrollable when showing repeated rows.
- Remove duplicate navigation widgets from the dashboard.
- Use compact queue objects on dashboard; use full detail only on review/scoring pages.

## Admin Mobile

Status: technically passable, but not ideal for complex operations.

What works:

- Admin dashboard, rounds, closeout, proposals, schedules, and evidence pages render without horizontal overflow.
- Buttons remain present.
- Evidence/export page remains accessible.

What still feels hard:

- `/admin/proposals` is extremely long on mobile.
- `/admin/schedules` has many status badges and repeated entries.
- Round open/close/reset actions should not feel like ordinary navigation on a small screen.

Recommendation:

- Treat Admin mobile as read-only/check-oriented for most real use.
- Keep complex round controls and closeout work desktop-first.
- Add stronger compact lists and collapsed completed/history sections before broad mobile Admin use.

## Mobile Acceptance Notes

Passed:

- 390px width no horizontal overflow on audited routes.
- Student and Teacher pages are readable enough for quick use.
- QA role login guard worked when scripts selected role first.

Not yet ideal:

- Vertical page length is still high.
- Some cards and badges consume too much attention for low-value status information.
- More sections should be collapsible or scroll-limited by content type.
