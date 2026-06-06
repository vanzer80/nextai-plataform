-- ═══════════════════════════════════════════════════════════════════
-- Sprint G — Patch 1: Correções de qualidade e completude
-- Fixes : PK idempotency cross-tenant · CHECK constraints · updated_at
--         payloads incompletos · reimbursement.paid · update_webhook COALESCE
--         cleanup retention RPCs
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. api_idempotency_keys: PK composta (key, team_id) ───────────
-- PK apenas em 'key' permitia cross-tenant collision.
ALTER TABLE public.api_idempotency_keys DROP CONSTRAINT api_idempotency_keys_pkey;
ALTER TABLE public.api_idempotency_keys ADD PRIMARY KEY (key, team_id);
ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- ── 2. CHECK constraints de domínio ───────────────────────────────
ALTER TABLE public.api_keys
  ADD CONSTRAINT chk_api_key_scopes CHECK (
    scopes <@ ARRAY[
      'orders:read','orders:write',
      'reimbursements:read',
      'clients:read','clients:write',
      'quotes:read',
      'webhooks:write'
    ]::text[]
  );

ALTER TABLE public.webhook_endpoints
  ADD CONSTRAINT chk_webhook_endpoint_events CHECK (
    events <@ ARRAY[
      'order.created','order.updated','order.completed',
      'reimbursement.approved','reimbursement.paid',
      'quote.signed','payable.paid'
    ]::text[]
  );

-- ── 3. updated_at em api_keys e webhook_endpoints ─────────────────
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.webhook_endpoints
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS set_api_keys_updated_at          ON public.api_keys;
DROP TRIGGER IF EXISTS set_webhook_endpoints_updated_at  ON public.webhook_endpoints;

CREATE TRIGGER set_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_webhook_endpoints_updated_at
  BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 4. get_api_keys: expõe updated_at ─────────────────────────────
