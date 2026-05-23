-- Migration: platform_tenants_rpc
-- RPC SECURITY DEFINER que retorna lista completa de tenants com dados do admin Master.
-- Necessário porque RLS em `users` (team_id = get_caller_team_id()) impede platform master
-- de ler usuários de outros tenants via query direta. A RPC bypassa isso com SECURITY DEFINER
-- e verifica internamente que apenas SuperMasters podem chamar.

CREATE OR REPLACE FUNCTION public.get_platform_tenants()
RETURNS TABLE(
  id            uuid,
  name          text,
  slug          text,
  primary_color text,
  logo_url      text,
  is_active     boolean,
  is_platform   boolean,
  created_at    timestamptz,
  cnpj          text,
  phone         text,
  website       text,
  sector        text,
  user_count    bigint,
  master_name   text,
  master_email  text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_master() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
    SELECT
      t.id,
      t.name,
      t.slug,
      t.primary_color,
      t.logo_url,
      t.is_active,
      t.is_platform,
      t.created_at,
      t.cnpj,
      t.phone,
      t.website,
      t.sector,
      (SELECT COUNT(*) FROM public.users u  WHERE u.team_id = t.id)::bigint AS user_count,
      (SELECT u2.full_name FROM public.users u2
         WHERE u2.team_id = t.id AND u2.role = 'Master' LIMIT 1) AS master_name,
      (SELECT au.email::text FROM public.users u3
         JOIN auth.users au ON au.id = u3.id
         WHERE u3.team_id = t.id AND u3.role = 'Master' LIMIT 1) AS master_email
    FROM public.tenants t
    ORDER BY t.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_platform_tenants() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_platform_tenants() TO authenticated;
