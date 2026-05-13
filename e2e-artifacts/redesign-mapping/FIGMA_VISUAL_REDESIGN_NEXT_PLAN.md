# Figma Visual Redesign Next Plan

## Reality Check

The current implementation is moving in the correct direction, but the naming in earlier notes was too strong.

What is completed:

- Workflow logic remains stable after UI changes.
- Teacher workload pages are more scannable.
- Admin operational pages are clearer than before.
- Student long-form pages now have readability summaries.
- Desktop and 390px mobile non-mutating route checks passed.
- QA login verifiers now explicitly select the role dropdown before identity selection.

What is not completed:

- The app does not yet visually match the Figma redesign.
- The global shell/sidebar/header composition has not been rebuilt.
- Admin and Teacher dashboard layouts are not yet visually aligned with the mockup.
- Project review/detail pages have not been converted to the Figma-style two-column review layout.
- Mobile screens have been checked for overflow, but not redesigned to match the Figma mobile composition.
- Student dashboard still has no dedicated Figma mockup.

Conclusion: the project is on the right path as a safe stabilization-first approach, but the next pass must be named and executed as a real Figma visual redesign pass.

## Correct Phase Naming

The work completed so far should be called:

**UX/readability stabilization baseline**

The next work should be called:

**Figma Visual Redesign Implementation Pass**

Do not call the redesign complete until real app screenshots are visibly close to the Figma references.

## Why This Order Is Still Right

The current order is still technically sound because:

- Wave 1 workflow logic was stabilized before visual changes.
- UI changes avoided lifecycle/auth/scoring/schema risk.
- Teacher/Admin/Student routes were verified after every major UI pass.
- The recurring QA role dropdown issue was captured and guarded in verification scripts.

This reduces the chance that a visual redesign accidentally breaks the course workflow.

## Next Full Loop Plan

### Phase 0 - Safe Classic/Figma UI Mode Foundation

Status: implemented as the first safe slice.

Goal:

- Keep the old UI available as `classic`.
- Add a `figma` presentation mode without changing route behavior, data loading, permissions, guards, or server action semantics.
- Keep production on `classic` unless explicitly allowed later.
- Let QA switch modes through a feature-flag/cookie path.

Implemented foundation:

- `src/lib/uiMode.ts` defines `classic` / `figma` mode selection.
- `src/app/ui-mode/actions.ts` stores the selected UI mode in an HTTP-only cookie.
- Admin, Teacher, and Student layouts choose between the original role nav and the new Figma-style role shell.
- `src/components/redesign/FigmaRoleShell.tsx` adds the shared sidebar/mobile shell and QA-visible mode switch.
- `src/components/redesign/VisualSurfaces.tsx` adds first-pass shared visual primitives for future page renderers.

Important boundary:

- This phase is not the full visual redesign.
- Page bodies are still mostly the existing stabilized UI.
- The next phase must split key pages into `Classic...View` and `Figma...View` renderers while keeping the original data owner page intact.

### Phase 1 - Visual Source Review

Inputs:

- `FIGMA_TO_APP_MAPPING.md`
- Figma screenshots under `e2e-artifacts/figma-mockup-*.png`
- Current live QA screenshots under `e2e-artifacts/redesign-mapping/screenshots/`

Tasks:

- Compare current QA screenshots against Figma references.
- Mark each route as:
  - close enough.
  - partially aligned.
  - not visually aligned.
- Define exact visual gaps: shell, sidebar, page header, cards, tables, badges, buttons, mobile layout.

Output:

- Add a visual gap table to this file or a follow-up visual audit file.

### Phase 2 - Shared Visual Shell

Goal:

- Create shared visual components that can make pages look closer to Figma without changing workflow logic.

Candidate components:

- app shell / dashboard frame.
- page header.
- section header.
- KPI/stat card.
- compact operational card.
- queue/list/table row.
- status and role badges.
- action panel.
- warning/danger panel.

Rules:

