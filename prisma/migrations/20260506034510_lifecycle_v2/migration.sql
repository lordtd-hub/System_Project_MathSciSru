-- CreateEnum
CREATE TYPE "AdvisorRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProposalVoteDecision" AS ENUM ('PASS', 'REVISE', 'FAIL');

-- CreateEnum
CREATE TYPE "ScheduleProposalStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduleApprovalDecision" AS ENUM ('PENDING', 'APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "AssessmentSubmissionKind" AS ENUM ('PROGRESS_1', 'PROGRESS_2', 'FINAL_PRESENT');

-- CreateEnum
CREATE TYPE "ReportReviewDecision" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "AdvisorScoreStatus" AS ENUM ('LOCKED', 'DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CommitteeRole" ADD VALUE 'HEAD';
ALTER TYPE "CommitteeRole" ADD VALUE 'MEMBER';
ALTER TYPE "CommitteeRole" ADD VALUE 'EXTERNAL_MEMBER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProjectStatus" ADD VALUE 'STUDENT_PROFILE';
ALTER TYPE "ProjectStatus" ADD VALUE 'PENDING_ADVISOR';
ALTER TYPE "ProjectStatus" ADD VALUE 'PENDING_ADMIN';
ALTER TYPE "ProjectStatus" ADD VALUE 'PROPOSAL_PENDING';
ALTER TYPE "ProjectStatus" ADD VALUE 'PROPOSAL_REVIEW';
ALTER TYPE "ProjectStatus" ADD VALUE 'PROPOSAL_ADMIN_DECISION';
ALTER TYPE "ProjectStatus" ADD VALUE 'TOPIC_APPROVED';
ALTER TYPE "ProjectStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "ProjectStatus" ADD VALUE 'FINAL_DONE';
ALTER TYPE "ProjectStatus" ADD VALUE 'REPORT_REVIEW';
ALTER TYPE "ProjectStatus" ADD VALUE 'REPORT_APPROVED';
ALTER TYPE "ProjectStatus" ADD VALUE 'ADVISOR_SCORING';

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "phone" TEXT,
    "line_id" TEXT,
    "preferred_name" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_requests" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "advisor_teacher_id" TEXT NOT NULL,
    "status" "AdvisorRequestStatus" NOT NULL DEFAULT 'PENDING',
    "student_message" TEXT,
    "advisor_comment" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reminder_due_at" TIMESTAMP(3),

    CONSTRAINT "advisor_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_status_history" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "from_status" "ProjectStatus",
    "to_status" "ProjectStatus" NOT NULL,
    "reason" TEXT,
    "actor_user_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata_json" JSONB,

    CONSTRAINT "project_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_votes" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "assessment_attempt_id" TEXT,
    "teacher_id" TEXT NOT NULL,
    "vote" "ProposalVoteDecision" NOT NULL,
    "comment" TEXT,
    "visible_to_student" BOOLEAN NOT NULL DEFAULT true,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_assignments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "role" "CommitteeRole" NOT NULL,
    "appointed_by_user_id" TEXT,
    "appointed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "committee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_schedule_proposals" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "assessment_kind" "AssessmentSubmissionKind" NOT NULL,
    "proposed_start_at" TIMESTAMP(3) NOT NULL,
    "proposed_end_at" TIMESTAMP(3),
    "room" TEXT,
    "status" "ScheduleProposalStatus" NOT NULL DEFAULT 'PROPOSED',
    "proposed_by_student_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_schedule_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_schedule_approvals" (
    "id" TEXT NOT NULL,
    "schedule_proposal_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "decision" "ScheduleApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "exam_schedule_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_submissions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "kind" "AssessmentSubmissionKind" NOT NULL,
    "title" TEXT,
    "material_link" TEXT NOT NULL,
    "content_json" JSONB,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_versions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "drive_link" TEXT NOT NULL,
    "submitted_by_student_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_reviews" (
    "id" TEXT NOT NULL,
    "report_version_id" TEXT NOT NULL,
    "reviewer_teacher_id" TEXT NOT NULL,
    "decision" "ReportReviewDecision" NOT NULL,
    "comment" TEXT,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_scores" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "advisor_teacher_id" TEXT NOT NULL,
    "score" DECIMAL(5,2),
    "comment" TEXT,
    "status" "AdvisorScoreStatus" NOT NULL DEFAULT 'LOCKED',
    "unlocked_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "advisor_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "user_id" TEXT,
    "teacher_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "kind" TEXT NOT NULL,
    "email_ready" BOOLEAN NOT NULL DEFAULT false,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_student_id_key" ON "student_profiles"("student_id");

-- CreateIndex
CREATE INDEX "advisor_requests_project_id_status_idx" ON "advisor_requests"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_status_history_project_id_occurred_at_idx" ON "project_status_history"("project_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_votes_project_id_teacher_id_assessment_attempt_id_key" ON "proposal_votes"("project_id", "teacher_id", "assessment_attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "committee_assignments_project_id_teacher_id_role_key" ON "committee_assignments"("project_id", "teacher_id", "role");

-- CreateIndex
CREATE INDEX "exam_schedule_proposals_project_id_assessment_kind_status_idx" ON "exam_schedule_proposals"("project_id", "assessment_kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "exam_schedule_approvals_schedule_proposal_id_teacher_id_key" ON "exam_schedule_approvals"("schedule_proposal_id", "teacher_id");

-- CreateIndex
CREATE INDEX "assessment_submissions_project_id_kind_idx" ON "assessment_submissions"("project_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "report_versions_project_id_version_no_key" ON "report_versions"("project_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "report_reviews_report_version_id_reviewer_teacher_id_key" ON "report_reviews"("report_version_id", "reviewer_teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "advisor_scores_project_id_key" ON "advisor_scores"("project_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_status_idx" ON "notifications"("user_id", "status");

-- CreateIndex
CREATE INDEX "notifications_teacher_id_status_idx" ON "notifications"("teacher_id", "status");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_requests" ADD CONSTRAINT "advisor_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_requests" ADD CONSTRAINT "advisor_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_requests" ADD CONSTRAINT "advisor_requests_advisor_teacher_id_fkey" FOREIGN KEY ("advisor_teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_history" ADD CONSTRAINT "project_status_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_history" ADD CONSTRAINT "project_status_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_votes" ADD CONSTRAINT "proposal_votes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_votes" ADD CONSTRAINT "proposal_votes_assessment_attempt_id_fkey" FOREIGN KEY ("assessment_attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_votes" ADD CONSTRAINT "proposal_votes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_assignments" ADD CONSTRAINT "committee_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_assignments" ADD CONSTRAINT "committee_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_assignments" ADD CONSTRAINT "committee_assignments_appointed_by_user_id_fkey" FOREIGN KEY ("appointed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_schedule_proposals" ADD CONSTRAINT "exam_schedule_proposals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_schedule_proposals" ADD CONSTRAINT "exam_schedule_proposals_proposed_by_student_id_fkey" FOREIGN KEY ("proposed_by_student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_schedule_approvals" ADD CONSTRAINT "exam_schedule_approvals_schedule_proposal_id_fkey" FOREIGN KEY ("schedule_proposal_id") REFERENCES "exam_schedule_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_schedule_approvals" ADD CONSTRAINT "exam_schedule_approvals_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_submissions" ADD CONSTRAINT "assessment_submissions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_submissions" ADD CONSTRAINT "assessment_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_versions" ADD CONSTRAINT "report_versions_submitted_by_student_id_fkey" FOREIGN KEY ("submitted_by_student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_reviews" ADD CONSTRAINT "report_reviews_report_version_id_fkey" FOREIGN KEY ("report_version_id") REFERENCES "report_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_reviews" ADD CONSTRAINT "report_reviews_reviewer_teacher_id_fkey" FOREIGN KEY ("reviewer_teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_scores" ADD CONSTRAINT "advisor_scores_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_scores" ADD CONSTRAINT "advisor_scores_advisor_teacher_id_fkey" FOREIGN KEY ("advisor_teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
