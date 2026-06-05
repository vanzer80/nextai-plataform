-- Supabase advisor: rls_enabled_no_policy on ai_routing_log
-- Telemetry table: only platform masters may read; Edge Function writes via service_role (bypasses RLS).

CREATE POLICY "ai_routing_log_platform_master_select"
  ON public.ai_routing_log
  FOR SELECT
  USING (public.is_platform_master());

-- Deny all writes from the API layer — data comes exclusively from the ai-proxy Edge Function via service_role.
CREATE POLICY "ai_routing_log_deny_api_write"
  ON public.ai_routing_log
  FOR INSERT
  WITH CHECK (false);
