# MULTI-PILOT-R2 Wave 1 Report

## Summary

- QA preview: `https://system-project-math-sci-adoptrunj-lordtd-hubs-projects.vercel.app/qa-login`
- Tested commit: `7f1321c` (`fix: clarify teacher wave queue status`)
- Browser: Microsoft Edge via one persistent Playwright session (`edgepilot`)
- Run date: 2026-05-12
- Mode: operational workflow testing, not documentation screenshots

## 2026-05-13 Continuation: Progress 1 Closure and Progress 2 Transition

- QA preview: `https://system-project-math-sci-f96db92qp-lordtd-hubs-projects.vercel.app`
- QA commits in scope: `8ec1533`, `6354e14`
- Browser: Microsoft Edge persistent session via CDP
- Mode: operational workflow testing; no production deploy; no direct DB manipulation

### Admin Rounds Verification

`/admin/rounds` was verified before taking action.

Progress 1 showed the intended buckets:

- Ready / eligible: `4`
- Submitted current-round evidence: `3`
- Completed current-round assessment: `3`
- Eligible but incomplete: `1`
- Not yet eligible: `36`
- Open exceptions: `0`

The eligible-but-incomplete warning listed only Project03:

- `R2STU03 MULTI-PILOT-R2 Student 03 - MULTI-PILOT-R2 Project 03 ระบบทดสอบหลักฐานไม่ครบ`

The 36 not-yet-eligible projects were not listed as Progress 1 close blockers. The summary section grouped not-ready students by cause instead of rendering a long list.

Screenshot:

- `screenshots/admin-rounds-pre-close-progress1-f96db92qp.png`

### Project03 Handling Decision

Chosen pilot action: leave Project03 incomplete and proceed with Admin acknowledgement.

Reason:

- The purpose of this pass was to validate the new eligible-vs-not-eligible close policy.
- Project03 was the only eligible-but-incomplete project, so it was the correct case to test the acknowledgement-before-close behavior.
- Completing Project03 first would avoid the exact guard path that needed live validation.

After Progress 1 was closed, `/admin/round-exceptions?round_type=PROGRESS_1` was checked for recovery/reopen handling. It did not list Project03 and showed zero missing/open-late rows for Progress 1.

Operational result:

- Progress 1 close acknowledgement works.
- Project03 is not clearly recoverable through the current Progress 1 exception UI after closure.
- This is a remaining operational gap before Wave 2 if late Progress/Final recovery must be handled by Admin through the UI.

Screenshot:

- `screenshots/admin-round-exceptions-progress1-after-close-project03.png`

### Progress 1 Closure

Admin acknowledged the eligible-but-incomplete Project03 warning and closed Progress 1 through the UI.

After closure:

- Progress 1 status: closed
- Progress 1 counts remained:
  - ready `4`
  - submitted `3`
  - completed `3`
  - eligible-but-incomplete `1`
  - not-yet-eligible `36`
- Progress 2 open action became available.

Screenshot:

- `screenshots/admin-rounds-after-progress1-close-ack.png`

### Progress 2 Opening

Admin opened Progress 2 through `/admin/rounds`.

After opening:

- Progress 2 status: open
- Progress 2 ready / eligible: `3`
- Progress 2 eligible-but-incomplete: `3`
- Progress 2 not-yet-eligible: `37`
- Progress 2 warning listed only Projects 05, 04, and 01 as ready but incomplete.
- Project03 was not included in Progress 2 eligibility.

Screenshot:

- `screenshots/admin-rounds-after-progress2-open.png`

### Student Visibility After Progress 2 Open

Verified through QA role switching in Edge.

Expected unlock:

- Student01: Progress 2 dashboard action and schedule/evidence controls visible.
- Student04: Progress 2 schedule/evidence controls visible.
- Student05: Progress 2 dashboard action and schedule/evidence controls visible.

Expected lock:

- Student03: Progress 2 shown as not yet reached/locked; no active Progress 2 controls.

Screenshots:

- `screenshots/multi-r2-student-01-dashboard-after-progress2-open.png`
- `screenshots/multi-r2-student-01-schedule-after-progress2-open.png`
- `screenshots/multi-r2-student-04-dashboard-after-progress2-open.png`
- `screenshots/multi-r2-student-04-schedule-after-progress2-open.png`
- `screenshots/multi-r2-student-05-dashboard-after-progress2-open.png`
- `screenshots/multi-r2-student-05-schedule-after-progress2-open.png`
- `screenshots/multi-r2-student-03-dashboard-after-progress2-open.png`
- `screenshots/multi-r2-student-03-schedule-after-progress2-open.png`

Observation:

- Student04 dashboard first sample was sparse during one automated read, but `/student/schedule` correctly showed Progress 2 controls. Student01 was rechecked separately and the schedule page correctly showed Progress 2 controls.

### Teacher Queue Verification After Progress 2 Open

Verified Teacher01-04 and QA Teacher Delta.

Results:

- Teacher01-04 dashboards showed no actionable pending queue after Progress 2 opened.
- `/teacher/progress1` showed no stale Progress 1 scoring tasks.
- `/teacher/progress2` showed no Progress 2 scoring tasks yet, as no Progress 2 schedule/evidence has been submitted and confirmed.
- `/teacher/schedules` showed read-only confirmed schedule visibility; no active approval buttons were present.
- QA Teacher Delta had no unauthorized committee/advisor actions and no active scoring/schedule tasks.

Screenshots:

- `screenshots/multi-r2-teacher-01-teacher-dashboard-after-progress2-open.png`
- `screenshots/multi-r2-teacher-02-teacher-dashboard-after-progress2-open.png`
- `screenshots/multi-r2-teacher-03-teacher-dashboard-after-progress2-open.png`
- `screenshots/multi-r2-teacher-04-teacher-dashboard-after-progress2-open.png`
- `screenshots/teacher-delta-teacher-dashboard-after-progress2-open.png`

### Operational Decision Questions

1. Is eligible-vs-not-eligible separation operationally understandable?
   - Yes. Admin can now distinguish the one true close blocker from the 36 not-yet-eligible projects.

2. Is Project03 recoverable after round closure?
   - Not clearly through current UI. The Progress 1 exception page did not list Project03 after closure.

3. Is acknowledgement-before-close sufficient for real admin use?
   - Sufficient for controlled closure, but only if paired later with a visible recovery/reopen path for incomplete eligible projects.

4. Should the system later add dedicated panels?
   - Yes. Add a dedicated incomplete-project panel, late/reopen workflow panel, and late/excused management UI before Wave 2 or before real operation.

5. Is Progress 2 unlock logic now trustworthy?
   - Yes for the tested Wave 1 state: Projects 01/04/05 unlocked, Project03 stayed locked, and 37 not-yet-eligible projects did not unlock.

### Current Recommendation

Wave 1 can continue into Progress 2 operational testing for Projects 01/04/05.

Do not start Wave 2 yet. Wave 2 planning can begin later after Progress 2 schedule/evidence submission, teacher queue updates, scoring, and the Project03 recovery gap are either patched or explicitly accepted as out of scope for Wave 1.

## 2026-05-13 Continuation Stop: Progress 2 Student Evidence Save

- QA preview: `https://system-project-math-sci-f96db92qp-lordtd-hubs-projects.vercel.app`
- Browser: Microsoft Edge CDP session on port `9333`
- Mode: guarded operational workflow testing; no production action; no direct DB manipulation

### Admin Start Guard

`/admin/rounds` was checked as `MULTI-PILOT-R2 Admin` before student action.

Progress 2 state at start:

- Status: open
- Eligible / ready: `3`
- Submitted current-round evidence: `0`
- Completed current-round assessment: `0`
- Eligible but incomplete: `3`
- Not yet eligible: `37`
- Affected ready-but-incomplete list: Projects 05, 04, and 01
- Project03 remained not eligible for Progress 2 and appeared under the readiness summary as Progress 1 incomplete.

Screenshot:

- `screenshots/progress2-continuation-admin-start-f96.png`

### Phase 1 Action Attempt

Role:

- `MULTI-PILOT-R2 Student 01`

Route:

- `/student/schedule`

Guard before action:

- Correct student identity was visible.
- Progress 2 evidence form was visible and enabled.
- Progress 2 was the current actionable schedulable round.

Screenshot before action:

- `screenshots/progress2-student01-schedule-before-submit-f96.png`

Action taken:

- Student01 submitted Progress 2 evidence through the visible student schedule/evidence form.

### Major Bug Found

Severity: Major.

