# Project Record + Dashboard IA Cleanup Plan

Status: IMPLEMENTED LOCALLY / QA LIVE VERIFY PENDING  
Owner context: Dashboard cleanup and project record page planning  
Environment: QA-first; do not touch production  
Last updated: 2026-05-14

## Read This First

Read this plan before any future work on dashboard restructuring, project detail/project record pages, moving information out of dashboards, or adding links from Student, Teacher, or Admin work queues to a project-level view.

This is not a Wave 2 execution plan, not a Figma redesign plan, and not a production rollout plan.

## Summary

Build a safer information architecture:

- Dashboard answers: "What do I need to do now?"
- Project record answers: "What has happened in this project, and what evidence/status exists?"
- Existing workflow pages answer: "How do I submit, approve, score, review, or close this item?"

The main planned addition is a read-only project record page:

- `/projects/[projectId]`

The page should aggregate project information for authorized viewers without changing workflow semantics.

## Hard Constraints

Do not:

- touch production;
- start or restart Wave 2;
- change Prisma schema;
- change authentication logic;
- change lifecycle logic;
- change scoring logic;
- change eligibility logic;
- change API semantics;
- add new mutation behavior to the project record page;
- remove existing Student, Teacher, or Admin workflow routes;
- reintroduce the Figma redesign work.

Allowed:

- add read-only project record query/service code;
- add read-only UI for project record;
- add links to the project record from existing pages;
- reduce duplicated dashboard display after the project record page works;
- improve Thai user-facing wording and compact dashboard layout.

## UTF-8 / Mojibake Guardrails

This work will add and move many Thai UI labels. Treat mojibake prevention as a hard quality gate.

Required:

- keep all edited source, Markdown, seed, and test files saved as UTF-8;
- preserve `.editorconfig` charset rules and `.gitattributes` LF normalization;
- do not copy Thai text from a broken PowerShell/terminal rendering such as `เธ...` mojibake;
- when checking Thai text, read the actual file in an editor/browser or use a UTF-8-safe output path, not the broken console view;
- if adding CSV/export text related to project records, include UTF-8 BOM for Excel-facing CSV output;
- set custom text/CSV/JSON response headers with `charset=utf-8` when adding new export or text responses;
- if reading files in scripts, explicitly use `utf8`;
- do not replace correct Thai source text with terminal-mojibake text while editing;
- add or update source tests when new Thai labels/export labels are introduced.

Stop and fix before continuing if:

- Thai labels render as mojibake in browser;
- tests or snapshots contain broken Thai text;
- a new export opens with broken Thai text in Excel-style tools;
- a patch diff shows Thai text replaced by `เธ...` mojibake sequences.

## Phase 0 - Safety + Artifact Setup

Before changing app code:

1. Confirm branch is `qa-preview`.
2. Inspect `git status`.
3. Identify unrelated dirty files and do not overwrite them.
4. Confirm UTF-8/mojibake guardrails above before editing Thai text.
5. Keep this plan as the source of truth.
6. Update or create these artifacts as work proceeds:
   - `IMPLEMENTATION_REPORT.md`
   - `VALIDATION_REPORT.md`
   - `DECISIONS.md`
   - `DEFERRED_ITEMS.md`

Stop and ask the user if:

- branch is not `qa-preview`;
- schema/production/auth files are unexpectedly dirty;
- implementation requires changing workflow logic.
- Thai source text appears corrupted and the correct original text cannot be confirmed.

## Phase 1 - Project Record Read Model

Create a project record service, for example:

- `getProjectRecordForViewer(projectId, sessionUser)`

The service owns:

- server-side access checks;
- project and related data query;
- role-filtered DTO generation;
- action link metadata only.

The service must not own:

- form submissions;
- server actions;
- lifecycle transitions;
- score calculations;
- round eligibility decisions.

Minimum DTO content:

- project summary;
- student and course offering;
- latest advisor request;
- active committee assignments;
- project origin/proposal;
- schedules;
- assessment attempts and score completion summary;
- report versions and review state;
- advisor score state;
- round exceptions / late / recovery state;
- timeline events;
- role-aware links to existing workflow routes.

Access rules:

- Admin can view all projects.
- Student can view only their own project.
- Teacher can view only projects where they are related as advisor, committee, evaluator, report reviewer, or another already-authorized project role.
- Unauthorized viewers must not receive project details in the DTO.

