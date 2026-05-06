# MVP 1 Codex Prompt

You are building an MVP web application for a Mathematical Project Course presentation assessment system.

Build MVP 1 only. Do not build the full system yet.

Read these files before implementation:
- AGENTS.md
- PROJECT_SPEC.md
- RUBRICS_CHECKLIST.md
- DATA_MODEL_DRAFT.md
- CONFIG_EXAMPLE.yaml

## Tech stack

- Next.js with TypeScript
- PostgreSQL
- Prisma ORM
- Tailwind CSS
- Google authentication
- Excel import support
- Markdown + LaTeX preview support
- Thai UI first

## System scope

This app assesses only presentation components of a Mathematical Project Course.

Full presentation score is 40%:
- Proposal Presentation: 10%
- Progress Presentation 1: 10%
- Progress Presentation 2: 10%
- Final Presentation: 10%

For MVP 1, implement only:
- Authentication
- User roles
- Student import
- Teacher seed data
- Teacher account claim workflow
- Academic year / term setup
- Project Origin Form
- Proposal Submission
- Proposal checklist scoring
- Proposal decision workflow
- Feedback release
- Evidence trail

Do not implement:
- Progress 1
- Progress 2
- Final Presentation
- External committee magic links
- Full AUN-QA export
- Report / Article scoring
- Advisor Assessment scoring

## Roles

1. Admin
2. Student
3. Teacher

## Student login

- Students use Google accounts in this format:
  `{student_code}@student.sru.ac.th`
- Student import Excel has only:
  - `student_code`
  - `first_name_th`
  - `last_name_th`
- Generate student email automatically:
  `student_code + "@student.sru.ac.th"`

## Teacher login

- Teachers use Google accounts with `@sru.ac.th`
- Teacher email may be empty initially
- Seed teacher profiles first
- When a teacher logs in for the first time with `@sru.ac.th`, show a page where they select which teacher profile is theirs
- Create a pending teacher account claim
- Admin must approve before the teacher can access scoring pages

## Seed teachers

Use `SEED_TEACHERS.csv`.

Academic prefix must be editable and separate from name.

## Academic year / term

Use Thai display format:

```text
ภาคเรียนที่ 1 ปีการศึกษา 2568
ภาคเรียนที่ 2 ปีการศึกษา 2568
ภาคฤดูร้อน ปีการศึกษา 2568
```

## Student Project Origin Form

Students must submit the origin of their project before proposal submission.

Fields:
- `initial_project_title_th`
- `initial_project_title_en` optional
- `source_type`
- `reason_for_topic`
- `expected_math_area`
- `tentative_advisor_id` optional
- `consultation_summary`
- `initial_references`
- `material_link` required
- `student_declaration` required

Allowed material link domains:
- `drive.google.com`
- `docs.google.com`
- `classroom.google.com`

## Submission rules

- Students may edit until deadline
- Save version history
- After deadline, lock submission
- Admin may unlock with audit log
- Markdown + LaTeX preview must be supported
- Raw HTML from students must not be allowed

## Proposal Submission

Fields:
- `project_title_th`
- `project_title_en` optional
- `abstract_of_talk` required, Markdown + LaTeX
- `motivation_background`
- `objectives`
- `proposed_methods`
- `expected_outcomes`
- `timeline`
- `questions_for_teachers` optional
- `material_link` required, must be Google Drive/Docs/Classroom
- `student_declaration` required

## Proposal assessment

- All active internal teachers can score proposal
- Missing teacher scores are excluded from average
- Proposal feedback shown to students must be anonymous
- Teachers score using checklist-based rubric
- Checked item gives points, unchecked gives zero
- No N/A in MVP
- Rubric items should be neutral for pure math, applied math, statistics, computational projects, and math education projects

## Proposal decision

Each teacher must select:
- `PASS`
- `PASS_WITH_REVISION`
- `NOT_PASS`

If `PASS_WITH_REVISION` or `NOT_PASS`, reason is required.

## Admin final decision

- System shows average score and vote counts
- Admin/meeting chooses final decision manually
- System must not auto-decide final proposal result

## Advisor visibility

- Advisor does not score presentations
- Advisor can see feedback after Admin closes the round
- Students see feedback only after Admin releases it

## Evidence trail

Store timeline events for:
- Project origin submitted
- Proposal submitted
- Proposal scoring opened
- Each teacher score submitted
- Proposal closed
- Admin final decision
- Feedback released

## Build pages

### Admin

- Dashboard
- Manage academic years/terms
- Import students from Excel
- Manage teacher account claims
- Manage proposal round
- View proposal scores and decisions
- Release feedback

### Student

- My project
- Project origin form
- Proposal submission form
- Proposal feedback page after release

### Teacher

- Claim teacher profile page
- My proposal scoring tasks
- Proposal scoring form

## Database

Use Prisma schema and PostgreSQL.

Include:
- migrations
- seed script for teachers
- student import
- basic tests for scoring calculation and allowed link validation

## Deliverables

- Working Next.js app
- Prisma schema
- Seed file for teachers
- Excel import for students
- Basic tests
- README with setup instructions

Start by creating a clean project structure and then implement in small, reviewable steps.
