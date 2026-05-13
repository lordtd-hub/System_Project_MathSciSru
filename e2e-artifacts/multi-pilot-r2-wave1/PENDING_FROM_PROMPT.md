# MULTI-PILOT-R2 Wave 1 - Pending Work From Original Prompt

This file tracks unfinished Wave 1 work so the pilot can resume without re-reading the whole conversation.

## Current Tested Target

- QA preview: `https://system-project-math-sci-adoptrunj-lordtd-hubs-projects.vercel.app/qa-login`
- QA commit: `7f1321c` (`fix: clarify teacher wave queue status`)
- Browser requirement: Microsoft Edge
- Mode: operational workflow testing, not documentation/manual screenshots

## Operating Note: Visible Edge Window

Use one visible persistent Edge session for user-assisted QA:

```powershell
cmd /c npx.cmd --yes --package @playwright/cli playwright-cli -s=edgepilot open https://system-project-math-sci-adoptrunj-lordtd-hubs-projects.vercel.app/qa-login --browser msedge --headed --persistent --profile .playwright-cli\edgepilot-visible
```

Lessons learned:

- The user's normal Edge window and Playwright-controlled Edge profile are separate contexts.
- If Playwright opens a hidden/background Edge profile, the user may not see the window.
- Keep the same `edgepilot` session open.
- Return to `/qa-login` in the same session to switch roles.
- Avoid opening protected deep links directly after preview access; start at `/qa-login`, switch role, then use in-app links.
- For automation, run one guarded action at a time and stop if the expected stage/queue does not change.

## Completed Before This Continuation

- 5 MULTI-PILOT-R2 students were prepared.
- Advisor requests were approved.
- Admin confirmed Wave 1 projects.
- Proposal round was opened.
- Students 01, 03, 04, and 05 submitted Proposal documents.
- Student 02 was intentionally left without Proposal submission.
- Teacher 01 submitted one Proposal assessment.
- Teacher dashboard queue/read-only behavior was partially verified after stabilization patch `7f1321c`.

## Completed During This Continuation

- Admin closed the Proposal round while Student 02 had no Proposal submission.
- Student 02 post-closure behavior was checked:
  - dashboard still suggested Proposal submission,
  - Proposal form could open/edit draft,
  - Proposal submit was blocked,
  - no clear late/recovery path was visible.
- Admin opened Progress 1.
- Student 01 submitted Progress 1 evidence and schedule request.
- Student 04 submitted Progress 1 evidence and schedule request.
- Student 05 submitted Progress 1 evidence and schedule request.
- Teacher 02 rejected Student 05 schedule once.
- Student 05 saw a clear rejection state and resubmitted a new schedule.
- Teachers 01, 02, and 03 approved Progress 1 schedule requests for Projects 01, 04, and 05.
- Teacher 03 submitted Progress 1 score for Project 01.
- Teacher 02 submitted Progress 1 score for Project 01.
- Student 01 saw Progress 1 score and feedback after 2/2 required scores.
- `REPORT.md` was updated with the Proposal closure edge case, Progress 1 observations, decision questions, and screenshots.

## Current Stop Reason

Stop before continuing deeper because a Major workflow/status risk was found:

- After Project 01 received required Progress 1 scores, Student 01 dashboard and `/student/schedule` showed Progress 2 as actionable.
- Admin has not opened the Progress 2 course round yet.
- The schedule page itself gives mixed signals:
  - Progress 2 rubric tab says `ยังไม่เปิด`,
  - Progress 2 action card says `ดำเนินการได้ตอนนี้`,
  - active `เสนอวันสอบ` button is visible.

This should be patched before continuing to Progress 2 or Wave 2.

## Remaining From Original Prompt

### Progress 1

- Project 04: complete multi-reviewer Progress 1 scoring.
- Project 05: complete multi-reviewer Progress 1 scoring after schedule rejection/resubmit path.
- Verify student result/feedback visibility for Projects 04 and 05.

### Progress 2

Do not continue until the future-round visibility bug is patched or a policy decision allows early Progress 2 evidence.

After patch:

- Admin opens Progress 2.
- Verify Progress 2 appears only after round open.
- Continue normal Progress 2 for eligible projects.
- Ensure Student 02 delayed Proposal project does not unlock later stages accidentally.

### Chaos / Edge Checks

Still pending:

- Refresh after score submission.
- Revisit old Proposal routes after score submission/round closure.
- Verify unauthorized teacher visibility.
- Verify Teacher Delta has no scoring/schedule actions unless assigned.
- Verify schedule approval queue ordering by request submission time.

## Bugs / Risks To Carry Forward

### Major: Progress 2 visible before Admin opens Progress 2 round

- Evidence:
  - `screenshots/student01-after-progress1-complete-progress2-visible-before-admin-open.png`
  - `screenshots/student01-schedule-progress2-action-visible-before-round-open.png`
- Suggested patch:
  - Student NOW/action derivation and `/student/schedule` action availability should require both:
    - project-level previous round completion, and
    - course-level next `AssessmentRound` open.

### Major: Late Proposal after round closure is confusing

- Evidence:
  - `screenshots/student02-after-proposal-round-closed-dashboard-still-actionable.png`
  - `screenshots/student02-proposal-form-after-round-closed-submit-disabled.png`
- Suggested patch:
  - Show explicit late/missed-round wording.
  - Add Admin warning/acknowledgement when closing a round with missing submissions.
  - Decide whether Admin override/late submission is allowed.

### Major: Proposal score validation can become application error

- Trigger observed earlier during automation: decision accidentally became `FAIL` without a reason.
- Expected: user-friendly validation message.
- Actual: app error/digest page.
- Evidence: `screenshots/bug-proposal-score-fail-no-reason-digest.png`

### Minor/UX: Raw round/status labels remain visible

Examples:

- `PROGRESS_1 · CONFIRMED`
- `PROGRESS_1 · REJECTED`
- `เสนอวันสอบ PROGRESS_1`
- `บันทึกเอกสาร PROGRESS_1`

### Minor/UX: Teacher role badges can duplicate

- Teacher 03 confirmed schedule list showed duplicate `ADVISOR ADVISOR` for advisor projects.

