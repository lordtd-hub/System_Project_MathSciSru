-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT', 'PENDING_TEACHER');

-- CreateEnum
CREATE TYPE "TeacherClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TermType" AS ENUM ('SEMESTER_1', 'SEMESTER_2', 'SUMMER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ORIGIN_SUBMITTED', 'PROPOSAL_SUBMITTED', 'PROPOSAL_UNDER_REVIEW', 'PROPOSAL_PASSED', 'PROPOSAL_REVISION_REQUIRED', 'PROPOSAL_FAILED', 'COMMITTEE_ASSIGNED_FOR_REPROPOSAL', 'REPROPOSAL_SUBMITTED', 'REPROPOSAL_UNDER_REVIEW', 'REPROPOSAL_PASSED', 'REPROPOSAL_FAILED', 'READY_FOR_PROGRESS_1', 'IN_PROGRESS_1', 'IN_PROGRESS_2', 'READY_FOR_FINAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('STUDENT_INITIATED', 'ADVISOR_SUGGESTED', 'TOPIC_BANK', 'COURSEWORK_EXTENSION', 'RESEARCH_EXTENSION', 'COMMUNITY_OR_INDUSTRY_PROBLEM', 'REVISED_FROM_FAILED_PROPOSAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AssessmentRoundType" AS ENUM ('PROPOSAL', 'REPROPOSAL', 'PROGRESS_1', 'PROGRESS_2', 'FINAL_PRESENTATION');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'SUBMISSION_OPEN', 'SUBMISSION_CLOSED', 'SCORING_OPEN', 'SCORING_CLOSED', 'RELEASED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED', 'RETURNED_FOR_REVISION');

-- CreateEnum
CREATE TYPE "AttemptType" AS ENUM ('MAIN_PROPOSAL', 'REPROPOSAL', 'PROGRESS_1', 'PROGRESS_2', 'FINAL_PRESENTATION');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('PASS', 'PASS_WITH_REVISION', 'NOT_PASS');

-- CreateEnum
CREATE TYPE "ScoreStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "CommitteeRole" AS ENUM ('ADVISOR', 'COMMITTEE_MEMBER', 'EXTERNAL_COMMITTEE_MEMBER');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'EXCUSED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "google_sub" TEXT,
    "email" TEXT,
    "email_domain" TEXT,
    "name" TEXT,
    "global_role" "GlobalRole" NOT NULL DEFAULT 'STUDENT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "student_code" TEXT NOT NULL,
    "first_name_th" TEXT NOT NULL,
    "last_name_th" TEXT NOT NULL,
    "generated_email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "academic_prefix" TEXT NOT NULL,
    "first_name_th" TEXT NOT NULL,
    "last_name_th" TEXT NOT NULL,
    "email" TEXT,
    "department" TEXT NOT NULL DEFAULT 'Mathematics',
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "can_evaluate_proposal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_account_claims" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "claimed_email" TEXT NOT NULL,
    "google_sub" TEXT NOT NULL,
    "claimed_name_from_google" TEXT,
    "status" "TeacherClaimStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by_admin_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "admin_note" TEXT,

    CONSTRAINT "teacher_account_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" TEXT NOT NULL,
    "year_be" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms" (
    "id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "term_type" "TermType" NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_offerings" (
    "id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "course_title" TEXT NOT NULL DEFAULT 'Mathematical Project Course',
    "presentation_total_weight" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "course_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "course_offering_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "current_title_th" TEXT,
    "current_title_en" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_origins" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "initial_project_title_th" TEXT NOT NULL,
    "initial_project_title_en" TEXT,
    "source_type" "SourceType" NOT NULL,
    "source_detail" TEXT,
    "reason_for_topic" TEXT NOT NULL,
    "expected_math_area" TEXT NOT NULL,
    "tentative_advisor_id" TEXT,
    "consultation_summary" TEXT NOT NULL,
    "initial_references" TEXT NOT NULL,
    "material_link" TEXT NOT NULL,
    "declaration_accepted" BOOLEAN NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_origins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_origin_versions" (
    "id" TEXT NOT NULL,
    "project_origin_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "saved_by_user_id" TEXT NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_origin_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_rounds" (
    "id" TEXT NOT NULL,
    "course_offering_id" TEXT NOT NULL,
    "round_type" "AssessmentRoundType" NOT NULL,
    "name" TEXT NOT NULL,
    "course_weight" DECIMAL(5,2) NOT NULL,
    "raw_score_max" INTEGER NOT NULL DEFAULT 100,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "submission_open_at" TIMESTAMP(3),
    "submission_deadline" TIMESTAMP(3),
    "scoring_deadline" TIMESTAMP(3),
    "show_score_to_student" BOOLEAN NOT NULL DEFAULT false,
    "show_feedback_to_student" BOOLEAN NOT NULL DEFAULT false,
    "show_evaluator_name_to_student" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_attempts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "assessment_round_id" TEXT NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "attempt_type" "AttemptType" NOT NULL,
    "previous_attempt_id" TEXT,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "is_official_score" BOOLEAN NOT NULL DEFAULT false,
    "official_score" DECIMAL(5,2),
    "final_decision" "Decision",
    "final_decision_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "assessment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentation_submissions" (
    "id" TEXT NOT NULL,
    "assessment_attempt_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "title_th" TEXT NOT NULL,
    "title_en" TEXT,
    "abstract_text" TEXT NOT NULL,
    "content_json" JSONB NOT NULL,
    "material_link" TEXT NOT NULL,
    "declaration_accepted" BOOLEAN NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentation_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentation_submission_versions" (
    "id" TEXT NOT NULL,
    "presentation_submission_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "saved_by_user_id" TEXT NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presentation_submission_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubrics" (
    "id" TEXT NOT NULL,
    "round_type" "AssessmentRoundType" NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_items" (
    "id" TEXT NOT NULL,
    "rubric_id" TEXT NOT NULL,
    "group_key" TEXT NOT NULL,
    "group_label_th" TEXT NOT NULL,
    "item_key" TEXT NOT NULL,
    "item_label_th" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "display_order" INTEGER NOT NULL,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "evidence_hint" TEXT,

    CONSTRAINT "rubric_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluator_assignments" (
    "id" TEXT NOT NULL,
    "assessment_attempt_id" TEXT NOT NULL,
    "evaluator_user_id" TEXT NOT NULL,
    "teacher_id" TEXT,
    "evaluator_display_name_snapshot" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluator_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_submissions" (
    "id" TEXT NOT NULL,
    "evaluator_assignment_id" TEXT NOT NULL,
    "total_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "overall_comment" TEXT,
    "status" "ScoreStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),

    CONSTRAINT "score_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_items" (
    "id" TEXT NOT NULL,
    "score_submission_id" TEXT NOT NULL,
    "rubric_item_id" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "points_awarded" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT,

    CONSTRAINT "score_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_evaluator_decisions" (
    "id" TEXT NOT NULL,
    "score_submission_id" TEXT NOT NULL,
    "decision" "Decision" NOT NULL,
    "reason" TEXT,

    CONSTRAINT "proposal_evaluator_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_proposal_results" (
    "id" TEXT NOT NULL,
    "assessment_attempt_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "average_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "submitted_count" INTEGER NOT NULL DEFAULT 0,
    "missing_count" INTEGER NOT NULL DEFAULT 0,
    "pass_count" INTEGER NOT NULL DEFAULT 0,
    "revision_count" INTEGER NOT NULL DEFAULT 0,
    "not_pass_count" INTEGER NOT NULL DEFAULT 0,
    "final_decision" "Decision" NOT NULL,
    "final_decision_reason" TEXT,
    "decided_by_admin_id" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_proposal_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_releases" (
    "id" TEXT NOT NULL,
    "assessment_attempt_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "show_score" BOOLEAN NOT NULL DEFAULT false,
    "show_feedback" BOOLEAN NOT NULL DEFAULT true,
    "released_by_admin_id" TEXT NOT NULL,
    "released_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_timeline_events" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_title" TEXT NOT NULL,
    "event_description" TEXT,
    "actor_user_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "metadata_json" JSONB,

    CONSTRAINT "project_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata_json" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_student_code_key" ON "students"("student_code");

-- CreateIndex
CREATE UNIQUE INDEX "students_generated_email_key" ON "students"("generated_email");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_user_id_key" ON "teachers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_email_key" ON "teachers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_academic_prefix_first_name_th_last_name_th_key" ON "teachers"("academic_prefix", "first_name_th", "last_name_th");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_account_claims_teacher_id_user_id_key" ON "teacher_account_claims"("teacher_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_year_be_key" ON "academic_years"("year_be");

-- CreateIndex
CREATE UNIQUE INDEX "terms_academic_year_id_term_type_key" ON "terms"("academic_year_id", "term_type");

-- CreateIndex
CREATE UNIQUE INDEX "projects_course_offering_id_student_id_key" ON "projects"("course_offering_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_origins_project_id_key" ON "project_origins"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_origin_versions_project_origin_id_version_no_key" ON "project_origin_versions"("project_origin_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_rounds_course_offering_id_round_type_name_key" ON "assessment_rounds"("course_offering_id", "round_type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_attempts_project_id_assessment_round_id_attempt__key" ON "assessment_attempts"("project_id", "assessment_round_id", "attempt_no");

-- CreateIndex
CREATE UNIQUE INDEX "presentation_submissions_assessment_attempt_id_key" ON "presentation_submissions"("assessment_attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "presentation_submission_versions_presentation_submission_id_key" ON "presentation_submission_versions"("presentation_submission_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "rubrics_round_type_version_key" ON "rubrics"("round_type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "rubric_items_rubric_id_item_key_key" ON "rubric_items"("rubric_id", "item_key");

-- CreateIndex
CREATE UNIQUE INDEX "evaluator_assignments_assessment_attempt_id_evaluator_user__key" ON "evaluator_assignments"("assessment_attempt_id", "evaluator_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "score_submissions_evaluator_assignment_id_key" ON "score_submissions"("evaluator_assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "score_items_score_submission_id_rubric_item_id_key" ON "score_items"("score_submission_id", "rubric_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_evaluator_decisions_score_submission_id_key" ON "proposal_evaluator_decisions"("score_submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_proposal_results_assessment_attempt_id_key" ON "project_proposal_results"("assessment_attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "score_releases_assessment_attempt_id_key" ON "score_releases"("assessment_attempt_id");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_account_claims" ADD CONSTRAINT "teacher_account_claims_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_account_claims" ADD CONSTRAINT "teacher_account_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_account_claims" ADD CONSTRAINT "teacher_account_claims_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_course_offering_id_fkey" FOREIGN KEY ("course_offering_id") REFERENCES "course_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_origins" ADD CONSTRAINT "project_origins_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_origins" ADD CONSTRAINT "project_origins_tentative_advisor_id_fkey" FOREIGN KEY ("tentative_advisor_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_origin_versions" ADD CONSTRAINT "project_origin_versions_project_origin_id_fkey" FOREIGN KEY ("project_origin_id") REFERENCES "project_origins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_origin_versions" ADD CONSTRAINT "project_origin_versions_saved_by_user_id_fkey" FOREIGN KEY ("saved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_rounds" ADD CONSTRAINT "assessment_rounds_course_offering_id_fkey" FOREIGN KEY ("course_offering_id") REFERENCES "course_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessment_round_id_fkey" FOREIGN KEY ("assessment_round_id") REFERENCES "assessment_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_previous_attempt_id_fkey" FOREIGN KEY ("previous_attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_submissions" ADD CONSTRAINT "presentation_submissions_assessment_attempt_id_fkey" FOREIGN KEY ("assessment_attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_submissions" ADD CONSTRAINT "presentation_submissions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_submissions" ADD CONSTRAINT "presentation_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_submission_versions" ADD CONSTRAINT "presentation_submission_versions_presentation_submission_i_fkey" FOREIGN KEY ("presentation_submission_id") REFERENCES "presentation_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentation_submission_versions" ADD CONSTRAINT "presentation_submission_versions_saved_by_user_id_fkey" FOREIGN KEY ("saved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_items" ADD CONSTRAINT "rubric_items_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_assignments" ADD CONSTRAINT "evaluator_assignments_assessment_attempt_id_fkey" FOREIGN KEY ("assessment_attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_assignments" ADD CONSTRAINT "evaluator_assignments_evaluator_user_id_fkey" FOREIGN KEY ("evaluator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_assignments" ADD CONSTRAINT "evaluator_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_submissions" ADD CONSTRAINT "score_submissions_evaluator_assignment_id_fkey" FOREIGN KEY ("evaluator_assignment_id") REFERENCES "evaluator_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_items" ADD CONSTRAINT "score_items_score_submission_id_fkey" FOREIGN KEY ("score_submission_id") REFERENCES "score_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_items" ADD CONSTRAINT "score_items_rubric_item_id_fkey" FOREIGN KEY ("rubric_item_id") REFERENCES "rubric_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_evaluator_decisions" ADD CONSTRAINT "proposal_evaluator_decisions_score_submission_id_fkey" FOREIGN KEY ("score_submission_id") REFERENCES "score_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_proposal_results" ADD CONSTRAINT "project_proposal_results_assessment_attempt_id_fkey" FOREIGN KEY ("assessment_attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_proposal_results" ADD CONSTRAINT "project_proposal_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_proposal_results" ADD CONSTRAINT "project_proposal_results_decided_by_admin_id_fkey" FOREIGN KEY ("decided_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_releases" ADD CONSTRAINT "score_releases_assessment_attempt_id_fkey" FOREIGN KEY ("assessment_attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_releases" ADD CONSTRAINT "score_releases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_releases" ADD CONSTRAINT "score_releases_released_by_admin_id_fkey" FOREIGN KEY ("released_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_timeline_events" ADD CONSTRAINT "project_timeline_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_timeline_events" ADD CONSTRAINT "project_timeline_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
