-- =============================================================================
-- Migration: reopen_report
-- Propósito: permite ao técnico contestar uma reprovação e reabrir a OS para
--   correção, sem precisar criar uma nova — reutiliza o fluxo "Corrigir e
--   Reenviar" já existente (status returned).
-- Segurança:
--   - Apenas o técnico responsável pode reabrir
--   - Apenas OS em status 'rejected' podem ser reabertas
-- Nota: o trigger notify_on_os_status_change NÃO re-notifica o técnico aqui
--   porque changed_by === technician_id (guard interno do trigger).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reopen_report(p_report_id uuid)
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
    RAISE EXCEPTION 'Apenas o técnico responsável pode reabrir esta OS'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_status <> 'rejected' THEN
    RAISE EXCEPTION 'Apenas OS reprovadas podem ser reabertas — status atual: %', v_status
      USING ERRCODE = 'check_violation';
  END IF;

  -- reviewer_comment permanece intacto para que o técnico veja o motivo da reprovação
  UPDATE service_reports SET
    status     = 'returned',
    updated_at = now()
  WHERE id = p_report_id;

  INSERT INTO report_status_history(report_id, from_status, to_status, changed_by, comment)
  VALUES (p_report_id, 'rejected', 'returned', auth.uid(),
          'OS reaberta pelo técnico para contestação e correção.');

  RETURN jsonb_build_object('success', true);
END; $$;

REVOKE EXECUTE ON FUNCTION public.reopen_report(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reopen_report(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.reopen_report(uuid) TO authenticated;
