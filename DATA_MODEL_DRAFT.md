# Data Model Draft

This is a conceptual Prisma/PostgreSQL model guide. Codex should translate this into a working Prisma schema.

Current baseline note: the early entity and enum lists below are the original MVP draft. The Lifecycle v2 addendum and `prisma/schema.prisma` are authoritative for the current implementation, including course-level `AssessmentRound`, report versions/reviews, Advisor score, and Admin-only closeout.

## Main entities

- User
- Student
- Teacher
- TeacherAccountClaim
- AcademicYear
- Term
- CourseOffering
- Project
- ProjectOrigin
- ProjectOriginVersion
- AssessmentRound
- AssessmentAttempt
- PresentationSubmission
- PresentationSubmissionVersion
- Rubric
- RubricItem
- EvaluatorAssignment
- ScoreSubmission
- ScoreItem
- ProposalEvaluatorDecision
- ProjectProposalResult
- ScoreRelease
- ProjectTimelineEvent
- AuditLog

## Enums

```text
GlobalRole:
ADMIN
TEACHER
STUDENT
PENDING_TEACHER

TeacherClaimStatus:
PENDING
APPROVED
REJECTED

TermType:
SEMESTER_1
SEMESTER_2
SUMMER

ProjectStatus:
DRAFT
ORIGIN_SUBMITTED
PROPOSAL_SUBMITTED
PROPOSAL_UNDER_REVIEW
PROPOSAL_PASSED
PROPOSAL_REVISION_REQUIRED
PROPOSAL_FAILED
COMMITTEE_ASSIGNED_FOR_REPROPOSAL
REPROPOSAL_SUBMITTED
REPROPOSAL_UNDER_REVIEW
REPROPOSAL_PASSED
REPROPOSAL_FAILED
READY_FOR_PROGRESS_1
IN_PROGRESS_1
IN_PROGRESS_2
READY_FOR_FINAL
COMPLETED

SourceType:
STUDENT_INITIATED
ADVISOR_SUGGESTED
TOPIC_BANK
COURSEWORK_EXTENSION
RESEARCH_EXTENSION
COMMUNITY_OR_INDUSTRY_PROBLEM
REVISED_FROM_FAILED_PROPOSAL
OTHER

AssessmentRoundType:
PROPOSAL
REPROPOSAL
PROGRESS_1
PROGRESS_2
FINAL_PRESENTATION

AssessmentStatus:
DRAFT
SUBMISSION_OPEN
SUBMISSION_CLOSED
SCORING_OPEN
SCORING_CLOSED
RELEASED

SubmissionStatus:
DRAFT
SUBMITTED
LOCKED
RETURNED_FOR_REVISION

AttemptType:
MAIN_PROPOSAL
REPROPOSAL
PROGRESS_1
PROGRESS_2
FINAL_PRESENTATION

Decision:
PASS
PASS_WITH_REVISION
NOT_PASS

ScoreStatus:
DRAFT
SUBMITTED
LOCKED

CommitteeRole:
ADVISOR
COMMITTEE_MEMBER
EXTERNAL_COMMITTEE_MEMBER
```

## User

Fields:
- id
- google_sub unique nullable until login
- email unique nullable
- email_domain
- name
- global_role
- active
- last_login_at
- created_at
- updated_at

Notes:
- Use google_sub as stable identity.
- Email alone should not be the primary external identity.

## Student

Fields:
- id
- user_id nullable
- student_code
- first_name_th
- last_name_th
- generated_email
- active
- created_at
- updated_at

Unique:
- student_code
- generated_email

Generated email:
```text
student_code + "@student.sru.ac.th"
```

## Teacher

Fields:
- id
- user_id nullable
- academic_prefix
- first_name_th
- last_name_th
- email nullable
- department default "Mathematics"
- is_internal true
- active true
- can_evaluate_proposal true
- created_at
- updated_at

Computed display name:
```text
academic_prefix + first_name_th + " " + last_name_th
```

## TeacherAccountClaim

Fields:
- id
- teacher_id
- user_id
- claimed_email
- google_sub
- claimed_name_from_google
- status
- requested_at
- reviewed_by_admin_id nullable
- reviewed_at nullable
- admin_note nullable

