# Redesign Full Loop Prompt

Use this prompt when starting the implementation loop.

```text
Continue from the current repo state.

Project:
Mathematical Project Course Management System

Mode:
Full UI Redesign Loop

Read FIRST:
- e2e-artifacts/redesign-mapping/README.md
- e2e-artifacts/redesign-mapping/BASELINE_AND_ROLLBACK_PLAN.md
- e2e-artifacts/redesign-mapping/REAL_APP_SCREEN_INVENTORY.md
- e2e-artifacts/redesign-mapping/FIGMA_TO_APP_MAPPING.md
- e2e-artifacts/redesign-mapping/THEME_AND_CONTENT_RULES.md
- e2e-artifacts/redesign-mapping/REDESIGN_SKILL_GUIDE.md
- e2e-artifacts/redesign-mapping/REDESIGN_MASTER_PLAN.md
- PROJECT_SPEC.md
- IMPLEMENTATION_PROGRESS.md
- E2E_LIFECYCLE_REVIEW.md
- e2e-artifacts/PILOT_FIX_STATUS.md

Hard constraints:
- Do not touch production.
- Do not reset Wave 1 or Wave 2 data.
- Do not change lifecycle logic.
- Do not change scoring logic.
- Do not change round eligibility logic.
- Do not change auth/permission guards.
- Do not change Prisma schema unless a true blocker proves unavoidable.
- Preserve existing Thai UI text from the current app.
- Preserve the existing color theme from globals.css/tailwind.config.ts.
- Preserve the existing Mathematics & Statistics SRU logo at public/logo-mathstat-sru.jpg.
- Use Figma as layout/reference only; do not copy English demo copy into the app.

Execution model:
1. Freeze/read baseline.
2. Audit the real page before changing it.
3. Map the page to Figma/reference direction.
4. Patch UI/presentation only.
5. Validate locally.
6. Live QA verify on preview.
7. Record findings.
8. Continue to the next page automatically.

Severity:
- Minor/UX: record and continue.
- Major: stop page rollout, patch minimally, validate, verify, resume.
- Blocker: stop and report exact risk.

Implementation order:
1. Shared redesign components.
2. Teacher Review Inbox.
3. Teacher detail/scoring pages.
4. Admin Overview.
5. Admin Rounds/Lifecycle.
6. Admin operational pages.
7. Student design gap note.
8. Student pages only after design direction is clear.

Validation after code changes:
- cmd /c npm.cmd run typecheck
- cmd /c npm.cmd test
- cmd /c npm.cmd run build

Output after each loop:
- current phase;
- files inspected;
- files changed;
- old behavior preserved;
- validation result;
- live QA result;
- issues by severity;
- next exact step.
```
