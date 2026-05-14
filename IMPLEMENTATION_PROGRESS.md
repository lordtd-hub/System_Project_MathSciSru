# Implementation Progress

## Current status

- Last completed task: Production baseline seed for internal teacher profiles and required rubrics
- Current task: Production rollout support and real-data bootstrap
- Known blockers: Student roster is not imported yet; production teacher profiles now depend on running the production baseline seed.
- Current baseline: Lifecycle v2 is implemented through Admin-only `COMPLETED`; self-scheduling, Progress 1 scoring, Progress 2 scoring, Final Presentation scoring, report approval, Advisor score 25%, and closeout are functional.
- Architecture baseline: Assessment rounds are course-level only (`courseOfferingId + roundType`); project-level work uses attempts, schedules, report versions, scores, timeline/history, or exceptions. Do not create per-project assessment rounds.
- Next step: Import the real student roster only when ready, then verify teacher/admin role capability after logout/login.

## 2026-05-14 QA manual guide data preparation

- Started the manual-guide preparation track for creating user manuals on QA, not production, because production authentication depends on real SRU Google accounts.
- Added QA-only `MANUAL-DEMO` identities for:
  - one admin manual account;
  - three student manual accounts;
  - eleven teacher options using the real teacher names, while preserving the teacher master records.
- Added guarded reset/seed script `qa:manual:reset-seed` for QA manual data only. The script refuses `VERCEL_ENV=production` and requires `QA_MANUAL_RESET_CONFIRM=RESET_QA_FOR_MANUAL_GUIDE`; remote database reset also requires `QA_MANUAL_ALLOW_REMOTE_RESET=1`.
- Added manual preparation docs:
  - `e2e-artifacts/manual-guide/QA_MANUAL_DATA_PREP.md`;
  - `e2e-artifacts/manual-guide/MANUAL_CAPTURE_PLAN.md`.
- Added UTF-8/mojibake guardrails:
  - `.editorconfig` with `charset = utf-8`;
  - `.gitattributes` with repository-level LF normalization;
  - `src/app/encodingPolicySource.test.ts` for Thai manual text and CSV UTF-8 BOM checks.
- The reset/seed script has not been run yet in this pass; next step is to confirm the intended QA database environment and then run the guarded script when ready.
- Validation so far:
  - `cmd /c npm.cmd test -- qaLoginSource`;
  - `cmd /c npm.cmd test -- encodingPolicySource qaLoginSource`;
  - `cmd /c npm.cmd run typecheck`;
  - `cmd /c npm.cmd test`;
  - `cmd /c npm.cmd run build`.

## 2026-05-14 Classic UI text/readability cleanup

- Continued the frontend-only cleanup track after the classic UX audit. This is not a Wave 2 execution step and does not mutate pilot data.
- Patched user-facing raw/programmer labels without changing submitted values or workflow logic:
  - Student dashboard committee roles now display Thai labels instead of raw role enum values.
  - Student Proposal comments now display Thai vote labels instead of raw `PASS` / `REVISE` / `FAIL`.
  - Teacher report review history now displays Thai decision labels instead of raw `PASS`.
  - Admin Proposal now uses Thai labels for vote counts, final decision headings, decision metadata, score detail labels, and final decision select options while preserving enum option values internally.
  - Admin Evidence keeps internal project/audit IDs available but hides them behind expandable "รหัสอ้างอิงระบบ" details.
- Updated source tests for student readability, teacher report workload text, admin proposal text, and admin evidence ID visibility.
- No lifecycle, scoring, eligibility, auth, Prisma schema, API semantics, server actions, route semantics, QA data, or production configuration changed.
- Validation passed:
  - `cmd /c npm.cmd test -- studentReadabilityStabilization adminOperationalUxSource teacherWorkloadUxSource`;
  - `cmd /c npm.cmd run typecheck`;
  - `cmd /c npm.cmd test`;
  - `cmd /c npm.cmd run build`.
- QA preview/live smoke passed on commit `4add56f`:
  - `https://system-project-math-sci-m7cqf3ycs-lordtd-hubs-projects.vercel.app`
  - Checked `/qa-login`, `/admin/proposals`, `/admin/evidence`, `/student`, `/student/proposal`, and `/teacher/reports`.
  - No QA data mutation was performed.
- Current decision: `READY_FOR_WAVE_2_WITH_DEFERRED_UI_DEBT`.

## 2026-05-14 Frontend UX audit

- Added `e2e-artifacts/frontend-ux-audit/` as a non-mutating user-experience audit package for the classic UI.
- Audited the current QA preview in classic mode for Admin, Teacher, and Student routes on desktop and 390px mobile.
- No app code, lifecycle logic, scoring logic, eligibility logic, auth logic, Prisma schema, API semantics, or production configuration was changed.
- Live route verification found no shell-only pages, digest/application errors, or detected 390px horizontal overflow on the audited routes.
- Main recommendation: keep classic UI active, do a small classic UX cleanup before Wave 2 expansion, and treat the previous Figma redesign attempt as decommissioned unless a new plan is approved later.
- Priority cleanup before wider Wave 2 scale:
  - Teacher dashboard declutter.
  - Admin proposals/schedules compact grouping.
  - Round exception/recovery entrypoint clarity.
  - User-facing Thai label pass for evidence/history wording.

## 2026-05-14 Classic UX cleanup for Wave 2 readiness

- Continued from the frontend UX audit and kept the active interface as classic UI only.
- Patched the teacher dashboard to keep the action queue primary, move notifications into the work area, remove the duplicate account/shortcut widget, compact workload summary badges, and limit the confirmed exam agenda to an internal scroll area.
- Patched `/admin/schedules` so schedule groups render as compact scan rows with expandable committee/notes detail instead of large repeated schedule cards.
- Added user-facing Thai labels for common admin evidence audit entity names before rendering recent audit history.
- Updated source tests for the teacher dashboard, admin schedule density, and evidence label mapping.
- No lifecycle, scoring, eligibility, auth, Prisma schema, API semantics, or production configuration changes were intended.

## 2026-05-14 Figma redesign decommission

- Removed the Figma UI mode, renderer switch, redesign shell/components, UI-mode action, and source tests from the app source.
- Removed tracked Figma redesign planning/screenshot artifacts under `e2e-artifacts/redesign-mapping/` and untracked Figma mockup PNGs under `e2e-artifacts/`.
- Restored the app to the classic UI path only. No lifecycle, scoring, eligibility, auth, Prisma schema, API semantics, or production configuration was intentionally changed.
- Preserved the useful classic UX audit package at `e2e-artifacts/frontend-ux-audit/`.
- Kept the teacher dashboard cleanup that was already agreed for classic UI: compact workload/status metrics, scrollable teacher agenda, no teacher guidance block, and no duplicate teacher quick-link widget.

Historical note: The original Task 01-10 checklist below is retained as the initial MVP sequence. Later 2026-05-06 sections supersede early Proposal-only limitations.

## 2026-05-13 Supabase heartbeat cron

- Added a guarded Vercel Cron endpoint at `/api/cron/heartbeat`.
- The heartbeat checks `Authorization: Bearer $CRON_SECRET` and returns `401` when the secret is missing or invalid.
- The endpoint uses a read-only Prisma `SELECT 1` query so it keeps the hosted database active without changing lifecycle, scoring, auth, or pilot data.
- Registered the cron in `vercel.json` for daily execution at `0 2 * * *` UTC, equal to 09:00 Thailand time.
- Documented `CRON_SECRET` in `.env.example` and README production environment guidance.
- Production was not deployed by this change; Vercel Cron runs only from a production deployment after the production `CRON_SECRET` is configured.

## 2026-05-13 Admin operational UX stabilization

- Started after MULTI-PILOT-R2 Wave 1 completed Proposal through Admin closeout.
- Scope is UI/presentation stabilization only; lifecycle, scoring, eligibility, auth, schema, and production settings were preserved.
- Added `e2e-artifacts/admin-operational-ux/ADMIN_OPERATIONAL_AUDIT.md`.
- Added `e2e-artifacts/admin-operational-ux/ADMIN_QUEUE_DESIGN.md`.
- Added a shared Admin operational queue UI component for scan summaries, status buckets, and dangerous action separation.
- Updated `/admin/rounds` with an operational summary and visually separated open-round controls from close/reset controls.
- Updated `/admin/closeout` to split ready-to-close, waiting, and completed projects.
- Updated `/admin/proposals` with proposal decision/missing-score/fail-vote/released summary buckets.
- Updated `/admin/schedules` to group proposed, rejected, and confirmed schedules.
- Updated `/admin/evidence` with evidence readiness summary and clearer export descriptions, including grade summary meaning.
- Added `src/app/admin/adminOperationalUxSource.test.ts`.
- Local validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- QA preview pushed and live-verified at `https://system-project-math-sci-110mfor0c-lordtd-hubs-projects.vercel.app`.
- Live QA was read-only with MULTI-PILOT-R2 Admin through Edge CDP; `/admin`, `/admin/rounds`, `/admin/proposals`, `/admin/schedules`, `/admin/closeout`, and `/admin/evidence` rendered without auth mismatch, route mismatch, or application error.

## 2026-05-13 Wave 1 remaining cleanup plan

- Added `e2e-artifacts/multi-pilot-r2-wave1/WAVE1_REMAINING_FULL_LOOP_PLAN.md`.
- Updated Wave 1 pending/manual/fix-status artifacts with the remaining cleanup order before Wave 2:
  - Student readability stabilization.
  - Project03 recovery UX and non-Proposal late/reopen decision.
  - Evidence/export polish.
  - Admin/Teacher UX debt triage.
  - Artifact/worktree hygiene.
- The cleanup plan explicitly says not to rerun Wave 1 from scratch, not to start Wave 2, and not to start documentation/manual screenshots until approved.
- The cleanup loop remains: Minor/UX issues are recorded and the pass continues; Major/Blocker issues stop the loop for minimal patch, validation, QA preview push, live verification, and resume.

## 2026-05-13 Wave 1 cleanup stabilization

- Added `e2e-artifacts/multi-pilot-r2-wave1/WAVE1_CLEANUP_STABILIZATION_REPORT.md`.
- Added `e2e-artifacts/multi-pilot-r2-wave1/WAVE2_PLANNING_NOTE.md`.
- Added `src/components/ui/StudentReadabilitySummary.tsx`.
- Updated `/student/schedule`, `/student/report`, and `/student/feedback` with compact action/waiting/done/locked summaries.
- Changed student report review display from raw `PASS` to Thai user-facing wording.
- Updated `/admin/round-exceptions` so non-Proposal eligible-but-incomplete projects are visible for audited per-case recovery through the existing late/reopen action.
- Kept not-yet-eligible projects out of the recovery list so they are not treated as current-round missed cases.
- Added `student_full_name_th` to the grade summary export while preserving existing weighted score calculations.
- Added/updated source and unit tests for student readability, non-Proposal recovery visibility, and grade export columns.
- Targeted validation passed:
  - `cmd /c npm.cmd test -- studentReadabilityStabilization`
  - `cmd /c npm.cmd test -- roundExceptionsUx studentReadabilityStabilization`
  - `cmd /c npm.cmd test -- adminEvidence roundExceptionsUx studentReadabilityStabilization`
- Full validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test` - 80 files / 332 tests
  - `cmd /c npm.cmd run build`
- Secret scan over cleanup artifacts and changed source files passed for the QA secret; only a historical `AUTH_SECRET` documentation mention was found in `IMPLEMENTATION_PROGRESS.md`.
- QA push and live QA verification are still required before marking this cleanup pass complete.

## 2026-05-13 Wave 2 full-loop planning

- Added `e2e-artifacts/multi-pilot-r2-wave2/WAVE2_FULL_LOOP_PLAN.md`.
- The plan defines Wave 2 as a QA-only scale, exception, queue-density, recovery, export, and operational-safety pilot.
- The plan keeps Wave 1 data preserved and recommends creating a separate isolated Wave 2 QA course offering for active workflow scale testing.
- Recommended initial Wave 2 target:
  - 12 active projects.
  - 8 normal projects.
  - 1 late Proposal recovery.
  - 1 Progress recovery.
  - 1 schedule rejection/resubmission loop.
  - 1 report revision/latest-version loop.
- The plan includes a copy/paste full-loop execution prompt, severity policy, validation requirements, live QA guard rules, artifact outputs, and stop conditions.
- Wave 2 execution has not started.

## 2026-05-13 Wave 2 full-loop start

- Wave 2 execution started after the user approved:
  - new isolated QA course offering,
  - 12 active projects first,
  - later expansion to 20 only if 12 passes,
  - exception mix of late Proposal, Progress recovery, schedule reject/resubmit, and report revision/latest-version loop.
- Created Wave 2 artifact logs:
  - `e2e-artifacts/multi-pilot-r2-wave2/REPORT.md`
  - `e2e-artifacts/multi-pilot-r2-wave2/MANUAL_NOTES.md`
  - `e2e-artifacts/multi-pilot-r2-wave2/STATE_LOG.md`
  - `e2e-artifacts/multi-pilot-r2-wave2/BUG_LOG.md`
  - `e2e-artifacts/multi-pilot-r2-wave2/VALIDATION_LOG.md`
- Added a QA-only `/qa-login` setup action for a separate `MULTI-PILOT-R2 Wave 2 Course Offering`.
- The Wave 2 setup creates or reuses 12 starter projects at `STUDENT_PROFILE` for QA students 01-12 and preserves Wave 1 data.
- The setup keeps assessment rounds course-level only and does not create per-project rounds.
- Validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test` - 80 files / 334 tests
  - `cmd /c npm.cmd run build`
- Pending:
  - Commit and push the Wave 2 setup patch to `qa-preview`.
  - Live verify the setup on the new QA preview.
  - Prepare Wave 2 data through the QA UI.

## 2026-05-13 Wave 2 12-project full-loop completion

- Wave 2 12-project operational loop completed on QA preview `https://system-project-math-sci-cp2k496sw-lordtd-hubs-projects.vercel.app`.
- Post-push read-only verification passed on QA preview `https://system-project-math-sci-bl6w48tun-lordtd-hubs-projects.vercel.app`.
- Wave 1 historical data was preserved.
- Production was not touched during the Wave 2 execution loop.
- Completed Wave 2 scope:
  - Proposal for 12 projects.
  - W2-09 late Proposal recovery.
  - Progress 1 for 12 projects.
  - W2-10 Progress recovery after late-exception stabilization.
  - Progress 2 for 12 projects.
  - Final for 12 projects.
  - W2-11 schedule reject/resubmit in Final.
  - Report submission for 12 projects.
  - W2-12 report revision/latest-version approval loop.
  - Advisor score for 12 projects.
  - Admin closeout for 12 projects.
  - Evidence/export continuity for grades, projects, timeline, scores, reports, and audit in CSV/XLSX.
- Major stabilization during Wave 2:
  - Open late/excused round exceptions now unlock the affected closed-round student/teacher recovery path without making not-yet-eligible projects count as blockers.
  - Related validation passed in commits `0774cd6` and `5e7f941`.
- Operational result:
  - No active Major/Blocker remains from the 12-project Wave 2 loop.
  - Minor UX debt remains around dense completed/history sections for teachers and evidence/history scanning as project count grows.
- Recommendation:
  - Plan a controlled expansion from 12 to 20 projects next.
  - Do not jump directly to 40 projects.
  - Do not start manual documentation screenshots until the 20-project decision is made or explicitly deferred.

## 2026-05-06 Production baseline seed

- Added `prisma/seed-production-baseline.ts`.
- Added `npm run seed:production-baseline`.
- The production baseline seed uses `SEED_TEACHERS.csv` as the documented internal teacher source.
- The teacher row marked `is_initial_admin=TRUE` receives `INITIAL_ADMIN_EMAIL` so the production admin can also be linked to the real teacher profile after logout/login.
- Teacher seed behavior is idempotent:
  - Upserts by `academicPrefix + firstNameTh + lastNameTh`.
  - Normalizes email with trim/lowercase.
  - Prevents duplicate teacher email conflicts.
  - Preserves existing teacher email when the CSV email is empty.
- Rubric seed behavior is idempotent:
  - Upserts Proposal, Progress 1, Progress 2, and Final Presentation rubric records.
  - Upserts or keeps existing rubric items without duplicating an already-populated rubric shape.
  - Advisor score continues to use the code-level 100-point advisor rubric because there is no advisor course-level `AssessmentRoundType`.
- The script does not create students, projects, course offerings, demo data, E2E data, or reset the database.
- Updated `README.md` with production baseline seed instructions and warnings not to run demo/e2e scripts against production.
- Added `src/app/productionBaselineSeedSource.test.ts`.

## 2026-05-06 Production course offering opening workflow

- Added a production-oriented Admin workflow for opening a real Course Offering before student import.
- `/admin/import-students` now starts with explicit fields:
  - `ปีการศึกษา`
  - `ภาคเรียน`
  - optional course title
  - `เปิดรายวิชา`
- Added `openCourseOffering` server action:
  - Admin-only guard.
  - Validates academic year and term server-side.
  - Creates/reuses `AcademicYear` and `Term`.
  - Rejects duplicate Course Offering for the same course title + academic year + term.
  - Creates the Course Offering and DRAFT course-level rounds for Proposal, Progress 1, Progress 2, and Final Presentation.
  - Writes `COURSE_OFFERING_OPENED` audit log.
