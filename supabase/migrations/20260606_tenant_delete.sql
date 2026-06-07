-- Migration: tenant_delete
-- Soft delete (deleted_at), tabela de auditoria, RPCs para deletar/restaurar tenants.
-- Hard delete via Edge Function admin-delete-tenant.

-- ─── 1. Coluna soft-delete ────────────────────────────────────────────────────
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ─── 2. Tabela de auditoria ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_deletion_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID,                                               -- sem FK: preserva histórico após hard delete
  tenant_slug TEXT        NOT NULL,
  tenant_name TEXT        NOT NULL,
  operation   TEXT        NOT NULL CHECK (operation IN ('soft', 'hard', 'restore')),
  deleted_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_count  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_deletion_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_deletion_log_supermaster_read" ON public.tenant_deletion_log;
CREATE POLICY "tenant_deletion_log_supermaster_read"
  ON public.tenant_deletion_log
  FOR SELECT
  USING (public.is_platform_master());

-- ─── 3. Recriar get_platform_tenants (armadilha #50: DROP + CREATE) ──────────
DROP FUNCTION IF EXISTS public.get_platform_tenants();
DROP FUNCTION IF EXISTS public.get_platform_tenants(boolean);

CREATE FUNCTION public.get_platform_tenants(p_include_deleted boolean DEFAULT false)
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
  master_email         text,
  deleted_at           timestamptz
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
      (SELECT COUNT(*) FROM public.users u  WHERE u.team_id = t.id)::bigint,
      (SELECT u2.full_name FROM public.users u2
         WHERE u2.team_id = t.id AND u2.role = 'Master' LIMIT 1),
      (SELECT au.email::text FROM public.users u3
         JOIN auth.users au ON au.id = u3.id
         WHERE u3.team_id = t.id AND u3.role = 'Master' LIMIT 1),
      t.deleted_at
    FROM public.tenants t
    WHERE (p_include_deleted OR t.deleted_at IS NULL)
    ORDER BY t.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_platform_tenants(boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_platform_tenants(boolean) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_platform_tenants(boolean) TO authenticated;

-- ─── 4. soft_delete_tenant ────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.soft_delete_tenant(uuid);

CREATE FUNCTION public.soft_delete_tenant(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant     RECORD;
  v_user_count INTEGER;
BEGIN
  IF NOT is_platform_master() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id, slug, name, is_platform, deleted_at
    INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant não encontrado' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_tenant.is_platform THEN
    RAISE EXCEPTION 'Não é possível remover o tenant da plataforma' USING ERRCODE = 'check_violation';
  END IF;

  IF v_tenant.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Tenant já está removido' USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*)::integer INTO v_user_count FROM public.users WHERE team_id = p_tenant_id;

  UPDATE public.tenants SET deleted_at = now() WHERE id = p_tenant_id;

  INSERT INTO public.tenant_deletion_log(tenant_id, tenant_slug, tenant_name, operation, deleted_by, user_count)
  VALUES (p_tenant_id, v_tenant.slug, v_tenant.name, 'soft', auth.uid(), v_user_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_tenant(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.soft_delete_tenant(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.soft_delete_tenant(uuid) TO authenticated;

-- ─── 5. restore_tenant ────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.restore_tenant(uuid);

CREATE FUNCTION public.restore_tenant(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant     RECORD;
  v_user_count INTEGER;
BEGIN
  IF NOT is_platform_master() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id, slug, name, is_platform, deleted_at
    INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant não encontrado' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_tenant.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Tenant não está removido' USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*)::integer INTO v_user_count FROM public.users WHERE team_id = p_tenant_id;

  UPDATE public.tenants SET deleted_at = NULL WHERE id = p_tenant_id;

  INSERT INTO public.tenant_deletion_log(tenant_id, tenant_slug, tenant_name, operation, deleted_by, user_count)
  VALUES (p_tenant_id, v_tenant.slug, v_tenant.name, 'restore', auth.uid(), v_user_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restore_tenant(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_tenant(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.restore_tenant(uuid) TO authenticated;
