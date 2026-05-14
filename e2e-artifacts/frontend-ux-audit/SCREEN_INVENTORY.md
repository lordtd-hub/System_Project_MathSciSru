# Screen Inventory

Date: 2026-05-14

Baseline: classic UI on QA preview `https://system-project-math-sci-6tx0bev1p-lordtd-hubs-projects.vercel.app`

## Student Screens

| Route | Desktop | Mobile 390px | Primary UX Job | Audit Result |
|---|---:|---:|---|---|
| `/student` | checked | checked | show next valid action and lifecycle state | usable; action grouping clear |
| `/student/project` | checked | checked | project origin/profile editing and status | usable; form should stay spacious |
| `/student/proposal` | checked | checked | proposal evidence submission/history | usable; no overflow |
| `/student/schedule` | checked | checked | assessment evidence and schedule proposal | correct but long on mobile |
| `/student/report` | checked | checked | report submission/revision state | usable; history can be collapsed later |
| `/student/feedback` | checked | checked | read feedback/scores | usable; mostly read-only |
| `/student/profile` | source/inventory only | not live checked | student profile data entry | include in later form audit |
| `/student/origin` | source/inventory only | not live checked | older project origin path | verify if still user-facing before manuals |

## Teacher Screens

| Route | Desktop | Mobile 390px | Primary UX Job | Audit Result |
|---|---:|---:|---|---|
| `/teacher` | checked | checked | workload dashboard | usable; duplicated navigation/workload widgets remain |
| `/teacher/schedules` | checked | checked | approve/reject schedules | usable; high-volume queue scan still important |
| `/teacher/proposals` | checked | checked | Proposal review queue | usable; detail-heavy when many items |
| `/teacher/progress1` | checked | checked | Progress 1 scoring queue | usable |
| `/teacher/progress2` | checked | checked | Progress 2 scoring queue | usable |
| `/teacher/final` | checked | checked | Final scoring queue | usable |
| `/teacher/reports` | checked | checked | report review/revision | usable; latest-version language should stay prominent |
| `/teacher/advisor-score` | checked | checked | advisor score entry/read-only summary | usable; form mode should remain full-width/comfortable |
| `/teacher/advisor-requests` | source/inventory only | not live checked | approve/reject advisor requests | should be included in next teacher UX pass |
| `/teacher/scoring/[assignmentId]` | source/inventory only | not live checked | Proposal scoring form | must be checked before manual screenshots |
| `/teacher/claim` | source/inventory only | not live checked | teacher profile claim | lower priority for Wave 2 |

## Admin Screens

| Route | Desktop | Mobile 390px | Primary UX Job | Audit Result |
|---|---:|---:|---|---|
| `/admin` | checked | checked | operational dashboard | usable; shortcut density still high |
| `/admin/rounds` | checked | checked | open/close rounds and inspect buckets | stable; dangerous actions should remain visually separated |
| `/admin/closeout` | checked | checked | complete eligible projects | stable; keep ready vs waiting clear |
| `/admin/proposals` | checked | checked | final decision/release | correct but too dense at scale |
| `/admin/schedules` | checked | checked | schedule overview | correct but badge/list density high |
| `/admin/evidence` | checked | checked | evidence/export | works; technical event labels need wording pass |
| `/admin/round-exceptions` | source/inventory only | not live checked | late/reopen recovery | high priority before larger scale |
| `/admin/committee` | source/inventory only | not live checked | committee assignment | high priority for real operation |
| `/admin/import-students` | source/inventory only | not live checked | course/student setup | admin-only form audit needed before production roster |
| `/admin/students` | source/inventory only | not live checked | student list | medium priority |
| `/admin/teachers` | source/inventory only | not live checked | teacher management | medium priority |
| `/admin/claims` | source/inventory only | not live checked | teacher account claim review | medium priority |
| `/admin/reports` | not applicable | not applicable | admin report management | no route currently exists in repo |

## Screenshot Set

Selected audit screenshots were copied to:

- `e2e-artifacts/frontend-ux-audit/screenshots/`

The larger temporary redesign screenshot set was removed with the decommissioned redesign artifacts.
