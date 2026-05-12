# MULTI-PILOT-R2 Setup Plan

## 1. Purpose

MULTI-PILOT-R2 is a QA-only controlled operational simulation for checking whether the application can support a realistic course scale:

- about 40 students
- about 11 teachers
- multiple projects at the same time
- overlapping teacher roles
- partial/late submissions
- committee scoring by multiple teachers
- schedule approval/rejection
- evidence/export activity

This is not a production feature. The real production system already supports real rosters through Admin import and real authentication through Google OAuth. MULTI-PILOT-R2 only provides synthetic QA identities and a clean QA course offering so we can test scale without creating real university Google accounts.

## 2. Safety Rules

- QA preview only.
- No production deployment.
- No real student or teacher identities.
- No QA secret stored in code or documentation.
- No schema change.
- No lifecycle bypass.
- No old pilot history deletion.
- No direct DB manipulation during the actual pilot workflow.

## 3. Setup Helper

The `/qa-login` page now includes a QA-only setup action:

```text
Prepare MULTI-PILOT-R2 data
```

The action requires the normal QA login secret and runs only when QA login is enabled.

It creates or reuses:

- `MULTI-PILOT-R2 Course Offering`
- 40 synthetic students
- 11 synthetic teachers
- 40 starter project rows at `STUDENT_PROFILE`
- the normal course-level assessment rounds for the course offering

It does not submit proposals, approve advisors, assign committees, open/close rounds, submit scores, or close projects. The actual pilot must still use the real UI workflow.

## 4. Users

### Admin

| Role | Display name | Email |
|---|---|---|
| Admin | MULTI-PILOT-R2 Admin | multi.pilot.r2.admin@sru.test |

### Students

| # | Display label | Email |
|---:|---|---|
| 01 | MULTI-PILOT-R2 Student 01 | multi.pilot.r2.student01@sru.test |
| 02 | MULTI-PILOT-R2 Student 02 | multi.pilot.r2.student02@sru.test |
| 03 | MULTI-PILOT-R2 Student 03 | multi.pilot.r2.student03@sru.test |
| 04 | MULTI-PILOT-R2 Student 04 | multi.pilot.r2.student04@sru.test |
| 05 | MULTI-PILOT-R2 Student 05 | multi.pilot.r2.student05@sru.test |
| 06 | MULTI-PILOT-R2 Student 06 | multi.pilot.r2.student06@sru.test |
| 07 | MULTI-PILOT-R2 Student 07 | multi.pilot.r2.student07@sru.test |
| 08 | MULTI-PILOT-R2 Student 08 | multi.pilot.r2.student08@sru.test |
| 09 | MULTI-PILOT-R2 Student 09 | multi.pilot.r2.student09@sru.test |
| 10 | MULTI-PILOT-R2 Student 10 | multi.pilot.r2.student10@sru.test |
| 11-40 | MULTI-PILOT-R2 Student 11-40 | multi.pilot.r2.student11-40@sru.test pattern |

### Teachers

| # | Display label | Email |
|---:|---|---|
| 01 | MULTI-PILOT-R2 Teacher 01 | multi.pilot.r2.teacher01@sru.test |
| 02 | MULTI-PILOT-R2 Teacher 02 | multi.pilot.r2.teacher02@sru.test |
| 03 | MULTI-PILOT-R2 Teacher 03 | multi.pilot.r2.teacher03@sru.test |
| 04 | MULTI-PILOT-R2 Teacher 04 | multi.pilot.r2.teacher04@sru.test |
| 05 | MULTI-PILOT-R2 Teacher 05 | multi.pilot.r2.teacher05@sru.test |
| 06 | MULTI-PILOT-R2 Teacher 06 | multi.pilot.r2.teacher06@sru.test |
| 07 | MULTI-PILOT-R2 Teacher 07 | multi.pilot.r2.teacher07@sru.test |
| 08 | MULTI-PILOT-R2 Teacher 08 | multi.pilot.r2.teacher08@sru.test |
| 09 | MULTI-PILOT-R2 Teacher 09 | multi.pilot.r2.teacher09@sru.test |
| 10 | MULTI-PILOT-R2 Teacher 10 | multi.pilot.r2.teacher10@sru.test |
| 11 | MULTI-PILOT-R2 Teacher 11 | multi.pilot.r2.teacher11@sru.test |

## 5. Project Scenario Distribution

