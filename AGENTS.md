# AGENTS.md

## Project

This repository is for a Thai-language web application:

**Project Presentation, Feedback & Evidence System**

## Current implementation baseline

The original MVP notes in this file are historical guardrails. The current app baseline is Lifecycle v2 through Admin-only `COMPLETED`.

- Course-level `AssessmentRound` is the only valid round model: one `AssessmentRound` per `courseOfferingId + roundType`.
- Do not create per-project assessment rounds or duplicate active projects.
- Self-scheduling, Progress 1 scoring, Progress 2 scoring, Final Presentation scoring, report approval, Advisor score 25%, and Admin-only closeout are implemented.
- Report/article numeric scoring is still out of scope; the report workflow is approval/revision evidence only.
- Advisor score 25% is implemented as a separate component and is not tied to an `AssessmentRound`.
- Proposal comments are visible to students with teacher names, while raw proposal scores remain hidden from students.
- Dev login must remain development-only; production must use Google OAuth and the real-login pilot role rules.

It supports presentation assessment for a Mathematical Project Course. The system focuses on:
1. Student project-origin evidence
2. Student pre-presentation submission
3. Checklist-based presentation scoring
4. Feedback release
5. Advisor follow-up
6. Evidence trail for AUN-QA

## Read these files first

Before making changes, read:

- `PROJECT_SPEC.md`
- `RUBRICS_CHECKLIST.md`
- `DATA_MODEL_DRAFT.md`
- `CODEX_TASKS.md`

## Target tech stack

- Next.js
- TypeScript
- PostgreSQL
- Prisma ORM
- Tailwind CSS
- Google authentication
- Excel import
- Markdown + LaTeX preview

## UI language

Use Thai as the primary UI language.

Examples:
- "ภาคเรียนที่ 1 ปีการศึกษา 2568"
- "ส่งข้อมูลเสนอหัวข้อ"
- "ประเมิน Proposal"
- "รอผู้ดูแลระบบอนุมัติ"
- "เปิดผลให้นักศึกษาเห็น"

Database enum names and code identifiers may be English.

## System scope

This system assesses only presentation components, total 40%:

- Proposal Presentation: 10%
- Progress Presentation 1: 10%
- Progress Presentation 2: 10%
- Final Presentation: 10%

For MVP 1, implement Proposal only.

Do not implement Report / Article scoring. Do not implement Advisor Assessment scoring.

## Authentication rules

### Students

- Students use Google accounts in this format:
  `{student_code}@student.sru.ac.th`
- Student Excel import has only:
  - `student_code`
  - `first_name_th`
  - `last_name_th`
- Generate student email automatically:
  `student_code + "@student.sru.ac.th"`
- A student may access only their own project.

### Teachers

- Teachers use Google accounts with `@sru.ac.th`
- Teacher profiles may initially have empty email.
- On first login, if a teacher email is not linked:
  1. Show unclaimed teacher profiles
  2. Teacher selects their profile
  3. Create `PENDING` teacher account claim
  4. Admin approves
  5. Teacher gains access

Before approval, teachers must not access student data or scoring pages.

### Admin

- Admin can manage claims, terms, imports, rounds, final proposal decisions, and releases.

## Security rules

- Do not trust frontend email checks only.
- Verify Google identity server-side.
- Store Google `sub` as stable account identifier.
- Do not allow raw HTML in student submissions.
- Sanitize rendered Markdown output.
- Store raw Markdown/LaTeX text and render safely.
- Material links must be restricted to:
  - `drive.google.com`
  - `docs.google.com`
  - `classroom.google.com`
- Do not upload project files into this app for MVP.
- Use audit logs for admin unlocks, score changes, decision changes, and releases.

## Submission rules

- Students can edit submissions until deadline.
- Keep version history.
- After deadline, lock submission.
- Admin may unlock, but every unlock must create an audit/timeline event.
- Every submission must have a valid Google Drive / Docs / Classroom link.

## Scoring rules

- Use checklist scoring.
- Checked item = full points for that item.
- Unchecked item = zero.
- No N/A in MVP.
- Checklist items must be neutral enough for pure math, applied math, statistics, computational, and math education projects.
- Proposal missing teacher scores are excluded from the average.
- Proposal final decision is manually selected by Admin/meeting, not automatically decided by the system.
- Each teacher must choose:
  - `PASS`
  - `PASS_WITH_REVISION`
  - `NOT_PASS`
- If decision is `PASS_WITH_REVISION` or `NOT_PASS`, reason is required.

## Feedback visibility

- Proposal feedback shown to students is anonymous.
- Re-proposal, Progress 1, Progress 2, and Final feedback should show evaluator name.
- Advisor does not score presentations by default.
- Advisor sees feedback after the assessment round is closed.
- Students see feedback only after Admin release.

## Data / evidence rules

Create timeline events for important actions:
- Project origin submitted
- Proposal submitted
- Scoring opened
- Teacher score submitted
- Proposal closed
- Admin final decision
- Feedback released
- Submission unlocked
- Account claim approved/rejected

This evidence trail is important for AUN-QA.

## Coding conventions

- Keep business rules in service modules, not directly in React components.
- Use Prisma migrations for schema changes.
- Keep display labels separate from enum values.
- Keep academic prefix editable and separate from first/last name.
- Store evaluator display name snapshots at scoring time.
- Add tests for scoring calculation and link validation.

## Before finishing a task

Run these when available:

- Type checking
- Linting
- Tests

Then summarize:
- What changed
- Files changed
- How to test
- Assumptions
- Remaining issues

## QA browser operation rules

These rules are mandatory for QA preview checks and user-visible browser testing.

- Use Playwright visible session `edgepilot-visible` for QA browser work unless the user explicitly asks for another tool.
- Do not close, kill, reset, or replace any browser window/tab that the user is using or has asked to keep open.
- If a browser is already open, inspect/list sessions first and reuse the visible session instead of opening a new uncontrolled window.
- Do not use a headless or blank Playwright session when the user needs to see the browser.
- Start QA verification from `/qa-login` unless the user gives a specific route.
- On QA login, select the `บทบาท` dropdown first, then select the identity, then enter the QA secret.
- If Vercel protection, session mismatch, or an unexpected login screen appears, stop and report the exact state instead of guessing or clicking randomly.
- Never record QA secrets in public artifacts, screenshots, or documentation.

## QA browser verification notes

- When asked to verify QA preview pages, prefer the available Browser/Chrome plugin first.
- Use the Chrome extension browser exposed by the Browser plugin when available; it can share the user's logged-in Vercel session and avoids Vercel Deployment Protection blocking automation.
- Do not waste time trying Edge/Chrome shell launch, CDP ports, or separate Playwright profiles before checking plugin browsers with `agent.browsers.list()`.
- If the preview shows Vercel login in the in-app browser, try the Chrome extension browser from the plugin before asking the user to log in again.
- For QA smoke checks, verify at least:
  - `/qa-login` renders the real app, not Vercel login.
  - the role dropdown starts on the disabled placeholder.
  - role-specific pages render without application error/digest pages.
  - removed or deferred UI modes, such as Figma redesign markers, are not visible when classic UI is intended.
  - no workflow state is mutated unless the user explicitly asks for a mutating pilot run.
