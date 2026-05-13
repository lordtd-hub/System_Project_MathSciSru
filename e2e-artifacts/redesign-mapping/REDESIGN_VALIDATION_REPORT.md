# Redesign Validation Report

## Current Cycle

- Phase: 1 - Shared design system / UI components
- Component handled: `TeacherWorkloadQueue` and `/teacher` dashboard integration
- Code validation: passed after dashboard integration
- QA deploy: passed on `https://system-project-math-sci-gn79zo76m-lordtd-hubs-projects.vercel.app`
- Live QA verification: passed with Edge CDP after explicitly selecting the teacher role in the QA login form

## 2026-05-13 Local Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test` - passed, 81 test files / 342 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

## 2026-05-13 Local Validation After Dashboard Integration

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test` - passed, 81 test files / 342 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

## 2026-05-13 Live QA Verification

- Preview URL: `https://system-project-math-sci-gn79zo76m-lordtd-hubs-projects.vercel.app`
- Commit verified: `182be65`
- Tooling: Edge persistent CDP, non-mutating teacher page verification.
- QA login guard: the script explicitly selects `#role = teacher` before selecting the teacher identity and submitting the QA login form.
- Result: passed for `/teacher`, `/teacher/schedules`, `/teacher/proposals`, `/teacher/progress1`, `/teacher/progress2`, `/teacher/final`, `/teacher/reports`, and `/teacher/advisor-score`.
- Verified each route was not shell-only, did not show an app error/digest page, rendered the shared workload summary, and showed the action-first workload total.
- Initial unauthorized page during verification was caused by not being logged in as the teacher identity with the current QA secret, not by the redesigned UI.

Screenshots:

- `e2e-artifacts/redesign-mapping/screenshots/teacher-dashboard-redesign-gn79zo76m.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-schedules-redesign-gn79zo76m.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-proposals-redesign-gn79zo76m.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-progress1-redesign-gn79zo76m.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-progress2-redesign-gn79zo76m.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-final-redesign-gn79zo76m.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-reports-redesign-gn79zo76m.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-advisor-score-redesign-gn79zo76m.png`

## Required Commands For Code Changes

```bash
cmd /c npm.cmd run typecheck
cmd /c npm.cmd test
cmd /c npm.cmd run build
```

## Production Safety

- Production deployment is out of scope.
- No production configuration changes are allowed in this redesign loop.

## 2026-05-13 Local Validation For Teacher Subpages

- Phase: 2 - Teacher subpage redesign.
- Routes touched: `/teacher/schedules`, `/teacher/proposals`, `/teacher/progress1`, `/teacher/progress2`, `/teacher/final`, `/teacher/reports`, `/teacher/advisor-score`.
- `cmd /c npm.cmd run typecheck` - initial run failed because stale `.next/types` file paths referenced the sandbox cwd; after `next build` regenerated types, rerun passed.
- `cmd /c npm.cmd test -- teacher` - passed, 5 files / 17 tests.
- `cmd /c npm.cmd test` - passed, 81 files / 344 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.
- Logic touched: no.
- QA deploy: passed on `https://system-project-math-sci-9czostjk1-lordtd-hubs-projects.vercel.app`.
- Live QA verification: passed with Edge persistent CDP after the verifier selected the teacher role and confirmed authorized teacher dashboard access.

Screenshots:

- `e2e-artifacts/redesign-mapping/screenshots/teacher-dashboard-redesign-9czostjk1.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-schedules-redesign-9czostjk1.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-proposals-redesign-9czostjk1.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-progress1-redesign-9czostjk1.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-progress2-redesign-9czostjk1.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-final-redesign-9czostjk1.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-reports-redesign-9czostjk1.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-advisor-score-redesign-9czostjk1.png`

## 2026-05-13 Teacher Mobile Pass

- Phase: 2.8 - Teacher mobile pass.
- Preview URL: `https://system-project-math-sci-g5enipsvz-lordtd-hubs-projects.vercel.app`.
- Viewport: 390px wide mobile emulation.
- `cmd /c npm.cmd test -- teacher` - passed, 5 files / 18 tests.
- Live QA verification: passed with Edge persistent CDP.
- Result: `/teacher`, `/teacher/schedules`, `/teacher/proposals`, `/teacher/progress1`, `/teacher/progress2`, `/teacher/final`, `/teacher/reports`, and `/teacher/advisor-score` rendered without shell-only/error pages and without detected horizontal overflow.
- Logic touched: no.

