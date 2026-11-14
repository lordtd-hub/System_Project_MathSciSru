BEGIN;
-- CreateEnum
CREATE TYPE "IncompleteStatus" AS ENUM ('INCOMPLETE', 'RESOLVED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "IncompletePenaltyDecision" AS ENUM ('PRESERVE_EXISTING', 'NO_ADDITIONAL_PENALTY');

-- AlterTable
ALTER TABLE "course_offerings" ADD COLUMN     "course_code" TEXT,
ADD COLUMN     "section" TEXT;

-- CreateTable
CREATE TABLE "project_academic_results" (
    "project_id" TEXT NOT NULL,
    "status" "IncompleteStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "original_grade" TEXT NOT NULL DEFAULT 'I',
    "resolution_grade" TEXT,
    "resolution_reason" TEXT,
    "resolution_reference" TEXT,
    "reason" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),

    CONSTRAINT "project_academic_results_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "incomplete_continuations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "assessment_round_id" TEXT NOT NULL,
    "penalty_decision" "IncompletePenaltyDecision" NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "approved_by_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "incomplete_continuations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "incomplete_continuations_project_id_assessment_round_id_key" ON "incomplete_continuations"("project_id", "assessment_round_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_offerings_term_id_course_code_section_key" ON "course_offerings"("term_id", "course_code", "section");

-- AddForeignKey
ALTER TABLE "project_academic_results" ADD CONSTRAINT "project_academic_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incomplete_continuations" ADD CONSTRAINT "incomplete_continuations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project_academic_results"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incomplete_continuations" ADD CONSTRAINT "incomplete_continuations_assessment_round_id_fkey" FOREIGN KEY ("assessment_round_id") REFERENCES "assessment_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Server-only academic outcomes. Preserve existing table grants/defaults unchanged.
ALTER TABLE "project_academic_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incomplete_continuations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "project_academic_results", "incomplete_continuations" FROM PUBLIC;
DO $privacy$
DECLARE client_role text; object_name text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=client_role) THEN
      FOREACH object_name IN ARRAY ARRAY['project_academic_results','incomplete_continuations'] LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',object_name,client_role);
        IF has_table_privilege(client_role,'public.'||object_name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_any_column_privilege(client_role,'public.'||object_name,'SELECT,INSERT,UPDATE,REFERENCES') THEN
          RAISE EXCEPTION 'Unexpected inherited browser privileges on new academic table; stop for review';
        END IF;
        IF current_setting('server_version_num')::integer >= 170000 THEN
          IF has_table_privilege(client_role,'public.'||object_name,'MAINTAIN') THEN
            RAISE EXCEPTION 'Unexpected inherited browser maintenance privilege on new academic table; stop for review';
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$privacy$;
ALTER TABLE "project_academic_results"
  ADD CONSTRAINT "academic_result_valid_version" CHECK (version >= 1),
  ADD CONSTRAINT "academic_result_explicit_grade" CHECK (original_grade IN ('I','E')),
  ADD CONSTRAINT "academic_result_state_pair" CHECK (
    (status='INCOMPLETE' AND original_grade='I' AND resolution_grade IS NULL AND resolved_at IS NULL AND resolution_reason IS NULL AND resolution_reference IS NULL)
    OR (status='FINALIZED' AND original_grade='E' AND resolution_grade IS NULL AND resolved_at IS NULL AND resolution_reason IS NULL AND resolution_reference IS NULL)
    OR (status='RESOLVED' AND original_grade='I' AND resolution_grade IS NOT NULL AND resolution_grade IN ('A','B+','B','C+','C','D+','D','E','S','U') AND resolved_at IS NOT NULL AND resolution_reason IS NOT NULL AND resolution_reference IS NOT NULL AND version >= 2)
  );
ALTER TABLE "incomplete_continuations"
  ADD CONSTRAINT "incomplete_continuation_state_pair" CHECK ((status='OPEN' AND resolved_at IS NULL) OR (status='RESOLVED' AND resolved_at IS NOT NULL));

COMMIT;
