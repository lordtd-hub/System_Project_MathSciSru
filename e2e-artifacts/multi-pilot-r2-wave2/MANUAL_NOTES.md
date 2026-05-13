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
