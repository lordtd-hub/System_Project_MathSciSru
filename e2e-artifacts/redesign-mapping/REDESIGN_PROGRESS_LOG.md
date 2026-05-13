# Redesign Progress Log

## Baseline

- Branch: `qa-preview`
- Baseline commit: `01ed9e2`
- Safety tag created locally: `wave2-stable-before-redesign`
- Latest QA preview recorded from planning pack: `https://system-project-math-sci-qiuuaim9o-lordtd-hubs-projects.vercel.app`
- Production: not touched.

## 2026-05-13 - Phase 1 Shared UI Foundation

### Route / Component

- Shared component: `src/components/ui/TeacherWorkloadQueue.tsx`
- Shared stylesheet: `src/app/globals.css`

### Previous Issue

Teacher workload pages already used shared queue components, but the summary and compact queue rows still read like basic cards instead of a stronger operational dashboard surface. This made the high-volume teacher pages less visually aligned with the Figma Review Inbox direction.

### Redesign Applied

- Added an operational workload summary surface.
- Added an explicit "ต้องทำตอนนี้" total derived from the existing action metric.
- Added tone-specific left rails for action, waiting, completed, returned, and locked states.
- Made compact queue rows denser and easier to scan while preserving their existing links and content.
- Added mobile-aware support classes without changing route behavior.
- Added the same shared workload summary to `/teacher` so the dashboard aligns with the teacher queue pages.

### Logic Touched

No.

No auth, lifecycle, scoring, eligibility, server action, Prisma schema, or API semantics were changed.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test` - passed, 81 test files / 342 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.
- Rerun after `/teacher` dashboard integration:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test` - passed, 81 test files / 342 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Live Verification

Passed on `https://system-project-math-sci-gn79zo76m-lordtd-hubs-projects.vercel.app`.

Added `verify-teacher-workload-cdp.js` for non-mutating Edge/CDP verification. It can read the QA login secret from an environment variable or `.env.preview.local` and does not write the secret to artifacts.

The verification script explicitly selects the teacher role dropdown before selecting the teacher identity. This guards against the repeated QA-login issue where the identity field is selected but the role dropdown remains blank.

Verified routes:

- `/teacher`
- `/teacher/schedules`
- `/teacher/proposals`
- `/teacher/progress1`
- `/teacher/progress2`
- `/teacher/final`
- `/teacher/reports`
- `/teacher/advisor-score`

Screenshots were recorded under `e2e-artifacts/redesign-mapping/screenshots/` using the `gn79zo76m` QA preview slug.

### Remaining Risk

Low. The patch is presentation-only and uses existing component props.

## 2026-05-13 - Phase 2 Teacher Subpage Redesign

### Routes / Components

- `/teacher/schedules`
- `/teacher/proposals`
- `/teacher/progress1`
- `/teacher/progress2`
- `/teacher/final`
- `/teacher/reports`
- `/teacher/advisor-score`
- Shared stylesheet: `src/app/globals.css`

### Redesign Applied

- `/teacher/schedules` now separates schedule work into action, waiting, returned, and completed buckets.
- Added a compact schedule approval queue before the long approval cards so teachers can scan many projects before opening details.
- Added explicit returned/rejected schedule visibility without mixing those rows into the actionable approval queue.
- `/teacher/proposals` now adds compact navigation for pending Proposal reviews before long review cards.
- Long teacher review/detail cards across Proposal, schedule approvals, Progress 1, Progress 2, Final, reports, and advisor-score now share a `teacher-review-card` surface for visual consistency.

### Logic Touched

No.

Existing queries, server actions, guards, scoring forms, report review forms, and advisor score forms were preserved.

### Validation

- `cmd /c npm.cmd run typecheck` - first run hit stale `.next/types` paths from the sandbox; rerun after `next build` passed.
- `cmd /c npm.cmd test -- teacher` - passed, 5 files / 17 tests.
- `cmd /c npm.cmd test` - passed, 81 files / 344 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Live Verification

Passed on `https://system-project-math-sci-9czostjk1-lordtd-hubs-projects.vercel.app`.

The Edge/CDP verifier was tightened after a QA-login guard failure: it now treats an unauthorized teacher page as a failure, checks for the redesigned workload summary after login, and keeps selecting `#role = teacher` before the teacher identity.

