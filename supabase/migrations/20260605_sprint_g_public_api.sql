-- ═══════════════════════════════════════════════════════════════════
-- Sprint G — Public API & Webhook System
-- Tables : api_keys · api_access_log · api_idempotency_keys
--          webhook_endpoints · webhook_deliveries
-- RPCs   : create/revoke/get api_keys · create/update/delete/get webhooks
--          enqueue_webhook_event · get_api_usage_stats
-- Triggers: order · reimbursement · quote · payable
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. api_keys ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  key_hash     TEXT        NOT NULL UNIQUE,
  key_prefix   TEXT        NOT NULL,
  scopes       TEXT[]      NOT NULL DEFAULT '{}',
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_by   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_tenant" ON public.api_keys
  FOR ALL USING (team_id = public.get_caller_team_id());

-- ── 2. api_access_log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_access_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id   UUID        REFERENCES public.api_keys(id) ON DELETE SET NULL,
  team_id      UUID        NOT NULL,
  method       TEXT        NOT NULL,
  path         TEXT        NOT NULL,
  status_code  INTEGER     NOT NULL,
  duration_ms  INTEGER,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.api_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_log_tenant_select" ON public.api_access_log
  FOR SELECT USING (team_id = public.get_caller_team_id());
CREATE POLICY "api_log_platform" ON public.api_access_log
  FOR ALL USING (public.is_platform_master());

-- ── 3. api_idempotency_keys ────────────────────────────────────────
-- Gerenciado exclusivamente pela Edge Function api-gateway (service_role)
CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  key         TEXT        PRIMARY KEY,
  team_id     UUID        NOT NULL,
  method      TEXT        NOT NULL,
  path        TEXT        NOT NULL,
  status_code INTEGER     NOT NULL,
  response    JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours'
);

-- ── 4. webhook_endpoints ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  url          TEXT        NOT NULL,
  description  TEXT,
  secret       TEXT        NOT NULL,
  events       TEXT[]      NOT NULL DEFAULT '{}',
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_by   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_endpoints_tenant" ON public.webhook_endpoints
  FOR ALL USING (team_id = public.get_caller_team_id());

-- ── 5. webhook_deliveries ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id     UUID        NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  team_id         UUID        NOT NULL,
  event_type      TEXT        NOT NULL,
  event_version   TEXT        NOT NULL DEFAULT '1.0',
  payload         JSONB       NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending',
  attempts        INTEGER     NOT NULL DEFAULT 0,
  next_retry_at   TIMESTAMPTZ,
  last_error      TEXT,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_delivery_status CHECK (status IN ('pending','sent','delivered','failed','dead'))
);
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_deliveries_tenant" ON public.webhook_deliveries
  FOR SELECT USING (team_id = public.get_caller_team_id());