## Phase 2 - Add Read-Only Project Record Page

Add route:

- `/projects/[projectId]`

Page sections:

1. Project summary
2. People and roles
3. Current status and next step
4. Project origin / proposal
5. Exam schedules
6. Presentation assessment rounds
7. Report versions and reviews
8. Advisor score
9. Late / exception / recovery notes
10. Timeline / evidence

Rules:

- No new submit forms.
- No new mutation buttons.
- Only link out to existing workflow pages for actions.
- Hide role-restricted data in the DTO, not only with CSS.
- Preserve Markdown + KaTeX behavior.
- Use Thai user-facing wording, not raw enum labels.

## Phase 3 - Add Project Record Links Without Trimming Dashboards Yet

Add "ดูแฟ้มโครงงาน" links where a project id is already available:

- Student dashboard / student project page;
- Teacher dashboard queues;
- Teacher schedule/report/advisor-score/progress/final pages;
- Admin dashboard;
- Admin closeout/evidence/proposals/schedules/reports pages.

Do not force links into rows that do not clearly have a project id.

## Phase 4 - Student Dashboard Cleanup

Keep:

- next action;
- current status;
- do now / waiting / completed / locked summary;
- compact "my project" card;
- link to project record.

Move or reduce:

- long timeline;
- long schedule history;
- detailed committee history;
- report history;
- evidence detail that belongs in the project record.

Acceptance:

- student immediately knows what to do next;
- detailed history is reachable through the project record;
- mobile layout remains readable.

## Phase 5 - Teacher Dashboard Cleanup

Keep:

- actionable workload first;
- upcoming confirmed schedules, limited to a compact list;
- workload summary;
- links to task routes and project records.

Move or reduce:

- project-specific history;
- long schedule/score/report detail;
- widgets duplicated by navigation;
- summary cards that repeat the action queue.

Acceptance:

- teacher sees work requiring action first;
- role overlap remains understandable;
- no unauthorized action appears.

## Phase 6 - Admin Dashboard Cleanup

Keep:

- operational risk;
- pending admin action;
- round state;
- closeout readiness;
- exception / late signals;
- import / teacher claim alerts;
- links to project records.

Move or reduce:

- per-project history;
- long evidence/timeline detail;
- recent project detail that is not actionable.

Acceptance:

- admin sees operational priorities first;
- project-level detail is available in the project record;
- dangerous actions remain visually separated;
- no false-ready state is introduced.

## Phase 7 - Regression + QA Verify

Local validation after meaningful app changes:

- `npm run typecheck`
- `npm test`
- `npm run build`

QA verification:

- push only to `qa-preview`;
- use latest QA preview URL;
- start from `/qa-login`;
- select role dropdown before identity;
- verify Student, Teacher, and Admin access;
- verify unauthorized project access is blocked;
- verify desktop and 390px mobile basics.

## Phase 8 - Completion + Archive Policy

When implementation is complete, keep this folder as evidence first.

Expected final files:

- `PROJECT_RECORD_DASHBOARD_PLAN.md`
- `IMPLEMENTATION_REPORT.md`
- `VALIDATION_REPORT.md`
- `DECISIONS.md`
- `DEFERRED_ITEMS.md`

Mark status in:

- `IMPLEMENTATION_PROGRESS.md`
- `MD_STATUS_INDEX.md`

Do not delete this folder immediately. After the feature is stable, it can be moved to:

- `e2e-artifacts/_completed/project-record-dashboard/`

## Blocker Rules

Continue without asking if the issue is:

- UI layout;
- wording;
- missing link;
- read-only DTO missing data that can be queried safely;
- narrow test failure from UI/source tests.

Stop and ask if the issue requires:

- schema change;
- lifecycle/scoring/auth/eligibility change;
- exposing score/feedback data to a role that did not previously see it;
- production config change;
- destructive QA data mutation;
- ambiguous teacher visibility rule.

## Assumptions

- Work is QA-first on `qa-preview`.
- Project record v1 is read-only.
- Existing workflow pages remain the only place for mutations.
- Dashboard reduction happens only after the project record page exists and is verified.
- Data hidden from a role today remains hidden unless the user explicitly approves a visibility change.
