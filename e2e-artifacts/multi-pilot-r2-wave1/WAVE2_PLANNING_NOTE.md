# MULTI-PILOT-R2 Wave 2 Planning Note

Date: 2026-05-13
Status: planning only. Wave 2 execution has not started.

## Preconditions

Wave 2 should start only after:

- Wave 1 cleanup validation passes locally.
- The QA preview for the cleanup patch is live-verified.
- Existing QA data is preserved.
- Production remains untouched.

## Recommended Wave 2 Purpose

Wave 2 should test whether the stabilized lifecycle holds when more projects enter the workflow and teacher/admin queues become denser.

Wave 1 proved one controlled full lifecycle:

Proposal -> Progress 1 -> Progress 2 -> Final -> Report -> Advisor Score -> Admin Closeout

Wave 2 should focus on scale and overlap:

- more students active in the same round,
- more simultaneous schedule approvals,
- more simultaneous scoring tasks,
- more advisor/chair/member role overlap,
- more incomplete and late/recovery cases,
- higher evidence/export volume.

## Suggested Scope

Use the same QA branch and QA-only environment.

Recommended checks:

- Open/close round behavior with larger eligible buckets.
- Student readability under varied states: action, waiting, locked, completed.
- Teacher workload pages with 10+ visible tasks.
- Admin operational pages with larger bucket counts.
- Project03-style recovery cases for Progress/Final.
- Grade summary CSV/XLSX with all registered students.
- Unauthorized teacher visibility checks for non-assigned teachers.

## Risks To Watch

- Queue density may still feel heavy even after stabilization.
- Recovery cases are operationally possible, but a dedicated recovery console may be better after Wave 2.
- Very large exports should be checked for timeout/memory only after workflow semantics remain stable.
- Manual screenshot/documentation should wait until Wave 2 scope is agreed.

## Boundary

Do not use Wave 2 to redesign the whole app.

Allowed during Wave 2:

- focused UI/readability patches,
- guard/queue correctness fixes,
- export labeling fixes,
- minimal blocker patches.

Avoid during Wave 2:

- schema changes,
- lifecycle architecture rewrites,
- scoring formula changes,
- production deployment,
- broad visual redesign,
- manual documentation screenshot production.

## Recommendation

After the cleanup patch is validated and live-verified, Wave 2 planning can begin. Wave 2 execution should be a separate prompt/run with explicit scope, stop conditions, and QA state guard rules.
