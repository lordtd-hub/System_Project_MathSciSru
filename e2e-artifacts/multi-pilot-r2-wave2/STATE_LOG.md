# MULTI-PILOT-R2 Wave 2 State Log

## 2026-05-13 16:14 +07:00 - Start

- Branch: `qa-preview`
- Local commit after planning-doc commit: `a02ea8d`
- Latest deployed QA preview at start: `https://system-project-math-sci-2wk1i9sbn-lordtd-hubs-projects.vercel.app`
- Wave 1 state: completed and preserved.
- Production: not touched.
- Data strategy: create a new isolated QA course offering for Wave 2.
- Scale target: 12 active projects first, later 20 only if 12 passes.
- Exception mix:
  - W2-01 to W2-08 normal.
  - W2-09 late Proposal recovery.
  - W2-10 Progress recovery.
  - W2-11 schedule reject/resubmit.
  - W2-12 report revision/latest-version loop.

## Current Phase

Phase 2 Proposal round execution is ready to start.

## 2026-05-13 16:20 +07:00 - QA Setup Patch

- Added a QA-only Wave 2 setup action.
- Wave 2 offering title: `MULTI-PILOT-R2 Wave 2 Course Offering`.
- Wave 2 academic year: BE 2571.
- Wave 2 term: semester 1.
- Wave 2 starter projects: QA students 01-12.
- Starter status: `STUDENT_PROFILE`.
- Course rounds: course-level `AssessmentRound` records only.
- Wave 1 data reset/deletion: not performed.

## 2026-05-13 16:25 +07:00 - QA Preview Live Setup

- Pushed commit: `6d223c2`.
- QA preview: `https://system-project-math-sci-daaspquy0-lordtd-hubs-projects.vercel.app`.
- Deployment status: Ready.
- `/qa-login` Wave 2 setup UI: verified.
- Wave 2 setup action: submitted successfully through QA UI.
- Admin evidence: verified both Wave 1 and Wave 2 offerings visible.
- Admin rounds: verified Wave 2 offering visible.
- Student01: verified latest project is starter/profile workflow.
- Teacher11: verified dashboard renders cleanly as a control identity.

## 2026-05-13 16:50 +07:00 - Proposal Phase Tooling Guard Note

- User-observed issue: QA login role dropdown was blank and browser validation displayed `Please select an item in the list.`
- State impact: no app data corruption observed; this is a pilot runner guard problem if automation assumes a role without selecting it.
- Required guard going forward: every CDP/browser runner must choose the first role dropdown explicitly before selecting Admin/Student/Teacher identity, then verify route and role after login.
- Runner compatibility note: use lowercase role select values (`admin`, `student`, `teacher`) and QA identity keys instead of email text.

## 2026-05-13 18:05 +07:00 - Progress 1 Recovery Stop

- Proposal phase: completed for all 12 Wave 2 projects.
- Progress 1: opened and run for W2-01 to W2-09 and W2-11 to W2-12.
- W2-10: intentionally left incomplete for the Progress recovery scenario.
- Teacher schedule approvals: completed for the 11 submitted Progress 1 schedules.
- Progress 1 scoring: completed for the 11 submitted projects.
- Admin close guard: correctly identified only W2-10 as eligible-but-incomplete.
- Progress 1 closure: completed with acknowledgement.
- W2-10 Progress 1 late exception: opened by Admin after round close.
- Stop reason: Major bug. W2-10 still saw Progress 1 as locked on `/student/schedule` after the late exception was opened.
- First patch live check: Student10 remained not-ready because round eligibility counted the open late exception as a blocking exception.
- Second patch status: local stabilization patch completed; live verification pending after QA preview deploy.

## 2026-05-13 18:34 +07:00 - Progress 1 Recovery Verified

- Commit `5e7f941` deployed to `https://system-project-math-sci-p060rlo5d-lordtd-hubs-projects.vercel.app`.
- Student10 submitted Progress 1 late recovery evidence and schedule `W2-P1-10`.
- Assigned teachers approved the W2-10 Progress 1 schedule.
- Required Progress 1 reviewers submitted W2-10 scores.
- Admin Progress 1 counters: ready 12 / submitted 12 / completed 12 / eligible-but-incomplete 0 / not-ready 0.
- Next phase: open and run Progress 2 for all 12 Wave 2 projects.

## 2026-05-13 18:39 +07:00 - Progress 2 Completed

- Progress 2 opened for all 12 Wave 2 projects.
- Students W2-01 to W2-12 submitted Progress 2 evidence and proposed schedules.
- Assigned teachers approved W2-P2 schedules.
- Required committee reviewers submitted Progress 2 scores.
- Admin Progress 2 counters before close: ready 12 / submitted 12 / completed 12 / eligible-but-incomplete 0 / not-ready 0.
- Admin closed Progress 2 at 13 May 2026 18:39 Bangkok time.
- Final round is now openable for all 12 Wave 2 projects.

## 2026-05-13 19:31 +07:00 - Final Round Completed

- QA preview: `https://system-project-math-sci-cp2k496sw-lordtd-hubs-projects.vercel.app`.
- Final opened for all 12 Wave 2 projects.
- W2-01 to W2-12 submitted Final evidence and schedule proposals.
- W2-11 exercised the Final schedule reject/resubmit path:
  - first schedule rejected by Teacher04;
  - resubmitted as `W2-FINAL-11B`;
  - assigned teachers approved the resubmitted schedule.
- Required Final reviewers submitted scores for all 12 Wave 2 projects.
- Admin Final counters before close: ready 12 / submitted 12 / completed 12 / incomplete 0 / not-ready 0.
- Admin closed Final at 13 May 2026 19:31 Bangkok time.

## 2026-05-13 19:36 +07:00 - Report Workflow Completed

- W2-01 to W2-12 submitted final report version 1.
- Student report pages showed waiting-for-review state after submission and no stale active submit form.
- W2-12 exercised report revision:
  - Teacher01 requested revision on report version 1.
  - Student12 submitted version 2.
  - Version history retained both version 1 and version 2.
  - Teachers approved the latest submitted version.
- Latest-version approval behavior passed.

## 2026-05-13 19:41 +07:00 - Advisor Score Completed

- Advisor score unlocked only after report approval.
- Advisors submitted advisor score evidence for W2-01 to W2-12.
- Advisor score pages became read-only after submit.
- Advisor score queues cleared for Wave 2 completed items.

## 2026-05-13 19:44 +07:00 - Admin Closeout Completed

- Admin closeout showed all 12 Wave 2 projects ready.
- Admin completed closeout for W2-01 to W2-12.
- All 12 Wave 2 projects now show `โครงงานเสร็จสมบูรณ์`.
- Completed list includes earlier historical projects in addition to Wave 2, which is expected because Wave 1 data is preserved.

## 2026-05-13 19:46 +07:00 - Evidence / Export Verified

- Admin evidence selected Wave 2 offering `MULTI-PILOT-R2 Wave 2 Course Offering`.
- Evidence readiness summary: 12 projects / 12 completed / 0 missing evidence / 12 report evidence / 12 advisor scores.
- Verified CSV and XLSX exports for grades, projects, timeline, scores, reports, and audit.
- Grade CSV includes per-student code/name/project columns and weighted round score columns.
- Wave 2 12-project loop is complete. Next state decision is whether to prepare a 20-project expansion plan.