| Category | Projects | Count | Purpose |
|---|---|---:|---|
| Happy Path | 01-10 | 10 | normal full workflow |
| Delayed Submission | 11-18 | 8 | late proposal/progress behavior |
| Missing Evidence | 19-24 | 6 | incomplete progress and round closure behavior |
| Schedule Rejection | 25-30 | 6 | reject/resubmit schedule behavior |
| Report Revision Loop | 31-36 | 6 | report v1/v2/v3 and latest-version approval |
| Queue/Conflict Stress | 37-40 | 4 | overlapping teacher queues and agenda clarity |

## 6. Role Mapping Formula

For project number `n`:

- Student = Student `n`
- Advisor = Teacher `((n - 1) mod 11) + 1`
- Head committee = Teacher `((n + 2) mod 11) + 1`
- Member committee = Teacher `((n + 6) mod 11) + 1`

This avoids assigning the same teacher as advisor/head/member on the same project while distributing roles across all 11 teachers.

Each teacher receives at least:

- 3 advisor roles
- 3 head committee roles
- 3 member committee roles

## 7. Wave Plan

| Wave | Students | Teachers | Projects | Goal |
|---|---:|---:|---:|---|
| Wave 1 | 5 | 4 | 5 | workflow and role-overlap bugs |
| Wave 2 | 15 | 6-8 | 15 | queue/dashboard/performance realism |
| Wave 3 | 40 | 11 | 40 | near-real course-scale readiness |
| Peak Moment Test | 40 | 11 | 40 | concurrent submit/score/export behavior |

## 8. Expected Stress Points

- Teacher dashboard with mixed advisor and committee tasks.
- Multiple projects in different workflow states.
- Reviewer-specific read-only scoring after one teacher submits.
- Admin current-round focus when some projects are complete and some are incomplete.
- Student dashboard wording for late/missing submissions.
- Schedule rejection/resubmission with multiple approvers.
- Report revision history and latest-version-only approval.
- Evidence export after many timeline/audit/score records exist.

## 9. Non-Submission / Round-Closure Cases

During Wave 2 or Wave 3, intentionally leave some projects incomplete:

1. Close Proposal while some students have no proposal.
2. Close Progress 1 while one project has no evidence.
3. Open Progress 2 while some projects are still behind.
4. Close Final while committee scores are incomplete.
5. Leave one report review incomplete.
6. Confirm advisor score does not unlock until report approval.
7. Confirm Admin closeout blocks incomplete projects.

Record dashboard state, teacher queue state, student message, admin bottleneck wording, and recoverability.

## 10. Performance / Concurrency Plan

Do not run heavy load yet. Prepare a later run for:

- 20-40 students opening `/student`
- 10-20 students saving proposal/evidence close together
- 5-11 teachers opening `/teacher`
- several teachers submitting scores close together
- Admin opening dashboard/evidence/export while records are active

Metrics to collect later:

- page load time
- server action response time
- duplicate records
- failed requests
- Vercel function duration
- Supabase query latency

Recommended QA-only env flags if available:

- `NAV_TIMING_LOGS=1`
- `ACTION_TIMING_LOGS=1`

Enable temporarily in Preview only, then turn off after measurement.

## 11. Setup Steps

1. Open the QA preview `/qa-login`.
2. Enter the QA secret in the MULTI-PILOT-R2 setup section.
3. Click `Prepare MULTI-PILOT-R2 data` / `เตรียมข้อมูล MULTI-PILOT-R2`.
4. Confirm success message appears.
5. Login as `MULTI-PILOT-R2 Admin`.
6. Verify `MULTI-PILOT-R2 Course Offering` exists.
7. Login as several R2 students and confirm each has a starter project at the student-profile stage.
8. Login as several R2 teachers and confirm dashboards load with no unrelated tasks at the beginning.
9. Start Wave 1 only after setup is reviewed.

## 12. Remaining Risks

- The setup helper creates starter projects but does not pre-fill project titles or advisor requests. That is intentional: those steps must be tested through the normal UI.
- If existing QA data includes other active course offerings, student context must still select the latest project correctly for R2 identities. R2 student emails are unique to reduce this risk.
- The R2 Admin identity is synthetic and QA-only; production Admin must still use real authentication.
- The helper does not clean old pilot data. If a clean visual environment is required later, use a reviewed QA-only reset path rather than deleting history ad hoc.
