# Baseline And Rollback Plan

The redesign must be recoverable.

## Baseline To Preserve

Current stable baseline:

- Branch: `qa-preview`
- Wave 1: completed and preserved.
- Wave 2: 12-project operational loop completed.
- Latest verified QA preview at the time of this planning pack:
  - `https://system-project-math-sci-qiuuaim9o-lordtd-hubs-projects.vercel.app`

The app has passed:

- Proposal
- Progress 1
- Progress 2
- Final
- Report
- Advisor Score
- Admin Closeout
- Evidence/export continuity

## Required Before Implementation

Create a rollback tag before any redesign code patch:

```bash
git tag wave2-stable-before-redesign
git push origin wave2-stable-before-redesign
```

Then create a separate redesign branch:

```bash
git checkout -b codex/full-ui-redesign
```

If the user prefers to keep work on `qa-preview`, create the tag first and still keep patches tightly scoped.

## Route Safety Strategy

Preferred implementation approach:

1. Build new shared redesign components under `src/components/redesign/`.
2. Integrate page by page.
3. Keep current routes and server actions.
4. Avoid new API routes unless a proven UI interaction requires them.
5. Preserve old data services and guard logic.

Optional safer strategy for high-risk pages:

- create temporary comparison routes such as `/teacher/redesign` or `/admin/redesign`;
- compare old/new content and permissions;
- replace the original route only after the redesigned page matches behavior.

## Rollback Criteria

Rollback to the baseline tag if any redesign patch causes:

- auth or role guard regression;
- unauthorized action visibility;
- lifecycle transition mismatch;
- score/reviewer completion mismatch;
- report latest-version approval regression;
- round eligibility/close guard regression;
- production deployment risk;
- unrecoverable build/test failure.

## Validation Before Any QA Push

For code changes:

```bash
cmd /c npm.cmd run typecheck
cmd /c npm.cmd test
cmd /c npm.cmd run build
```

For documentation-only changes:

- no build is required;
- inspect changed files;
- ensure no QA secret or DB credential is written.

## Production Rule

Do not deploy production during redesign work.
