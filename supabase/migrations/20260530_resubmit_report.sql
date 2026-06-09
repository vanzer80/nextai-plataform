-- =============================================================================
-- Migration: resubmit_report
-- Propósito: permite ao técnico corrigir e reenviar uma OS devolvida (returned)
--   sem precisar criar uma nova OS — padrão ERP/SAP de ordem de correção.
-- Segurança:
--   - Apenas o técnico responsável pode reenviar
--   - Apenas OS em status 'returned' podem ser corrigidas
--   - O patch usa COALESCE: campos omitidos preservam o valor anterior
-- =============================================================================

CREATE OR REPLACE FUNCTION public.resubmit_report(
  p_report_id uuid,
  p_patch     jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tech_id uuid;
  v_status  text;
BEGIN
  SELECT technician_id, status
  INTO   v_tech_id, v_status
  FROM   service_reports
  WHERE  id = p_report_id;

  IF v_tech_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado: apenas o técnico responsável pode corrigir esta OS'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_status <> 'returned' THEN
    RAISE EXCEPTION 'OS não está devolvida — status atual: %', v_status
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE service_reports SET
    reported_problem         = COALESCE(p_patch->>'reported_problem',         reported_problem),
    preliminary_diagnosis    = COALESCE(p_patch->>'preliminary_diagnosis',    preliminary_diagnosis),
    final_diagnosis          = COALESCE(p_patch->>'final_diagnosis',          final_diagnosis),
    services_performed       = COALESCE(p_patch->>'services_performed',       services_performed),
    parts_used               = COALESCE(p_patch->>'parts_used',               parts_used),
    pending_issues           = COALESCE(p_patch->>'pending_issues',           pending_issues),
    technical_recommendation = COALESCE(p_patch->>'technical_recommendation', technical_recommendation),
    internal_notes           = COALESCE(p_patch->>'internal_notes',           internal_notes),
    status                   = 'pending_review',
    reviewer_comment         = NULL,
    updated_at               = now()
  WHERE id = p_report_id;

  -- Histórico — o trigger notify_on_os_status_change NÃO dispara aqui
  -- porque to_status = 'pending_review' (não está na lista de notificáveis)
  INSERT INTO report_status_history(report_id, from_status, to_status, changed_by, comment)
  VALUES (p_report_id, 'returned', 'pending_review', auth.uid(), 'OS resubmetida após correção.');

  RETURN jsonb_build_object('success', true, 'report_id', p_report_id);
END; $$;

REVOKE EXECUTE ON FUNCTION public.resubmit_report(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resubmit_report(uuid, jsonb) FROM anon;
GRANT  EXECUTE ON FUNCTION public.resubmit_report(uuid, jsonb) TO authenticated;
