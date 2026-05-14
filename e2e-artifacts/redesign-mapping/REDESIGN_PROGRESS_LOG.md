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

## 2026-05-13 - Figma Visual Pass Phase 4 Teacher Schedules Renderer

### Routes / Components

- `/teacher/schedules`
- `src/app/teacher/schedules/page.tsx`
- `src/app/teacher/teacherWorkloadUxSource.test.ts`

### Redesign Applied

- Added a `figma` renderer branch while keeping the existing `classic` schedule page as fallback.
- Preserved the existing schedule data fetching, permission guard, review forms, `reviewExamSchedule` server action, Markdown/KaTeX schedule note rendering, and all route semantics.
- Figma mode now uses the shared visual system for:
  - page header;
  - schedule KPI cards;
  - action-first approval queue;
  - waiting/returned status panel;
  - two-column review detail layout;
  - read-only confirmed schedule list.
- The approve/reject forms are still the original server-action forms with the same hidden fields and required rejection comment.

### Logic Touched

No.

No auth, lifecycle, scoring, eligibility, Prisma schema, server action, API, route, or production behavior was changed.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- teacher` - passed, 5 files / 19 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 351 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Live Verification

Passed on `https://system-project-math-sci-hmhz7pteq-lordtd-hubs-projects.vercel.app`.

Verified `/teacher/schedules` in both modes with the existing Edge QA session:

- `classic`: original stabilized schedule page rendered, `.teacher-workload-summary` present, `.figma-role-shell` absent.
- `figma`: Figma role shell rendered, `.figma-teacher-schedules` present, 5 KPI cards rendered, and 48 schedule/action rows rendered from the current QA state.
- No shell-only page, digest/application error page, or unauthorized teacher guard appeared.

Operational note: because the user keeps the Figma reference tab open in Edge, the QA tab can be `document.hidden` during CDP checks. The verifier must activate the QA tab before evaluating layout, otherwise Next streaming content can appear temporarily in a hidden Suspense container.

### Next Phase

Continue teacher subpage renderer split with `/teacher/proposals`.

## 2026-05-13 - Figma Visual Pass Phase 4 Teacher Proposals Renderer

### Routes / Components

- `/teacher/proposals`
- `src/app/teacher/proposals/page.tsx`
- `src/app/teacher/teacherWorkloadUxSource.test.ts`

### Redesign Applied

- Added a page-level `figma` renderer branch while keeping the existing Proposal review page as the `classic` fallback.
- Preserved the existing Proposal attempt query, teacher capability guard, scoring assignment link, `openProposalScoring` form, hidden `attempt_id` field, and route semantics.
- Figma mode now uses the shared visual system for:
  - page header;
  - Proposal KPI cards;
  - action-first Proposal queue;
  - completed/read-only Proposal queue;
  - two-column Project Review Detail-style rows for each Proposal attempt.

### Logic Touched

No.

No auth, lifecycle, scoring, eligibility, Prisma schema, server action, API, route, or production behavior was changed.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- teacher` - passed, 5 files / 19 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 351 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Live Verification

Pending QA deploy for this page-level renderer patch.

### Next Phase

Commit/push QA preview, live-verify `/teacher/proposals` in both classic and figma mode, then continue teacher subpage renderer split with `/teacher/progress1`.

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

- Kept the classic teacher dashboard body as the direct fallback renderer.
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

## 2026-05-13 - Phase 4 Teacher Proposals Live QA Verification

### Scope

Completed QA deployment and live verification for the `/teacher/proposals` page-level Figma renderer.

### Result

- Commit: `0c4ae56`.
- QA preview: `https://system-project-math-sci-2vdne1hl7-lordtd-hubs-projects.vercel.app`.
- Classic fallback rendered the existing Proposal review page and did not render the Figma shell.
- Figma mode rendered `.figma-role-shell`, `.figma-teacher-proposals`, and 5 KPI cards.
- The current QA state had no Proposal items requiring action, so no `.figma-proposal-row` action rows were expected.
- Screenshots were saved under `e2e-artifacts/redesign-mapping/screenshots/`.

### Logic Touched

No.

The live check confirmed the Proposal renderer split remained presentation-only and did not change scoring links, server action semantics, auth guards, lifecycle, eligibility, schema, or route behavior.

### Next Phase

Continue Phase 4 with `/teacher/progress1`, preserving the existing scoring form and Markdown/KaTeX evidence rendering while adding a Figma-mode review/detail composition.

## 2026-05-13 - Phase 4 Teacher Progress 1 Figma Renderer Local Patch

### Scope

Continued the teacher page-level renderer split with `/teacher/progress1`.

### Redesign Applied

- Kept the existing Progress 1 scoring page as the `classic` fallback.
- Added a `figma` branch using shared visual primitives:
  - Figma page header;
  - KPI cards;
  - action-first Progress 1 queue;
  - Project Review Detail-style two-column layout;
  - evidence/Markdown+KaTeX context on the left;
  - existing scoring form on the right.
- Preserved the same `submitProgress1Score` server action, hidden `project_id` field, rubric inputs, Markdown feedback editor, and confirmation submit button.

### Logic Touched

No.

The patch is presentation-only. It does not change auth, lifecycle, scoring, eligibility, schema, server actions, API contracts, route behavior, Markdown/KaTeX behavior, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- teacher` - passed, 5 files / 20 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 352 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Encoding Note

PowerShell output can render Thai text as mojibake or `?` even when the source file is UTF-8. For redesign verification, rely on file diffs/browser rendering and avoid verifier scripts that embed Thai regex through PowerShell.

### Next Phase

Commit/push to QA preview, live-verify `/teacher/progress1` in classic and figma modes, then continue with `/teacher/progress2`.

### QA Deployment And Live Verification

- Commit: `41f6967`.
- QA preview: `https://system-project-math-sci-g80tv9wrj-lordtd-hubs-projects.vercel.app`.
- Classic mode rendered the existing Progress 1 page with `.teacher-workload-summary`.
- Figma mode rendered `.figma-role-shell`, `.figma-teacher-progress1`, and 5 KPI cards.
- Current QA state had no Progress 1 scoring items, so the Figma empty state was expected.
- No shell-only page, digest/application error, or unauthorized teacher guard appeared.
- Screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-progress1-classic-g80tv9wrj.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-progress1-figma-g80tv9wrj.png`

### Next Phase

Continue Phase 4 with `/teacher/progress2` using the same safe renderer split pattern.

## 2026-05-13 - Phase 4 Teacher Progress 2 Figma Renderer Local Patch

### Scope

Continued the teacher page-level renderer split with `/teacher/progress2`.

### Redesign Applied

- Kept the existing Progress 2 scoring page as the `classic` fallback.
- Added a `figma` branch using shared visual primitives:
  - Figma page header;
  - KPI cards;
  - action-first Progress 2 queue;
  - Project Review Detail-style two-column layout;
  - evidence/Markdown+KaTeX context on the left;
  - existing scoring form on the right.
- Preserved the existing "no Progress 2 round yet" empty-state behavior in Figma mode.
- Preserved the same `submitProgress2Score` server action, hidden `project_id` field, rubric inputs, Markdown feedback editor, and confirmation submit button.

### Logic Touched

No.

The patch is presentation-only. It does not change auth, lifecycle, scoring, eligibility, schema, server actions, API contracts, route behavior, Markdown/KaTeX behavior, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- teacher` - passed, 5 files / 21 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 353 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Next Phase

