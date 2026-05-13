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

Passed on `https://system-project-math-sci-gn79zo76m-lordtd-hubs-projects.vercel.app`.

Added `verify-teacher-workload-cdp.js` for non-mutating Edge/CDP verification. It can read the QA login secret from an environment variable or `.env.preview.local` and does not write the secret to artifacts.

The verification script explicitly selects the teacher role dropdown before selecting the teacher identity. This guards against the repeated QA-login issue where the identity field is selected but the role dropdown remains blank.

Verified routes:

- `/teacher`
- `/teacher/schedules`
- `/teacher/proposals`
- `/teacher/progress1`
- `/teacher/progress2`
- `/teacher/final`
- `/teacher/reports`
- `/teacher/advisor-score`

Screenshots were recorded under `e2e-artifacts/redesign-mapping/screenshots/` using the `gn79zo76m` QA preview slug.

### Remaining Risk

Low. The patch is presentation-only and uses existing component props.

## 2026-05-13 - Phase 2 Teacher Subpage Redesign

### Routes / Components

- `/teacher/schedules`
- `/teacher/proposals`
- `/teacher/progress1`
- `/teacher/progress2`
- `/teacher/final`
- `/teacher/reports`
- `/teacher/advisor-score`
- Shared stylesheet: `src/app/globals.css`

### Redesign Applied

- `/teacher/schedules` now separates schedule work into action, waiting, returned, and completed buckets.
- Added a compact schedule approval queue before the long approval cards so teachers can scan many projects before opening details.
- Added explicit returned/rejected schedule visibility without mixing those rows into the actionable approval queue.
- `/teacher/proposals` now adds compact navigation for pending Proposal reviews before long review cards.
- Long teacher review/detail cards across Proposal, schedule approvals, Progress 1, Progress 2, Final, reports, and advisor-score now share a `teacher-review-card` surface for visual consistency.

### Logic Touched

No.

Existing queries, server actions, guards, scoring forms, report review forms, and advisor score forms were preserved.

### Validation

- `cmd /c npm.cmd run typecheck` - first run hit stale `.next/types` paths from the sandbox; rerun after `next build` passed.
- `cmd /c npm.cmd test -- teacher` - passed, 5 files / 17 tests.
- `cmd /c npm.cmd test` - passed, 81 files / 344 tests.
- `cmd /c npm.cmd run build` - passed, 35 routes generated.

### Live Verification

Pending after QA push for this Phase 2 patch.

### Next Phase

Continue with teacher mobile pass, then teacher regression verification before moving to Admin redesign.
