# Redesign Deferred Items

## Deferred Until After Teacher Shared UI Validation

- Full Admin redesign.
- Full Student redesign.
- Figma-style project review detail refactor for long scoring forms.
- Live mobile screenshot pass.
- Temporary comparison routes.

## Deferred After Teacher Subpage Phase 2 Patch

- Deeper two-column Project Review Detail restructuring for scoring forms remains deferred because it would be a larger layout replacement across rubric-heavy pages.
- Live mutation regression for approve/reject/score/report/advisor-score is still pending; current verification is non-mutating unless a later phase explicitly exercises actions.

## Completed From Deferred List

- Teacher mobile screenshot pass completed at 390px width on the `g5enipsvz` QA preview with no detected horizontal overflow.
- Teacher non-mutating role/render regression completed with `teacher-delta` on the `g5enipsvz` QA preview.
- Admin redesign entry audit and non-mutating live verification completed on the `1thdur8ic` QA preview for desktop and 390px mobile routes.
- Student project/proposal readability summaries were added and live-verified on the `4pvh39ven` QA preview for desktop and 390px mobile routes.
- Global non-mutating desktop/mobile regression completed on the `66nqpox8d` QA preview for Teacher, Admin, and Student route groups.

## Known Design Gaps

- Page bodies are only partially split into `Classic...View` and `Figma...View` renderers. `/teacher`, `/teacher/schedules`, and `/teacher/proposals` now have page-level Figma renderer entries; remaining teacher subpages, admin pages, and student pages still need the same safe renderer pattern.
- Student dashboard has no Figma mockup yet, but the real dashboard already has an action/waiting/locked workflow grouping. Larger visual changes remain deferred.
- Admin evidence/export and closeout pages are operationally verified, but deeper table/filter redesign remains deferred until a larger visual pass.
- Figma-style two-column review/detail layouts for scoring, schedule review, report review, and advisor score pages remain the next high-value visual implementation area.
- Some Thai source files display as mojibake in terminal output, especially through PowerShell. Source files should remain UTF-8, verifier scripts should avoid embedding Thai regex through PowerShell, CSV/export routes should keep UTF-8/BOM handling, and UI copy should be reused from source/browser rendering rather than trusted from terminal output alone.
- Mutating admin actions such as round close/open/reset and closeout confirmation should only be exercised in a safe action window, not during non-mutating redesign verification.
- `.env.preview.local` may not always contain the active QA preview secret. Live verification should prefer a process-scoped `QA_LIVE_SECRET` and must never write the secret to artifacts.

## Deferred After Admin Renderer Batch 1

- `/admin/proposals` renderer split is complete and live-verified in classic/figma mode on desktop and 390px mobile.
- Planning references `/admin/reports`, but the current repo has no real `src/app/admin/reports/page.tsx` route. Treat it as a mapping/deferred item until a real admin reports route exists.
- Admin mutating regression for round open/close/reset and closeout confirmation remains deferred until a safe QA action window; current admin visual verification should be non-mutating first.

## Deferred After Admin Route Verification

- Admin mutating regression remains deferred:
  - round open/close/reset;
  - Proposal final decision submit;
  - Proposal feedback release;
  - closeout confirmation.
- The next redesign phase should move to Student pages. Student has less direct Figma coverage, so use the shared visual system conservatively and keep the old workflow wording/forms intact.