- Student import now checks that `course_offering_id` exists before creating students/projects and redirects with Thai success/error feedback.
- `/admin/students` now points Admin to the explicit open-course/import workflow instead of acting like a term dropdown-only import page.
- Added tests for course offering input validation and source-level guard/import linkage.

## Task checklist

- [x] Task 01 - Scaffold
- [x] Task 02 - Prisma schema
- [x] Task 03 - Seed teachers and proposal rubric
- [x] Task 04 - Student Excel import
- [x] Task 05 - Google auth and teacher account claim
- [x] Task 06 - Academic year and term setup
- [x] Task 07 - Project Origin Form
- [x] Task 08 - Proposal Submission Form
- [x] Task 09 - Proposal checklist scoring
- [x] Task 10 - Admin proposal summary and release

## Decisions / assumptions

- Implemented a simple server-action UI for MVP 1 instead of complex client workflows.
- Student import accepts pasted CSV exported from Excel; `xlsx` is installed for a richer file-upload parser later.
- Google OAuth is wired with NextAuth JWT sessions and stores Google `sub` in the app `User` record.
- Proposal feedback shown to students is anonymous; admin summary keeps evaluator names available through assignments.
- Advisor visibility is database-ready through tentative advisor fields, but a full advisor dashboard is left outside MVP 1 UI.
- Migration SQL was not generated because no live local PostgreSQL connection was available during this run.
- Added Thai production deployment guidance to `README.md`, including Supabase PostgreSQL, Vercel environment variables, separate local/production secrets, and production migration command `npx prisma migrate deploy`.
- Added `docker-compose.yml` for local PostgreSQL development with `postgres:16`, container `project_assessment_postgres`, exposed port `5432`, and persistent volume `project_assessment_pgdata`.
- Confirmed `.env.example` uses `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/project_assessment?schema=public"`.
- Created a local ignored `.env` from `.env.example` so Prisma validation can read the development `DATABASE_URL`; this file must not be committed.

## Validation

- `cmd /c npm.cmd install` - passed
- `cmd /c npx.cmd prisma generate` with example `DATABASE_URL` - passed
- `cmd /c npm.cmd run prisma:format` with example `DATABASE_URL` - passed
- `cmd /c npm.cmd run prisma:validate` with example `DATABASE_URL` - passed
- `cmd /c npm.cmd run typecheck` - passed
- `cmd /c npm.cmd run test` - passed, 7 tests
- `cmd /c npm.cmd run lint` - passed
- `cmd /c npm.cmd run build` - passed
- `cmd /c npm.cmd run prisma:migrate -- --name init --skip-seed` - blocked by local PostgreSQL/schema engine connection error

## 2026-05-05 Documentation update

- Added README section: `Development vs Production`.
- Clarified that local PostgreSQL in Docker is for development only.
- Clarified that production must use Supabase PostgreSQL and Vercel environment variables.
- Clarified that production migrations use `npx prisma migrate deploy`, not `prisma migrate dev`.
- Confirmed no Progress 1, Progress 2, Final, external committee, or AUN-QA export implementation was added.

## 2026-05-06 Project Lifecycle v2 update

- Updated `PROJECT_SPEC.md` with clean Lifecycle v2 workflow:
  - `STUDENT_PROFILE`
  - `DRAFT`
  - `PENDING_ADVISOR`
  - `PENDING_ADMIN`
  - `PROPOSAL_PENDING`
  - `PROPOSAL_REVIEW`
  - `PROPOSAL_ADMIN_DECISION`
  - `TOPIC_APPROVED`
  - `IN_PROGRESS`
  - `FINAL_DONE`
  - `REPORT_REVIEW`
  - `REPORT_APPROVED`
  - `ADVISOR_SCORING`
  - `COMPLETED`
- Updated `DATA_MODEL_DRAFT.md` with Lifecycle v2 data model addendum.
- Updated `RUBRICS_CHECKLIST.md` with Proposal vote and visibility v2 notes.
- Updated `prisma/schema.prisma`:
  - Added new ProjectStatus values while retaining legacy values for compatibility.
  - Added committee roles `HEAD`, `MEMBER`, `EXTERNAL_MEMBER`.
  - Added enums for advisor requests, proposal votes, schedule approvals, report review, advisor score lock state, notifications.
  - Added models: `StudentProfile`, `AdvisorRequest`, `ProjectStatusHistory`, `ProposalVote`, `CommitteeAssignment`, `ExamScheduleProposal`, `ExamScheduleApproval`, `AssessmentSubmission`, `ReportVersion`, `ReportReview`, `AdvisorScore`, `Notification`.
- Added migration: `prisma/migrations/20260506034510_lifecycle_v2/migration.sql`.
- Updated routes/pages:
  - `src/app/admin/page.tsx` shows Lifecycle v2 status counts and notification skeleton.
  - `src/app/student/page.tsx` shows Thai status labels, lifecycle steps, committee/schedule skeleton.
  - `src/app/teacher/page.tsx` shows advisor/committee lifecycle guidance and schedule approval notification skeleton.
  - `src/app/admin/proposals/page.tsx` shows v2 PASS/REVISE/FAIL vote counts and Admin alert when FAIL votes are at least 50%.
  - `src/app/student/feedback/page.tsx` now reflects v2 Proposal visibility: comments visible immediately, teacher names visible, score hidden.
- Updated server actions:
  - Imported students now start at `STUDENT_PROFILE`.
  - Student project origin/advisor selection moves project to `PENDING_ADVISOR` and writes status history.
  - Proposal submission moves project to `PROPOSAL_PENDING` and writes status history.
  - Teacher score submission also writes `ProposalVote` with `PASS`/`REVISE`/`FAIL`.
  - Admin final proposal decision updates lifecycle status and writes `ProjectStatusHistory`.
- Added service files:
  - `src/lib/lifecycle/statusLabels.ts`
  - `src/lib/lifecycle/transitions.ts`
- Added tests in `src/lib/lifecycle/transitions.test.ts` for:
  - advisor reject returns `DRAFT`
  - advisor approve goes `PENDING_ADMIN`
  - admin confirm goes `PROPOSAL_PENDING`
  - proposal FAIL final decision returns `DRAFT` and keeps history
  - proposal PASS final decision goes `TOPIC_APPROVED`
  - FAIL vote ratio >= 50 creates Admin alert condition
  - schedule confirmed only when all committee approvals are `APPROVE`
  - advisor score remains locked until report is closed by advisor
- Exact command results:
  - `cmd /c npm.cmd run prisma:format` - passed
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run prisma:migrate -- --name lifecycle_v2` - migration applied; Prisma Client generation initially hit Windows `EPERM` file lock.
  - `cmd /c npx.cmd prisma generate` - first retry hit same `EPERM`; stopped stale Node worker processes and reran successfully.
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 15 tests
  - `cmd /c npm.cmd run build` - passed
- Remaining limitations:
  - No deep Progress 1 scoring UI.
  - No deep Progress 2 scoring UI.
  - No deep Final scoring UI.
  - No external committee magic link.
  - No full AUN-QA export.
  - Advisor/admin approval actions and schedule proposal forms are database-ready/skeleton-visible but not fully workflow-complete.

## 2026-05-06 Lifecycle v2 foundation verification

- Verification result: Lifecycle v2 foundation is complete for documentation, state model, Prisma schema, service rules, tests, and current skeleton visibility.
- Checked `PROJECT_SPEC.md`: contains all v2 statuses from `STUDENT_PROFILE` through `COMPLETED`.
- Checked `DATA_MODEL_DRAFT.md`: contains v2 addendum for profile, advisor request, status history, proposal votes, committee assignment, schedule proposal/approval, assessment submission, report version/review, advisor score, and notifications.
- Checked `prisma/schema.prisma`: supports:
  - `StudentProfile`
  - `AdvisorRequest`
  - `ProjectStatusHistory`
  - `ProposalVote` with `PASS` / `REVISE` / `FAIL`
  - `CommitteeAssignment` with `ADVISOR` / `HEAD` / `MEMBER` / `EXTERNAL_MEMBER`
  - `ExamScheduleProposal`
  - `ExamScheduleApproval`
  - `AssessmentSubmission`
  - `ReportVersion`
  - `ReportReview`
  - `AdvisorScore`
  - `Notification`
- Checked lifecycle service:
  - advisor reject returns `DRAFT`
  - advisor approve goes `PENDING_ADMIN`
  - admin confirm goes `PROPOSAL_PENDING`
  - proposal PASS final decision goes `TOPIC_APPROVED`
  - proposal FAIL final decision returns `DRAFT` and keeps history
  - FAIL vote ratio >= 50 triggers Admin alert condition
  - schedule confirms only when all committee approvals are `APPROVE`
  - advisor score lock rule exists
- Checked route foundation:
  - Student Proposal feedback route shows comments immediately from `ProposalVote`.
  - Proposal scores remain hidden from student feedback.
  - Teacher names are visible with Proposal comments.
  - Admin Proposal route uses FAIL vote alert condition.
- Missing item fixed:
  - Added explicit `AdvisorScore.reportClosedAt` field so the advisor "ปิดเล่ม" gate is database-ready, not just implied by `unlockedAt`.
  - Added stronger test case to keep advisor score locked when advisor closes report but not all reviewers have passed.
  - Added migration `prisma/migrations/20260506035154_advisor_score_report_closed_gate/migration.sql`.
- Commands run:
  - `cmd /c npm.cmd run prisma:format` - passed
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run prisma:migrate -- --name advisor_score_report_closed_gate` - passed after approved Prisma engine access
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 15 tests
  - `cmd /c npm.cmd run build` - passed
- Remaining limitations:
  - Detailed modern UI has not been implemented.
  - Full advisor/admin approval actions are not implemented yet.
  - Schedule proposal forms are not implemented yet.
  - No deep Progress 1 scoring.
  - No deep Progress 2 scoring.
  - No deep Final scoring.
  - No external committee magic link.
  - No full AUN-QA export.
- Validation after README/progress update:
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 7 tests
  - `cmd /c npm.cmd run build` - passed

## 2026-05-05 Local Docker PostgreSQL update

- Checked for `docker-compose.yml`; it did not exist.
- Added `docker-compose.yml` for local PostgreSQL development only.
- Added Thai README instructions for:
  - `docker compose up -d`
  - copying `.env.example` to `.env`
  - running migration
  - running seed
  - running dev server
- Confirmed no Progress 1, Progress 2, Final, external committee, or AUN-QA export implementation was added.
- Validation:
  - `cmd /c npm.cmd run prisma:format` - passed
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 7 tests
  - `cmd /c npm.cmd run build` - passed

## 2026-05-06 Local database setup

- Checked `.env` exists: passed.
- Checked `DATABASE_URL` is set: `.env` contains `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/project_assessment?schema=public"`.
- Attempted Docker status check with `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"`: blocked by Windows Docker API permission in the sandbox, but Prisma was able to connect to PostgreSQL through `localhost:5432`.
- Ran `cmd /c npm.cmd run prisma:migrate -- --name init`: first attempt failed with `P3015` because an old empty migration directory `prisma/migrations/20260505153000_init` existed without `migration.sql`.
- Fixed root cause by removing the empty migration directory only. No database reset or database deletion was performed.
- Reran `cmd /c npm.cmd run prisma:migrate -- --name init`: passed. Created and applied `prisma/migrations/20260506032223_init/migration.sql`; Prisma Client generated successfully.
- Ran `cmd /c npm.cmd run prisma:seed`: first sandboxed attempt failed while accessing Prisma engine download/check; rerun with approval passed.
- Ran `cmd /c npm.cmd run prisma:validate`: passed.
- Ran `cmd /c npm.cmd run typecheck`: passed.
- Ran `cmd /c npm.cmd test`: passed, 7 tests.
- Ran `cmd /c npm.cmd run build`: passed.
- Confirmed no Progress 1, Progress 2, Final, external committee, or AUN-QA export implementation was added.

## 2026-05-06 Lifecycle v2 guided UI update

- Implemented modern guided Lifecycle v2 UI skeletons with Thai labels and no empty placeholder pages.
- Reusable components added:
  - `StatusBadge`
  - `LifecycleStepper`
  - `NextActionCard`
  - `GuidancePanel`
  - `EmptyState`
  - `TimelineCard`
  - `TaskListCard`
  - `InfoAlert` / `WarningAlert` / `SuccessAlert`
  - `FormSection`
  - `MaterialLinkField`
  - `MarkdownLatexEditor`
  - `PageHeader`
- UI business logic added:
  - `getNextActionForStudent(status)`
  - `getNextActionForTeacher(tasks)`
  - `getNextActionForAdmin(projects)`
  - proposal student visibility helper for hidden score / visible comment + teacher name behavior.
- Routes updated or added:
  - `/`
  - `/admin`
  - `/admin/students`
  - `/admin/teachers`
  - `/admin/claims`
  - `/admin/proposals`
  - `/admin/committee`
  - `/student`
  - `/student/profile`
  - `/student/project`
  - `/student/proposal`
  - `/student/schedule`
  - `/student/report`
  - `/teacher`
  - `/teacher/advisor-requests`
  - `/teacher/proposals`
  - `/teacher/schedules`
  - `/teacher/reports`
  - `/teacher/scoring/[assignmentId]`
- Student UI now shows:
  - profile summary
  - project summary
  - lifecycle status badge
  - LifecycleStepper
  - next-action guidance
  - task checklist
  - advisor/proposal/schedule/report cards
  - timeline/evidence preview
  - Proposal comments visible immediately with teacher names while Proposal scores remain hidden.
- Teacher UI now shows:
  - account/role status
  - advisor request cards with 7-day warning
  - Proposal scoring task list
  - guided Proposal scoring page with grouped rubric, abstract preview, warnings, vote, and comment reminder
  - schedule approval skeleton
  - report review skeleton
  - advisor final gate and Advisor score 25% lock skeleton.
- Admin UI now shows:
  - top KPI cards
  - project status overview by Lifecycle v2 status
  - pending Admin confirmation action using `confirmProjectAdvisor`
  - proposal fail-ratio alert surface
  - committee assignment skeleton with advisor shown as ADVISOR
  - teacher/students management routes
  - recent evidence timeline.
- Tests added/updated:
  - next-action helpers for student/teacher/admin
  - proposal score hidden from student
  - proposal comment visible to student with teacher name
  - existing lifecycle tests continue covering FAIL ratio >= 50, schedule approval, advisor score lock, and status transitions.
- Commands run:
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 19 tests
  - `cmd /c npm.cmd run build` - passed, 26 routes generated
  - Started local dev server at `http://127.0.0.1:3000` for route verification access.
  - Checked required visible routes on the dev server with `Invoke-WebRequest`; all returned HTTP 200:
    `/`, `/admin`, `/admin/students`, `/admin/teachers`, `/admin/claims`, `/admin/proposals`, `/admin/committee`, `/student`, `/student/profile`, `/student/project`, `/student/proposal`, `/student/schedule`, `/student/report`, `/teacher`, `/teacher/advisor-requests`, `/teacher/proposals`, `/teacher/schedules`, `/teacher/reports`.
- Remaining limitations:
  - Progress 1 scoring UI remains skeleton only.
  - Progress 2 scoring UI remains skeleton only.
  - Final scoring UI remains skeleton only.
  - Schedule proposal and schedule approval buttons are UI-ready but not fully wired to mutation actions.
  - Report version submission, review PASS/FAIL mutation, report close action, and Advisor score submission are UI-ready skeletons only.
  - External committee magic links were not implemented.
  - Full AUN-QA export was not implemented.
  - Report/article numeric rubric scoring was not implemented.

## 2026-05-06 Development login and demo data

- Implemented development-only mock login/session support:
  - Added `/dev-login`.
  - Added red warning banner: `Development login only`.
  - Added role/user selection for Admin, Student, approved Teacher, and pending teacher claim state.
  - Added dev session cookie helper in `src/lib/auth/devSession.ts`.
  - Updated `src/auth.ts` so `auth()` reads the dev session only when `NODE_ENV=development`, while production continues to rely on Google/NextAuth.
  - Set local `.env` `INITIAL_ADMIN_EMAIL="dev.admin@sru.ac.th"` for development admin testing.
- Implemented demo seed:
  - Added `prisma/seed-demo.ts`.
  - Added `npm run prisma:seed:demo`.
  - Seeded `ภาคเรียนที่ 1 ปีการศึกษา 2568`.
  - Seeded `Mathematical Project Course`.
  - Seeded 11 internal teachers with development `@sru.ac.th` emails and linked dev users.
  - Seeded 3 demo students:
    - `65123456789 สมชาย ใจดี`
    - `65123456790 สมหญิง รักเรียน`
    - `65123456791 สมปอง ตั้งใจ`
  - Seeded projects in `DRAFT`, `PENDING_ADVISOR`, and `PROPOSAL_REVIEW`.
  - Seeded advisor requests, Proposal submission, Proposal vote/comment, evaluator assignments, profiles, and timeline events.
- Routes fixed for browser-visible testing:
  - `/student` now shows selected dev student name, status badge, lifecycle stepper, next action, cards, quick actions, and timeline.
  - `/teacher` now shows selected approved teacher name, profile/status card, next action, tasks, proposal tasks, notification/empty states.
  - `/admin` now shows admin dashboard cards, project overview, pending confirmations, proposal/admin guidance, and timeline.
