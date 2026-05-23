-- Migration: security_revoke_internal_functions
-- Reduz a superfície de ataque removendo acesso REST a funções internas/trigger.
-- Auditoria via Supabase Advisors identificou estas funções expostas desnecessariamente.

-- Trigger functions e funções de manutenção não devem ser chamáveis via REST
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

-- Helpers de RLS: anon não tem JWT, nunca precisam ser chamáveis sem autenticação
-- authenticated mantém grant explícito (necessário para RLS policies funcionarem)
REVOKE EXECUTE ON FUNCTION public.get_auth_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_caller_team_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_platform_master() FROM PUBLIC;

-- Estado final esperado das ACLs:
-- get_auth_role / get_caller_team_id / is_platform_master:
--   postgres=X, authenticated=X, service_role=X  (anon removido)
-- prevent_tenant_slug_change / handle_new_user / rls_auto_enable:
--   postgres=X, service_role=X  (anon e authenticated removidos)
