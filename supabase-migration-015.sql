-- Migration 015: Scope storage.objects policies to tenant boundaries
--
-- job_photos_delete and the company_banners insert/update/delete policies
-- previously only checked `auth.uid() IS NOT NULL`, with no company scoping.
-- That let any authenticated user in ANY company delete another company's
-- job photos, or upload/overwrite another company's dashboard banner
-- directly against Supabase storage (bypassing the admin-only check in
-- /api/company/banner/route.ts, which only guards the API route, not the
-- bucket itself).
--
-- company-banners paths are `${company_id}/banner.ext`, so they can be
-- scoped by folder. job-photos paths are `${entry.id}/...` with no
-- company_id segment, so delete is scoped via the auto-populated
-- storage.objects.owner column (the uploader's auth.uid()) joined back to
-- profiles to confirm same-company membership.

DROP POLICY IF EXISTS "job_photos_delete" ON storage.objects;
CREATE POLICY "job_photos_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'job-photos'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = storage.objects.owner
        AND p.company_id = get_my_company_id()
    )
  );

DROP POLICY IF EXISTS "company_banners_insert" ON storage.objects;
CREATE POLICY "company_banners_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'company-banners'
    AND get_my_role() = 'admin'
    AND (storage.foldername(name))[1] = get_my_company_id()::text
  );

DROP POLICY IF EXISTS "company_banners_delete" ON storage.objects;
CREATE POLICY "company_banners_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'company-banners'
    AND get_my_role() = 'admin'
    AND (storage.foldername(name))[1] = get_my_company_id()::text
  );
