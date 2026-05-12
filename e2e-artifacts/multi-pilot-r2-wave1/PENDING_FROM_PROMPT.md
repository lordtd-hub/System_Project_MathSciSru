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