Project:

- Project01

Role:

- Student01

Route:

- `/student/schedule?success=assessment_evidence_saved`

Expected:

- The page should keep the normal schedule/evidence content after saving evidence.
- The page should show the saved Progress 2 evidence state and allow the student to continue to the Progress 2 schedule proposal step.

Actual:

- After the save redirect, the page rendered only the application shell/header/footer/logout context.
- The schedule/evidence content disappeared.
- No Progress 2 schedule proposal form or saved evidence state was visible on the redirected page.

Screenshot:

- `screenshots/progress2-student01-evidence-submitted-f96.png`

Stop decision:

- Pilot continuation stopped immediately because this is a post-submit workflow state mismatch on the active Progress 2 path.
- No Progress 2 schedule was proposed.
- No teacher schedule approval, Progress 2 scoring, or Progress 2 close action was attempted.

Recommendation:

- Do not continue Progress 2 on this QA preview until the post-submit schedule page state is verified on an updated preview or patched for the current target.
- This resembles the previously tracked post-submit blank-page issue for `/student/schedule?success=assessment_evidence_saved`; confirm that the preview used for continuation contains the post-submit stabilization fix before resuming.

Stabilization patch:

- Root cause assessment from current repo source: the active continuation preview that showed the shell-only page did not expose the current post-submit schedule content guards. The local `/student/schedule` source already renders normal content after `success=assessment_evidence_saved`; this patch hardens the page with stable content markers and expands the regression checks so the state cannot silently fall back to shell-only rendering.
- Added stable markers for schedule page content, evidence success alert, round status cards, evidence summary, evidence forms, schedule proposal form wrapper, and latest proposal section.
- Updated the Wave 1 continuation runner template to guard `/student/schedule` after navigation/evidence-save routes by checking the content root, evidence summary, round cards, latest-proposal section, and absence of digest/application-error text.
- Validation after patch:
  - `npm run typecheck`: PASS
  - `npm test`: PASS, 77 files / 314 tests
  - `npm run build`: PASS
  - Secret scan in `e2e-artifacts`: PASS, no QA secret literal found
- Live QA verification is pending until the scoped patch is pushed and Vercel produces the new QA preview URL.

### Validation

- `npm test`: PASS, 77 files / 312 tests

### Current Status

Progress 2 Wave 1 did not complete in this continuation. Final round testing should not begin yet.

Wave 1 continued from the existing R2 state. The workflow did not deadlock, but the run found one important workflow/status risk: after Progress 1 receives the required committee scores, the student dashboard and schedule page start presenting Progress 2 as actionable even though Admin has not opened the Progress 2 round.

Recommendation: patch stabilization before continuing deeper into Progress 2/Final or Wave 2.

## Roles and Projects Tested

### Students

- `MULTI-PILOT-R2 Student 01` / Project 01 / Happy Path
- `MULTI-PILOT-R2 Student 02` / Project 02 / Delayed Proposal
- `MULTI-PILOT-R2 Student 03` / Project 03 / Missing Evidence scenario
- `MULTI-PILOT-R2 Student 04` / Project 04 / Report Revision Loop scenario
- `MULTI-PILOT-R2 Student 05` / Project 05 / Schedule Rejection scenario

### Teachers

- `MULTI-PILOT-R2 Teacher 01`: advisor for Project 01 and 02
- `MULTI-PILOT-R2 Teacher 02`: head for Project 01 and 05, member for Project 04
- `MULTI-PILOT-R2 Teacher 03`: advisor for Project 04 and 05, member for Project 01

### Admin

- `MULTI-PILOT-R2 Admin` / QA Admin flow

## Workflow Phases Completed

1. Verified existing Wave 1 setup state.
2. Completed Proposal round for Projects 01, 03, 04, and 05 enough to close the Proposal round.
3. Kept Student 02 intentionally delayed without Proposal submission.
4. Admin closed Proposal round while Student 02 had no Proposal submission.
5. Verified Student 02 state after Proposal round closure.
6. Admin opened Progress 1 round.
7. Student 01 submitted Progress 1 evidence and schedule request.
8. Student 04 submitted Progress 1 evidence and schedule request.
9. Student 05 submitted Progress 1 evidence and initial schedule request.
10. Teacher 02 rejected Student 05 schedule once.
11. Student 05 saw the rejection clearly and resubmitted a new schedule.
12. Teachers 01, 02, and 03 approved Progress 1 schedules for Projects 01, 04, and 05.
13. Teacher 03 submitted Progress 1 score for Project 01.
14. Teacher 02 submitted Progress 1 score for Project 01.
15. Student 01 saw Progress 1 score and evaluator feedback after 2/2 required scores.

## Proposal Round Closure Edge Case

### Current Behavior

Student 02 did not submit Proposal before the Proposal round was closed.

Before closing:

- Student 02 dashboard still showed Proposal submission as the current action.
- Admin round page showed Proposal as open and allowed closure.
- The Admin UI did not give a strong warning that Student 02 had no Proposal submission.

After closing:

- Student 02 dashboard still offered a Proposal action, which looked actionable.
- Student 02 could open the Proposal form and edit draft text.
- Student 02 could not submit Proposal; the submit action was disabled with a message that the Proposal could not be submitted.
- No clear recovery/late-submission path was visible.

### Result

Current behavior is a mixed hard-lock:

- The form correctly blocks late submission after round closure.
- The dashboard still suggests the student should submit Proposal.
- Admin can close the round without a prominent missing-submission warning.
- Recoverability is unclear.

### Screenshots

- `screenshots/student02-before-proposal-round-close.png`
- `screenshots/admin-rounds-before-closing-proposal-with-student02-missing.png`
- `screenshots/admin-rounds-after-closing-proposal-student02-not-ready.png`
- `screenshots/student02-after-proposal-round-closed-dashboard-still-actionable.png`
- `screenshots/student02-proposal-form-after-round-closed-submit-disabled.png`

## Progress 1 Results

### Passed

- Progress 1 evidence must be saved before schedule request.
- Schedule request locks the evidence after submission.
- Teacher schedule approval queues cleared after each teacher approved.
- Student 05 rejection/resubmission flow worked:
  - student saw the rejection in a clear NOW/action state,
  - rejection reason was visible,
  - revised schedule reset approval count to 0/3,
  - all committee approvals could be completed afterward.
- Teacher-specific Progress 1 scoring queue worked for Project 01:
  - Teacher 03 submitted score, then Project 01 disappeared from Teacher 03 scoring queue.
  - Teacher 02 still had Project 01 as actionable until Teacher 02 submitted.
  - After Teacher 02 submitted, Project 01 disappeared from Teacher 02 scoring queue.
- Student 01 saw Progress 1 result after required scores:
  - average score `100 / 100`,
  - `2/2` evaluator count,
  - feedback from both Teacher 02 and Teacher 03.

### Screenshots

- `screenshots/admin-progress1-opened-after-student02-missed-proposal.png`
- `screenshots/student01-progress1-evidence-form-before-save.png`
- `screenshots/student01-progress1-schedule-submitted-locked.png`
- `screenshots/student04-progress1-schedule-submitted-locked.png`
- `screenshots/teacher02-project05-schedule-rejected.png`
- `screenshots/student05-after-schedule-rejected-can-resubmit.png`
- `screenshots/teacher02-progress1-schedules-approved-queue-clear.png`
- `screenshots/teacher03-progress1-schedules-approved-confirmed-list.png`
- `screenshots/teacher03-progress1-project01-score-saved-readonly.png`
- `screenshots/teacher02-progress1-project01-score-saved-remaining-queue.png`
- `screenshots/student01-after-progress1-complete-progress2-visible-before-admin-open.png`
- `screenshots/student01-schedule-progress2-action-visible-before-round-open.png`

## Bugs Found

### Major: Progress 2 becomes actionable before Admin opens the Progress 2 round

- Role: Student 01
- Project: Project 01
- Routes: `/student`, `/student/schedule`
- Expected: After Progress 1 scores are complete but before Admin opens Progress 2, student should see Progress 1 completed and wait for the next course round to open.
- Actual: Dashboard NOW says `ดำเนินการสอบความก้าวหน้าครั้งที่ 2`, and `/student/schedule` shows Progress 2 as `ดำเนินการได้ตอนนี้` with an active `เสนอวันสอบ` button. The rubric tab still says Progress 2 is not open, so the page gives mixed signals.
- Screenshot: `screenshots/student01-after-progress1-complete-progress2-visible-before-admin-open.png`
- Screenshot: `screenshots/student01-schedule-progress2-action-visible-before-round-open.png`
- Suggested minimal fix: derive student next action and schedule action availability from both project lifecycle completion and the active/open course `AssessmentRound`. If Progress 2 is not open, show a waiting state such as `รอผู้ดูแลระบบเปิดรอบสอบความก้าวหน้าครั้งที่ 2`.

