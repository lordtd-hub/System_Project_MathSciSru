# MULTI-PILOT-R2 Wave 1 Report

## Summary

- QA preview: `https://system-project-math-sci-adoptrunj-lordtd-hubs-projects.vercel.app/qa-login`
- Tested commit: `7f1321c` (`fix: clarify teacher wave queue status`)
- Browser: Microsoft Edge via one persistent Playwright session (`edgepilot`)
- Run date: 2026-05-12
- Mode: operational workflow testing, not documentation screenshots

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
