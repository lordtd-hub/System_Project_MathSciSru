# Mobile Usability Findings

## Scope

Checked with visible Playwright Microsoft Edge:

- 390px portrait
- 430px portrait

Student and Teacher were checked more seriously because they are likely mobile users. Admin was smoke checked.

## Student

| Route | Viewport | Result | Findings |
|---|---:|---|---|
| `/student` | 430px | Pass with minor debt | Dashboard content is reachable. Next-action sections remain understandable. |
| `/student/proposal` | 390px | Pass with text debt | Layout is usable, but raw/English status text remains. |
| `/student/report` | 390px | Pass | Locked state clearly says the student cannot submit yet. No major overflow observed. |

Student mobile risk is mostly wording, not layout.

## Teacher

| Route | Viewport | Result | Findings |
|---|---:|---|---|
| `/teacher` | 390px / 430px | Pass with density debt | Dashboard is reachable, but repeated workload widgets and long queues create vertical weight. |
| `/teacher/schedules` | 390px | Should fix before Wave 2 | Confirmed schedule list is too long. Needs capped height, scroll, filter, or compact history. |
| `/teacher/reports` | 390px | Pass | Empty/no-task state is understandable. |
| `/teacher/advisor-score` | 390px | Pass with density debt | Completed score cards are readable but too tall for many advisees. |

Teacher mobile is usable, but high-volume lists will be tiring. This should be patched before expanding Wave 2 load.

## Admin

| Route | Viewport | Result | Findings |
|---|---:|---|---|
| `/admin` | 390px | Smoke pass with noise | Page is reachable. Dashboard is long and has QA/noise/duplicate signals. |
| `/admin/rounds` | 390px | Smoke pass | Round actions are reachable, but dangerous actions need clearer visual hierarchy. |
| `/admin/evidence` | 390px | Smoke pass | No document-level horizontal overflow detected, but table content is dense and raw. |

Admin mobile should remain secondary. It is usable for checking state, but not ideal for operational work.

## Badge / Queue Compactness

User observation confirmed during audit:

- Badges/status chips should be smaller and lower-height.
- Same-kind badges repeated in a long group should not expand the page indefinitely.
- Queue sections should show a limited number of rows by default; long queues/history groups should use vertical scrolling.
- For dashboard display, use compact object rows. Full details should live in an expanded/detail view.

## Screenshots

- `student-dashboard-mobile-430-next-action.png`
- `student-proposal-mobile-390-status-text.png`
- `student-report-mobile-390-locked-state.png`
- `teacher-dashboard-mobile-390-queue-density.png`
- `teacher-dashboard-mobile-430-smoke.png`
- `teacher-schedules-mobile-390-confirmed-list.png`
- `teacher-reports-mobile-390-empty-state.png`
- `teacher-advisor-score-mobile-390-completed-density.png`
- `admin-dashboard-mobile-390-smoke.png`
- `admin-rounds-mobile-390-danger-actions.png`
- `admin-evidence-mobile-390-table-overflow.png`

## Mobile Decision

No mobile blocker was found. The recommendation is `PATCH_UX_BEFORE_WAVE_2`, focused on compact queues/history and text cleanup.