Screenshots:

- `e2e-artifacts/redesign-mapping/screenshots/teacher-dashboard-redesign-mobile-g5enipsvz.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-schedules-redesign-mobile-g5enipsvz.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-proposals-redesign-mobile-g5enipsvz.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-progress1-redesign-mobile-g5enipsvz.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-progress2-redesign-mobile-g5enipsvz.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-final-redesign-mobile-g5enipsvz.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-reports-redesign-mobile-g5enipsvz.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-advisor-score-redesign-mobile-g5enipsvz.png`

## 2026-05-13 Teacher Non-Mutating Regression

- Phase: 2.9 - Teacher regression verification.
- Preview URL: `https://system-project-math-sci-g5enipsvz-lordtd-hubs-projects.vercel.app`.
- Identity: `teacher-delta`.
- Viewport: desktop.
- Live QA verification: passed with Edge persistent CDP.
- Result: all teacher routes rendered without shell-only/error pages, without unauthorized teacher guard pages, and without horizontal overflow.
- Logic touched: no.

Screenshots:

- `e2e-artifacts/redesign-mapping/screenshots/teacher-dashboard-redesign-desktop-g5enipsvz.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-schedules-redesign-desktop-g5enipsvz.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-proposals-redesign-desktop-g5enipsvz.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-progress1-redesign-desktop-g5enipsvz.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-progress2-redesign-desktop-g5enipsvz.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-final-redesign-desktop-g5enipsvz.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-reports-redesign-desktop-g5enipsvz.png`
- `e2e-artifacts/redesign-mapping/screenshots/teacher-advisor-score-redesign-desktop-g5enipsvz.png`

## 2026-05-13 Admin Redesign Entry Verification

- Phase: 3 - Admin redesign entry audit.
- Preview URL: `https://system-project-math-sci-1thdur8ic-lordtd-hubs-projects.vercel.app`.
- Routes verified: `/admin`, `/admin/rounds`, `/admin/closeout`, `/admin/proposals`, `/admin/schedules`, `/admin/evidence`.
- Local validation:
  - `cmd /c npm.cmd test -- admin` - passed, 16 files / 63 tests.
  - `cmd /c npm.cmd test -- dashboardClarity` - passed, 1 file / 3 tests.
  - `node --check e2e-artifacts/redesign-mapping/verify-admin-redesign-cdp.js` - passed.
  - `cmd /c npm.cmd test -- adminOperational dashboardClarity` - passed, 2 files / 8 tests.
- Live QA verification: passed with Edge persistent CDP.
- Viewports:
  - desktop 1440px.
  - mobile 390px.
- Result: all checked admin routes rendered without shell-only/error pages and without detected horizontal overflow.
- Logic touched: no.

QA login note: the admin verifier now clears any existing QA session before switching roles, then explicitly selects `#role = admin` and the admin identity. This avoids the recurring role-dropdown/session mismatch during live verification.

Screenshots:

- `e2e-artifacts/redesign-mapping/screenshots/admin-dashboard-redesign-desktop-1thdur8ic.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-rounds-redesign-desktop-1thdur8ic.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-closeout-redesign-desktop-1thdur8ic.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-proposals-redesign-desktop-1thdur8ic.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-schedules-redesign-desktop-1thdur8ic.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-evidence-redesign-desktop-1thdur8ic.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-dashboard-redesign-mobile-1thdur8ic.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-rounds-redesign-mobile-1thdur8ic.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-closeout-redesign-mobile-1thdur8ic.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-proposals-redesign-mobile-1thdur8ic.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-schedules-redesign-mobile-1thdur8ic.png`
- `e2e-artifacts/redesign-mapping/screenshots/admin-evidence-redesign-mobile-1thdur8ic.png`

## 2026-05-13 Student Redesign Local Validation

- Phase: 4 - Student redesign entry patch.
- Routes patched: `/student/project`, `/student/proposal`.
- Shared component reused: `StudentReadabilitySummary`.
- Verification helper added: `e2e-artifacts/redesign-mapping/verify-student-redesign-cdp.js`.
- Local validation:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test -- studentReadability` - passed, 1 file / 6 tests.
  - `cmd /c npm.cmd test` - passed, 81 files / 346 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
  - `node --check e2e-artifacts/redesign-mapping/verify-student-redesign-cdp.js` - passed.
- Logic touched: no.

Live QA verification passed on `https://system-project-math-sci-4pvh39ven-lordtd-hubs-projects.vercel.app`.

