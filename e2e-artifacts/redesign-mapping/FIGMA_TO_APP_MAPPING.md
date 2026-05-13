# Figma To App Mapping

Figma Make file inspected from Edge:

- `Admin Teacher Workflow Redesign`
- URL: `https://www.figma.com/make/Tl7ReaqsHwvmtbsGmWNxae/Admin-Teacher-Workflow-Redesign`

The direct Figma connector could not access the file, but the running Figma Make preview was inspected through Edge CDP.

## Captured Mockup Screens

| Mockup | Screenshot | App mapping |
| --- | --- | --- |
| Admin Overview | `e2e-artifacts/figma-mockup-admin-overview.png` | `/admin` |
| Admin Rounds & Lifecycle | `e2e-artifacts/figma-mockup-admin-rounds.png` | `/admin/rounds` |
| Teacher Review Inbox | `e2e-artifacts/figma-mockup-teacher-inbox.png` | `/teacher`, possibly shared teacher workload entry |
| Project Review Detail desktop | `e2e-artifacts/figma-mockup-project-review-desktop.png` | `/teacher/proposals`, `/teacher/progress1`, `/teacher/progress2`, `/teacher/final`, `/teacher/reports`, `/teacher/advisor-score` |
| Admin mobile overview | `e2e-artifacts/figma-mockup-mobile-admin-overview.png` | mobile `/admin` direction |
| Teacher mobile inbox | `e2e-artifacts/figma-mockup-mobile-teacher-inbox.png` | mobile teacher workload direction |
| Project Review Detail mobile | `e2e-artifacts/figma-mockup-project-review-mobile.png` | mobile teacher detail direction |

## Useful Patterns To Adopt

### Admin Overview

Adopt:

- KPI cards for total/active/pending/exception/completed state.
- Immediate action table/list.
- Workflow bottleneck panel.
- Upcoming milestone panel.

Adapt:

- Use current Thai text from `/admin`.
- Keep existing warm paper/red theme.
- Replace Figma demo numbers with real admin queries.
- Do not introduce new lifecycle meanings.

### Admin Rounds & Lifecycle

Adopt:

- one card per round;
- clear active/closed/upcoming state;
- close eligibility checklist;
- dangerous action zone separated from ordinary actions.

Adapt:

- Preserve current eligibility buckets:
  - eligible for this round;
  - submitted/current-round evidence;
  - completed/current-round assessment;
  - eligible but incomplete;
  - not yet eligible for this round;
  - late/open exceptions.
- Preserve Final grade-I warning.
- Do not use `Force Close Round` wording directly. Use existing Thai close/acknowledgement wording.

### Teacher Review Inbox

Adopt:

- workload summary;
- role filters;
- `Needs action` / `Waiting` / `Completed` separation;
- compact row layout on desktop;
- role badges such as advisor/chair/committee.

Adapt:

- Use current Thai terms.
- Use current teacher permissions and queries.
- Do not show actions for unauthorized projects.

### Project Review Detail

Adopt:

- desktop two-column layout:
  - left: project context, evidence, history;
  - right: assessment/review form and action.
- mobile one-column layout.
- evidence cards.
- review history timeline.
- clear decision/action zone.

Adapt per workflow:

- Proposal: PASS / PASS_WITH_REVISION / NOT_PASS and reason rules.
- Progress 1/2: required committee scoring, no final decision copy.
- Final: final presentation scoring, no report unlock bypass.
- Report: approval/revision evidence only, latest-version rules.
- Advisor Score: advisor 25% rubric, not tied to AssessmentRound.

## Figma Gaps

The Figma mockup does not yet cover:

- Student dashboard.
- Student proposal/evidence/schedule states.
- Student report states.
- Student feedback/result page.
- Admin evidence/export detail.
- Admin closeout checklist detail.
- Admin round exceptions detail.
- Student mobile flows.

## Mobile Finding

The mockup has a good mobile shell and stacked KPI cards, but some table sections still overflow/crop horizontally on 390px mobile.

Implementation rule:

- Desktop may use tables.
- Mobile must use stacked cards/lists for queues.
- No critical action column may be hidden off-screen.

## Current Recommendation

Use the mockup as structure and interaction direction, not as a copy source or business logic source.
