-- =============================================================
-- TallyCrew — Security Patch Migration
-- Run this in Supabase → SQL Editor on your EXISTING database.
-- (supabase-schema.sql already has these fixes for fresh setups.)
-- =============================================================


-- -------------------------------------------------------------
-- FIX 1 (CRITICAL): profiles_update — prevent role escalation
--   Old policy had no WITH CHECK, so a worker could set
--   role = 'admin' on their own row.
-- -------------------------------------------------------------
DROP POLICY IF EXISTS profiles_update ON profiles;

CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = get_my_role()
    AND company_id = get_my_company_id()
  );


-- -------------------------------------------------------------
-- FIX 2 (HIGH): log_entry_types UPDATE — add WITH CHECK
--   Without it an admin could change company_id, moving a row
--   to a different tenant.
-- -------------------------------------------------------------
DROP POLICY IF EXISTS log_types_admin_update ON log_entry_types;

CREATE POLICY log_types_admin_update ON log_entry_types FOR UPDATE
  USING  (company_id = get_my_company_id() AND get_my_role() = 'admin')
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'admin');


-- -------------------------------------------------------------
-- FIX 3 (HIGH): submissions UPDATE — add WITH CHECK
--   Without it a user could change company_id or user_id.
-- -------------------------------------------------------------
DROP POLICY IF EXISTS submissions_update ON submissions;

CREATE POLICY submissions_update ON submissions FOR UPDATE
  USING (
    company_id = get_my_company_id() AND (
      get_my_role() = 'admin' OR user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = get_my_company_id() AND (
      get_my_role() = 'admin' OR user_id = auth.uid()
    )
  );


-- -------------------------------------------------------------
-- FIX 4 (HIGH): storage — require auth for INSERT and DELETE
--   Old policies allowed unauthenticated uploads and deletes.
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "job_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "job_photos_delete" ON storage.objects;

CREATE POLICY "job_photos_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "job_photos_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);