Verified routes:

- `/student`
- `/student/project`
- `/student/proposal`
- `/student/schedule`
- `/student/report`
- `/student/feedback`

Desktop and 390px mobile verification passed without shell-only pages, digest/error pages, or detected horizontal overflow.

Screenshots:

- `e2e-artifacts/redesign-mapping/screenshots/student-dashboard-redesign-desktop-4pvh39ven.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-project-redesign-desktop-4pvh39ven.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-proposal-redesign-desktop-4pvh39ven.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-schedule-redesign-desktop-4pvh39ven.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-report-redesign-desktop-4pvh39ven.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-feedback-redesign-desktop-4pvh39ven.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-dashboard-redesign-mobile-4pvh39ven.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-project-redesign-mobile-4pvh39ven.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-proposal-redesign-mobile-4pvh39ven.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-schedule-redesign-mobile-4pvh39ven.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-report-redesign-mobile-4pvh39ven.png`
- `e2e-artifacts/redesign-mapping/screenshots/student-feedback-redesign-mobile-4pvh39ven.png`

## 2026-05-13 Global Mobile + Non-Mutating Regression

- Phase: 7/8 - global mobile pass and old-vs-new non-mutating regression.
- Preview URL: `https://system-project-math-sci-66nqpox8d-lordtd-hubs-projects.vercel.app`.
- Local validation:
  - `node --check e2e-artifacts/redesign-mapping/verify-teacher-workload-cdp.js` - passed.
  - `node --check e2e-artifacts/redesign-mapping/verify-admin-redesign-cdp.js` - passed.
  - `node --check e2e-artifacts/redesign-mapping/verify-student-redesign-cdp.js` - passed.
- Live QA verification: passed with Edge persistent CDP.
- Viewports:
  - desktop 1440px.
  - mobile 390px.
- Logic touched: no.

Verified route groups:

- Teacher: 8 routes passed on desktop and mobile.
- Admin: 6 routes passed on desktop and mobile.
- Student: 6 routes passed on desktop and mobile.

Result:

- No shell-only pages detected.

## 2026-05-13 Figma Teacher Schedules Renderer Local Validation

- Phase: Figma Visual Pass Phase 4 - Teacher schedules renderer split.
- Route patched: `/teacher/schedules`.
- Logic touched: no.
- Classic fallback: preserved in the existing page return.
- Figma mode: added page-level renderer branch using shared Figma visual primitives.
- Local validation:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test -- teacher` - passed, 5 files / 19 tests.
  - `cmd /c npm.cmd test` - passed, 82 files / 351 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
- QA deploy:
  - pushed to `qa-preview` at commit `4a275d9`.
  - Vercel preview ready: `https://system-project-math-sci-hmhz7pteq-lordtd-hubs-projects.vercel.app`.
- Live QA verification:
  - `/teacher/schedules` classic mode passed with `.teacher-workload-summary` present and `.figma-role-shell` absent.
  - `/teacher/schedules` figma mode passed with `.figma-role-shell`, `.figma-teacher-schedules`, 5 KPI cards, and 48 schedule/action rows visible.
  - No shell-only, digest/application error, or unauthorized teacher guard page appeared.
  - Screenshots:
    - `e2e-artifacts/redesign-mapping/screenshots/teacher-schedules-classic-hmhz7pteq.png`
    - `e2e-artifacts/redesign-mapping/screenshots/teacher-schedules-figma-hmhz7pteq.png`
- No digest/application error pages detected.
- No detected mobile horizontal overflow.
- QA login role selection was guarded before identity selection for each role.

Tooling note: `.env.preview.local` did not match the active preview QA secret during this pass, so live verification used a process-scoped `QA_LIVE_SECRET` environment value. The secret was not written to source or artifact files.

Additional tooling note: Edge also has the Figma reference tab open. CDP verification should activate the QA tab before checking layout because hidden tabs can temporarily keep streamed content inside a hidden Suspense container.

## 2026-05-13 Figma Teacher Proposals Renderer Local Validation

