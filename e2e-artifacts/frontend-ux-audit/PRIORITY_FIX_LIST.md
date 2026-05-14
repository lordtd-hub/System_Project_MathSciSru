# Priority Fix List Before Wave 2

## Must Fix Before Wave 2

| Route | Role | Device | Issue | Suggested fix | Reason |
|---|---|---|---|---|---|
| `/admin/reports` | Admin | Desktop | Route returns 404 while it was part of the expected audit inventory. | Decide whether the route should exist. If not required, remove it from Wave 2 expectations/navigation notes. If required, add a minimal admin report overview. | Avoids dead navigation/expectation mismatch during Wave 2. |

## Should Fix Before Wave 2

| Route | Role | Device | Issue | Suggested fix | Reason |
|---|---|---|---|---|---|
| `/teacher/schedules` | Teacher | Desktop/mobile | Confirmed schedule history is too long. | Show only 2-5 recent/important schedules on dashboard/queue, then use vertical scroll or a full detail page. | High-volume history hides actual work. |
| `/admin/schedules` | Admin | Desktop | 72 confirmed schedules render as a long history list. | Add filters by round/status and cap confirmed/history list height. | Admin cannot scan large schedule history efficiently. |
| `/admin/proposals` | Admin | Desktop | Dense table exposes controls, raw audit fields, and long comments in each row. | Use compact rows with expandable full details; keep action controls visually separated. | Reduces misclick and scanning fatigue. |
| `/admin/evidence` | Admin | Desktop/mobile | Raw IDs and English audit labels are visible. | Translate display labels and move IDs to expandable technical details. | Evidence page should be understandable to academic/admin users. |
| `/student`, `/student/proposal`, `/student/schedule` | Student | Desktop/mobile | English QA/programmer text appears in user-facing evidence/comments. | Use Thai seed/display text or map event descriptions to Thai. | Students should not see internal test/programmer wording. |
| `/student/proposal`, `/admin/proposals` | Student/Admin | Desktop/mobile | Raw `PASS`/`REVISE`/`FAIL` labels appear. | Display Thai labels while preserving enum values internally. | Avoids programmer language. |
| Teacher/Admin queue pages | Teacher/Admin | Desktop/mobile | Badges/status chips can become bulky or stack vertically. | Make badges compact; cap repeated same-kind badge groups with a vertical scrollbar. | Matches user observation and improves dense queues. |
| `/teacher` | Teacher | Desktop/mobile | Dashboard has duplicated workload summaries/widgets. | Keep actionable queue first; demote or remove duplicate shortcuts/widgets. | Reduces noise before Wave 2 scale. |
| `/teacher/advisor-score` | Teacher | Desktop/mobile | Completed cards are tall history items. | Use compact completed/history rows with expandable full detail. | A teacher with many advisees will otherwise scroll heavily. |

## Can Defer

| Route | Role | Device | Issue | Suggested fix | Reason |
|---|---|---|---|---|---|
| `/student/feedback` | Student | Desktop | Rubric/feedback page is dense and partly bilingual. | Thai-first summary with expanded rubric detail later. | Not blocking workflow. |
| `/admin/rounds` | Admin | Desktop/mobile | Open/close action controls repeat across round cards. | Cleaner hierarchy/danger-zone styling later. | Semantics are correct; UX can improve later if not changing rounds now. |
| `/admin/closeout` | Admin | Desktop/mobile | Completed list is verbose. | Compact completed history later. | Clear enough for current Wave 2 state. |
| `/teacher/progress1`, `/teacher/progress2` | Teacher | Desktop | Routes are less discoverable when zero tasks exist. | Add subtle route/history access if needed. | Action queues are clear when tasks exist. |

## Nice To Have

| Route | Role | Device | Issue | Suggested fix | Reason |
|---|---|---|---|---|---|
| All dashboards | All | All | Small English marker `now`. | Replace with Thai or icon-only. | Polish. |
| QA login | QA only | All | QA page contains English setup text. | Leave until QA page cleanup. | Not real-user-facing. |

## Recommendation

Final recommendation: `PATCH_UX_BEFORE_WAVE_2`.

Patch only density/text/route-expectation issues. Do not restart Figma redesign and do not change business logic.

## Patch Status - 2026-05-14

Completed before Wave 2:

- `/admin/reports` now has a minimal read-only admin entrypoint that links to evidence and closeout instead of returning 404.
- `/teacher/schedules` confirmed schedule history now uses an internal vertical scroll container so long history does not dominate the page.
- `/admin/schedules` long status groups now use an internal vertical scroll container when a group has more than 8 items.
- Teacher/Admin queue badges and project status badges are more compact.
- Repeated teacher queue badge stacks now have a capped internal scroll area.

Still recommended but deferred:

- Admin proposal table compact/full-detail redesign.
- Admin evidence raw ID / audit wording cleanup beyond existing label mapping.
- Student-facing QA/programmer seed text cleanup.
- Teacher dashboard duplicate widget reduction.
- Completed advisor-score/report history compact/full-detail split.
