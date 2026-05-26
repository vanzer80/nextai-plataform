-- Fix: corrige 2 RPCs com colunas que não existem nas tabelas reais
-- 1. platform_get_all_reimbursement_history: from_status→old_status, to_status→new_status, comment→reason
-- 2. platform_get_all_client_locations: label→nome, address→logradouro, city→cidade, remove lat/lng

CREATE OR REPLACE FUNCTION public.platform_get_all_reimbursement_history(
  p_tenant_id uuid DEFAULT NULL,
  p_limit     int  DEFAULT 200,
  p_offset    int  DEFAULT 0
)
RETURNS SETOF json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_master() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY SELECT row_to_json(r) FROM (
    SELECT h.id, h.reimbursement_id, h.old_status, h.new_status, h.reason, h.created_at
    FROM public.reimbursement_history h
    WHERE (p_tenant_id IS NULL OR h.reimbursement_id IN (
      SELECT id FROM public.reimbursements WHERE team_id = p_tenant_id
    ))
    ORDER BY h.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_reimbursement_history(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.platform_get_all_reimbursement_history(uuid, int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_get_all_client_locations(
  p_tenant_id uuid DEFAULT NULL,
  p_limit     int  DEFAULT 200,
  p_offset    int  DEFAULT 0
)
RETURNS SETOF json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_master() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY SELECT row_to_json(r) FROM (
    SELECT l.id, l.client_id, l.nome, l.logradouro, l.cidade, l.estado, l.created_at
    FROM public.client_locations l
    WHERE (p_tenant_id IS NULL OR l.client_id IN (
      SELECT id FROM public.clients WHERE team_id = p_tenant_id
    ))
    ORDER BY l.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_client_locations(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.platform_get_all_client_locations(uuid, int, int) TO authenticated;