- Phase: Figma Visual Pass Phase 4 - Teacher proposals renderer split.
- Route patched: `/teacher/proposals`.
- Logic touched: no.
- Classic fallback: preserved in the existing page return.
- Figma mode: added page-level renderer branch using shared Figma visual primitives and the same Proposal scoring links/forms.
- Local validation:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test -- teacher` - passed, 5 files / 19 tests.
  - `cmd /c npm.cmd test` - passed, 82 files / 351 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
- QA deploy: pending.
- Live QA verification: pending.

## 2026-05-13 Figma Teacher Proposals Renderer Live QA Verification

- Phase: Figma Visual Pass Phase 4 - Teacher proposals renderer split.
- Commit: `0c4ae56`.
- QA preview: `https://system-project-math-sci-2vdne1hl7-lordtd-hubs-projects.vercel.app`.
- Live route verified: `/teacher/proposals`.
- Classic mode result:
  - `.teacher-workload-summary` rendered.
  - `.figma-role-shell` and `.figma-teacher-proposals` were absent.
  - body text rendered normally and was not shell-only.
- Figma mode result:
  - `.figma-role-shell` rendered.
  - `.figma-teacher-proposals` rendered.
  - 5 `.figma-metric-card` elements rendered.
  - current QA state had no Proposal items requiring action, so `.figma-proposal-row` count was 0 and the empty state was expected.
- No digest/application error was detected.
- Screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-proposals-classic-2vdne1hl7.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-proposals-figma-2vdne1hl7.png`
- Edge verification note:
  - A Figma reference tab remains open in Edge.
  - CDP verification must activate the QA tab before DOM/layout assertions because hidden tabs can temporarily look shell-only while streamed content is suspended.

## 2026-05-13 Figma Teacher Progress 1 Renderer Local Validation

- Phase: Figma Visual Pass Phase 4 - Teacher Progress 1 renderer split.
- Route patched: `/teacher/progress1`.
- Logic touched: no.
- Classic fallback: preserved in the existing page return.
- Figma mode: added page-level renderer branch using shared Figma visual primitives and the same `submitProgress1Score` form/action fields.
- Markdown+KaTeX evidence and feedback components remain in use.
- Local validation:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test -- teacher` - passed, 5 files / 20 tests.
  - `cmd /c npm.cmd test` - passed, 82 files / 352 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
- QA deploy: pending.
- Live QA verification: pending.

## 2026-05-13 Figma Teacher Progress 1 Renderer Live QA Verification

- Phase: Figma Visual Pass Phase 4 - Teacher Progress 1 renderer split.
- Commit: `41f6967`.
- QA preview: `https://system-project-math-sci-g80tv9wrj-lordtd-hubs-projects.vercel.app`.
- Live route verified: `/teacher/progress1`.
- Classic mode result:
  - `.teacher-workload-summary` rendered.
  - `.figma-role-shell` and `.figma-teacher-progress1` were absent.
  - body text rendered normally and was not shell-only.
- Figma mode result:
  - `.figma-role-shell` rendered.
  - `.figma-teacher-progress1` rendered.
  - 5 `.figma-metric-card` elements rendered.
  - current QA state had no Progress 1 items requiring action, so `.figma-progress-row` and `.figma-review-layout` counts were 0 and the empty state was expected.
- No digest/application error was detected.
- Screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-progress1-classic-g80tv9wrj.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-progress1-figma-g80tv9wrj.png`

## 2026-05-13 Figma Teacher Progress 2 Renderer Local Validation

- Phase: Figma Visual Pass Phase 4 - Teacher Progress 2 renderer split.
- Route patched: `/teacher/progress2`.
- Logic touched: no.
- Classic fallback: preserved in the existing page return.
- Figma mode: added page-level renderer branch using shared Figma visual primitives and the same `submitProgress2Score` form/action fields.
- Existing "no Progress 2 round yet" empty-state behavior is preserved in Figma mode.
- Markdown+KaTeX evidence and feedback components remain in use.
- Local validation:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test -- teacher` - passed, 5 files / 21 tests.
  - `cmd /c npm.cmd test` - passed, 82 files / 353 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
- QA deploy: pending.
- Live QA verification: pending.

## 2026-05-13 Figma Teacher Progress 2 Renderer Live QA Verification

- Phase: Figma Visual Pass Phase 4 - Teacher Progress 2 renderer split.
- Commit: `bc5d750`.
- QA preview: `https://system-project-math-sci-iobd4wbwc-lordtd-hubs-projects.vercel.app`.
- Live route verified: `/teacher/progress2`.
- Classic mode result:
  - `.teacher-workload-summary` rendered.
  - `.figma-role-shell` and `.figma-teacher-progress2` were absent.
  - body text rendered normally and was not shell-only.
