# MULTI-PILOT-R2 Wave 1 Remaining Full-Loop Plan

Date: 2026-05-13
Status: Wave 1 full lifecycle passed once. This plan is for cleanup/stabilization before Wave 2, not for rerunning the full lifecycle from scratch.

## Current baseline

Wave 1 has completed and stabilized:

- Proposal
- Progress 1
- Progress 2
- Final
- Report submission / revision / approval
- Advisor Score
- Admin Closeout
- Teacher workload UX stabilization
- Admin operational UX stabilization
- Evidence/grade export smoke checks

Production must not be touched. QA data must not be reset. Wave 2 must not start until this remaining Wave 1 cleanup is explicitly closed or deferred.

## Full-loop operating policy

Use the same stabilization loop:

1. Continue from the saved Wave 1 QA state.
2. If only Minor/UX issues appear:
   - record them,
   - keep going within the same pass,
   - do not patch unless same-scope and low risk.
3. If a Major/Blocker appears:
   - stop immediately,
   - capture route/role/state/screenshot if using browser,
   - patch minimally,
   - run validation,
   - push QA preview only,
   - live verify the fix,
   - resume from the saved state.
4. Do not restart pilot data unless the user explicitly asks.
5. Do not create manual screenshots or start documentation screenshots.

## Stop conditions

Stop only for:

- security/auth risk,
- production risk,
- schema-changing requirement,
- lifecycle/scoring/eligibility ambiguity,
- unrecoverable build/test failure,
- QA state mismatch,
- Major/Blocker bug.

Minor wording/layout/readability issues should be recorded and the pass should continue.

## P0 - Student readability stabilization

Goal: make student-facing workflow state obvious without changing lifecycle rules.

Pages:

- `/student`
- `/student/schedule`
- `/student/report`
- `/student/feedback`

Check:

- What must the student do now?
- Who is the student waiting for?
- Why is a round locked?
- Is the current round open or closed?
- Has evidence/report already been submitted?
- Is the next action hidden because it is complete, waiting, locked, or unauthorized?
- Does a successful submit return to full content, not shell-only?
- Does wording distinguish first submission, revision, waiting review, approved, and completed?

Allowed changes:

- wording,
- grouping,
- status badges,
- queue cards,
- empty states,
- read-only summaries,
- responsive layout polish.

Forbidden changes:

- lifecycle logic,
- round eligibility logic,
- scoring logic,
- auth logic,
- Prisma schema.

Recommended validation:

- source test for expected student wording/state markers,
- `npm run typecheck`,
- `npm test`,
- `npm run build`,
- live read-only QA smoke unless a student action must be verified.

## P0 - Project03 recovery UX / non-Proposal late recovery decision

Goal: make the stuck/incomplete case understandable before Wave 2 scale testing.

Known case:

- Project03 was eligible for Progress 1 but incomplete when Progress 1 closed.
- It remained locked from Progress 2/Final, which is correct.
- Admin recovery after closing Progress 1 is still not clear enough in UI.

Check:

- Where does Admin see Project03 after closure?
- Does UI explain which round is incomplete?
- Does UI explain what is missing?
- Does UI show whether late/reopen handling is available?
- Does UI avoid implying Project03 is a blocker for later rounds?
- Does student wording explain that later rounds are locked due to incomplete previous round?

Preferred first pass:

- decision note plus minimal UI wording/panel if safe,
- no broad recovery console yet,
- no lifecycle change unless a real blocker is found.

Decision to settle before Wave 2:

- Should Progress 1/2/Final late recovery continue through `/admin/round-exceptions`?
- Should Admin get a dedicated incomplete-project panel?
- Should ordinary late and excused cases use the same audit model as Proposal?

## P1 - Evidence/export polish

Goal: ensure exports are useful for real course closeout and grade review.

Check:

- grade summary CSV/XLSX includes student code,
- student full name,
- Proposal percentage,
- Progress 1 percentage,
- Progress 2 percentage,
- Final percentage,
- Advisor score 25%,
- total/overall status where available,
- Thai column names are understandable,
- Excel opens without mojibake or broken columns.

Do not change scoring formulas during this pass. If a formula requirement is ambiguous, record a decision question.

## P1 - Admin/Teacher UX debt review

Goal: decide what can be deferred to redesign versus what must be patched before Wave 2.

Review:

- table/filter needs for 40+ projects,
- search by student/project,
- urgency sorting,
- sticky summaries,
- mobile overflow,
- dangerous button hierarchy,
- duplicate or dense badges,
- queue readability under many simultaneous tasks.

Expected output:

- keep/patch/defer decision list,
- no broad redesign.

## P1 - Artifact/worktree hygiene

Goal: keep the repo usable without deleting important pilot evidence.

Check:

- committed Wave 1 summary artifacts are current,
- runtime/browser/test output stays ignored/uncommitted,
- screenshots/scripts that are evidence remain preserved,
- dirty worktree is understood and not accidentally staged.

Do not delete pilot evidence unless explicitly approved.

## P2 - Deferred until after Wave 2 planning

- full visual redesign,
- dedicated recovery console,
- deep data-table/filter redesign,
- manual screenshot/documentation pass.

## Recommended execution order

1. Student readability stabilization.
2. Project03 recovery UX and non-Proposal late/reopen decision.
3. Evidence/export polish.
4. Admin/Teacher UX debt triage.
5. Artifact/worktree hygiene.
6. Final Wave 1 readiness note.
7. Wave 2 plan.

## Suggested full-loop prompt heading

Use this next:

`MULTI-PILOT-R2 Wave 1 Remaining Cleanup - Student Readability and Recovery UX Stabilization`

Start with P0 student readability. Do not restart Wave 1 data. Do not start Wave 2.
