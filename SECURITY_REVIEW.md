# Security Review

## Real-login pilot mode

- Pilot production access starts with exactly one configured Admin account: `INITIAL_ADMIN_EMAIL`.
- After Google login, only the email that exactly matches `INITIAL_ADMIN_EMAIL` resolves to `ADMIN`.
- Other `@sru.ac.th` Google accounts resolve to `PENDING_TEACHER` unless their teacher profile has already been linked by an approved claim.
- Teacher profiles may be seeded with empty `email`; the email is written only after Admin approves a teacher account claim.
- Pending teacher claims cannot access proposal scoring, advisor actions, schedule approvals, report review data, or student data.
- Student accounts are controlled by imported roster data. A student login must match an imported generated email in the form `{student_code}@student.sru.ac.th`.
- A `@student.sru.ac.th` email that is not in the imported roster is denied at role resolution and must not access student pages.
- Development login is guarded by `NODE_ENV=development`; production must use Google login and must not accept dev-session cookies or dev-login server actions.

## Current implementation notes

- `src/lib/auth/roleResolution.ts` contains the central Google email to role decision.
- `src/auth.ts` applies that decision during Google sign-in and stores Google `sub` on the app user.
- `src/app/dev-login/actions.ts` throws if development login is used outside development.
- `src/app/teacher/actions.ts` allows pending teachers only to create account claims; scoring and workflow mutations require `TEACHER`.
- `src/auth.ts` only attaches role claims for active users; inactive app users lose `token.role` / `token.appUserId` and fail protected route guards.

## Pilot checklist

- Set `INITIAL_ADMIN_EMAIL` to the real pilot Admin Google account before launch.
- Import the student roster before allowing student pilot login.
- Seed teacher profiles even if `email` is empty.
- Have the initial Admin approve teacher claims from `/admin/claims`.
- Do not configure or expose development login in production.

## 2026-05-06 protected route/action audit

- Admin pages checked: `/admin`, `/admin/claims`, `/admin/committee`, `/admin/import-students`, `/admin/proposals`, `/admin/rounds`, `/admin/students`, and `/admin/teachers`.
- Admin server actions checked: academic setup, student import, project/advisor confirmation, teacher claim review, round open/close, proposal final decision, committee assignment, and feedback release. All enter through the Admin guard.
- Teacher work pages checked: `/teacher/advisor-requests`, `/teacher/proposals`, `/teacher/reports`, `/teacher/schedules`, and `/teacher/scoring/[assignmentId]`. These require `TEACHER` and reject pending teacher claims.
- Teacher claim flow remains separate: only pending teachers may use `/teacher/claim` and `claimTeacherProfile`; approved teachers cannot create another pending profile claim.
- Student pages checked: `/student`, `/student/feedback`, `/student/origin`, `/student/profile`, `/student/project`, `/student/proposal`, `/student/report`, and `/student/schedule`.
- Guard fix applied: student workflow pages now explicitly stop when the session email does not match an imported `Student.generatedEmail`, before showing workflow forms or related teacher/project data.
- `src/auth.ts` continues to use centralized `resolveLoginRole`; Google email values are normalized before user lookup/upsert.
- Dev login page, home link, auth-cookie read, and dev-login server actions remain guarded by `isDevLoginEnabled()` / `NODE_ENV=development`.

## 2026-05-06 follow-up guard audit

- Re-audited Admin-only pages/actions and confirmed Admin proposal decision, feedback release, committee assignment, and course-level round open/close actions still enter through the Admin guard.
- Re-audited teacher work pages/actions and confirmed pending teacher claims cannot access advisor request review, proposal scoring, schedule pages, report pages, or scoring submissions.
- Fixed a claim-flow gap: approved `TEACHER` users are no longer allowed to access `/teacher/claim` or call `claimTeacherProfile`; that route/action is now for `PENDING_TEACHER` only.
- Fixed an inactive-user gap: `src/auth.ts` now requires `User.active` before attaching role/session claims, so disabled users cannot keep using protected routes through an existing token.
- Confirmed API handlers: the only API route is NextAuth (`/api/auth/[...nextauth]`), with business mutations implemented as guarded server actions.
- Validation passed: `prisma:validate`, `typecheck`, `test`, `build`, and `e2e:lifecycle`.

## 2026-05-06 scheduling/scoring guard note

- New `/admin/schedules` route uses the Admin guard and is included in the route guard source test.
- New `/teacher/progress1` route uses the approved Teacher guard and is included in the route guard source test.
- `submitExamSchedule` uses the student context guard and verifies imported roster ownership before accepting a schedule request.
- `submitProgress1Score` uses the approved Teacher guard and additionally requires an active HEAD/MEMBER assignment for the target project.

## 2026-05-06 HTTP route visibility verification