- Figma mode result:
  - `.figma-role-shell` rendered.
  - `.figma-teacher-progress2` rendered.
  - 5 `.figma-metric-card` elements rendered.
  - current QA state had no Progress 2 items requiring action, so `.figma-progress-row` and `.figma-review-layout` counts were 0 and the empty state was expected.
- No digest/application error was detected.
- Screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-progress2-classic-iobd4wbwc.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-progress2-figma-iobd4wbwc.png`

## 2026-05-14 Figma Teacher Final Renderer Local Validation

- Phase: Figma Visual Pass Phase 4 - Teacher Final renderer split.
- Route patched: `/teacher/final`.
- Logic touched: no.
- Classic fallback: preserved in the existing page return.
- Figma mode: added page-level renderer branch using shared Figma visual primitives and the same `submitFinalPresentationScore` form/action fields.
- Existing "no Final round yet" empty-state behavior is preserved in Figma mode.
- Final evidence continuity and Final QA rubric components remain in use.
- Local validation:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test -- teacher` - passed, 5 files / 22 tests.
- Full validation:
  - `cmd /c npm.cmd test` - passed, 82 files / 354 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
- QA deploy:
  - commit `202d825`;
  - preview `https://system-project-math-sci-hm6cz5z28-lordtd-hubs-projects.vercel.app`.
- Live QA verification:
  - classic `/teacher/final` rendered `.teacher-workload-summary` and no Figma shell;
  - figma `/teacher/final` rendered `.figma-role-shell`, `.figma-teacher-final`, and 5 KPI cards;
  - current QA state had no Final scoring rows, so empty state was expected;
  - no shell-only, digest/application error, login fallback, or unauthorized teacher guard appeared.
- Screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-final-classic-hm6cz5z28.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-final-figma-hm6cz5z28.png`

## 2026-05-14 Figma Teacher Reports Renderer Local Validation

- Phase: Figma Visual Pass Phase 4 - Teacher Reports renderer split.
- Route patched: `/teacher/reports`.
- Logic touched: no.
- Classic fallback: preserved in the existing page return.
- Figma mode: added page-level renderer branch using shared Figma visual primitives and the same latest-version report review form/action fields.
- Latest-version approval/revision semantics remain owned by `reviewReportVersion`, `latestReportHasRevisionRequest`, and `allRequiredReportReviewersPassed`.
- Local validation:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test -- teacher` - passed, 5 files / 23 tests.
- Full validation:
  - `cmd /c npm.cmd test` - passed, 82 files / 355 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
- QA deploy:
  - commit `ce29c9d`;
  - preview `https://system-project-math-sci-525grp3qo-lordtd-hubs-projects.vercel.app`.
- Live QA verification:
  - classic `/teacher/reports` rendered `.teacher-workload-summary` and no Figma shell;
  - figma `/teacher/reports` rendered `.figma-role-shell`, `.figma-teacher-reports`, and 5 KPI cards;
  - current QA state had no report review rows/forms, so empty state was expected;
  - no shell-only, digest/application error, login fallback, or unauthorized teacher guard appeared.
- Screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-reports-classic-525grp3qo.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-reports-figma-525grp3qo.png`

## 2026-05-14 Figma Teacher Advisor Score Renderer Local Validation

- Phase: Figma Visual Pass Phase 4 - Teacher Advisor Score renderer split.
- Route patched: `/teacher/advisor-score`.
- Logic touched: no.
- Classic fallback: preserved in the existing page return.
- Figma mode: added page-level renderer branch using shared Figma visual primitives and the same advisor score form/action fields.
- Advisor-score unlock semantics remain owned by the existing `editable` condition: `project.status === "REPORT_APPROVED" || project.status === "ADVISOR_SCORING"`.
- Local validation:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test -- teacher` - passed, 5 files / 24 tests.
- Full validation:
  - `cmd /c npm.cmd test` - passed, 82 files / 356 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
- QA deploy:
  - commit `2a1c062`;
  - preview `https://system-project-math-sci-2vcb55iii-lordtd-hubs-projects.vercel.app`.