Commit/push to QA preview, live-verify `/teacher/progress2` in classic and figma modes, then continue with `/teacher/final`.

### QA Deployment And Live Verification

- Commit: `bc5d750`.
- QA preview: `https://system-project-math-sci-iobd4wbwc-lordtd-hubs-projects.vercel.app`.
- Classic mode rendered the existing Progress 2 page with `.teacher-workload-summary`.
- Figma mode rendered `.figma-role-shell`, `.figma-teacher-progress2`, and 5 KPI cards.
- Current QA state had no Progress 2 scoring items, so the Figma empty state was expected.
- No shell-only page, digest/application error, or unauthorized teacher guard appeared.
- Screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-progress2-classic-iobd4wbwc.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-progress2-figma-iobd4wbwc.png`

### Next Phase

Continue Phase 4 with `/teacher/final`, preserving Final scoring semantics and required reviewer behavior.

## 2026-05-14 - Phase 4 Teacher Final Figma Renderer Local Patch

### Scope

Continued the teacher page-level renderer split with `/teacher/final`.

### Redesign Applied

- Kept the existing Final scoring page as the `classic` fallback.
- Added a `figma` branch using shared visual primitives:
  - Figma page header;
  - KPI cards;
  - action-first Final scoring queue;
  - Project Review Detail-style two-column layout;
  - Final evidence continuity and rubric context on the left;
  - existing Final scoring form on the right.
- Preserved the existing "no Final round yet" empty-state behavior in Figma mode.
- Preserved the same `submitFinalPresentationScore` server action, hidden `project_id` field, `condition_count` selects, Final QA rubric mapping, Markdown feedback editor, and confirmation submit button.

### Logic Touched

No.

The patch is presentation-only. It does not change auth, lifecycle, scoring, required reviewer completion, eligibility, schema, server actions, API contracts, route behavior, evidence continuity behavior, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- teacher` - passed, 5 files / 22 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 354 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Next Phase

Continue Phase 4 with `/teacher/reports`.

### QA Deployment And Live Verification

- Commit: `202d825`.
- QA preview: `https://system-project-math-sci-hm6cz5z28-lordtd-hubs-projects.vercel.app`.
- Classic mode rendered the existing Final scoring page with `.teacher-workload-summary`.
- Figma mode rendered `.figma-role-shell`, `.figma-teacher-final`, and 5 KPI cards.
- Current QA state had no Final scoring items, so `.figma-final-row` and `.figma-review-layout` counts were 0 and the empty state was expected.
- No shell-only page, digest/application error, login fallback, or unauthorized teacher guard appeared.
- Screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-final-classic-hm6cz5z28.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-final-figma-hm6cz5z28.png`

### Live QA Regression Found And Patched

- Live QA on `https://system-project-math-sci-lirwkespy-lordtd-hubs-projects.vercel.app` found a Major UI regression: switching UI modes could leave `/teacher` as a shell-only page.
- Root cause: the UI mode server action updated the cookie without redirecting back to the current route, and the first classic wrapper abstraction made fallback rendering harder to recover safely.
- Patch:
  - `setUiModeAction` now redirects back to the current referer path after setting the cookie.
  - `/teacher` classic mode now returns the original dashboard JSX directly as the safest fallback.
- Validation after patch:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test -- figmaUiMode teacherDashboardSource` - passed.
  - `cmd /c npm.cmd test` - passed, 82 files / 351 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.

## 2026-05-14 - Phase 4 Teacher Reports Figma Renderer Local Patch

### Scope

Continued the teacher page-level renderer split with `/teacher/reports`.

### Redesign Applied

- Kept the existing report review page as the `classic` fallback.
- Added a `figma` branch using shared visual primitives:
  - Figma page header;
  - KPI cards for action/waiting/completed/returned/locked report states;
  - compact report queue rows;
  - Project Review Detail-style two-column layout;
  - report version, revision note, review history, and report history context on the left;
  - existing latest-version review form on the right.
- Preserved the same `reviewReportVersion` server action, hidden `report_version_id` field, PASS/FAIL decision buttons, Markdown feedback editor/viewer, latest-version checks, required reviewer completion checks, and revision request waiting state.

### Logic Touched

No.

The patch is presentation-only. It does not change auth, report latest-version semantics, reviewer authorization, advisor-score unlock, lifecycle, schema, server actions, API contracts, route behavior, Markdown/KaTeX behavior, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- teacher` - passed, 5 files / 23 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 355 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Next Phase

Continue Phase 4 with `/teacher/advisor-score`.

### QA Deployment And Live Verification

