-- LOCAL REHEARSAL ONLY. Production rollback retains all outcome/history data.
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.project_academic_results)
     OR EXISTS (SELECT 1 FROM public.incomplete_continuations)
     OR EXISTS (SELECT 1 FROM public.course_offerings WHERE course_code IS NOT NULL OR section IS NOT NULL) THEN
    RAISE EXCEPTION 'Refusing schema reversal: academic/cohort data exists; retain schema and history';
  END IF;
END;
$guard$;
DROP TABLE public.incomplete_continuations;
DROP TABLE public.project_academic_results;
DROP INDEX public.course_offerings_term_id_course_code_section_key;
ALTER TABLE public.course_offerings DROP COLUMN course_code, DROP COLUMN section;
DROP TYPE public."IncompletePenaltyDecision";
DROP TYPE public."IncompleteStatus";
COMMIT;
