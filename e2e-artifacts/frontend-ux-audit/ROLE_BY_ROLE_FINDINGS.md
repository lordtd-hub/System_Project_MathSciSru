# Role-by-Role UX Findings

## Student

| Route | Severity | Finding | Impact | Recommendation |
|---|---|---|---|---|
| `/student` | Should fix before Wave 2 | Evidence feed contains English QA/pilot descriptions. | Real students may read internal test text instead of useful status history. | Map evidence descriptions to Thai user-facing text or use Thai QA seed content. |
| `/student` | Can defer | Student guidance section adds vertical length. | Does not block next-action clarity, but may be redundant after onboarding. | Keep for Wave 2 or make collapsible later. |
| `/student/proposal` | Should fix before Wave 2 | Raw `PASS` labels appear in comment/status areas. | Looks like enum/programmer wording. | Display Thai decision labels while keeping enum values internally. |
| `/student/proposal` | Should fix before Wave 2 | Abstract/comments contain English QA text. | Makes the page feel unfinished for Thai users. | Replace visible sample content with Thai or hide internal test detail. |
| `/student/feedback` | Can defer | Rubric details are long and partly bilingual. | Useful evidence, but too dense for quick student understanding. | Thai-first summary with optional expanded rubric later. |
| `/student/report` | Good | Locked report state clearly explains that the student cannot submit yet. | Reduces false-ready confusion. | Preserve this wording. |

## Teacher

| Route | Severity | Finding | Impact | Recommendation |
|---|---|---|---|---|
| `/teacher` | Should fix before Wave 2 | Dashboard duplicates workload information across summary cards, work cards, and shortcut-like widgets. | Teachers must scan repeated signals before finding real work. | Keep primary "งานที่ต้องดำเนินการ" first; demote or remove duplicate shortcut widgets. |
| `/teacher` | Nice to have | Small `now` marker remains in English. | Minor polish issue. | Replace with Thai label or icon-only indicator. |
| `/teacher/schedules` | Should fix before Wave 2 | Confirmed schedules show as a long list/history. | High-volume schedules dominate page even when no action is required. | Show only a few confirmed items by default with vertical scroll, filter, or "view all" detail page. |
| `/teacher/schedules` | Should fix before Wave 2 | Schedule cards carry many role/status badges. | Badges can consume more space than the schedule itself. | Make badges compact and cap stacked badge groups. |
| `/teacher/proposals` | Good | Empty/no-task state is understandable. | Teacher knows no action is needed. | Preserve. |
| `/teacher/progress1`, `/teacher/progress2` | Can defer | Routes are not obvious from dashboard when no tasks exist. | History/review access is less discoverable. | Add subtle route access only if teachers need history browsing outside active queues. |
| `/teacher/reports` | Good | Latest-version review wording is understandable. | Reduces revision-loop confusion. | Preserve. |
| `/teacher/advisor-score` | Should fix before Wave 2 | Completed advisor-score cards become tall history items. | A teacher with many advisees will scroll a lot. | Use compact completed/history list with expandable full detail. |
| `/teacher/advisor-score` | Should fix before Wave 2 | Comments include English QA text. | Looks like internal test language. | Use Thai user-facing comments in QA data or display mapping. |

## Admin

| Route | Severity | Finding | Impact | Recommendation |
|---|---|---|---|---|
| `/admin` | Should fix before Wave 2 | Dashboard has operational noise: QA reset warning, duplicated shortcuts, `now`, and English evidence text. | Admin may spend attention on non-primary elements. | Keep dangerous QA controls visually isolated; remove/demote duplicate shortcuts; localize evidence text. |
| `/admin/rounds` | Should fix before Wave 2 | Round buckets are clear, but open/close controls repeat in every round card. | Action hierarchy is still heavy and dangerous actions blend into repeated layout. | Keep current semantics; visually isolate destructive/closing actions and reduce repeated text. |
| `/admin/proposals` | Should fix before Wave 2 | Dense table shows many editable controls, raw decision metadata, and English QA notes. | Admin can scan, but at 40 projects it will be tiring and risk misclicks. | Add compact rows with expandable full details; hide internal metadata unless expanded. |
| `/admin/proposals` | Should fix before Wave 2 | Raw fields like `decided_by`, `decided_at`, `PASS`, `REVISE`, `FAIL` are visible. | Feels like programmer/audit language rather than admin language. | Use Thai labels in main UI; keep raw audit details in expandable evidence view. |
| `/admin/schedules` | Should fix before Wave 2 | 72 confirmed schedules appear as a long history list. | History dominates current work. | Cap visible height or add filters by round/status; show history in compact table. |
| `/admin/reports` | Should fix before Wave 2 if expected | Route returns 404. | If admins expect a report review overview, navigation/route plan is incomplete. | Decide whether to implement or remove from expected admin inventory. |
| `/admin/closeout` | Can defer | Completed project list is clear but verbose. | Fine at current size; may grow vertically after more projects. | Use compact completed history later. |
| `/admin/evidence` | Should fix before Wave 2 | Evidence tables expose raw IDs and English labels such as `Report approval evidence` and audit event keys. | Admin/AUN-QA users may not understand what each field means. | Convert raw labels to Thai display labels; move IDs to expandable technical detail. |
| `/admin/evidence` | Good | Grade export links exist as CSV and Excel. | Supports the requested grade export workflow. | Preserve and validate download in a separate export test if needed. |