- Browser-visible acceptance verification:
  - Restarted local dev server at `http://127.0.0.1:3000`.
  - Verified with real cookie-based dev sessions using `WebRequestSession`, not just unauthenticated HTTP 200.
  - Confirmed these routes returned visible expected content and were not guard-only pages:
    `/student`, `/teacher`, `/admin`, `/student/profile`, `/student/project`, `/student/proposal`, `/teacher/advisor-requests`, `/teacher/proposals`, `/admin/students`, `/admin/teachers`, `/admin/claims`, `/admin/proposals`, `/admin/committee`.
- Tests added:
  - `src/lib/auth/devSession.test.ts`
  - Covers dev login enabled only in development.
  - Covers selected student session data used by student dashboard.
  - Covers selected approved teacher session data and confirms it is not pending.
  - Covers pending teacher claim state.
- Commands run:
  - `cmd /c npm.cmd run prisma:seed:demo` - first sandboxed attempt failed with `spawn EPERM` from `tsx/esbuild`; reran with approval and passed.
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 23 tests
  - `cmd /c npm.cmd run build` - passed, 27 routes generated
- Remaining limitations:
  - Detailed Progress 1 scoring was not implemented.
  - Detailed Progress 2 scoring was not implemented.
  - Detailed Final scoring was not implemented.
  - External committee magic links were not implemented.
  - Full AUN-QA export was not implemented.
  - Numeric report/article scoring was not implemented.
  - Schedule approval/report/advisor score mutation actions remain skeleton-only.

## 2026-05-06 End-to-End Lifecycle Review

- Full Lifecycle v2 review completed against the local development PostgreSQL database only.
- Added automated lifecycle review command:
  - `tests/e2e/lifecycle-v2.ts`
  - `npm run e2e:lifecycle`
  - The runner refuses to execute unless `DATABASE_URL` contains `localhost` or `127.0.0.1`.
  - It creates an isolated E2E course offering instead of resetting or deleting the database.
- Added lifecycle review report:
  - `E2E_LIFECYCLE_REVIEW.md`
  - Final verdict: `PASS: simulated lifecycle completed`
- Workflow fixes made during the review:
  - `src/app/student/actions.ts`
    - Student project/origin submission now creates a pending `AdvisorRequest`.
    - Proposal submission now moves the project to `PROPOSAL_REVIEW`.
    - Proposal submission now creates required evaluator assignments for internal proposal teachers.
  - `src/app/teacher/actions.ts`
    - Added real advisor request approve/reject transition action.
    - Advisor approve moves project to `PENDING_ADMIN`.
    - Advisor reject moves project back to `DRAFT` and keeps status history.
    - Proposal score submission now requires an overall comment when submitting.
    - When all proposal assignments are submitted, the project can move to `PROPOSAL_ADMIN_DECISION`.
  - `src/app/teacher/advisor-requests/page.tsx`
    - Replaced disabled buttons with real approve/reject forms.
  - `src/app/admin/actions.ts`
    - Added real committee assignment action with HEAD/MEMBER/advisor validation.
    - Committee assignment moves project to `IN_PROGRESS`.
  - `src/app/admin/committee/page.tsx`
    - Replaced disabled committee save button with real assignment form.
- Lifecycle steps tested by `npm run e2e:lifecycle`:
  - Admin opens/selects `ภาคเรียนที่ 1 ปีการศึกษา 2568`.
  - Admin creates/selects `Mathematical Project Course`.
  - Admin imports demo students and verifies generated emails:
    - `65123456789@student.sru.ac.th`
    - `65123456790@student.sru.ac.th`
    - `65123456791@student.sru.ac.th`
  - Student dev-login scope verifies the selected student only sees their own E2E project.
  - Student profile completion unlocks `DRAFT`.
  - Student creates project, selects advisor, and sends advisor request.
  - Advisor approve path moves `PENDING_ADVISOR -> PENDING_ADMIN`.
  - Advisor reject path moves `PENDING_ADVISOR -> DRAFT` with history retained.
  - 7-day advisor reminder condition is created and detected.
  - Admin confirmation moves `PENDING_ADMIN -> PROPOSAL_PENDING`.
  - Proposal invalid material link is rejected.
  - Proposal Google Drive link is accepted.
  - Proposal submission moves `PROPOSAL_PENDING -> PROPOSAL_REVIEW`.
  - Three teachers score Proposal using a 100-point grouped checklist.
  - Proposal comments are visible immediately with teacher names.
  - Proposal scores remain hidden from the student.
  - FAIL vote ratio `>= 50%` creates an admin alert condition without auto-deciding.
  - Admin final PASS moves to `TOPIC_APPROVED`.
  - Admin final FAIL moves to `DRAFT` and keeps history.
  - Admin assigns advisor as `ADVISOR`, plus `HEAD` and `MEMBER`.
  - Committee assignment moves to `IN_PROGRESS`.
  - Progress 1 schedule reject path does not confirm.
  - Progress 1 approve-all path confirms schedule.
  - Progress 2 and Final Present skeleton submissions/schedules are recorded.
  - Final Present completion moves project to `FINAL_DONE`.
  - Report version 1 FAIL and version 2 PASS loop works.
  - Reviewer who already PASSed does not need to review the new report version.
  - All report reviewers PASS moves to `REPORT_APPROVED`.
  - Advisor score remains locked before advisor closes report.
  - Advisor clicks close report and advisor score unlocks.
  - Advisor score 25% is submitted.
  - Admin completes project and final status becomes `COMPLETED`.
  - Browser-visible route check verifies `/student`, `/teacher`, and `/admin` render with dev sessions and do not show guard-only pages.
- Commands run:
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 26 tests
  - `cmd /c npm.cmd run build` - passed, 27 routes generated
  - Started local route verification server with `npx.cmd next dev --turbo --hostname 127.0.0.1 --port 3000` because standard `next dev` hung on route compilation in this environment.
  - `cmd /c npm.cmd run e2e:lifecycle` - passed, 18 lifecycle steps
- Remaining limitations:
  - Later skeleton stages in the E2E runner use direct Prisma/service-level actions rather than full browser clicks for every Progress/Final/Report control.
  - Detailed Progress 1 scoring was not implemented.
  - Detailed Progress 2 scoring was not implemented.
  - Detailed Final scoring was not implemented.
  - External committee magic links were not implemented.
  - Full AUN-QA export was not implemented.
  - Numeric report/article scoring was not implemented.

## 2026-05-06 Beginner-friendly Turbo dev command

- Added reliable local dev server script:
  - `package.json`
  - `"dev:turbo": "next dev --turbo --hostname 127.0.0.1 --port 3000"`
- Kept existing `"dev": "next dev"` unchanged.
- Updated `README.md` in Thai:
  - If `npm run dev` hangs while compiling routes, use `npm run dev:turbo`.
  - Open `http://127.0.0.1:3000`.
  - UI smoke check now mentions either `npm run dev` or `npm run dev:turbo`.
- Business logic was not changed.
- Commands run:
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 26 tests
  - `cmd /c npm.cmd run build` - first attempt timed out while an old local dev server process was still listening on port 3000; stopped the local server process and reran successfully.
  - `cmd /c npm.cmd run build` - passed, 27 routes generated
- Remaining limitations:
  - Detailed Progress 1 scoring was not implemented.
  - Detailed Progress 2 scoring was not implemented.
  - Detailed Final scoring was not implemented.
  - External committee magic links were not implemented.
  - Full AUN-QA export was not implemented.
  - Numeric report/article scoring was not implemented.

## 2026-05-06 UI foundation repair

- Root cause diagnosed:
  - The project is using Tailwind CSS v3.4.17, and the Tailwind/PostCSS setup was basically compatible.
  - `src/app/layout.tsx` did import `./globals.css`.
  - The browser was showing raw/default UI because the dev server was serving HTML that referenced `/_next/static/css/app/layout.css?...`, but that CSS URL returned `404`.
  - This happened after running `next build` while the dev server was still running; production build output rewrote `.next` and left the running dev server with stale/missing CSS assets.
  - The original Tailwind content glob was also broad but incomplete versus the requested app/components/lib paths, so it was tightened.
- Files fixed:
  - `tailwind.config.ts`
    - Updated content paths to explicitly include:
      - `./src/app/**/*.{js,ts,jsx,tsx,mdx}`
      - `./src/components/**/*.{js,ts,jsx,tsx,mdx}`
      - `./src/lib/**/*.{js,ts,jsx,tsx,mdx}`
  - `src/app/globals.css`
    - Rebuilt Tailwind v3 global CSS foundation with `@tailwind base`, `@tailwind components`, and `@tailwind utilities`.
    - Added Thai-friendly font stack, slate page background, readable default text, link reset, styled forms, panels, buttons, stat cards, and app shell/container classes.
  - `src/app/layout.tsx`
    - Rebuilt root layout with clean Thai metadata, sticky styled header/nav, dev-login shortcut in development, and `PageShell`.
  - Added UI foundation components:
    - `src/components/ui/PageShell.tsx`
    - `src/components/ui/SectionCard.tsx`
    - `src/components/ui/Button.tsx`
    - `src/components/ui/FormControls.tsx`
  - `README.md`
    - Added UI smoke check checklist for `/admin`, `/student`, and `/teacher`.
  - `src/components/ui/uiFoundation.test.ts`
    - Added tests that verify Tailwind directives, layout CSS import/PageShell use, and Tailwind content paths.
- Routes visually fixed by the global CSS/layout foundation:
  - `/`
  - `/admin`
  - `/admin/students`
  - `/admin/teachers`
  - `/admin/claims`
  - `/admin/proposals`
  - `/admin/committee`
  - `/student`
  - `/student/profile`
  - `/student/project`
  - `/student/proposal`
  - `/student/schedule`
  - `/student/report`
  - `/teacher`
  - `/teacher/advisor-requests`
  - `/teacher/proposals`
  - `/teacher/schedules`
  - `/teacher/reports`
- Browser/CSS verification:
  - Restarted local dev server after `next build`.
  - Confirmed `/_next/static/css/app/layout.css?...` returns HTTP 200.
  - Confirmed CSS length is `78900` bytes and contains generated `.panel`, `.button-secondary`, and background-color rules.
  - Confirmed `/admin`, `/student`, and `/teacher` return Tailwind classes and are not guard-only pages under dev sessions.
- Commands run:
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 26 tests
  - `cmd /c npm.cmd run build` - passed, 27 routes generated
- Remaining limitations:
  - Detailed Progress 1 scoring was not implemented.
  - Detailed Progress 2 scoring was not implemented.
  - Detailed Final scoring was not implemented.
  - External committee magic links were not implemented.
  - Full AUN-QA export was not implemented.
  - Numeric report/article scoring was not implemented.
  - Schedule approval/report/advisor score mutation actions remain skeleton-only.

## 2026-05-06 UX workflow-awareness cleanup

- UX problems fixed:
  - Admin Proposal final decision now shows visible Thai success feedback after save.
  - Admin Proposal round close now shows "ปิดรอบแล้ว", a closed timestamp based on the updated round time, and disables the close button.
  - Admin Proposal Summary was refocused on proposal decision data only: student, title, project status, submitted/missing counts, PASS/REVISE/FAIL counts, FAIL ratio, average score, final decision, and collapsible details.
  - Teacher claims are kept on `/admin/claims` with clearer copy: "คำขอผูกบัญชีอาจารย์" and guidance explaining that this only links @sru.ac.th Google accounts to seeded teacher profiles.
  - Student dashboard now groups actions into `available_now`, `read_only_history`, `locked_future`, and `blocked_waiting_for`, so completed/future stages are not presented as primary editable actions.
  - Progress/Final schedule cards now show workflow states such as "ยังไม่ถึงขั้นตอน", "ดำเนินการได้ตอนนี้", "รอกรรมการอนุมัติวันสอบ", "ส่งเอกสารแล้ว", and "ดูย้อนหลัง".
  - Important actions now use disabled/pending submit states and confirmations for close round, final decision, and committee assignment.
- Files changed:
  - `src/components/ui/ActionFeedback.tsx`
  - `src/components/ui/SubmitButton.tsx`
  - `src/app/admin/actions.ts`
  - `src/app/admin/page.tsx`
  - `src/app/admin/claims/page.tsx`
  - `src/app/admin/committee/page.tsx`
  - `src/app/admin/proposals/page.tsx`
  - `src/app/student/actions.ts`
  - `src/app/student/page.tsx`
  - `src/app/student/profile/page.tsx`
  - `src/app/student/project/page.tsx`
  - `src/app/student/proposal/page.tsx`
  - `src/app/student/schedule/page.tsx`
  - `src/app/teacher/actions.ts`
  - `src/app/teacher/advisor-requests/page.tsx`
  - `src/app/teacher/scoring/[assignmentId]/page.tsx`
  - `src/lib/lifecycle/nextActions.ts`
  - `src/lib/lifecycle/nextActions.test.ts`
  - `src/app/admin/proposals/proposalSummaryUx.test.ts`
  - `src/components/ui/actionFeedback.test.tsx`
  - `UX_WORKFLOW_REVIEW.md`
- Tests added:
  - Action feedback renders Thai success/error messages.
  - Proposal Summary page excludes teacher claims and includes visible closed/final-decision UX markers.
  - Student available actions depend on lifecycle status.
  - Completed assessment cards become read-only and future assessments are locked.
- Commands run:
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run typecheck` - initial parallel run hit stale `.next/types` while build regenerated Next files; rerun passed
  - `cmd /c npm.cmd test` - passed, 32 tests
  - `cmd /c npm.cmd run build` - passed, 27 routes generated
  - `cmd /c npm.cmd run e2e:lifecycle` - first run passed steps 1-17 but route visibility hit a stale local server on port 3000; rerun with a temporary local Next dev server passed all 18 steps
- Remaining limitations:
  - Detailed Progress 1 scoring was not implemented.
  - Detailed Progress 2 scoring was not implemented.
  - Detailed Final scoring was not implemented.
  - External committee magic links were not implemented.
  - Full AUN-QA export was not implemented.
  - Numeric report/article scoring was not implemented.
  - Later Progress/Final/Report mutation workflows remain skeleton-level where they were already skeleton-level.

## 2026-05-06 AssessmentRound closed timestamp fix

- Fixed the unreliable closed timestamp:
  - Added explicit `AssessmentRound.closedAt` mapped to `closed_at`.
  - Added explicit `AssessmentRound.closedByAdminId` mapped to `closed_by_admin_id`.
  - Added `AssessmentRound.closedByAdmin` relation to `User` and `User.closedAssessmentRounds`.
  - Added migration `prisma/migrations/20260506070000_assessment_round_closed_at/migration.sql`.
- Updated close Proposal round action:
  - Uses `buildCloseAssessmentRoundData(adminUserId)`.
  - Sets `status = SCORING_CLOSED`.
  - Sets `closedAt = current timestamp`.
  - Sets `closedByAdminId = current admin user`.
  - Keeps the existing success redirect message `ปิดรอบ Proposal แล้ว`.
- Updated Admin Proposal Summary:
  - Displays `round.closedAt`, never `round.updatedAt`, as `closed_at`.
  - Displays `closed_by` when the closing admin user is available.
  - If a legacy closed round has `closedAt = null`, it shows a clear no-timestamp message instead of a fake timestamp.
  - Keeps visible closed badge and disabled close button.
- Tests added/updated:
  - `src/lib/assessments/roundClosure.test.ts` verifies closing data includes `closedAt` and `closedByAdminId`.
  - `src/app/admin/proposals/proposalSummaryUx.test.ts` verifies the UI uses `closedAt`, includes `closedByAdmin`, and does not render `round.updatedAt.toLocaleString`.
- Commands run:
  - `cmd /c npm.cmd run prisma:format` - passed
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npx.cmd prisma generate` - passed, required after schema change
  - `cmd /c npm.cmd run typecheck` - initial parallel run hit stale `.next/types` while build regenerated Next files; rerun passed
  - `cmd /c npm.cmd test` - passed, 34 tests
  - `cmd /c npm.cmd run build` - passed, 27 routes generated
  - `cmd /c npm.cmd run prisma:migrate -- --skip-generate` - first sandboxed attempt could not fetch/check Prisma schema engine; rerun with approval passed and applied `20260506070000_assessment_round_closed_at`
  - `cmd /c npm.cmd run e2e:lifecycle` - passed all 18 lifecycle steps with a temporary local Next dev server
- Remaining limitations:
  - Detailed Progress 1 scoring was not implemented.
  - Detailed Progress 2 scoring was not implemented.
  - Detailed Final scoring was not implemented.
  - External committee magic links were not implemented.
  - Full AUN-QA export was not implemented.
  - Numeric report/article scoring was not implemented.
## 2026-05-06 Duplicate demo data and course-level rounds fix

- Fixed duplicate-looking Admin dashboard data by selecting one current project per `courseOfferingId + studentId` and adding a dev-only duplicate warning.
- Changed `AssessmentRound` from project-like/name-scoped uniqueness to course-level uniqueness: `courseOfferingId + roundType`.
- Added `ProjectRoundException` for per-project exceptions under a shared course-level round.
- Updated default seed, demo seed, and E2E lifecycle setup to upsert/reuse course-level rounds for Proposal, Progress 1, Progress 2, and Final Presentation.
- Reworked lifecycle E2E to use stable `e2e-lifecycle-course-offering`, clean only known local demo/E2E records, and assert reruns keep exactly 3 E2E projects plus one Proposal round.
- Added safe local cleanup/reset scripts:
  - `npm run prisma:seed:demo:clean`
  - `cmd /c npm.cmd run dev:reset-demo`
