# Project Record + Dashboard IA Cleanup Decisions

## Active Decisions

1. Project Record is read-only.
   - It may link to existing workflow pages.
   - It must not create new server actions or mutations.

2. Dashboard cleanup happens after Project Record exists.
   - Dashboards answer "what should I do now?"
   - Project Record answers "what has happened in this project?"

3. Access is enforced in the read model.
   - Admin can view all projects.
   - Student can view only their own project.
   - Teacher can view only projects where they are related by existing advisor, committee, evaluator, schedule approval, report review, or advisor-score relationship.
   - Unrelated viewers must receive a safe unauthorized/not-found response.

4. No schema or lifecycle changes.
   - This pass is UI/read-model/information-architecture only.

5. UTF-8 is mandatory.
   - New files must be UTF-8.
   - Thai text must not be copied from corrupted terminal output.

## Pending Decisions

None at Phase 0.
