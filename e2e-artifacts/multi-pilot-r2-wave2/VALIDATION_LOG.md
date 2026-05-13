# MULTI-PILOT-R2 Wave 2 Validation Log

## 2026-05-13 - Start

Planning docs were committed as `a02ea8d`.

## 2026-05-13 - Phase 1 QA Setup Patch

Code patch:

- Added Wave 2 QA setup constants and scenario mix.
- Added `/qa-login` action to prepare a separate Wave 2 QA course offering.
- Added source/unit coverage for the Wave 2 setup boundary.

Validation:

- `cmd /c npm.cmd test -- src/lib/qa/multiPilotR2.test.ts` - passed.
- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test -- src/app/qaLoginSource.test.ts src/lib/qa/multiPilotR2.test.ts` - passed.
- `cmd /c npm.cmd run typecheck` - passed.
- `cmd /c npm.cmd test` - passed, 80 files / 334 tests.
- `cmd /c npm.cmd run build` - passed.

Pending:

- Secret scan before commit.
- QA preview push.
- Live QA verification and data preparation.

Validation requirement:

- If no app code changes are made, run at least `npm test` before finalizing a no-code loop.
- If app code changes are made, run:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

Additional checks:

- Confirm QA secret is not written to artifacts.
- Confirm production config is not changed.
- Confirm unrelated dirty files are not staged.
