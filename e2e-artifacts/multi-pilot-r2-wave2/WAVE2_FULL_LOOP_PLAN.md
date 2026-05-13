# MULTI-PILOT-R2 Wave 2 Full-Loop Plan

Date: 2026-05-13
Status: planning artifact. Wave 2 execution has not started.
Branch target: `qa-preview`
Latest Wave 1 cleanup commit: `b4c62a3`
Latest Wave 1 cleanup QA preview: `https://system-project-math-sci-2wk1i9sbn-lordtd-hubs-projects.vercel.app`

## Purpose

Wave 1 proved that one controlled end-to-end lifecycle can finish:

Proposal -> Progress 1 -> Progress 2 -> Final -> Report -> Advisor Score -> Admin Closeout

Wave 2 should prove that the same lifecycle remains usable and correct when the system has more concurrent work, denser teacher/admin queues, and more exception cases.

Wave 2 is not a broad redesign pass. It is a scale, exception, queue, and operational-safety pilot.

## Decision Questions Before Execution

The following items should be answered before running the Wave 2 full loop.

Recommended default answers are included so the execution prompt can move forward once approved.

1. Data strategy
   - Recommended: create an isolated Wave 2 QA course offering and preserve Wave 1 data as historical evidence.
   - Reason: existing Wave 1 state is completed, so it is useful for regression/export checks but awkward for new active workflow scale testing.
   - Alternative: continue from the existing Wave 1 course only for Project03 recovery/export checks, and create no new course. This limits scale coverage.

2. Scale target
   - Recommended: 12 active projects for the first Wave 2 run.
   - Reason: this creates realistic teacher queue density without making the first scale loop too slow to diagnose.
   - Stretch target after 12-project pass: 20 active projects.

3. Exception mix
   - Recommended:
     - 8 normal projects.
     - 1 late Proposal recovery.
     - 1 Progress 1 incomplete/reopen recovery.
     - 1 schedule rejection/resubmission loop.
     - 1 report revision/latest-version loop.
   - Keep Project03 from Wave 1 as an existing recovery visibility regression check.

4. UI patch boundary
   - Recommended: allow focused UI/readability patches for student/admin/teacher queue clarity.
   - Do not perform a full visual redesign or change lifecycle/scoring/eligibility/auth/schema semantics.

5. Performance expectation
   - Recommended: Wave 2 checks operational responsiveness by human-observable page load/render behavior and export success.
   - Do not introduce load-testing infrastructure unless a clear performance blocker appears.

6. Documentation/manual screenshots
   - Recommended: still deferred until Wave 2 completes or is explicitly paused for documentation.

## Operating Rules

Production rules:

- Do not touch production.
- Do not deploy production.
- Do not run production seed/migration commands.
- Use `qa-preview` only.

Data rules:

- Do not reset Wave 1 data.
- Do not delete old pilot data.
- Do not overwrite historical evidence artifacts.
- If Wave 2 needs new active workflow data, create a new isolated QA-only course offering instead of mutating Wave 1 completed projects.

Business-rule boundaries:

- Do not change lifecycle semantics.
- Do not change scoring formulas.
- Do not change round eligibility semantics.
- Do not weaken auth/guards.
- Do not change Prisma schema unless a blocker proves it is unavoidable.
- Do not create per-project assessment rounds.

Patch boundary:

- Allowed: UI/readability, queue grouping, labels, filters, export label clarity, safe action hierarchy, focused bug fixes.
- Forbidden: broad redesign, schema changes, production config changes, speculative lifecycle rewrites.

Browser rules:

- Use Microsoft Edge persistent session.
- Do not close Edge.
- Do not reset storage/cookies.
- After every push, use the new QA preview URL.
- Start verification at `/qa-login`.
- Guard role, route, project, round, and state before every action.
- Stop immediately on state mismatch.

## Severity Policy

Blocker:

- Unauthorized action succeeds.
- Data corruption.
- Project advances incorrectly.
- Round unlock is wrong.
- Scoring completes with missing required reviewer.
- Report/latest-version approval bypass.
- Advisor score unlocks early.
- Admin closeout completes invalid project.
- Workflow deadlock with no recovery path.

Major:

- Wrong role sees actionable work.
- Page becomes blank/shell-only after valid submit.
- User cannot continue after successful backend action.
- Queue/counter semantics are seriously wrong.
- Close/open round guard is wrong.
- Stale action can cause invalid submit.
- Export crashes.
- Recovery path becomes misleading enough to cause operational error.