### UX: Schedule/evidence form is far below rubric

- The rubric is useful, but the form is far down the page.
- Consider collapsed rubric or stronger jump controls before the documentation pilot.

### Follow-up Requirement: Schedule Approval Queue Ordering

User requirement:

- When many exam schedule requests arrive, the system should order pending schedule approval queues by schedule request submission time.
- Earliest submitted request should appear first so students who submit earlier have fairer access to teacher approval.

Suggested acceptance check:

- Create multiple schedule requests in the same round.
- Confirm `/teacher/schedules` and dashboard pending schedule queue sort by `submittedAt` or created time ascending.
- Keep proposed exam date/time visible for teacher comparison.

## Decision Questions Still Required

Carry these forward for policy discussion:

1. Should late Proposal after round closure be hard-locked, admin-overridden, or allowed with late marking?
2. Should closing a round require explicit Admin acknowledgement for missing submissions?
3. Should Admin have a recovery path for late/missed projects, with audit evidence?
4. Should Progress 2 require Admin-opened course round, or should students be allowed to prepare evidence early?
5. Should schedule approval queues be ordered by request submission time first?

## Recommended Next Step

Do not start Wave 2 yet.

Recommended order:

1. Patch future-round visibility gating.
2. Patch late Proposal / missed-round dashboard wording or decide policy.
3. Patch raw `PROGRESS_1` display labels.
4. Verify schedule approval queue ordering by submission time.
5. Continue Wave 1 with Project 04 and Project 05 Progress 1 scoring.

## 2026-05-13 Progress 1 Closure / Progress 2 Transition Update

Current QA preview:

- `https://system-project-math-sci-f96db92qp-lordtd-hubs-projects.vercel.app`

Completed in this continuation:

- Verified `/admin/rounds` after the operational summary patch.
- Confirmed Progress 1 buckets:
  - completed: Projects 01, 04, 05
  - eligible-but-incomplete: Project03
  - not-yet-eligible: 36 projects
- Chose to leave Project03 incomplete and test Admin acknowledgement, because this validates the intended close policy.
- Closed Progress 1 with acknowledgement.
- Verified Progress 2 became openable.
- Opened Progress 2 through Admin UI.
- Verified Progress 2 eligibility:
  - unlocked: Projects 01, 04, 05
  - still locked/not eligible: Project03 and the other not-yet-eligible projects
- Verified Student01/04/05 can access Progress 2 schedule/evidence controls.
- Verified Student03 cannot access active Progress 2 controls.
- Verified Teacher01-04 and QA Teacher Delta have no stale Proposal/Progress1 tasks and no unauthorized active tasks immediately after Progress 2 opens.

New screenshots:

- `screenshots/admin-rounds-pre-close-progress1-f96db92qp.png`
- `screenshots/admin-rounds-after-progress1-close-ack.png`
- `screenshots/admin-rounds-after-progress2-open.png`
- `screenshots/admin-round-exceptions-progress1-after-close-project03.png`
- `screenshots/multi-r2-student-01-dashboard-after-progress2-open.png`
- `screenshots/multi-r2-student-01-schedule-after-progress2-open.png`
- `screenshots/multi-r2-student-04-dashboard-after-progress2-open.png`
- `screenshots/multi-r2-student-04-schedule-after-progress2-open.png`
- `screenshots/multi-r2-student-05-dashboard-after-progress2-open.png`
- `screenshots/multi-r2-student-05-schedule-after-progress2-open.png`
- `screenshots/multi-r2-student-03-dashboard-after-progress2-open.png`
- `screenshots/multi-r2-student-03-schedule-after-progress2-open.png`
- `screenshots/multi-r2-teacher-01-teacher-dashboard-after-progress2-open.png`
- `screenshots/multi-r2-teacher-02-teacher-dashboard-after-progress2-open.png`
- `screenshots/multi-r2-teacher-03-teacher-dashboard-after-progress2-open.png`
- `screenshots/multi-r2-teacher-04-teacher-dashboard-after-progress2-open.png`
- `screenshots/teacher-delta-teacher-dashboard-after-progress2-open.png`

New operational gap:

- Project03 is not clearly recoverable after Progress 1 closure through `/admin/round-exceptions?round_type=PROGRESS_1`; the page showed zero rows for Progress 1 after closure.
- Add a dedicated eligible-incomplete/reopen panel before Wave 2 if Progress/Final late recovery must be operated fully through Admin UI.

Recommended next step from current state:

1. Continue Wave 1 inside Progress 2 for Projects 01, 04, and 05.
2. Have Students 01/04/05 submit Progress 2 evidence and schedule requests.
3. Verify schedule approval queues appear only for assigned teachers and clear after approval.
4. Verify Project03 remains locked unless a deliberate late/reopen workflow is added.
5. Do not start Wave 2 until the Project03 recovery gap is decided.

## 2026-05-13 Progress 2 Continuation Stop

QA preview used:

- `https://system-project-math-sci-f96db92qp-lordtd-hubs-projects.vercel.app`

Completed before stop:

- Verified Admin `/admin/rounds` showed Progress 2 open with:
  - eligible / ready: `3`
  - submitted: `0`
  - completed: `0`
  - eligible-but-incomplete: `3`
  - not-yet-eligible: `37`
- Verified Student01 could open `/student/schedule` and see the Progress 2 evidence form.
- Student01 submitted Progress 2 evidence.

Stop reason:

- Major bug: after saving Progress 2 evidence, `/student/schedule?success=assessment_evidence_saved` rendered only the application shell/header/footer/logout context.
- The normal schedule/evidence content disappeared, so the student could not safely continue to propose the Progress 2 schedule from the post-submit page.

Screenshot evidence:

- `screenshots/progress2-continuation-admin-start-f96.png`
- `screenshots/progress2-student01-schedule-before-submit-f96.png`
- `screenshots/progress2-student01-evidence-submitted-f96.png`

Not completed:

- Student01 schedule proposal was not submitted.
- Student04/05 Progress 2 evidence/schedule flow was not attempted.
- Teacher schedule approval flow was not attempted.
- Progress 2 scoring was not attempted.
- Progress 2 close guard was not attempted.

