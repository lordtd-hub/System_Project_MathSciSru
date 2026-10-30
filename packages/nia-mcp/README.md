# Private synthetic MCP dependency boundary

This package belongs to the existing project-system repository. It contains only our transport source/generated JS and a separate six-package lock. Root application package.json/package-lock.json remain unchanged (Zod3); this package pins patched Zod4.6.6, MCP handler2.3.0, server/core2.4.0, chalk5.6.2 and commander11.1.0.

The checked-in JS is generated from `src/transport.ts`; matching digests are in SOURCE_DIGESTS.json. Its adjacent declaration exposes only shared application interfaces, keeping SDK/Zod4 types out of the root app compilation. Private source is checked separately with tsconfig.json. No vendor dependency source or node_modules is checked in.

The branch-local Vercel build proposal installs this lock with lifecycle scripts disabled, validates installed identities/source digests, then invokes the original app build. This requires a separately approved build/publish action. It is not an installation instruction to run automatically during review.

The Next runtime rejects anonymous mode, requires an exact owner subject, bounded UTC trial window and a real OAuth verifier. The runtime deliberately does not supply that verifier yet. Flags alone cannot activate data access. No credentials/provider/client or plugin is created by this package.
