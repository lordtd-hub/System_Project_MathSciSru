# Role-by-Role UX Findings

Date: 2026-05-14

## Student

Overall result: usable, with the clearest next-action model among the three roles.

Strengths:

- Dashboard separates current action, completed/history, and locked/future states better than earlier pilot versions.
- Schedule/report/feedback pages now have readability summaries that help students understand whether they should act or wait.
- Mobile 390px rendering passed without detected horizontal overflow.

Pain points:

- `/student/schedule` is accurate but long on mobile. Students must pass through summary, guide, rubric, schedule history, evidence, proposal, and feedback/history sections.
- Completed and locked rounds still take vertical space even when the student only needs one current action.
- Data-entry pages should not become compact like dashboard cards. Forms need full-width, calm layouts.

Recommendation:

- Keep active forms large and easy to fill.
- Collapse history/locked details under headings after the next action section.
- Before manual screenshots, run a language pass for status text so students see plain Thai instructions instead of workflow terminology.

## Teacher

Overall result: operationally usable, but still the role most sensitive to workload density.

Strengths:

- Teacher dashboard and subpages render successfully on desktop and mobile.
- Action/waiting/completed grouping exists and generally matches backend state.
- The agenda list is now compact enough to scan and does not force the whole dashboard to grow endlessly.
- Role dropdown login guard was respected in the live verification scripts.

Pain points:

- Teacher dashboard still repeats navigation and workload concepts. The role/account panel and shortcut buttons compete with actual work.
- Teachers with many completed schedules/reviews may still see long lists before they know what matters next.
- On mobile, the information is readable but still feels like stacked desktop cards rather than a mobile-first task list.

Recommendation:

- Make "งานที่ต้องดำเนินการ" the main teacher homepage surface.
- Keep "NOW" guidance close to the work queue, not isolated as a competing panel.
- Remove or minimize shortcut widgets that duplicate navigation.
- Keep compact queue rows for dashboard use; use full-detail views only for scoring/review forms.

## Admin

Overall result: stable for trained operators, but highest risk for confusion under high project count.

Strengths:

- `/admin/rounds` bucket semantics are much clearer than before: eligible, submitted, completed, incomplete, not-yet-eligible, and exceptions are separated.
- `/admin/closeout` keeps ready/waiting/completed separation.
- `/admin/evidence` export routes are discoverable and verified.
- Mobile smoke check passed without horizontal overflow.

Pain points:

- `/admin/proposals` and `/admin/schedules` can become very long and dense. The live check counted many badges and controls, which increases search time.
- Dangerous/important Admin actions need to stay visually separated from ordinary links, especially open/close/reset round controls.
- Evidence/history pages still expose technical event/status wording in places.
- Admin mobile works technically, but complex operations are still better suited to desktop.

Recommendation:

- Before Wave 2 expansion, prioritize Admin high-density pages: proposals, schedules, round exceptions, and committee assignment.
- Add compact list/table modes for scan-heavy pages, then expand full detail per project.
- Keep destructive actions in separate warning/action blocks.
- Treat Admin mobile as read/check only where practical; discourage complex round control on small screens unless absolutely necessary.

## Cross-Role Findings

- Basic responsive layout is healthy: no audited route showed horizontal overflow at 390px.
- Vertical fatigue is now a bigger problem than horizontal overflow.
- Dashboard pages should show compact objects; inspection/scoring/report pages should show full-detail objects.
- Thai copy is mostly user-facing, but evidence/history/status areas still need a terminology cleanup.
- The next work should be focused classic UI stabilization, not restarting a visual redesign implementation.