- Live QA verification:
  - classic `/teacher/advisor-score` rendered `.teacher-workload-summary` and no Figma shell;
  - figma `/teacher/advisor-score` rendered `.figma-role-shell`, `.figma-teacher-advisor-score`, 5 KPI cards, 3 advisor-score rows, and 3 review layouts;
  - current QA state had no editable advisor-score forms for the signed-in teacher, so `project_id` and score input counts were 0 and read-only/locked states were expected;
  - no shell-only, digest/application error, login fallback, or unauthorized teacher guard appeared.
- Screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-advisor-score-classic-2vcb55iii.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-advisor-score-figma-2vcb55iii.png`

## 2026-05-14 Teacher Mobile Overflow Patch Local Validation

- Phase: Figma Visual Pass Phase 4 - Teacher mobile pass.
- Scope: shared Figma role shell CSS.
- Logic touched: no.
- Initial mobile audit:
  - `/teacher`, `/teacher/schedules`, `/teacher/proposals`, `/teacher/progress1`, `/teacher/progress2`, `/teacher/final`, `/teacher/reports`, and `/teacher/advisor-score` rendered in Figma mode at 390px;
  - no shell-only page, digest/application error, login fallback, or clipped action appeared;
  - shared shell had 4px horizontal overflow on all checked pages.
- Patch:
  - removed base mobile negative horizontal margin from `.figma-role-shell`;
  - retained wider breakpoint margins.
- Validation:
  - `cmd /c npm.cmd test` - passed, 82 files / 356 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
  - `cmd /c npm.cmd run typecheck` - passed after rerun.
- Note: an earlier typecheck attempt failed while `next build` was simultaneously regenerating `.next/types`; rerunning typecheck after build completed passed.
- QA deploy: pending.
- Live QA verification: pending rerun of 390px teacher mobile audit.

## 2026-05-14 Teacher Mobile Pass And Regression Smoke

- Phase: Figma Visual Pass Phase 4 - Teacher mobile/regression pass.
- QA preview: `https://system-project-math-sci-c2f2cvutx-lordtd-hubs-projects.vercel.app`.
- Mobile width: 390px.
- Routes checked:
  - `/teacher`;
  - `/teacher/schedules`;
  - `/teacher/proposals`;
  - `/teacher/progress1`;
  - `/teacher/progress2`;
  - `/teacher/final`;
  - `/teacher/reports`;
  - `/teacher/advisor-score`.
- Figma mobile result:
  - all routes rendered `.figma-role-shell`;
  - all routes had `docWidth = 390`;
  - no horizontal overflow;
  - no clipped action elements;
  - no shell-only page;
  - no digest/application error;
  - no login fallback.
- Desktop classic/figma smoke:
  - classic mode rendered `.teacher-workload-summary` and no Figma shell on all checked teacher routes;
  - figma mode rendered `.figma-role-shell` and no classic workload summary on all checked teacher routes;
  - no checked route showed digest/application error or login fallback.
- Screenshots:
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-dashboard-mobile-c2f2cvutx.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-schedules-mobile-c2f2cvutx.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-proposals-mobile-c2f2cvutx.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-progress1-mobile-c2f2cvutx.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-progress2-mobile-c2f2cvutx.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-final-mobile-c2f2cvutx.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-reports-mobile-c2f2cvutx.png`
  - `e2e-artifacts/redesign-mapping/screenshots/teacher-advisor-score-mobile-c2f2cvutx.png`
- Result: Teacher redesign phase is complete enough to move to Admin redesign.

## 2026-05-13 Figma UI Mode Foundation Validation

- Phase: Figma Visual Redesign Phase 0 - safe fallback foundation.
- Scope:
  - `classic` / `figma` UI mode utility.
  - cookie-backed QA mode switch.
  - Admin, Teacher, and Student role layout switching.
  - shared Figma role shell and visual surface primitives.
- Local validation completed so far:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test -- figmaUiMode` - passed, 1 file / 3 tests.
- Full local validation:
  - `cmd /c npm.cmd test` - passed, 82 files / 349 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
- Secret scan:
  - searched touched source/redesign artifacts for the QA secret and known database fragments;
  - no matches found.
- QA deployment:
  - pushed to `qa-preview` at commit `a9de656`.
  - Vercel preview ready: `https://system-project-math-sci-mfn23sfkb-lordtd-hubs-projects.vercel.app`.
