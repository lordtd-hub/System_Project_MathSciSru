# E2E Lifecycle Review

## 1. Test Date/Time

- 6/5/2569 19:10:04

## 2. Environment

- Workspace: D:\Project_system_codex
- Database: local development PostgreSQL only
- Course offering: e2e-lifecycle-course-offering
- E2E method: automated Prisma lifecycle simulation with optional development route visibility fetches

## 3. Commands Run

- `cmd /c npm.cmd run prisma:validate`
- `cmd /c npm.cmd run typecheck`
- `cmd /c npm.cmd test`
- `cmd /c npm.cmd run build`
- `cmd /c npm.cmd run e2e:lifecycle`

## 4. Demo Users Used

- Admin: dev.admin@sru.ac.th
- Student: 65123456789@student.sru.ac.th (สมชาย ใจดี)
- Student: 65123456790@student.sru.ac.th (สมหญิง รักเรียน)
- Student: 65123456791@student.sru.ac.th (สมปอง ตั้งใจ)
- Teachers: 11 internal E2E teachers, including advisor/head/member test users

## 5. Lifecycle Steps Tested

- 1. Admin opens course: PASS - ภาคเรียนที่ 1 ปีการศึกษา 2568, Mathematical Project Course (e2e-lifecycle-course-offering)
- 2. Admin imports students: PASS - 65123456789@student.sru.ac.th, 65123456790@student.sru.ac.th, 65123456791@student.sru.ac.th
- 3. Student login/dev login scope: PASS - student 65123456789@student.sru.ac.th scoped to project cmou0m4vg001jzsfss0vc19i4
- 4. Student completes profile: PASS - profile completed and next action unlocked
- 5. DRAFT project creation and advisor request: PASS - advisor request cmou0m4w8001zzsfsb6mzualf
- 6. Advisor approval and reject path: PASS - approve -> PENDING_ADMIN, reject -> DRAFT, 7-day reminder condition present
- 7. Admin confirmation: PASS - project/advisor confirmed
- 8. Student submits Proposal: PASS - invalid link rejected, Google link accepted, project in PROPOSAL_REVIEW
- 9. Teachers score Proposal: PASS - 3 teachers scored; comments visible with teacher names; scores hidden from student
- 10. Proposal fail alert: PASS - FAIL votes >= 50% creates alert condition; course-level Proposal round closed
- 11. Admin final Proposal decision: PASS - PASS -> TOPIC_APPROVED, FAIL -> DRAFT with history
- 12. Committee assignment: PASS - ADVISOR/HEAD/MEMBER assigned; Progress 1 still not open automatically
- 13. Self-scheduling skeleton: PASS - Admin opened one course-level Progress 1 round; reject path blocks confirmation; approve-all confirms schedule
- 14. Progress 1 / Progress 2 / Final Present skeleton cycle: PASS - Progress/Final materials, schedules, and score evidence recorded; project moved to FINAL_DONE
- 15. Report Approval Loop: PASS - v1 fail then v2 pass; previously passed reviewer skipped new version; report approved
- 16. Advisor score: PASS - locked before close, unlocked after ปิดเล่ม, score submitted
- 17. Admin completes project: PASS - project completed
- 18. HTTP route visibility and guards: PASS - verified /student/schedule, /student/report, /teacher/schedules, /teacher/reports, /teacher/advisor-score, /teacher/progress1, /teacher/progress2, /teacher/final, /admin/schedules, /admin/closeout guards over HTTP
- 19. Duplicate guard verification: PASS - stable course offering has 3 projects, one Proposal round, and preserved FAIL history

## 6. Pass/Fail Result Per Step

| Step | Result | Detail |
| --- | --- | --- |
| 1. Admin opens course | PASS | ภาคเรียนที่ 1 ปีการศึกษา 2568, Mathematical Project Course (e2e-lifecycle-course-offering) |
| 2. Admin imports students | PASS | 65123456789@student.sru.ac.th, 65123456790@student.sru.ac.th, 65123456791@student.sru.ac.th |
| 3. Student login/dev login scope | PASS | student 65123456789@student.sru.ac.th scoped to project cmou0m4vg001jzsfss0vc19i4 |
| 4. Student completes profile | PASS | profile completed and next action unlocked |
| 5. DRAFT project creation and advisor request | PASS | advisor request cmou0m4w8001zzsfsb6mzualf |
| 6. Advisor approval and reject path | PASS | approve -> PENDING_ADMIN, reject -> DRAFT, 7-day reminder condition present |
| 7. Admin confirmation | PASS | project/advisor confirmed |
| 8. Student submits Proposal | PASS | invalid link rejected, Google link accepted, project in PROPOSAL_REVIEW |
| 9. Teachers score Proposal | PASS | 3 teachers scored; comments visible with teacher names; scores hidden from student |
| 10. Proposal fail alert | PASS | FAIL votes >= 50% creates alert condition; course-level Proposal round closed |
| 11. Admin final Proposal decision | PASS | PASS -> TOPIC_APPROVED, FAIL -> DRAFT with history |
| 12. Committee assignment | PASS | ADVISOR/HEAD/MEMBER assigned; Progress 1 still not open automatically |
| 13. Self-scheduling skeleton | PASS | Admin opened one course-level Progress 1 round; reject path blocks confirmation; approve-all confirms schedule |
| 14. Progress 1 / Progress 2 / Final Present skeleton cycle | PASS | Progress/Final materials, schedules, and score evidence recorded; project moved to FINAL_DONE |
| 15. Report Approval Loop | PASS | v1 fail then v2 pass; previously passed reviewer skipped new version; report approved |
| 16. Advisor score | PASS | locked before close, unlocked after ปิดเล่ม, score submitted |
| 17. Admin completes project | PASS | project completed |
| 18. HTTP route visibility and guards | PASS | verified /student/schedule, /student/report, /teacher/schedules, /teacher/reports, /teacher/advisor-score, /teacher/progress1, /teacher/progress2, /teacher/final, /admin/schedules, /admin/closeout guards over HTTP |
| 19. Duplicate guard verification | PASS | stable course offering has 3 projects, one Proposal round, and preserved FAIL history |

## 7. Bugs Found

- No unresolved bugs found by the final lifecycle run.

## 8. Fixes Made

- Student project submission now creates a pending AdvisorRequest.
- Proposal submission now moves the project to PROPOSAL_REVIEW and assigns proposal evaluators.
- Teacher advisor request page now performs approve/reject actions.
- Proposal score submission now requires a comment when submitted.
- Admin committee page now performs HEAD/MEMBER assignment and moves the project to IN_PROGRESS.
- Lifecycle E2E now cleans and reuses stable demo IDs so reruns do not grow duplicate projects or rounds.
- Admin completion now checks Progress 1, Progress 2, Final, report approval, advisor score, and unresolved report revision before COMPLETED.

## 9. Screenshots Or Route References

- Route reference: /admin
- Route reference: /student
- Route reference: /teacher
- Route reference: /student/proposal
- Route reference: /teacher/proposals
- Route reference: /admin/proposals

## 10. Remaining Limitations

- The E2E command uses direct service/database actions for later skeleton stages instead of full browser clicks for every Progress/Final/Report button.
- Detailed Progress 1, Progress 2, Final scoring rubrics are intentionally not implemented.
- External committee magic links and full AUN-QA export are intentionally not implemented.
- Report/article numeric scoring is intentionally not implemented.

## 11. Final Verdict

PASS: simulated lifecycle completed
