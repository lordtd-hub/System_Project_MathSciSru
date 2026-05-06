# Codex Task List

Historical note: this file is the original MVP task sequence. It is useful for project history, but current implementation direction is governed by `PROJECT_SPEC.md`, `IMPLEMENTATION_PROGRESS.md`, `DATA_MODEL_DRAFT.md`, and the latest stabilization task. Do not use this file to reintroduce Proposal-only scope or old per-project round assumptions.

Use these tasks sequentially. Do not ask Codex to build the entire system at once.

## Task 01 — Scaffold

Prompt:

```text
Read AGENTS.md, PROJECT_SPEC.md, RUBRICS_CHECKLIST.md, DATA_MODEL_DRAFT.md, and CONFIG_EXAMPLE.yaml.

Create the initial Next.js + TypeScript + Prisma + PostgreSQL project structure for this app. Add Tailwind CSS, a basic Thai layout, placeholder dashboards for Admin/Teacher/Student, Prisma setup, and README setup instructions.

Do not implement business pages yet. Focus on a clean structure.
```

Expected:
- Next.js app
- TypeScript
- Tailwind
- Prisma initialized
- Basic Thai layout
- README with setup

## Task 02 — Prisma schema

Prompt:

```text
Implement Prisma models based on DATA_MODEL_DRAFT.md for MVP 1. Include users, students, teachers, teacher account claims, academic years, terms, course offerings, projects, project origins, project origin versions, assessment rounds, assessment attempts, presentation submissions, submission versions, rubrics, rubric items, evaluator assignments, score submissions, score items, proposal evaluator decisions, project proposal results, score releases, project timeline events, and audit logs.

Add enums and migrations. Keep the schema future-compatible for Progress 1, Progress 2, Final, and Re-proposal, but do not implement those workflows yet.
```

Expected:
- Prisma schema
- Migration
- Type-safe enums

## Task 03 — Seed teachers and proposal rubric

Prompt:

```text
Add seed script for the 11 internal teachers from SEED_TEACHERS.csv. Keep academic_prefix separate and editable.

Also seed the Proposal checklist rubric from RUBRICS_CHECKLIST.md.

The seed script should be idempotent.
```

Expected:
- `prisma/seed.ts`
- teacher seed
- proposal rubric seed

## Task 04 — Student Excel import

Prompt:

```text
Implement Admin student import from Excel.

Template columns:
- student_code
- first_name_th
- last_name_th

Generate student email as student_code + "@student.sru.ac.th".
Validate duplicates.
Show preview before import.
Show errors clearly in Thai.
Create a project record for each imported student in the selected course offering.
```

Expected:
- Admin import page
- validation
- preview
- import result

## Task 05 — Google auth and teacher account claim

Prompt:

```text
Implement Google authentication.

Student rule:
- email must match an imported generated email ending with @student.sru.ac.th

Teacher rule:
- email must end with @sru.ac.th
- if teacher profile not linked, show teacher account claim page
- teacher selects unclaimed teacher profile
- create pending claim
- Admin can approve/reject
- only approved teachers can access scoring pages

Admin may be seeded or configured by environment variable for initial setup.
```

Expected:
- auth
- role routing
- teacher claim flow
- admin claim management

## Task 06 — Academic year and term setup

Prompt:

```text
Implement Admin management for academic years, terms, and course offerings.

Use Thai display names:
- ภาคเรียนที่ 1 ปีการศึกษา 2568
- ภาคเรียนที่ 2 ปีการศึกษา 2568
- ภาคฤดูร้อน ปีการศึกษา 2568

Allow selecting active course offering.
```

Expected:
- academic year CRUD
- term CRUD
- course offering page

## Task 07 — Project Origin Form

Prompt:

```text
Implement Student Project Origin Form.

Fields:
- initial_project_title_th
- initial_project_title_en optional
- source_type
- reason_for_topic
- expected_math_area
- tentative_advisor_id optional
- consultation_summary
- initial_references
- material_link required
- student_declaration required

Use Markdown + LaTeX preview for long text.
Validate material_link domain:
- drive.google.com
- docs.google.com
- classroom.google.com

Allow edit until deadline if deadline exists.
Save version history.
Create timeline event on submit.
```

Expected:
- student form
- validation
- version history
- preview

## Task 08 — Proposal Submission Form

Prompt:

```text
Implement Proposal Submission Form for students.

Fields:
- project_title_th
- project_title_en optional
- abstract_of_talk required
- motivation_background
- objectives
- proposed_methods
- expected_outcomes
- timeline
- questions_for_teachers optional
- material_link required
- student_declaration required

Support Markdown + LaTeX preview.
Disallow raw HTML.
Validate material link domain.
Allow edit until deadline and save version history.
Create timeline event on submit.
```

Expected:
- proposal form
- version history
- locked state
- timeline event

## Task 09 — Proposal scoring

Prompt:

```text
Implement Proposal checklist scoring for active internal teachers.

All active internal teachers can score each submitted proposal.
Use the seeded Proposal checklist rubric.
Checked item = item points.
Unchecked item = 0.
Calculate total automatically.
Show critical item warnings if critical items are unchecked.
Teacher must select:
- PASS
- PASS_WITH_REVISION
- NOT_PASS

Require reason for PASS_WITH_REVISION and NOT_PASS.
Allow save draft and submit.
Create timeline event when a teacher submits score.
```

Expected:
- teacher scoring tasks
- scoring form
- checklist total
- decisions
- comments

## Task 10 — Admin proposal summary and release

Prompt:

```text
Implement Admin Proposal summary.

For each project show:
- student
- project title
- submitted score count
- missing teacher count
- average score excluding missing teacher scores
- pass/revision/not-pass vote counts
- comments/reasons
- final decision selector

Admin manually chooses final decision:
- PASS
- PASS_WITH_REVISION
- NOT_PASS

Create final decision record and timeline event.
Allow closing round.
After round is closed, advisor can see feedback.
Admin can release feedback to student.
Student sees anonymous proposal feedback only after release.
```

Expected:
- admin summary
- final decision
- close round
- release
- student feedback page
