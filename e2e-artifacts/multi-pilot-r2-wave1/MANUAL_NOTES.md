# MULTI-PILOT-R2 Wave 1 Manual Notes

Purpose: capture what changed, what must still be checked in this wave, and what should be explained in the user manuals for Admin, Teacher, and Student.

QA preview after latest patch:

- `https://system-project-math-sci-3i5axa3re-lordtd-hubs-projects.vercel.app/qa-login`
- Commit: `6eaf815 fix: handle late assessment round exceptions`

## What Was Fixed

### Course round control

- Student actions for Progress 1, Progress 2, and Final now require the relevant course-level `AssessmentRound` to be open.
- Completing one round at project level no longer automatically makes the next round actionable if Admin has not opened the next course round.
- Student schedule/evidence page shows locked or waiting state for future rounds.

### Missed or late round policy

- After a round closes, students who have not submitted are locked by default.
- Student message tells them to contact the responsible instructor/admin.
- Admin can open late access for one project as a case-by-case exception.
- Late access creates audit/timeline evidence.
- Default non-excused penalty is 10% deducted from the score submitted by each evaluator for that round.
- Excused or force-majeure late access keeps the late evidence tag but does not deduct score.
- Student dashboard shows active late/missed round tags.
- If Final closes while the project is still incomplete, student dashboard warns that the student may receive grade I.

### Admin round closing

- Closing Proposal while some students have not submitted now shows the missing student list.
- Admin must explicitly acknowledge the missing list before closing the Proposal round.

### Teacher scoring after late override

- Late-opened Proposal work remains visible to the assigned teacher after the normal Proposal round is closed.
- Teacher Proposal dashboard/list/scoring page shows the late override warning.
- Scoring stores both adjusted score and raw score metadata for audit.

### Queue and wording cleanup

- Pending schedule approval queues are ordered by request submission time first, then proposed exam time.
- Raw internal labels on patched schedule/status surfaces are mapped to Thai-facing labels.
- Duplicate teacher role badges are de-duplicated.

## What Must Still Be Checked In This Wave

### Targeted regression checks before continuing

- Student 01 after Progress 1 complete must not see Progress 2 as actionable while Progress 2 round is closed.
- Admin opens Progress 2, then Student 01 should see Progress 2 action appropriately.
- Student 02 after Proposal round closed must see blocked/late state, not normal Proposal submission.
- Admin opens late Proposal access for Student 02 and confirms the action appears in timeline/audit.
- Teacher assigned to Student 02 must see the late Proposal scoring task after Admin opens the exception.
- Teacher scoring Student 02 Proposal should show the late warning and apply 10% penalty unless Admin marked excused.

### Continue Wave 1 project flow

- Finish Project 04 and Project 05 Progress 1 scoring.
- Verify Project 05 schedule rejection/resubmit flow.
- Verify teacher queues clear after each reviewer submits.
- Verify completed Proposal tasks do not remain actionable.
- Verify Teacher Delta has no unauthorized committee/advisor work.
- Verify old Proposal routes after closure are read-only or clearly blocked.

### Progress 2 and Final checks

- Progress 2 should begin only after Admin opens Progress 2 round.
- Projects stuck in Proposal or Progress 1 must not unlock later stages accidentally.
- Final should be actionable only after Final round is opened and previous required work is complete.
- If Final is closed with incomplete projects, student dashboard should show grade-I risk warning.

### Remaining implementation gap before Wave 2

- Admin UI currently has a clear late-opening flow for missed Proposal cases.
- A broader Admin list for missed Progress 1, Progress 2, and Final should be added before Wave 2 if late recovery for those rounds must be operated through the UI.

## Manual Notes For Admin

Explain these points in the Admin manual:

- Admin controls when each course round opens and closes.
- Opening the next round is required before students can act on that round.
- When closing Proposal with missing submissions, Admin must review the listed students and acknowledge before closing.
- Students who miss a round are locked after the round closes.
- Admin may open late access per project only when appropriate.
- Admin must choose whether the late case is ordinary late submission or excused/force majeure.
- Ordinary late submission receives a 10% deduction in that round.
- Excused cases are still recorded as late exceptions but do not deduct score.
- All late openings create audit/timeline evidence.
- If Final is closed and a project remains incomplete, the student may receive grade I; Admin should coordinate with instructor/advisor.