- Commit: `ce29c9d`.
- QA preview: `https://system-project-math-sci-525grp3qo-lordtd-hubs-projects.vercel.app`.
- Classic mode rendered the existing report review page with `.teacher-workload-summary`.
- Figma mode rendered `.figma-role-shell`, `.figma-teacher-reports`, and 5 KPI cards.
- Current QA state had no report review items, so `.figma-report-row`, `.figma-review-layout`, and `report_version_id` form counts were 0 and the empty state was expected.
- No shell-only page, digest/application error, login fallback, or unauthorized teacher guard appeared.
- Screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-reports-classic-525grp3qo.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-reports-figma-525grp3qo.png`

## 2026-05-14 - Phase 4 Teacher Advisor Score Figma Renderer Local Patch

### Scope

Continued the teacher page-level renderer split with `/teacher/advisor-score`.

### Redesign Applied

- Kept the existing Advisor Score page as the `classic` fallback.
- Added a `figma` branch using shared visual primitives:
  - Figma page header;
  - KPI cards for action/waiting/completed/locked advisor score states;
  - compact advisor-score queue rows;
  - Project Review Detail-style two-column layout;
  - latest report and submitted advisor score context on the left;
  - existing advisor score form or read-only/waiting state on the right.
- Preserved the same `submitAdvisorScore` server action, hidden `project_id` field, `advisorCriteria` score fields, `fieldName` mapping, existing unlock condition, Markdown feedback editor/viewer, and confirmation submit button.

### Logic Touched

No.

The patch is presentation-only. It does not change auth, advisor-score unlock, score calculation, lifecycle, schema, server actions, API contracts, route behavior, Markdown/KaTeX behavior, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- teacher` - passed, 5 files / 24 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 356 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Next Phase

Move to the teacher mobile/regression pass.

### QA Deployment And Live Verification

- Commit: `2a1c062`.
- QA preview: `https://system-project-math-sci-2vcb55iii-lordtd-hubs-projects.vercel.app`.
- Classic mode rendered the existing Advisor Score page with `.teacher-workload-summary`.
- Figma mode rendered `.figma-role-shell`, `.figma-teacher-advisor-score`, 5 KPI cards, 3 advisor-score rows, and 3 review layouts.
- Current QA state had no editable advisor-score forms for the signed-in teacher, so `project_id` and score input counts were 0 and the read-only/locked states were expected.
- No shell-only page, digest/application error, login fallback, or unauthorized teacher guard appeared.
- Screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-advisor-score-classic-2vcb55iii.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-advisor-score-figma-2vcb55iii.png`

## 2026-05-14 - Phase 4 Teacher Mobile Overflow Patch

### Scope

Started the teacher mobile pass on the latest QA preview and checked `/teacher`, `/teacher/schedules`, `/teacher/proposals`, `/teacher/progress1`, `/teacher/progress2`, `/teacher/final`, `/teacher/reports`, and `/teacher/advisor-score` at 390px in Figma mode.

### Finding

- All checked teacher pages rendered without shell-only pages, digest/application errors, login fallback, or clipped actions.
- The shared Figma role shell caused a small 4px horizontal overflow on mobile (`docWidth 394` at a 390px viewport).

### Patch

- Removed the base mobile negative horizontal margin from `.figma-role-shell`.
- Kept the existing wider breakpoint margins for larger screens.

### Logic Touched

No.

The patch is CSS-only and does not change auth, lifecycle, scoring, eligibility, schema, server actions, API contracts, route behavior, Markdown/KaTeX behavior, or production configuration.

### Validation

- `cmd /c npm.cmd test` - passed, 82 files / 356 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.
- `cmd /c npm.cmd run typecheck` - passed after rerun.
- Note: one earlier typecheck attempt failed while `next build` was simultaneously regenerating `.next/types`; rerunning typecheck after build completed passed.

### Next Phase

Commit/push to QA preview, rerun the teacher 390px mobile audit, then continue teacher regression verification.

### QA Deployment And Mobile Verification

- Commit: `c142965`.
- QA preview: `https://system-project-math-sci-c2f2cvutx-lordtd-hubs-projects.vercel.app`.
- Re-ran the 390px Figma mobile audit on:
  - `/teacher`;
  - `/teacher/schedules`;
  - `/teacher/proposals`;
  - `/teacher/progress1`;
  - `/teacher/progress2`;
  - `/teacher/final`;
  - `/teacher/reports`;
  - `/teacher/advisor-score`.
- Result:
  - all checked pages had `docWidth = 390` at a 390px viewport;
  - no horizontal overflow;
  - no clipped actions;
  - no shell-only page;
  - no digest/application error;
  - no login fallback.
- Saved screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-dashboard-mobile-c2f2cvutx.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-schedules-mobile-c2f2cvutx.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-proposals-mobile-c2f2cvutx.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-progress1-mobile-c2f2cvutx.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-progress2-mobile-c2f2cvutx.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-final-mobile-c2f2cvutx.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-reports-mobile-c2f2cvutx.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-advisor-score-mobile-c2f2cvutx.png`

### Teacher Classic/Figma Regression Smoke

- Ran a non-mutating desktop smoke check across the same teacher routes in both `classic` and `figma` modes.
- Classic mode rendered `.teacher-workload-summary` and no Figma shell on all checked routes.
- Figma mode rendered `.figma-role-shell` and no classic workload summary on all checked routes.
- No checked route showed a digest/application error or login fallback.

### Phase Result

Teacher redesign, teacher mobile pass, and teacher non-mutating regression smoke are complete.

### Next Phase

Begin Phase 5 Admin redesign, starting with `/admin/rounds` and `/admin/closeout`.

## 2026-05-14 - Phase 5 Admin Figma Renderer Batch 1

### Scope

Continued Phase 5 Admin redesign with the first admin operational batch:

- `/admin/rounds`
- `/admin/closeout`
- `/admin/schedules`
- `/admin/evidence`

### Patch

- Added page-level Figma renderer branches for the four routes above.
- Kept the existing classic renderers as the fallback path.
- Preserved all existing data fetching, auth guards, server actions, route behavior, and permissions in the page/server components.
- `/admin/rounds` now shows a Figma-mode operational shell with KPI cards, round bucket panels, ready/not-ready separation, and visually separated open/close/reset actions.
- `/admin/closeout` now shows a Figma-mode closeout queue with Needs admin action, Waiting, Completed, and per-project closeout details.
- `/admin/schedules` now shows a Figma-mode schedule queue separated into action, returned/revision, and completed groups.
- `/admin/evidence` now shows a Figma-mode evidence/export dashboard with clearer export cards, grade CSV labeling, project evidence table, timeline, and audit summaries.

### Logic Touched

No business logic was changed.

The patch is presentation-only and does not change lifecycle, auth, scoring, eligibility, schema, server action semantics, route behavior, Markdown/KaTeX behavior, export route behavior, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- admin` - passed, 16 files / 63 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 356 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.
- Build initially emitted one unused-variable lint warning in `/admin/closeout`; it was patched and the full validation cycle was rerun successfully.

