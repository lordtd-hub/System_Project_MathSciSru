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

## QA Runbook Notes

- After every new QA preview push, testers must open the new preview URL before checking fixes. Old preview URLs will not contain the latest patch.
- Use one persistent Edge session during pilot testing. Do not close the browser between role switches.
- If `playwright-cli open` makes the browser flash and disappear, use the persistent Edge CDP method instead and keep the window open through the pilot.
- Admin late/missed round handling should be explained as a dedicated operational list. The round overview page is now a summary/control page; detailed exception handling happens on `/admin/round-exceptions`.
