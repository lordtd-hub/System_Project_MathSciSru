ALTER TABLE "exam_schedule_proposals" ADD COLUMN IF NOT EXISTS "course_offering_id" TEXT;
ALTER TABLE "exam_schedule_proposals" ADD COLUMN IF NOT EXISTS "assessment_round_id" TEXT;
ALTER TABLE "exam_schedule_proposals" ADD COLUMN IF NOT EXISTS "round_type" "AssessmentRoundType";
ALTER TABLE "exam_schedule_proposals" ADD COLUMN IF NOT EXISTS "note" TEXT;

UPDATE "exam_schedule_proposals" esp
SET "course_offering_id" = p."course_offering_id"
FROM "projects" p
WHERE esp."project_id" = p."id" AND esp."course_offering_id" IS NULL;

UPDATE "exam_schedule_proposals" esp
SET "round_type" = CASE
  WHEN esp."assessment_kind" = 'FINAL_PRESENT' THEN 'FINAL_PRESENTATION'::"AssessmentRoundType"
  ELSE esp."assessment_kind"::text::"AssessmentRoundType"
END
WHERE esp."round_type" IS NULL;

UPDATE "exam_schedule_proposals" esp
SET "assessment_round_id" = ar."id"
FROM "assessment_rounds" ar
WHERE esp."course_offering_id" = ar."course_offering_id"
  AND esp."round_type" = ar."round_type"
  AND esp."assessment_round_id" IS NULL;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "project_id", "assessment_round_id"
      ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
    ) AS rn
  FROM "exam_schedule_proposals"
  WHERE "assessment_round_id" IS NOT NULL
)
UPDATE "exam_schedule_proposals" esp
SET "assessment_round_id" = NULL
FROM ranked
WHERE esp."id" = ranked."id"
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "exam_schedule_proposals_project_id_assessment_round_id_key" ON "exam_schedule_proposals"("project_id", "assessment_round_id");
CREATE INDEX IF NOT EXISTS "exam_schedule_proposals_course_offering_id_round_type_status_idx" ON "exam_schedule_proposals"("course_offering_id", "round_type", "status");

ALTER TABLE "exam_schedule_proposals" ADD CONSTRAINT "exam_schedule_proposals_course_offering_id_fkey" FOREIGN KEY ("course_offering_id") REFERENCES "course_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exam_schedule_proposals" ADD CONSTRAINT "exam_schedule_proposals_assessment_round_id_fkey" FOREIGN KEY ("assessment_round_id") REFERENCES "assessment_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
