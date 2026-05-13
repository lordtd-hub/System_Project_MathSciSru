# Redesign Deferred Items

## Deferred Until After Teacher Shared UI Validation

- Full Admin redesign.
- Full Student redesign.
- Figma-style project review detail refactor for long scoring forms.
- Live mobile screenshot pass.
- Temporary comparison routes.

## Deferred After Teacher Subpage Phase 2 Patch

- Deeper two-column Project Review Detail restructuring for scoring forms remains deferred because it would be a larger layout replacement across rubric-heavy pages.
- Teacher mobile screenshot pass is still pending after the Phase 2 QA deploy.
- Live mutation regression for approve/reject/score/report/advisor-score is still pending; current verification is non-mutating unless a later phase explicitly exercises actions.

## Known Design Gaps

- Student dashboard has no Figma mockup yet.
- Admin evidence/export and closeout pages need their own detailed mapping before major layout changes.
- Some Thai source files display as mojibake in terminal output, so UI copy should be reused from source and not retyped unless necessary.
