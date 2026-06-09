-- Migration: platform_raw_data_rpcs (Sessão 57 — parte 1)
-- 6 RPCs SECURITY DEFINER para acesso bruto cross-tenant pelo SuperMaster.
-- Cobertura: service_reports, reimbursements, clients, orcamentos, equipments, material_requests

-- ── 1. service_reports ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.platform_get_all_reports(
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
    SELECT id, team_id, os_number, service_type, status, technician_id, client_id,
           service_date, reported_problem, final_diagnosis, services_performed,
           total_minutes, priority, created_at, updated_at
    FROM public.service_reports
    WHERE (p_tenant_id IS NULL OR team_id = p_tenant_id)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_reports(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.platform_get_all_reports(uuid, int, int) TO authenticated;

-- ── 2. reimbursements ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.platform_get_all_reimbursements(
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
    SELECT id, team_id, category, amount, status, description,
           client_id, maintenance_type, branch, favorecido,
           created_at
    FROM public.reimbursements
    WHERE (p_tenant_id IS NULL OR team_id = p_tenant_id)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_reimbursements(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.platform_get_all_reimbursements(uuid, int, int) TO authenticated;

-- ── 3. clients ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.platform_get_all_clients(
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
    SELECT id, team_id, name, cnpj, cidade, estado,
           contato_nome, contato_telefone, contato_email, created_at
    FROM public.clients
    WHERE (p_tenant_id IS NULL OR team_id = p_tenant_id)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_clients(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.platform_get_all_clients(uuid, int, int) TO authenticated;

-- ── 4. orcamentos ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.platform_get_all_orcamentos(
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
    SELECT id, team_id, client_id, status, titulo, desconto_pct,
           validade, version, signed_at, created_at, updated_at
    FROM public.orcamentos
    WHERE (p_tenant_id IS NULL OR team_id = p_tenant_id)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_orcamentos(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.platform_get_all_orcamentos(uuid, int, int) TO authenticated;

-- ── 5. equipments ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.platform_get_all_equipments(
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
    SELECT id, team_id, client_id, name, type, status,
           manufacturer, model, serial_number, installation_date,
           warranty_until, maintenance_interval_days, last_maintenance_at,
           acquisition_cost, acquisition_date, useful_life_years, created_at
    FROM public.equipments
    WHERE (p_tenant_id IS NULL OR team_id = p_tenant_id)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_equipments(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.platform_get_all_equipments(uuid, int, int) TO authenticated;

-- ── 6. material_requests ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.platform_get_all_materials(
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
    SELECT id, team_id, request_number, maintenance_type, status,
           especificacao_tecnica, quantidade, prazo, urgency,
           client_id, created_at, updated_at
    FROM public.material_requests
    WHERE (p_tenant_id IS NULL OR team_id = p_tenant_id)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_materials(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.platform_get_all_materials(uuid, int, int) TO authenticated;
