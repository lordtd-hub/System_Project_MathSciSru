# Full UI Redesign Planning Pack

Status: redesign loop completed through global non-mutating desktop/mobile verification.

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

Use the redesigned QA preview as the baseline for Wave 2 planning. Mutating workflow regression should still be exercised in a safe action window because the final redesign verification was intentionally non-mutating.
