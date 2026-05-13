# Redesign Progress Log

## Baseline

- Branch: `qa-preview`
- Baseline commit: `01ed9e2`
- Safety tag created locally: `wave2-stable-before-redesign`
- Latest QA preview recorded from planning pack: `https://system-project-math-sci-qiuuaim9o-lordtd-hubs-projects.vercel.app`
- Production: not touched.

## 2026-05-13 - Phase 1 Shared UI Foundation

### Route / Component

- Shared component: `src/components/ui/TeacherWorkloadQueue.tsx`
- Shared stylesheet: `src/app/globals.css`

### Previous Issue

Teacher workload pages already used shared queue components, but the summary and compact queue rows still read like basic cards instead of a stronger operational dashboard surface. This made the high-volume teacher pages less visually aligned with the Figma Review Inbox direction.

### Redesign Applied

- Added an operational workload summary surface.
- Added an explicit "ต้องทำตอนนี้" total derived from the existing action metric.
- Added tone-specific left rails for action, waiting, completed, returned, and locked states.
- Made compact queue rows denser and easier to scan while preserving their existing links and content.
- Added mobile-aware support classes without changing route behavior.
- Added the same shared workload summary to `/teacher` so the dashboard aligns with the teacher queue pages.

### Logic Touched

No.

No auth, lifecycle, scoring, eligibility, server action, Prisma schema, or API semantics were changed.

### Validation

- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test` - passed, 81 test files / 342 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.
- Rerun after `/teacher` dashboard integration:
  - `cmd /c npm.cmd run typecheck` - passed.
  - `cmd /c npm.cmd test` - passed, 81 test files / 342 tests.
  - `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Live Verification

Pending after QA deploy.

Added `verify-teacher-workload-cdp.js` for non-mutating Edge/CDP verification. It reads the QA login secret from `.env.preview.local` and does not write the secret to artifacts.

### Remaining Risk

Low. The patch is presentation-only and uses existing component props.
