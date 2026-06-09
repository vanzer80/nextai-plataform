-- ═══════════════════════════════════════════════════════════════════
-- OS Import Bridge — 2026-06-06
-- Permite importar OSs de sistemas externos (TOTVS, SAP, Omie, PDF)
-- normalizando para o schema NextAI antes de qualquer INSERT.
--
-- Conteúdo:
--   a) Colunas external_source + external_ref_id em service_reports
--      + UNIQUE INDEX para idempotência por (tenant, source, ref_id)
--   b) Tabela os_import_log com RLS multi-tenant + policies
--   c) Função reserve_os_number_service(p_team_id) — versão sem
--      verificação de auth.uid(), GRANT exclusivo para service_role
-- ═══════════════════════════════════════════════════════════════════

-- ── a) Colunas de rastreamento em service_reports ─────────────────

ALTER TABLE public.service_reports
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_ref_id  TEXT;

-- UNIQUE parcial: garante idempotência por (tenant + sistema + ref_id).
-- WHERE NOT NULL: OSs manuais sem external_ref_id não participam do índice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sr_external_dedup
  ON public.service_reports(team_id, external_source, external_ref_id)
  WHERE external_source IS NOT NULL AND external_ref_id IS NOT NULL;

-- ── b) Log de importações ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.os_import_log (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  api_key_id            UUID        REFERENCES public.api_keys(id) ON DELETE SET NULL,
  external_source       TEXT        NOT NULL,
  external_ref_id       TEXT,
  import_mode           TEXT        NOT NULL
                                    CHECK (import_mode IN ('json', 'pdf')),
  status                TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'success', 'failed', 'duplicate')),
  os_id                 UUID,       -- sem FK — evita referência circular com service_reports
  client_resolution     TEXT,       -- 'matched_cnpj' | 'matched_name' | 'auto_created' | 'not_found'
  technician_resolution TEXT,       -- 'matched_email' | 'matched_name' | 'not_found'
  error_detail          TEXT,
  raw_payload           JSONB,      -- sanitizado: pdf_base64 redacted, sem senhas/chaves
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.os_import_log ENABLE ROW LEVEL SECURITY;

-- Tenant lê/escreve apenas seus próprios logs
CREATE POLICY "os_import_log_tenant" ON public.os_import_log
  FOR ALL
  USING (team_id = public.get_caller_team_id());

-- SuperMaster lê todos os logs (monitoramento da plataforma)
CREATE POLICY "os_import_log_platform" ON public.os_import_log
  FOR ALL
  USING (public.is_platform_master());

-- Índice principal: listagem paginada por tenant + data
CREATE INDEX IF NOT EXISTS idx_os_import_log_team_date
  ON public.os_import_log(team_id, created_at DESC);

-- Índice para filtro "apenas falhas pendentes de reprocessamento"
CREATE INDEX IF NOT EXISTS idx_os_import_log_failed
  ON public.os_import_log(status)
  WHERE status != 'success';

-- ── c) reserve_os_number_service — sem auth.uid() ────────────────
--
-- Motivação: reserve_os_number() chama get_my_team_id() → auth.uid().
-- Quando invocada via service_role (Edge Function), auth.uid() retorna NULL
-- e a função lança 'Acesso negado'.
--
-- Esta variante é idêntica em lógica mas não verifica auth.uid().
-- GRANT exclusivo para service_role — authenticated e anon não podem chamar.
-- Segurança: o team_id é resolvido pela Edge Function a partir da api_key
-- autenticada, nunca do body do cliente.

DROP FUNCTION IF EXISTS public.reserve_os_number_service(UUID);

CREATE FUNCTION public.reserve_os_number_service(p_team_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_val BIGINT;
BEGIN
  INSERT INTO public.tenant_os_counters(team_id, next_val)
  VALUES (p_team_id, 1)
  ON CONFLICT (team_id) DO UPDATE
    SET next_val = tenant_os_counters.next_val + 1
  RETURNING next_val INTO v_val;

  RETURN 'OS-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')
               || '-' || lpad(v_val::text, 5, '0');
END;
$$;

-- Checklist obrigatório para funções SECURITY DEFINER (CLAUDE.md)
REVOKE EXECUTE ON FUNCTION public.reserve_os_number_service(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reserve_os_number_service(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reserve_os_number_service(UUID) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.reserve_os_number_service(UUID) TO service_role;