Verified routes:

- `/teacher`
- `/teacher/schedules`
- `/teacher/proposals`
- `/teacher/progress1`
- `/teacher/progress2`
- `/teacher/final`
- `/teacher/reports`
- `/teacher/advisor-score`

Screenshots were recorded under `e2e-artifacts/redesign-mapping/screenshots/` using the `9czostjk1` QA preview slug.

### Next Phase

Continue with teacher mobile pass, then teacher regression verification before moving to Admin redesign.

## 2026-05-13 - Phase 2.8 Teacher Mobile Pass

### Routes / Components

- `/teacher`
- `/teacher/schedules`
- `/teacher/proposals`
- `/teacher/progress1`
- `/teacher/progress2`
- `/teacher/final`
- `/teacher/reports`
- `/teacher/advisor-score`
- Verification helper: `e2e-artifacts/redesign-mapping/verify-teacher-workload-cdp.js`

### Redesign Applied

- No app UI patch was required.
- Extended the teacher verifier with a mobile viewport mode (`TEACHER_VERIFY_VIEWPORT=mobile`) at 390px width.
- Added a DOM-level horizontal overflow check for mobile teacher pages.

### Logic Touched

No.

No route, guard, server action, scoring, lifecycle, eligibility, schema, API, or production behavior was changed.

### Validation

- `cmd /c npm.cmd test -- teacher` - passed, 5 files / 18 tests.

### Live Verification

Passed on `https://system-project-math-sci-g5enipsvz-lordtd-hubs-projects.vercel.app`.

All teacher routes rendered at 390px mobile width with no detected horizontal overflow:

- `/teacher`
- `/teacher/schedules`
- `/teacher/proposals`
- `/teacher/progress1`
- `/teacher/progress2`
- `/teacher/final`
- `/teacher/reports`
- `/teacher/advisor-score`

Screenshots were recorded under `e2e-artifacts/redesign-mapping/screenshots/` using the `mobile-g5enipsvz` suffix.

### Next Phase

Continue with teacher regression verification, then move to Admin redesign starting with `/admin` and `/admin/rounds`.

## 2026-05-13 - Phase 2.9 Teacher Regression Verification

### Scope

- Non-mutating teacher route verification.
- QA login role dropdown guard.
- Boundary teacher identity check with `teacher-delta`.

### Result

Passed on `https://system-project-math-sci-g5enipsvz-lordtd-hubs-projects.vercel.app`.

The verifier now accepts `TEACHER_VERIFY_KEY`, so teacher pages can be checked with a specific QA identity without changing the app. `teacher-delta` rendered all teacher routes without shell-only pages, digest/error pages, or unauthorized teacher guard pages.

Verified routes:

- `/teacher`
- `/teacher/schedules`
- `/teacher/proposals`
- `/teacher/progress1`
- `/teacher/progress2`
- `/teacher/final`
- `/teacher/reports`
- `/teacher/advisor-score`

### Logic Touched

No.

### Remaining Teacher Regression Debt

- Mutating workflow regression for approve/reject/score/report/advisor-score remains deferred until a dedicated safe QA action window, because current redesign changes are presentation-only and the latest live checks were intentionally non-mutating.

### Next Phase

Teacher redesign is complete enough to move to Admin redesign. Start Admin redesign with `/admin`, then `/admin/rounds`.

## 2026-05-13 - Phase 3 Admin Redesign Entry Audit

### Routes / Components

- `/admin`
- `/admin/rounds`
- `/admin/closeout`
- `/admin/proposals`
- `/admin/schedules`
- `/admin/evidence`
- `src/components/ui/AdminOperationalQueue.tsx`
- `src/components/ui/DashboardActionQueue.tsx`
- Verification helper: `e2e-artifacts/redesign-mapping/verify-admin-redesign-cdp.js`

### Detection Result

Admin redesign had already received the operational UX stabilization patterns from the previous Wave 1 work:

- `/admin` uses `DashboardActionQueue`, compact workflow counters, dashboard console panels, and action-first queue cards.
- `/admin/rounds` uses `AdminOperationalSummary`, eligibility buckets, and `AdminDangerZone` around open/close/reset actions.
- `/admin/closeout`, `/admin/proposals`, `/admin/schedules`, and `/admin/evidence` use admin operational summaries or queue sections for scale-sensitive lists.

