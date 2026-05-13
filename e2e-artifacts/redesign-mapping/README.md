# Full UI Redesign Planning Pack

Status: UX/readability stabilization completed through global non-mutating desktop/mobile verification. Figma visual redesign is now starting with a safe `classic` / `figma` UI mode foundation.

Important correction: this is not yet the full Figma visual redesign. The current QA UI is safer and easier to scan than before, but it has not been rebuilt to visually match the Figma mockup composition. See `FIGMA_VISUAL_REDESIGN_NEXT_PLAN.md`.

Current visual-redesign foundation:

- `classic` mode preserves the existing stabilized UI.
- `figma` mode is feature-flag/cookie controlled and currently changes the shared role shell first.
- Production remains `classic` unless explicitly enabled later.
- Page-level Figma renderers are still the next implementation step.

This folder is the source of truth for the new redesign work. It is intentionally separate from the older `WEBAPP_REDESIGN_PLAN.md`, because that file has encoding issues and also contains older visual-polish notes.

## Core Decision

The redesign is a frontend/presentation-layer project first.

It must preserve:

- existing backend data flow;
- existing server actions;
- existing auth and role guards;
- existing lifecycle, scoring, round eligibility, late/recovery, report, advisor-score, and closeout semantics;
- existing Thai UI wording from the current app unless a wording change is explicitly approved;
- existing Mathematics & Statistics SRU logo;
- existing project color theme and brand tokens.

## Files In This Pack

- `REDESIGN_MASTER_PLAN.md` - end-to-end redesign plan.
- `BASELINE_AND_ROLLBACK_PLAN.md` - how to keep the current stable app recoverable.
- `REAL_APP_SCREEN_INVENTORY.md` - real routes/pages that must be mapped before redesign.
- `FIGMA_TO_APP_MAPPING.md` - current Figma mockup coverage and gaps.
- `THEME_AND_CONTENT_RULES.md` - color, logo, typography, and copy constraints.
- `REDESIGN_SKILL_GUIDE.md` - design/implementation skills and working rules for Codex.
- `REDESIGN_FULL_LOOP_PROMPT.md` - copy-paste prompt for executing the redesign as a full loop.
- `REDESIGN_PROGRESS_LOG.md` - execution log for completed redesign phases.
- `REDESIGN_VALIDATION_REPORT.md` - local and live QA validation evidence.
- `REDESIGN_DEFERRED_ITEMS.md` - deferred redesign/workflow items.
- `REDESIGN_COMPLETION_REPORT.md` - final readiness summary for the current redesign loop.
- `FIGMA_VISUAL_REDESIGN_NEXT_PLAN.md` - correction note and concrete plan for the actual Figma-style visual redesign pass.

## Current Figma Evidence Captured

The mockup was inspected through the open Edge/Figma Make preview, not through direct Figma API access.

Captured reference screenshots:

- `e2e-artifacts/figma-mockup-admin-overview.png`
- `e2e-artifacts/figma-mockup-admin-rounds.png`
- `e2e-artifacts/figma-mockup-teacher-inbox.png`
- `e2e-artifacts/figma-mockup-project-review-desktop.png`
- `e2e-artifacts/figma-mockup-mobile-admin-overview.png`
- `e2e-artifacts/figma-mockup-mobile-teacher-inbox.png`
- `e2e-artifacts/figma-mockup-project-review-mobile.png`

## Current Recommendation

Treat the current QA preview as a stable UX/readability baseline, not as the final Figma visual redesign. The work is moving in the right direction because workflow semantics stayed safe, but the next UI task should be a dedicated Figma Visual Redesign Implementation Pass before calling the redesign complete.
