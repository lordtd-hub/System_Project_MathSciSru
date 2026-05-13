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