- Live QA verification:
  - Admin classic/default route smoke passed on `/admin`, `/admin/rounds`, `/admin/closeout`, `/admin/proposals`, `/admin/schedules`, and `/admin/evidence`.
  - QA login verifier explicitly selected the `admin` role dropdown before identity selection.
  - `classic` mode rendered without `.figma-role-shell`.
  - `figma` mode switch rendered `.figma-role-shell` and `.figma-role-sidebar`.
  - Switching back to `classic` removed the Figma shell again.
  - No shell-only page, digest page, or detected desktop overflow appeared in this smoke check.
- Logic touched: no business logic.
- Production behavior: source test covers production fallback to `classic` unless explicitly allowed.

## 2026-05-13 Teacher Dashboard Figma Renderer Validation

- Phase: 4 - Teacher redesign, `/teacher` page-level renderer entry.
- Scope:
  - Direct classic fallback body for the existing dashboard.
  - `FigmaTeacherDashboardView` for figma mode.
  - Shared props contract from the existing server page.
  - Figma dashboard CSS for KPI cards, action rows, schedule rows, and proposal rows.
- Local validation:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test -- teacher` - passed, 5 files / 19 tests.
  - `cmd /c npm.cmd test` - passed, 82 files / 350 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
- Logic touched: no.
- QA deployment:
  - `908c910` deployed to `https://system-project-math-sci-lirwkespy-lordtd-hubs-projects.vercel.app`.
  - Live verification found a Major shell-only regression after switching UI modes.
- Stabilization patch:
  - `setUiModeAction` now redirects back to the referer path after setting the mode cookie.
  - `/teacher` classic fallback now returns the original dashboard JSX directly.
- Local validation after stabilization:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test -- figmaUiMode teacherDashboardSource` - passed.
  - `cmd /c npm.cmd test` - passed, 82 files / 351 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
- Live verification: pending on the post-fix preview.

## 2026-05-14 Admin Figma Renderer Batch 1 Validation

- Phase: 5 - Admin redesign.
- Scope:
  - `/admin/rounds`
  - `/admin/closeout`
  - `/admin/schedules`
  - `/admin/evidence`
- Renderer status:
  - classic fallback remains in each route;
  - figma branches were added with `.figma-admin-rounds`, `.figma-admin-closeout`, `.figma-admin-schedules`, and `.figma-admin-evidence`.
- Logic touched: no.
- Local validation:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test -- admin` - passed, 16 files / 63 tests.
  - `cmd /c npm.cmd test` - passed, 82 files / 356 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
- Follow-up:
  - build initially reported an unused variable warning in `/admin/closeout`;
  - the warning was patched and the full validation cycle was rerun successfully.
- QA deployment: pending.
- Live verification: pending.

## 2026-05-14 Admin Proposal Renderer And Admin Route Verification

- Phase: 5 - Admin redesign.
- Scope:
  - `/admin/proposals`;
  - reusable admin renderer mode verifier;
  - live re-verification of `/admin/rounds`, `/admin/closeout`, `/admin/proposals`, `/admin/schedules`, and `/admin/evidence`.
- Renderer status:
  - classic fallback remains available for every checked admin route;
  - figma branches now exist for all real admin operational routes in the current redesign scope;
  - `/admin/reports` remains mapping-only because no real route exists in the repo.
- Logic touched: no.
- Local validation:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test -- admin` - passed, 16 files / 64 tests.
  - `cmd /c npm.cmd test` - passed, 82 files / 357 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.
- Secret scan:
  - searched touched admin source, redesign components, redesign artifacts, and implementation progress for known QA/database secret fragments;
  - no matches found.
- QA deployment:
  - pushed to `qa-preview` at commit `056526f`;
  - Vercel preview ready: `https://system-project-math-sci-b4pwwud5y-lordtd-hubs-projects.vercel.app`.
- Live QA verification:
  - persistent Edge CDP session used;
  - QA login verifier explicitly selected the `admin` role dropdown before identity selection;
  - `classic` mode rendered no `.figma-role-shell` and no route-specific Figma page class;
  - `figma` mode rendered `.figma-role-shell` plus the expected route-specific class on all checked admin pages;
  - desktop verification showed no shell-only page, digest/application error, login fallback, or detected overflow;
  - 390px mobile verification showed `docWidth = 390` on all checked admin pages with no horizontal overflow.
- Screenshots:
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
- Result: Admin redesign phase is complete for real routes in the current repo, pending later mutating workflow regression.
