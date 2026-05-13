# Redesign Skill Guide

This file defines the skills and working style Codex should use during the redesign.

## Primary Skill: Frontend Operational UX

Use this skill whenever changing Admin, Teacher, or Student UI.

Core behaviors:

- Treat the app as an operational academic system, not a marketing site.
- Prefer compact, scan-friendly layouts.
- Put action queues first.
- Separate `needs action`, `waiting`, `completed`, `locked`, and `exception` states.
- Keep dangerous actions visually isolated.
- Preserve all existing permissions and guards.
- Use the current app text as the copy source.
- Use the current logo and theme tokens.

## Secondary Skill: Figma-To-App Mapping

Use this skill when translating Figma mockups into app routes.

Rules:

- Figma is structure/reference only.
- Do not copy English text into production UI.
- Do not copy Figma demo logic into app logic.
- Map each Figma panel to current data/services before implementing.
- When a Figma screen is missing, document the gap before designing from scratch.

## Secondary Skill: Responsive UI Review

Use this skill for every redesigned page.

Rules:

- Test desktop and mobile.
- At 390px width, no table may hide action buttons or status columns.
- Use stacked cards for mobile queues.
- Keep tap targets comfortable.
- Do not let text overflow its container.
- Do not use viewport-width font scaling.

## Secondary Skill: Legacy Behavior Preservation

Use this skill before replacing any real route.

Checklist:

- Same current user role?
- Same project/course offering?
- Same available actions?
- Same hidden actions for unauthorized users?
- Same status wording?
- Same submit/approve/reject/score server action?
- Same post-submit state?
- Same counters/buckets?
- Same export behavior?

## Tools / Techniques

Preferred:

- inspect real app source routes first;
- inspect live QA state when needed;
- use Edge CDP for screenshots and DOM checks;
- use Figma connector when access works;
- use screenshot comparison for responsive checks;
- add source tests for redesigned components and key wording.

Avoid:

- rewriting lifecycle services;
- introducing new APIs for simple UI grouping;
- changing Prisma schema;
- replacing route structure early;
- editing production settings.

## Design Component Targets

Recommended new components:

- `AppShell`
- `MobileHeader`
- `RoleSidebar`
- `KpiCard`
- `ActionQueue`
- `ResponsiveQueueList`
- `StatusBadge`
- `RoleBadge`
- `RoundLifecycleCard`
- `ProjectReviewLayout`
- `EvidenceCard`
- `ReviewHistoryTimeline`
- `DangerZone`
- `EmptyState`
- `LockedState`

Component folder:

- `src/components/redesign/`

## Language Skill

Thai is the primary UI language.

When text exists in current app:

- reuse it;
- move it into the new layout unchanged unless the user approves wording changes.

When Figma text is English:

- use it only to infer purpose;
- replace with existing Thai page text or a Thai wording decision.
