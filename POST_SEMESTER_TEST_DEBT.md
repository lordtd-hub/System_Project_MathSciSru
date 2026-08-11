# Post-semester test debt

This file records deferred test work that is intentionally outside the active-semester maintenance patches.

- Replace the remaining source-string tests with rendered component, route, or service behavior tests.
- Add browser coverage for draft recovery across refresh, delayed Server Action responses, and double clicks.
- Add a disposable PostgreSQL integration suite for transaction lock contention and serialization retries.
- Add a deployment-level environment matrix for local, Vercel Preview, and Vercel Production.

The scoring persistence and environment paths changed by the reliability patches use behavioral unit tests now. Production and QA mutations remain manual, separately approved smoke tests.
