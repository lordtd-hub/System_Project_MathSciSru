# Autonomous Codex Prompt — MVP 1

Use this prompt when you want Codex to continue working through the MVP 1 implementation with minimal interruptions.

---

You are Codex working as an autonomous coding agent in this repository.

Your goal is to implement **MVP 1** of the **Project Presentation, Feedback & Evidence System**.

## Operating mode

Work autonomously.

Do not stop after only one small edit unless you are truly blocked.

Continue implementing the next logical task from `CODEX_TASKS.md` until one of these stopping conditions is reached:

1. MVP 1 is complete
2. A required secret/credential is missing and no safe local stub can be used
3. A command fails repeatedly after reasonable fixes
4. A requirement is contradictory and cannot be resolved from the project files
5. You need human approval for a destructive action

When you make assumptions, choose the safest simple implementation and document the assumption in your final summary.

## Files to read first

Before editing code, read:

- `AGENTS.md`
- `PROJECT_SPEC.md`
- `RUBRICS_CHECKLIST.md`
- `DATA_MODEL_DRAFT.md`
- `CODEX_TASKS.md`
- `CONFIG_EXAMPLE.yaml`
- `MVP1_CODEX_PROMPT.md`

Then inspect the current repo structure.

## Scope

Implement MVP 1 only.

MVP 1 includes:

1. Initial app scaffold
2. Prisma/PostgreSQL schema
3. Teacher seed data
4. Proposal checklist rubric seed
5. Student import from Excel/CSV
6. Google authentication structure
7. Student / Teacher / Admin role routing
8. Teacher account claim workflow
9. Academic year / term / course offering setup
10. Project Origin Form
11. Proposal Submission Form
12. Markdown + LaTeX preview
13. Required Google Drive / Docs / Classroom material links
14. Submission version history
15. Proposal checklist scoring
16. Proposal teacher decision: PASS / PASS_WITH_REVISION / NOT_PASS
17. Admin proposal summary
18. Admin final proposal decision
19. Round close and feedback release
20. Anonymous proposal feedback for students
21. Timeline / evidence events

Do not implement yet:

- Progress 1
- Progress 2
- Final Presentation
- Full Re-proposal workflow
- External committee magic links
- Full AUN-QA export
- Report / Article scoring
- Advisor Assessment scoring

You may create future-compatible database structures when needed, but do not build full UI flows for future phases.

## Implementation strategy

Follow `CODEX_TASKS.md` in order.

For each task:

1. Read the relevant specification section
2. Implement the smallest complete working slice
3. Add or update tests for important business logic
4. Run validation commands
5. Fix failures
6. Record progress in a local checklist file named `IMPLEMENTATION_PROGRESS.md`
7. Continue to the next task

## Progress tracking

Create or update `IMPLEMENTATION_PROGRESS.md`.

Use this format:

```md
# Implementation Progress

## Current status

- Last completed task:
- Current task:
- Known blockers:
- Next step:

## Task checklist

- [ ] Task 01 — Scaffold
- [ ] Task 02 — Prisma schema
- [ ] Task 03 — Seed teachers and proposal rubric
- [ ] Task 04 — Student Excel import
- [ ] Task 05 — Google auth and teacher account claim
- [ ] Task 06 — Academic year and term setup
- [ ] Task 07 — Project Origin Form
- [ ] Task 08 — Proposal Submission Form
- [ ] Task 09 — Proposal checklist scoring
- [ ] Task 10 — Admin proposal summary and release

## Decisions / assumptions

- ...
```

Update this file after each completed task.

## Commands

Detect the project package manager from the repo.

Prefer in this order if no project exists yet:

1. `npm`
2. `pnpm` only if already configured
3. `yarn` only if already configured