-- ── Indexes ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_api_log_team_date    ON public.api_access_log(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_log_key_date     ON public.api_access_log(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_dlv_pending  ON public.webhook_deliveries(next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_dlv_endpoint ON public.webhook_deliveries(endpoint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires  ON public.api_idempotency_keys(expires_at);

-- ═══════════════════════════════════════════════════════════════════
-- RPCs — API Keys
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_api_key(
  p_name       TEXT,
  p_scopes     TEXT[],
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_role      public.user_role;
  v_team_id   UUID;
  v_key_plain TEXT;
  v_key_hash  TEXT;
  v_prefix    TEXT;
  v_key_id    UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT role, team_id INTO v_role, v_team_id FROM public.users WHERE id = v_user_id;
  IF v_role NOT IN ('Master', 'Admin') THEN
    RAISE EXCEPTION 'Permissão insuficiente. Apenas Master e Admin podem criar API keys.';
  END IF;

  v_key_plain := 'nxtai_live_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_prefix    := LEFT(v_key_plain, 16);
  v_key_hash  := encode(extensions.digest(v_key_plain::bytea, 'sha256'), 'hex');

  INSERT INTO public.api_keys (team_id, name, key_hash, key_prefix, scopes, created_by, expires_at)
  VALUES (v_team_id, p_name, v_key_hash, v_prefix, p_scopes, v_user_id, p_expires_at)
  RETURNING id INTO v_key_id;

  RETURN json_build_object('id', v_key_id, 'key', v_key_plain, 'prefix', v_prefix);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_api_key(TEXT, TEXT[], TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_api_key(TEXT, TEXT[], TIMESTAMPTZ) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_api_key(TEXT, TEXT[], TIMESTAMPTZ) TO authenticated;

-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_api_key(p_key_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role    public.user_role;
  v_team_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT role, team_id INTO v_role, v_team_id FROM public.users WHERE id = v_user_id;
  IF v_role NOT IN ('Master', 'Admin') THEN RAISE EXCEPTION 'Permissão insuficiente.'; END IF;
  UPDATE public.api_keys SET is_active = false WHERE id = p_key_id AND team_id = v_team_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.revoke_api_key(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_api_key(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.revoke_api_key(UUID) TO authenticated;

-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_api_keys()
RETURNS TABLE (
  id           UUID,
  name         TEXT,
  key_prefix   TEXT,
  scopes       TEXT[],
  is_active    BOOLEAN,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id, name, key_prefix, scopes, is_active, last_used_at, expires_at, created_at
  FROM public.api_keys
  WHERE team_id = get_caller_team_id()
  ORDER BY created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.get_api_keys() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_api_keys() FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_api_keys() TO authenticated;

-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_api_usage_stats(p_days INTEGER DEFAULT 7)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_team_id UUID;
  v_result  JSON;
BEGIN
  v_team_id := get_caller_team_id();
  SELECT json_build_object(
    'total_requests',   COUNT(*),
    'success_requests', COUNT(*) FILTER (WHERE status_code < 400),
    'error_requests',   COUNT(*) FILTER (WHERE status_code >= 400),
    'avg_duration_ms',  COALESCE(ROUND(AVG(duration_ms)::numeric, 0), 0)
  )
  INTO v_result
  FROM public.api_access_log
  WHERE team_id = v_team_id
    AND created_at >= now() - make_interval(days => p_days);
  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_api_usage_stats(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_api_usage_stats(INTEGER) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_api_usage_stats(INTEGER) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- RPCs — Webhooks
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_webhook_endpoint(
  p_url         TEXT,
  p_events      TEXT[],
  p_description TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role    public.user_role;
  v_team_id UUID;
  v_secret  TEXT;
  v_id      UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT role, team_id INTO v_role, v_team_id FROM public.users WHERE id = v_user_id;
  IF v_role NOT IN ('Master', 'Admin') THEN RAISE EXCEPTION 'Permissão insuficiente.'; END IF;

  v_secret := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.webhook_endpoints (team_id, url, secret, events, description, created_by)
  VALUES (v_team_id, p_url, v_secret, p_events, p_description, v_user_id)
  RETURNING id INTO v_id;

  RETURN json_build_object('id', v_id, 'secret', v_secret);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_webhook_endpoint(TEXT, TEXT[], TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_webhook_endpoint(TEXT, TEXT[], TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_webhook_endpoint(TEXT, TEXT[], TEXT) TO authenticated;

-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_webhook_endpoint(
  p_id          UUID,
  p_url         TEXT    DEFAULT NULL,
  p_events      TEXT[]  DEFAULT NULL,
  p_description TEXT    DEFAULT NULL,
  p_is_active   BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
    description = COALESCE(p_description, description),
    is_active   = COALESCE(p_is_active, is_active)
  WHERE id = p_id AND team_id = v_team_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_webhook_endpoint(UUID, TEXT, TEXT[], TEXT, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_webhook_endpoint(UUID, TEXT, TEXT[], TEXT, BOOLEAN) FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_webhook_endpoint(UUID, TEXT, TEXT[], TEXT, BOOLEAN) TO authenticated;

-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_webhook_endpoint(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role    public.user_role;
  v_team_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT role, team_id INTO v_role, v_team_id FROM public.users WHERE id = v_user_id;
  IF v_role NOT IN ('Master', 'Admin') THEN RAISE EXCEPTION 'Permissão insuficiente.'; END IF;
  DELETE FROM public.webhook_endpoints WHERE id = p_id AND team_id = v_team_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_webhook_endpoint(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_webhook_endpoint(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.delete_webhook_endpoint(UUID) TO authenticated;

-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_webhook_endpoints()
RETURNS TABLE (
  id          UUID,
  url         TEXT,
  description TEXT,
  events      TEXT[],
  is_active   BOOLEAN,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id, url, description, events, is_active, created_at
  FROM public.webhook_endpoints
  WHERE team_id = get_caller_team_id()
  ORDER BY created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.get_webhook_endpoints() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_webhook_endpoints() FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_webhook_endpoints() TO authenticated;

-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_webhook_deliveries(
  p_endpoint_id UUID,
  p_limit       INTEGER DEFAULT 20
)
RETURNS TABLE (
  id           UUID,
  event_type   TEXT,
  status       TEXT,
  attempts     INTEGER,
  last_error   TEXT,
  delivered_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_team_id UUID := get_caller_team_id();
BEGIN
  RETURN QUERY
  SELECT d.id, d.event_type, d.status, d.attempts, d.last_error, d.delivered_at, d.created_at
  FROM public.webhook_deliveries d
  WHERE d.endpoint_id = p_endpoint_id AND d.team_id = v_team_id
  ORDER BY d.created_at DESC
  LIMIT p_limit;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_webhook_deliveries(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_webhook_deliveries(UUID, INTEGER) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_webhook_deliveries(UUID, INTEGER) TO authenticated;

-- ══════════════════════════════════════════════════════════════════
-- Internal: enqueue_webhook_event — chamada pelos triggers
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enqueue_webhook_event(
  p_team_id    UUID,
  p_event_type TEXT,
  p_payload    JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_endpoint RECORD;
BEGIN
  FOR v_endpoint IN
    SELECT id
    FROM public.webhook_endpoints
    WHERE team_id = p_team_id
      AND is_active = true
      AND p_event_type = ANY(events)
  LOOP
    INSERT INTO public.webhook_deliveries (endpoint_id, team_id, event_type, payload)
    VALUES (v_endpoint.id, p_team_id, p_event_type, p_payload);
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enqueue_webhook_event(UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_webhook_event(UUID, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_webhook_event(UUID, TEXT, JSONB) FROM authenticated;

-- ══════════════════════════════════════════════════════════════════
-- Trigger: order webhooks (service_reports)
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.trigger_order_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
        'completed_at', now()
      );
    ELSE
      v_event_type := 'order.updated';
      v_payload    := jsonb_build_object(
        'id', NEW.id, 'number', NEW.os_number, 'status', NEW.status,
        'updated_at', now()
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

DROP TRIGGER IF EXISTS trg_order_webhook ON public.service_reports;
CREATE TRIGGER trg_order_webhook
  AFTER INSERT OR UPDATE OF status ON public.service_reports
  FOR EACH ROW EXECUTE FUNCTION public.trigger_order_webhook();

-- ══════════════════════════════════════════════════════════════════
-- Trigger: reimbursement webhooks
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.trigger_reimbursement_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_team_id UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Aprovado' THEN
    SELECT team_id INTO v_team_id FROM public.users WHERE id = NEW.user_id;
    IF v_team_id IS NOT NULL THEN
      PERFORM public.enqueue_webhook_event(v_team_id, 'reimbursement.approved', jsonb_build_object(
        'id', NEW.id, 'amount', NEW.amount, 'approved_at', now()
      ));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trigger_reimbursement_webhook() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_reimbursement_webhook() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_reimbursement_webhook() FROM authenticated;

DROP TRIGGER IF EXISTS trg_reimbursement_webhook ON public.reimbursements;
CREATE TRIGGER trg_reimbursement_webhook
  AFTER UPDATE OF status ON public.reimbursements
  FOR EACH ROW EXECUTE FUNCTION public.trigger_reimbursement_webhook();

-- ══════════════════════════════════════════════════════════════════
-- Trigger: quote webhooks (orcamentos)
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.trigger_quote_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.signed_at IS NULL AND NEW.signed_at IS NOT NULL AND NEW.team_id IS NOT NULL THEN
    PERFORM public.enqueue_webhook_event(NEW.team_id, 'quote.signed', jsonb_build_object(
      'id', NEW.id, 'status', NEW.status,
      'signed_at', NEW.signed_at, 'client_id', NEW.client_id
    ));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trigger_quote_webhook() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_quote_webhook() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_quote_webhook() FROM authenticated;

DROP TRIGGER IF EXISTS trg_quote_webhook ON public.orcamentos;
CREATE TRIGGER trg_quote_webhook
  AFTER UPDATE OF signed_at ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.trigger_quote_webhook();

-- ══════════════════════════════════════════════════════════════════
-- Trigger: payable webhooks
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.trigger_payable_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'pago' AND NEW.team_id IS NOT NULL THEN
    PERFORM public.enqueue_webhook_event(NEW.team_id, 'payable.paid', jsonb_build_object(
      'id', NEW.id, 'valor_total', NEW.valor_total, 'paid_at', now()
    ));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trigger_payable_webhook() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_payable_webhook() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_payable_webhook() FROM authenticated;

DROP TRIGGER IF EXISTS trg_payable_webhook ON public.payables;
CREATE TRIGGER trg_payable_webhook
  AFTER UPDATE OF status ON public.payables
  FOR EACH ROW EXECUTE FUNCTION public.trigger_payable_webhook();
