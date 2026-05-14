# Frontend UX Audit Before Wave 2

## Audit Metadata

- Branch: `qa-preview`
- Commit at audit start: `e55c624`
- QA preview: `https://system-project-math-sci-dh62wk9k0-lordtd-hubs-projects.vercel.app`
- Audit date: 14 May 2026
- Browser/session: Playwright CLI visible session `edgepilot-visible`, Microsoft Edge
- Baseline UI: Classic UI
- Production touched: No
- QA data reset: No
- Workflow mutations: No
- Code changes: No

## Scope Completed

Checked core Student, Teacher, and Admin pages on desktop and mobile smoke/device views. The audit used visible Playwright and started from `/qa-login` with the role dropdown selected before identity switching.

## Executive Summary

The classic UI is usable enough to continue controlled Wave 2 work, but it should not be treated as polished for real users yet.

The workflow states are mostly understandable. The strongest parts are next-action separation on Student pages, teacher workload buckets, admin round buckets, and closeout readiness separation. The main risk is not lifecycle correctness; it is information density and user-facing language.

Highest UX risks before Wave 2:

- Teacher/Admin schedule history lists are too long at scale. Confirmed/history items dominate pages even when no action is required.
- Admin proposal and evidence pages expose raw technical details such as IDs, internal actor fields, English audit labels, and enum-like labels.
- Student and Teacher pages still show English QA/programmer text in evidence, comments, and status history.
- Some queue/status cards and badges take more space than their value. Repeated same-kind badges/status chips should be compact and scrollable when long.
- `/admin/reports` returns 404 in the current QA preview. This is only a blocker if the route is expected to be part of admin navigation for Wave 2; otherwise document it as non-existent/deferred.

## Role Summary

### Student

Student pages are generally understandable. The student can see what is available now, what is waiting, what is completed, and what is locked. Mobile views at 390px and 430px are usable for the checked states.

Main student debt:

- English/QA text appears in evidence and comments.
- Raw `PASS` labels appear in proposal-related content.
- Feedback/rubric content is dense and partly bilingual; it is not a workflow blocker but is heavy for students.

### Teacher

Teacher pages are usable and permissions looked consistent in the checked state. The dashboard and subpages separate action/waiting/completed reasonably well.

Main teacher debt:

- Confirmed schedule history is too long and should be capped, filtered, or scroll-contained.
- Completed advisor-score cards can grow vertically; high-volume history should become compact.
- Dashboard still has duplicated workload summaries and secondary widgets.
- Some routes such as progress queues are less discoverable when there are zero tasks.

### Admin

Admin operational pages are mostly understandable and safer than earlier iterations. Round buckets and closeout readiness are clear.

Main admin debt:

- `/admin/schedules` shows 72 confirmed schedules as a long history list.
- `/admin/proposals` table is dense and contains raw decision/audit wording in cells.
- `/admin/evidence` has useful exports, including grades CSV/XLSX, but evidence tables expose raw IDs and English audit labels.
- Admin dashboard has operational noise: QA reset warning, duplicated shortcuts, `now` English marker, and latest evidence English text.
- `/admin/reports` is 404.

## Mobile Result

No critical mobile blocker was found in the checked Student/Teacher/Admin routes. At 390px and 430px, pages render and important content is reachable.

Mobile debt:

- Long queues/history lists create excessive vertical scrolling.
- Admin pages are acceptable only as smoke-check mobile pages, not primary mobile workflows.
- Badge groups and summary cards need compact treatment to avoid consuming too much vertical space.

## Screenshots

Key evidence screenshots are stored under:

- `e2e-artifacts/frontend-ux-audit/screenshots/`

Important examples:

- `student-feedback-desktop-bilingual-rubric-density.png`
- `teacher-dashboard-desktop-queue-density.png`
- `teacher-schedules-desktop-confirmed-list-scale.png`
- `teacher-schedules-mobile-390-confirmed-list.png`
- `admin-dashboard-desktop-operational-noise.png`
- `admin-rounds-desktop-action-hierarchy.png`
- `admin-proposals-desktop-table-density.png`
- `admin-schedules-desktop-confirmed-history-scale.png`
- `admin-evidence-desktop-export-labels-raw-ids.png`
- `admin-reports-route-404.png`

## Final Recommendation

**PATCH_UX_BEFORE_WAVE_2**

Wave 2 can continue after a small UX stabilization patch focused on density and text cleanup. No lifecycle/scoring/auth/schema blocker was found from this audit, but the high-volume pages should be made less noisy before adding more pilot load.

Recommended pre-Wave-2 patch scope:

1. Cap/scroll long confirmed/history lists on Teacher/Admin schedules.
2. Make repeated badges/status chips compact and scroll-contained when they become long.
3. Clean user-facing English/QA/programmer text on Student/Teacher/Admin surfaces.
4. Reduce dashboard duplication where navigator/summary widgets repeat the same function.
5. Decide whether `/admin/reports` should exist; if not, remove it from audit/navigation expectations.

Items that can wait:

- Full visual redesign.
- Figma implementation.
- Deep mobile-first admin redesign.
- Advanced filters/table redesign across every admin page.

## Post-Audit Stabilization Patch - 2026-05-14

Applied the first small UX stabilization patch from this audit without changing lifecycle/auth/scoring/eligibility/schema/API semantics.

Completed:

- Added a minimal read-only `/admin/reports` entrypoint so the expected admin report route no longer returns 404.
- Capped long confirmed schedule/history lists with internal vertical scrolling on teacher/admin schedule views.
- Reduced badge/status chip padding and font size so repeated badges take less space.
- Added capped scrolling for repeated teacher queue badge stacks.
- Added/updated source tests for the admin report entrypoint and schedule-scroll presentation rules.

Validation:

- `npm run typecheck`: passed.
- `npm test`: passed, 81 files / 350 tests.
- `npm run build`: passed.

QA preview/live smoke:

- Commit: `03005b3`
- QA preview: `https://system-project-math-sci-4cqk7d5hb-lordtd-hubs-projects.vercel.app`
- `/teacher/schedules`: passed. Confirmed schedule history is scroll-contained (`overflow-y: auto`, 72 items, no shell-only/digest page).
- `/admin/schedules`: passed. Confirmed schedule group is scroll-contained (`overflow-y: auto`, 72 items, no shell-only/digest page).
- `/admin/reports`: passed. Route renders the read-only report entrypoint with evidence and closeout links; no 404/digest page.

Updated recommendation after patch: `READY_FOR_WAVE_2_WITH_REMAINING_UX_DEBT`.

## Latest QA Re-Entry Note - 2026-05-14

After the documentation-only follow-up commit, the latest QA preview was:

- Commit: `ce66def`
- QA preview: `https://system-project-math-sci-hfqwa1dik-lordtd-hubs-projects.vercel.app`

Live Playwright visible re-entry was attempted from `/qa-login`, but Vercel redirected the session to Vercel Login / Deployment Protection. This is recorded as a preview/session protection issue, not an application regression, because the same app code was already live-smoked on the code preview `4cqk7d5hb` for:

- `/teacher/schedules`
- `/admin/schedules`
- `/admin/reports`

Do not deep-link into protected previews when resuming Wave 2. Start from `/qa-login` with a valid protected-preview session, select the role dropdown before identity, and stop immediately if Vercel Login / Deployment Protection appears.
