-- Migration: platform_complete_access_rpcs (Sessão 57 — parte 2)
-- 7 RPCs SECURITY DEFINER para acesso a tabelas-filho e auxiliares cross-tenant.
-- Cobertura: report_checklist_items, report_attachments, report_status_history,
--            report_signatures, reimbursement_history, client_locations, notifications

-- ── 1. report_checklist_items ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.platform_get_all_checklist_items(
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
    SELECT c.id, c.report_id, c.label, c.item_type,
           c.value_boolean, c.value_text, c.value_number, c.value_option,
           c.is_conformant, c.created_at
    FROM public.report_checklist_items c
    WHERE (p_tenant_id IS NULL OR c.report_id IN (
      SELECT id FROM public.service_reports WHERE team_id = p_tenant_id
    ))
    ORDER BY c.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_checklist_items(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.platform_get_all_checklist_items(uuid, int, int) TO authenticated;

-- ── 2. report_attachments ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.platform_get_all_attachments(
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
    SELECT a.id, a.report_id, a.filename, a.mime_type, a.size_bytes, a.caption, a.created_at
    FROM public.report_attachments a
    WHERE (p_tenant_id IS NULL OR a.report_id IN (
      SELECT id FROM public.service_reports WHERE team_id = p_tenant_id
    ))
    ORDER BY a.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_attachments(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.platform_get_all_attachments(uuid, int, int) TO authenticated;

-- ── 3. report_status_history ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.platform_get_all_status_history(
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
    SELECT h.id, h.report_id, h.from_status, h.to_status, h.comment, h.created_at
    FROM public.report_status_history h
    WHERE (p_tenant_id IS NULL OR h.report_id IN (
      SELECT id FROM public.service_reports WHERE team_id = p_tenant_id
    ))
    ORDER BY h.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_status_history(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.platform_get_all_status_history(uuid, int, int) TO authenticated;

-- ── 4. report_signatures ──────────────────────────────────────────────────────
-- Exclui image_url (URL de Storage privada) por privacidade

CREATE OR REPLACE FUNCTION public.platform_get_all_signatures(
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
    SELECT s.id, s.report_id, s.signature_type, s.signer_name, s.signer_role, s.signed_at
    FROM public.report_signatures s
    WHERE (p_tenant_id IS NULL OR s.report_id IN (
      SELECT id FROM public.service_reports WHERE team_id = p_tenant_id
    ))
    ORDER BY s.signed_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_signatures(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.platform_get_all_signatures(uuid, int, int) TO authenticated;

-- ── 5. reimbursement_history ──────────────────────────────────────────────────

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
    SELECT h.id, h.reimbursement_id, h.from_status, h.to_status, h.comment, h.created_at
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

-- ── 6. client_locations ───────────────────────────────────────────────────────

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
    SELECT l.id, l.client_id, l.label, l.address, l.city, l.lat, l.lng, l.created_at
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

-- ── 7. notifications ──────────────────────────────────────────────────────────

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
    SELECT id, team_id, user_id, title, message, is_read, type, created_at
    FROM public.notifications
    WHERE (p_tenant_id IS NULL OR team_id = p_tenant_id)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_notifications(uuid, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.platform_get_all_notifications(uuid, int, int) TO authenticated;
