# Frontend UX Audit

Date: 2026-05-14

Branch: `qa-preview`

QA preview audited: `https://system-project-math-sci-6tx0bev1p-lordtd-hubs-projects.vercel.app`

UI baseline: classic UI. The previous Figma-mode implementation has been decommissioned and was not treated as the production-ready interface.

## Executive Summary

The current classic UI is operationally usable enough to continue QA planning, but it still needs a focused UX cleanup before a larger real-user rollout. The core workflow semantics are much stronger than earlier pilot rounds: users can usually tell whether work is actionable, waiting, completed, or locked. The main remaining problem is not missing logic; it is information hierarchy at scale.

The most important finding is that the app now has many correct signals, but some pages show too many signals at once. At 12-40 projects, Admin and Teacher pages can feel like they require visual searching instead of guiding the user to the next decision. Student pages are closer to acceptable because they already use action/waiting/completed summaries, but long schedule/report states can still feel heavy on mobile.

No production environment was touched. No lifecycle, scoring, eligibility, auth, schema, or server action logic was changed during this audit.

## Audit Method

- Read existing project, UX, responsive, pilot, Wave 1, Wave 2, and redesign notes.
- Used the classic UI baseline for all route checks.
- Used the existing Edge CDP session on the QA preview.
- Verified login role selection through the QA role dropdown before role identity selection.
- Performed non-mutating page verification only.
- Captured desktop and 390px mobile screenshots for Admin, Teacher, and Student routes.
- Did not submit forms, close rounds, reset data, approve/reject records, or mutate workflow state.

## Live Verification Summary

All audited role route groups rendered without shell-only pages, digest/error pages, or detected horizontal overflow at 390px mobile width.

Teacher verified routes:

- `/teacher`
- `/teacher/schedules`
- `/teacher/proposals`
- `/teacher/progress1`
- `/teacher/progress2`
- `/teacher/final`
- `/teacher/reports`
- `/teacher/advisor-score`

Student verified routes:

- `/student`
- `/student/project`
- `/student/proposal`
- `/student/schedule`
- `/student/report`
- `/student/feedback`

Admin verified routes:

- `/admin`
- `/admin/rounds`
- `/admin/closeout`
- `/admin/proposals`
- `/admin/schedules`
- `/admin/evidence`

Admin `/admin/reports` was not audited as a live route because the repo currently does not contain `src/app/admin/reports/page.tsx`.

## Highest-Impact UX Findings

### 1. Teacher dashboard is usable, but still has duplicated navigation/workload concepts

Severity: Should fix before Wave 2 expansion

The teacher dashboard now has a compact workload summary and the right-hand agenda list is scroll-limited, which is an improvement. However, the page still has multiple zones that answer similar questions: workload summary, next action, agenda, account/role shortcuts, and work guide cards. This creates a sense of "where should I look first?" even though the underlying data is correct.

Recommendation:

- Keep "งานที่ต้องดำเนินการ" as the primary teacher workspace.
- Keep the agenda list compact and scrollable.
- Move account/role details lower or collapse them.
- Avoid dashboard shortcut widgets that duplicate the left/top navigation.

Screenshot references:

- `e2e-artifacts/frontend-ux-audit/screenshots/teacher-dashboard-redesign-desktop-6tx0bev1p.png`
- `e2e-artifacts/frontend-ux-audit/screenshots/teacher-dashboard-redesign-mobile-6tx0bev1p.png`

### 2. Admin proposal and schedule pages are correct but too dense at scale

Severity: Should fix before Wave 2 expansion

Admin proposal and schedule pages can show many badges, buttons, and repeated project sections. The live mobile check did not detect horizontal overflow, but the pages are very long and visually noisy. This is especially visible on `/admin/proposals`, where the verifier counted 70 admin badges and 131 button/link-like controls.

Recommendation:

- Add stronger grouping by "Needs admin action", "Waiting", "Completed", and "Exception".
- Keep completed/history sections collapsed by default or lower on the page.
- Prefer compact table/list rows for large lists and full detail only after opening a project section.
- Preserve current actions and permissions exactly.

Screenshot reference:

- `e2e-artifacts/frontend-ux-audit/screenshots/admin-proposals-redesign-mobile-6tx0bev1p.png`

### 3. Student pages communicate the workflow better than before, but mobile schedule/report pages are still long

Severity: Can defer for minor polish; fix before real student manual screenshots

Student pages now clearly separate current/waiting/completed/locked states. The mobile schedule page is readable and has no horizontal overflow, but it stacks many correct sections vertically: summary, round guide, rubrics, confirmed schedules, evidence, proposal, and latest history. This is accurate but tiring on a phone.

Recommendation:

- Keep the current next-action summary.
- Add collapsible sections for history and completed/locked rounds.
- Keep active forms full width and near the top when editable.
- Do not reduce form size; data entry should remain spacious.

Screenshot references:

- `e2e-artifacts/frontend-ux-audit/screenshots/student-dashboard-redesign-mobile-6tx0bev1p.png`
- `e2e-artifacts/frontend-ux-audit/screenshots/student-schedule-redesign-mobile-6tx0bev1p.png`

### 4. Text mostly uses Thai user-facing wording, but raw technical labels still appear in evidence/history contexts

Severity: Should fix before manuals

Most primary actions now use Thai wording. Remaining technical-feeling labels are concentrated in evidence/history areas where event types or status constants appear close to user content. This is not a blocker for workflow correctness, but it will hurt trust when real users read exports or evidence pages.

Recommendation:

- Run a user-facing language pass after the next UX patch.
- Map event/status constants to Thai labels in evidence/history display.
- Keep enum names internal; do not expose raw status codes unless explicitly meant as audit metadata for Admin.

Screenshot reference:

- `e2e-artifacts/frontend-ux-audit/screenshots/admin-evidence-redesign-desktop-6tx0bev1p.png`

### 5. Mobile layout passes basic overflow checks, but long pages need better section strategy

Severity: Should fix before broader real-user testing

At 390px width, audited pages did not show horizontal overflow. The problem is vertical fatigue: users can scroll for a long time before reaching the part they need. Teacher and Student mobile experiences are acceptable for quick checks, but not yet ideal for repeated daily use.

Recommendation:

- Keep important "do now" cards above long details.
- Put long queues in internal scroll areas only when they are repeated queue items.
- Do not globally lock page height; pages must still scroll normally.
- Use collapsed history/detail sections where the content is correct but not immediately actionable.

## Recommendation

Do not resume the removed visual redesign implementation yet. The safer next step is a small classic UI cleanup pass before Wave 2 expansion:

1. Reduce duplicate dashboard navigation/widgets.
2. Collapse or compact completed/history-heavy sections.
3. Add stronger queue grouping for Admin high-density pages.
4. Run a Thai user-facing wording pass on evidence/status/history labels.
5. Preserve all lifecycle, scoring, eligibility, auth, and schema behavior.

After that cleanup, Wave 2 can continue toward a controlled 20-project expansion. Any larger redesign should wait until the mockup and component rules are re-planned page by page.
