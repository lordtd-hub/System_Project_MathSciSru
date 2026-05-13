# MULTI-PILOT-R2 Wave 2 Manual Notes

Date started: 2026-05-13

## Notes

- Wave 2 is a QA-only operational pilot, not a visual redesign pass.
- Wave 1 data must remain preserved.
- Manual documentation screenshots are still deferred.
- Minor/UX issues should be recorded here and should not stop the pilot.
- Recurrent QA-login pitfall: the first `บทบาท` dropdown must be selected before identity login. Browser-native validation can show `Please select an item in the list.` if the role is blank. This is now treated as a mandatory automation guard, because role mismatch at login can invalidate the whole pilot flow.

## Initial UX Risks To Watch

- Teacher queue density when 10+ tasks appear.
- Admin round/open/close hierarchy under larger eligible buckets.
- Student next-action wording when multiple projects or multiple course offerings exist.
- Recovery/late workflow clarity for non-Proposal rounds.
- Evidence/export discoverability after multiple course offerings exist.

## Phase 3 Recovery Note

- Non-Proposal recovery must be checked in both student and teacher surfaces. Opening a late exception is not enough if the student page and teacher queue still rely only on the closed course-level round status.
- W2-10 is the active Progress recovery project. After the QA patch deploys, verify W2-10 from `/qa-login` with the role dropdown explicitly selected before identity login.

## Phase 5-9 Notes

- Final round completed for all 12 Wave 2 projects.
- W2-11 schedule reject/resubmit worked in the Final round.
- Report workflow completed for all 12 Wave 2 projects.
- W2-12 revision/latest-version report loop worked: version 1 remained in history, version 2 became the approved latest version.
- Advisor score unlock behaved correctly after report approval.
- Admin closeout completed all 12 Wave 2 projects.
- Evidence/export checks passed for CSV and XLSX.
- Grade summary export now covers the practical end-of-course need: student code, Thai name fields, project title, each presentation round weighted at 10%, total presentation 40%, advisor 25%, recorded total 65%, missing components, status, and project id.

## Minor UX Debt Observed

- Teacher completed/history sections are now dense because Wave 1 and Wave 2 history are both preserved. This is acceptable for the 12-project loop, but filters/collapsible history should be considered before or during 20-project expansion.
- Student report page worked correctly, but the active project title is not prominent enough to use as a stable browser guard. Consider making the active project title consistently visible across student workflow pages in a later readability pass.
- Evidence page separates course offerings correctly, but export cards will benefit from stronger visual grouping if many offerings accumulate.