### Remaining Admin Work

- `/admin/proposals` still needs the same page-level Figma renderer split. It is intentionally left as the next careful admin page because it combines proposal final decision, feedback release, and proposal round close forms.
- `/admin/reports` is listed in planning artifacts but no real `src/app/admin/reports/page.tsx` route exists in the current repo; report operational evidence is currently surfaced through teacher/student report pages and `/admin/evidence`.

### Next Phase

Deploy/live-verify the first admin batch if a QA checkpoint is needed, then continue Phase 5 with `/admin/proposals`.

## 2026-05-14 - Phase 5 Admin Proposals Figma Renderer

### Scope

Continued Phase 5 Admin redesign with the remaining real admin proposal route:

- `/admin/proposals`

### Patch

- Added a page-level Figma renderer branch for `/admin/proposals`.
- Kept the existing proposal summary page as the classic fallback.
- Reused the shared Figma visual primitives for KPI cards, action-first proposal rows, warning panels, and a two-column review/action layout.
- Preserved the existing proposal data query, admin guard, proposal score summary source, final decision form, feedback release form, Proposal round close acknowledgement, hidden fields, confirmation messages, Markdown+KaTeX viewers, and route behavior.
- Added a reusable Edge CDP verifier for admin classic/figma renderer mode checks.

### Logic Touched

No business logic was changed.

The patch is presentation-only and does not change lifecycle, auth, scoring, eligibility, schema, server action semantics, route behavior, Markdown/KaTeX behavior, export route behavior, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed after escaping one JSX text `>=` marker.
- `cmd /c npm.cmd test -- admin` - passed, 16 files / 64 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 357 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.
- Secret scan over touched source/redesign artifacts returned no matches.

### QA Deployment And Live Verification

- Commit: `056526f`.
- QA preview: `https://system-project-math-sci-b4pwwud5y-lordtd-hubs-projects.vercel.app`.
- Live verification used the persistent Edge CDP session and explicitly selected the `admin` role dropdown before submitting QA login.
- Checked `classic` and `figma` mode for:
  - `/admin/rounds`;
  - `/admin/closeout`;
  - `/admin/proposals`;
  - `/admin/schedules`;
  - `/admin/evidence`.
- Desktop result:
  - classic mode rendered without `.figma-role-shell` and without page-specific Figma route classes;
  - figma mode rendered `.figma-role-shell` and the expected page-specific route class;
  - no shell-only page, digest/application error, login fallback, or detected overflow.
- 390px mobile result:
  - all checked routes had `docWidth = 390`;
  - no horizontal overflow;
  - classic/figma mode separation remained correct;
  - no shell-only page, digest/application error, or login fallback.

### Screenshots

- `e2e-artifacts/redesign-mapping/screenshots/admin-rounds-renderer-figma-desktop-b4pwwud5y.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-closeout-renderer-figma-desktop-b4pwwud5y.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-proposals-renderer-figma-desktop-b4pwwud5y.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-schedules-renderer-figma-desktop-b4pwwud5y.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-evidence-renderer-figma-desktop-b4pwwud5y.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-rounds-renderer-figma-mobile-b4pwwud5y.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-closeout-renderer-figma-mobile-b4pwwud5y.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-proposals-renderer-figma-mobile-b4pwwud5y.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-schedules-renderer-figma-mobile-b4pwwud5y.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-evidence-renderer-figma-mobile-b4pwwud5y.png`

### Phase Result

Real Admin redesign routes in the current repo are complete for non-mutating visual/regression verification.

### Next Phase

Continue Phase 6 Student redesign, starting with `/student` and then `/student/project`, `/student/proposal`, `/student/schedule`, `/student/report`, and `/student/feedback`.

## 2026-05-14 - Phase 6 Student Dashboard Figma Renderer

### Scope

Started Phase 6 Student redesign with the primary student landing route:

- `/student`

### Patch

- Added a conservative page-level Figma renderer branch for `/student`.
- Kept the existing student dashboard as the classic fallback.
- Reused shared Figma visual primitives for page header, KPI cards, next-action panel, workflow grouping, compact assessment/result rows, and side panels.
- Preserved the existing student guard, data query, lifecycle next-action source, schedule state source, report action source, feedback/result links, committee display, timeline evidence, and Markdown+KaTeX timeline/comment rendering.
- No student form/server action was added or changed on this route.

### Logic Touched

No business logic was changed.

The patch is presentation-only and does not change lifecycle, auth, scoring, eligibility, schema, server action semantics, route behavior, Markdown/KaTeX behavior, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- studentDashboardSource studentReadabilityStabilization` - passed, 2 files / 8 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 358 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Next Phase

Deploy/live-verify `/student` classic/figma mode, then continue Phase 6 with `/student/project`.

### QA Deployment And Live Verification

- Commit: `4174383`.
- QA preview: `https://system-project-math-sci-844q8gqj9-lordtd-hubs-projects.vercel.app`.
- Live verification used the persistent Edge CDP session and explicitly selected the `student` role dropdown before submitting QA login.
- Checked `/student` in `classic` and `figma` mode.
- Desktop result:
  - classic mode rendered the classic action queue and no Figma dashboard class;
  - figma mode rendered `.figma-role-shell` and `.figma-student-dashboard`;
  - no shell-only page, digest/application error, login fallback, or detected overflow.
- 390px mobile result:
  - classic/figma mode separation remained correct;
  - `docWidth = 390`;
  - no horizontal overflow;
  - no shell-only page, digest/application error, or login fallback.

### Screenshots

- `e2e-artifacts/redesign-mapping/screenshots/student-dashboard-renderer-figma-desktop-844q8gqj9.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-dashboard-renderer-figma-mobile-844q8gqj9.png`

### Phase Result

Student dashboard renderer is complete and live-verified.

### Next Phase

Continue Phase 6 with `/student/project`.

## 2026-05-14 - Phase 6 Student Project Figma Renderer

### Scope

Continued Phase 6 Student redesign with:

- `/student/project`

### Patch

