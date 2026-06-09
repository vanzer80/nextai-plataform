-- Drop policy that allows anonymous listing of ALL tenant assets.
-- Supabase advisor: public_bucket_allows_listing (WARN)
DROP POLICY IF EXISTS "tenant_assets_public_select" ON storage.objects;

-- Authenticated users can only read their own team's folder.
-- Files are structured as tenant-assets/{team_id}/filename.
-- The bucket remains public for direct URL access (logos in PDFs, login page branding),
-- but API-level listing and download is now scoped per-team.
CREATE POLICY "tenant_assets_team_select"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'tenant-assets' AND (
      public.is_platform_master()
      OR (
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = (
          SELECT (team_id)::text FROM public.users WHERE id = auth.uid()
        )
      )
    )
  );