Minor:

- Wording ambiguity.
- Layout density.
- Duplicate labels.
- Non-critical dashboard confusion.
- Harmless console warning.
- Visual hierarchy issue.

Minor issues are recorded and the loop continues.
Major/Blocker issues stop the current phase, get patched minimally, validated, pushed to QA, live-verified, then the loop resumes from the same state.

## Wave 2 Phase Plan

### Phase 0 - Preconditions and State Guard

Read first:

- `PROJECT_SPEC.md`
- `IMPLEMENTATION_PROGRESS.md`
- `E2E_LIFECYCLE_REVIEW.md`
- `e2e-artifacts/PILOT_FIX_STATUS.md`
- `e2e-artifacts/multi-pilot-r2-wave1/REPORT.md`
- `e2e-artifacts/multi-pilot-r2-wave1/WAVE1_CLEANUP_STABILIZATION_REPORT.md`
- `e2e-artifacts/multi-pilot-r2-wave1/WAVE2_PLANNING_NOTE.md`
- `e2e-artifacts/multi-pilot-r2-wave2/WAVE2_FULL_LOOP_PLAN.md`

Verify:

- Current branch is `qa-preview`.
- Worktree has no unrelated staged changes.
- Latest QA preview is reachable.
- Wave 1 completed state is still preserved.
- Production config was not touched.

Artifacts to create/update during Wave 2:

- `e2e-artifacts/multi-pilot-r2-wave2/REPORT.md`
- `e2e-artifacts/multi-pilot-r2-wave2/PENDING_FROM_PROMPT.md`
- `e2e-artifacts/multi-pilot-r2-wave2/MANUAL_NOTES.md`
- `e2e-artifacts/multi-pilot-r2-wave2/VALIDATION_REPORT.md`
- screenshots under `e2e-artifacts/multi-pilot-r2-wave2/screenshots/`

### Phase 1 - Wave 2 Data Setup Decision

If the user approves the recommended data strategy:

- Create a new isolated QA-only Wave 2 course offering.
- Use 12 active projects.
- Use existing QA login and QA-only test identities.
- Do not reset or delete Wave 1 data.
- Do not touch production.

If the user chooses to reuse existing Wave 1 data only:

- Do not create a new course offering.
- Limit Wave 2 to read-only regression, Project03 recovery visibility, export checks, and UX density review.
- Record that full active workflow scale coverage remains untested.

Stop and ask if data strategy has not been approved.

### Phase 2 - Proposal Scale and Queue Density

Goal:

- Verify Proposal workflow with more simultaneous project work than Wave 1.

Recommended run:

- Students submit Proposal for 12 projects.
- Admin confirms/advises as needed.
- Teachers score Proposal with overlapping advisor/chair/member roles.
- Admin final decisions include:
  - normal pass,
  - pass with revision if current workflow supports it,
  - at least one delayed/late Proposal case.

Verify:

- Teacher Proposal queue separates needs action from completed/read-only work.
- Admin Proposal page distinguishes pending/final/completed/late clearly.
- Students see clear next action/waiting states.
- Unauthorized teachers do not see actionable Proposal work.
- Proposal counters stay correct.

### Phase 3 - Progress 1 Scale

Goal:

- Stress round eligibility, schedule approval, scoring, and close guard.

Recommended run:

- Open Progress 1.
- 10 or more eligible projects submit evidence.
- Students propose schedules before moving to teacher actions where possible, so teacher queues become dense.
- Teachers approve schedule proposals.
- Two required reviewers submit scores per project.
- Keep one eligible project incomplete for close-guard verification.

Verify:

- Not-yet-eligible projects do not count as incomplete blockers.
- Eligible-but-incomplete projects are the only close blockers.
- Schedule approval queues remain readable with many items.
- Scoring requires required reviewers.
- Completed scoring becomes read-only.
- Close acknowledgement lists only affected projects.

### Phase 4 - Progress 2 Scale and Recovery

Goal:

- Repeat Progress 1 semantics under denser state and include a recovery case.

Recommended run:

- Open Progress 2 only for projects that completed Progress 1.
- Submit all student evidence first, then move to teacher approvals, to intentionally test teacher queue density.
- Include one schedule rejection/resubmission loop.
- Include one project that becomes eligible late or needs per-case reopen if operationally safe.

Verify:

- Late/reopen recovery does not unlock unrelated projects.
- Student pages do not show false-ready states.
- Teacher queues do not duplicate stale schedule/scoring actions.
- Admin round buckets remain correct.
- Timezone display remains Bangkok/Thailand time.

### Phase 5 - Final Round and Grade-I Risk

Goal:

- Verify Final semantics with scale and close guard wording.

Recommended run:

- Open Final only for projects with completed Progress 2.
- Submit Final evidence and schedules.
- Teachers approve and score required projects.
- Leave one eligible project incomplete only if needed to verify Final grade-I warning.

Verify:

- Final completion derives from required committee score completion.
- Final close guard shows eligible-but-incomplete projects only.
- Grade-I warning is visible when Final closes with eligible incomplete projects.
- Incomplete projects remain recoverable/consistent.
- Report flow unlocks only after Final score completion.

### Phase 6 - Report, Revision, Advisor Score, Closeout

Goal:

- Verify report latest-version logic, advisor score unlock, and closeout eligibility at scale.

Recommended run:

- At least 6 projects submit reports.
- At least 1 project goes through revision request -> v2 submit -> latest-version approval.
- Advisor scores unlock only after report approval.
- Same advisor with multiple projects submits advisor scores.
- Admin closes out only valid projects.

Verify:

- Old report approval does not approve latest revision automatically.
- Advisor score does not unlock for locked/incomplete projects.
- Advisor score page is read-only after submit.
- Admin closeout separates ready/waiting/completed projects.
- Completed student dashboard has no false pending tasks.

### Phase 7 - Evidence, Export, and AUN-QA Continuity

Goal:

- Verify evidence continuity and export clarity with larger data volume.

Check:

- Evidence page renders without raw/internal labels dominating the UI.
- Timeline/history includes important actions.
- Report versions are visible.
- Advisor score evidence is visible.
- Grade CSV/XLSX export works.
- Grade export includes:
  - student code,
  - first name,
  - last name,
  - full Thai name,
  - Proposal 10%,
  - Progress 1 10%,
  - Progress 2 10%,
  - Final 10%,
  - presentation total 40%,
  - advisor score 25%,
  - recorded total 65%.

### Phase 8 - Unauthorized and Role-Overlap Regression

Goal:

- Ensure queue density did not hide permission bugs.

Check:

- Non-assigned teachers see no actionable committee work.
- Advisor-only teachers do not see committee scoring unless also assigned.
- Committee teachers do not get advisor score action unless they are advisor.
- Admin-only operations remain unavailable to teachers/students.
- Student cannot access other projects.
- Teacher Delta or equivalent unauthorized identity remains clean.

### Phase 9 - UX Debt Triage

Goal:

- Decide what must be patched before Wave 2 is considered stable, and what can wait for redesign.

Record:

- Student confusion points.
- Teacher queue overload.
- Admin close/open action hierarchy issues.
- Recovery/late workflow friction.
- Evidence/export discoverability.
- Mobile overflow or density issues.

Patch only:

- High-risk operational clarity issues.
- Confusing states that could cause wrong real actions.
- Minimal UI changes that preserve business logic.

Defer:

- Full visual redesign.
- Manual screenshot pass.
- Large table/filter architecture unless scale makes it operationally necessary.

### Phase 10 - Final Wave 2 Readiness Assessment

Write/update:

- `e2e-artifacts/multi-pilot-r2-wave2/REPORT.md`
- `e2e-artifacts/multi-pilot-r2-wave2/VALIDATION_REPORT.md`
- `IMPLEMENTATION_PROGRESS.md`
- `e2e-artifacts/PILOT_FIX_STATUS.md`

Answer:

1. Did Wave 2 complete the selected scale target?
2. Which projects completed each lifecycle stage?
3. Which projects remain incomplete/late/recovered?
4. Were any Major/Blocker bugs found and patched?
5. Did Admin/Teacher/Student UX remain operationally understandable?
6. Are exports trustworthy for course-end use?
7. Is the system ready for:
   - Wave 3 / larger scale,
   - manual documentation screenshots,
   - visual redesign,
   - production data preparation?

## Validation Requirements

If no app code changed:

- Run at least `npm test`.

If app code changed:

- `npm run typecheck`
- `npm test`
- `npm run build`

Always:

- Check that QA secret was not written to artifacts.
- Confirm production config was not changed.
- Confirm unrelated dirty files were not staged.