- Added a conservative page-level Figma renderer branch for the project/advisor request page.
- Kept the existing project page as the classic fallback.
- Reused the same `DraftPreservingForm`, `saveProjectOrigin` action, material link field, Markdown+KaTeX editors/viewer, declaration checkbox, draft-save button, and submit button contract.
- Extracted the project-origin field JSX into a shared in-page render block so classic and figma modes render the same form fields.
- Added an action-first Figma layout with project/advisor status metrics, waiting/done separation, latest advisor request panel, and a right-side form panel.
- Extended the student Edge CDP verifier to check `/student/project` in both classic and figma mode, including required form field presence.

### Logic Touched

No business logic was changed.

The patch is presentation-only and does not change lifecycle, auth, scoring, eligibility, schema, server action semantics, route behavior, Markdown/KaTeX behavior, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- studentDashboardSource studentReadabilityStabilization` - passed, 2 files / 9 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 359 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Next Phase

Push QA preview, live-verify `/student/project` classic/figma mode on desktop and 390px mobile, then continue Phase 6 with `/student/proposal`.

### QA Deployment And Live Verification

- Commit: `1ad318e`.
- QA preview: `https://system-project-math-sci-8rztp26xw-lordtd-hubs-projects.vercel.app`.
- Live verification used the persistent Edge CDP session and explicitly selected the `student` role dropdown before submitting QA login.
- Checked `/student` and `/student/project` in `classic` and `figma` mode.
- `/student/project` desktop result:
  - classic mode rendered no `.figma-role-shell` and no `.figma-student-project`;
  - figma mode rendered `.figma-role-shell` and `.figma-student-project`;
  - both modes kept draft-save, submit button, and required form fields;
  - no shell-only page, digest/application error, login fallback, or detected overflow.
- `/student/project` 390px mobile result:
  - classic/figma mode separation remained correct;
  - `docWidth = 390`;
  - all required form fields remained present;
  - no horizontal overflow, shell-only page, digest/application error, or login fallback.
- Verifier note: the first live run revealed a selector mismatch in the verifier for the classic readability summary; the verifier was corrected to use the component's `data-testid` and then passed.

### Screenshots

- `e2e-artifacts/redesign-mapping/screenshots/student-project-renderer-figma-desktop-8rztp26xw.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-project-renderer-figma-mobile-8rztp26xw.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-dashboard-renderer-figma-desktop-8rztp26xw.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-dashboard-renderer-figma-mobile-8rztp26xw.png`

### Phase Result

Student project renderer is complete and live-verified.

### Next Phase

Continue Phase 6 with `/student/proposal`.

## 2026-05-14 - Phase 6 Student Proposal Figma Renderer

### Scope

Continued Phase 6 Student redesign with:

- `/student/proposal`

### Patch

- Added a conservative page-level Figma renderer branch for the Proposal submission page.
- Kept the existing Proposal page content, rubric, submitted summary, comments, late/exception warnings, and submission form behavior as the classic fallback contract.
- Added Figma page header, status badge, and KPI cards for actionable, waiting, submitted, and visible-comment states.
- Preserved `ProposalDraftForm`, `saveProposalSubmission`, proposal draft-save, submit button, material link field, timeline builder, Markdown+KaTeX editors/viewer, and every existing form field name.
- Extended the student Edge CDP verifier to check `/student/proposal` in both classic and figma mode, accepting either the live form state or submitted-summary state.

### Logic Touched

No business logic was changed.

The patch is presentation-only and does not change lifecycle, auth, scoring, eligibility, schema, server action semantics, route behavior, Markdown/KaTeX behavior, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- studentDashboardSource studentReadabilityStabilization` - passed, 2 files / 10 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 360 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Next Phase

Push QA preview, live-verify `/student/proposal` classic/figma mode on desktop and 390px mobile, then continue Phase 6 with `/student/schedule`.

### QA Deployment And Live Verification

- Commit: `8222947`.
- QA preview: `https://system-project-math-sci-oz0raz5on-lordtd-hubs-projects.vercel.app`.
- Live verification used the persistent Edge CDP session and explicitly selected the `student` role dropdown before submitting QA login.
- Checked `/student`, `/student/project`, and `/student/proposal` in `classic` and `figma` mode.
- `/student/proposal` desktop result:
  - current QA state rendered the submitted-summary state rather than the editable form;
  - classic mode rendered no `.figma-role-shell` and no `.figma-student-proposal`;
  - figma mode rendered `.figma-role-shell` and `.figma-student-proposal`;
  - submitted summary remained present;
  - no shell-only page, digest/application error, login fallback, or detected overflow.
- `/student/proposal` 390px mobile result:
  - classic/figma mode separation remained correct;
  - `docWidth = 390`;
  - submitted summary remained present;
  - no horizontal overflow, shell-only page, digest/application error, or login fallback.

### Screenshots

- `e2e-artifacts/redesign-mapping/screenshots/student-proposal-renderer-figma-desktop-oz0raz5on.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-proposal-renderer-figma-mobile-oz0raz5on.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-project-renderer-figma-desktop-oz0raz5on.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-project-renderer-figma-mobile-oz0raz5on.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-dashboard-renderer-figma-desktop-oz0raz5on.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-dashboard-renderer-figma-mobile-oz0raz5on.png`

### Phase Result

Student proposal renderer is complete and live-verified for the current submitted-summary state.

### Next Phase

Continue Phase 6 with `/student/schedule`.

## 2026-05-14 - Phase 6 Student Schedule Figma Renderer

### Scope

Continued Phase 6 Student redesign with:

- `/student/schedule`

### Patch

- Added a conservative page-level Figma renderer branch for the assessment evidence and schedule page.
- Kept the existing schedule/evidence forms, round guidance, rubric panels, post-submit success branch, and schedule history behavior as the classic fallback contract.
- Added Figma page header, status badge, and KPI cards for actionable, waiting, completed, and locked/not-ready round states.
- Preserved `saveAssessmentEvidence`, `submitExamSchedule`, `DraftPreservingForm`, schedule draft storage key, round-specific evidence forms, `student-schedule-page-content`, and the `assessment_evidence_saved` success render branch.
- Extended the student Edge CDP verifier to check `/student/schedule` in both classic and figma mode.

### Logic Touched

No business logic was changed.

