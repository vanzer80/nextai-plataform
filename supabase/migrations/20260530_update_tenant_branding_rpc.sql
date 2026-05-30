-- Migration: update_tenant_branding_rpc
-- Corrige bug: edição de branding de tenant (nome / cor primária / logo) não persistia.
-- Causa: UPDATE direto em public.tenants é bloqueado por RLS quando o platform admin
-- (SuperMaster) edita OUTRO tenant — 0 linhas afetadas e o PostgREST não retorna erro
-- (falha silenciosa: o toast de sucesso aparece, mas nada muda no banco).
-- Mesma razão pela qual get_platform_tenants() existe como SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.update_tenant_branding(
  p_tenant_id     uuid,
  p_name          text,
  p_primary_color text,
  p_logo_url      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_master() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- p_logo_url NULL = nenhuma troca de logo nesta edição: mantém o atual.
  UPDATE public.tenants
  SET name          = p_name,
      primary_color = p_primary_color,
      logo_url      = COALESCE(p_logo_url, logo_url)
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant não encontrado: %', p_tenant_id;
  END IF;
END;
$$;

-- Em Supabase, REVOKE FROM PUBLIC não remove os grants explícitos por role.
-- É necessário revogar explicitamente de `anon`.
REVOKE EXECUTE ON FUNCTION public.update_tenant_branding(uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_tenant_branding(uuid, text, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_tenant_branding(uuid, text, text, text) TO authenticated;
