-- Migration: update_tenant_commercial_rpc
-- 1. RPC SECURITY DEFINER para SuperMaster atualizar qualquer tenant (cross-tenant).
--    UPDATE direto é bloqueado silenciosamente pelo RLS — mesmo padrão de update_tenant_branding.
-- 2. Atualiza get_platform_tenants para retornar os novos campos de endereço e dados fiscais.

CREATE OR REPLACE FUNCTION public.update_tenant_commercial(
  p_tenant_id            uuid,
  p_name                 text,
  p_primary_color        text,
  p_logo_url             text     DEFAULT NULL,
  p_logo_removed         boolean  DEFAULT false,
  p_cnpj                 text     DEFAULT NULL,
  p_phone                text     DEFAULT NULL,
  p_website              text     DEFAULT NULL,
  p_sector               text     DEFAULT NULL,
  p_razao_social         text     DEFAULT NULL,
  p_ie                   text     DEFAULT NULL,
  p_email_contato        text     DEFAULT NULL,
  p_address_zip          text     DEFAULT NULL,
  p_address_street       text     DEFAULT NULL,
  p_address_number       text     DEFAULT NULL,
  p_address_complement   text     DEFAULT NULL,
  p_address_neighborhood text     DEFAULT NULL,
  p_address_city         text     DEFAULT NULL,
  p_address_state        text     DEFAULT NULL,
  p_address_country      text     DEFAULT NULL
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

  UPDATE public.tenants SET
    name                 = p_name,
    primary_color        = p_primary_color,
    logo_url             = CASE
                             WHEN p_logo_removed THEN NULL
                             WHEN p_logo_url IS NOT NULL THEN p_logo_url
                             ELSE logo_url
                           END,
    cnpj                 = p_cnpj,
    phone                = p_phone,
    website              = p_website,
    sector               = p_sector,
    razao_social         = p_razao_social,
    ie                   = p_ie,
    email_contato        = p_email_contato,
    address_zip          = p_address_zip,
    address_street       = p_address_street,
    address_number       = p_address_number,
    address_complement   = p_address_complement,
    address_neighborhood = p_address_neighborhood,
    address_city         = p_address_city,
    address_state        = p_address_state,
    address_country      = p_address_country
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant não encontrado: %', p_tenant_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_tenant_commercial FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_tenant_commercial FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_tenant_commercial TO authenticated;

-- Recriar get_platform_tenants com os novos campos (DROP necessário pois mudou o tipo de retorno)
DROP FUNCTION IF EXISTS public.get_platform_tenants();

CREATE FUNCTION public.get_platform_tenants()
RETURNS TABLE(
  id                   uuid,
  name                 text,
  slug                 text,
  primary_color        text,
  logo_url             text,
  is_active            boolean,
  is_platform          boolean,
  created_at           timestamptz,
  cnpj                 text,
  phone                text,
  website              text,
  sector               text,
  razao_social         text,
  ie                   text,
  email_contato        text,
  address_zip          text,
  address_street       text,
  address_number       text,
  address_complement   text,
  address_neighborhood text,
  address_city         text,
  address_state        text,
  address_country      text,
  user_count           bigint,
  master_name          text,
  master_email         text
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
      t.id, t.name, t.slug, t.primary_color, t.logo_url,
      t.is_active, t.is_platform, t.created_at,
      t.cnpj, t.phone, t.website, t.sector,
      t.razao_social, t.ie, t.email_contato,
      t.address_zip, t.address_street, t.address_number,
      t.address_complement, t.address_neighborhood,
      t.address_city, t.address_state, t.address_country,
      (SELECT COUNT(*) FROM public.users u WHERE u.team_id = t.id)::bigint,
      (SELECT u2.full_name FROM public.users u2
         WHERE u2.team_id = t.id AND u2.role = 'Master' LIMIT 1),
      (SELECT au.email::text FROM public.users u3
         JOIN auth.users au ON au.id = u3.id
         WHERE u3.team_id = t.id AND u3.role = 'Master' LIMIT 1)
    FROM public.tenants t
    ORDER BY t.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_platform_tenants() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_platform_tenants() FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_platform_tenants() TO authenticated;