Next required action:

1. Push the scoped post-submit content guard patch to `qa-preview` and wait for the new Vercel QA preview URL.
2. Live verify Student01 on the new preview:
   - `/student/schedule?success=assessment_evidence_saved` is not shell-only.
   - saved Progress 2 evidence is visible.
   - the Progress 2 schedule proposal form is reachable if no schedule has been proposed yet.
3. If live verification passes, resume from Student01 and propose the Progress 2 schedule.
4. Continue Student04/05 only after Student01 post-submit state is stable.

Patch status before push:

- `/student/schedule` now exposes stable `data-testid` markers for the page content root, evidence success alert, round status cards, evidence summary, evidence forms, schedule proposal form wrapper, and latest proposal section.
- Source regression checks cover Progress 1, Progress 2, and Final evidence-save success states; locked/unsupported schedule states must still render visible status content instead of a blank shell.
- `wave1-continuation-cli.run-code.js` now has a guarded shell-only check for `/student/schedule`.
- Validation:
  - `npm run typecheck`: PASS
  - `npm test`: PASS, 77 files / 314 tests
  - `npm run build`: PASS
  - `e2e-artifacts` secret scan: PASS

## Latest Validation

- `npm test`: PASS, 73 files / 285 tests
- `npm run build`: PASS
- `npm run typecheck`: PASS on rerun after build generated `.next/types`
- Secret scan in `e2e-artifacts`: PASS

## Stabilization Patch Status - Future-Round Gate

Patch status: implemented locally after the Wave 1 stop.

Issues patched:

- Student future-round actions now require both project lifecycle readiness and the course-level assessment round to be open.
- Progress 1, Progress 2, and Final actions are hidden from the primary action list when their course round is closed.
- `/student/schedule` now shows locked/waiting cards for unopened Progress/Final rounds instead of an actionable schedule button.
- Students who missed Proposal before the Proposal round closed now see a blocked late state instead of a normal submit action.
- Raw schedule/status labels are mapped to Thai-facing labels on student, teacher, and admin schedule surfaces where patched.
- Teacher role badges are de-duplicated before rendering.
- Pending schedule approval queues are ordered by request submission time first (`createdAt ASC`), then proposed exam time.

Tests added/updated:

- Future Progress 2 action is blocked when Progress 2 round is closed.
- Progress 2 action can appear when Progress 2 round is open.
- Late Proposal after closed Proposal round shows a blocked state.
- Schedule page source uses the round-open card state.
- Teacher role badge source de-duplicates roles.
- Teacher/admin schedule queue source orders by submission time.

Remaining before continuing Wave 1:

- Push the scoped patch to QA preview after validation.
- Run a targeted Edge QA check on Student 01 and Student 02.
- Continue Project 04 and Project 05 Progress 1 scoring only after the QA preview is updated.

Validation after this patch:

- `npm run typecheck`: PASS
- `npm test`: PASS, 73 files / 288 tests
- `npm run build`: PASS

## Policy Decision - Late/Missed Round Handling

Status: decided and patched after the future-round gate.

Decisions:

- Late/missed submissions are hard-locked by default after a round closes.
- Student-facing wording should say the student must contact the responsible instructor/admin for case-by-case handling.
- Admin can open a late/missed round for one project at a time with audit/timeline evidence.
- When Admin closes Proposal while students have not submitted, the UI must list missing students and require explicit acknowledgement before closing.
- The same policy direction applies to Proposal, Progress 1, Progress 2, and Final.
- Default penalty for a non-excused late/missed round is 10% deducted from the score submitted by each evaluator for that round.
- If Admin marks the case as excused/force majeure, the late tag remains as evidence but the 10% deduction is not applied.
- If the Final round has closed and a project remains incomplete, the student dashboard must warn that the project may receive grade I and must contact the responsible instructor/admin.

Patch notes:

- Added a shared late-round exception helper and default 10% penalty helper.
- Added audited Admin action to open late round access per project using existing `ProjectRoundException`.
- Proposal submission and Progress/Final evidence/schedule actions can proceed after round closure only when an open per-project late exception exists.
- Proposal, Progress 1, Progress 2, and Final scoring actions apply the late penalty at score-submission time and keep raw score metadata for audit.
- Student dashboard shows late-round tags and Final-closed incomplete grade-I risk warning.
- Teacher Proposal dashboard/list/scoring pages include opened late Proposal cases after the normal Proposal round is closed, so an admin override does not create a hidden evaluator task.

Remaining implementation gap:

- The Admin UI currently exposes the per-case reopening flow clearly for missed Proposal cases. A broader Admin list for missed Progress 1, Progress 2, and Final cases should be added before Wave 2 if the pilot needs to recover late Progress/Final students through the UI without direct route/form construction.

Validation after the late/missed round patch:

- `npm run typecheck`: PASS
- `npm test`: PASS, 75 files / 296 tests
- `npm run build`: PASS

Manual/user-guide notes:

- See `e2e-artifacts/multi-pilot-r2-wave1/MANUAL_NOTES.md` for the role-based explanation points that must be carried into the Admin, Teacher, and Student manuals.

## Student 02 Late Proposal UI Patch Verification

Status: patched and pushed to QA preview after script compatibility review.

Commit:

- `fce9bdc` - `fix: show submitted late proposal state`

QA preview verified:

- `https://system-project-math-sci-2ybxa0lct-lordtd-hubs-projects.vercel.app`

What was fixed:

- `/student/proposal` now distinguishes `canSubmitProposal=false` because the student is blocked from submitting from `canSubmitProposal=false` because the Proposal has already been submitted.
- After Student 02 late Proposal submission, the page shows a read-only submitted summary.
- The active Proposal submit form is hidden after successful submission.
- Late submitted cases show `ส่ง Proposal หลังปิดรอบแล้ว`.
- The old misleading message `ยังส่งเอกสารเสนอหัวข้อไม่ได้` is no longer shown after successful late submission.

Pilot script compatibility work:

- Updated `student-wave1-proposal-submit.playwright.js` to assert that a submitted Proposal reaches the read-only summary and that the active form disappears.
- Updated `wave1-after-late-open-continuation.run-code.js` to use stable `data-testid` guards for:
  - `student-proposal-submitted-summary`
  - `student-proposal-late-submitted-notice`
- Fixed the QA role switching helper to follow the real QA login code path:
  1. go to `/qa-login`
  2. click `ออกจาก QA session` if a QA session exists
  3. select the next role
  4. submit QA login
  5. fail immediately if the login does not redirect to the role dashboard
- Removed the old fragile behavior where the script manually navigated to `/teacher` or `/student` after a failed login attempt.

Guarded verification result:

- Student 02 `/student/proposal`: PASS
  - submitted summary present
  - late-submitted notice present
  - active Proposal form absent
  - project remains in Proposal review/waiting-review state
- Teacher 03 `/teacher/proposals`: PASS
  - Student 02 / Project 02 appears in the Proposal reviewer queue
  - scoring link is visible
- Teacher 03 submitted one Proposal score for Project 02: PASS
  - redirected with `success=proposal_score_saved`
  - scoring page became read-only
  - no active `ส่งคะแนนการเสนอหัวข้อ` button remained

Screenshots captured:

- `e2e-artifacts/multi-pilot-r2-wave1/screenshots/2026-05-12T12-38-33-821Z-student02-late-proposal-before-fill.png`
- `e2e-artifacts/multi-pilot-r2-wave1/screenshots/2026-05-12T12-39-05-718Z-bug-Major-student02-late-open-proposal-submit-disabled-after-fill.png`

Note:

- The earlier bug screenshot above was from a script-login fragility, not from the patched app UI. Manual guarded verification after aligning the login flow with `/qa-login` confirmed the app behavior is correct.

## Wave 1 Continuation Status After Project 02 Reviewer 2

Completed:

- Logged in through `/qa-login` as `MULTI-PILOT-R2 Teacher 02`.
- Verified Teacher 02 had one actionable Proposal item for `MULTI-PILOT-R2 Project 02 Late Proposal Recovery`.
- Opened Teacher 02 scoring page for Project 02.
- Confirmed the page showed the late-opened Proposal warning and 10% deduction notice.
- Submitted Teacher 02 Proposal assessment.
- Confirmed redirect to `?success=proposal_score_saved`.
- Confirmed Teacher 02 scoring page became read-only and no active submit button remained.

Screenshot:

- `screenshots/project02-teacher02-proposal-score-saved-readonly.png`

Remaining from current prompt:

- Admin Proposal decision for Project 02.
- Verify Project 02 late/reopen tag remains understandable in Admin decision/timeline.
- Continue Project 04 Progress 1 scoring.
- Continue Project 05 schedule rejection/resubmission verification and Progress 1 scoring.
- Future-round lock check after Project 04/05 Progress 1 completion.
- Teacher role-overlap checks for Teachers 01-04.
- Teacher Delta unauthorized/empty queue check.
- Student/admin unauthorized route checks.
- Admin incomplete/late visibility review.
- Run `npm test` after pilot continuation.

Automation/session caution:

- Do not use Playwright CLI `open` to jump between protected preview URLs or deep links during an authenticated QA flow.
- In this run, jumping directly to a protected preview deep link caused the session to land on the Vercel preview-protection/login page and lose the QA role context.
- Continue by keeping one visible Edge session and using the app header `กลับหน้า QA Login` link, then the QA logout/login controls.
- If the browser is already on Vercel login, restore the session by opening the known accessible QA preview manually or with user assistance rather than repeatedly opening/closing new Edge windows.

## Browser/session safety rule

This rule is now mandatory for every remaining pilot action.

- Do not close Edge during the pilot.
- Do not open a competing Edge session unless the user explicitly asks.
- Do not reset storage, delete cookies, or switch preview URL mid-flow.
- Do not use direct `open` jumps to protected preview deep links during authenticated QA flow.
- Use the app header `กลับหน้า QA Login` to return to `/qa-login`.
- If the expected role is already active, do not login/logout again.
- If role switching is needed, use the QA logout/login controls from `/qa-login`.
- Before each action, verify role, project, route, current state, and that the intended button/form exists and is enabled.
- After each action, verify success state, queue/read-only state, no digest error, no blank page, and no unexpected route jump.
- If state does not match, stop, capture screenshot, document the mismatch, and do not guess-click.

Script guard status:

- Added `pilot-session-guard.playwright.js`.
- Updated login helpers to stop on Vercel/login pages and avoid fixed preview jumps.
- Updated Proposal, Progress 1, Admin decision, and schedule helper scripts to guard before acting.
- Updated long-running Node runners so they leave Edge open by default. Browser close requires explicit `PW_CLOSE_BROWSER=1` outside live pilot work.

## Latest Continuation Result - Stop on Guard Failure

Current browser/session:

- Existing Microsoft Edge session: `live-late-proposal-verify`
- Last checked QA preview origin: `https://system-project-math-sci-rddm0ys1l-lordtd-hubs-projects.vercel.app`
- Edge was not closed.
- Role switching used `/qa-login` inside the app and QA logout/login controls.

Completed after Project 02 reviewer 2:

- Teacher 02 submitted Progress 1 scores for Project 05 and Project 04.
- Teacher 02 queue cleared after those scores.
- Teacher 03 was checked and did not show Progress 1 scoring tasks for Project 04/05.
- Teacher 01 submitted Progress 1 scores for Project 05 and Project 04.
- Teacher 01 queue cleared after those scores.
- Student 04 dashboard confirmed Progress 1 complete and Progress 2 locked until Admin opens the round.
- Student 05 dashboard confirmed Progress 1 complete, schedule rejection/resubmission evidence is visible, and Progress 2 is locked until Admin opens the round.

Screenshots added:

- `screenshots/project05-teacher02-progress1-score-saved-project04-remaining.png`
- `screenshots/teacher02-progress1-queue-cleared-after-project04-project05.png`
- `screenshots/teacher03-no-progress1-actions-after-teacher02-scores.png`
- `screenshots/project05-teacher01-progress1-score-saved-project04-remaining.png`
- `screenshots/teacher01-progress1-queue-cleared-after-project04-project05.png`
- `screenshots/student04-progress1-complete-progress2-locked.png`
- `screenshots/student05-progress1-complete-progress2-locked-after-reschedule.png`