### Major: Late Proposal after round closure creates a confusing dead-end-like state

- Role: Student 02 / Admin
- Project: Project 02
- Routes: `/student`, `/student/proposal`, `/admin/rounds`
- Expected: After Proposal round is closed, student dashboard should no longer present Proposal submission as the current action unless a late/override path exists.
- Actual: Dashboard still shows Proposal submission as current action, but the Proposal form blocks submission.
- Suggested minimal fix: add explicit late/missed-round state wording for students and add Admin warning/acknowledgement when closing a round with missing submissions.

### Minor/UX: Raw internal round/status labels are still visible

- Routes: `/student/schedule`, student evidence timeline
- Examples:
  - `PROGRESS_1 · CONFIRMED`
  - `PROGRESS_1 · REJECTED`
  - `เสนอวันสอบ PROGRESS_1`
  - `บันทึกเอกสาร PROGRESS_1`
- Suggested fix: map to Thai display labels such as `การสอบความก้าวหน้าครั้งที่ 1 · ยืนยันแล้ว`.

### Minor/UX: Teacher confirmed schedule role badges can duplicate

- Role: Teacher 03
- Route: `/teacher`
- Actual: confirmed schedule list showed duplicate role chips such as `ADVISOR ADVISOR` for projects where the teacher is advisor.
- Suggested fix: de-duplicate role labels before rendering.

### UX: Progress evidence/schedule page is long before the form

- Role: Student
- Route: `/student/schedule`
- Actual: The rubric section is useful, but it takes a lot of vertical space before the evidence/schedule form.
- Suggested fix: keep rubric visible but collapse it by default or provide a sticky jump control during operational use.

### Automation/QA Friction: Many confirm dialogs slow multi-user pilot automation

- Routes: scoring and approval forms
- Actual: confirmation dialogs are useful for humans but slow and fragile for automation.
- Suggested test-run approach: pilot scripts should auto-accept known confirmation dialogs only after verifying the expected form/project id.

### Console: one browser console error remains

- Observed consistently in QA preview.
- Not yet diagnosed in this run.
- Suggested fix: inspect console log source before documentation pilot if it affects visible UI or network health.

## Queue and Dashboard Behavior

### Passed

- Teacher dashboard notification now matches actual actionable queue count.
- Teacher schedule approval counters cleared after approvals.
- Teacher scoring queue is reviewer-specific after a score is submitted.
- Student 01 sees result/feedback after Progress 1 required scores complete.

### Needs Patch

- Student next action can advance to Progress 2 before Admin opens the round.
- Student 02 late Proposal state is not clear after round closure.
- Teacher/admin schedule queues should be explicitly ordered by schedule request submission time for fairness when many requests arrive.

## Decision Questions for User

### Question 1: Should students be allowed to submit Proposal after the Proposal round is closed?

Current behavior:

- Submission is blocked, but the dashboard still suggests the student should submit.

Risks:

- Student sees an action they cannot complete.
- Admin may not notice a missing Proposal before closing the round.

Options:

- Option A: hard lock after round close, and show `พลาดรอบเสนอหัวข้อ / ต้องติดต่อผู้ดูแลระบบ`.
- Option B: allow late submission with Admin override and audit/timeline event.
- Option C: allow submission but mark as late and require Admin approval before continuing.

Recommendation:

- Use Option B or C for real course operations. A strict hard lock is clean but may be impractical for real students. Any late action should create audit evidence.

### Question 2: Should Admin be allowed to close a round when some projects have no submission?

Current behavior:

- Admin can close the Proposal round without a prominent missing-submission warning.

Risks:

- Some projects become unclear or stuck.
- Admin dashboard may look normal while individual students are blocked.

Options:

- Option A: block closure until every eligible project is either complete or explicitly marked exception.
- Option B: allow closure, but require acknowledgement of missing projects.
- Option C: allow closure silently.

Recommendation:

- Option B is practical for pilot/real operation. Option A may be too strict for a real class with late/incomplete students.

### Question 3: Should Progress 2 unlock automatically after Progress 1 scores complete?

Current behavior:

- Student can see Progress 2 as current action before Admin opens the Progress 2 round.

Risks:

- Students may submit/schedule for the wrong round before the course is ready.
- Admin loses control of course-level timing.

Options:

- Option A: require both project-level Progress 1 completion and course-level Progress 2 round open.
- Option B: allow evidence preparation early but block schedule request until round opens.
- Option C: allow all Progress 2 actions immediately after Progress 1 scores complete.

Recommendation:

- Option A for now. Option B can be considered later if the course wants students to pre-upload drafts early.

### Question 4: Should schedule approval queues be ordered by submission time?

Current behavior:

- Fairness ordering has not been verified. User requested oldest submitted schedule request first.

Risks:

- In a 40-student pilot, later submissions may appear above earlier submissions depending on current sorting.

Recommendation:

- Sort pending schedule approval queues by schedule request submission timestamp ascending. Keep proposed exam date/time visible as a secondary comparison.

## Validation

- `npm test`: PASS, 73 files / 285 tests
- `npm run build`: PASS

## Late/Missed Round Policy Patch

Policy decisions captured:

- Students who miss a round are hard-locked after the round closes.
- The student-facing state tells the student to contact the responsible instructor/admin.
- Admin can open access for one project as a case-by-case exception with audit/timeline evidence.
- Closing Proposal while students are missing submissions requires visible acknowledgement of the missing student list.
- The same late/missed policy applies conceptually to Proposal, Progress 1, Progress 2, and Final.
- Non-excused late/missed rounds receive a 10% deduction from the evaluator-submitted score for that round.
- Excused/force-majeure cases keep the late evidence tag but do not receive the 10% deduction.
- If Final closes while a project is still incomplete, the student dashboard warns that the student may receive grade I.

Patch status:

- Implemented shared late-round exception and penalty helpers.
- Implemented audited Admin per-project late-round opening action.
- Proposal and Progress/Final evidence/schedule actions respect late-round exceptions after round closure.
- Proposal, Progress 1, Progress 2, and Final scoring apply the 10% late penalty when required and keep raw score metadata.
- Teacher Proposal dashboard/list/scoring pages include late-opened Proposal work after the normal Proposal round is closed.
- Student dashboard shows active late-round tags and Final-closed incomplete grade-I warning.

Remaining gap:

- Admin UI currently exposes the late-opening form clearly for missed Proposal cases. A broader Admin view for missed Progress 1, Progress 2, and Final recovery should be added before Wave 2 if late recovery for those rounds must be operated from UI.

Validation status after late/missed round patch:

- `npm run typecheck`: PASS
- `npm test`: PASS, 75 files / 296 tests
- `npm run build`: PASS
- `npm run typecheck`: PASS on rerun after `next build` generated `.next/types`
- Note: the first `typecheck` attempt was run in parallel with `build` and failed because `.next/types` files did not exist yet. This was a validation-order race, not an app type error.
- Secret scan in `e2e-artifacts`: PASS, QA secret not found in artifacts.

## Recommendation

Patch stabilization before continuing:

1. Fix future-round visibility so Progress 2/Final actions require the corresponding course round to be open.
2. Fix late Proposal after round closure wording/recovery policy.
3. Translate raw `PROGRESS_1` display labels.
4. De-duplicate teacher role badges.
5. Add/verify schedule approval queue ordering by submitted time.

After those fixes, continue Wave 1 with Projects 04 and 05 Progress 1 scoring, then proceed to Progress 2 only after Admin opens the round.

## Stabilization Patch Applied After This Report

Patch status: implemented locally for the Wave 1 stabilization issues before continuing to Progress 2.

Fixed in the patch:

- Future round visibility: student actions now check the active/open course `AssessmentRound` before showing Progress 1, Progress 2, or Final as actionable.
- Late Proposal: if the Proposal round is closed and no Proposal was submitted, the student dashboard shows a blocked late state instead of a normal submit action.
- Raw status labels: the patched schedule/status surfaces map raw round/status constants to formal Thai display labels.
- Duplicate teacher roles: teacher role chips are de-duplicated and rendered with Thai-facing labels.
- Schedule approval fairness: pending schedule approval queues are sorted by request submission time first, so earlier submitted requests appear first.

