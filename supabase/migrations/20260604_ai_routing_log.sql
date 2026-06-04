-- Migration: ai_routing_log
-- Telemetria de roteamento da Edge Function ai-proxy.
-- Segurança: RLS ENABLED sem políticas = PostgREST bloqueia acesso direto.
-- Escrita: service_role na Edge Function (bypassa RLS).
-- Leitura: somente via get_ai_routing_stats (SECURITY DEFINER, SuperMaster only).

CREATE TABLE IF NOT EXISTS public.ai_routing_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type  TEXT        NOT NULL
    CHECK (request_type IN ('receipt_images','material_images','receipt_voice','material_voice','diagnostic')),
  provider      TEXT        NOT NULL
    CHECK (provider IN ('gemini_1','gemini_2','openai')),
  is_fallback   BOOLEAN     NOT NULL DEFAULT false,
  latency_ms    INTEGER     CHECK (latency_ms >= 0),
  success       BOOLEAN     NOT NULL DEFAULT true,
  error_code    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_routing_log_created  ON public.ai_routing_log (created_at DESC);
CREATE INDEX idx_ai_routing_log_provider ON public.ai_routing_log (provider, created_at DESC);
CREATE INDEX idx_ai_routing_log_fallback ON public.ai_routing_log (is_fallback, created_at DESC)
  WHERE is_fallback = true;

-- RLS habilitado SEM policies = deny all via PostgREST para authenticated/anon
ALTER TABLE public.ai_routing_log ENABLE ROW LEVEL SECURITY;

-- RPC de estatísticas — somente SuperMaster
CREATE OR REPLACE FUNCTION public.get_ai_routing_stats(p_hours INT DEFAULT 24)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_master() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN (
    WITH w AS (
      SELECT provider, is_fallback, success, latency_ms
      FROM public.ai_routing_log
      WHERE created_at > now() - (p_hours || ' hours')::INTERVAL
    )
    SELECT jsonb_build_object(
      'total_requests',  COUNT(*),
      'fallback_count',  COUNT(*) FILTER (WHERE is_fallback),
      'fallback_pct',    ROUND(100.0 * COUNT(*) FILTER (WHERE is_fallback) / NULLIF(COUNT(*), 0), 1),
      'openai_count',    COUNT(*) FILTER (WHERE provider = 'openai'),
      'gemini_count',    COUNT(*) FILTER (WHERE provider LIKE 'gemini%'),
      'avg_latency_ms',  ROUND(AVG(latency_ms)),
      'error_count',     COUNT(*) FILTER (WHERE NOT success),
      'by_provider',     COALESCE(
                           (SELECT jsonb_object_agg(provider, cnt)
                            FROM (SELECT provider, COUNT(*) cnt FROM w GROUP BY provider) s),
                           '{}'::jsonb
                         ),
      'window_hours',    p_hours
    )
    FROM w
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_ai_routing_stats(INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ai_routing_stats(INT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_ai_routing_stats(INT) TO authenticated;

-- RPC de cleanup (retenção 90 dias) — executar manualmente ou via cron externo
CREATE OR REPLACE FUNCTION public.cleanup_ai_routing_log(p_days INT DEFAULT 90)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_master() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  RETURN (
    WITH deleted AS (
      DELETE FROM public.ai_routing_log
      WHERE created_at < now() - (p_days || ' days')::INTERVAL
      RETURNING id
    )
    SELECT COUNT(*)::INT FROM deleted
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_ai_routing_log(INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_ai_routing_log(INT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cleanup_ai_routing_log(INT) TO authenticated;
