# MULTI-PILOT-R2 Wave 2 Bug Log

## Active / Recorded Issues

### W2-MAJOR-001 - Progress recovery late exception did not unlock student/teacher schedule flow

- Severity: Major.
- Area: `/student/schedule`, `/teacher/schedules`, `reviewExamSchedule`.
- Role/project: Student10 / W2-10 and assigned committee teachers.
- Route/state: Progress 1 was closed, then Admin opened a Progress 1 late exception for W2-10.
- Expected: W2-10 should see Progress 1 evidence/schedule actions as late-open, and assigned teachers should be able to review the late-recovered schedule.
- Actual: W2-10 still saw Progress 1 as locked/not open and had no evidence/schedule form. Teacher schedule queues/actions also depended only on the round `OPEN` status.
- Root cause: UI/action guards used `isRoundOpen(round.status)` as the only availability source for non-Proposal schedule rounds, without considering an open project-level late exception.
- Patch: student round availability now includes open late exceptions; teacher schedule queue filtering and schedule review action now allow the matching open late exception while keeping the normal closed-round guard for projects without an exception.
- Validation: `typecheck`, `npm test`, `build`, and QA secret scan passed locally.
- Live verification: pending on the next QA preview.

Follow-up root cause found during live verification:

- After the first patch, W2-10 still appeared in the Progress 1 `not ready` bucket.
- Cause: `roundEligibility.ts` treated any non-resolved round exception as a readiness blocker, including the open late exception itself.
- Fix: open late/excused round exceptions no longer reduce eligibility; non-late open exceptions still block readiness.
- Added tests that late-open projects remain eligible/incomplete while administrative hold exceptions still block.

### W2-TOOL-001 - QA login role dropdown guard can block or misroute pilot runners

- Severity: Major for pilot execution tooling; not currently classified as an app lifecycle bug.
- Area: `/qa-login`
- Role/project: all QA identities, especially when switching between Admin / Student / Teacher.
- Observed: the first `บทบาท` select can remain blank and the browser shows native validation: `Please select an item in the list.`
- Risk: if automation does not explicitly select the role before identity submission, the loop can stop at login, or continue under the wrong assumed role/state.
- Root cause in runner usage: earlier CDP runners used mismatched role values and did not always validate the role select before submit.
- Current runner rule: always select the role dropdown first using the actual lowercase option values (`admin`, `student`, `teacher`), then select the matching identity key, then assert `form.checkValidity()` before submit.
- Required guard for future scripts:
  - confirm role option exists before submit;
  - confirm identity option exists for that role;
  - confirm current page after login matches the expected role route;
  - stop immediately on mismatch.
- Recommendation: keep this as a mandatory QA-login preflight for every Wave 2 CDP/browser script.

### W2-UX-001 - Teacher completed/history sections become dense after repeated rounds

- Severity: Minor/UX.
- Area: `/teacher/schedules`, `/teacher/reports`, `/teacher/advisor-score`.
- Role/project: teachers with multiple Wave 1 and Wave 2 historical assignments.
- Observed: after Proposal, Progress 1, Progress 2, Final, Report, and Advisor Score complete, completed/read-only sections become long.
- Workflow impact: none observed; actionable queues still cleared correctly and unauthorized actions were not shown.
- Operational risk: at 20+ projects, teachers may need stronger filters/search/collapsible history to avoid scanning fatigue.
- Recommendation: before scaling beyond 20, consider compact filters for round/status/course offering and collapsible completed-history sections.

### W2-UX-002 - Student report page does not surface project title prominently enough for automation guard

- Severity: Minor/UX.
- Area: `/student/report`.
- Role/project: Wave 2 students.
- Observed: the report page was operationally correct, but the page body did not expose the project title in a way that the pilot script could reliably use as a guard.
- Workflow impact: none; report submission, waiting state, history, revision, and approval worked.
- Tooling response: the runner was adjusted to guard by role, report status, form availability, and history instead of project title.
- Recommendation: in a later student readability pass, consider showing the active project title consistently on student workflow pages.

## Resolved / Completed Loop Notes

- W2-12 report revision/latest-version loop passed.
- W2-11 Final schedule reject/resubmit loop passed.
- W2-10 Progress recovery passed after the late-exception stabilization patch.
- No active Major/Blocker remains from the 12-project Wave 2 loop.

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