DROP FUNCTION IF EXISTS public.get_api_keys();
CREATE FUNCTION public.get_api_keys()
RETURNS TABLE (
  id           UUID,
  name         TEXT,
  key_prefix   TEXT,
  scopes       TEXT[],
  is_active    BOOLEAN,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT id, name, key_prefix, scopes, is_active, last_used_at, expires_at, created_at, updated_at
  FROM public.api_keys
  WHERE team_id = get_caller_team_id()
  ORDER BY created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.get_api_keys() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_api_keys() FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_api_keys() TO authenticated;

-- ── 5. get_webhook_endpoints: expõe updated_at ───────────────────
DROP FUNCTION IF EXISTS public.get_webhook_endpoints();
CREATE FUNCTION public.get_webhook_endpoints()
RETURNS TABLE (
  id          UUID,
  url         TEXT,
  description TEXT,
  events      TEXT[],
  is_active   BOOLEAN,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT id, url, description, events, is_active, created_at, updated_at
  FROM public.webhook_endpoints
  WHERE team_id = get_caller_team_id()
  ORDER BY created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.get_webhook_endpoints() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_webhook_endpoints() FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_webhook_endpoints() TO authenticated;

-- ── 6. update_webhook_endpoint: suporta limpar description ────────
-- COALESCE puro impedia setar description = NULL.
-- Novo parâmetro p_clear_description com DEFAULT false — backward compatible.
DROP FUNCTION IF EXISTS public.update_webhook_endpoint(UUID, TEXT, TEXT[], TEXT, BOOLEAN);

CREATE FUNCTION public.update_webhook_endpoint(
  p_id                UUID,
  p_url               TEXT    DEFAULT NULL,
  p_events            TEXT[]  DEFAULT NULL,
  p_description       TEXT    DEFAULT NULL,
  p_is_active         BOOLEAN DEFAULT NULL,
  p_clear_description BOOLEAN DEFAULT false
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role    public.user_role;
  v_team_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT role, team_id INTO v_role, v_team_id FROM public.users WHERE id = v_user_id;
  IF v_role NOT IN ('Master', 'Admin') THEN RAISE EXCEPTION 'Permissão insuficiente.'; END IF;
  UPDATE public.webhook_endpoints
  SET
    url         = COALESCE(p_url, url),
    events      = COALESCE(p_events, events),
    description = CASE WHEN p_clear_description THEN NULL
                       ELSE COALESCE(p_description, description) END,
    is_active   = COALESCE(p_is_active, is_active)
  WHERE id = p_id AND team_id = v_team_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_webhook_endpoint(UUID,TEXT,TEXT[],TEXT,BOOLEAN,BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_webhook_endpoint(UUID,TEXT,TEXT[],TEXT,BOOLEAN,BOOLEAN) FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_webhook_endpoint(UUID,TEXT,TEXT[],TEXT,BOOLEAN,BOOLEAN) TO authenticated;

-- ── 7. trigger_order_webhook: payloads completos ──────────────────
CREATE OR REPLACE FUNCTION public.trigger_order_webhook()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_event_type TEXT;
  v_payload    JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'order.created';
    v_payload    := jsonb_build_object(
      'id', NEW.id, 'number', NEW.os_number, 'status', NEW.status,
      'client_id', NEW.client_id, 'technician_id', NEW.technician_id,
      'created_at', NEW.created_at
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN
      v_event_type := 'order.completed';
      v_payload    := jsonb_build_object(
        'id', NEW.id, 'number', NEW.os_number, 'status', NEW.status,
        'signature_url', NEW.signature_url,
        'completed_at', COALESCE(NEW.finished_at, now())
      );
    ELSE
      v_event_type := 'order.updated';
      v_payload    := jsonb_build_object(
        'id', NEW.id, 'number', NEW.os_number, 'status', NEW.status,
        'updated_by', NEW.reviewer_id,
        'updated_at', COALESCE(NEW.updated_at, now())
      );
    END IF;
  END IF;

  IF v_event_type IS NOT NULL AND NEW.team_id IS NOT NULL THEN
    PERFORM public.enqueue_webhook_event(NEW.team_id, v_event_type, v_payload);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trigger_order_webhook() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_order_webhook() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_order_webhook() FROM authenticated;

-- ── 8. trigger_reimbursement_webhook: corrige join + adiciona .paid
-- Bug original: fazia SELECT team_id FROM users enquanto a tabela
-- reimbursements já tem team_id diretamente.
-- Adiciona reimbursement.paid quando paid_at é preenchido.
CREATE OR REPLACE FUNCTION public.trigger_reimbursement_webhook()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_team_id UUID;
BEGIN
  v_team_id := COALESCE(NEW.team_id, OLD.team_id);
  IF v_team_id IS NULL THEN RETURN NEW; END IF;

  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Aprovado' THEN
    PERFORM public.enqueue_webhook_event(v_team_id, 'reimbursement.approved',
      jsonb_build_object(
        'id', NEW.id, 'amount', NEW.amount,
        'approved_by', NEW.updated_by,
        'approved_at', now()
      )
    );
  END IF;

  IF OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL THEN
    PERFORM public.enqueue_webhook_event(v_team_id, 'reimbursement.paid',
      jsonb_build_object(
        'id', NEW.id, 'amount', NEW.amount,
        'paid_by', NEW.paid_by,
        'paid_at', NEW.paid_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trigger_reimbursement_webhook() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_reimbursement_webhook() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_reimbursement_webhook() FROM authenticated;

DROP TRIGGER IF EXISTS trg_reimbursement_webhook ON public.reimbursements;
CREATE TRIGGER trg_reimbursement_webhook
  AFTER UPDATE OF status, paid_at ON public.reimbursements
  FOR EACH ROW EXECUTE FUNCTION public.trigger_reimbursement_webhook();

-- ── 9. trigger_payable_webhook: payload completo ──────────────────
CREATE OR REPLACE FUNCTION public.trigger_payable_webhook()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'pago' AND NEW.team_id IS NOT NULL THEN
    PERFORM public.enqueue_webhook_event(NEW.team_id, 'payable.paid',
      jsonb_build_object(
        'id', NEW.id, 'valor_total', NEW.valor_total,
        'paid_by', NEW.paid_by,
        'paid_at', NEW.paid_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trigger_payable_webhook() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_payable_webhook() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_payable_webhook() FROM authenticated;

-- ── 10. Retention RPCs ────────────────────────────────────────────
-- Habilitar pg_cron via dashboard → Extensions → pg_cron, depois executar:
--   SELECT cron.schedule('cleanup-api-log',  '0 3 * * *', $$SELECT public.cleanup_api_logs()$$);
--   SELECT cron.schedule('cleanup-idemp',    '*/30 * * * *', $$SELECT public.cleanup_idempotency_keys()$$);
CREATE OR REPLACE FUNCTION public.cleanup_api_logs(p_retention_days INTEGER DEFAULT 90)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE v_deleted INTEGER;
BEGIN
  DELETE FROM public.api_access_log
  WHERE created_at < now() - make_interval(days => p_retention_days);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cleanup_api_logs(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_api_logs(INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_api_logs(INTEGER) FROM authenticated;

CREATE OR REPLACE FUNCTION public.cleanup_idempotency_keys()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE v_deleted INTEGER;
BEGIN
  DELETE FROM public.api_idempotency_keys WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cleanup_idempotency_keys() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_idempotency_keys() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_idempotency_keys() FROM authenticated;