Suggested manual wording:

- "การเปิดส่งย้อนหลังควรใช้เป็นรายกรณีเท่านั้น และระบบจะบันทึกเป็นหลักฐานใน timeline/audit"
- "กรณีส่งหรือสอบไม่ตรงรอบโดยไม่ใช่เหตุสุดวิสัย ระบบหักคะแนนรอบนั้น 10% จากคะแนนที่กรรมการประเมิน"
- "หากปิดรอบ Final แล้วโครงงานยังไม่ครบถ้วน นักศึกษาอาจได้รับเกรด I"

## Manual Notes For Teacher

Explain these points in the Teacher manual:

- Teacher queues show only actionable work for that teacher.
- If a student receives late access after a round closes, the relevant teacher may see that scoring task again.
- The scoring page will show a warning when the item is a late-opened case.
- Teacher should score normally according to rubric; the system applies the late penalty automatically when required.
- If the teacher has already submitted a score, the item should become read-only for that teacher.
- Another required reviewer may still see the task until they submit their own score.
- Schedule approval queue is ordered by student request submission time to support first-submitted-first-reviewed fairness.

Suggested manual wording:

- "กรุณาประเมินตาม rubric ตามปกติ ระบบจะคำนวณการหักคะแนนกรณีส่ง/สอบไม่ตรงรอบให้อัตโนมัติ"
- "รายการที่ส่งคะแนนแล้วจะเป็นสถานะอ่านอย่างเดียว ไม่ต้องส่งซ้ำ"
- "คำขอนัดสอบเรียงตามลำดับเวลาที่นักศึกษาส่งคำขอ"

## Manual Notes For Student

Explain these points in the Student manual:

- Students must submit evidence and exam schedule within the round opened by Admin.
- If the round is not open yet, the system may show waiting or locked state.
- If a student misses a closed round, they cannot submit normally and must contact the responsible instructor/admin.
- If Admin opens late access, the dashboard will show that the round is late or opened as an exception.
- Ordinary late submission may deduct 10% from that round score.
- Excused cases may be opened without penalty, but the exception remains recorded.
- If Final is closed and the project remains incomplete, the student may receive grade I.

Suggested manual wording:

- "หากพ้นกำหนดรอบสอบแล้ว นักศึกษาจะไม่สามารถส่งงานตามปกติได้ กรุณาติดต่ออาจารย์ผู้รับผิดชอบหรือผู้ดูแลระบบ"
- "กรณีได้รับสิทธิ์ส่งย้อนหลัง ระบบจะแสดงป้ายสถานะและบันทึกเป็นหลักฐาน"
- "หากส่งหรือสอบไม่ตรงรอบโดยไม่ได้รับการยกเว้น ระบบหักคะแนนรอบนั้น 10%"

## UX Notes To Watch During Continued Pilot

- Check whether the late-warning text is visible enough on student and teacher pages.
- Check whether Admin can understand the missing-student list before closing Proposal.
- Check whether teachers understand that late penalty is automatic and they should score normally.
- Check whether the schedule/evidence form is too far below the rubric on student schedule page.
- Check whether multi-project teacher queues remain readable when more requests arrive.
- Admin manual should explain that missed/late round recovery is managed from the dedicated `จัดการผู้ส่งย้อนหลัง / นักศึกษาที่พลาดรอบ` page, not directly from the round overview page.
- Admin round overview should be described as a control summary; exception handling should be described as an operational list with search/filter and per-student expansion.
- Admin round overview now separates "พร้อมแต่ยังไม่ครบ" from "ยังไม่พร้อมรอบนี้"; manuals should explain that only the eligible-but-incomplete group is reviewed before closing the current round.
- For Progress 1 / Progress 2 / Final, Admin must acknowledge eligible-but-incomplete projects before closing; projects that have not passed the previous gate are not counted as current-round incomplete.
- Final close warnings should be described with clear grade-I risk wording.

## Notes Added From Wave 1 Continuation

These are not ready for final manuals yet, but should be carried into manual planning after stabilization:

- Student dashboards after Progress 1 completion should explain that Progress 2 is waiting for Admin to open the course round. This wording tested well for Students 04 and 05.
- Schedule rejection/resubmission history is visible in the student evidence trail and should be explained in the student manual as normal recovery behavior.
- Teacher manuals must explain that once a teacher submits a score, that item should disappear from their actionable queue or become read-only for that teacher only.
- Admin manuals should explain that Proposal decision should be made only when required reviewers are complete, or the UI must clearly warn when deciding with missing reviewers.
- Proposal scoring policy clarification: during the valid Proposal scoring window, all teachers may assess Proposal items. After Admin records the Proposal decision, teachers who have not assessed that Proposal should no longer see it as pending work.
- Round gate wording to carry into the manual:
  - Proposal PASS plus committee assignment makes a project eligible for Progress 1.
  - Progress 1 required committee scores make a project eligible for Progress 2.
  - Progress 2 required committee scores make a project eligible for Final.
  - Eligibility after a round has already closed requires the late/reopen exception flow.
- Live Wave 1 check confirmed that Student 03 is the only Progress 1 eligible-but-incomplete project; the other 36 students are not-yet-eligible and should be explained as separate from current-round incomplete work.

## QA Runbook Notes

- After every new QA preview push, testers must open the new preview URL before checking fixes. Old preview URLs will not contain the latest patch.
- Use one persistent Edge session during pilot testing. Do not close the browser between role switches.
- If `playwright-cli open` makes the browser flash and disappear, use the persistent Edge CDP method instead and keep the window open through the pilot.
- Admin late/missed round handling should be explained as a dedicated operational list. The round overview page is now a summary/control page; detailed exception handling happens on `/admin/round-exceptions`.

## Wave 1 Remaining Cleanup Notes

The next pass should not become final manual writing yet. It should stabilize the user-facing explanations that manuals will later rely on.

Primary plan:

- `e2e-artifacts/multi-pilot-r2-wave1/WAVE1_REMAINING_FULL_LOOP_PLAN.md`

Student readability items to carry into the next pass:

- Student dashboard should make "what I need to do now" distinct from "waiting for Admin/teacher" and "locked because previous gate is incomplete".
- Student schedule page should consistently explain evidence saved, schedule proposed, schedule rejected, schedule confirmed, waiting score, and completed scoring states.
- Student report page should distinguish first report submission, waiting review, revision required, version history, approval, and post-approval advisor-score waiting.
- Student feedback page should make completed scores/read-only feedback easy to find without implying there is a pending task.

Admin recovery items to carry:

- Project03 is the main Wave 1 recovery example: eligible for Progress 1, incomplete at close, correctly locked from later rounds.
- Manuals will eventually need a clear explanation of how Admin handles incomplete-after-close cases for Progress 1/2/Final.
- Do not write final manual instructions for non-Proposal late/reopen recovery until the UI decision is settled.

Export/manual items to carry:

- Grade summary CSV/XLSX exists and returned non-empty content in Wave 1.
- Before manuals, confirm final column names and whether the registrar expects additional total/status columns.

## 2026-05-13 Operational Notes From Progress 1 Closure

These notes should be carried into manual planning later, but no documentation/manual screenshot pass was started.

### Admin

- Admin can now see that Progress 1 has one eligible-but-incomplete project and 36 not-yet-eligible projects.
- The 36 not-yet-eligible projects should be explained as "not current-round blockers".
- The close acknowledgement wording is understandable for the controlled pilot: Admin sees Project03 and must acknowledge before closing.
- The round summary is useful at 40-student scale after grouping not-ready reasons.
- Remaining pain point: after closing Progress 1, Project03 was not listed in the Progress 1 late/reopen exception page, so Admin recovery for eligible-but-incomplete Progress rounds is not clear enough for real operation.

### Student

- Students 01, 04, and 05 saw Progress 2 as available after Admin opened the Progress 2 round.
- Student03 stayed locked from Progress 2 because Progress 1 was not completed.
- Student manual should explain that passing the previous gate and Admin opening the round are both required before the next round becomes actionable.

### Teacher