The patch is presentation-only and does not change lifecycle, auth, scoring, eligibility, schema, server action semantics, route behavior, Markdown/KaTeX behavior, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- studentDashboardSource studentReadabilityStabilization postSubmitStabilizationSource scheduleProgressSource` - passed, 4 files / 26 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 361 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### QA Deployment And Live Verification

- Commit: `f052895`.
- QA preview: `https://system-project-math-sci-9ugiisk0v-lordtd-hubs-projects.vercel.app`.
- Live QA verification passed with the persistent Edge CDP session.
- QA login guard: the verifier explicitly selected the `student` role dropdown before the student identity and used the QA secret only as a process-scoped environment value.
- Desktop verification passed:
  - `/student` classic/figma renderer comparison;
  - `/student/project` classic/figma renderer comparison;
  - `/student/proposal` classic/figma renderer comparison;
  - `/student/schedule` classic/figma renderer comparison.
- 390px mobile verification passed for the same route set.
- `/student/schedule` classic mode rendered no `.figma-role-shell`, no `.figma-student-schedule`, retained `student-schedule-page-content`, and retained the classic readability summary.
- `/student/schedule` figma mode rendered `.figma-role-shell`, `.figma-student-schedule`, and retained `student-schedule-page-content`.
- No shell-only page, digest/application error, login fallback, or horizontal overflow was detected.
- Screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/student-schedule-renderer-figma-desktop-9ugiisk0v.png`
  - `e2e-artifacts/redesign-mapping/screenshots/student-schedule-renderer-figma-mobile-9ugiisk0v.png`
  - `e2e-artifacts/redesign-mapping/screenshots/student-dashboard-renderer-figma-desktop-9ugiisk0v.png`
  - `e2e-artifacts/redesign-mapping/screenshots/student-dashboard-renderer-figma-mobile-9ugiisk0v.png`
  - `e2e-artifacts/redesign-mapping/screenshots/student-project-renderer-figma-desktop-9ugiisk0v.png`
  - `e2e-artifacts/redesign-mapping/screenshots/student-project-renderer-figma-mobile-9ugiisk0v.png`
  - `e2e-artifacts/redesign-mapping/screenshots/student-proposal-renderer-figma-desktop-9ugiisk0v.png`
  - `e2e-artifacts/redesign-mapping/screenshots/student-proposal-renderer-figma-mobile-9ugiisk0v.png`

### Next Phase

Continue Phase 6 with `/student/report`.

## 2026-05-14 - Phase 6 Student Report Figma Renderer

### Scope

Continued Phase 6 Student redesign with:

- `/student/report`

### Patch

- Added a conservative page-level Figma renderer branch for the report submission and revision page.
- Kept the existing report gate, report submission form, revision note editor, report version history, reviewer comments, and Markdown/KaTeX rendering as the classic fallback contract.
- Added Figma page header, status badge, and KPI cards for do-now, waiting-for-review, approved, and report-history states.
- Preserved `submitReportVersion`, `DraftPreservingForm`, `report_drive_link`, `report_note`, `student-report-draft`, `getReportSubmissionGate`, latest-version/revision state display, reviewer display names, and report history.
- Extended the student Edge CDP verifier to check `/student/report` in both classic and figma mode.

### Logic Touched

No business logic was changed.

The patch is presentation-only and does not change auth, lifecycle, scoring, eligibility, report approval semantics, latest-version semantics, schema, server action semantics, route behavior, Markdown/KaTeX behavior, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- studentDashboardSource studentReadabilityStabilization` - passed, 2 files / 12 tests.
- `node --check e2e-artifacts/redesign-mapping/verify-student-renderer-modes-cdp.js` - passed.
- `cmd /c npm.cmd test` - passed, 82 files / 362 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### QA Deployment And Live Verification

- Commit: `42eda48`.
- QA preview: `https://system-project-math-sci-cnjb5ikb1-lordtd-hubs-projects.vercel.app`.
- Live QA verification passed with the persistent Edge CDP session.
- QA login guard: the verifier explicitly selected the `student` role dropdown before the student identity and used the QA secret only as a process-scoped environment value.
- Desktop verification passed for `/student`, `/student/project`, `/student/proposal`, `/student/schedule`, and `/student/report` in classic/figma mode.
- 390px mobile verification passed for the same route set.
- `/student/report` classic mode rendered no `.figma-role-shell`, no `.figma-student-report`, retained `student-report-page-content`, retained the classic readability summary, and showed report history/status content.
- `/student/report` figma mode rendered `.figma-role-shell`, `.figma-student-report`, retained `student-report-page-content`, and showed report history/status content.
- Current QA state does not show an active report form for Student01; the verifier checks form fields only when the report form is present, and the source test preserves the form contract.
- No shell-only page, digest/application error, login fallback, or horizontal overflow was detected.
- Screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/student-report-renderer-figma-desktop-cnjb5ikb1.png`
  - `e2e-artifacts/redesign-mapping/screenshots/student-report-renderer-figma-mobile-cnjb5ikb1.png`

### Next Phase

Continue Phase 6 with `/student/feedback`.

## 2026-05-14 - Phase 6 Student Feedback Figma Renderer

### Scope

Continued Phase 6 Student redesign with:

- `/student/feedback`

### Patch

- Added a conservative page-level Figma renderer branch for the read-only assessment results and feedback page.
- Kept the existing score aggregation, round filtering, evaluator snapshot names, rubric score item display, and Markdown/KaTeX comment rendering as the classic fallback contract.
- Added Figma page header, status badge, and KPI cards for readable results, waiting rounds, current filter, and read-only state.
- Preserved `feedbackTabs`, `scoreAverage`, `formatScore`, `MarkdownLatexViewer`, `scoreSubmission?.overallComment`, `scoreSubmission.scoreItems`, and `evaluatorDisplayNameSnapshot`.
- Extended the student Edge CDP verifier to check `/student/feedback` in both classic and figma mode.

### Logic Touched

No business logic was changed.

The patch is presentation-only and does not change auth, lifecycle, scoring, eligibility, feedback visibility, schema, server action semantics, route behavior, Markdown/KaTeX behavior, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- studentDashboardSource studentReadabilityStabilization` - passed, 2 files / 13 tests.
- `node --check e2e-artifacts/redesign-mapping/verify-student-renderer-modes-cdp.js` - passed.
- `cmd /c npm.cmd test` - passed, 82 files / 363 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### QA Deployment And Live Verification

