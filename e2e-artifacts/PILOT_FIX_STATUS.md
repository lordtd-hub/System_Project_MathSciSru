# Pilot Issue Fix Status

Last updated: 2026-05-12  
Current QA preview: https://system-project-math-sci-7psj46uif-lordtd-hubs-projects.vercel.app/qa-login  
Current QA commit: `3fd2d84` (`fix: polish QA post-submit states`)

Note on language: this tracking file is written in English to avoid encoding/mojibake issues. Thai text appears only when quoting exact UI labels that must be verified.

## Reference Files

- `e2e-artifacts/full-pilot-round-4/REPORT.md`
- `e2e-artifacts/pilot-round-3/PILOT_ROUND_3_LIVE_REVIEW.md`
- `e2e-artifacts/pilot-retest-qa-70407a8/REPORT.md`

## Current Confidence Summary

Prior pilots proved the full lifecycle can reach `COMPLETED`:

Proposal -> Progress 1 -> Progress 2 -> Final -> Report revision -> Report approval -> Advisor score -> Admin closeout -> Evidence export

Patch `3fd2d84` targeted post-submit UI confusion before the documentation/manual screenshot pilot.

## Fixed or Patched

### 1. Student Proposal page blank after submit

- Source: Full Pilot Round 4, Major bug
- Previous issue: `/student/proposal?success=proposal_submitted` rendered an almost empty page.
- Patch: `3fd2d84`
- Status: Patched
- Implementation: `/student/proposal` now keeps normal page content and shows success alert `ส่ง Proposal สำเร็จ`.
- Verification status: Source and deployed QA HTML/code path verified. Full live submit click still needs manual/browser-session confirmation.

### 2. Student Schedule page blank after saving assessment evidence

- Source: Full Pilot Round 4, Major bug
- Previous issue: `/student/schedule?success=assessment_evidence_saved` rendered an almost empty page after saving Progress evidence.
- Patch: `3fd2d84`
- Status: Patched
- Implementation: `/student/schedule` now keeps page content and shows success alert `บันทึกหลักฐานการประเมินแล้ว`.
- Verification status: Source verified. Full live save click still needs manual/browser-session confirmation.

### 3. Report v1 submit stuck at pending

- Source: Full Pilot Round 4, Major bug
- Previous issue: report submit button could stay on `กำลังส่ง...` until manual reload.
- Patch: `3fd2d84`
- Status: Patched at UI/state-guard level
- Implementation: `/student/report` now hides the active submit form when report submission is not currently allowed and shows the report state instead.
- Verification status: Source/tests verified. Full live report submit still needs manual/browser-session confirmation.

### 4. Report action wording consistency

- Source: Full Pilot Round 4, Major UX
- Previous issue: after Final, first report action could say revised-report wording even though no report had been submitted.
- Patch: `3fd2d84`
- Status: Patched
- Shared helper: `getStudentReportActionLabel`
- Expected labels:
  - First report: `ส่งเล่มรายงานฉบับสมบูรณ์`
  - Revision required: `แก้ไขเล่มรายงานตามข้อเสนอแนะของผู้ตรวจ และส่งฉบับใหม่`
  - Waiting review: `รอผู้ตรวจพิจารณารายงาน`
  - Approved: `รายงานได้รับการอนุมัติแล้ว`
- Verification status: Unit/source tests passed.

### 5. Advisor request approved/rejected still showed action buttons

- Source: Full Pilot Round 4, Minor/UX
- Previous issue: approved/rejected advisor requests still showed approve/reject controls.
- Patch: `3fd2d84`
- Status: Patched
- Implementation: non-`PENDING` advisor requests now render a read-only decision summary instead of action controls.
- Verification status: Source test passed. Needs visual confirmation on a decided request.

### 6. Admin proposal decision wording after saved

- Source: Full Pilot Round 4, Minor/UX
- Previous issue: saved proposal decision still looked like first-time submission.
- Patch: `3fd2d84`
- Status: Patched for wording
- Implementation: when decision already exists, button text is `แก้ไขผลการตัดสิน`.
- Remaining polish: a fuller read-only summary/edit-mode split can be considered later if Admin users still find it confusing.

### 7. QA teacher identity mapping clarity

- Source: Full Pilot Round 4, QA setup issue
- Previous issue: QA labels and actual teacher profile names were easy to confuse.
- Patch: `3fd2d84`
- Status: Patched
- Implementation: `/qa-login` now shows a QA Teacher mapping/help table with label, email, and typical testing role.
- Live verification: PASS via protected QA preview HTML. The deployed page includes `คู่มือจับคู่ QA Teacher` and email-role mapping.

### 8. Advisor score completed read-only visibility

- Source: Pilot Retest QA 70407a8, BUG-001
- Patch: `d11ef36`
- Status: Fixed in prior patch
- Evidence: Full Pilot Round 4 Phase 1 reported the completed advisor-score page showed read-only summary and no stale empty state.

### 9. Evidence raw/internal label cleanup

- Source: Pilot Retest QA 70407a8, BUG-002
- Patch: `d11ef36`
- Status: Mostly fixed
- Evidence: Full Pilot Round 4 Phase 1 reported main raw constants were mapped to formal Thai labels.
- Remaining risk: run one final Evidence UI scan before documentation screenshots.

### 10. Report timeline wording `version 1/2`

- Source: Pilot Retest QA 70407a8, BUG-003
- Patch: `d11ef36`
- Status: Fixed
- Expected wording: `ฉบับที่ 1`, `ฉบับที่ 2`

