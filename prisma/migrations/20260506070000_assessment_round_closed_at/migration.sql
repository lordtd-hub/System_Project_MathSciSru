-- Add explicit round closure audit fields.
ALTER TABLE "assessment_rounds"
ADD COLUMN "closed_at" TIMESTAMP(3),
ADD COLUMN "closed_by_admin_id" TEXT;

ALTER TABLE "assessment_rounds"
ADD CONSTRAINT "assessment_rounds_closed_by_admin_id_fkey"
FOREIGN KEY ("closed_by_admin_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