After implementation steps, run relevant commands such as:

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
npx prisma format
npx prisma validate
npx prisma migrate dev
npx prisma db seed
```

If a script does not exist, add appropriate scripts to `package.json` when reasonable.

Minimum scripts expected:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "prisma:format": "prisma format",
    "prisma:validate": "prisma validate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "prisma db seed"
  }
}
```

If the selected Next.js version no longer supports `next lint`, use the recommended ESLint command and document the change.

## Database

Use Prisma and PostgreSQL.

Implement schema from `DATA_MODEL_DRAFT.md`, but keep MVP 1 practical.

Important requirements:

- Separate academic prefix from teacher name
- Teacher email can be nullable before account claim approval
- Student email is generated from student code
- Store Google `sub`
- Support teacher account claims
- Support multiple assessment attempts for future Re-proposal
- Store submission versions
- Store rubric items
- Store score items
- Store timeline events
- Store audit logs

## Seed data

Use `SEED_TEACHERS.csv`.

Seed all 11 internal teachers.

Seed Proposal checklist rubric from `RUBRICS_CHECKLIST.md`.

Seed script must be idempotent.

## Student import

Implement Admin import.

Input columns:

- `student_code`
- `first_name_th`
- `last_name_th`

Generate:

```text
email = student_code + "@student.sru.ac.th"
```

Validation:

- missing required fields
- duplicate student code in file
- duplicate student code in database for course offering
- invalid student code format if clearly invalid

Show preview before import.

## Authentication and access

Students:

- Google email must end with `@student.sru.ac.th`
- local part must match imported `student_code`
- can access only own project

Teachers:

- Google email must end with `@sru.ac.th`
- if not linked to a teacher profile, show claim flow
- teacher chooses unclaimed profile
- Admin approves/rejects
- pending teachers cannot access scoring pages

Admin:

- Initial admin can be configured via `INITIAL_ADMIN_EMAIL`
- Admin can approve teacher claims and manage setup

## Forms

Use Thai labels.

Support Markdown + LaTeX preview for long text.

Do not allow raw HTML.

Required material links must be from:

- `drive.google.com`
- `docs.google.com`
- `classroom.google.com`

Create a reusable link validation function and test it.

## Proposal scoring

Use checklist scoring.

Rules:

- checked item = full points
- unchecked item = zero
- no N/A
- total score is sum of checked item points
- maximum is 100
- show critical item warnings
- teacher must choose PASS / PASS_WITH_REVISION / NOT_PASS
- reason required for PASS_WITH_REVISION or NOT_PASS
- missing teacher scores are excluded from average
- Admin manually chooses final decision

Add tests for:

- checklist score calculation
- missing scores excluded from average
- reason required for revision/not-pass
- allowed Google link validation

## Feedback visibility

For MVP 1 Proposal:

- Student sees feedback only after Admin release
- Student does not see evaluator names
- Admin sees evaluator names
- Advisor visibility can be database-ready; full advisor dashboard may be minimal

## Evidence trail

Create timeline events for:

- project origin submitted
- proposal submitted
- proposal scoring opened
- teacher score submitted
- proposal closed
- Admin final decision
- feedback released
- submission unlocked
- teacher account claim approved/rejected

## Quality bar

Do not leave broken TypeScript.

Do not leave TODOs for core MVP 1 behavior unless documented in `IMPLEMENTATION_PROGRESS.md`.

Prefer simple reliable UI over complex design.

Use service functions for business logic:

Suggested structure:

```text
src/lib/validators/materialLink.ts
src/lib/scoring/checklistScoring.ts
src/lib/scoring/proposalSummary.ts
src/lib/auth/roleResolution.ts
src/lib/timeline/createTimelineEvent.ts
src/lib/submissions/versioning.ts
```

Tests should target these service functions.

## Final response when stopping

When you stop, provide:

1. Completed tasks
2. Commands run
3. Test/build results
4. Files changed
5. How to run locally
6. Remaining tasks
7. Any assumptions or blockers

If MVP 1 is not complete, clearly say which task should be run next.