Rules:
- Pending claims cannot access scoring/student data.
- Only Admin can approve/reject.

## AcademicYear

Fields:
- id
- year_be integer, e.g. 2568
- start_date nullable
- end_date nullable
- active

## Term

Fields:
- id
- academic_year_id
- term_type
- display_name
- status
- created_at
- updated_at

Example display_name:
```text
ภาคเรียนที่ 1 ปีการศึกษา 2568
```

## CourseOffering

Fields:
- id
- term_id
- course_title default "Mathematical Project Course"
- presentation_total_weight default 40
- status

## Project

Fields:
- id
- course_offering_id
- student_id
- current_title_th nullable
- current_title_en nullable
- status
- created_at
- updated_at

A student has one project in one course offering.

## ProjectOrigin

Fields:
- id
- project_id
- initial_project_title_th
- initial_project_title_en nullable
- source_type
- source_detail nullable
- reason_for_topic
- expected_math_area
- tentative_advisor_id nullable
- consultation_summary
- initial_references
- material_link
- declaration_accepted boolean
- status
- submitted_at nullable
- locked_at nullable
- created_at
- updated_at

## ProjectOriginVersion

Fields:
- id
- project_origin_id
- version_no
- snapshot_json
- saved_by_user_id
- saved_at

## AssessmentRound

Fields:
- id
- course_offering_id
- round_type
- name
- course_weight
- raw_score_max default 100
- status
- submission_open_at nullable
- submission_deadline nullable
- scoring_deadline nullable
- show_score_to_student boolean
- show_feedback_to_student boolean
- show_evaluator_name_to_student boolean
- created_at
- updated_at

Proposal defaults:
- course_weight = 10
- show_evaluator_name_to_student = false

## AssessmentAttempt

Fields:
- id
- project_id
- assessment_round_id
- attempt_no
- attempt_type
- previous_attempt_id nullable
- status
- is_official_score boolean default false
- official_score nullable
- final_decision nullable
- final_decision_reason nullable
- created_at
- closed_at nullable

Rules:
- Proposal can have multiple attempts.
- Official proposal score uses latest passed attempt.

## PresentationSubmission

Fields:
- id
- assessment_attempt_id
- project_id
- student_id
- title_th
- title_en nullable
- abstract_text
- content_json
- material_link
- declaration_accepted boolean
- status
- submitted_at nullable
- locked_at nullable
- created_at
- updated_at

For MVP 1, this is ProposalSubmission.

## PresentationSubmissionVersion

Fields:
- id
- presentation_submission_id
- version_no
- snapshot_json
- saved_by_user_id
- saved_at

## Rubric

Fields:
- id
- round_type
- name
- version
- active
- created_at

## RubricItem

Fields:
- id
- rubric_id
- group_key
- group_label_th
- item_key
- item_label_th
- points
- display_order
- is_critical boolean
- evidence_hint nullable

## EvaluatorAssignment

Fields:
- id
- assessment_attempt_id
- evaluator_user_id
- teacher_id nullable
- external_evaluator_id nullable
- evaluator_display_name_snapshot
- is_required boolean
- status
- assigned_at

For main Proposal:
- all active internal teachers
- is_required = false
- missing excluded from average

## ScoreSubmission

Fields:
- id
- evaluator_assignment_id
- total_score
- overall_comment nullable
- status
- submitted_at nullable
- locked_at nullable

## ScoreItem

Fields:
- id
- score_submission_id
- rubric_item_id
- checked boolean
- points_awarded
- comment nullable

## ProposalEvaluatorDecision

Fields:
- id
- score_submission_id
- decision
- reason nullable

Rules:
- reason required when decision is PASS_WITH_REVISION or NOT_PASS

## ProjectProposalResult

Fields:
- id
- assessment_attempt_id
- project_id
- average_score
- submitted_count
- missing_count
- pass_count
- revision_count
- not_pass_count
- final_decision
- final_decision_reason nullable
- decided_by_admin_id
- decided_at

## ScoreRelease

