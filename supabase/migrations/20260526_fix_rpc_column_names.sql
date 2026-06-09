-- Fix: corrige 3 RPCs com colunas que não existem nas tabelas reais
-- 1. platform_get_all_reports: total_minutes não existe em service_reports
-- 2. platform_get_all_materials: quantidade não existe (coluna real: quantity)
-- 3. platform_get_all_notifications: type não existe em notifications

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
           priority, created_at, updated_at
    FROM public.service_reports
    WHERE (p_tenant_id IS NULL OR team_id = p_tenant_id)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_reports(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.platform_get_all_reports(uuid, int, int) TO authenticated;

-- ── 2. material_requests ──────────────────────────────────────────────────────

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
           especificacao_tecnica, quantity, prazo, urgency,
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

-- ── 3. notifications ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.platform_get_all_notifications(
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
    SELECT id, team_id, user_id, title, message, is_read, created_at
    FROM public.notifications
    WHERE (p_tenant_id IS NULL OR team_id = p_tenant_id)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_notifications(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.platform_get_all_notifications(uuid, int, int) TO authenticated;
