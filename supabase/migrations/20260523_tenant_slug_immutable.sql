-- Migration: tenant_slug_immutable
-- O slug do tenant é usado como prefixo de pasta no storage (tenant-logos/).
-- Alterá-lo após criação quebraria o isolamento de arquivos entre tenants.

CREATE OR REPLACE FUNCTION public.prevent_tenant_slug_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.slug IS DISTINCT FROM NEW.slug THEN
    RAISE EXCEPTION 'tenant slug is immutable after creation (old=%, attempted=%)', OLD.slug, NEW.slug
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_slug_immutable ON public.tenants;

CREATE TRIGGER trg_tenant_slug_immutable
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tenant_slug_change();

COMMENT ON FUNCTION public.prevent_tenant_slug_change() IS
  'Slug do tenant é imutável pós-criação: é usado como prefixo de pasta no storage. Alterá-lo quebraria o isolamento de arquivos entre tenants.';

-- Revogar acesso direto via REST (trigger function não deve ser chamável diretamente)
REVOKE EXECUTE ON FUNCTION public.prevent_tenant_slug_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_tenant_slug_change() FROM anon, authenticated;