- Added Admin dashboard course round cards and exception counts.
- Tests added:
  - `src/lib/admin/dashboardProjects.test.ts`
  - `src/lib/assessments/courseRounds.test.ts`
  - `src/app/admin/adminDashboardUx.test.ts`
  - `tests/e2e/lifecycleSeedSafety.test.ts`
- Commands run:
  - `cmd /c npm.cmd run prisma:format`
  - `cmd /c npm.cmd run prisma:validate`
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
  - `cmd /c npm.cmd run e2e:lifecycle` twice
- Remaining limitation:
  - E2E route visibility check is non-blocking because local Next dynamic routes can timeout; database lifecycle and duplicate guards remain enforced.
## 2026-05-06 Course-level Progress 1 opening flow

- Added `/admin/rounds` for course-level round management across Proposal, Progress 1, Progress 2, and Final Presentation.
- Added `openCourseRound` and `closeCourseRound` server actions; opening Progress 1 uses `upsert` on `courseOfferingId + roundType`, so repeated opens do not create duplicate rows.
- Added `getRoundEligibility(courseOfferingId, roundType)` and Progress 1 readiness checks:
  - Proposal final decision must be PASS.
  - Committee must include ADVISOR, HEAD, and MEMBER.
  - Blocking project exceptions keep projects in not-ready list.
- Updated `/admin` to show round status and the next recommended action after Proposal closes.
- Updated `/admin/proposals` to show a next-action panel after Proposal is closed.
- Updated `/admin/committee` to link to the Progress 1 opening page after committee save.
- Updated `/student/schedule` so Progress 1 scheduling stays locked until the course-level Progress 1 round is open and the project is eligible.
- Tests added:
  - `src/lib/assessments/roundEligibility.test.ts`
  - `src/app/admin/rounds/roundsUx.test.ts`
- E2E updated:
  - Verifies closing Proposal does not auto-open Progress 1.
  - Opens one course-level Progress 1 round before scheduling.
  - Verifies duplicate Progress 1 rounds are not created.
- Commands run:
  - `cmd /c npm.cmd run prisma:format`
  - `cmd /c npm.cmd run prisma:validate`
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
  - `cmd /c npm.cmd run e2e:lifecycle`
- Remaining limitation:
  - Progress 1 scoring remains intentionally unimplemented; this only opens/closes the course-level window and gates scheduling.
## 2026-05-06 Desktop-first responsive UI pass

- Added responsive UI foundation rules in `src/app/globals.css`:
  - mobile stacked cards
  - 44px-ish touch targets via `min-h-11`
  - no horizontal body overflow
  - responsive table/card behavior under 640px
  - mobile-friendly full-width buttons
- Updated app header/nav to stack cleanly on phones while staying desktop-friendly.
- Updated shared UI components:
  - `PageHeader` stacks actions on mobile.
  - `NextActionCard` primary action is full-width on mobile.
  - `TaskListCard` uses button-style task links.
  - `StatusBadge` has larger touch/readability height.
- Updated high-risk pages:
  - `/admin/proposals`, `/admin/students`, `/admin/teachers` use `responsive-table`.
  - `/teacher/scoring/[assignmentId]` uses collapsible rubric groups, larger checkbox rows, sticky score/action affordances.
  - `/student/proposal` keeps the submit action visible on long mobile forms.
  - `/teacher/proposals`, `/teacher/schedules`, `/admin/claims` stack action controls on mobile.
- Added `RESPONSIVE_UI_REVIEW.md` with desktop/mobile/tablet manual checklist.
- Updated `UX_WORKFLOW_REVIEW.md` with desktop/mobile acceptance notes.
- Tests added/updated:
  - `src/app/responsiveUiSource.test.ts`
  - `src/components/ui/uiFoundation.test.ts`
- Commands run:
  - `cmd /c npm.cmd run prisma:validate`
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
  - `cmd /c npm.cmd run e2e:lifecycle`
- Remaining limitation:
  - Automated visual viewport screenshots were not added; manual responsive checklist is provided.

## 2026-05-06 Markdown + LaTeX workflow restoration

- Added reusable Markdown/LaTeX components:
  - `src/components/ui/MarkdownLatexEditor.tsx` with live preview, Thai helper text, disabled/read-only support, and mobile-friendly layout.
  - `src/components/ui/MarkdownLatexViewer.tsx` using `react-markdown`, `remark-math`, `rehype-katex`, and `rehype-sanitize`.
- Kept KaTeX CSS imported globally in `src/app/layout.tsx` and added mobile overflow handling for long equations in `src/app/globals.css`.
- Updated real workflow inputs to accept Markdown + LaTeX:
  - Student project/origin long explanation fields.
  - Student Proposal abstract, motivation, objectives, methods, outcomes, timeline, and questions.
  - Student schedule/report skeleton notes.
  - Teacher Proposal reason/comment, advisor request comment, schedule comment, report/advisor comments.
- Updated read-only/feedback displays to render Markdown + LaTeX safely:
  - Student Proposal comments.
  - Student Feedback Proposal comments/reasons.
  - Student Report review comments.
  - Teacher Proposal scoring submission details.
  - Admin Proposal summary comments/final reasons.
- Added development check page: `/dev/latex-test`.
- Added tests:
  - `src/components/ui/markdownLatex.test.ts`
  - inline math rendering
  - display math rendering
  - raw `<script>` safety
  - workflow source checks for Student Proposal, Teacher scoring comment, and Student feedback score hiding
- Updated E2E lifecycle data so Proposal abstract and teacher comment include LaTeX, and asserted the LaTeX teacher comment is stored as student-visible feedback while Proposal score remains hidden.
- Commands run:
  - `cmd /c npm.cmd run prisma:validate`
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
  - `cmd /c npm.cmd run e2e:lifecycle`
- Remaining limitation:
  - Progress 1/2/Final scoring remains intentionally unimplemented; only skeleton notes/comments now support Markdown + LaTeX.

## 2026-05-06 Duplicate data and course-level round management cleanup

- Verified schema constraints already enforce:
  - one current `Project` per `courseOfferingId + studentId`
  - one course-level `AssessmentRound` per `courseOfferingId + roundType`
  - one project attempt per `projectId + assessmentRoundId + attemptNo`
- Confirmed demo seed and E2E lifecycle use stable IDs and upsert/reuse course-level rounds instead of creating per-project rounds.
- Tightened Admin dashboard UX:
  - dashboard shortcut now sends Admin to `/admin/rounds`
  - old duplicate/disabled round card section is hidden behind an opt-in legacy flag and not shown by default
  - current project list still deduplicates by student/course before rendering status groups
- Strengthened tests:
  - `src/app/admin/rounds/roundsUx.test.ts` now checks the open action uses `assessmentRound.upsert` and does not create project-level rounds.
  - `src/app/admin/adminDashboardUx.test.ts` now checks the dashboard links course-level round management to `/admin/rounds`.
- Updated docs:
  - `PROJECT_SPEC.md`
  - `DATA_MODEL_DRAFT.md`
  - `README.md`
- Commands run:
  - `cmd /c npm.cmd run prisma:format`
  - `cmd /c npm.cmd run prisma:validate`
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
  - `cmd /c npm.cmd run e2e:lifecycle`
  - `cmd /c npm.cmd run e2e:lifecycle` again
  - local Prisma count query after second E2E: `projects = 3`, each of `PROPOSAL`, `PROGRESS_1`, `PROGRESS_2`, `FINAL_PRESENTATION` has `_count = 1`
- Remaining limitation:
  - Progress 1/2/Final scoring remains intentionally unimplemented; round management only opens/closes the course-level windows and gates skeleton scheduling.

## 2026-05-06 Real-login pilot auth hardening

- Verified and tightened pilot role resolution:
  - `INITIAL_ADMIN_EMAIL` is normalized and is the only Google email that resolves to `ADMIN`.
  - Other `@sru.ac.th` users resolve to `PENDING_TEACHER` unless their teacher profile email is linked after Admin-approved claim.
  - Approved linked teacher emails resolve to `TEACHER`.
  - Imported `{student_code}@student.sru.ac.th` emails resolve to `STUDENT`.
  - Non-imported `@student.sru.ac.th` emails are denied.
- Hardened auth/dev-login UX:
  - Linked teacher email sets are trimmed/lowercased before role resolution.
  - Home page dev-login guidance now uses `isDevLoginEnabled()` instead of any non-production environment.
  - Existing dev-login server actions remain guarded by `NODE_ENV=development`.
- Tests added:
  - `src/lib/auth/roleResolution.test.ts`
  - `src/app/authPilotSource.test.ts`
- Docs added:
  - `SECURITY_REVIEW.md`
  - `PRODUCTION_CHECKLIST.md`
- Commands run:
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 19 test files / 67 tests
  - `cmd /c npm.cmd run build` - passed, 29 routes generated
  - `cmd /c npm.cmd run e2e:lifecycle` - passed lifecycle/database checks; route visibility check remained non-blocking because fetch to the local server was skipped by the script
- Remaining limitations:
  - Detailed Progress 1 scoring was not implemented.
  - Detailed Progress 2 scoring was not implemented.
  - Detailed Final scoring was not implemented.
  - External magic links were not implemented.
  - Full AUN-QA export was not implemented.
  - Production deployment was not performed.
  - Numeric report scoring was not implemented.

## 2026-05-06 Protected route/action auth audit

- Audited protected pages and server actions after the real-login pilot update.
- Verified Admin-only pages/actions use Admin guards and reject teacher/student/pending/unauthorized users.
- Verified teacher work pages/actions require approved `TEACHER`; pending teacher accounts are limited to the claim flow.
- Verified student pages/actions require `STUDENT` and now also explicitly stop when the session email is not found in imported `Student.generatedEmail` roster data.
- Fixed guard hygiene:
  - `src/auth.ts` now normalizes Google email once before role resolution and user upsert.
  - `/student/origin`, `/student/project`, `/student/proposal`, `/student/schedule`, `/student/report`, and `/student/feedback` now show a roster-missing state for student-role sessions that do not match imported students.
  - `/student/project` no longer loads teacher options before the imported student/project record is confirmed.
- Added focused guard audit test:
  - `src/app/authGuardAudit.test.ts`
- Commands run:
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 20 test files / 72 tests
  - `cmd /c npm.cmd run build` - passed, 29 routes generated
  - `cmd /c npm.cmd run e2e:lifecycle` - passed lifecycle/database checks; route visibility check remained non-blocking because fetch to the local server was skipped by the script
- Remaining limitations:
  - No lifecycle workflow changes were made.
  - No scheduling/scoring/report features were implemented.
  - Detailed Progress 1 scoring, Progress 2 scoring, Final scoring, external magic links, full AUN-QA export, production deployment, and numeric report scoring remain intentionally unimplemented.

## 2026-05-06 Phase 2A scheduling and Progress 1 scoring

- Fixed the scheduling data path to use course-level `AssessmentRound` records:
  - `ExamScheduleProposal` now stores `courseOfferingId`, `assessmentRoundId`, `roundType`, optional `note`, and a unique `projectId + assessmentRoundId` key.
  - Student schedule submits update the existing project/round schedule instead of creating duplicate active schedule rows.
  - E2E schedule helpers now upsert schedules and approvals under the shared course-level round.
- Implemented Phase 2A self-scheduling UI/action:
  - `/student/schedule` shows Progress 1 / Progress 2 / Final Presentation round state, locked reasons, submitted requests, and Markdown/LaTeX notes.
  - `submitExamSchedule` enforces server-side student ownership, imported roster access, `IN_PROGRESS` status, open course-level round, valid date/time, and no Proposal scheduling.
  - Progress 1 scheduling checks committee readiness and the course-level Progress 1 round gate.
- Added Teacher/Admin schedule visibility:
  - `/teacher/schedules` shows schedules relevant to advisor/committee teachers and rejects pending teacher claims through existing teacher guards.
  - `/admin/schedules` shows all submitted schedule requests for the course offering.
- Added minimal Progress 1 scoring:
  - `/teacher/progress1` lets active HEAD/MEMBER teachers save Progress 1 scores only for assigned `IN_PROGRESS` projects.
  - Server action validates ranges, computes total server-side, stores scorer identity, upserts the attempt/evaluator/score rows, and supports Markdown/LaTeX comments.
  - Rubric weights: progress 30, problem-solving 20, research/results 20, presentation 20, overall 10.
- `/student` robustness:
  - Source audit confirms the route fails closed for unauthenticated/unauthorized users, imported students without current projects get an empty next-action state, and imported students with projects get the normal dashboard.
  - The previous optional E2E route visibility fetch did not reproduce a 500 in this run; with a local dev server attempt it timed out because the dev server process became unresponsive, while lifecycle/database E2E completed successfully.
- Tests added/updated:
  - `src/lib/scheduling/scheduleRules.test.ts`
  - `src/lib/scoring/progress1Scoring.test.ts`
  - `src/app/scheduleProgressSource.test.ts`
  - `src/app/authGuardAudit.test.ts`
- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260506100000_schedule_round_links/migration.sql`
  - `src/app/student/actions.ts`
  - `src/app/student/schedule/page.tsx`
  - `src/app/teacher/actions.ts`
  - `src/app/teacher/page.tsx`
  - `src/app/teacher/schedules/page.tsx`
  - `src/app/teacher/progress1/page.tsx`
  - `src/app/admin/schedules/page.tsx`
  - `src/components/ui/ActionFeedback.tsx`
  - `src/lib/scheduling/scheduleRules.ts`
  - `src/lib/scoring/progress1Scoring.ts`
  - `tests/e2e/lifecycle-v2.ts`
- Commands run:
  - `cmd /c npm.cmd run prisma:format` - passed
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 23 test files / 81 tests
  - `cmd /c npm.cmd run build` - passed, 31 routes generated
  - `cmd /c npm.cmd run e2e:lifecycle` - passed twice; second/third runs kept 3 projects and one course-level round per major type
- Remaining limitations:
  - Progress 1 scoring is functional, but no Progress 1 completion/grade-release automation was added.
  - At that time, Progress 2 scoring, Final scoring, report approval loop implementation changes, Advisor score 25% changes, external magic links, full AUN-QA export, production deployment, and numeric report scoring remained intentionally out of scope.

## 2026-05-06 Progress 2 scoring

- Implemented Progress 2 scoring by reusing the Progress 1 scoring pattern.
- Added `/teacher/progress2`:
  - Approved teachers only.
  - Active `HEAD` / `MEMBER` committee assignments only.
  - Shows a safe empty/setup state if no course-level Progress 2 round is available.
  - Uses the same five scoring criteria: progress 30, problem-solving 20, research/results 20, presentation 20, overall 10.
  - Supports Markdown/LaTeX comments through the existing safe editor.
- Added `submitProgress2Score`:
  - Validates ranges server-side.
  - Computes total server-side.
  - Uses the existing course-level `AssessmentRound` where `roundType = PROGRESS_2`.
  - Upserts `AssessmentAttempt`, `EvaluatorAssignment`, `ScoreSubmission`, and `ScoreItem` to avoid duplicate records for the same scorer/project/round.
  - Records a `PROGRESS_2_SCORE_SUBMITTED` timeline event.
  - Does not advance lifecycle, mark `FINAL_DONE`, jump to report review, or change proposal state.
- Updated HTTP route visibility checks to include `/teacher/progress2`.
- Tests added/updated:
  - Progress 2 rubric validation in `src/lib/scoring/progress1Scoring.test.ts`.
  - Progress 2 source guard/duplicate-safety checks in `src/app/scheduleProgressSource.test.ts`.
  - Route guard audit includes `src/app/teacher/progress2/page.tsx`.
- Files changed:
  - `src/lib/scoring/progress1Scoring.ts`
  - `src/app/teacher/actions.ts`
  - `src/app/teacher/progress2/page.tsx`
  - `src/app/teacher/page.tsx`
  - `src/components/ui/ActionFeedback.tsx`
  - `src/app/authGuardAudit.test.ts`
  - `src/app/scheduleProgressSource.test.ts`
  - `src/lib/scoring/progress1Scoring.test.ts`
  - `tests/e2e/lifecycle-v2.ts`
- Commands run:
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 23 test files / 84 tests
  - `cmd /c npm.cmd run build` - passed, 32 routes generated
  - `cmd /c npm.cmd run e2e:lifecycle` - passed with `/teacher/progress2` route visibility
- Remaining limitations:
  - Progress 1 / Progress 2 scoring are functional, but completion/release automation was not added.
  - At that time, Final scoring, report approval loop implementation changes, Advisor score 25% changes, external magic links, full AUN-QA export, production deployment, and numeric report scoring remained intentionally out of scope.

## 2026-05-06 Documentation consistency audit before Final scoring

- Audited current workflow/status documentation:
  - `IMPLEMENTATION_PROGRESS.md`
  - `PROJECT_SPEC.md`
  - `DATA_MODEL_DRAFT.md`
  - `E2E_LIFECYCLE_REVIEW.md`
  - `UX_WORKFLOW_REVIEW.md`
  - `SECURITY_REVIEW.md`
  - `RESPONSIVE_UI_REVIEW.md`
  - `CODEX_TASKS.md`
  - `AGENTS.md`
- Confirmed current implementation direction:
  - Lifecycle v2 remains the only active workflow.
  - `AssessmentRound` remains course-level with one row per `courseOfferingId + roundType`.
  - Self-scheduling uses project-level schedule proposals under course-level rounds.
  - Progress 1 / Progress 2 scoring are functional for assigned HEAD/MEMBER teachers.
  - Real-login pilot, teacher claim approval, imported student roster access, and development-only dev login remain unchanged.
  - Proposal comments remain visible to students while proposal scores remain hidden.
  - Duplicate prevention remains based on `Project(courseOfferingId, studentId)` and `AssessmentRound(courseOfferingId, roundType)`.
- Stale documentation fixed:
  - `PROJECT_SPEC.md` no longer says Progress 1 / Progress 2 scoring are unimplemented.
  - `DATA_MODEL_DRAFT.md` now states Progress 1 / Progress 2 both reuse the existing assessment scoring tables.
  - `UX_WORKFLOW_REVIEW.md` and `RESPONSIVE_UI_REVIEW.md` now treat Progress 1 / Progress 2 scoring as part of the current baseline.
  - `E2E_LIFECYCLE_REVIEW.md` now describes embedded HTTP route visibility checks instead of optional dev route fetches.
- Unresolved ambiguity documented:
  - `AGENTS.md` and `CODEX_TASKS.md` still describe the original MVP 1 / Proposal-only starting point. They are retained as historical task guidance; the current baseline and roadmap are governed by `PROJECT_SPEC.md`, `IMPLEMENTATION_PROGRESS.md`, and the latest user task.

## 2026-05-06 Final Presentation scoring

- Implemented Final Presentation scoring using the established Progress scoring architecture.
- Added `/teacher/final`:
  - Approved teachers only.
  - Active `HEAD` / `MEMBER` committee assignments only.
  - Shows a safe setup/empty state if no course-level Final Presentation round is available.
  - Uses the existing safe Markdown/LaTeX comment editor.
- Added `submitFinalPresentationScore`:
  - Uses the existing course-level `AssessmentRound` where `roundType = FINAL_PRESENTATION`.
  - Does not create per-project rounds.
  - Validates rubric ranges server-side.
  - Computes total server-side.
  - Upserts `AssessmentAttempt`, `EvaluatorAssignment`, `ScoreSubmission`, and `ScoreItem` to avoid duplicate score records for the same scorer/project/round.
  - Records `FINAL_PRESENTATION_SCORE_SUBMITTED` timeline events.
  - Does not mark `FINAL_DONE`, start `REPORT_REVIEW`, mark `COMPLETED`, or unlock Advisor score automatically.
- Final rubric handling:
  - Research/results 30
  - Execution/problem-solving 20
  - Presentation 20
  - Overall 10
  - Raw rubric total is 80; stored `ScoreSubmission.totalScore` is normalized as `raw / 80 * 100`.
  - No hidden remaining criterion was added.
- Tests added/updated:
  - `src/lib/scoring/finalScoring.test.ts`
  - `src/app/scheduleProgressSource.test.ts`
  - `src/app/authGuardAudit.test.ts`
  - `tests/e2e/lifecycle-v2.ts`
- Files changed:
  - `src/lib/scoring/finalScoring.ts`
  - `src/app/teacher/actions.ts`
  - `src/app/teacher/final/page.tsx`
  - `src/app/teacher/page.tsx`
  - `src/components/ui/ActionFeedback.tsx`
  - `src/app/authGuardAudit.test.ts`
  - `src/app/scheduleProgressSource.test.ts`
  - `src/lib/scoring/finalScoring.test.ts`
  - `tests/e2e/lifecycle-v2.ts`
  - `PROJECT_SPEC.md`
  - `DATA_MODEL_DRAFT.md`
  - `E2E_LIFECYCLE_REVIEW.md`
  - `UX_WORKFLOW_REVIEW.md`
  - `RESPONSIVE_UI_REVIEW.md`
  - `SECURITY_REVIEW.md`
- Commands run:
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 24 test files / 87 tests
  - `cmd /c npm.cmd run build` - passed, 33 routes generated
  - `cmd /c npm.cmd run e2e:lifecycle` - passed with `/teacher/final` route visibility
- Remaining roadmap at that time:
  - Report approval loop
  - Advisor score 25%
  - Later production/deployment tasks

## 2026-05-06 HTTP route visibility QA

- Improved the lifecycle E2E route visibility step so it performs real HTTP checks against a local Next server instead of skipping when no external dev server is running.
- The route check now covers:
  - `/student/schedule`
  - `/teacher/schedules`
  - `/teacher/progress1`
  - `/admin/schedules`
- Verified role behavior over HTTP:
  - Imported student can access `/student/schedule`.
  - Approved teacher can access `/teacher/schedules` and `/teacher/progress1`.
  - Admin can access `/admin/schedules`.
  - Pending teacher cannot see teacher schedule/progress scoring content.
  - Student cannot see teacher/admin schedule or Progress 1 scoring content.
  - Anonymous user cannot see student schedule data.
- The HTTP check uses an Auth.js session cookie generated with `next-auth/jwt`, not the development-login cookie, so production dev-login restrictions remain intact.
- Bugs found:
  - Previous optional route check could skip due to a missing/unresponsive external dev server.
  - A production-mode HTTP check initially rejected the test host; the E2E server now sets `AUTH_TRUST_HOST=true` only inside the route-check process.
- Fixes applied:
  - `tests/e2e/lifecycle-v2.ts` starts an embedded production-mode Next server after `next build`.
  - Route visibility failures now fail the E2E step instead of being reported as a non-blocking skip.
- Commands run:
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 23 test files / 81 tests
  - `cmd /c npm.cmd run build` - passed, 31 routes generated
  - `cmd /c npm.cmd run e2e:lifecycle` - passed with HTTP route visibility checks

## 2026-05-06 Report approval loop

- Pre-check result:
  - Reused existing `ReportVersion` and `ReportReview` models.
  - Existing `/student/report` and `/teacher/reports` were skeleton pages; no parallel report system was added.
  - No Prisma schema change was required.
- Implemented student report submission:
  - `/student/report` now submits a Google Drive/Docs/Classroom report link with optional Markdown/LaTeX note.
  - Submission is allowed at `FINAL_DONE`.
  - First submission moves the project to `REPORT_REVIEW`.
  - Resubmission is allowed only when the latest report version has a `FAIL` review / revision request.
  - `REPORT_APPROVED`, `ADVISOR_SCORING`, and `COMPLETED` block resubmission.
- Implemented teacher report review:
  - `/teacher/reports` now shows assigned report projects and latest report version.
  - Approved teachers only; pending teachers and students are blocked by page/action guards.
  - Advisor or active `HEAD`/`MEMBER` may review.
  - Teachers can approve (`PASS`) or request revision (`FAIL`) with Markdown/LaTeX comments.
  - `ReportReview` is upserted by `reportVersionId + reviewerTeacherId`, so repeat saves update instead of creating duplicates.
  - Active `HEAD`/`MEMBER` approvals are required for `REPORT_APPROVED`; a reviewer who already passed an earlier version remains counted, matching the existing lifecycle review behavior.
- Lifecycle behavior:
  - `FINAL_DONE` -> student report submission -> `REPORT_REVIEW`.
  - Teacher `FAIL` keeps the project in `REPORT_REVIEW` and lets the student submit a new version.
  - Required reviewer `PASS` completion moves the project to `REPORT_APPROVED`.
  - The loop stops at `REPORT_APPROVED`; it does not move to `ADVISOR_SCORING` or `COMPLETED`.
- Duplicate/history handling:
  - New report submissions increment `ReportVersion.versionNo`.
  - Optional student notes are stored as `ProjectTimelineEvent` entries linked to the `ReportVersion`.
  - Teacher comments remain in `ReportReview`.
- Tests added/updated:
  - `src/lib/reports/reportWorkflow.test.ts`
  - `src/app/reportWorkflowActions.test.ts`
  - `tests/e2e/lifecycle-v2.ts` now includes HTTP checks for `/student/report` and `/teacher/reports`.
- Files changed:
  - `src/lib/reports/reportWorkflow.ts`
  - `src/app/student/actions.ts`
  - `src/app/student/report/page.tsx`
  - `src/app/teacher/actions.ts`
  - `src/app/teacher/reports/page.tsx`
  - `src/components/ui/ActionFeedback.tsx`
  - `src/lib/reports/reportWorkflow.test.ts`
  - `src/app/reportWorkflowActions.test.ts`
  - `tests/e2e/lifecycle-v2.ts`
  - `PROJECT_SPEC.md`
  - `DATA_MODEL_DRAFT.md`
  - `E2E_LIFECYCLE_REVIEW.md`
  - `UX_WORKFLOW_REVIEW.md`
  - `SECURITY_REVIEW.md`
- Commands run:
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 26 test files / 95 tests
  - `cmd /c npm.cmd run build` - passed, 33 routes generated
  - `cmd /c npm.cmd run e2e:lifecycle` - passed with `/student/report` and `/teacher/reports` route visibility
- Remaining roadmap:
  - Advisor score 25%
  - Final closeout / completion workflow
  - Production deployment preparation

## 2026-05-06 Advisor score 25%

- Pre-check result:
  - Reused the existing `AdvisorScore` model instead of creating an advisor-specific assessment round.
  - Existing `AdvisorScore` stored only total/comment/status, so rubric score columns were added to keep the 25% component auditable.
  - Existing `AssessmentRound` remains course-level only and is not used for Advisor score.
- Data model changes:
  - Added migration `prisma/migrations/20260506104500_advisor_score_rubric_fields/migration.sql`.
  - Added nullable Advisor rubric fields to `AdvisorScore`:
    - `responsibilityScore`
    - `researchProcessScore`
    - `problemSolvingScore`
    - `communicationScore`
    - `professionalismScore`
  - `AdvisorScore.projectId` remains unique, preventing duplicate advisor score rows per project.
- Implemented Advisor score workflow:
  - Added `/teacher/advisor-score`.
  - Added `submitAdvisorScore`.
  - Only approved `TEACHER` users can access the route/action.
  - Only the project advisor can submit; HEAD/MEMBER are rejected unless they are also advisor.
  - Available only for `REPORT_APPROVED` or existing `ADVISOR_SCORING` projects.
  - First submission from `REPORT_APPROVED` moves the project to `ADVISOR_SCORING`.
  - Re-submission updates the same `AdvisorScore` row.
  - Submission does not mark the project `COMPLETED`.
- Rubric:
  - Responsibility / punctuality: 25
  - Research process and independence: 25
  - Problem-solving and improvement: 25
  - Communication with advisor: 15
  - Overall professionalism: 10
  - Stored total is a 100-point raw Advisor score; final 25% weighting remains for later aggregation.
- Tests added/updated:
  - `src/lib/scoring/advisorScoring.test.ts`
  - `src/app/advisorScoreSource.test.ts`
  - `src/app/authGuardAudit.test.ts`
  - `tests/e2e/lifecycle-v2.ts`
- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260506104500_advisor_score_rubric_fields/migration.sql`
  - `src/lib/scoring/advisorScoring.ts`
  - `src/app/teacher/actions.ts`
  - `src/app/teacher/advisor-score/page.tsx`
  - `src/app/teacher/page.tsx`
  - `src/components/ui/ActionFeedback.tsx`
  - `src/lib/scoring/advisorScoring.test.ts`
  - `src/app/advisorScoreSource.test.ts`
  - `src/app/authGuardAudit.test.ts`
  - `src/app/reportWorkflowActions.test.ts`
  - `tests/e2e/lifecycle-v2.ts`
  - `PROJECT_SPEC.md`
  - `DATA_MODEL_DRAFT.md`
  - `E2E_LIFECYCLE_REVIEW.md`
  - `UX_WORKFLOW_REVIEW.md`
  - `SECURITY_REVIEW.md`
  - `RESPONSIVE_UI_REVIEW.md`
- Commands run:
  - `cmd /c npm.cmd run prisma:format` - passed
  - `cmd /c npm.cmd run prisma:migrate -- --skip-generate` - initial advisory lock timeout; re-run with `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` timed out but migration status later showed database up to date
  - `cmd /c npx.cmd prisma migrate status` - passed, database schema up to date
  - `cmd /c npx.cmd prisma generate` - passed after stopping stale workspace Node/Prisma processes that held the engine file
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 28 test files / 100 tests
  - `cmd /c npm.cmd run build` - passed, 34 routes generated
  - `cmd /c npm.cmd run e2e:lifecycle` - passed with `/teacher/advisor-score` route visibility
- Remaining roadmap:
  - Final closeout / completion workflow
  - Production deployment preparation

## 2026-05-06 Final closeout / completion workflow

- Pre-check result:
  - No existing app-level closeout action/page existed; lifecycle E2E was simulating `COMPLETED` directly.
  - Reused existing `AssessmentAttempt` / `ScoreSubmission`, `ReportVersion` / `ReportReview`, `AdvisorScore`, `ProjectStatusHistory`, and `ProjectTimelineEvent` models.
  - No Prisma schema change was needed.
- Completion eligibility:
  - Added `getCompletionEligibility(projectId)` and pure `evaluateCompletionEligibility`.
  - A project can become `COMPLETED` only when:
    - current state is `ADVISOR_SCORING`
    - Progress 1 score exists
    - Progress 2 score exists
    - Final Presentation score exists
    - report approval evidence exists
    - Advisor score exists
    - latest report version has no unresolved revision request
- Admin closeout:
  - Added `/admin/closeout`.
  - Added Admin-only `completeProjectCloseout`.
  - The action re-checks eligibility server-side before updating status.
  - Eligible closeout writes `ProjectStatusHistory`, `ProjectTimelineEvent`, and `AuditLog`.
  - Completed projects are refused on repeated closeout attempts, preventing duplicate completion history.
- UX updates:
  - Admin dashboard links closeout work to `/admin/closeout`.
  - Student `ADVISOR_SCORING` wording is neutral: waiting for Admin closeout.
  - Success feedback key `project_completed` added.
- Tests added/updated:
  - `src/lib/lifecycle/completionEligibility.test.ts`
  - `src/app/closeoutSource.test.ts`
  - `src/app/authGuardAudit.test.ts`
  - `src/lib/lifecycle/nextActions.test.ts`
  - `tests/e2e/lifecycle-v2.ts`
- Files changed:
  - `src/lib/lifecycle/completionEligibility.ts`
  - `src/lib/lifecycle/completionEligibility.test.ts`
  - `src/app/admin/actions.ts`
  - `src/app/admin/closeout/page.tsx`
  - `src/app/closeoutSource.test.ts`
  - `src/app/authGuardAudit.test.ts`
  - `src/app/admin/page.tsx`
  - `src/components/ui/ActionFeedback.tsx`
  - `src/lib/lifecycle/nextActions.ts`
  - `src/lib/lifecycle/nextActions.test.ts`
  - `src/lib/lifecycle/statusLabels.ts`
  - `tests/e2e/lifecycle-v2.ts`
  - `PROJECT_SPEC.md`
  - `E2E_LIFECYCLE_REVIEW.md`
  - `UX_WORKFLOW_REVIEW.md`
  - `SECURITY_REVIEW.md`
  - `RESPONSIVE_UI_REVIEW.md`
- Commands run:
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 30 test files / 111 tests
  - `cmd /c npm.cmd run build` - passed, 35 routes generated
  - `cmd /c npm.cmd run e2e:lifecycle` - initial run correctly failed because the E2E script lacked Progress/Final score evidence for the new closeout eligibility check; after adding existing scoring evidence records, re-run passed with `/admin/closeout` route visibility
- Remaining roadmap:
  - Production deployment preparation
  - Real Google OAuth credential test
  - Supabase/Vercel setup
  - Final security production review

## 2026-05-06 Protected route/action auth audit follow-up

- Re-audited protected routes, server actions, and the single API handler after the real-login pilot update.
- Audited areas:
  - Admin pages: `/admin`, `/admin/claims`, `/admin/committee`, `/admin/import-students`, `/admin/proposals`, `/admin/rounds`, `/admin/students`, `/admin/teachers`.
  - Admin actions: academic setup, student import, project/advisor confirmation, teacher claim review, Proposal close, course round open/close, final decision, committee assignment, feedback release.
  - Teacher pages/actions: dashboard, claim flow, advisor requests, proposal tasks/scoring, schedules, reports.
  - Student pages/actions: dashboard, profile, origin/project, proposal, schedule, report, feedback.
  - API handlers: only `/api/auth/[...nextauth]` is present; business mutations are server actions.
- Gaps found and fixed:
  - Approved `TEACHER` accounts could still access the teacher claim route/action and create a new pending claim. Restricted `/teacher/claim` and `claimTeacherProfile` to `PENDING_TEACHER` only.
  - `src/auth.ts` did not check `User.active` before attaching session role claims. Inactive users now lose `token.role` / `token.appUserId` and fail protected route guards.
- Tests updated:
  - `src/app/authGuardAudit.test.ts` now checks pending-only teacher claim access and active-user session enforcement.
- Files changed:
  - `src/auth.ts`
  - `src/app/teacher/actions.ts`
  - `src/app/teacher/claim/page.tsx`
  - `src/app/authGuardAudit.test.ts`
  - `SECURITY_REVIEW.md`
  - `IMPLEMENTATION_PROGRESS.md`
