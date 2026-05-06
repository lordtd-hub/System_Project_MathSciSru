# Responsive UI Review

## Desktop Checklist

1. `/admin` dashboard readable at 1280px+: summary cards, next action, round status, and admin shortcuts visible.
2. `/student` dashboard clear next action: one primary action, status badge, completed history, and locked future stages.
3. `/teacher` dashboard clear tasks: advisor requests, proposal scoring, schedule approvals, and reports grouped as cards.
4. `/admin/proposals` decision actions visible: Proposal Summary stays decision-focused and teacher claims are absent.
5. `/admin/rounds` shows course-level round cards in a grid with status, counts, and open/close actions.
6. `/admin/committee` clearly shows projects waiting for HEAD/MEMBER assignment and a link to Progress 1 round management after save.
7. `/student/schedule` clearly separates locked/current/history states and blocks Progress 1 before the course-level round opens.
8. `/teacher/scoring/[assignmentId]` shows student submission, rubric groups, live total, vote/comment, and submit action clearly.
9. `/student/report` shows the current report gate, submission form, and version history without mixing Advisor score as an implemented action.
10. `/teacher/reports` shows assigned report review cards with PASS / request-revision actions and Markdown/LaTeX comments.
11. `/teacher/advisor-score` shows advisor-only scoring cards with five rubric fields and clear locked states before `REPORT_APPROVED`.
12. `/admin/closeout` shows near-completion projects as checklist cards with the Admin closeout action only when eligible.

## Mobile Checklist

Test widths: 360px, 390px, 430px.

1. No horizontal overflow at 390px.
2. Top navigation is usable and does not push content off-screen.
3. Cards stack vertically.
4. Forms use full-width inputs and buttons.
5. Proposal scoring checklist rows are large enough to tap.
6. Rubric groups are collapsible.
7. Main submit action is visible on long Student Proposal / Teacher Scoring forms.
8. Alerts and NextActionCard appear before long detail sections.
9. Proposal Summary uses mobile cards / responsive table behavior.
10. Completed actions are read-only and future actions are locked, not shown as primary editable buttons.
11. Empty states remain readable.
12. Report version cards and teacher report review forms stack cleanly on mobile.
13. Advisor score rubric fields stack into a single column with a full-width submit button on narrow screens.
14. Admin closeout checklist cards stack cleanly and the closeout button remains easy to tap.

## Tablet Checklist

Test width: 768px.

1. Two-column grids only appear when content has enough width.
2. Admin round cards remain scannable.
3. Teacher schedule approval buttons remain easy to tap.
4. Student forms do not require horizontal scrolling.

## Notes

- Desktop is the primary target for Admin and committee workflows.
- Mobile is simplified for quick Student/Teacher access.
- Markdown/LaTeX preview and viewer blocks must stay single-column on mobile, and long KaTeX display equations should scroll horizontally inside the viewer.
- Progress 1 / Progress 2 / Final Presentation scoring pages, report approval loop pages, Advisor score pages, and Admin closeout are now in scope for responsive QA. External magic links, AUN-QA export, production deployment, and numeric report scoring remain outside the current baseline.