Fields:
- id
- assessment_attempt_id
- project_id
- show_score
- show_feedback
- released_by_admin_id
- released_at

## ProjectTimelineEvent

Fields:
- id
- project_id
- event_type
- event_title
- event_description nullable
- actor_user_id nullable
- occurred_at
- related_entity_type nullable
- related_entity_id nullable
- metadata_json nullable

## AuditLog

Fields:
- id
- actor_user_id nullable
- action
- entity_type
- entity_id
- before_json nullable
- after_json nullable
- occurred_at
- metadata_json nullable
# Data Model Draft - Lifecycle v2 Addendum

เพิ่ม entity สำหรับ Project Lifecycle v2:

- `StudentProfile` เก็บข้อมูลส่วนตัวและ `completed_at`
- `AdvisorRequest` เก็บคำขอ advisor, สถานะ `PENDING`/`APPROVED`/`REJECTED`, comment และ `reminder_due_at` สำหรับ reminder 7 วัน
- `ProjectStatusHistory` เก็บทุกการเปลี่ยนสถานะเพื่อไม่ให้ history หายเมื่อกลับ `DRAFT`
- `ProposalVote` เก็บ vote `PASS`/`REVISE`/`FAIL` และ comment ที่ student เห็นชื่ออาจารย์ได้ทันที
- `CommitteeAssignment` ใช้ role `ADVISOR`/`HEAD`/`MEMBER`/`EXTERNAL_MEMBER`
- `ExamScheduleProposal` เก็บวัน เวลา ห้อง สำหรับ `PROGRESS_1`, `PROGRESS_2`, `FINAL_PRESENT`
- `ExamScheduleApproval` เก็บการ approve/reject ตารางจากกรรมการแต่ละคน
- `AssessmentSubmission` เก็บ material link สำหรับ Progress/Final แบบ database-ready
- `ReportVersion` เก็บ report version และ Google Drive link ใหม่ในแต่ละ version
- `ReportReview` เก็บ reviewer pass/fail/comment
- `AdvisorScore` เก็บคะแนน advisor 25% โดยเริ่มจาก `LOCKED`
- `Notification` เก็บ dashboard notification และ email-ready notification

ProjectStatus v2:

```text
STUDENT_PROFILE
DRAFT
PENDING_ADVISOR
PENDING_ADMIN
PROPOSAL_PENDING
PROPOSAL_REVIEW
PROPOSAL_ADMIN_DECISION
TOPIC_APPROVED
IN_PROGRESS
FINAL_DONE
REPORT_REVIEW
REPORT_APPROVED
ADVISOR_SCORING
COMPLETED
```

Proposal vote:

```text
PASS
REVISE
FAIL
```

Schedule approval:

```text
PENDING
APPROVE
REJECT
```

Report review:

```text
PASS
FAIL
```

Advisor score remains `LOCKED` until all report reviewers pass and advisor clicks "ปิดเล่ม".

Report approval loop implementation:

- `ReportVersion` is append-only by `projectId + versionNo`; each student resubmission creates the next version.
- Student report notes are stored as `ProjectTimelineEvent` rows linked to the `ReportVersion`, so no new report-note table was added.
- `ReportReview` is unique by `reportVersionId + reviewerTeacherId`; saving again updates the same reviewer decision for that version.
- A reviewer `FAIL` means revision is required and the project remains `REPORT_REVIEW`.
- Required active `HEAD`/`MEMBER` reviewer passes across report versions move the project to `REPORT_APPROVED`.
- Report approval does not create Advisor score rows and does not move the project to `ADVISOR_SCORING` or `COMPLETED`.

Advisor score 25% implementation:

- `AdvisorScore` is the dedicated storage for Advisor score; no `AssessmentRound` is created for advisor scoring.
- `AdvisorScore.projectId` remains unique, so one project has one Advisor score row.
- Re-submission by the advisor updates the same `AdvisorScore` row.
- Added rubric fields:
  - `responsibilityScore`
  - `researchProcessScore`
  - `problemSolvingScore`
  - `communicationScore`
  - `professionalismScore`
