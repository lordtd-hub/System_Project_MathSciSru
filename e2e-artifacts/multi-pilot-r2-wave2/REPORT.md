# MULTI-PILOT-R2 Wave 2 Report

Date started: 2026-05-13 16:14:11 +07:00
Branch: `qa-preview`
Starting local commit: `a02ea8d`
Latest deployed QA preview at start: `https://system-project-math-sci-2wk1i9sbn-lordtd-hubs-projects.vercel.app`

## Current Status

Wave 2 execution has started.

Wave 1 must remain preserved as historical evidence. Production must not be touched.

## Approved Wave 2 Setup

- Data strategy: create a new isolated QA course offering for Wave 2.
- Preserve Wave 1 data.
- Initial scale target: 12 active projects.
- Later scale target: 20 projects only after the 12-project loop passes.
- Exception mix:
  - W2-01 to W2-08: normal path.
  - W2-09: late Proposal recovery.
  - W2-10: Progress recovery.
  - W2-11: schedule reject/resubmit.
  - W2-12: report revision/latest-version loop.

## Phase Log

### Phase 0 - Prepare Wave 2 Artifacts

Status: completed.

Actions:

- Read the required Wave 2 and baseline context files.
- Committed the Wave 2 planning docs first as `a02ea8d`.
- Created Wave 2 artifact files for report, manual notes, state log, bug log, and validation log.

### Phase 1 - Create Wave 2 QA Data

Status: completed.

Patch:

- Added a QA-only Wave 2 setup action on `/qa-login`.
- The action creates or reuses a separate `MULTI-PILOT-R2 Wave 2 Course Offering`.
- The action prepares 12 starter projects at `STUDENT_PROFILE` for existing QA students 01-12.
- Wave 1 data is not deleted, reset, or overwritten.
- The setup keeps course-level assessment rounds only; it does not create per-project rounds.

Validation:

- `cmd /c npm.cmd test -- src/app/qaLoginSource.test.ts src/lib/qa/multiPilotR2.test.ts` - passed.
- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test` - passed, 80 files / 334 tests.
- `cmd /c npm.cmd run build` - passed.

Next required:

- Done: committed and pushed QA-only setup patch to `qa-preview` as `6d223c2`.
- Done: new QA preview URL is `https://system-project-math-sci-daaspquy0-lordtd-hubs-projects.vercel.app`.
- Done: live-verified `/qa-login` shows the Wave 2 setup action.
- Done: prepared Wave 2 data through the QA UI with Edge persistent session.
- Done: verified Wave 1 and Wave 2 offerings are both visible on Admin evidence.
- Done: verified Admin rounds shows Wave 2 offering.
- Done: verified Student01 enters the latest starter/profile workflow.
- Done: verified Teacher11 dashboard renders cleanly as the control identity.

### Phase 2 - Proposal Scale and Queue Density

Status: completed.

Current findings:

- QA-login automation guard tightened after user observed the first `บทบาท` dropdown left blank with native browser validation.
- This is recorded as `W2-TOOL-001` in `BUG_LOG.md`.
- Future Wave 2 runners must select role first, verify the identity option for that role, and assert the post-login route/role before any workflow action.

Operational classification:

- App lifecycle impact: none observed.
- Pilot execution impact: Major if unguarded, because it can stop the full loop before the intended role action.

Additional Phase 2 completion:

- W2-01 to W2-08 and W2-10 to W2-12 completed the normal Proposal path.
- W2-09 completed late Proposal recovery with the expected late/exception path.
- All 12 Wave 2 projects passed Proposal and were assigned committees.
- Progress 1 became ready for 12 Wave 2 projects.

### Phase 3 - Progress 1 Scale and Recovery

Status: completed after stabilization patch.

Completed before the stop:

- Progress 1 opened for Wave 2.
- W2-01 to W2-09 and W2-11 to W2-12 submitted Progress 1 evidence and schedules.
- W2-10 was intentionally left incomplete for the Progress recovery scenario.
- Assigned teachers approved Progress 1 schedules for the submitted projects.
- Required committee reviewers submitted Progress 1 scores for the 11 submitted projects.
- Admin close guard correctly identified only W2-10 as eligible-but-incomplete.
- Admin closed Progress 1 with acknowledgement.
- Admin opened a Progress 1 late exception for W2-10.

Major bug found:

- W2-10 still saw Progress 1 as locked after Admin opened the late exception.
- The student schedule page did not expose Progress 1 evidence/schedule actions.
- Teacher schedule review would also have filtered out late-recovered schedules because the round was closed.

Patch summary:

- Student schedule availability now treats an open late exception as an available round for that student/project.
- Teacher schedule queues and schedule review actions now allow review when the related project has an open late exception for that round.
- Round eligibility now treats open late/excused exceptions as recoverable access, not as `not-ready` blockers.
- Non-late open exceptions still block readiness.
- Source coverage was added to protect late-open Progress/Final recovery UI and action paths.

Validation:

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test` - passed, 80 files / 337 tests.
- `cmd /c npm.cmd run build` - passed.
- Secret scan for the QA secret in `src` and `e2e-artifacts` - passed; no match found.

Live QA verification:

- Patch commit `0774cd6` first deployed to `https://system-project-math-sci-gddt5b4jw-lordtd-hubs-projects.vercel.app`.
- Follow-up eligibility patch commit `5e7f941` deployed to `https://system-project-math-sci-p060rlo5d-lordtd-hubs-projects.vercel.app`.
- W2-10 opened `/student/schedule`, submitted Progress 1 late recovery evidence, and proposed schedule `W2-P1-10`.
- Assigned teachers approved `W2-P1-10`.
- Required Progress 1 reviewers submitted scores.
- Admin Progress 1 counters after recovery: ready 12 / submitted 12 / completed 12 / eligible-but-incomplete 0 / not-ready 0.

### Phase 4 - Progress 2

Status: completed.

Starting state:

- Progress 1 is closed and complete for all 12 Wave 2 projects.
- Progress 2 is expected to be openable for all 12 Wave 2 projects.

Actions:

- Opened Progress 2.
- Students W2-01 to W2-12 submitted Progress 2 evidence.
- Students W2-01 to W2-12 submitted Progress 2 schedule proposals.
- Assigned teachers approved the W2-P2 schedules.
- Required committee reviewers submitted Progress 2 scores.
- Admin closed Progress 2 after counters reached ready 12 / submitted 12 / completed 12 / incomplete 0 / not-ready 0.

Result:

- Progress 2 operational flow completed with no new Major/Blocker.
- Final round is now openable for all 12 Wave 2 projects.

## Current Recommendation

Continue Phase 5 Final round from the current QA state on `https://system-project-math-sci-p060rlo5d-lordtd-hubs-projects.vercel.app`.
