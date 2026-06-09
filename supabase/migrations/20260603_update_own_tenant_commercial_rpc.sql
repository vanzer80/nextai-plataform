-- Migration: update_own_tenant_commercial_rpc
-- RPC para o Master/Admin da empresa atualizar os próprios dados comerciais/fiscais/endereço.
-- Motivação: tabela tenants não tem policy UPDATE para usuário comum (apenas SuperMaster).
-- UPDATE direto falharia silenciosamente (0 rows, sem erro). RPC SECURITY DEFINER é o padrão correto.
-- Restrição de design: apenas campos comerciais são atualizáveis — nunca name, slug,
-- primary_color, logo_url, is_platform, is_active (campos de identidade e controle da plataforma).

CREATE OR REPLACE FUNCTION public.update_own_tenant_commercial(
  p_razao_social         text     DEFAULT NULL,
  p_cnpj                 text     DEFAULT NULL,
  p_ie                   text     DEFAULT NULL,
  p_email_contato        text     DEFAULT NULL,
  p_phone                text     DEFAULT NULL,
  p_website              text     DEFAULT NULL,
  p_sector               text     DEFAULT NULL,
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
DECLARE
  v_team_id uuid;
BEGIN
  SELECT team_id INTO v_team_id
  FROM public.users
  WHERE id = auth.uid();

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem tenant associado' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.tenants SET
    razao_social         = p_razao_social,
    cnpj                 = p_cnpj,
    ie                   = p_ie,
    email_contato        = p_email_contato,
    phone                = p_phone,
    website              = p_website,
    sector               = p_sector,
    address_zip          = p_address_zip,
    address_street       = p_address_street,
    address_number       = p_address_number,
    address_complement   = p_address_complement,
    address_neighborhood = p_address_neighborhood,
    address_city         = p_address_city,
    address_state        = p_address_state,
    address_country      = p_address_country
  WHERE id = v_team_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant não encontrado' USING ERRCODE = 'not_found';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_own_tenant_commercial FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_own_tenant_commercial FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_own_tenant_commercial TO authenticated;