Guard failure found:

- Policy clarified by user: Proposal can be assessed by any teacher during the valid scoring window.
- Therefore `QA Teacher Delta` seeing Proposal scoring is not a boundary bug by itself.
- Actual issue: after Admin records the Proposal decision, Teacher Delta and Teacher 01 should no longer see Project 02 as pending/unscored Proposal work.
- Screenshot: `screenshots/teacher-delta-unexpected-project02-proposal-action.png`
- Action taken: stopped immediately and did not click the scoring action.

Related bug carried forward:

- Teacher 01 also saw Project 02 Proposal scoring as actionable after Admin Proposal decision was already saved.
- Screenshot: `screenshots/teacher01-stale-project02-proposal-action-after-admin-decision.png`

Current stop reason:

- Stop because the state did not match the clarified after-decision behavior.
- Do not continue browser actions until Project 02 Proposal reviewer/decision queue consistency is patched and verified.

Patch applied locally:

- Teacher dashboard Proposal query excludes attempts with an existing Admin Proposal decision.
- `/teacher/proposals` excludes attempts with an existing Admin Proposal decision.
- `openProposalScoring` and `submitProposalScore` block when Admin Proposal decision already exists.
- Direct scoring page shows read-only Admin-decision message instead of an active form after decision.
- Added `src/app/proposalDecisionQueueSource.test.ts`.

Remaining Wave 1 tasks after stabilization:

- Admin incomplete/late visibility review.
- Verify Project 02 late/reopen tag remains understandable in Admin timeline/evidence.
- Open Progress 2 only after Admin action and verify student actions appear only then.
- Continue Progress 2 checks for eligible Projects 01/04/05 after the above queue/boundary issues are fixed.
- Run `npm test` after artifact updates and before next handoff.

Latest validation:

- `npm run typecheck`: PASS
- `npm test`: PASS, 76 files / 297 tests
- `npm run build`: PASS
- Secret scan in `e2e-artifacts`: PASS, QA secret not found in artifacts

## Guarded Verification Completed - Proposal Queue After Admin Decision

QA preview verified:

- `https://system-project-math-sci-3tbavgvkp-lordtd-hubs-projects.vercel.app`
- Commit: `8593c8b`
- Browser/session: visible persistent Edge `edgepilot`

Verification result:

- Teacher 01 dashboard: PASS
  - Proposal queue count is `0`.
  - Project 02 no longer appears as an actionable Proposal scoring task.
- Teacher 01 `/teacher/proposals`: PASS
  - Empty state shown.
  - No Project 02 active scoring action.
- QA Teacher Delta dashboard: PASS
  - Proposal queue count is `0`.
  - No Project 02 action.
- QA Teacher Delta `/teacher/proposals`: PASS
  - Empty state shown.
  - No Project 02 active scoring action.
- QA Teacher Delta direct Project 02 scoring URL: PASS
  - Route opens read-only.
  - Message says Admin has recorded the Proposal decision.
  - No score submit button is visible.

Screenshot:

- `screenshots/teacher-delta-project02-direct-scoring-readonly-after-admin-decision-8593c8b.png`

Current status:

- Stale Proposal queue after Admin decision is resolved for the verified roles.
- Unauthorized/actionable Proposal visibility for Teacher Delta after Admin decision is resolved.
- No emergency patch was needed during this verification.

Remaining Wave 1 tasks:

- Admin incomplete/late visibility review.
- Verify Project 02 late/reopen tag remains understandable in Admin timeline/evidence.
- Open Progress 2 only through Admin and verify eligible students see Progress 2 afterward.
- Continue Progress 2 checks for eligible Projects 01, 04, and 05.
- Keep watching the Admin Proposal decision pending-state issue if it is reproduced.

## Admin Round Exception UX Patch

Status: implemented locally and validated.

Why:

- `/admin/rounds` showed the late Proposal reopen form for every missed student.
- With the 40-student MULTI-PILOT-R2 dataset, this created a very long page and made it hard for Admin to operate safely.

What changed:

- `/admin/rounds` now keeps only a compact late/missed summary and a link to a dedicated exception-management page.
- Added `/admin/round-exceptions` for operational handling of missed/late cases.
- The new page supports round filter, status filter, search, compact table display, and per-row expandable late-open form.
- The audited late-open server action is reused and can redirect back to `/admin/round-exceptions`.

Validation:

- `npm run typecheck`: PASS
- `npm test`: PASS, 77 files / 300 tests
- `npm run build`: PASS

Next live check:

- Push/deploy QA preview.
- Open existing Edge session to `/admin/rounds`.
- Confirm the long list is gone from `/admin/rounds`.
- Open `/admin/round-exceptions?round_type=PROPOSAL`.
- Confirm missed Proposal students are shown in a searchable/filterable table and only one row expands when Admin chooses to open a case.

Latest live-check attempt:

- New QA preview after push: `https://system-project-math-sci-29rpu93od-lordtd-hubs-projects.vercel.app/qa-login`
- Commit: `638e16e`
- Status: blocked by Vercel Deployment Protection before app verification.
- Screenshot: `screenshots/new-preview-vercel-protection-block-638e16e.png`

Guard outcome:

- Stop condition triggered because the browser landed on `vercel.com/login`, not the QA app.
- Edge was not closed.
- Storage/cookies were not reset.
- No admin workflow action was clicked.

To continue:

1. Open/approve the new preview URL in the same visible Edge session.
2. Start at `/qa-login`.
3. Login as `MULTI-PILOT-R2 Admin`.
4. Verify the Admin Round Exception UX patch before continuing Wave 1.

Live verification completed:

- New QA preview: `https://system-project-math-sci-29rpu93od-lordtd-hubs-projects.vercel.app`
- Commit: `638e16e`
- Browser method: persistent Edge CDP session on port `9333`.
- Added guarded helper: `cdp-edge-guard.js`.

Results:

- `/admin/rounds`: PASS.
  - Long per-student late Proposal form list is gone.
  - Compact summary and link to `/admin/round-exceptions` are visible.
  - Screenshot: `screenshots/admin-rounds-late-summary-638e16e-live.png`
- `/admin/round-exceptions?round_type=PROPOSAL`: PASS.
  - Filter/search/table UI works.
  - Student 02 is shown as submitted after round close with 10% deduction and no extra action.
  - Missing students remain expandable one row at a time for case-by-case reopen.
  - Screenshot: `screenshots/admin-round-exceptions-list-638e16e-live.png`

Do not continue to Progress 2 yet:

- `/admin/rounds` still shows suspicious Progress 1 counters:
  - ready `4`,
  - submitted `0`,
  - completed `0`,
  - not ready/exceptions `36`.
- This does not match the earlier Wave 1 evidence that Projects 01/04/05 have Progress 1 activity and scoring.
- Next step should be a guarded investigation of Progress 1 counter semantics before closing Progress 1 or opening Progress 2.

Progress 1 counter investigation result:

- Cause found: `/admin/rounds` was using Proposal-oriented `presentationSubmission` counts for every round.
- Progress and Final evidence are stored as `assessmentSubmission`, so Progress 1 showed submitted/completed `0` even when pilot evidence existed.
- Patch applied:
  - `src/app/admin/rounds/page.tsx`
  - `src/app/admin/rounds/roundsUx.test.ts`
- New behavior:
  - Progress/Final submitted counts use `AssessmentSubmission.kind`.
  - Progress/Final completed counts use required committee score completion via `isPresentationAssessmentComplete`.

Validation after patch:

- `npm run typecheck`: PASS
- `npm test`: PASS, 77 files / 301 tests
- `npm run build`: PASS

Next required action:

- Commit/push the scoped counter patch to QA preview.
- Open the new QA preview URL after deployment.
- Verify `/admin/rounds` counter values live before closing Progress 1 or opening Progress 2.

Counter patch live verification:

- QA preview: `https://system-project-math-sci-kwtp9kb6q-lordtd-hubs-projects.vercel.app`
- Commit: `53203a1`
- Result: PASS.
- Progress 1 now shows:
  - ready `4`,
  - submitted `3`,
  - completed `3`,
  - not ready/exceptions `36`.
- Screenshot: `screenshots/admin-rounds-progress1-counters-fixed-53203a1-live.png`

New stop reason before opening Progress 2:

- Admin can see Progress 1 still has many not-ready/incomplete projects, but the close-round UI does not show an affected-student list or acknowledgement for Progress 1.
- Proposal already has an acknowledgement flow, but the user's policy decision says the same incomplete/late discipline should apply to every round.
- Do not close Progress 1 or open Progress 2 until the non-Proposal round closure warning/acknowledgement behavior is reviewed or patched.

Recommended next patch:

- Extend Admin round closure warning/acknowledgement from Proposal to Progress 1, Progress 2, and Final.
- Show affected project/student names for incomplete/not-ready cases.
- For Final, explicitly warn that incomplete projects may receive grade I.
- Keep the patch display/guard scoped; do not change scoring semantics.

Round eligibility bucket patch status:

- Implemented locally after the Progress counter patch.
- `/admin/rounds` now separates:
  - ready/eligible for this round,
  - submitted evidence for this round,
  - assessment completed for this round,
  - eligible but incomplete,
  - not yet eligible,
  - late/open exceptions.
- Non-Proposal close acknowledgement is based only on eligible-but-incomplete projects.
- Not-yet-eligible projects are no longer treated as current-round blockers.
- Final close warning includes grade-I risk wording.

Validation after this patch:

- `npm run typecheck`: PASS
- `npm test`: PASS, 77 files / 308 tests
- `npm run build`: PASS
- Final `npm run typecheck`: PASS

Next required action:

- Commit and push the scoped patch to `qa-preview`.
- Wait for the new Vercel QA preview URL.
- Open the new preview at `/qa-login` in the persistent Microsoft Edge session.
- Login as `MULTI-PILOT-R2 Admin`.
- Verify Progress 1 buckets on `/admin/rounds`:
  - Projects 01/04/05 should be completed.
  - eligible-but-incomplete should show only projects that passed the previous gate but have not completed Progress 1.
  - the 36 not-yet-eligible projects should be in the separate not-yet-eligible bucket.
  - close Progress 1 should require acknowledgement only for eligible-but-incomplete projects.
- Do not close Progress 1 unless the guard clearly matches the intended state.

Live verification completed:

- QA preview: `https://system-project-math-sci-cejnzvxde-lordtd-hubs-projects.vercel.app`
- Commit: `f19c78d`
- Role: `MULTI-PILOT-R2 Admin`
- Result: PASS.
- Progress 1 buckets:
  - ready/eligible `4`
  - submitted `3`
  - completed `3`
  - eligible-but-incomplete `1`
  - not-yet-eligible `36`
  - exceptions `0`
- The eligible-but-incomplete warning lists only Student 03 / Project 03.
- The 36 not-yet-eligible projects are separated and are not current-round blockers.
- No close/open action was clicked.

Wave 1 can continue only after Admin deliberately decides how to handle the one eligible-but-incomplete Project 03 before closing Progress 1.

## Current Progress 2 Stabilization Queue

Current QA preview after evidence-success patch:

- `https://system-project-math-sci-4lkxybd8n-lordtd-hubs-projects.vercel.app`
- Commit: `5f64eee`

Completed before the current stop:

- Student01 Progress 2 evidence success page is no longer shell-only.
- Project01 Progress 2 schedule is confirmed after Teacher01/02/03 approvals.
- Student04 and Student05 have Progress 2 evidence and pending Progress 2 schedule proposals.

Current stop reason:

- Major timezone bug: schedule form input `09:00-10:00` displays as `16:00-17:00` on live QA.
- Patch is required before teacher queue approval continues.

Required next actions:

- Validate and push the timezone parse patch to `qa-preview`.
- Use the new QA preview URL after push.
- Live verify that a newly submitted schedule request displays the same Bangkok civil time selected in the form.
- Recover Project04/Project05 pending schedule times through UI only; do not use direct DB manipulation.
- Then continue the original loop:
  - inspect teacher queues with Project04/Project05 accumulated,
  - approve Project04,
  - reject/resubmit/approve Project05,
  - score required Progress 2 reviewers,
  - verify Progress 2 close guard.

## Progress 2 Loop Result

Status: completed successfully.

Completed:

- Timezone patch validated and pushed.
- New QA preview used: `https://system-project-math-sci-da1lofaxb-lordtd-hubs-projects.vercel.app`.
- Project04 and Project05 pending schedule times were recovered through UI rejection/resubmission only.
- Project04 and Project05 resubmitted schedules now display `09:00-10:00` Bangkok time.
- Teacher queues were inspected with multiple pending schedule jobs before approvals.
- Project04/Project05 schedule approvals completed.
- Required Progress 2 scores completed:
  - Project01: Teacher02 + Teacher03
  - Project04: Teacher01 + Teacher02
  - Project05: Teacher01 + Teacher02
- Teacher01/02/03 Progress 2 scoring queues cleared after submission.
- Teacher04 and Teacher Delta had no unauthorized Progress 2 scoring forms.
- Admin closed Progress 2.
- Final remained unopened.

Ready next:

- Final round testing can begin later from this saved state.
- Do not start Wave 2 yet.
- Do not start documentation/manual screenshots yet.

Carry into next pass:

- Open Final via Admin only when the next prompt explicitly starts Final testing.
- Verify Final student visibility for Project01/04/05 after opening Final.
- Keep Project03 locked/recoverable; it still has not passed Progress 1.
- Watch teacher queue scale carefully; the current pages work but get visually dense as multiple pending and read-only items accumulate.

## Final Round Continuation - Current Stabilization Stop

Status: Major patch validated locally; live QA push/verification still required.

Already completed in this Final pass:

- Mandatory context files and listed logic/UI/test files were read before action.
- Final was opened by Admin on `https://system-project-math-sci-5634jxgdt-lordtd-hubs-projects.vercel.app`.
- `/admin/rounds` showed Final ready `3`, submitted `0`, completed `0`, eligible-but-incomplete `3`, not-yet-eligible `37`.
- Final close guard listed Project01/04/05 and showed the grade-I warning.

Current Major:

- Student01 / Project01 saved Final evidence successfully, then `/student/schedule?success=assessment_evidence_saved` initially rendered shell-only.
- Screenshot: `screenshots/final-student01-evidence-shell-only-major-5634.png`.
- Refresh restored the schedule content, so saved data exists and the likely failure surface is post-submit route/cache transition.

Patch now staged for next live QA cycle:

- Make `/student/schedule` explicit dynamic/no-cache.
- Add saved entity ids and round/kind query params to evidence/schedule post-submit redirects.
- Keep UI scope unchanged; no dashboard redesign.

Required next actions:

- Commit scoped post-submit guard patch.
- Push `qa-preview` only.
- Use the new Vercel QA preview URL after push.
- Live verify Student05 can return from the existing Final evidence success URL with full content and propose Final schedule without manual reload.
- Resume Final loop from saved state:
  - Student01 Final schedule is already proposed.
  - Student04 Final evidence and schedule are already proposed.
  - Student05 Final evidence is saved; Final schedule still needs to be proposed.
  - Student03 remained locked in the live check.
  - then move to accumulated teacher Final schedule queues and scoring.

Latest local validation:

- `npm run typecheck`: PASS.
- `npm test`: PASS.
- `npm run build`: PASS.
- QA secret scan across `src` and `e2e-artifacts`: PASS.

## Final Round Scoring Counter Stabilization Stop

Status: Major patch validated locally; live QA push/verification still required.

Already completed in this Final pass:

- Student05 Final evidence post-submit recovery passed on the new QA preview.
- Project01/04/05 Final schedules were submitted and approved.
- Project05 reject -> resubmit -> approve flow was exercised again in Final.
- Final scoring was submitted for required reviewers:
  - Project01: Teacher02 + Teacher03
  - Project04: Teacher01 + Teacher02
  - Project05: Teacher01 + Teacher02
- Teacher04 and Teacher Delta had no unauthorized Final scoring forms.
- Single-reviewer completion guard passed: one Teacher01 score for Project05 did not mark Final completed.

Current Major:

- After all required Final scores were saved, Admin `/admin/rounds` incorrectly showed Final ready/submitted/completed as `0` and not-yet-eligible as `40`.
- Expected: ready `3`, submitted `3`, completed `3`, eligible-but-incomplete `0`, not-yet-eligible `37`.
- Root cause: `FINAL_DONE` projects were excluded from historical round eligibility because the topic/proposal gate status helper only accepted `TOPIC_APPROVED` and `IN_PROGRESS`.
- Screenshot: `screenshots/final-admin-rounds-after-all-final-scores-qj.png`.

Patch now ready for next live QA cycle:

- Treat `FINAL_DONE` and `COMPLETED` as already past the topic/proposal gate for round bucket calculation.
- Add regression test that a Final-completed `FINAL_DONE` project remains eligible/submitted/completed in the Final bucket.

Required next actions:

- Commit scoped round-eligibility patch.
- Push `qa-preview` only.
- Use the new Vercel QA preview URL after push.
- Live verify `/admin/rounds` from saved QA state:
  - Final ready `3`
  - submitted `3`
  - completed `3`
  - eligible-but-incomplete `0`
  - not-yet-eligible `37`
- If verified, close Final via Admin and continue only to report readiness check.

Latest local validation:

- `npm run typecheck`: PASS.
- `npm test`: PASS, 77 files / 316 tests.
- `npm run build`: PASS.

## Final Report Readiness Stabilization Stop

Status: Major patch validated locally; live QA push/verification still required.

Completed after the previous patch:

- New QA preview `https://system-project-math-sci-8tb6aov28-lordtd-hubs-projects.vercel.app` verified the Final bucket fix.
- Admin `/admin/rounds` showed Final ready `3`, submitted `3`, completed `3`, eligible-but-incomplete `0`, not-yet-eligible `37`.
- Admin closed Final successfully.

Current Major:

- Student03, which has not passed Progress 1 and never completed Final, incorrectly saw the report submission form after Final round closure.
- Expected: Student01/04/05 report unlocked; Student03 locked with no submission form.
- Root cause: student report readiness used the course-level Final round close status as completion evidence. Closed round status must not substitute for required committee Final scores.
- Screenshot: `screenshots/final-multi-r2-student-03-report-readiness-8tb.png`.

Patch now ready for next live QA cycle:

- Student report page and student server action now use score-only Final completion checks for report readiness.
- Source tests prevent reintroducing `roundStatus: project.courseOffering.assessmentRounds` into student completion gates.

Required next actions:

- Commit scoped report readiness patch.
- Push `qa-preview` only.
- Use the new Vercel QA preview URL after push.
- Live verify:
  - Student01/04/05 still show report submission form.
  - Student03 no longer shows report submission form.
  - Server-side report submit remains guarded by the same score-only gate.

Latest local validation:

- `npm run typecheck`: PASS.
- `npm test`: PASS, 77 files / 317 tests.
- `npm run build`: PASS.

## Final Round Completion State

Status: Final round operational flow completed successfully.

Latest QA preview verified:

- `https://system-project-math-sci-7zexh6fcz-lordtd-hubs-projects.vercel.app`
- Commit: `f6913b1`

Completed:

- Final bucket fix live-verified.
- Admin closed Final successfully.
- Student01/04/05 report readiness unlocked.
- Student03 report readiness locked; no report submission form visible.
- No Final stale teacher scoring forms remained after required submissions.

Ready next:

- Report workflow testing can begin later from this saved state.
- Do not start Wave 2 until explicitly requested.
- Do not start documentation/manual screenshots until explicitly requested.

Carry into next pass:

- Project03 remains the main incomplete/recovery case.
- Verify report review queues and reviewer permissions before accepting report workflow as stable.
- Continue to watch queue density and Admin action hierarchy as UX debt, not a Wave 1 semantics blocker.

## Report Workflow Completion State

Status: Report workflow, advisor score unlock, Admin closeout, and evidence/export checks completed successfully for Wave 1 projects.

Latest QA preview verified:

- `https://system-project-math-sci-8jb32im2d-lordtd-hubs-projects.vercel.app`
- App commit in preview: `c8a0c53`

Completed:

- Student01/04/05 submitted reports after Final completion.
- Student03 remained locked and could not submit a report.
- Project01/04 reports were approved by required reviewers.
- Project05 revision loop was verified:
  - version 1 received one PASS and one revision request,
  - student submitted version 2,
  - required reviewers approved version 2,
  - old version-1 approval did not automatically approve version 2.
- Advisor scores were submitted for Project01/04/05 only after report approval.
- Admin completed closeout for Project01/04/05.
- Completed student dashboards showed completed status without misleading pending task counts.
- Admin evidence page loaded after closeout.
- Grade summary CSV/XLSX and existing evidence exports returned HTTP 200 with non-empty content.

No current Major/Blocker remains from the Report pass.

Ready next:

- Wave 1 operational semantics are complete enough to review accumulated Minor/UX debt.
- Wave 2 should still wait for explicit user approval.
- Documentation/manual screenshots should still wait for explicit user approval and the separate UX/readability decision.

Carry into next pass:

- Project03 recovery/reopen handling remains the main lifecycle edge case.
- Teacher report/advisor queues should be redesigned later for scale; the workflow worked, but long-card density will become hard with 10+ projects.
- Admin evidence/export now includes grade summary, but real registrar format decisions may still be needed before production use.

## 2026-05-13 Wave 1 Remaining Cleanup Plan

Wave 1 has completed one full controlled lifecycle. Do not rerun the full lifecycle from scratch unless a later code change touches lifecycle/scoring/eligibility behavior.

Primary plan file:

- `e2e-artifacts/multi-pilot-r2-wave1/WAVE1_REMAINING_FULL_LOOP_PLAN.md`

Remaining cleanup before Wave 2:

1. Student readability stabilization:
   - `/student`
   - `/student/schedule`
   - `/student/report`
   - `/student/feedback`
   - Clarify current action, waiting state, locked state, submitted state, revision state, and completed state.
2. Project03 recovery UX and non-Proposal late/reopen decision:
   - Project03 remained correctly locked after missing Progress 1 completion.
   - Admin still needs clearer recovery/incomplete visibility for Progress 1/2/Final cases.
   - Prefer minimal UI/decision note first; avoid lifecycle changes unless a Major/Blocker is found.
3. Evidence/export polish:
   - Confirm grade CSV/XLSX columns are useful for real end-of-course review.
   - Do not change scoring formulas without a policy decision.
4. Admin/Teacher UX debt triage:
   - Decide which table/filter/search/sticky-summary issues must be patched before Wave 2 and which move to redesign.
5. Artifact/worktree hygiene:
   - Preserve pilot evidence.
   - Keep runtime/browser/test output ignored or uncommitted.

Loop rule:

- Minor/UX: record and continue.
- Major/Blocker: stop, patch minimally, validate, push QA preview, live verify, resume from saved state.

Recommended next full-loop prompt:

- `MULTI-PILOT-R2 Wave 1 Remaining Cleanup - Student Readability and Recovery UX Stabilization`

## 2026-05-13 Wave 1 Cleanup Stabilization Patch

Artifacts:

- `WAVE1_CLEANUP_STABILIZATION_REPORT.md`
- `WAVE2_PLANNING_NOTE.md`

Patched:

- Student readability summaries on schedule/report/feedback pages.
- Project03-style non-Proposal recovery visibility through `/admin/round-exceptions`.
- Grade summary export now includes `student_full_name_th`.

Pending before marking cleanup complete:

- Full local validation:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- QA preview push from `qa-preview`.
- Live QA smoke verification on the new preview:
  - Student schedule/report/feedback readability.
  - Admin `/admin/round-exceptions?round_type=PROGRESS_1` shows eligible-but-incomplete recovery cases without not-yet-eligible projects.
  - Admin evidence grade export still downloads.

Do not start Wave 2 execution until this cleanup patch is validated and explicitly approved.