- Lifecycle E2E now verifies protected schedule routes over HTTP using Auth.js session cookies, not development-login cookies.
- Verified imported student access to `/student/schedule`.
- Verified approved teacher access to `/teacher/schedules`, `/teacher/progress1`, and `/teacher/progress2`.
- Verified Admin access to `/admin/schedules`.
- Verified pending teacher sessions cannot see teacher schedule or Progress 1 / Progress 2 scoring content.
- Verified student sessions cannot see teacher/admin schedule or Progress 1 / Progress 2 scoring content.
- Verified anonymous sessions cannot see student schedule data.

## 2026-05-06 Progress 2 scoring guard note

- New `/teacher/progress2` route uses the approved Teacher guard and is included in the route guard source test.
- `submitProgress2Score` uses the approved Teacher guard and additionally requires an active HEAD/MEMBER assignment for the target project.
- Progress 2 scoring uses the existing course-level `AssessmentRound` for `PROGRESS_2`; it does not create project-specific rounds.

## 2026-05-06 Final Presentation scoring guard note

- New `/teacher/final` route uses the approved Teacher guard and is included in the route guard source test.
- `submitFinalPresentationScore` uses the approved Teacher guard and additionally requires an active HEAD/MEMBER assignment for the target project.
- Final Presentation scoring uses the existing course-level `AssessmentRound` for `FINAL_PRESENTATION`; it does not create project-specific rounds.
- Final Presentation scoring records scores only and does not start report review, unlock Advisor score, or mark the project completed.

## 2026-05-06 Report approval loop guard note

- `/student/report` remains roster-gated through the student session email and imported `Student.generatedEmail`.
- `submitReportVersion` uses the student context guard, so a student can submit only for their own current project.
- `/teacher/reports` uses the approved Teacher guard; pending teacher claims, students, and anonymous sessions cannot see report review workflow content.
- `reviewReportVersion` uses the approved Teacher guard and additionally requires the reviewer to be the approved advisor or active HEAD/MEMBER for the project.
- Report approval moves only to `REPORT_APPROVED`; it does not create Advisor score records, move to `ADVISOR_SCORING`, or mark `COMPLETED`.
- Lifecycle E2E route visibility now checks `/student/report` and `/teacher/reports` over HTTP with Auth.js session cookies.

## 2026-05-06 Advisor score guard note

- New `/teacher/advisor-score` route uses the approved Teacher guard and is included in route guard tests.
- `submitAdvisorScore` uses the approved Teacher guard and additionally requires the teacher to be the project advisor through an approved advisor request or active `ADVISOR` committee assignment.
- Pending teacher claims, students, and anonymous users cannot access Advisor score workflow content.
- Advisor score opens only for `REPORT_APPROVED` or existing `ADVISOR_SCORING` projects.
- Submission moves only from `REPORT_APPROVED` to `ADVISOR_SCORING`; it does not mark `COMPLETED`.
- Lifecycle E2E route visibility now checks `/teacher/advisor-score` over HTTP with Auth.js session cookies.

## 2026-05-06 Admin closeout guard note

- New `/admin/closeout` route uses the Admin guard and is included in route guard tests.
- `completeProjectCloseout` uses the Admin guard and re-checks closeout eligibility server-side before setting `COMPLETED`.
- Teachers, pending teacher claims, students, and anonymous users cannot complete a project.
- Closeout writes status history, timeline evidence, and audit log only after the eligibility check passes.
- Advisor score still does not complete a project; `COMPLETED` is reachable only through Admin closeout.
- Lifecycle E2E route visibility now checks `/admin/closeout` over HTTP with Auth.js session cookies.
## 2026-05-06 Stabilization hardening note

- Admin teacher-claim review now rejects non-`PENDING` claims server-side, preventing accidental repeat approval/rejection.
- Round close actions remain Admin-only and now reject already-closed rounds server-side, preserving stable `closedAt` / `closedByAdminId` evidence.
- Admin closeout remains Admin-only and now uses a conditional `ADVISOR_SCORING` update guard before writing completion history, reducing double-submit/race duplicate evidence.
- Student Proposal submission now checks the course-level Proposal round open state server-side, not only through UI gating.
- Student Project Origin now requires advisor selection before moving to `PENDING_ADVISOR`, avoiding a dead-end state with no pending advisor request.
- Report approval now refuses approval while the latest report version has an unresolved revision request.

## 2026-05-06 Production auth/config readiness note

- Production runtime now validates critical env vars before Google OAuth is used.
- Missing `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` fails with an app-side configuration error instead of sending users to Google with a blank `client_id`.
- `AUTH_SECRET` is passed into Auth.js; `NEXTAUTH_SECRET` remains supported for existing scripts.
- `AUTH_URL` / `NEXTAUTH_URL` and `AUTH_TRUST_HOST=true` are documented for Vercel/reverse-proxy deployments.
- `/dev-login` remains development-only through `isDevLoginEnabled()`.