Validation status after patch:

- `npm run typecheck`: PASS
- `npm test`: PASS, 73 files / 288 tests
- `npm run build`: PASS

Recommended QA check after preview update:

- Student 01 should not see Progress 2 as actionable until Admin opens the Progress 2 round.
- Student 02 should see a clear late/blocked Proposal state after Proposal round closure.
- Teacher/admin schedule approval queues should list older submitted requests first.

Manual/user-guide notes:

- See `e2e-artifacts/multi-pilot-r2-wave1/MANUAL_NOTES.md` for role-based notes that should be included in the Admin, Teacher, and Student manuals.
- Raw `PROGRESS_1 · CONFIRMED` style labels should no longer appear on the patched schedule/status surfaces.

## Student 02 Late Proposal Verification After Patch

Patch commit:

- `fce9bdc` - `fix: show submitted late proposal state`

QA preview:

- `https://system-project-math-sci-2ybxa0lct-lordtd-hubs-projects.vercel.app`

Result:

- Student 02 late Proposal page now renders a read-only submitted summary after submission.
- The late submitted notice is visible.
- The active Proposal form is hidden after submission.
- Teacher 03 sees Student 02 / Project 02 in the Proposal reviewer queue.
- Teacher 03 submitted one Proposal score and the scoring page became read-only with no active score-submit button.

Script compatibility:

- Updated the Proposal submit script to guard on `data-testid` submitted summary instead of relying only on Thai button text.
- Updated the Wave 1 continuation script to follow the real QA login switch flow and to fail if login does not redirect to the selected role dashboard.

Remaining script risk:

- Long-running pilot scripts should be treated as guarded helpers only. For important workflow decisions, use manual review plus short guarded checks, not unattended end-to-end automation.

## Wave 1 Continuation After Student 02 Late Proposal

QA preview used:

- `https://system-project-math-sci-rddm0ys1l-lordtd-hubs-projects.vercel.app`

### Project 02 Proposal multi-reviewer result

- Teacher 03 had already submitted one Proposal assessment for Project 02 and saw the scoring page in read-only state.
- Teacher 02 logged in through `/qa-login` as `MULTI-PILOT-R2 Teacher 02`.
- Teacher 02 dashboard showed one actionable Proposal item for `MULTI-PILOT-R2 Project 02 Late Proposal Recovery`.
- Teacher 02 scoring page showed the late-opened Proposal warning and stated that the system would deduct 10% for this round.
- Teacher 02 submitted the second Proposal assessment for Project 02.
- After submission, the page redirected to `?success=proposal_score_saved`.
- Teacher 02 saw the read-only submitted score summary and no active submit button remained.

Screenshot:

- `screenshots/project02-teacher02-proposal-score-saved-readonly.png`

Observation:

- The late Proposal reviewer flow is working for reviewer-specific visibility and read-only behavior.
- The scoring page still displays raw English status values such as `PASS` and `SUBMITTED` inside the read-only summary. This is not a workflow blocker, but should be mapped to Thai before documentation screenshots.

### Browser automation/session issue

During the continuation, using Playwright CLI `open` to jump directly to a protected preview deep link caused the Edge session to lose the QA role context and land on the Vercel preview-protection/login page. This made the browser flow unstable and looked like the automated script was opening/closing or losing the working window.

Correct operating rule for continued pilot:

- Keep one visible Edge session.
- Start role switches from the app header link `กลับหน้า QA Login`.
- If a QA session exists, use the QA logout button on `/qa-login`.
- Select the next role and log in through the QA form.
- Avoid `open` to a new preview URL or protected deep link during authenticated QA flow.
- Prefer in-app links after login; if direct navigation is needed, use the same already-accessible preview origin and verify the session did not fall back to Vercel login.

Impact:

- Project 02 second reviewer submission completed before this browser-session issue.
- Admin Proposal decision and remaining Progress 1 continuation should resume after restoring the visible Edge session through the normal `/qa-login` flow.

## Browser/session safety rule

This rule is now mandatory for all remaining Wave 1 pilot actions and scripts.

- Do not close Edge during the pilot.
- Do not reset browser storage, delete cookies, or start a competing browser session.
- Do not switch preview URL mid-flow.
- Do not use `open` to jump directly into protected deep links while authenticated.
- Start role switches from the app header link `กลับหน้า QA Login`.
- If already logged in as the correct QA identity, continue without logging in again.
- If a role switch is required, use `/qa-login`, then the QA logout/login controls.
- Before each action, verify the expected role, project, route, current state, and action availability.
- After each action, verify success/read-only/queue change and no application error.
- If any guard fails, stop immediately, capture a screenshot, and record the mismatch. Do not guess-click.

Script updates applied:

- Added `pilot-session-guard.playwright.js` shared guard helper for Node Playwright scripts.
- Updated `qa-login-from-storage.playwright.js` to reuse the current QA preview origin and stop on Vercel/login pages.
- Updated `login-qa.playwright.js` to avoid fixed preview jumps and to skip login if the expected identity is already active.
- Updated `submit-one-proposal-score-guarded.playwright.js` with role/project/route/state guards and read-only verification.
- Updated `submit-progress1-score-by-project-id.playwright.js` with teacher/project/form guards.
- Updated `inspect-progress1-forms.playwright.js` to fail if the session is not a MULTI-PILOT-R2 teacher on the QA preview.
- Updated `admin-submit-one-proposal-decision.playwright.js` to require Admin identity and target project visibility before submitting.
- Updated `approve-visible-schedules.playwright.js` to approve only guarded visible schedule actions and to default to one action at a time.
- Updated long-running Node runners so they do not close Edge by default. They only close if `PW_CLOSE_BROWSER=1` is intentionally set outside live pilot work.

## Wave 1 Continuation - Progress 1 and Boundary Check

QA preview used:

- `https://system-project-math-sci-rddm0ys1l-lordtd-hubs-projects.vercel.app`

Browser/session rule status:

- Used the existing `live-late-proposal-verify` Microsoft Edge session.
- Did not close Edge.
- Did not open a competing Edge session.
- Role switching was done through the app header `กลับหน้า QA Login`, then QA logout/login controls.
- Stopped browser actions after a role-boundary guard failure was found.

### Project 04 / Project 05 Progress 1 scoring

Completed:

- Teacher 02 submitted Progress 1 scores for Project 05 and Project 04.
- Teacher 02 Progress 1 queue cleared after both submissions.
- Teacher 03 dashboard was checked after Teacher 02 scores; no actionable Progress 1 scoring tasks were visible for Teacher 03, consistent with Teacher 03 being advisor rather than scoring committee for these two Progress 1 items.
- Teacher 01 submitted Progress 1 scores for Project 05 and Project 04.
- Teacher 01 Progress 1 queue cleared after both submissions.
- Student 04 saw Progress 1 complete with `2/2` reviewers and Progress 2 locked until Admin opens the Progress 2 round.
- Student 05 saw Progress 1 complete with `2/2` reviewers, schedule rejection/resubmission history in evidence, and Progress 2 locked until Admin opens the Progress 2 round.

Screenshots:

- `screenshots/project05-teacher02-progress1-score-saved-project04-remaining.png`
- `screenshots/teacher02-progress1-queue-cleared-after-project04-project05.png`
- `screenshots/teacher03-no-progress1-actions-after-teacher02-scores.png`
- `screenshots/project05-teacher01-progress1-score-saved-project04-remaining.png`
- `screenshots/teacher01-progress1-queue-cleared-after-project04-project05.png`
- `screenshots/student04-progress1-complete-progress2-locked.png`
- `screenshots/student05-progress1-complete-progress2-locked-after-reschedule.png`

### Future-round lock result

Result: PASS for Projects 04 and 05.

- After Progress 1 completion, Student 04 and Student 05 did not see Progress 2 as an actionable item.
- Both dashboards showed a waiting state for Admin to open Progress 2.
- This confirms the future-round visibility patch works for these two completed Progress 1 paths.

### Teacher role-overlap result

Partial result:

- Teacher 01 and Teacher 02 had multiple Progress 1 scoring tasks and their queues cleared after reviewer-specific score submission.
- Teacher 03 had advisor-related Project 04/05 context but did not receive Progress 1 scoring actions for those projects, which is consistent with assigned scoring roles.
- Teacher dashboard notification matched actionable queue count in the checked states.

### Clarified: Teacher Delta seeing Proposal scoring is expected before Admin decision