- Commit: `67ce08a`.
- QA preview: `https://system-project-math-sci-muaccmm4j-lordtd-hubs-projects.vercel.app`.
- Live QA verification passed with the persistent Edge CDP session.
- QA login guard: the verifier explicitly selected the `student` role dropdown before the student identity and used the QA secret only as a process-scoped environment value.
- Desktop verification passed for `/student`, `/student/project`, `/student/proposal`, `/student/schedule`, `/student/report`, and `/student/feedback` in classic/figma mode.
- 390px mobile verification passed for the same route set.
- `/student/feedback` classic mode rendered no `.figma-role-shell`, no `.figma-student-feedback`, retained `student-feedback-page-content`, showed feedback tabs, and showed score/status content.
- `/student/feedback` figma mode rendered `.figma-role-shell`, `.figma-student-feedback`, retained `student-feedback-page-content`, showed feedback tabs, and showed score/status content.
- No shell-only page, digest/application error, login fallback, or horizontal overflow was detected.
- Screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/student-feedback-renderer-figma-desktop-muaccmm4j.png`
  - `e2e-artifacts/redesign-mapping/screenshots/student-feedback-renderer-figma-mobile-muaccmm4j.png`

### Next Phase

Move to the student mobile/regression summary, then continue the broader Phase 7/8 redesign regression pass.

## 2026-05-14 - Phase 7/8 Global Mobile And Classic/Figma Non-Mutating Regression

### Scope

Ran the full non-mutating visual regression pass against the latest QA preview after Student pages were completed.

Verified route groups:

- Teacher:
  - `/teacher`
  - `/teacher/schedules`
  - `/teacher/proposals`
  - `/teacher/progress1`
  - `/teacher/progress2`
  - `/teacher/final`
  - `/teacher/reports`
  - `/teacher/advisor-score`
- Admin:
  - `/admin`
  - `/admin/rounds`
  - `/admin/closeout`
  - `/admin/proposals`
  - `/admin/schedules`
  - `/admin/evidence`
- Student:
  - `/student`
  - `/student/project`
  - `/student/proposal`
  - `/student/schedule`
  - `/student/report`
  - `/student/feedback`

### Live Verification

- QA preview: `https://system-project-math-sci-jbdhfqgzt-lordtd-hubs-projects.vercel.app`.
- Tooling: persistent Edge CDP verifiers.
- Viewports:
  - desktop 1440px;
  - mobile 390px.
- QA login guard:
  - teacher verifier selected `#role = teacher`;
  - admin verifier selected `#role = admin`;
  - student verifier selected `#role = student`.
- Result:
  - teacher routes passed desktop and mobile;
  - admin routes passed desktop and mobile;
  - student routes passed desktop and mobile;
  - no shell-only page, digest/application error, login fallback, unauthorized guard page, or horizontal overflow was detected.
- Classic/Figma student comparison passed for all student routes now in the renderer split.

### Remaining Gate

The visual/mobile/classic-vs-figma non-mutating regression is complete.

The full Figma redesign is not yet production-complete because Phase 9 mutating workflow regression still needs a safe QA action window with actionable schedule, scoring, report revision, advisor-score, round open/close, and closeout states. Current Wave 1 QA state is already completed, so the next mutating pass should be run in Wave 2 or a preserved test offering rather than forcing old Wave 1 state.

## 2026-05-14 - Phase 9 Readiness Patch

### Scope

Prepared a safe QA data path for Phase 9 mutating workflow regression after confirming both Wave 1 and Wave 2 12-project data are completed historical evidence.

### Patch

- Added a QA-only `MULTI-PILOT-R2 Redesign Regression Course Offering` setup path.
- The new setup reuses the approved 12-project Wave 2 mix and existing QA identities, but creates/reuses a separate course offering in a later academic year.
- Wave 1 and Wave 2 completed data are preserved and not reset.
- Added source coverage for the new isolated redesign regression offering and QA setup guard.

### Logic Touched

No lifecycle, scoring, eligibility, auth, schema, server action semantics, or production configuration was changed.

The patch only adds a QA setup entry point so Phase 9 can mutate a fresh safe offering instead of completed historical evidence.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- src/app/qaLoginSource.test.ts src/lib/qa/multiPilotR2.test.ts` - passed, 2 files / 12 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 364 tests.
- `cmd /c npm.cmd run build` - passed.

### Next Phase

Deploy to QA, prepare the redesign regression offering from `/qa-login`, then run Phase 9 mutating workflow regression in classic and figma mode on that offering.

## 2026-05-14 - Phase 9 Dual-State Regression Setup

### Scope

Prepared Phase 9 to run mutating workflow regression in both UI modes without mutating completed Wave 1 or completed Wave 2 evidence.

### Patch

- Added a second QA-only isolated course offering for Figma-mode mutating regression:
  - `MULTI-PILOT-R2 Redesign Figma Regression Course Offering`
  - Semester 1 BE 2573
- Kept the existing redesign regression offering as the classic-mode safe state:
  - `MULTI-PILOT-R2 Redesign Regression Course Offering`
  - Semester 1 BE 2572
- Added a QA-login setup action and form for the Figma regression offering.
- Made the CDP setup helper reusable by input id/success text/offering text.
- Added a CDP helper to set the `project_ui_mode` cookie to `classic` or `figma` before running mutating scripts.

### Logic Touched

No workflow logic was changed.

The patch only adds QA-only setup and verification tooling. It does not change lifecycle, scoring, eligibility, auth, schema, server action semantics for real users, route behavior, or production configuration.

### Validation

- `node --check e2e-artifacts/redesign-mapping/prepare-redesign-regression-offering-cdp.js` - passed.
- `node --check e2e-artifacts/redesign-mapping/set-ui-mode-cdp.js` - passed.
- `cmd /c npm.cmd test -- src/app/qaLoginSource.test.ts src/lib/qa/multiPilotR2.test.ts` - passed, 2 files / 12 tests.
- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test` - passed, 82 files / 364 tests.
- `cmd /c npm.cmd run build` - passed.
- Secret scan over `src`, redesign artifacts, and `IMPLEMENTATION_PROGRESS.md` found no QA/database secret fragments.

### Next Phase

Commit and deploy the dual-state setup to QA, prepare the second Figma regression offering from `/qa-login`, then run Phase 9 mutating workflow regression with classic and figma safe states.

## 2026-05-14 - Phase 9 Figma Regression Visual Density Correction

### Scope

Continued Phase 9 on the safe `MULTI-PILOT-R2 Redesign Figma Regression Course Offering` in `figma` mode. During Progress 1 student/schedule approval regression, live visual review showed that the student schedule KPI/summary area was duplicated and status badges/cards were too large for their operational value.