### 11. Student completed dashboard pending tasks

- Source: Pilot Round 3, BUG-016
- Patch: `70407a8` / `d11ef36`
- Status: Fixed
- Evidence: Full Pilot Round 4 Phase 1 reported the completed dashboard showed no misleading pending tasks.

### 12. Unused rubric versions in evidence summary

- Source: Pilot Round 3, UX-045
- Patch: `70407a8` / `d11ef36`
- Status: Fixed for QA evidence table
- Evidence: Retest report stated only rubric versions with score submissions were shown.

## Still Deferred / Known Risks

### A. QA actor ambiguity

- Source: Pilot Round 3 UX-043; Retest BUG-004; Full Pilot Round 4
- Issue: some QA teacher/dual-role actions may display as `QA Admin`.
- Current handling: `/qa-login` now documents this as a QA limitation.
- Status: Deferred
- Reason: a true fix may require actor/session attribution changes and is outside narrow stabilization.

### B. Possible console 400 resource error

- Source: Retest BUG-005
- Status: Deferred
- Impact: appears diagnostic/polish; no workflow blocker found.
- Recommendation: inspect during documentation screenshot run if it still appears.

### C. Admin rounds readiness copy / current round clarity

- Source: Pilot Round 3 UX-001
- Status: Not recently verified
- Recommendation: visually inspect `/admin/rounds` before screenshots.

### D. Final terminology scan

- Source: Pilot Round 3 UX notes
- Status: Recommended before documentation
- Examples to scan: dashboard headings, evidence labels, proposal form helper text.

### E. Admin proposal decision UX

- Source: Full Pilot Round 4
- Status: wording patched only
- Recommendation: keep as-is for now; add read-only summary/edit mode only if Admin users remain confused.

## Final Focused Retest Checklist

Use the QA preview:

https://system-project-math-sci-7psj46uif-lordtd-hubs-projects.vercel.app/qa-login

Required before documentation screenshots:

1. Submit Proposal and confirm `/student/proposal?success=proposal_submitted` is not blank.
2. Save Progress evidence and confirm `/student/schedule?success=assessment_evidence_saved` is not blank.
3. Submit first report and confirm there is no permanent `กำลังส่ง...` state.
4. After Final but before report v1, confirm NOW says `ส่งเล่มรายงานฉบับสมบูรณ์`.
5. Confirm decided advisor requests no longer show approve/reject buttons.
6. Confirm saved proposal decision button says `แก้ไขผลการตัดสิน`.
7. Confirm `/qa-login` shows the QA Teacher mapping table.
8. Confirm `/admin/evidence` does not expose major raw/internal labels.
9. Confirm `/teacher/advisor-score` uses Thai-first criteria and read-only summary after submit.

## Current Recommendation

Do not start documentation screenshots until items 1-4 are confirmed through a real browser session, because they are exactly the user-facing post-submit states that previously confused the pilot.

No new code patch is currently indicated from source/test/deployed HTML checks. The remaining gap is live browser submit-flow verification.

## Multi-Pilot R2 Wave 1 Current Recommendation

Latest verified QA preview:

- `https://system-project-math-sci-8jb32im2d-lordtd-hubs-projects.vercel.app`

Current status:

- Final round is complete and closed.
- Report workflow completed for Project01/04/05.
- Project05 revision/latest-version review behavior passed.
- Advisor scores were submitted only after report approval.
- Admin closeout completed Project01/04/05.
- Student03 remained locked from report/advisor/closeout flow.
- Evidence page and grade summary CSV/XLSX exports worked.

Recommendation:

- Wave 1 operational semantics are stabilized enough to stop the current pilot loop.
- Before Wave 2, review accumulated Minor/UX debt and decide whether to patch the high-value readability issues first.
- Do not start Wave 2 or documentation/manual screenshots until explicitly approved.

## Multi-Pilot R2 Wave 1 Remaining Cleanup

Primary plan file:

- `e2e-artifacts/multi-pilot-r2-wave1/WAVE1_REMAINING_FULL_LOOP_PLAN.md`
- `e2e-artifacts/multi-pilot-r2-wave1/WAVE1_CLEANUP_STABILIZATION_REPORT.md`
- `e2e-artifacts/multi-pilot-r2-wave1/WAVE2_PLANNING_NOTE.md`

Current recommendation:

- Student readability cleanup has been patched for schedule/report/feedback pages.
- Project03-style Progress/Final recovery visibility has been patched through `/admin/round-exceptions` using existing eligible-but-incomplete buckets.
- Grade summary export now includes `student_full_name_th` while preserving existing weighted score calculations.
- Do not rerun the full Wave 1 lifecycle from scratch.
- Do not start Wave 2 execution yet.
- Do not start documentation/manual screenshots yet.
- Full validation, QA preview push, and live QA smoke verification are still required for the cleanup patch.
- Run remaining Wave 1 cleanup as focused full-loop passes.

Recommended order:

1. Student readability stabilization.
2. Project03 recovery UX and non-Proposal late/reopen decision.
3. Evidence/export polish.
4. Admin/Teacher UX debt triage.
5. Artifact/worktree hygiene.
6. Final Wave 1 readiness note.
7. Wave 2 plan.

Loop rule:

- Minor/UX issues: record and continue.
- Major/Blocker issues: stop, patch minimally, validate, push QA preview, live verify, resume from saved state.

Do not change lifecycle, scoring, round eligibility, auth, or schema during these cleanup passes unless a true blocker proves it unavoidable.
