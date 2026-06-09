-- Migration: fix_rls_initplan_auth_role_sites_equipments
-- Objetivo: envolver auth.role() em (SELECT auth.role()) nas 2 policies de "authenticated can view"
-- Evidência: Supabase advisor auth_rls_initplan — sites e equipments usavam auth.role() raw
-- Regra absoluta: a ÚNICA mudança é o wrap. Lógica idêntica.
-- Rollback:
--   ALTER POLICY "Everyone authenticated can view sites" ON public.sites
--     USING ((auth.role() = 'authenticated'::text));
--   ALTER POLICY "Everyone authenticated can view equipments" ON public.equipments
--     USING ((auth.role() = 'authenticated'::text));

ALTER POLICY "Everyone authenticated can view sites" ON public.sites
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Everyone authenticated can view equipments" ON public.equipments
  USING (((SELECT auth.role()) = 'authenticated'::text));
