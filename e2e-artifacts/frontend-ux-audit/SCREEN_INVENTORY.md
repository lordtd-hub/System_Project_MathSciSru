# Screen Inventory

Baseline: Classic UI. Browser: visible Playwright Microsoft Edge session `edgepilot-visible`.

## Student

| Route | Desktop | 390px | 430px | Notes |
|---|---|---|---|---|
| `/student` | Checked | Smoke checked through mobile dashboard | Checked | Next-action/status grouping is clear. English evidence text remains. |
| `/student/proposal` | Checked | Checked | Not separately checked | Proposal scores hidden; comments visible. Raw `PASS` and English QA text remain. |
| `/student/schedule` | Checked | Not separately checked | Not separately checked | Desktop inspected through dashboard link; clear do/wait/done/locked separation. |
| `/student/report` | Checked after role session | Checked | Not separately checked | Locked state is understandable for current Student01 state. No form shown because not eligible yet. |
| `/student/feedback` | Checked | Not separately checked | Not separately checked | Read-only result/rubric page is functional but dense and partly bilingual. |

## Teacher

| Route | Desktop | 390px | 430px | Notes |
|---|---|---|---|---|
| `/teacher` | Checked | Checked | Checked | Workload summary usable; duplicate widgets remain; dashboard queue/history can grow. |
| `/teacher/schedules` | Checked | Checked | Not separately checked | Confirmed schedule history is very long; should cap/scroll/filter. |
| `/teacher/proposals` | Checked | Not separately checked | Not separately checked | Empty/current state clear; warning text useful. |
| `/teacher/progress1` | Checked | Not separately checked | Not separately checked | Route loads and empty state is clear; discoverability is weak when zero tasks. |
| `/teacher/progress2` | Checked | Not separately checked | Not separately checked | Route loads and empty state is clear; progress labels remain distinct. |
| `/teacher/final` | Checked | Not separately checked | Not separately checked | Empty/current state clear; no unauthorized action observed. |
| `/teacher/reports` | Checked | Checked | Not separately checked | Empty state clear; latest-version wording understandable. |
| `/teacher/advisor-score` | Checked | Checked | Not separately checked | Completed score cards readable but too tall for high-volume history. |

## Admin

| Route | Desktop | 390px | 430px | Notes |
|---|---|---|---|---|
| `/admin` | Checked | Checked | Not separately checked | Operationally usable; dashboard has QA/noise/duplicate shortcuts and English evidence text. |
| `/admin/rounds` | Checked | Checked | Not separately checked | Buckets clear; open/close action hierarchy still deserves safer visual separation. |
| `/admin/proposals` | Checked | Not separately checked | Not separately checked | Dense table; raw audit fields and English/enum labels visible. |
| `/admin/schedules` | Checked | Not separately checked | Not separately checked | 72 confirmed schedules appear as long history list. |
| `/admin/reports` | 404 | Not checked | Not checked | Route does not exist in current QA preview. Decide whether this route is required. |
| `/admin/closeout` | Checked | Smoke checked via mobile requirement context | Not separately checked | Ready/waiting/completed separation is clear; completed list can grow. |
| `/admin/evidence` | Checked | Checked | Not separately checked | Exports are discoverable; table exposes IDs/raw labels; no document-level horizontal overflow at 390px. |
| `/admin/evidence/exports/*` | Links discovered | Not checked | Not checked | CSV/XLSX links exist for grades, projects, timeline, scores, reports, and audit. No download was triggered during audit. |