- Commands run:
  - `cmd /c npm.cmd run prisma:validate` - passed
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 20 test files / 72 tests
  - `cmd /c npm.cmd run build` - passed, 29 routes generated
  - `cmd /c npm.cmd run e2e:lifecycle` - passed lifecycle/database checks; route visibility fetch remains a non-blocking skip in the script (`/student` returned 500 during the optional route check).
- Remaining limitations:
  - No lifecycle workflow changes were made.
  - No scheduling/scoring/report features were implemented.
  - Detailed Progress 1 scoring, Progress 2 scoring, Final scoring, external magic links, full AUN-QA export, production deployment, and numeric report scoring remain intentionally unimplemented.
## 2026-05-06 Stabilization / hardening review

- Documentation alignment:
  - Added current-baseline notes to `PROJECT_SPEC.md`, `DATA_MODEL_DRAFT.md`, `CODEX_TASKS.md`, `AGENTS.md`, `README.md`, and `RUBRICS_CHECKLIST.md`.
  - Updated `PRODUCTION_CHECKLIST.md` and added `DEPLOYMENT_NOTES.md` for environment variables, migration flow, demo-data safety, and first-pilot order.
- Lifecycle and retry safety fixes:
  - Proposal and course round close actions now reject already-closed rounds server-side instead of rewriting `closedAt` or creating duplicate close events.
  - Admin final Proposal decision now records the current project status as the transition `fromStatus`.
  - Admin closeout now uses a conditional `updateMany` guard on `ADVISOR_SCORING` before writing completion history, reducing double-submit/race duplicate completion evidence.
  - Student Project Origin now requires advisor selection before moving to `PENDING_ADVISOR`.
  - Student Proposal submission now requires the course-level Proposal round to be open server-side.
  - Report approval now refuses to approve while the latest report version still has an active revision request.
- Security/data integrity fixes:
  - Admin teacher-claim review now rejects claims that are no longer `PENDING`.
  - No schema or migration changes were made.
- Tests updated:
  - Added/updated focused source and unit coverage for closeout idempotency guard, close-round guard, report latest-revision approval gate, Proposal open gate, and advisor-required Project Origin submission.
- Validation:
  - Pending in this stabilization pass.

## 2026-05-06 Production readiness preparation

- Added centralized production environment validation in `src/lib/config/env.ts`.
- Added `npm run preflight:production` via `scripts/validate-production-env.ts`.
- Added `npm run start` for production startup and `npm run prisma:deploy` for production migration deployment.
- Hardened Auth.js config:
  - Google OAuth credentials are read through centralized config.
  - Production runtime now fails fast with a clear error if required env vars are missing.
  - `AUTH_SECRET` is passed to Auth.js, while `NEXTAUTH_SECRET` remains supported for compatibility.
  - Login action validates production env before starting Google sign-in, preventing the previous blank `client_id` Google error path.
- Updated `.env.example`, `README.md`, `PRODUCTION_CHECKLIST.md`, and `DEPLOYMENT_NOTES.md` with production env names, OAuth callback examples, Supabase/Vercel migration order, and smoke-test steps.
- No schema or lifecycle workflow changes were made.

## 2026-05-13 Teacher workload UX stabilization

- Completed the post Wave 1 teacher workload audit and queue design notes.
- Added a shared `TeacherWorkloadQueue` UI component for queue summaries, badges, grouped sections, and compact queue rows.
- Patched teacher-facing workload pages without changing core business logic:
  - `/teacher/schedules` now surfaces pending schedule approvals before confirmed calendar content.
  - `/teacher/proposals` separates pending Proposal scoring from submitted/read-only work.
  - `/teacher/progress1`, `/teacher/progress2`, and `/teacher/final` show compact queue summaries and jump links before long scoring forms.
  - `/teacher/reports` orders report review work by actionable, returned, waiting, completed, and locked states.
  - `/teacher/advisor-score` orders advisor-score work by actionable, waiting, completed, and locked states.
- Added source coverage in `src/app/teacher/teacherWorkloadUxSource.test.ts`.
- Validation:
  - `cmd /c npm.cmd test -- src/app/teacher/teacherWorkloadUxSource.test.ts` - passed
  - `cmd /c npm.cmd run typecheck` - passed
  - `cmd /c npm.cmd test` - passed, 78 test files / 322 tests
  - `cmd /c npm.cmd run build` - passed, 35 routes generated
- No auth, lifecycle, scoring, round eligibility, Prisma schema, or production changes were made.
- Remaining before closing this stabilization pass:
  - Push QA preview only.
  - Live verify teacher workload pages with the existing Wave 1 QA state.

## 2026-05-13 Full UI redesign loop started

- Created/used the redesign planning pack under `e2e-artifacts/redesign-mapping/`.
- Confirmed branch `qa-preview` at baseline commit `01ed9e2`.
- Created local safety tag `wave2-stable-before-redesign` before code changes.
- Started Phase 1 by refining the shared teacher workload UI surface:
  - `TeacherWorkloadQueue` now has a stronger operational summary, action-total callout, tone rails, and denser compact queue rows.
  - Global CSS adds matching teacher workload/queue utility classes using the existing red/paper theme.
  - `/teacher` now uses the same shared workload summary before its existing action queue.
- Added a non-mutating Edge/CDP verification helper for the redesigned teacher workload pages under `e2e-artifacts/redesign-mapping/`.
- Pushed QA preview only and live-verified the teacher workload redesign on `https://system-project-math-sci-gn79zo76m-lordtd-hubs-projects.vercel.app`.
- The live verification explicitly selects the teacher role dropdown before selecting the teacher identity, preventing the repeated QA-login role mismatch issue.
- Verified `/teacher`, `/teacher/schedules`, `/teacher/proposals`, `/teacher/progress1`, `/teacher/progress2`, `/teacher/final`, `/teacher/reports`, and `/teacher/advisor-score` render the shared workload summary without shell-only/error pages.
- No lifecycle, auth, scoring, eligibility, schema, API, or production changes were made.
- Validation for this redesign cycle passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`

## 2026-05-13 Full UI redesign loop - teacher subpages

- Continued Phase 2 teacher subpage redesign after the shared teacher workload foundation.
- `/teacher/schedules` now separates action, waiting, returned, and completed schedule states, with a compact approval queue before long approval cards.
- `/teacher/proposals` now adds compact navigation for pending Proposal review cards.
- Progress 1, Progress 2, Final, Report review, Advisor score, Proposal review, and schedule approval detail cards now share the same `teacher-review-card` presentation surface.
- No auth, lifecycle, scoring, eligibility, schema, server action, API, or production changes were made.
- Validation:
  - `cmd /c npm.cmd run typecheck` - passed after build regenerated `.next/types`.
  - `cmd /c npm.cmd test -- teacher` - passed, 5 files / 17 tests.
  - `cmd /c npm.cmd test` - passed, 81 files / 344 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
- Pushed QA preview only and live-verified teacher pages on `https://system-project-math-sci-9czostjk1-lordtd-hubs-projects.vercel.app`.
- The teacher verifier now fails fast if QA login does not produce an authorized teacher dashboard, preventing the recurring role-dropdown mismatch from being mistaken for a valid page check.
- Continued with the teacher mobile pass on `https://system-project-math-sci-g5enipsvz-lordtd-hubs-projects.vercel.app`.
- Extended the teacher verifier with a 390px mobile viewport mode and horizontal overflow guard.
- Mobile live verification passed for `/teacher`, `/teacher/schedules`, `/teacher/proposals`, `/teacher/progress1`, `/teacher/progress2`, `/teacher/final`, `/teacher/reports`, and `/teacher/advisor-score` with no detected horizontal overflow.
- Added `TEACHER_VERIFY_KEY` support to the teacher verifier and completed a non-mutating teacher boundary check with `teacher-delta` on the same QA preview.
- Teacher redesign can proceed to Admin redesign; mutating teacher workflow regression remains intentionally deferred to a safe action window.

## 2026-05-13 Full UI redesign loop - admin entry audit

- Continued the redesign loop into Phase 3 Admin redesign after teacher desktop/mobile verification.
- Audited the current Admin implementation and confirmed that the previous operational UX stabilization already provides the main redesign patterns:
  - `/admin` uses action-first dashboard queues and compact workflow counters.
  - `/admin/rounds` uses operational round summaries, eligibility buckets, and separated danger-zone actions.
  - `/admin/closeout`, `/admin/proposals`, `/admin/schedules`, and `/admin/evidence` use admin operational summaries or grouped queue sections.
- Added `e2e-artifacts/redesign-mapping/verify-admin-redesign-cdp.js` for non-mutating Admin live verification.
- The Admin verifier clears any existing QA session before switching roles, explicitly selects the role dropdown as admin, and verifies desktop/mobile route rendering without shell-only pages or horizontal overflow.
- Validation:
  - `cmd /c npm.cmd test -- admin` - passed, 16 files / 63 tests.
  - `cmd /c npm.cmd test -- dashboardClarity` - passed, 1 file / 3 tests.
  - `node --check e2e-artifacts/redesign-mapping/verify-admin-redesign-cdp.js` - passed.
  - `cmd /c npm.cmd test -- adminOperational dashboardClarity` - passed, 2 files / 8 tests.
- Live QA verification passed on `https://system-project-math-sci-1thdur8ic-lordtd-hubs-projects.vercel.app` for `/admin`, `/admin/rounds`, `/admin/closeout`, `/admin/proposals`, `/admin/schedules`, and `/admin/evidence` at desktop and 390px mobile width.
- No lifecycle, auth, scoring, eligibility, schema, server action, API, or production changes were made.
- Next phase: Student redesign audit and conservative student UI pass.

## 2026-05-13 Full UI redesign loop - student entry patch

- Continued into Phase 4 Student redesign after Admin entry verification.
- Audited the real student pages and found that `/student`, `/student/schedule`, `/student/report`, and `/student/feedback` already have action/waiting/read-only summaries.
- Added conservative `StudentReadabilitySummary` sections to the remaining long form-heavy student pages:
  - `/student/project`
  - `/student/proposal`
- Added `e2e-artifacts/redesign-mapping/verify-student-redesign-cdp.js` for non-mutating student route verification after QA deploy.
- Updated `src/app/student/studentReadabilityStabilization.test.ts` to cover the new project/proposal summary surfaces.
- Validation:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test -- studentReadability` - passed, 1 file / 6 tests.
  - `cmd /c npm.cmd test` - passed, 81 files / 346 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
  - `node --check e2e-artifacts/redesign-mapping/verify-student-redesign-cdp.js` - passed.
- No lifecycle, auth, scoring, eligibility, schema, server action, API, or production changes were made.
- Live QA verification passed on `https://system-project-math-sci-4pvh39ven-lordtd-hubs-projects.vercel.app` for `/student`, `/student/project`, `/student/proposal`, `/student/schedule`, `/student/report`, and `/student/feedback` at desktop and 390px mobile width.
- Global non-mutating desktop/mobile regression passed on `https://system-project-math-sci-66nqpox8d-lordtd-hubs-projects.vercel.app` across Teacher, Admin, and Student route groups.
- The teacher verifier was patched to clear existing QA sessions before selecting `#role = teacher`, matching the safer role-dropdown handling already used by the Admin and Student verifiers.
- Correction: this work should be described as a UX/readability stabilization baseline, not the final Figma visual redesign. The app is safer and clearer, but it does not yet visually match the Figma mockups.
- Added `e2e-artifacts/redesign-mapping/FIGMA_VISUAL_REDESIGN_NEXT_PLAN.md` to define the real next visual pass.
- Next step: decide whether to run the Figma Visual Redesign Implementation Pass before Wave 2, or use the stabilized UI as the Wave 2 baseline and keep visual alignment as a separate pass. Mutating workflow regression remains deferred to a safe action window.

## 2026-05-13 Figma visual redesign - safe fallback foundation

- Started the dedicated Figma Visual Redesign Implementation Pass.
- Added a presentation-only `classic` / `figma` UI mode foundation:
  - production remains `classic` unless explicitly allowed;
  - QA can switch modes through a cookie-backed mode switch;
  - the existing stabilized role navigation remains available as the classic fallback.
- Added the first shared visual shell and surface primitives under `src/components/redesign/`.
- Updated Admin, Teacher, and Student layouts so the page data fetching, guards, actions, and route semantics stay owned by the existing pages while the layout can switch presentation mode.
- Added source-level tests covering production fallback, role layout switching, and the shared Figma shell/surface classes.
- Validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- figmaUiMode`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Pushed QA preview only at commit `a9de656`.
- Live QA preview: `https://system-project-math-sci-mfn23sfkb-lordtd-hubs-projects.vercel.app`.
- Live smoke verification passed:
  - default `classic` mode remains available;
  - `figma` mode renders the new role shell;
  - switching back to `classic` removes the Figma shell;
  - Admin route smoke checks rendered without shell-only/digest pages.
- No lifecycle, auth, scoring, eligibility, Prisma schema, server action, API, or production config semantics were changed.
- This is the visual-mode foundation only. Page-level `Classic...View` / `Figma...View` renderers remain the next implementation step before the app can be called visually aligned with Figma.

## 2026-05-13 Figma visual redesign - teacher dashboard renderer entry

- Continued the Figma Visual Redesign Implementation Pass into Phase 4 Teacher redesign.
- Added the first page-level renderer branch on `/teacher`:
  - classic mode keeps the existing dashboard body as the direct fallback;
  - figma mode renders `FigmaTeacherDashboardView` with the same server-derived props.
- The Figma teacher dashboard now uses the shared visual primitives for header, KPI cards, action-first queue rows, schedule rows, proposal review rows, and notification panels.
- Page ownership remains unchanged: data fetching, auth/capability guards, links, forms, and server actions stay in `src/app/teacher/page.tsx`.
- No auth, lifecycle, scoring, eligibility, schema, API, server action, route, or production configuration semantics were changed.
- Validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- teacher`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Next step: deploy this renderer patch to QA, live-verify `/teacher` in classic and figma mode, then continue the teacher subpage renderer split starting with `/teacher/schedules`.
- Live QA on `https://system-project-math-sci-lirwkespy-lordtd-hubs-projects.vercel.app` found a Major shell-only regression after UI mode switching.
- Stabilization patch:
  - `setUiModeAction` redirects back to the current route after setting the UI mode cookie.
  - `/teacher` classic fallback returns the original JSX directly.
- Re-validation after stabilization passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- figmaUiMode teacherDashboardSource`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`

## 2026-05-13 Figma visual redesign - teacher schedules renderer

- Continued Phase 4 Teacher redesign with `/teacher/schedules`.
- Added a page-level `figma` renderer branch while keeping the existing schedule page body as the `classic` fallback.
- The Figma schedules view uses the shared visual primitives for KPI cards, action-first approval queue, waiting/returned grouping, two-column review detail, and confirmed schedule list.
- Preserved the existing schedule query, authorization guard, `reviewExamSchedule` server action, approve/reject form fields, rejection comment requirement, and Markdown/KaTeX note rendering.
- No auth, lifecycle, scoring, eligibility, schema, server action, API, route, or production configuration semantics were changed.
- Validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- teacher`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Pushed QA preview only at commit `4a275d9`.
- Live QA preview: `https://system-project-math-sci-hmhz7pteq-lordtd-hubs-projects.vercel.app`.
- Live verification passed for `/teacher/schedules` in both `classic` and `figma` modes:
  - classic fallback rendered the existing stabilized schedule page;
  - figma mode rendered the Figma shell, schedule KPI cards, and current confirmed schedule rows;
  - no shell-only, digest/application error, or unauthorized teacher guard appeared.
- Edge verification note: the Figma reference tab remains open. CDP checks should activate the QA tab before layout assertions because hidden tabs can temporarily keep streamed content in a hidden Suspense container.

## 2026-05-13 Figma visual redesign - teacher proposals renderer

- Continued Phase 4 Teacher redesign with `/teacher/proposals`.
- Added a page-level `figma` renderer branch while keeping the existing Proposal review page as the `classic` fallback.
- The Figma Proposal view uses shared visual primitives for KPI cards, action-first Proposal queue, completed/read-only queue, and Project Review Detail-style two-column rows.
- Preserved the existing Proposal attempt query, teacher capability guard, scoring assignment links, `openProposalScoring` server action form, hidden `attempt_id` field, and route semantics.
- No auth, lifecycle, scoring, eligibility, schema, server action, API, route, or production configuration semantics were changed.
- Validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- teacher`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Next step: push QA preview, live-verify `/teacher/proposals` in both classic and figma mode, then continue the teacher subpage renderer split with `/teacher/progress1`.
- Pushed QA preview only at commit `0c4ae56`.
- Live QA preview: `https://system-project-math-sci-2vdne1hl7-lordtd-hubs-projects.vercel.app`.
- Live verification passed for `/teacher/proposals` in both `classic` and `figma` modes:
  - classic fallback rendered the existing stabilized Proposal review page;
  - figma mode rendered the Figma shell, Proposal page surface, and 5 KPI cards;
  - current QA state had no Proposal action rows, so the Figma empty state was expected;
  - no shell-only, digest/application error, or unauthorized teacher guard appeared.
- Next step: continue Phase 4 with `/teacher/progress1`.

## 2026-05-13 Figma visual redesign - teacher Progress 1 renderer