### Patch

- Kept the `classic` student schedule readability summary intact as fallback.
- Hid the duplicate `StudentReadabilitySummary` on `/student/schedule` only when `figma` mode is active, leaving the Figma KPI row as the single status summary.
- Reduced Figma metric card padding, number size, label spacing, and description height.
- Reduced shared admin/teacher queue badge padding and font scale.
- Added internal vertical scroll for teacher compact queue lists and admin queue sections when a list exceeds 5 items.
- Slightly compacted the Figma role sidebar and navigation spacing.
- Updated Phase 9 pilot scripts so the Wave 2 automation can target the Figma regression offering title without hard-coded Wave 2-only guards.

### Logic Touched

No business logic was changed.

The patch is presentation/tooling only. It does not change lifecycle, auth, scoring, eligibility, schema, API semantics, permissions, server actions, route behavior, or production configuration.

### Validation

- `node --check` for the modified Wave 2 CDP scripts - passed.
- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- src/app/student/schedule src/components/ui/TeacherWorkloadQueue src/components/ui/AdminOperationalQueue src/app/teacher/teacherWorkloadUxSource.test.ts src/app/admin/rounds/roundsUx.test.ts` - passed, 3 matching files / 24 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 364 tests.
- `cmd /c npm.cmd run build` - passed.

### Current Phase 9 State

Figma-mode mutating regression has reached Progress 1 schedule approval for the safe regression offering. Proposal workflow, late Proposal recovery, committee assignment, Progress 1 student submissions, and Progress 1 schedule approvals have passed so far.

### Next Phase

Commit and deploy this visual-density/tooling correction to QA. After the new QA preview is ready, resume Phase 9 from the same database state using the new preview URL, starting with Progress 1 scoring.

## 2026-05-14 - Phase 9 Figma Chrome / Badge Density Follow-up

### Scope

Addressed live visual feedback during Phase 9 that Figma-mode status badges, KPI/status blocks, long queues, and the role navigator still consumed too much space for their operational value.

### Patch

- Converted the Figma role sidebar into a compact icon-first rail with hover/focus tooltips while preserving the same role routes and links.
- Reduced the global Figma KPI card height, padding, number size, label size, border weight, and description height.
- Made Figma status badges and project status badges compact/truncated with full text available through the native title tooltip.
- Kept row-like status/action groups on one row with horizontal overflow instead of awkward multi-line badge wrapping.
- Added internal vertical scroll behavior for repeated Figma action/schedule/attempt/notification lists once they exceed five items.
- Widened the Figma review/action column so form-heavy pages give more space to inputs and scoring forms.

### Logic Touched

No business logic was changed.

The patch is UI/CSS/component-only. It does not change lifecycle, auth, scoring, eligibility, schema, API semantics, permissions, guards, server actions, route behavior, QA data, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- src/app/figmaUiModeSource.test.ts src/app/teacher/teacherWorkloadUxSource.test.ts src/components/ui/uiFoundation.test.ts` - passed, 3 files / 20 tests.
- `cmd /c npm.cmd test` - passed, 82 files / 365 tests.
- `cmd /c npm.cmd run build` - passed.

### Current Phase 9 State

Phase 9 Figma-mode mutating regression remains in progress on the safe Figma regression offering. Progress 1 close/recovery, Progress 1 Project10 recovery/scoring, Progress 2 opening, Progress 2 student submissions, and Progress 2 schedule approval have passed after the previous QA deployment.

### Next Phase

Commit and deploy this compact chrome/badge follow-up to QA, live-check the student schedule page and one teacher workload page in Figma mode, then resume Phase 9 from Progress 2 scoring on the latest QA preview URL.

## 2026-05-14 - Phase 9 Figma Navigator Icon Follow-up

### Scope

Refined the compact Figma role navigator after live feedback that the narrowed rail worked, but text abbreviations such as `IN` and `SC` still felt less intuitive than visual icons.

### Patch

- Replaced Figma role navigator text abbreviations with small inline SVG icons.
- Added route-specific icons for workload inbox, schedules, Proposal, Progress 1, Progress 2, Final, reports, advisor score, admin closeout, evidence, student project, and feedback.
- Preserved the existing tooltip labels, links, role shells, and route behavior.
- Kept the implementation dependency-free because the app currently has no icon library installed.
- Updated the teacher verifier so Figma-mode teacher pages are accepted by Figma shell/nav/surface markers instead of requiring the classic teacher workload summary marker.

### Logic Touched

No business logic was changed.

The patch is presentation/test-tooling only. It does not change lifecycle, auth, scoring, eligibility, schema, API semantics, permissions, guards, server actions, route behavior, QA data, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- src/app/figmaUiModeSource.test.ts` - passed.
- `cmd /c npm.cmd test` - passed, 82 files / 365 tests.
- `cmd /c npm.cmd run build` - passed.

### Next Phase

Commit and deploy the icon navigator patch to QA, then live-check teacher Figma navigation on the new preview before resuming Phase 9 Progress 2 scoring.

## 2026-05-14 - Phase 9 Figma Display Density Follow-up

### Scope

Addressed live feedback on `/teacher/advisor-score` that display-only content still left too much unused space, especially in KPI rows and read-only review/detail layouts.

### Patch

- Changed the Figma KPI grid from fixed columns to auto-fit compact columns so five metric cards can stay on one row when viewport width allows.
- Added compact readonly detail surfaces for teacher report/advisor-score rows.
- Kept form/editable states in the wider two-column review layout so scoring and review forms remain easy to fill.
- Removed oversized empty action-column behavior for completed/locked report and advisor-score items.

### Logic Touched

No business logic was changed.

The patch is layout/CSS/renderer-only. It does not change lifecycle, auth, scoring, eligibility, schema, API semantics, permissions, guards, server actions, route behavior, QA data, or production configuration.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- src/app/teacher/teacherWorkloadUxSource.test.ts src/app/figmaUiModeSource.test.ts` - passed.
- `cmd /c npm.cmd test` - passed, 82 files / 365 tests.
- `cmd /c npm.cmd run build` - passed.

### Next Phase

Commit and deploy this display-density follow-up to QA, live-check `/teacher/advisor-score` on the new preview, then resume Phase 9 Progress 2 scoring.