After a successful patch:

- Commit a scoped patch.
- Push `qa-preview` only.
- Wait for the new QA preview URL.
- Live-verify the changed behavior with Edge persistent session.
- Resume from the same Wave 2 state, not from scratch.

## Copy/Paste Execution Prompt

Use this prompt only after answering the decision questions above.

```text
Continue from branch `qa-preview`.

Project:
Mathematical Project Course Management System

Mode:
MULTI-PILOT-R2 Wave 2 Full Loop

Current baseline:
- Wave 1 completed and cleanup-stabilized.
- Wave 1 data must be preserved.
- Production must not be touched.
- Wave 2 execution is QA-only.

Read first:
- PROJECT_SPEC.md
- IMPLEMENTATION_PROGRESS.md
- E2E_LIFECYCLE_REVIEW.md
- e2e-artifacts/PILOT_FIX_STATUS.md
- e2e-artifacts/multi-pilot-r2-wave1/REPORT.md
- e2e-artifacts/multi-pilot-r2-wave1/WAVE1_CLEANUP_STABILIZATION_REPORT.md
- e2e-artifacts/multi-pilot-r2-wave2/WAVE2_FULL_LOOP_PLAN.md

Primary execution rule:
Run Wave 2 as a full loop:
audit -> execute -> patch if needed -> validate -> push QA -> live verify -> continue.

Stop only for:
- security risk,
- production risk,
- schema-changing requirement,
- lifecycle/scoring/eligibility ambiguity,
- unrecoverable validation failure,
- QA state mismatch affecting correctness,
- Major/Blocker bug that has not yet been patched.

Do NOT:
- reset Wave 1 data,
- touch production,
- redesign the whole app,
- change lifecycle semantics,
- change scoring formulas,
- change round eligibility semantics,
- weaken auth/guards,
- change Prisma schema unless a blocker proves it unavoidable,
- start manual documentation screenshots.

Approved Wave 2 setup:
- Data strategy: [FILL IN: recommended isolated Wave 2 QA course offering OR reuse existing Wave 1 data only]
- Scale target: [FILL IN: recommended 12 active projects]
- Exception mix: [FILL IN: recommended 8 normal, 1 late Proposal, 1 Progress recovery, 1 schedule rejection, 1 report revision]

Phases:
1. Preconditions and state guard.
2. Wave 2 data setup according to approved strategy.
3. Proposal scale and queue density.
4. Progress 1 scale.
5. Progress 2 scale and recovery.
6. Final round and grade-I risk.
7. Report, revision, advisor score, closeout.
8. Evidence/export/AUN-QA continuity.
9. Unauthorized and role-overlap regression.
10. UX debt triage.
11. Final Wave 2 readiness assessment.

For every issue record:
- severity,
- project,
- role,
- route,
- expected,
- actual,
- screenshot path if captured,
- recommendation.

Artifacts:
- e2e-artifacts/multi-pilot-r2-wave2/REPORT.md
- e2e-artifacts/multi-pilot-r2-wave2/PENDING_FROM_PROMPT.md
- e2e-artifacts/multi-pilot-r2-wave2/MANUAL_NOTES.md
- e2e-artifacts/multi-pilot-r2-wave2/VALIDATION_REPORT.md
- e2e-artifacts/PILOT_FIX_STATUS.md
- IMPLEMENTATION_PROGRESS.md

Validation:
- If no app code changed: npm test
- If app code changed: npm run typecheck, npm test, npm run build
- Always scan artifacts for QA secret leakage.

Live QA:
- Use Edge persistent session.
- Do not close Edge.
- Do not reset cookies/storage.
- Start at /qa-login.
- Guard role/route/project/round/state before every action.
- After every push, use the new QA preview URL.

Output after each loop cycle:
- Current phase
- Exact task
- Files inspected
- Files changed
- Validation run/result
- QA deploy status
- Live verification result
- Issues found by severity
- Whether auto-continued
- Next exact step
```

## Recommendation Before Starting

Answer the decision questions, then run the copy/paste prompt with the approved data strategy.

Recommended starting answers:

- Data strategy: isolated Wave 2 QA course offering while preserving Wave 1.
- Scale target: 12 active projects.
- Exception mix: 8 normal, 1 late Proposal, 1 Progress recovery, 1 schedule rejection, 1 report revision.
- Patch boundary: focused UI/guard/export fixes only.
- Documentation screenshots: deferred.