Because the current source already matched the redesign principles, no app UI patch was required in this cycle.

### Redesign / Tooling Applied

- Added an Admin Edge/CDP verifier for non-mutating route checks.
- The verifier explicitly clears any existing QA session, selects `#role = admin`, selects the admin identity, and then submits the QA login form.
- The verifier checks for shell-only/error pages, admin operational surfaces, desktop/mobile overflow, and screenshot capture.

### Logic Touched

No.

No route, guard, server action, lifecycle, scoring, eligibility, schema, API, or production behavior was changed.

### Validation

- `cmd /c npm.cmd test -- admin` - passed, 16 files / 63 tests.
- `cmd /c npm.cmd test -- dashboardClarity` - passed, 1 file / 3 tests.
- `node --check e2e-artifacts/redesign-mapping/verify-admin-redesign-cdp.js` - passed.
- `cmd /c npm.cmd test -- adminOperational dashboardClarity` - passed, 2 files / 8 tests.

### Live Verification

Passed on `https://system-project-math-sci-1thdur8ic-lordtd-hubs-projects.vercel.app`.

Verified desktop and 390px mobile render for:

- `/admin`
- `/admin/rounds`
- `/admin/closeout`
- `/admin/proposals`
- `/admin/schedules`
- `/admin/evidence`

All checked routes rendered without shell-only pages, digest/error pages, or detected horizontal overflow. The QA login role mismatch issue was handled by selecting the role dropdown and clearing the previous QA session before switching roles.

### Remaining Admin Debt

- Deeper table/filter redesign for very large lists remains deferred.
- Mutating admin workflow regression remains deferred to a safe action window because this cycle was intentionally non-mutating.

### Next Phase

Continue to Student redesign audit and conservative student UI pass.

## 2026-05-13 - Phase 4 Student Redesign Entry Patch

### Routes / Components

- `/student/project`
- `/student/proposal`
- `src/components/ui/StudentReadabilitySummary.tsx`
- Verification helper: `e2e-artifacts/redesign-mapping/verify-student-redesign-cdp.js`

### Detection Result

The student dashboard, schedule, report, and feedback pages already had readability-oriented surfaces:

- `/student` uses workflow groups and an action queue.
- `/student/schedule`, `/student/report`, and `/student/feedback` use `StudentReadabilitySummary`.

The remaining high-value student gaps were the long form-heavy pages:

- `/student/project`
- `/student/proposal`

### Redesign Applied

- Added a `StudentReadabilitySummary` before the long project-origin/advisor request form.
- Added a `StudentReadabilitySummary` before the long Proposal submission form.
- The summaries separate:
  - work the student can do now.
  - waiting states.
  - completed/submitted states.
  - status/history counters.
- Added a non-mutating student Edge/CDP verifier for dashboard/project/proposal/schedule/report/feedback routes.

### Logic Touched

No.

The patch only adds presentation summaries. It does not change form fields, server actions, lifecycle gates, auth guards, scoring, eligibility, schema, or API behavior.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- studentReadability` - passed, 1 file / 6 tests.
- `cmd /c npm.cmd test` - passed, 81 files / 346 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.
- `node --check e2e-artifacts/redesign-mapping/verify-student-redesign-cdp.js` - passed.

### Next Phase

Live-verify student routes on the new preview URL before moving to the global mobile/regression pass.

### Live Verification

Passed on `https://system-project-math-sci-4pvh39ven-lordtd-hubs-projects.vercel.app`.

Verified desktop and 390px mobile render for:

- `/student`
- `/student/project`
- `/student/proposal`
- `/student/schedule`
- `/student/report`
- `/student/feedback`

All checked routes rendered without shell-only pages, digest/error pages, or detected horizontal overflow. The verifier explicitly selects `#role = student` before selecting the student identity.

### Next Phase

Continue to global mobile/regression verification across redesigned Teacher, Admin, and Student surfaces.

## 2026-05-13 - Phase 7/8 Global Mobile + Non-Mutating Regression

### Preview

`https://system-project-math-sci-66nqpox8d-lordtd-hubs-projects.vercel.app`

### Scope

Verified redesigned surfaces across all three roles without mutating workflow state:

- Teacher: `/teacher`, `/teacher/schedules`, `/teacher/proposals`, `/teacher/progress1`, `/teacher/progress2`, `/teacher/final`, `/teacher/reports`, `/teacher/advisor-score`.
- Admin: `/admin`, `/admin/rounds`, `/admin/closeout`, `/admin/proposals`, `/admin/schedules`, `/admin/evidence`.
- Student: `/student`, `/student/project`, `/student/proposal`, `/student/schedule`, `/student/report`, `/student/feedback`.

### Result

Passed for desktop and 390px mobile viewports.

- No shell-only pages detected.
- No digest/application error pages detected.
- No detected horizontal overflow in 390px mobile viewport.
- QA login role dropdown was explicitly selected before identity selection for each role.
- The teacher verifier was patched to clear existing QA sessions before switching roles, matching the Admin/Student verifier safety pattern.

### Notes

- The local `.env.preview.local` QA secret did not match the active preview secret during this check. The live verification used a process-scoped `QA_LIVE_SECRET` environment value and did not write the secret to artifacts.
- Mutating workflow regression remains deferred to a safe action window because this pass intentionally preserved Wave 1 QA state.

### Next Phase

Continue to completion documentation and readiness assessment for the redesign loop.

## 2026-05-13 - Figma Visual Redesign Phase 0 Safe Fallback Foundation

### Scope

Implemented the safe `classic` / `figma` UI mode foundation requested before page-level Figma visual replacements.

### Redesign Applied

- Added a presentation-only UI mode utility with production-safe fallback to `classic`.
- Added a cookie-backed QA mode switch that can select `classic` or `figma`.
- Wrapped Admin, Teacher, and Student route groups with a new Figma-style role shell only when `figma` mode is active.
- Preserved the existing role navigation and page bodies in `classic` mode.
- Added shared Figma visual primitives for upcoming page-level renderers.

### Logic Touched

No business logic was changed.

The patch does not change auth guards, lifecycle transitions, scoring, eligibility, schema, server action semantics, API contracts, or production configuration. The only server action added stores the UI mode cookie.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- figmaUiMode` - passed, 1 file / 3 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 349 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Next Phase

Run a secret scan, then commit/push the fallback foundation. After that, continue with page-level `Classic...View` / `Figma...View` split starting from the teacher dashboard and teacher review pages.

### QA Deployment And Live Verification

- Commit: `a9de656`.
- QA preview: `https://system-project-math-sci-mfn23sfkb-lordtd-hubs-projects.vercel.app`.
- Classic/default Admin smoke passed using the existing Edge/CDP admin verifier.
- The verifier selected the Admin role dropdown before selecting the Admin identity.
- UI mode smoke passed:
  - default `classic` had the mode switch and no `.figma-role-shell`;
  - after selecting `figma`, `.figma-role-shell` and `.figma-role-sidebar` rendered;
  - after switching back to `classic`, the Figma shell disappeared.

### Next Phase

Continue to page-level Figma renderers. Start with the teacher dashboard and teacher review/detail pages because Figma coverage is strongest there.

## 2026-05-13 - Phase 4 Teacher Dashboard Figma Renderer Entry

### Scope

Started the first page-level `classic` / `figma` body split on `/teacher`.

### Redesign Applied

- Kept the classic teacher dashboard body available as `ClassicTeacherDashboardView`.
- Added `FigmaTeacherDashboardView` for `figma` mode.
- Reused the existing server page as the owner of data fetching, auth guards, teacher capability checks, server actions, links, and queue source data.
- Passed one shared `teacherDashboardViewProps` contract into the Figma renderer.
- Added Figma-style dashboard surfaces:
  - page header;
  - KPI cards;
  - action-first queue rows;
  - schedule list;
  - proposal review list;
  - notification/action panels.
- Added responsive CSS for the new dashboard rows and queue layout.

### Logic Touched

No.

This patch only changes presentation rendering for `/teacher`. It does not change auth, lifecycle, scoring, eligibility, schema, server actions, API contracts, or route behavior.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- teacher` - passed, 5 files / 19 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 350 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Next Phase

Continue Phase 4 page-by-page with teacher subpages. `/teacher/schedules` already has compact workload stabilization, but it still needs the Figma/classic renderer split and closer Figma visual composition.