- `AdvisorScore.score` stores the 100-point raw Advisor rubric total; final 25% weighting is left for later aggregation.
- Advisor score submission can move `REPORT_APPROVED` to `ADVISOR_SCORING`.
- Advisor score submission does not move to `COMPLETED`.

Final closeout implementation:

- No new closeout table was added.
- `COMPLETED` uses existing `Project.status`.
- Admin closeout writes:
  - `ProjectStatusHistory` with reason `ADMIN_MARKED_COMPLETED`
  - `ProjectTimelineEvent` with event type `PROJECT_COMPLETED`
  - `AuditLog` with action `PROJECT_COMPLETED`
- Closeout eligibility reads existing evidence:
  - `AssessmentAttempt` / `EvaluatorAssignment` / `ScoreSubmission` for Progress 1, Progress 2, and Final Presentation score existence
  - `ReportVersion` / `ReportReview` plus status history for report approval and unresolved revision detection
  - `AdvisorScore` for submitted Advisor score
- Re-running closeout for an already completed project is rejected so duplicate completion history is not created.
## Course-Level Batch Rounds

`AssessmentRound` represents one batch round for a `CourseOffering` and `AssessmentRoundType`.

- Unique rule: one `AssessmentRound` per `courseOfferingId + roundType`.
- UI status may be displayed as DRAFT / OPEN / CLOSED / LOCKED, while the current Prisma enum stores this as `DRAFT`, `SUBMISSION_OPEN` or `SCORING_OPEN`, `SUBMISSION_CLOSED` or `SCORING_CLOSED`, and `RELEASED`.
- `AssessmentAttempt` remains project-level and stores per-project attempts/submissions/decisions.
- `Project` is unique per `courseOfferingId + studentId`; Proposal FAIL/REVISE updates the same project and writes `ProjectStatusHistory` instead of creating another active project.
- `ProjectRoundException` stores special per-project handling under the shared round:
  - `projectId`
  - `assessmentRoundId`
  - `exceptionType`
  - `reason`
  - `status`
  - `extendedDeadline`
  - `reopenedAt`
  - `reopenedById`
  - `resolvedAt`
- Failed Proposal should update the same `Project` back to `DRAFT` and preserve `ProjectStatusHistory` / `ProjectTimelineEvent`.
- Demo/E2E data should use stable IDs and upsert/reuse course offerings, projects, and course-level rounds.
- Admin dashboard should select one current project per student/course and keep old attempts/status changes in timeline/history.

## Phase 2A Schedule and Progress Score Storage

Scheduling remains project-level, but it is always attached to the shared course-level round.

- `ExamScheduleProposal.courseOfferingId` links the request to the same course offering as the project.
- `ExamScheduleProposal.assessmentRoundId` links the request to the course-level `AssessmentRound`.
- `ExamScheduleProposal.roundType` stores `PROGRESS_1`, `PROGRESS_2`, or `FINAL_PRESENTATION`.
- `ExamScheduleProposal.note` stores optional Markdown/LaTeX text from the student.
- Unique rule: one active schedule proposal row per `projectId + assessmentRoundId`.
- Re-submitting a schedule for the same project and round updates the existing row instead of creating a duplicate.
- `ExamScheduleApproval` remains one row per `scheduleProposalId + teacherId`.

Progress 1, Progress 2, and Final Presentation scoring use the existing assessment scoring tables.

- `AssessmentAttempt` is upserted by `projectId + assessmentRoundId + attemptNo`.
- `EvaluatorAssignment` is upserted by attempt and teacher user.
- `ScoreSubmission` is upserted by attempt and evaluator assignment.
- `ScoreItem` stores the five Progress 1 / Progress 2 criteria scores or the four Final Presentation criteria scores.
- No separate scoring tables were added for Progress 2; it reuses the same attempt/evaluator/submission/item structure under the course-level `PROGRESS_2` round.
- No separate scoring tables were added for Final Presentation; it reuses the same attempt/evaluator/submission/item structure under the course-level `FINAL_PRESENTATION` round.
- Final Presentation stores raw rubric items totaling 80 points and stores normalized `ScoreSubmission.totalScore` on the existing 100-point scale.
