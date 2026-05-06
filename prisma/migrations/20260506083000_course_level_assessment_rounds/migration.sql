-- Course-level assessment rounds are opened once per course offering and round type.
DROP INDEX IF EXISTS "assessment_rounds_course_offering_id_round_type_name_key";
CREATE UNIQUE INDEX "assessment_rounds_course_offering_id_round_type_key" ON "assessment_rounds"("course_offering_id", "round_type");

CREATE TABLE "project_round_exceptions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "assessment_round_id" TEXT NOT NULL,
    "exception_type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "extended_deadline" TIMESTAMP(3),
    "reopened_at" TIMESTAMP(3),
    "reopened_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_round_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_round_exceptions_project_id_assessment_round_id_status_idx" ON "project_round_exceptions"("project_id", "assessment_round_id", "status");

ALTER TABLE "project_round_exceptions" ADD CONSTRAINT "project_round_exceptions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_round_exceptions" ADD CONSTRAINT "project_round_exceptions_assessment_round_id_fkey" FOREIGN KEY ("assessment_round_id") REFERENCES "assessment_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
