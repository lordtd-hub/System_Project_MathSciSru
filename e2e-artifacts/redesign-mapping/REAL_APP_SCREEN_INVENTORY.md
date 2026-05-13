# Real App Screen Inventory

This inventory is the starting point for the redesign mapping audit. It lists current real routes that must be reviewed before implementation.

## Admin Routes

| Route | Current purpose | Redesign need | Figma coverage | Risk |
| --- | --- | --- | --- | --- |
| `/admin` | Admin dashboard and operational entry point | Redesign as Admin Overview with KPI + action queue | Covered by Admin Overview mockup | Medium |
| `/admin/rounds` | Open/close rounds, eligibility buckets, close guards | Redesign as lifecycle/round control cards | Covered by Rounds & Lifecycle mockup | High |
| `/admin/round-exceptions` | Late/reopen/exception management | Needs operational exception panel | Partial only | High |
| `/admin/proposals` | Proposal decision/admin approval workflow | Needs compact decision queue | Partial via Admin action queue | Medium |
| `/admin/schedules` | Schedule approval oversight | Needs scan-friendly queues | Not directly covered | Medium |
| `/admin/reports` | Report status/admin monitoring | Needs review state grouping | Not directly covered | Medium |
| `/admin/closeout` | Completion eligibility and final closeout | Needs checklist/list layout | Not directly covered | High |
| `/admin/evidence` | Evidence and CSV/XLSX exports | Needs evidence/export clarity | Not directly covered | Medium |
| `/admin/students` | Student roster/admin view | Lower priority redesign | Not covered | Low |
| `/admin/teachers` | Teacher management | Lower priority redesign | Not covered | Low |
| `/admin/committee` | Committee assignment | Needs careful table/form review | Not covered | Medium |
| `/admin/import-students` | Course offering/student import | Later wizard candidate | Not covered | Medium |
| `/admin/claims` | Teacher account claim approvals | Lower priority operational page | Not covered | Low |

## Teacher Routes

| Route | Current purpose | Redesign need | Figma coverage | Risk |
| --- | --- | --- | --- | --- |
| `/teacher` | Teacher dashboard | Redesign as Review Inbox / workload overview | Covered by Teacher Review Inbox mockup | Medium |
| `/teacher/proposals` | Proposal review/scoring | Use Project Review Detail pattern | Covered by detail mockup | High |
| `/teacher/progress1` | Progress 1 scoring | Use Project Review Detail pattern adapted to Progress scoring | Detail pattern applicable | High |
| `/teacher/progress2` | Progress 2 scoring | Use Project Review Detail pattern adapted to Progress scoring | Detail pattern applicable | High |
| `/teacher/final` | Final scoring | Use Project Review Detail pattern adapted to Final scoring | Detail pattern applicable | High |
| `/teacher/reports` | Report review/revision | Use Review Detail pattern without numeric scoring | Detail pattern applicable | High |
| `/teacher/advisor-score` | Advisor score 25% | Use Review Detail pattern with advisor rubric | Detail pattern applicable | High |
| `/teacher/schedules` | Schedule proposal approvals | Needs action/waiting/completed queue | Partial via Teacher Inbox | Medium |
| `/teacher/advisor-requests` | Advisor request approval/rejection | Needs compact action queue | Partial via Teacher Inbox | Medium |
| `/teacher/claim` | Teacher account claim | Keep mostly as-is, lower priority | Not covered | Low |
| `/teacher/scoring/[assignmentId]` | Legacy/individual scoring route | Audit before redesign | Not covered | Medium |

## Student Routes

| Route | Current purpose | Redesign need | Figma coverage | Risk |
| --- | --- | --- | --- | --- |
| `/student` | Student dashboard and next actions | Needs new Student mockup before major redesign | Missing | High |
| `/student/profile` | Student profile | Keep simple, polish only | Missing | Low |
| `/student/origin` | Project origin/profile workflow | Needs next-action clarity | Missing | Medium |
| `/student/project` | Project/advisor request | Needs state clarity | Missing | Medium |
| `/student/proposal` | Proposal submission/state | Needs post-submit/waiting/locked clarity | Missing | High |
| `/student/schedule` | Evidence + schedule for Progress/Final | Needs strong state design | Missing | High |
| `/student/report` | Report submission/revision | Needs strong state design | Missing | High |
| `/student/feedback` | Feedback/scores/results | Needs score/history clarity | Missing | Medium |

## Shared / Support Routes

| Route | Current purpose | Redesign need | Notes |
| --- | --- | --- | --- |
| `/` | Public entry | Keep Thai copy and logo, polish only | Do not turn into marketing landing unless requested |
| `/login` | Production login | Preserve Google OAuth flow | Auth-sensitive |
| `/qa-login` | QA identity selector | QA-only; keep role dropdown guard visible | Do not redesign away testing clarity |
| `/dev-login` | Dev login | Development-only | Do not expose in production |
| `/dev/latex-test` | Dev utility | No redesign priority | Dev-only |

## Estimated Redesign Surface

- Admin: 8 high/medium-value pages.
- Teacher: 8 high/medium-value pages.
- Student: 5 high-value pages, but mockups are still missing.
- Shared shell/components: 8-12 reusable components.

## Current Implementation Recommendation

1. Map all current page copy and actions before changing routes.
2. Implement Teacher inbox/detail first.
3. Implement Admin overview/rounds second.
4. Design Student screens before major Student redesign.