- Teacher01-04 did not get stale Progress 1 scoring tasks after Progress 1 closure.
- Teacher01-04 did not get Progress 2 scoring tasks immediately after the round opened, which is correct because students have not submitted/confirmed Progress 2 schedules yet.
- QA Teacher Delta had no unauthorized actionable tasks.
- Teacher manual should explain that opening a round does not create scoring tasks until the student's evidence/schedule flow reaches the required stage.

### UI Debt To Carry

- Add a dedicated panel for eligible-but-incomplete projects after closure.
- Add a broader reopen workflow panel for Progress 1, Progress 2, and Final, not only Proposal.
- Add clearer late/excused management UI for non-Proposal rounds.
- Keep improving Admin action hierarchy; open/close/reset controls are still dense in the round cards.

## 2026-05-13 Progress 2 Continuation Note

Do not turn this into manual content yet. This is an operational blocker note from the continued pilot.

- Student01 could see and submit the Progress 2 evidence form.
- After evidence save, `/student/schedule?success=assessment_evidence_saved` rendered only the app shell instead of returning to the full schedule/evidence page.
- This blocks safe continuation because the next expected student action is proposing the Progress 2 schedule.
- Before writing manuals or screenshots for Progress 2, verify the active QA preview keeps full page content after saving assessment evidence.
- Screenshot: `screenshots/progress2-student01-evidence-submitted-f96.png`

Patch note:

- The current stabilization patch does not redesign the student schedule UI. It adds stable content markers and automated guards so the evidence-save success page must keep the normal schedule/evidence content visible.
- UX/manual debt remains: after live verification, wording and hierarchy around evidence saved -> propose schedule should be reviewed for consistency before any documentation screenshot pass.

## 2026-05-13 Progress 2 Schedule Timezone Note

Do not turn this into final manual text yet.

- Live QA showed schedule times shifted by +7 hours after student submission: a selected `09:00-10:00` appeared as `16:00-17:00`.
- This must be fixed before teacher approvals continue because real users would misunderstand the appointment time.
- Manual wording later should explicitly state that all round and schedule times are displayed in Thailand time.
- Existing pending schedule requests created before the fix may need UI recovery by rejection/resubmission; do not correct them by direct database editing during the pilot.

## 2026-05-13 Notes From Completed Progress 2 Loop

Do not convert this into polished manual content yet.

### Student

- Students should understand that after a Progress round closes, the schedule page may show history/status but no new schedule form until Admin opens the next round.
- Progress 2 feedback/score is visible for Student01/04/05 after required committee scoring completed.
- Student03 correctly remains without Progress 2 visibility because Progress 1 was not completed.
- Later student manual should state that all schedule times are Thailand time.

### Teacher

- Teacher01/02/03 queues behaved correctly with multiple pending Progress 2 schedule approvals and scoring items.
- Teacher04 and Teacher Delta had no unauthorized actionable Progress 2 work.
- Queue scale UX concern remains: `/teacher/schedules` mixes confirmed read-only history with pending action cards, so at 10+ projects it should become an inbox/table with filters rather than long cards.
- Recommended later UX pattern: separate actionable inbox from read-only agenda/history, with filters by round, action type, role, and status.

### Admin

- Progress 2 close guard was understandable because eligible-but-incomplete was `0` and not-yet-eligible was separate.
- After Progress 2 close, Final remained unopened and must be opened by Admin deliberately.
- Admin action hierarchy still needs a redesign: duplicate open/close buttons and dense control placement make automation and human scanning harder.
- During automation, direct `click()` on the Progress 2 close button did not change state, but submitting the same form via `requestSubmit()` closed the round. Verify real manual clicking during a later UI pass.

## 2026-05-13 Final Round Early Notes

Do not turn this into polished manual content yet.

### Admin

- Opening Final after Progress 2 close worked and preserved the eligibility separation.
- Final guard wording is operationally important: eligible-but-incomplete Project01/04/05 are the current-round blockers, while 37 projects remain not-yet-eligible.
- The grade-I warning appears in the Final close guard before any Final work is completed.

### Student

- Student01 could see the Final evidence form before submission.
- After the valid Final evidence save, the first post-submit navigation briefly/initially showed shell-only content. Refreshing restored the schedule page with saved evidence, so the saved data was not lost.
- This should be explained as an operational bug, not user behavior. The stabilization patch should prevent route/cache reuse from hiding schedule content after evidence or schedule saves.

