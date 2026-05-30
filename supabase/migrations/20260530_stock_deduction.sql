-- =============================================================================
-- Migration: stock_deduction
-- Propósito: deducão automática de estoque quando OS é aprovada.
--   - Trigger em service_reports AFTER UPDATE OF status
--   - Deduz qty_used de parts.stock_qty para cada os_part com part_id
--   - Estoque negativo permitido (técnico de campo não pode ser bloqueado)
--   - Notifica gestores quando estoque cai abaixo do mínimo
-- =============================================================================

CREATE OR REPLACE FUNCTION public.deduct_stock_on_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_part RECORD;
BEGIN
  IF NEW.status <> 'approved' OR OLD.status = 'approved' THEN RETURN NEW; END IF;

  FOR v_part IN
    SELECT op.part_id, op.qty_used, p.name, p.stock_qty, p.min_stock_qty
    FROM   os_parts op JOIN parts p ON p.id = op.part_id
    WHERE  op.report_id = NEW.id AND op.part_id IS NOT NULL
  LOOP
    UPDATE parts SET stock_qty = stock_qty - v_part.qty_used WHERE id = v_part.part_id;

    IF (v_part.stock_qty - v_part.qty_used) <= v_part.min_stock_qty THEN
      INSERT INTO notifications(team_id, user_id, title, message, report_id)
      SELECT NEW.team_id, u.id,
        'Estoque baixo: ' || v_part.name,
        'Peça "' || v_part.name || '" atingiu estoque mínimo após OS ' || COALESCE(NEW.os_number, ''),
        NEW.id
      FROM users u WHERE u.team_id = NEW.team_id AND u.role IN ('Gestor','Admin','Master') LIMIT 3;
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_deduct_stock_on_approval ON public.service_reports;
CREATE TRIGGER trg_deduct_stock_on_approval
  AFTER UPDATE OF status ON public.service_reports
  FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_approval();

REVOKE EXECUTE ON FUNCTION public.deduct_stock_on_approval() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deduct_stock_on_approval() FROM anon;
REVOKE EXECUTE ON FUNCTION public.deduct_stock_on_approval() FROM authenticated;
