# Project Record + Dashboard IA Cleanup Deferred Items

## Deferred

- Deeper dashboard redesign is deferred. This pass added the Project Record detail page and safe links, then kept dashboard trimming conservative so workflow pages and existing role-specific tests remain stable.
- More links can be added later to lower-traffic admin/teacher subpages if users ask for direct Project Record entry there.
- Full mobile visual QA remains part of Phase 7 live verification, not a new design pass.
- QA live role verification is deferred because the fresh QA preview is behind Vercel Deployment Protection and returned `401 Unauthorized` before the app loaded.

## Explicitly Out Of Scope

- Wave 2 execution.
- Figma redesign.
- Schema changes.
- New mutation workflows.
- Lifecycle/eligibility/scoring/auth behavior changes.
- Production changes.
