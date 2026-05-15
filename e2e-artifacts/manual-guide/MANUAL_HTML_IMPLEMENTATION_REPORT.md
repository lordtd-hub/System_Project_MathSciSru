# Manual HTML Implementation Report

Status: SCREENSHOTS CAPTURED / LOCAL MANUAL CHECK PASSED

## What was implemented

- Added public HTML manual routes:
  - `/manual`
  - `/manual/student`
  - `/manual/teacher`
- Added Thai user-facing manual content for:
  - Student normal path through course completion
  - Student schedule reject/resubmit
  - Student report revision and resubmission
  - Teacher advisor requests, advicees, schedules, scoring, report review, advisor score, and project record
- Added screenshot slots that render QA screenshots from `public/manual/screenshots/`.
- Added a home page quick link to the manual.
- Updated the capture plan from the old 3-role scope to the current 2-role Student/Teacher scope.
- Added Student Proposal work-plan coverage with:
  - a real QA screenshot of 4 overlapping work-plan tasks and selectable week ranges;
  - a focused export/preview screenshot showing `Export แผนงาน CSV`;
  - wording that the exported CSV/table can be reused in Proposal documents, slides, or the report book.

## Screenshot status

Real QA screenshots were captured from the QA preview after login, without using `/qa-login` screenshots in the manual.

Captured/updated main manual screenshots:

- Student: dashboard, project form, advisor request, Proposal status, Progress evidence, schedule submit/reject/resubmit, feedback, Final evidence/schedule, report v1, report revision, report v2, project record.
- Teacher: dashboard, advisor request, advicees, schedule review/reject/approve-resubmitted, Proposal scoring, Progress scoring, Final scoring, report review/revision/latest approval, advisor score, project record.

Flow corrections discovered during capture:

- Final evidence uses the app's Final-specific evidence fields, not only the generic Progress evidence fields.
- The Final evidence form uses `FINAL_PRESENT`, while the schedule form submits `FINAL_PRESENTATION`; the capture automation now follows the real UI values.
- Report approval does not complete after only one reviewer when multiple related reviewers still need to approve; the manual wording now says the latest report is complete only after the required related reviewers approve it.
- Student Proposal/Progress/Final wording now emphasizes that students should read the assessment criteria before planning the work plan, progress presentation, and final presentation because committee scoring follows the defined criteria.
- Student work-plan wording now highlights that the 16-week plan is useful later when preparing Progress evidence and can be exported for documents.
- Local browser verification confirmed the Student guide includes the criteria-reading warning in the rendered page.

## Safety notes

- No lifecycle logic changed.
- No auth logic changed.
- No scoring logic changed.
- No eligibility logic changed.
- No Prisma schema changed.
- No production configuration changed.
- Manual content is static and read-only.
- QA data was mutated only inside the QA manual offering to produce truthful manual screenshots.

## Validation

- `cmd /c npm.cmd run typecheck`: PASS after clearing stale `.next` generated route cache
- `cmd /c npm.cmd test -- manualPagesSource`: PASS
- `cmd /c npm.cmd test`: PASS, 91 files / 391 tests
- `cmd /c npm.cmd run build`: PASS
  - Existing warning remains in `src/lib/admin/teacherBaseline.ts` for an unused `initialAdminEmail`; this warning predates the manual pages and does not block the build.
- `node e2e-artifacts/manual-guide/validate-manual-assets.mjs`: PASS
  - 32 screenshot references found.
  - 0 missing images.
  - 0 mojibake markers in checked manual files.
- `node e2e-artifacts/manual-guide/cdp-verify-manual-pages.mjs`: PASS
  - Checked `/manual`, `/manual/student`, and `/manual/teacher`.
  - Checked desktop width 1366px and mobile width 390px.
  - 0 broken images.
  - 0 placeholders.
  - 0 mojibake markers in rendered text.
  - 0 horizontal overflow findings.

## Local preview

- Manual routes build successfully:
  - `/manual`
  - `/manual/student`
  - `/manual/teacher`
- Local visible browser preview was opened at `http://127.0.0.1:3000/manual` in a new tab in the existing Edge window. The previous QA tab was not closed or replaced.

## UTF-8 notes

- Manual files were written as UTF-8.
- Thai text should be verified in browser after deploy.
- If console output appears mojibake, verify the file in a UTF-8 editor before treating it as file corruption.
