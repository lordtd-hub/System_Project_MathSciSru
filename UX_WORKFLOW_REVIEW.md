# UX Workflow Review

## Manual QA checklist

1. Admin saves proposal result -> success visible: expect "บันทึกผลเรียบร้อยแล้ว" and updated final decision badge/details.
2. Admin closes round -> status changes visibly: expect "ปิดรอบแล้ว", closed timestamp, and disabled close button.
3. Proposal summary is not cluttered by teacher claims: teacher account claims appear only at `/admin/claims`.
4. Student dashboard shows only next valid action: primary buttons come from `available_now`.
5. Completed progress stage is read-only: completed cards show "ดู feedback" / "ดูย้อนหลัง" instead of editable actions.
6. Future stages are locked: cards show "ยังไม่ถึงขั้นตอน" and disabled buttons.
7. Important actions ask for confirmation: close Proposal round, final decision, and committee assignment prompt before submit.
8. Error/success messages are in Thai: shared feedback component displays Thai success/error messages.

## Scope note

This review tracks workflow-aware UX and action feedback for Lifecycle v2. Progress 1 / Progress 2 / Final Presentation scoring, the report approval loop through `REPORT_APPROVED`, Advisor score 25%, and Admin final closeout are now functional. External magic links, full AUN-QA export, production deployment, and numeric report scoring remain outside the current baseline.

## Desktop/Mobile addendum

1. Desktop first: Admin pages should show headers, next actions, status badges, grouped cards, and clear primary actions above dense details.
2. Mobile second: pages should stack into one column, avoid horizontal overflow, and make buttons/checkboxes easy to tap.
3. Proposal scoring: rubric groups remain aligned to the course criteria and are collapsible/tappable on mobile.
4. Student pages: show only the current valid action as primary; completed stages are history and future stages are locked.
5. Teacher pages: pending work should appear as cards; schedule approve/reject actions stack on narrow screens.

See `RESPONSIVE_UI_REVIEW.md` for the manual viewport checklist.

## Markdown/LaTeX workflow checklist

1. Student submits Proposal abstract containing `$x_{n+1}=f(x_n)$` and a display equation; preview renders math before submit.
2. Teacher Proposal scoring page shows student abstract/details with rendered math.
3. Teacher comment field previews Markdown + LaTeX before save.
4. Student Proposal/Feedback pages show teacher comments with rendered LaTeX and teacher names.
5. Student pages still hide Proposal scores.
6. Raw HTML test `<script>alert("xss")</script>` does not execute and does not render as active script.
7. Long display equations scroll horizontally on mobile instead of overflowing the page.

## Phase 2A scheduling checklist

1. Student with `IN_PROGRESS` project and open Progress 1 round can submit a preferred date/time/room.
2. Student sees a Thai success message after saving the schedule request.
3. Student cannot schedule Progress 1 before the course-level Progress 1 round opens.
4. Student cannot schedule Progress 1 when committee readiness is incomplete.
5. Re-submitting a schedule for the same project/round updates the visible request instead of creating a duplicate history card.
6. Teacher schedule page shows only relevant advisor/committee schedules.
7. Admin schedule page shows all submitted schedule requests.
8. Progress 1 score form is visible only to assigned HEAD/MEMBER teachers.
9. Progress 1 score form validates each criterion range and shows a Thai success/error message.
10. Progress 2 score form is visible only to assigned HEAD/MEMBER teachers.
11. Progress 2 score form validates each criterion range and shows a Thai success/error message.
12. Final Presentation score form is visible only to assigned HEAD/MEMBER teachers.
13. Final Presentation score form explains the 80-point raw rubric and validates each criterion range.
14. Student report page allows submission only at `FINAL_DONE` or after a revision request.
15. Teacher report page shows only assigned advisor/HEAD/MEMBER report reviews.
16. Teacher report PASS / request-revision actions show Thai success feedback.
17. Report approval stops at `REPORT_APPROVED` until the advisor submits Advisor score.
18. Advisor score page is visible only to the project advisor and blocks projects before `REPORT_APPROVED`.
19. Advisor score submission shows Thai success feedback and moves only to `ADVISOR_SCORING`, not `COMPLETED`.
20. Admin closeout page shows near-completion projects with checklist items for Progress 1, Progress 2, Final, Report approved, Advisor score, and unresolved report revision.
21. Admin closeout button appears only when all requirements are complete.
22. Student at `ADVISOR_SCORING` sees a neutral waiting state, not hidden score details.

## HTTP route visibility checklist

1. `/student/schedule` renders for an imported student and does not show 500.
2. `/teacher/schedules` renders for an approved teacher and does not show 500.
3. `/teacher/progress1` renders for an approved teacher and does not show 500.
4. `/teacher/progress2` renders for an approved teacher and does not show 500.
5. `/teacher/final` renders for an approved teacher and does not show 500.
6. `/student/report` renders for an imported student and does not show 500.
7. `/teacher/reports` renders for an approved teacher and does not show 500.
8. `/teacher/advisor-score` renders for an approved teacher and does not show 500.
9. `/admin/schedules` renders for an Admin and does not show 500.
10. `/admin/closeout` renders for an Admin and does not show 500.
11. Pending teacher does not see teacher schedule, report, Advisor score, or Progress 1 / Progress 2 / Final scoring content.
12. Student does not see teacher/admin schedule, closeout, report, Advisor score, or Progress 1 / Progress 2 / Final scoring content.
13. Anonymous user does not see student schedule data.
## 2026-05-06 Stabilization note

- User-facing workflow gates were tightened server-side for actions that could otherwise appear successful from a stale page:
  - already-closed rounds are rejected instead of silently changing `closedAt`;
  - Proposal submission requires the course-level Proposal round to be open;
  - Project Origin submission requires advisor selection before moving to advisor approval;
  - closeout double-submit attempts are rejected after the first successful completion update.
- No broad UI redesign was performed in this pass.