- Severity: Reclassified, not a bug by itself
- Role: `QA Teacher Delta` / `qa.teacher.delta@sru.test`
- Route: `/teacher`
- Project: `MULTI-PILOT-R2 Project 02 Late Proposal Recovery`
- Clarified policy: Proposal assessment can be performed by any teacher during the valid Proposal scoring window.
- Expected before Admin decision: Teacher Delta may see Proposal scoring work.
- Expected after Admin decision: no other teacher should continue seeing Project 02 as pending/unscored work.
- Actual observed after Admin decision: Teacher Delta dashboard showed one actionable Proposal assessment item for Project 02 and an active link to `/teacher/scoring/cmp2kuzqb000gju0424o8v2wv`.
- Action taken: stopped immediately after guard failure; did not click the scoring action.
- Screenshot: `screenshots/teacher-delta-unexpected-project02-proposal-action.png`
- Patch direction: keep all-teacher Proposal scoring while the round/late exception is active, but hide/block Proposal scoring after Admin records the Proposal decision.

### Major: Project 02 Proposal task remains visible after Admin decision

- Severity: Major
- Role: `MULTI-PILOT-R2 Teacher 01`
- Route: `/teacher`
- Project: `MULTI-PILOT-R2 Project 02 Late Proposal Recovery`
- Expected: After Admin records the Proposal decision, remaining Proposal scoring actions should be read-only/closed or Admin decision should be blocked until required reviewers are complete.
- Actual: Teacher 01 still saw Project 02 as an actionable Proposal scoring item after Admin Proposal decision was already saved for Project 02.
- Action taken: did not click the stale Proposal scoring action.
- Screenshot: `screenshots/teacher01-stale-project02-proposal-action-after-admin-decision.png`
- Suggested minimal fix: align Admin Proposal decision gating with required reviewer completion, or close/hide stale reviewer actions after Admin decision if the decision is intentionally allowed.

### Major/UX: Admin Proposal decision persisted but submit UI stayed pending until reload

- Severity: Major / UX
- Role: Admin
- Route: Admin Proposal decision page
- Project: `MULTI-PILOT-R2 Project 02 Late Proposal Recovery`
- Expected: After saving the Admin Proposal decision, the UI should redirect or render a saved/read-only/edit state.
- Actual: Backend persisted the decision, but the page stayed on a disabled `กำลังบันทึกผล...` state until reload.
- Screenshots:
  - `screenshots/project02-admin-decision-stuck-saving.png`
  - `screenshots/project02-admin-decision-saved-after-reload.png`
- Suggested minimal fix: verify the server action redirect/return path and pending state cleanup for the Admin Proposal decision form.

## Updated Recommendation After Boundary Check

Do not proceed to Wave 2 yet.

Recommended next step:

1. Patch the Project 02 Proposal decision/reviewer queue consistency issue.
2. Patch Admin Proposal decision pending-state cleanup.
3. Then resume Wave 1 with Admin incomplete/late visibility and Progress 2 opening checks.

## Patch Applied - Proposal Queue After Admin Decision

Clarified policy:

- Proposal scoring is open to all teachers during the valid Proposal scoring period.
- For an out-of-round late Proposal exception, teachers may score only until Admin records the Proposal decision.
- Once Admin records the Proposal decision, the remaining teachers should not see the item as an unscored pending Proposal task.

Code patch:

- Teacher dashboard Proposal query excludes attempts with an existing `proposalResult`.
- `/teacher/proposals` excludes attempts with an existing `proposalResult`.
- `openProposalScoring` rejects attempts that already have an Admin Proposal decision.
- `submitProposalScore` rejects submissions if Admin Proposal decision already exists.
- Direct `/teacher/scoring/[assignmentId]` displays a read-only message when Admin Proposal decision already exists.

Tests added:

- `src/app/proposalDecisionQueueSource.test.ts`

Validation after this continuation:

- `npm run typecheck`: PASS
- `npm test`: PASS, 76 files / 297 tests
- `npm run build`: PASS
- Secret scan in `e2e-artifacts`: PASS, QA secret not found in artifacts

## Guarded Verification After Proposal Queue Policy Patch

QA preview verified:

- `https://system-project-math-sci-3tbavgvkp-lordtd-hubs-projects.vercel.app`
- Commit: `8593c8b`
- Browser/session: visible persistent Microsoft Edge session `edgepilot`
- Browser safety: Edge was not closed, storage was not reset, and role switching used `/qa-login`.

### Teacher 01 result

Result: PASS.

- Role: `MULTI-PILOT-R2 Teacher 01`
- Routes checked:
  - `/teacher`
  - `/teacher/proposals`
- Expected: Project 02 should no longer appear as an actionable Proposal scoring item after Admin recorded the Proposal decision.
- Actual:
  - Teacher dashboard showed Proposal queue count `0`.
  - `/teacher/proposals` showed an empty state.
  - No active `ประเมินการเสนอหัวข้อ` action for Project 02 was visible.
  - Queue count matched visible actionable items.

### QA Teacher Delta result

Result: PASS.

- Role: `QA Teacher Delta`
- Routes checked:
  - `/teacher`
  - `/teacher/proposals`
  - direct route `/teacher/scoring/cmp2kuzqb000gju0424o8v2wv`
- Expected:
  - Teacher Delta should not see Project 02 as an actionable pending Proposal scoring item after Admin decision.
  - Direct route should be blocked, redirected, or read-only with no editable scoring form.
- Actual:
  - Dashboard showed Proposal queue count `0`.
  - `/teacher/proposals` showed an empty state.
  - Direct scoring route displayed a read-only state:
    - `ผู้ดูแลระบบบันทึกผลการเสนอหัวข้อแล้ว`
    - `รายการนี้ปิดการประเมินหลังผู้ดูแลระบบบันทึกผลตัดสินแล้ว อาจารย์ที่ยังไม่ได้ประเมินไม่จำเป็นต้องส่งคะแนนเพิ่ม`
  - No active score submit button was visible.

Screenshot:

- `screenshots/teacher-delta-project02-direct-scoring-readonly-after-admin-decision-8593c8b.png`

### Queue consistency result

Result: PASS.

- Completed Proposal work after Admin decision is no longer counted as pending work.
- Teacher dashboard summary and `/teacher/proposals` matched the visible actionable queue.
- The stale Project 02 Proposal queue issue is resolved for the verified roles.

### Recommendation after verification

Continue Wave 1. The Proposal queue-after-decision semantics are now stable enough to resume with:

1. Admin incomplete/late visibility review.
2. Project 02 late/reopen tag review in Admin timeline/evidence.
3. Admin opens Progress 2 and verifies that eligible students see Progress 2 only after round open.
4. Continue Progress 2 checks for Projects 01, 04, and 05.

## Wave 1 Continuation - Admin Visibility Review Before Progress 2

QA preview observed:

- `https://system-project-math-sci-3tbavgvkp-lordtd-hubs-projects.vercel.app`
- Commit: `8593c8b`
- Browser/session: visible persistent Microsoft Edge session `edgepilot`

### Admin incomplete/late visibility

Result: PARTIAL PASS with operational noise.

- Admin `/admin/rounds` loaded correctly as `MULTI-PILOT-R2 Admin`.
- The page clearly showed the course-level round state:
  - Proposal: closed.
  - Progress 1: open.
  - Progress 2: not opened.
  - Final: not opened.
- The Proposal late/reopen panel is visible and explains that late Proposal access is per-case and applies a 10% deduction unless marked excused.
- The Proposal late/reopen panel lists many unsubmitted students (`R2STU06` through `R2STU40`) with per-student open controls.
- Operational pain point: because Wave 1 is running inside a 40-student R2 dataset, the missed/late list is very long and Wave 1 items are easy to lose. Before Wave 2, Admin needs filtering/grouping for active wave, scenario, or actionable exception status.

Screenshot:

- `screenshots/admin-rounds-progress1-counter-before-progress2-8593c8b.png`

### Project 02 late/reopen evidence review

Result: PASS for evidence continuity; UX wording still has mixed English.

- Admin `/admin/evidence` showed Project 02 evidence continuity:
  - late round submission opened,
  - Proposal submitted,
  - Teacher 03 Proposal score submitted,
  - Teacher 02 Proposal score submitted,
  - Admin Proposal decision saved.
- Evidence overview listed Project 02 as `หัวข้อโครงงานได้รับอนุมัติ`.
- Latest evidence list clearly included the Project 02 late/reopen timeline.
- Remaining polish: some evidence timeline action details still show English machine labels such as `late round submission opened`, `proposal submitted`, `teacher score submitted`, and `admin final decision`.