- Continued Phase 4 Teacher redesign with `/teacher/progress1`.
- Added a page-level `figma` renderer branch while keeping the existing Progress 1 scoring page as the `classic` fallback.
- The Figma Progress 1 view uses shared visual primitives for KPI cards, action-first scoring queue, and a Project Review Detail-style two-column composition.
- Preserved the existing Progress 1 project query, teacher capability guard, `submitProgress1Score` server action, hidden `project_id` field, rubric inputs, Markdown+KaTeX evidence viewer, Markdown feedback editor, and confirmation submit button.
- No auth, lifecycle, scoring, eligibility, schema, server action, API, route, Markdown+KaTeX, or production configuration semantics were changed.
- Local validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- teacher`
- Full validation also passed:
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Pushed QA preview only at commit `41f6967`.
- Live QA preview: `https://system-project-math-sci-g80tv9wrj-lordtd-hubs-projects.vercel.app`.
- Live verification passed for `/teacher/progress1` in both `classic` and `figma` modes:
  - classic fallback rendered the existing stabilized Progress 1 page;
  - figma mode rendered the Figma shell, Progress 1 page surface, and 5 KPI cards;
  - current QA state had no Progress 1 scoring rows, so the Figma empty state was expected;
  - no shell-only, digest/application error, or unauthorized teacher guard appeared.
- Next step: continue Phase 4 with `/teacher/progress2`.

## 2026-05-13 Figma visual redesign - teacher Progress 2 renderer

- Continued Phase 4 Teacher redesign with `/teacher/progress2`.
- Added a page-level `figma` renderer branch while keeping the existing Progress 2 scoring page as the `classic` fallback.
- The Figma Progress 2 view uses shared visual primitives for KPI cards, action-first scoring queue, and a Project Review Detail-style two-column composition.
- Preserved the existing Progress 2 round lookup, project query, teacher capability guard, no-round empty state, `submitProgress2Score` server action, hidden `project_id` field, rubric inputs, Markdown+KaTeX evidence viewer, Markdown feedback editor, and confirmation submit button.
- No auth, lifecycle, scoring, eligibility, schema, server action, API, route, Markdown+KaTeX, or production configuration semantics were changed.
- Local validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- teacher`
- Full validation also passed:
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Pushed QA preview only at commit `bc5d750`.
- Live QA preview: `https://system-project-math-sci-iobd4wbwc-lordtd-hubs-projects.vercel.app`.
- Live verification passed for `/teacher/progress2` in both `classic` and `figma` modes:
  - classic fallback rendered the existing stabilized Progress 2 page;
  - figma mode rendered the Figma shell, Progress 2 page surface, and 5 KPI cards;
  - current QA state had no Progress 2 scoring rows, so the Figma empty state was expected;
  - no shell-only, digest/application error, or unauthorized teacher guard appeared.
- Next step: continue Phase 4 with `/teacher/final`.

## 2026-05-14 Figma visual redesign - teacher Final renderer

- Continued Phase 4 Teacher redesign with `/teacher/final`.
- Added a page-level `figma` renderer branch while keeping the existing Final scoring page as the `classic` fallback.
- The Figma Final view uses shared visual primitives for KPI cards, action-first scoring queue, and a Project Review Detail-style two-column composition.
- Preserved the existing Final round lookup, project query, teacher capability guard, no-round empty state, evidence continuity panel, Final QA rubric panel, `submitFinalPresentationScore` server action, hidden `project_id` field, `condition_count` select fields, Markdown feedback editor, and confirmation submit button.
- No auth, lifecycle, scoring, required reviewer completion, eligibility, schema, server action, API, route, evidence continuity, or production configuration semantics were changed.
- Local validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- teacher`
- Full validation also passed:
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Pushed QA preview only at commit `202d825`.
- Live QA preview: `https://system-project-math-sci-hm6cz5z28-lordtd-hubs-projects.vercel.app`.
- Live verification passed for `/teacher/final` in both `classic` and `figma` modes:
  - classic fallback rendered the existing stabilized Final scoring page;
  - figma mode rendered the Figma shell, Final page surface, and 5 KPI cards;
  - current QA state had no Final scoring rows, so the Figma empty state was expected;
  - no shell-only, digest/application error, login fallback, or unauthorized teacher guard appeared.
- Next step: continue Phase 4 with `/teacher/reports`.

## 2026-05-14 Figma visual redesign - teacher Reports renderer

- Continued Phase 4 Teacher redesign with `/teacher/reports`.
- Added a page-level `figma` renderer branch while keeping the existing report review page as the `classic` fallback.
- The Figma Reports view uses shared visual primitives for KPI cards, action-first report queue, and a Project Review Detail-style two-column composition.
- Preserved the existing report query, teacher capability guard, latest-version review logic, required reviewer checks, revision request state, `reviewReportVersion` server action, hidden `report_version_id` field, PASS/FAIL decision buttons, Markdown+KaTeX history viewer, Markdown feedback editor, and confirmation submit buttons.
- No auth, lifecycle, report latest-version semantics, advisor-score unlock, schema, server action, API, route, Markdown+KaTeX, or production configuration semantics were changed.
- Local validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- teacher`
- Full validation also passed:
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Pushed QA preview only at commit `ce29c9d`.
- Live QA preview: `https://system-project-math-sci-525grp3qo-lordtd-hubs-projects.vercel.app`.
- Live verification passed for `/teacher/reports` in both `classic` and `figma` modes:
  - classic fallback rendered the existing stabilized report review page;
  - figma mode rendered the Figma shell, Reports page surface, and 5 KPI cards;
  - current QA state had no report review rows/forms, so the Figma empty state was expected;
  - no shell-only, digest/application error, login fallback, or unauthorized teacher guard appeared.
- Next step: continue Phase 4 with `/teacher/advisor-score`.

## 2026-05-14 Figma visual redesign - teacher Advisor Score renderer

- Continued Phase 4 Teacher redesign with `/teacher/advisor-score`.
- Added a page-level `figma` renderer branch while keeping the existing Advisor Score page as the `classic` fallback.
- The Figma Advisor Score view uses shared visual primitives for KPI cards, action-first advisor-score queue, and a Project Review Detail-style two-column composition.
- Preserved the existing project query, teacher capability guard, advisor-score unlock condition, submitted-score read-only state, `submitAdvisorScore` server action, hidden `project_id` field, `advisorCriteria` field mapping, Markdown+KaTeX comment viewer, Markdown feedback editor, and confirmation submit button.
- No auth, lifecycle, advisor-score unlock, scoring calculation, schema, server action, API, route, Markdown+KaTeX, or production configuration semantics were changed.
- Local validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- teacher`
- Full validation also passed:
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Pushed QA preview only at commit `2a1c062`.
- Live QA preview: `https://system-project-math-sci-2vcb55iii-lordtd-hubs-projects.vercel.app`.
- Live verification passed for `/teacher/advisor-score` in both `classic` and `figma` modes:
  - classic fallback rendered the existing stabilized Advisor Score page;
  - figma mode rendered the Figma shell, Advisor Score page surface, 5 KPI cards, 3 advisor-score rows, and 3 review layouts;
  - current QA state had no editable advisor-score forms for the signed-in teacher, so read-only/locked states were expected;
  - no shell-only, digest/application error, login fallback, or unauthorized teacher guard appeared.
- Teacher subpage renderer split is now complete.
- Next step: start the teacher mobile/regression pass.

## 2026-05-14 Figma visual redesign - teacher mobile overflow patch

- Started the teacher mobile pass on the latest QA preview at 390px in Figma mode.
- Checked `/teacher`, `/teacher/schedules`, `/teacher/proposals`, `/teacher/progress1`, `/teacher/progress2`, `/teacher/final`, `/teacher/reports`, and `/teacher/advisor-score`.
- All checked pages rendered without shell-only pages, digest/application errors, login fallback, or clipped actions.
- Found a shared 4px horizontal overflow caused by the base mobile negative horizontal margin on `.figma-role-shell`.
- Patched `src/app/globals.css` to remove the base mobile negative horizontal margin while keeping the wider breakpoint margins.
- Logic touched: no. CSS-only.
- Validation:
  - `cmd /c npm.cmd test` passed.
  - `cmd /c npm.cmd run build` passed.
  - `cmd /c npm.cmd run typecheck` passed after rerun.
- Note: one typecheck attempt failed while `next build` was simultaneously regenerating `.next/types`; rerunning after build completed passed.
- Next step: push QA preview, rerun teacher 390px mobile audit, then continue teacher regression verification.

## 2026-05-14 Figma visual redesign - teacher mobile/regression pass complete

- Pushed QA preview only at commit `c142965`.
- Live QA preview: `https://system-project-math-sci-c2f2cvutx-lordtd-hubs-projects.vercel.app`.
- Re-ran the teacher Figma mobile audit at 390px after the shell overflow patch.
- Checked `/teacher`, `/teacher/schedules`, `/teacher/proposals`, `/teacher/progress1`, `/teacher/progress2`, `/teacher/final`, `/teacher/reports`, and `/teacher/advisor-score`.
- All checked routes had:
  - `docWidth = 390` at a 390px viewport;
  - no horizontal overflow;
  - no clipped actions;
  - no shell-only page;
  - no digest/application error;
  - no login fallback.
- Ran a non-mutating desktop classic/figma smoke check on the same teacher routes:
  - classic mode rendered classic workload surfaces and no Figma shell;
  - figma mode rendered Figma shell and no classic workload summary;
  - no route showed digest/application error or login fallback.
- Teacher redesign phase is complete.
- Next step: Phase 5 Admin redesign, starting with `/admin/rounds` and `/admin/closeout`.

## 2026-05-14 Figma visual redesign - Admin renderer batch 1

- Continued Phase 5 Admin redesign.
- Added page-level Figma renderer branches for:
  - `/admin/rounds`
  - `/admin/closeout`
  - `/admin/schedules`
  - `/admin/evidence`
- Classic UI remains available as the fallback for all patched admin pages.
- The new Figma admin views use the shared visual system for page headers, KPI cards, panels, status badges, action rows, and warning/action hierarchy.
- Preserved existing data fetching, auth guards, server actions, route behavior, permissions, lifecycle semantics, scoring semantics, eligibility semantics, export route behavior, Markdown/KaTeX behavior, schema, API semantics, and production configuration.
- Local validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- admin`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Build initially emitted one unused-variable warning in `/admin/closeout`; it was patched and the full validation cycle was rerun successfully.
- Remaining Phase 5 admin work:
  - `/admin/proposals` Figma renderer split.
  - No real `/admin/reports` route exists in the current repo, so that planning item remains deferred/mapping-only.

## 2026-05-14 Figma visual redesign - Admin proposals and admin route verification

- Completed the remaining real Admin route in Phase 5 with `/admin/proposals`.
- Added a page-level `figma` renderer branch while keeping the existing proposal summary page as the `classic` fallback.
- The Figma proposal view uses shared visual primitives for KPI cards, action-first proposal rows, operational warning panels, and a two-column Proposal review/action layout.
- Preserved the existing proposal data query, Admin guard, score summary source, final decision form, feedback release form, Proposal round close acknowledgement, hidden fields, confirmation messages, Markdown+KaTeX rendering, and route behavior.
- Added a reusable Edge CDP verifier for admin `classic`/`figma` renderer checks.
- No auth, lifecycle, scoring, eligibility, schema, server action, API, route, Markdown+KaTeX, export, or production configuration semantics were changed.
- Local validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- admin`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Pushed QA preview only at commit `056526f`.
- Live QA preview: `https://system-project-math-sci-b4pwwud5y-lordtd-hubs-projects.vercel.app`.
- Live verification passed for Admin routes in both `classic` and `figma` mode:
  - `/admin/rounds`
  - `/admin/closeout`
  - `/admin/proposals`
  - `/admin/schedules`
  - `/admin/evidence`
- Desktop and 390px mobile checks passed:
  - classic mode had no Figma shell and no route-specific Figma class;
  - figma mode had the Figma shell and expected route-specific class;
  - no shell-only page, digest/application error, login fallback, or horizontal overflow.
- Admin redesign phase is complete for real routes in the current repo. `/admin/reports` remains a planning-only item because no real route exists.
- Next step: Phase 6 Student redesign, starting with `/student`, then `/student/project`, `/student/proposal`, `/student/schedule`, `/student/report`, and `/student/feedback`.

## 2026-05-14 Figma visual redesign - Student dashboard renderer

- Started Phase 6 Student redesign with `/student`.
- Added a conservative page-level `figma` renderer branch while keeping the existing student dashboard as the `classic` fallback.
- The Figma student dashboard uses shared visual primitives for:
  - student page header;
  - KPI cards for actionable, waiting, completed, locked, and assessment-result counts;
  - primary next-action panel;
  - grouped workflow states;
  - compact committee/schedule/result panels;
  - timeline evidence.
- Preserved the existing student guard, data query, lifecycle next-action source, schedule state source, report action source, feedback/result links, committee display, timeline evidence, Markdown+KaTeX rendering, and route behavior.
- No auth, lifecycle, scoring, eligibility, schema, server action, API, route, Markdown+KaTeX, or production configuration semantics were changed.
- Local validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- studentDashboardSource studentReadabilityStabilization`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Pushed QA preview only at commit `4174383`.
- Live QA preview: `https://system-project-math-sci-844q8gqj9-lordtd-hubs-projects.vercel.app`.
- Live verification passed for `/student` in both `classic` and `figma` mode:
  - classic mode retained the classic action queue and no Figma dashboard class;
  - figma mode rendered the Figma shell and `.figma-student-dashboard`;
  - desktop and 390px mobile had no shell-only page, digest/application error, login fallback, or horizontal overflow.
- Added a reusable Edge CDP verifier for student dashboard `classic`/`figma` checks.
- Next step: continue Phase 6 with `/student/project`.

## 2026-05-14 Figma visual redesign - Student project renderer

- Continued Phase 6 Student redesign with `/student/project`.
- Added a conservative page-level `figma` renderer branch while keeping the existing project/advisor request page as the `classic` fallback.
- The Figma project page uses shared visual primitives for:
  - student page header;
  - project/advisor status KPI cards;
  - action/waiting/approved separation;
  - latest advisor request context;
  - a two-column review/form layout.
- Preserved the existing student guard, project/advisor request data query, `DraftPreservingForm`, `saveProjectOrigin` server action, draft-save behavior, material link field, Markdown+KaTeX editors/viewer, declaration checkbox, field names, submit button semantics, and route behavior.
- No auth, lifecycle, scoring, eligibility, schema, server action, API, route, Markdown+KaTeX, or production configuration semantics were changed.
- Local validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- studentDashboardSource studentReadabilityStabilization`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Extended the student Edge CDP verifier to check `/student/project` classic/figma rendering and required form fields.
- Pushed QA preview only at commit `1ad318e`.
- Live QA preview: `https://system-project-math-sci-8rztp26xw-lordtd-hubs-projects.vercel.app`.
- Live verification passed for `/student/project` in both `classic` and `figma` mode:
  - classic mode had no Figma shell or `.figma-student-project`;
  - figma mode rendered the Figma shell and `.figma-student-project`;
  - both modes kept required form fields, draft-save, and submit button;
  - desktop and 390px mobile had no shell-only page, digest/application error, login fallback, or horizontal overflow.
- Next step: continue Phase 6 with `/student/proposal`.

## 2026-05-14 Figma visual redesign - Student proposal renderer

- Continued Phase 6 Student redesign with `/student/proposal`.
- Added a conservative page-level `figma` renderer branch while keeping existing Proposal content and workflow behavior as the classic fallback contract.
- The Figma Proposal page adds:
  - student page header;
  - status badge;
  - KPI cards for actionable, waiting, submitted, and visible-comment states.
- Preserved the existing student guard, Proposal round/open/late exception checks, submitted-summary behavior, `ProposalDraftForm`, `saveProposalSubmission` server action, draft-save behavior, material link field, timeline builder, Markdown+KaTeX editors/viewer, declaration checkbox, field names, rubric panel, visible teacher comments, and route behavior.
- No auth, lifecycle, scoring, eligibility, schema, server action, API, route, Markdown+KaTeX, or production configuration semantics were changed.
- Local validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- studentDashboardSource studentReadabilityStabilization`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Extended the student Edge CDP verifier to check `/student/proposal` classic/figma rendering and proposal form/submitted-summary state.
- Pushed QA preview only at commit `8222947`.
- Live QA preview: `https://system-project-math-sci-oz0raz5on-lordtd-hubs-projects.vercel.app`.
- Live verification passed for `/student/proposal` in both `classic` and `figma` mode:
  - current QA state rendered submitted-summary mode rather than editable form mode;
  - classic mode had no Figma shell or `.figma-student-proposal`;
  - figma mode rendered the Figma shell and `.figma-student-proposal`;
  - submitted summary remained present in both modes;
  - desktop and 390px mobile had no shell-only page, digest/application error, login fallback, or horizontal overflow.
- Next step: continue Phase 6 with `/student/schedule`.

## 2026-05-14 Figma visual redesign - Student schedule renderer

- Continued Phase 6 Student redesign with `/student/schedule`.
- Added a conservative page-level `figma` renderer branch while keeping existing assessment evidence, scheduling, guidance, rubric, and schedule history behavior as the classic fallback contract.
- The Figma schedule page adds:
  - student page header;
  - status badge;
  - KPI cards for actionable, waiting, completed, and locked/not-ready round states.
