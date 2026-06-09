-- Migration: fix_rpc_anon_revoke
-- REVOKE FROM PUBLIC não remove grants explícitos de anon (armadilha documentada no CLAUDE.md).
-- Revogar de anon explicitamente para as RPCs SECURITY DEFINER criadas nesta sessão.
REVOKE EXECUTE ON FUNCTION public.get_platform_tenants() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_tenant_commercial(uuid, text, text, text, boolean, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) FROM anon;