### Progress 2 opening guard result

Result: STOPPED before opening Progress 2.

- Admin `/admin/rounds` showed Progress 2 open button disabled because Progress 1 is still open.
- Progress 1 close button was available, but the Progress 1 summary showed:
  - ready for round: `4`
  - submitted: `0`
  - completed: `0`
  - not ready/exceptions: `36`
- This conflicts with the pilot evidence and previous student/teacher checks showing Progress 1 scores completed for Projects 01, 04, and 05.
- Because the counter/state did not match expected pilot state, no round-close or Progress 2-open action was clicked.

Suggested next investigation:

- Confirm what `/admin/rounds` means by Progress 1 `submitted` and `completed`.
- If the counters are intended to count Progress 1 evidence/schedule rather than score evidence, the UI label should say so.
- If the counters are intended to reflect completed Progress 1 assessment, this is likely a status aggregation bug and should be patched before opening Progress 2.

### Session interruption

- After the above observations, the local power outage closed the Playwright Edge session.
- A guarded snapshot returned `Browser 'edgepilot' is not open`.
- No further browser action was attempted after session loss.
- This was recorded as an environmental/session interruption, not as script-initiated browser close.

## Stabilization Patch - Admin Round Exception List

Reason:

- The `/admin/rounds` Proposal late-opening panel became too long in a 40-student dataset.
- Showing one textarea and one action button per missed student made the page hard to scan and increased the risk of opening the wrong student case.

Patch:

- `/admin/rounds` now shows a compact summary for missed Proposal cases:
  - total missed Proposal count,
  - already-opened late count,
  - default 10% late penalty reminder,
  - link to the dedicated exception list.
- Added `/admin/round-exceptions`.
- The new page provides:
  - round filter,
  - status filter,
  - search by student/project/advisor,
  - compact table rows,
  - per-row expandable action form for opening late access.
- The existing audited `openLateRoundSubmissionForProject` action is reused.
- A hidden `return_to=/admin/round-exceptions` field lets the action return to the list after use.

Tests added:

- `src/app/admin/round-exceptions/roundExceptionsUx.test.ts`

Validation:

- `npm run typecheck`: PASS
- `npm test`: PASS, 77 files / 300 tests
- `npm run build`: PASS

Pilot note:

- This patch should be verified on QA preview before continuing Wave 1. After verification, resume with Admin incomplete/late visibility and Progress 2 gating checks.

## Live QA Verification Attempt - New Preview Access Guard

QA preview target:

- `https://system-project-math-sci-29rpu93od-lordtd-hubs-projects.vercel.app/qa-login`
- Commit: `638e16e` (`fix: move late round exceptions to admin list`)

Result: BLOCKED by Vercel Deployment Protection before app verification could continue.

What happened:

- The new preview was opened in the existing persistent Edge session `edgepilot`.
- The first `/qa-login` page loaded, and QA Admin login was submitted.
- A direct protected deep link to `/admin/rounds` redirected to Vercel login/protection instead of the app.
- Returning to `/qa-login` on the new preview also redirected to Vercel login/protection.
- Guard rule was followed: no random clicks, no storage reset, no browser close, and no workflow actions were attempted after the mismatch.

Screenshot:

- `screenshots/new-preview-vercel-protection-block-638e16e.png`

Next required action:

- Restore/open Vercel preview access for the new deployment URL in the same Edge session.
- Start from `/qa-login`, then use the normal QA role switch/login path.
- After access is restored, verify:
  1. `/admin/rounds` shows only the compact late/missed Proposal summary.
  2. `/admin/round-exceptions?round_type=PROPOSAL` shows the searchable/filterable exception table.
  3. No late-open form is submitted unless intentionally testing one case.

## Live QA Verification - Admin Round Exception UX

QA preview verified:

- `https://system-project-math-sci-29rpu93od-lordtd-hubs-projects.vercel.app`
- Commit: `638e16e` (`fix: move late round exceptions to admin list`)
- Browser: Microsoft Edge persistent CDP session on port `9333`

Browser/session note:

- The earlier `playwright-cli -s=edgepilot open about:blank` flow opened a window briefly and then the visible page disappeared.
- To avoid repeating that instability, this verification used a persistent Edge process launched with a dedicated user-data directory and remote debugging.
- The browser stayed open, CDP remained reachable, and the QA preview page was controlled without closing the window.
- Added `cdp-edge-guard.js` as a guarded utility for this session style.

### `/admin/rounds`

Result: PASS.

- The long per-student late Proposal form list is no longer shown on `/admin/rounds`.
- Guard counts:
  - `textarea[name="reason"]`: `0`
  - direct late-open buttons on the round summary page: `0`
- The page shows a compact late/missed Proposal summary with:
  - missed Proposal count,
  - already-opened late count,
  - default 10% deduction reminder,
  - link to the dedicated exception list.

Screenshot:

- `screenshots/admin-rounds-late-summary-638e16e-live.png`

### `/admin/round-exceptions?round_type=PROPOSAL`

Result: PASS.

- The dedicated exception page loaded correctly.
- Visible controls:
  - round filter,
  - status filter,
  - search field,
  - compact table,
  - expandable per-row action controls.
- Guard counts:
  - table rows: `36`
  - expandable action rows: `35`
- Student 02 appears as `ส่งแล้วหลังปิดรอบ`, shows 10% deduction, and has no additional action available.
- Other missing students appear as `ยังไม่ส่ง` with expandable `เปิดส่งรายกรณี` controls.
- No exception action was submitted during this verification.

Screenshot:

- `screenshots/admin-round-exceptions-list-638e16e-live.png`

### Continuation Guard

Wave 1 should not open Progress 2 yet on commit `638e16e`.

Reason:

- The live `/admin/rounds` page still shows suspicious Progress 1 counters:
  - ready: `4`
  - submitted: `0`
  - completed: `0`
  - not ready/exceptions: `36`
- This still conflicts with prior pilot evidence that Projects 01, 04, and 05 had Progress 1 activity/scoring.
- Before clicking close/open round controls, investigate whether these counters are intentionally counting a narrower status or are a status aggregation bug.

## Stabilization Patch - Admin Progress Counter Source

Finding:

- The suspicious Progress 1 counters were a display aggregation bug on `/admin/rounds`.
- The page was counting `presentationSubmission`, which is the Proposal submission model.
- Progress 1, Progress 2, and Final evidence use `assessmentSubmission` instead.
- The completed count also treated non-Proposal attempts as complete only when the attempt status was closed, so completed-but-not-closed scoring could show as `0`.

Patch:

- `/admin/rounds` now maps:
  - `PROGRESS_1` -> `AssessmentSubmission.kind = PROGRESS_1`
  - `PROGRESS_2` -> `AssessmentSubmission.kind = PROGRESS_2`
  - `FINAL_PRESENTATION` -> `AssessmentSubmission.kind = FINAL_PRESENT`
- Non-Proposal completed counts now use `isPresentationAssessmentComplete`, checking required committee score submissions.
- Proposal counting remains based on Proposal presentation submissions/final decision.

Files:

- `src/app/admin/rounds/page.tsx`
- `src/app/admin/rounds/roundsUx.test.ts`

Validation:

- `npm run typecheck`: PASS
- `npm test`: PASS, 77 files / 301 tests
- `npm run build`: PASS

Next QA step:

- Push this patch to QA preview.
- Open the new preview URL.
- Verify `/admin/rounds` shows Progress 1 counts matching Projects 01/04/05 evidence/scoring before closing Progress 1 or opening Progress 2.

## Live QA Verification - Admin Progress Counter Source

QA preview verified:

- `https://system-project-math-sci-kwtp9kb6q-lordtd-hubs-projects.vercel.app`
- Commit: `53203a1` (`fix: correct admin round progress counters`)

Result: PASS.

- `/admin/rounds` now shows Progress 1:
  - ready: `4`
  - submitted: `3`
  - completed: `3`
  - not ready/exceptions: `36`
- This matches the known Wave 1 state better than the previous `0/0` counter display:
  - Projects 01/04/05 have Progress 1 activity/scoring.
  - One eligible project remains not submitted for Progress 1.
  - The remaining starter projects are still not ready/incomplete.

Screenshot:

- `screenshots/admin-rounds-progress1-counters-fixed-53203a1-live.png`

### New Guard Finding - Non-Proposal Round Closure Warning

Severity: Major / policy gap.

Route:

- `/admin/rounds`

Expected:

- The policy now says missed/incomplete handling should apply to every assessment round.
- Before closing Progress 1, Progress 2, or Final with incomplete/not-ready projects, Admin should see affected student/project names and acknowledge the impact.
- Final closure should also warn about possible grade I for incomplete projects.

Actual:

- Proposal has an explicit missing-student acknowledgement flow.
- Progress 1 shows `ยังไม่พร้อม/ข้อยกเว้น 36`, but the close action does not show an affected-student list or acknowledgement comparable to Proposal.
- The close button is visible while many projects remain incomplete/not ready.

Action taken:

- Stopped before closing Progress 1.
- Did not open Progress 2.

Suggested minimal fix:

- Extend the Admin round closure warning/acknowledgement pattern beyond Proposal:
  - list affected projects for the current round,
  - require acknowledgement before close,
  - show late/lock/grade-I impact wording according to round type,
  - keep actual close semantics unchanged unless a policy change is explicitly requested.

## Stabilization Patch - Round Eligibility Buckets and Close Acknowledgement

Patch status: implemented locally and validated before QA push.

Policy implemented:

- Admin round overview now derives round buckets for every course-level round:
  - eligible for this round,
  - submitted/current-round evidence,
  - completed/current-round assessment,
  - eligible but incomplete,
  - not yet eligible for this round,
  - late/open exceptions.
- Progress 1 eligibility remains Proposal PASS plus active ADVISOR/HEAD/MEMBER assignments.
- Progress 2 eligibility requires Progress 1 required HEAD/MEMBER scoring completion.
- Final eligibility requires Progress 2 required HEAD/MEMBER scoring completion.
- Not-yet-eligible projects are displayed separately and are not treated as current-round incomplete blockers.
- Progress 1 / Progress 2 / Final close now requires Admin acknowledgement only when eligible-but-incomplete projects exist.
- Final close warning explicitly mentions grade I risk.
- Existing Proposal missing-submission acknowledgement behavior is preserved.
- Close audit metadata now records eligible incomplete project ids/counts for non-Proposal rounds.

Files:

- `src/lib/assessments/roundEligibility.ts`
- `src/lib/assessments/roundEligibility.test.ts`
- `src/app/admin/rounds/page.tsx`
- `src/app/admin/rounds/roundsUx.test.ts`
- `src/app/admin/actions.ts`
- `src/app/lateRoundPolicySource.test.ts`

Validation:

- `npm run typecheck`: PASS
- `npm test`: PASS, 77 files / 308 tests
- `npm run build`: PASS
- Final `npm run typecheck`: PASS

Remaining UX debt recorded:

- Duplicate close/open controls and reset controls still need a cleaner hierarchy.
- The close acknowledgement checkbox is functional but still visually awkward inside the action area.
- Warning copy/button hierarchy should be redesigned later; this patch intentionally keeps UI minimal.

Next QA step:

- Commit/push this scoped patch to QA preview.
- Open the new preview URL, not the old `kwtp9kb6q` URL.
- Verify `/admin/rounds` as MULTI-PILOT-R2 Admin before closing Progress 1.

## Live QA Verification - Round Eligibility Buckets

QA preview verified:

- `https://system-project-math-sci-cejnzvxde-lordtd-hubs-projects.vercel.app`
- Commit: `f19c78d` (`Fix round eligibility close buckets`)
- Browser: persistent Microsoft Edge CDP session on port `9333`
- Role: `MULTI-PILOT-R2 Admin`

Result: PASS for the required Progress 1 guard.

- `/admin/rounds` loaded under the correct MULTI-PILOT-R2 Admin identity.
- Progress 1 displayed:
  - ready/eligible for this round: `4`
  - submitted/current-round evidence: `3`
  - completed/current-round assessment: `3`
  - eligible but incomplete: `1`
  - not yet eligible for this round: `36`
  - late/open exceptions: `0`
- The eligible-but-incomplete warning listed only:
  - `R2STU03 MULTI-PILOT-R2 Student 03 - MULTI-PILOT-R2 Project 03 ระบบทดสอบหลักฐานไม่ครบ`
- The 36 not-yet-eligible projects were separated into the not-yet-eligible bucket and were not treated as current-round blockers.
- The Progress 1 close acknowledgement checkbox is present for the one eligible-but-incomplete project.
- Progress 1 was not closed and Progress 2 was not opened during this verification.

Screenshot:

- `screenshots/admin-rounds-eligibility-buckets-f19c78d-live.png`

Wave 1 continuation recommendation:

- Wave 1 can continue to the Admin decision point for closing Progress 1.
- Admin should close Progress 1 only after confirming that Project 03 is intentionally incomplete or handled by policy.
- After closing Progress 1 with the acknowledgement, Progress 2 can be opened for eligible projects.

## Stabilization Patch - Progress 2 Evidence Success and Schedule Timezone

Status: in progress.

Major bug fixed and live-verified:

- Old QA preview `https://system-project-math-sci-f96db92qp-lordtd-hubs-projects.vercel.app` rendered `/student/schedule?success=assessment_evidence_saved` as shell-only after Student01 saved Progress 2 evidence.
- Patch commit `5f64eee` adds stable student schedule content markers and regression guards.
- New QA preview `https://system-project-math-sci-4lkxybd8n-lordtd-hubs-projects.vercel.app` verified Student01 Progress 2 evidence state is visible and the page is not shell-only.
- Screenshot: `screenshots/2026-05-13T04-14-39-282Z-progress2-student01-post-submit-guard-5f64eee.png`

Pilot continuation before next stop:

- Project01 Progress 2 schedule was proposed and approved by Teacher01, Teacher02, and Teacher03. Scoring has not been submitted yet.
- Student04 Progress 2 evidence exists and the Progress 2 schedule proposal is pending.
- Student05 Progress 2 evidence exists and the Progress 2 schedule proposal is pending.
- Per latest operator instruction, student work is being completed before returning to teacher queues so accumulated teacher workload can be evaluated.

New Major bug found:

- While submitting Student04/Student05 Progress 2 schedules, the form value `09:00-10:00` displayed as `16:00-17:00` on the student schedule summary.
- Root cause: schedule form input was parsed with `new Date("YYYY-MM-DDTHH:mm")`, which Vercel interprets as UTC, then the UI formats that instant in `Asia/Bangkok`, adding seven hours.
- Patch direction: parse schedule form input as Bangkok civil time (`+07:00`) before storing the UTC instant.
- Existing Project04/Project05 pending schedules created before this patch have wrong stored instants and should be recovered through the UI after the patch is deployed, most likely by rejecting/resubmitting the affected pending schedule requests.

Validation so far:

- `npm test -- src/lib/scheduling/scheduleRules.test.ts src/lib/format/dateTime.test.ts`: PASS.

## Live QA - Progress 2 Operational Completion

QA preview:

- `https://system-project-math-sci-da1lofaxb-lordtd-hubs-projects.vercel.app`
- Code commit used for live continuation: `395bbe0` (`Fix schedule input timezone handling`)
- Browser: persistent Microsoft Edge CDP session on port `9333`

Validation before live continuation:

- `npm run typecheck`: PASS
- `npm test`: PASS, 77 files / 315 tests
- `npm run build`: PASS
- Secret scan for `e2e-artifacts`: PASS, no QA secret found

Major bug stabilization:

- Fixed schedule form parsing so student-selected `09:00-10:00` is stored as Bangkok civil time and displays back as `09:00-10:00`.
- Removed the real QA secret literal from source-test assertions and replaced it with a placeholder guard.
- Live verification used Project05 reject/resubmit and Project04 reject/resubmit through UI only.
- Project04 latest Progress 2 schedule after recovery: `21 พ.ค. 2569 09:00 - 10:00 น. · ห้อง MS-302`.
- Project05 latest Progress 2 schedule after recovery: `22 พ.ค. 2569 09:00 - 10:00 น. · ห้อง MS-303`.

Progress 2 schedule approval:

- Teacher01/02/03 saw Project04 and Project05 as accumulated actionable schedule work after the student-side submissions were completed first.
- Teacher04 and Teacher Delta had no actionable schedule forms for Project04/05.
- Project04 and Project05 schedules were approved by Teacher01, Teacher02, and Teacher03 after timezone recovery.
- Project01 schedule had already been approved earlier by Teacher01/02/03.

Progress 2 scoring:

- Teacher01 saw and scored only Project04 and Project05.
- Teacher02 saw and scored Project01, Project04, and Project05.
- Teacher03 saw and scored only Project01.
- Teacher04 and Teacher Delta saw no Progress 2 scoring forms.
- After each teacher submitted, that teacher's Progress 2 queue cleared and no stale editable score form remained.
- Student01/04/05 saw Progress 2 feedback/score after scoring. Student03 remained locked out of Progress 2.

Admin Progress 2 close guard:

- Before close, `/admin/rounds` showed Progress 2:
  - ready/eligible: `3`
  - submitted: `3`
  - completed: `3`
  - eligible-but-incomplete: `0`
  - not-yet-eligible: `37`
  - exceptions: `0`
- Progress 2 was closed successfully.
- After close, Final remained `ยังไม่เปิด`; no automatic Final unlock occurred.
- `/admin/rounds` now shows Final ready count `3`, submitted `0`, completed `0`, eligible-but-incomplete `3`, not-yet-eligible `37`, which is expected because Final has not been opened or run yet.

Screenshots from this continuation:

- `screenshots/2026-05-13T04-40-46-324Z-progress2-project05-student-resubmitted-timezone-fixed-395bbe0.png`
- `screenshots/2026-05-13T04-41-40-119Z-progress2-project04-student-resubmitted-timezone-fixed-395bbe0.png`
- `screenshots/2026-05-13T04-43-48-605Z-progress2-teacher01-schedules-accumulated-queue-395bbe0.png`
- `screenshots/2026-05-13T04-43-55-189Z-progress2-teacher02-schedules-accumulated-queue-395bbe0.png`
- `screenshots/2026-05-13T04-44-01-622Z-progress2-teacher03-schedules-accumulated-queue-395bbe0.png`
- `screenshots/2026-05-13T04-51-22-776Z-progress2-teacher01-queue-after-all-scores-395bbe0.png`
- `screenshots/2026-05-13T04-51-42-842Z-progress2-teacher02-queue-after-all-scores-395bbe0.png`
- `screenshots/2026-05-13T04-51-51-995Z-progress2-teacher03-queue-after-all-scores-395bbe0.png`
- `screenshots/2026-05-13T04-58-03-002Z-progress2-admin-rounds-after-close-final-still-closed-395bbe0.png`

Bugs/observations:

- Major fixed: evidence-save shell-only page after Progress 2 evidence save.
- Major fixed: schedule time parsing treated local form time as UTC and displayed +7 hours in Bangkok.
- Minor/UX: teacher schedule queue becomes visually dense when confirmed history and pending actionable cards share one page.
- Minor/UX: Admin round close/open controls remain duplicated/dense. During automation, direct Playwright `click()` on the Progress 2 close button did not change state, while submitting the same form with `requestSubmit()` worked and closed the round. Treat as a UI/action hierarchy debt to verify in a later manual pass, not a lifecycle blocker because the server action and form submission path are valid.

Stop condition reached:

- Progress 2 Wave 1 operational flow completed successfully.
- Do not open Final in this pass.
- Final round testing can safely begin later from this saved state.

## Live QA - Final Round Continuation Started

QA preview:

- `https://system-project-math-sci-5634jxgdt-lordtd-hubs-projects.vercel.app`
- Starting commit: `76342f0`
- Browser: persistent Microsoft Edge CDP session on port `9333`

Context read before action:

- `e2e-artifacts/multi-pilot-r2-wave1/REPORT.md`
- `e2e-artifacts/multi-pilot-r2-wave1/PENDING_FROM_PROMPT.md`
- `e2e-artifacts/multi-pilot-r2-wave1/MANUAL_NOTES.md`
- `e2e-artifacts/PILOT_FIX_STATUS.md`
- `src/lib/assessments/roundEligibility.ts`
- `src/lib/assessments/presentationCompletion.ts`
- `src/lib/assessments/roundSequence.ts`
- `src/lib/assessments/roundClosure.ts`
- `src/lib/scheduling/scheduleRules.ts`
- `src/app/admin/rounds/page.tsx`
- `src/app/admin/actions.ts`
- `src/app/student/schedule/page.tsx`
- `src/app/student/actions.ts`
- `src/app/student/feedback/page.tsx`
- `src/app/student/report/page.tsx`
- `src/app/teacher/final/page.tsx`
- `src/app/teacher/actions.ts`
- `src/app/teacher/schedules/page.tsx`
- listed assessment, scheduling, date, final scoring, and final rubric tests

Final round open result:

- Admin opened Final successfully.
- Progress 2 was already closed.
- Final card after open:
  - ready/eligible: `3`
  - submitted: `0`
  - completed: `0`
  - eligible-but-incomplete: `3`
  - not-yet-eligible: `37`
  - exceptions: `0`
- Final close guard showed Project01/04/05 as eligible-but-incomplete and included grade-I warning text.
- Project03 remained outside Final eligibility as expected.

Major stop during Final student flow:

- Severity: Major.
- Project: Project01 / Student01.
- Role: Student.
- Route: `/student/schedule?success=assessment_evidence_saved`.
- Expected: after saving Final evidence, the normal schedule/evidence page remains visible and the Final schedule proposal form appears.
- Actual: the page initially rendered only the app shell after the valid evidence save. Refreshing the URL later restored the content, which points to a post-submit route/cache transition issue rather than missing data.
- Screenshot: `screenshots/final-student01-evidence-shell-only-major-5634.png`.

Patch prepared:

- `src/app/student/schedule/page.tsx`: marks the schedule page as `force-dynamic` with `revalidate = 0`.
- `src/app/student/actions.ts`: redirects assessment evidence and schedule saves with explicit saved entity ids and round/kind query params to avoid stale shell-only route reuse after server actions and QA role switching.
- `src/app/postSubmitStabilizationSource.test.ts`: updated source checks for the dynamic schedule page and cache-busting post-submit redirects.

Validation for patch:

- `npm run typecheck`: PASS.
- `npm test`: PASS, 77 files / 315 tests.
- `npm run build`: PASS.

Current stop:

- Patch is validated locally but not yet pushed/live-verified in this section.
- Resume from saved state after push/live verification; do not restart Wave 1.

## Live QA - Final Post-Submit Guard Stabilization

QA preview used before the repeated Major:

- `https://system-project-math-sci-r11zr46ki-lordtd-hubs-projects.vercel.app`
- Commit: `71feff0`

Live verification after first patch:

- Student01 / Project01 opened `/student/schedule` on the new QA preview.
- Existing Final evidence state rendered with full schedule page content.
- Student01 submitted the Final schedule proposal successfully.
- Post-schedule URL rendered full content and was not shell-only:
  - `/student/schedule?success=schedule_saved&round_type=FINAL_PRESENTATION&schedule_id=cmp3mi6h20001l204mzteazd7`

Resumed student-first Final flow:

- Student04 / Project04 submitted Final evidence and Final schedule.
- Student05 / Project05 submitted Final evidence successfully.
- Student03 remained locked from Final; no Final evidence form or schedule form was visible.

Repeated Major found:

- Severity: Major.
- Project: Project05 / Student05.
- Role: Student.
- Route: `/student/schedule?success=assessment_evidence_saved&assessment_kind=FINAL_PRESENT&submission_id=cmp3mo9fz0002ic04py653s12`.
- Expected: full schedule/evidence content remains visible after a valid Final evidence save and the schedule proposal form appears.
- Actual: the page initially rendered only the student app shell/header/footer. Manual reload restored the full page and schedule form, confirming data was saved and the issue was a soft post-submit route transition failure.
- Screenshot: `screenshots/final-student05-after-final-evidence-shell-only-major-r11.png`.

Second patch:

- `src/components/ui/StudentSchedulePostSubmitGuard.tsx`: adds a client-side one-time recovery guard for `/student/schedule` post-submit success URLs when the schedule content marker is missing.
- `src/app/student/layout.tsx`: mounts the guard inside the student layout so it can recover even when the schedule page segment fails to render after a soft redirect.
- `src/app/postSubmitStabilizationSource.test.ts`: verifies the guard is present and scoped to schedule success redirects.

Validation for second patch:

- `npm run typecheck`: PASS.
- `npm test`: PASS, 77 files / 315 tests.
- `npm run build`: PASS.
- Secret scan for the QA secret in `src` and `e2e-artifacts`: PASS, no matches.

Current stop:

- Second patch is validated locally.
- Commit/push/live verification are still required.
- Resume from saved state after the new QA preview is ready:
  - Student05 has Final evidence saved and should be able to propose Final schedule.
  - Then move to accumulated teacher Final schedule queues.