- Preserved the existing student guard, round/open/late exception checks, Progress/Final eligibility sources, `saveAssessmentEvidence`, `submitExamSchedule`, post-evidence-save success branch, `student-schedule-page-content` guard, evidence forms, schedule draft form, schedule history, rubric panels, Markdown+KaTeX rendering, and route behavior.
- No auth, lifecycle, scoring, eligibility, schema, server action, API, route, Markdown+KaTeX, or production configuration semantics were changed.
- Local validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- studentDashboardSource studentReadabilityStabilization postSubmitStabilizationSource scheduleProgressSource`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Extended the student Edge CDP verifier to check `/student/schedule` classic/figma rendering and page-content presence.
- QA preview `https://system-project-math-sci-9ugiisk0v-lordtd-hubs-projects.vercel.app` passed live Edge CDP verification for `/student/schedule` in classic and figma mode on desktop and 390px mobile.
- No shell-only page, digest/application error, login fallback, or horizontal overflow was detected.
- Next step: continue Phase 6 with `/student/report`.

## 2026-05-14 Figma visual redesign - Student report renderer

- Continued Phase 6 Student redesign with `/student/report`.
- Added a conservative page-level `figma` renderer branch while keeping existing report gate, report submission, revision note, report history, reviewer comments, and Markdown+KaTeX behavior as the classic fallback contract.
- The Figma report page adds:
  - student report page header;
  - status badge;
  - KPI cards for do-now, waiting-for-review, approved, and report-history states.
- Preserved `submitReportVersion`, `DraftPreservingForm`, `report_drive_link`, `report_note`, `student-report-draft`, `getReportSubmissionGate`, latest report revision state, reviewer display names, version history, and route behavior.
- No auth, lifecycle, scoring, eligibility, schema, server action, API, route, report latest-version, Markdown+KaTeX, or production configuration semantics were changed.
- Local validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- studentDashboardSource studentReadabilityStabilization`
  - `node --check e2e-artifacts/redesign-mapping/verify-student-renderer-modes-cdp.js`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Extended the student Edge CDP verifier to check `/student/report` classic/figma rendering and report page-content presence.
- QA preview `https://system-project-math-sci-cnjb5ikb1-lordtd-hubs-projects.vercel.app` passed live Edge CDP verification for `/student/report` in classic and figma mode on desktop and 390px mobile.
- Current QA state showed report history/status content rather than an active report form, which is expected after Wave 1 report completion; source tests preserve the active form contract.
- No shell-only page, digest/application error, login fallback, or horizontal overflow was detected.
- Next step: continue Phase 6 with `/student/feedback`.

## 2026-05-14 Figma visual redesign - Student feedback renderer

- Continued Phase 6 Student redesign with `/student/feedback`.
- Added a conservative page-level `figma` renderer branch while keeping existing score aggregation, round filtering, evaluator snapshot names, rubric score item display, and Markdown+KaTeX comment rendering as the classic fallback contract.
- The Figma feedback page adds:
  - read-only feedback page header;
  - status badge;
  - KPI cards for readable results, waiting rounds, current filter, and read-only state.
- Preserved `feedbackTabs`, `scoreAverage`, `formatScore`, `MarkdownLatexViewer`, `scoreSubmission?.overallComment`, `scoreSubmission.scoreItems`, `evaluatorDisplayNameSnapshot`, and route behavior.
- No auth, lifecycle, scoring, eligibility, schema, server action, API, route, feedback visibility, Markdown+KaTeX, or production configuration semantics were changed.
- Local validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- studentDashboardSource studentReadabilityStabilization`
  - `node --check e2e-artifacts/redesign-mapping/verify-student-renderer-modes-cdp.js`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Extended the student Edge CDP verifier to check `/student/feedback` classic/figma rendering and feedback page-content presence.
- QA preview `https://system-project-math-sci-muaccmm4j-lordtd-hubs-projects.vercel.app` passed live Edge CDP verification for `/student/feedback` in classic and figma mode on desktop and 390px mobile.
- Feedback tabs and score/status content remained visible; no shell-only page, digest/application error, login fallback, or horizontal overflow was detected.
- Student pages now have non-mutating classic/figma verification coverage for `/student`, `/student/project`, `/student/proposal`, `/student/schedule`, `/student/report`, and `/student/feedback`.
- Next step: summarize student mobile/regression coverage, then continue the broader Phase 7/8 redesign regression pass.

## 2026-05-14 Figma visual redesign - Global non-mutating regression

- Ran the Phase 7/8 global mobile and classic/figma non-mutating regression on QA preview `https://system-project-math-sci-jbdhfqgzt-lordtd-hubs-projects.vercel.app`.
- Persistent Edge CDP verification passed:
  - Teacher: 8 routes on desktop and 390px mobile.
  - Admin: 6 routes on desktop and 390px mobile.
  - Student: 6 routes on desktop and 390px mobile, including classic/figma renderer comparison.
- QA login guard was preserved: each verifier explicitly selected the role dropdown before identity selection.
- No shell-only page, digest/application error, login fallback, unauthorized guard page, or horizontal overflow was detected.
- Current redesign status:
  - visual/mobile/classic-vs-figma non-mutating regression is complete;
  - Phase 9 mutating workflow regression is still pending because current Wave 1 QA state is already completed and should not be forced backward.
- Recommended next step: run the mutating workflow regression in Wave 2 or another preserved QA offering with safe pending actions.

## 2026-05-14 Redesign follow-up - User-facing language pass planned

- Added a post-redesign copy/language phase to the redesign plan.
- This pass must run only after the Figma visual redesign is complete and mutating workflow regression has passed.
- Goal: read all browser-rendered text and source strings across public, student, teacher, admin, warning, export, locked, waiting, success, and error surfaces, then replace programmer-like or raw internal wording with clear Thai user-facing wording.
- Guardrails:
  - preserve lifecycle, scoring, eligibility, permission, evidence, and audit semantics;
  - do not hide warning/late/exception/grade-I risk details;
  - do not trust PowerShell mojibake as source text;
  - keep classic/figma wording consistent unless a page intentionally needs different layout-only presentation.
- Created `e2e-artifacts/redesign-mapping/COPY_LANGUAGE_AUDIT.md` as the starting audit file.

## 2026-05-14 Phase 9 redesign regression readiness

- Confirmed Wave 1 and Wave 2 12-project states are both completed historical evidence and should not be mutated for Phase 9.
- Added a QA-only `MULTI-PILOT-R2 Redesign Regression Course Offering` setup path so mutating classic/figma workflow regression can run on fresh pending state.
- The setup reuses the approved 12-project Wave 2 mix and existing QA identities, but creates/reuses a separate course offering in BE 2572.
- No lifecycle, auth, scoring, eligibility, schema, API, or production behavior was changed.
- Validation passed:
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test -- src/app/qaLoginSource.test.ts src/lib/qa/multiPilotR2.test.ts`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Next step: push QA preview, prepare the redesign regression offering through `/qa-login`, then run Phase 9 mutating workflow regression in classic and figma mode.

## 2026-05-14 Phase 9 redesign regression dual-state setup

- Added a second QA-only `MULTI-PILOT-R2 Redesign Figma Regression Course Offering` setup path so mutating regression can use one fresh offering for classic mode and another fresh offering for figma mode.
- The second offering uses the same approved 12-project Wave 2 mix and existing QA identities, but creates/reuses a separate course offering in BE 2573.
- Added reusable Edge CDP helpers for preparing either redesign regression offering and setting the `project_ui_mode` cookie before mutating workflow scripts.
- No lifecycle, auth, scoring, eligibility, schema, API, or production behavior was changed.
- Validation passed:
  - `node --check e2e-artifacts/redesign-mapping/prepare-redesign-regression-offering-cdp.js`
  - `node --check e2e-artifacts/redesign-mapping/set-ui-mode-cdp.js`
  - `cmd /c npm.cmd test -- src/app/qaLoginSource.test.ts src/lib/qa/multiPilotR2.test.ts`
  - `cmd /c npm.cmd run typecheck`
  - `cmd /c npm.cmd test`
  - `cmd /c npm.cmd run build`
- Secret scan found no known QA/database secret fragments in source or redesign artifacts.
- Next step: deploy to QA, prepare the figma regression offering on the new preview, then run Phase 9 mutating regression without touching completed Wave 1 or Wave 2 evidence.

## 2026-05-14 Phase 9 Figma visual density correction

- Continued Phase 9 mutating regression on the safe Figma regression offering.
- Confirmed the Figma flow had reached Progress 1 schedule approval after Proposal, late Proposal recovery, committee assignment, and Progress 1 student submissions.
- Applied a UI-only correction based on live visual review:
  - `/student/schedule` no longer shows both the Figma KPI row and the classic readability summary in Figma mode;
  - metric/status cards now use smaller padding, labels, numbers, and clipped two-line descriptions;
  - teacher/admin queue badges are more compact;
  - long teacher/admin queue lists gain an internal vertical scrollbar after 5 items;
  - the Figma role sidebar/nav spacing is slightly reduced.
- Updated Wave 2 CDP scripts so Phase 9 can continue against the safe Figma regression offering title instead of assuming the original Wave 2 offering title.
- No lifecycle, auth, scoring, eligibility, schema, API, permissions, server action, route, or production configuration semantics were changed.
- Validation passed:
  - `node --check` for modified Wave 2 CDP scripts;
  - `cmd /c npm.cmd run typecheck`;
  - targeted UI/source tests;
  - `cmd /c npm.cmd test`;
  - `cmd /c npm.cmd run build`.
- Next step: push a QA preview for this UI/tooling patch, verify `/student/schedule` visual density in Figma mode, then resume Phase 9 from Progress 1 scoring on the new preview URL.

## 2026-05-14 Phase 9 compact Figma chrome and badges

- Applied a second UI-only density pass from live visual feedback.
- Figma mode now uses:
  - compact icon-first role navigation with hover/focus tooltips;
  - shorter KPI/status cards;
  - compact/truncated Figma status badges and project status badges;
  - horizontal overflow for row-like status/action groups;
  - internal vertical scroll for Figma action/schedule/attempt/notification lists after five items;
  - a wider review/action column for form-heavy pages.
- No lifecycle, auth, scoring, eligibility, schema, API, permission, route, server action, QA data, or production behavior was changed.
- Validation passed:
  - `cmd /c npm.cmd run typecheck`;
  - targeted Figma/teacher/UI source tests;
  - `cmd /c npm.cmd test`;
  - `cmd /c npm.cmd run build`.
- Next step: deploy to QA, live-check compact Figma UI on the latest preview, then resume Phase 9 from Progress 2 scoring.

## 2026-05-14 Phase 9 Figma navigator icons

- Refined the compact Figma role navigator from text abbreviations to small SVG icons.
- Added visual icons for inbox/workload, schedules, Proposal, Progress 1, Progress 2, Final, reports, advisor score, closeout, evidence, project, feedback, and overview.
- Kept native hover/focus tooltips with the existing Thai route labels.
- Updated the teacher live verifier to recognize the Figma shell/nav/surface markers as a valid redesigned page.
- No lifecycle, auth, scoring, eligibility, schema, API, permission, route, server action, QA data, or production behavior was changed.
- Validation passed:
  - `cmd /c npm.cmd run typecheck`;
  - `cmd /c npm.cmd test -- src/app/figmaUiModeSource.test.ts`;
  - `cmd /c npm.cmd test`;
  - `cmd /c npm.cmd run build`.
- Next step: deploy to QA, live-check teacher Figma pages with the icon rail, then resume Phase 9 Progress 2 scoring.

## 2026-05-14 Phase 9 Figma display density

- Refined Figma display-only layout after live review of `/teacher/advisor-score`.
- Figma KPI rows now use auto-fit compact columns, which avoids awkward empty gaps and keeps metric cards on one row when the viewport has enough width.
- Completed/locked teacher report and advisor-score detail rows now use a compact read-only layout instead of reserving a large empty action column.
- Editable scoring/review states still use the wider two-column layout so forms remain easy to fill.
- No lifecycle, auth, scoring, eligibility, schema, API, permission, route, server action, QA data, or production behavior was changed.
- Validation passed:
  - `cmd /c npm.cmd run typecheck`;
  - targeted teacher/Figma source tests;
  - `cmd /c npm.cmd test`;
  - `cmd /c npm.cmd run build`.
- Next step: deploy to QA, live-check `/teacher/advisor-score`, then resume Phase 9 Progress 2 scoring.

## 2026-05-14 Phase 9 compact object vs full detail rule

- Added the redesign rule that dashboard/queue object displays should be compact, while inspection and form-heavy views should use full-detail surfaces.
- Added shared Figma presentation primitives for compact object summary lists and full-detail object sections.
- Applied the rule to teacher reports and advisor-score pages:
  - compact queue list for scan-and-select;
  - full detail section for review, evidence, scoring, or read-only inspection;
  - form states remain wider/easier to fill than read-only states.
- Removed the redundant Figma teacher dashboard quick-link widget because the icon sidebar already provides those destinations.
- Hid the redundant Figma teacher dashboard KPI strip because the action workspace already provides the same "now / total / waiting" information.
- Changed internal scroll behavior to opt-in only, so pages keep normal vertical scrolling unless a specific queue deliberately asks for its own scroll area.
- No lifecycle, auth, scoring, eligibility, schema, API, permission, route, server action, QA data, or production behavior was changed.
- Validation passed:
  - `cmd /c npm.cmd run typecheck`;
  - targeted Figma/teacher tests;
  - `cmd /c npm.cmd test`;
  - `cmd /c npm.cmd run build`.
- QA deployment passed:
  - commit `c497d81`;
  - preview `https://system-project-math-sci-jypb0gct0-lordtd-hubs-projects.vercel.app`.
- Live teacher Figma verification passed for all teacher routes with no shell-only page, no unauthorized guard page, and no detected horizontal overflow.
- Next step: resume Phase 9 Progress 2 scoring on the safe Figma regression offering.

## 2026-05-14 Redesign paused; classic UI restored as active baseline

- Live review found the Figma-mode UI still had enough usability problems that it should not continue as the active redesign path.
- Fixed the immediate scroll-safety issue by removing negative vertical shell margin from the Figma role shell and preserving normal document-level scrolling.
- Kept queue/list internal scrolling opt-in only; the page itself should not be globally height-locked.
- Changed Figma UI access so QA no longer enables Figma mode automatically through QA login. Classic UI is the active baseline again unless a future QA environment explicitly sets `ENABLE_FIGMA_UI=1`.
- No lifecycle, auth, scoring, eligibility, schema, API, permission, route, server action, QA data, or production behavior was changed.
- Validation passed:
  - `cmd /c npm.cmd run typecheck`;
  - `cmd /c npm.cmd test -- src/app/figmaUiModeSource.test.ts`;
  - `cmd /c npm.cmd test`;
  - `cmd /c npm.cmd run build`.
- QA preview deployed and live-verified:
  - commit `0cc9332`;
  - preview `https://system-project-math-sci-no3lka8tn-lordtd-hubs-projects.vercel.app`;
  - teacher route verifier passed for all teacher routes with no detected horizontal overflow.
- Recommendation: pause visual redesign work, keep using classic UI, and restart redesign later from a cleaner page-by-page mockup and interaction plan.

## 2026-05-14 Frontend UX audit stabilization patch before Wave 2

- Completed the audit-first frontend UX pass under `e2e-artifacts/frontend-ux-audit/` and used classic UI as the baseline.
- Applied a small UI-only stabilization patch for the highest-value pre-Wave-2 findings:
  - added a read-only `/admin/reports` entrypoint to avoid a dead admin route expectation;
  - capped long confirmed schedule/history lists on teacher/admin schedule pages with internal vertical scroll;
  - compacted teacher/admin queue badges and project status badges;
  - capped repeated teacher queue badge stacks so long same-kind badges do not grow the page.
- No lifecycle, auth, scoring, eligibility, schema, API, permission, route semantics, server action, QA data, or production behavior was changed.
- Validation passed:
  - `cmd /c npm.cmd run typecheck`;
  - `cmd /c npm.cmd test`;
  - `cmd /c npm.cmd run build`.
- Next step: push QA preview, live-smoke `/teacher/schedules`, `/admin/schedules`, and `/admin/reports`, then decide if Wave 2 can start or whether one more small UX cleanup pass is needed.
- QA preview deployed and live-smoked:
  - commit `03005b3`;
  - preview `https://system-project-math-sci-4cqk7d5hb-lordtd-hubs-projects.vercel.app`;
  - `/teacher/schedules` confirmed schedule history is scroll-contained;
  - `/admin/schedules` confirmed/history group is scroll-contained;
  - `/admin/reports` renders the read-only report entrypoint and no longer returns 404.
- Recommendation after smoke check: ready to proceed to Wave 2 with remaining UX debt logged, as long as Wave 2 continues to stop on real workflow/state blockers.
- Documentation follow-up:
  - commit `ce66def`;
  - preview `https://system-project-math-sci-hfqwa1dik-lordtd-hubs-projects.vercel.app`.
- Latest Playwright visible re-entry to the documentation-only preview redirected to Vercel Login / Deployment Protection, so Wave 2 should resume only after a valid protected-preview session is available at `/qa-login`. This is a preview/session protection issue, not an app-code regression from the UX patch.
