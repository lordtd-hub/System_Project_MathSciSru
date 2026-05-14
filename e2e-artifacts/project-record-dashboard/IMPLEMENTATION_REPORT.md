# Project Record + Dashboard IA Cleanup Implementation Report

## Status

- Phase 0: Complete.
- Phase 1: Complete.
- Phase 2: Complete.
- Phase 3: Complete.
- Phase 4: Complete.
- Phase 5: Complete.
- Phase 6: Complete.
- Phase 7: Local validation complete; QA deploy/live verification pending.
- Phase 8: Documentation updated; archive deferred until QA stability is confirmed.

## Start State

- Branch: `qa-preview`
- Baseline commit: `484bc80`
- Scope: read-only Project Record page plus dashboard information architecture cleanup.
- Production: not touched.
- Schema: no schema changes planned.
- Workflow semantics: no lifecycle/auth/scoring/eligibility changes planned.

## Phase Notes

### Phase 0 - Safety + Artifact Setup

Created this artifact set to keep the cleanup pass separate from Wave 1, Wave 2, and the paused Figma redesign work.

### Phase 1 - Project Record Read Model

Implemented:

- `src/lib/projects/projectRecord.ts`
- `src/lib/projects/projectRecord.test.ts`

The service is read-only. It owns project-record query composition, DTO shaping, and viewer access checks. It does not create mutations, server actions, schema changes, or workflow transitions.

Access coverage:

- Admin: all projects.
- Student: own project by generated email.
- Teacher: existing related projects only through advisor request, active committee assignment, schedule approval, evaluator assignment, report review, or advisor-score relationship.
- Unrelated viewers: safe unauthorized result.

### Phase 2 - Read-Only Project Record Page

Implemented:

- `src/app/projects/[projectId]/page.tsx`

The page is read-only and uses `getProjectRecordForViewer`. It has no forms, no server actions, and only links back to existing role workflow pages.

Sections added:

- project summary
- student/course/advisor status
- origin/proposal
- assessment attempts
- reports/reviews
- people/participants
- schedules
- advisor score
- exceptions/recovery
- timeline/evidence

### Phase 3 - Add Links

Implemented safe links without replacing existing workflow routes:

- Student dashboard, proposal, schedule, report, and feedback pages.
- Teacher dashboard proposal queue.
- Teacher schedule approval page.
- Admin dashboard pending confirmation and status overview sections.

All links point to `/projects/[projectId]` and existing workflow action links remain in place.

### Phases 4-6 - Dashboard Cleanup

Implemented initial cleanup:

- Student dashboard now points users to Project Record for full details.
- Student dashboard query now keeps fewer schedule/timeline history rows because the full history is available in Project Record.
- Teacher dashboard keeps actionable workload first and adds Project Record links from teacher project context.
- Admin dashboard keeps operational actions and adds Project Record links from admin project context.

Deferred deeper dashboard reshaping remains in `DEFERRED_ITEMS.md` so this pass does not become another broad redesign.

### Phase 7 - Full Regression + QA Verify

Local validation is complete:

- `npm run typecheck` passed.
- Targeted project-record and dashboard source tests passed.
- `npm test` passed.
- `npm run build` passed.

QA deploy/live verification remains pending because the branch has not yet been pushed after this implementation pass.

### Phase 8 - Completion + Archive Policy

Updated the project-record-dashboard artifact set and top-level status indexes. Do not archive this folder yet; keep it as active implementation evidence until QA live verification is complete and the route is stable.
