BEGIN;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.course_offerings WHERE status = 'ACTIVE') > 1 THEN
    RAISE EXCEPTION 'More than one ACTIVE offering exists; review and close explicitly before this migration';
  END IF;
END $$;
CREATE UNIQUE INDEX course_offerings_single_active
  ON public.course_offerings ((1)) WHERE status = 'ACTIVE';
COMMIT;
