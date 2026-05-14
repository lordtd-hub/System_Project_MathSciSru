# User-Facing Language Audit

## Status

Deferred until the Figma visual redesign is complete and mutating workflow regression has passed.

Current reason:

- visual redesign still needs a safe mutating regression window;
- copy changes should not be mixed with workflow regression unless they are necessary to fix a Major/Blocker issue;
- wording must be audited against real rendered pages, not terminal output, because Thai text may display as mojibake in PowerShell.

## Goal

Make every visible text surface read like clear communication with real users, not programmer/debug wording.

The pass must preserve:

- lifecycle semantics;
- scoring semantics;
- round eligibility semantics;
- auth and permission semantics;
- audit/evidence meaning;
- route behavior;
- classic/figma mode fallback.

## Audit Scope

### Public / Login

- `/`
- `/qa-login`
- login role selector and identity selector labels
- validation messages such as missing role/identity/password

### Student

- `/student`
- `/student/project`
- `/student/proposal`
- `/student/schedule`
- `/student/report`
- `/student/feedback`
- locked, waiting, returned, late, and completed states

### Teacher

- `/teacher`
- `/teacher/schedules`
- `/teacher/proposals`
- `/teacher/progress1`
- `/teacher/progress2`
- `/teacher/final`
- `/teacher/reports`
- `/teacher/advisor-score`
- approve/reject/score/read-only states

### Admin

- `/admin`
- `/admin/rounds`
- `/admin/round-exceptions`
- `/admin/proposals`
- `/admin/schedules`
- `/admin/closeout`
- `/admin/evidence`
- export/download surfaces
- dangerous action acknowledgements

## Classification

Use these labels for each finding:

- `keep`: already clear and policy-safe.
- `clarify`: same meaning, clearer user-facing wording.
- `replace-internal`: raw enum/code/programmer wording should become Thai user-facing wording.
- `policy-question`: wording affects policy meaning and needs user decision.
- `evidence-technical`: technical wording is acceptable because it is part of evidence/export/audit context.

## Change Rules

Allowed:

- clarify labels, headings, helper text, empty states, success/error text, and warning text;
- replace raw internal status names with Thai labels;
- improve CSV/export column labels while preserving exported data;
- make role/round/status labels consistent across classic and figma modes.

Not allowed:

- hiding audit-critical details;
- softening warnings so much that operational risk becomes unclear;
- changing lifecycle or scoring meaning;
- renaming official round concepts without approval;
- copying Figma English demo copy into the app;
- trusting terminal mojibake as source text.

## Validation Checklist

After each route group:

- `cmd /c npm.cmd run typecheck`
- targeted tests for affected area
- `cmd /c npm.cmd test`
- `cmd /c npm.cmd run build` after meaningful code changes
- classic/figma mode comparison for the changed route group
- browser check for Thai rendering and no mojibake
- export/CSV check when export labels are changed

## Findings

No copy audit has started yet.