### UI/Operational Debt

- Continue to watch `/student/schedule` after every valid submit; post-submit routes must never require a user refresh.
- The student evidence-to-schedule transition should later be made more visually explicit, but no redesign is included in the current patch.

## 2026-05-13 Final Post-Submit Recovery Note

Do not turn this into manual text yet.

- The first cache/redirect patch was not sufficient for all Final evidence saves.
- Student05 also hit a shell-only page after Final evidence save, even with a unique `submission_id` in the URL.
- Reload restored the content and schedule form, so the data was saved but the soft post-submit transition was unreliable.
- A small one-time recovery guard was added in the student layout for schedule success URLs only.
- Later UX debt remains: the user should see an explicit "evidence saved, next propose schedule" state without ever needing to understand refresh/recovery behavior.

## 2026-05-13 Final Scoring Counter Note

Do not turn this into manual text yet.

- Final scoring itself accepted the required reviewer submissions when the confirmation dialog was accepted.
- A single Project05 reviewer score did not complete Final early, which confirms the reviewer-completion guard behaved correctly.
- After all required Final scores were submitted, Admin `/admin/rounds` briefly became misleading because projects moved to `FINAL_DONE` were no longer counted as historically eligible for Final.
- The fix should keep completed lifecycle statuses in historical eligibility buckets so Admin sees completed work as completed, not as "not yet eligible".
- Later manual/UX work should explain that Final-complete projects may move to a post-Final status, but the round summary should still retain them in the completed bucket for that round.

## 2026-05-13 Final Report Readiness Note

Do not turn this into manual text yet.

- Final close should unlock report submission only for projects that actually completed required Final committee scoring.
- Closing the Final course round is not sufficient by itself to unlock report submission for incomplete projects.
- Student03 exposed the important edge case: the project was still `IN_PROGRESS` and Final-incomplete, but the report form appeared because the page treated the closed Final round as completion.
- Manual wording later should say "after Final assessment is completed" rather than "after Final round is closed", unless the UI explicitly distinguishes incomplete/grade-I recovery.

Live follow-up:

- After the report readiness patch, Student01/04/05 could see report submission readiness, while Student03 no longer saw the report form.
- Keep this wording distinction for manuals later: "Final assessment completed by required committee scoring" is the gate; "Final round closed" is not enough for incomplete projects.

## 2026-05-13 Report Workflow and Closeout Notes

Do not turn this into polished manual text yet.

### Student

- Student01/04/05 report submission worked after Final completion.
- After first report submission, students saw waiting-for-review/history state rather than a stale submit form.
- Student05 revision flow was understandable enough for the pilot: revision feedback appeared, version 2 could be submitted, and report history remained visible.
- Student03 correctly remained locked from report submission because Final scoring was incomplete.
- Later student manual should explain report versions clearly: first complete report, reviewer revision request, new version, latest-version review.

### Teacher

- Report review queues worked with multiple reviewers and a revision loop.
- The latest-version rule behaved correctly: a PASS on an old version did not approve the new version automatically.
- Advisor score unlocked only after report approval and became read-only after submission.
- Queue scale UX concern remains: report review and advisor score pages are functional, but long lists should become filterable inbox/table views before real high-volume operation.

### Admin

- Admin closeout worked for Project01/04/05 after Final complete, report approved, and advisor score submitted.
- Completed student dashboards had no misleading pending task count.
- `/admin/evidence` showed completed/incomplete separation after closeout: 3 complete, 37 incomplete.
- Grade summary export is now visible under evidence export and returned non-empty CSV/XLSX files during QA.
- Registrar/report-card format may still need a decision before production use, especially whether to include incomplete/blank/grade-I wording and exact column naming.

### UI/Operational Debt

- Keep Project03 as the recovery-path scenario for non-Proposal late/reopen design.
- Teacher queues should later separate actionable inbox items from read-only history.
- Admin closeout and evidence pages are operationally usable, but the final UX pass should improve hierarchy and scanning for 40+ projects.
- Do not start Wave 2 or documentation screenshots until the user explicitly approves the next phase.