- Use existing theme colors and department logo.
- Preserve existing Thai text.
- Do not move business rules into components.
- Keep routes and server actions unchanged.

### Phase 3 - Teacher Visual Redesign

Start here because Figma coverage is strongest.

Routes:

- `/teacher`
- `/teacher/schedules`
- `/teacher/proposals`
- `/teacher/progress1`
- `/teacher/progress2`
- `/teacher/final`
- `/teacher/reports`
- `/teacher/advisor-score`

Tasks:

- Rebuild page composition to match Figma visual hierarchy.
- Make workload inbox feel like a modern review queue.
- Keep action/waiting/completed separation from the stabilization pass.
- Preserve all forms, links, permissions, and server actions.
- Compare screenshot after each page against Figma reference.

### Phase 4 - Admin Visual Redesign

Routes:

- `/admin`
- `/admin/rounds`
- `/admin/round-exceptions`
- `/admin/proposals`
- `/admin/schedules`
- `/admin/reports`
- `/admin/closeout`
- `/admin/evidence`

Tasks:

- Apply the Figma dashboard/operations visual language.
- Make dangerous actions visually separated.
- Keep eligibility buckets, close guards, late/exception wording, and grade-I warning semantics unchanged.
- Improve table/list density without changing data source or permissions.

### Phase 5 - Student Visual Direction

Issue:

- Figma does not yet cover Student dashboard.

Decision needed:

- Either create a Student visual mockup first.
- Or apply the same design system conservatively to student pages.

Recommended safe path:

- Do not invent a drastically different student UX.
- Keep current Thai wording and workflow order.
- Use the new shell, headers, badges, and summary blocks.
- Preserve familiar form locations.

Routes:

- `/student`
- `/student/project`
- `/student/proposal`
- `/student/schedule`
- `/student/report`
- `/student/feedback`

### Phase 6 - Mobile Visual Pass

Goal:

- Match the Figma mobile direction, not only pass overflow checks.

Tasks:

- Recheck 390px and one larger mobile viewport.
- Verify navigation, cards, queue rows, badges, and action buttons.
- Ensure long Thai text wraps cleanly.

### Phase 7 - Workflow Regression

Run safe mutating checks after visual work:

- schedule approve/reject/resubmit.
- proposal/progress/final scoring submit.
- report revision and latest-version approval.
- advisor score submit.
- admin round open/close guard.
- admin closeout.

This should use QA preview only and must preserve production.

### Phase 8 - Completion Criteria

The visual redesign can be called complete only when:

- Current screenshots are visibly close to Figma references for covered pages.
- Teacher/Admin pages share the same visual system.
- Student pages are at least visually consistent, or a Student mockup exists.
- Desktop and mobile visual QA pass.
- Typecheck, tests, and build pass.
- Live QA smoke/regression pass.
- No auth/lifecycle/scoring/eligibility regression appears.

## Recommended Next Prompt

Use a new prompt named:

**Figma Visual Redesign Implementation Pass**

The prompt should start by reading:

- `e2e-artifacts/redesign-mapping/README.md`
- `e2e-artifacts/redesign-mapping/FIGMA_VISUAL_REDESIGN_NEXT_PLAN.md`
- `e2e-artifacts/redesign-mapping/FIGMA_TO_APP_MAPPING.md`
- `e2e-artifacts/redesign-mapping/THEME_AND_CONTENT_RULES.md`
- `e2e-artifacts/redesign-mapping/REAL_APP_SCREEN_INVENTORY.md`
- `e2e-artifacts/redesign-mapping/REDESIGN_DEFERRED_ITEMS.md`
- `e2e-artifacts/redesign-mapping/REDESIGN_VALIDATION_REPORT.md`
- `IMPLEMENTATION_PROGRESS.md`

Primary instruction:

Do not treat the existing stabilization pass as the final visual redesign. Use it as the safe baseline, then implement the Figma visual layer page by page while preserving all workflow semantics.
