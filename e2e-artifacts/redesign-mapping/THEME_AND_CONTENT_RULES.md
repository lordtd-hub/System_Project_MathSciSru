# Theme And Content Rules

These rules are mandatory for the redesign.

## Brand / Logo

Do not change the department logo.

Canonical logo path:

- `public/logo-mathstat-sru.jpg`

Reference copy of the same asset:

- `logo_mathscisru/240604449_110412248053596_15506778335106410_n.jpg`

The logo may be resized or placed in a new shell/header, but it must not be redrawn, recolored, replaced, cropped beyond recognition, or swapped for a generated mark.

## Color Theme

Use the existing app theme as the base.

Canonical tokens are in:

- `src/app/globals.css`
- `tailwind.config.ts`

Important existing colors:

- Brand red: `#9A1822`
- Brand dark red: `#7A141C`
- Paper background: `#F7F5F1`
- Secondary paper: `#FAF8F4`
- Surface: `#FFFFFF`
- Ink: `#15171A`
- Muted text: `#6B7480`
- Line: `#E3E6EC`
- Success: `#1F6F3A`
- Warning: `#8A5A00`
- Info: `#1A4A86`
- Error/danger: `#8A1A22`

The Figma mockup uses a cleaner navy/blue operational-console feel. It can guide structure and spacing, but the implemented app should stay on the existing warm paper/red academic theme unless the user explicitly approves a palette change.

## Typography

Keep the current Thai-first font stack:

- `"Noto Sans Thai", "Leelawadee UI", "Tahoma", "Segoe UI", system-ui, sans-serif`

Do not use viewport-scaled font sizes.

## UI Copy / Text

Current production-like app text is the source of truth.

Rules:

- Thai remains the primary UI language.
- Existing Thai wording from current pages must be reused wherever possible.
- Figma English text is layout reference only, not copy source.
- Do not rename lifecycle states, round labels, action labels, or warnings without an explicit wording decision.
- Do not replace precise operational wording with vague marketing text.
- Do not add visible instructional text that explains UI mechanics unless the current app already needs it for safety.

## Post-Redesign User-Facing Language Pass

After the Figma visual redesign is complete and mutating workflow regression has passed, run a dedicated copy pass across every page.

Goal:

- make all visible Thai text sound like communication with real users, not programmer/debug wording;
- keep the same lifecycle meaning, permissions, and workflow semantics;
- keep precise operational terms where they prevent mistakes;
- remove raw enum/status/code-like wording from user-facing surfaces unless it is intentionally shown as technical evidence;
- preserve the department theme, logo, and existing route behavior.

Allowed after redesign completion:

- clarify labels, headings, empty states, helper text, warnings, and button text;
- replace raw internal terms such as enum-like status names with Thai user-facing wording;
- make waiting/action/locked/completed states easier for students, teachers, and admins to understand;
- improve CSV/export labels and evidence descriptions while preserving the exported data.

Not allowed:

- changing lifecycle logic, scoring logic, eligibility logic, permissions, or server actions;
- renaming official round concepts in a way that changes policy meaning;
- hiding warnings, late/exception evidence, grade-I risk wording, or audit-critical details;
- copying Figma English demo text into the app.

Copy audit sources:

- browser-rendered UI text in classic and figma modes;
- source strings in `src/app` and `src/components`;
- CSV/export/download route labels;
- validation/error/success messages;
- empty states and locked/waiting states;
- Markdown/evidence/report display surfaces.

Examples of copy that must remain aligned with current app semantics:

- Proposal / Progress 1 / Progress 2 / Final wording.
- Eligible-but-incomplete vs not-yet-eligible wording.
- Late/reopen/exception wording.
- Final grade-I risk wording.
- Report revision/latest-version wording.
- Advisor score 25% wording.
- Admin closeout wording.

## Layout Tone

Target style:

- academic operational tool;
- compact but readable;
- table/list first for desktop workload pages;
- stacked card lists for mobile;
- clear action hierarchy;
- dangerous actions visually separated;
- completed/history content visually lower priority than actionable work.

Avoid:

- marketing-style landing sections for operational pages;
- decorative gradient/orb backgrounds;
- oversized hero typography inside dashboards;
- cards inside cards;
- table layouts that overflow mobile screens.
