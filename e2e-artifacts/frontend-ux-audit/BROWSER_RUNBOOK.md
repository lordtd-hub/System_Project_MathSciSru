# Frontend UX Audit Browser Runbook

Status: active runbook for the remaining frontend UX audit.

## Why the recent browser loop broke

The app itself was not the main problem. The browser automation lost the stable preview/session path.

Older long pilot loops worked because they used one visible persistent browser context that had already passed Vercel Deployment Protection. Role switching then happened inside the app through `/qa-login`.

The fragile path is:

- opening a fresh browser/profile,
- opening protected deep links directly,
- mixing normal user Edge, Playwright Edge, Chrome plugin, and CDP sessions,
- or closing the visible browser between checks.

When a protected preview route is opened directly without the right preview cookie/session, Vercel can show Deployment Protection even if the app works.

## Preferred method for this audit

Use Playwright visible Microsoft Edge only.

Start only at `/qa-login`:

```powershell
cmd /c npx.cmd --yes --package @playwright/cli playwright-cli -s=edgepilot-visible open https://system-project-math-sci-dh62wk9k0-lordtd-hubs-projects.vercel.app/qa-login --browser msedge --headed --persistent --profile .playwright-cli\edgepilot-visible
```

Rules:

- Keep the visible window open.
- Do not close Edge from automation.
- Do not reset storage/cookies.
- Do not open protected deep links directly as the first action.
- Switch roles through `/qa-login`.
- Always select the first role dropdown before selecting Admin/Student/Teacher identity.
- Use in-app navigation links whenever possible.
- If a route is not discoverable from the current UI state, record it as not reachable from current state instead of forcing a deep link.

## Guard checks before every browser action

Before clicking or typing, verify:

- the visible page is the QA preview, not Vercel login/protection,
- the route is expected,
- the role is expected,
- the identity is expected,
- the route state matches the audit step,
- the intended action is non-mutating unless explicitly required.

After every navigation, verify:

- no Vercel Deployment Protection page,
- no digest/error page,
- no shell-only render,
- no unexpected role/session switch,
- no unexpected workflow mutation.

## Stop conditions

Stop immediately and record the state if:

- Vercel Deployment Protection appears,
- session role/identity is wrong,
- QA state does not match the expected route,
- the browser window disappears,
- the only way forward is to mutate workflow state.

Do not guess-click after a mismatch.

## If visible Playwright becomes unstable

The older stable fallback was a persistent Edge process with remote debugging/CDP on port `9333`. It worked because the browser stayed open and CDP attached to that same visible window.

Use this fallback only if the user approves returning to CDP. For the current audit, the requested method is Playwright visible.

## Audit continuation note

The current audit stopped after direct navigation to `/student/report` triggered Vercel Deployment Protection. Resume from `/qa-login`, then navigate through visible app links. If report/feedback routes are not reachable from the current student state through the UI, mark that route as partially checked/not reachable rather than deep-linking.
