-- Migration: fix_ai_routing_rpc_auth
-- Correção de segurança: get_ai_routing_stats e cleanup_ai_routing_log não tinham
-- verificação de is_platform_master(). Qualquer usuário autenticado podia chamá-las.
-- Convertidas de LANGUAGE sql para LANGUAGE plpgsql para adicionar o guard.

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

-- REVOKE/GRANT: sem alteração — já corretos (anon revogado, authenticated concedido)
-- O guard is_platform_master() bloqueia chamadas de roles não-SuperMaster em runtime.
