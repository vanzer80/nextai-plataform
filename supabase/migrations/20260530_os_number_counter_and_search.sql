-- =============================================================================
-- Migration: os_number_counter_and_search
-- Propósito:
--   1. Numeração automática e única de OS por tenant (padrão ERP/SAP)
--   2. Busca full-text eficiente na lista de OS com índice GIN
--   3. Garantia de unicidade do número da OS por tenant
-- =============================================================================

-- ── 1. Tabela de contadores por tenant ────────────────────────────────────────
-- Uma linha por tenant; next_val é incrementado atomicamente na RPC abaixo.
CREATE TABLE IF NOT EXISTS public.tenant_os_counters (
  team_id  uuid    PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  next_val bigint  NOT NULL DEFAULT 1
);

ALTER TABLE public.tenant_os_counters ENABLE ROW LEVEL SECURITY;

-- Apenas o próprio tenant acessa seu contador (leitura via SELECT é irrelevante
-- para usuários comuns; a RPC é SECURITY DEFINER e acessa direto).
-- Política RESTRICTIVE como padrão do projeto.
DROP POLICY IF EXISTS "team_isolation" ON public.tenant_os_counters;
CREATE POLICY "team_isolation" ON public.tenant_os_counters
  AS RESTRICTIVE FOR ALL
  USING (team_id = get_my_team_id());

-- ── 2. RPC reserve_os_number — incremento atômico ────────────────────────────
-- Reserva o próximo número da OS para o tenant.
-- Formato: OS-YYYYMM-NNNNN (ex: OS-202605-00001)
-- SEGURANÇA: somente authenticated; anon não pode reservar números.
-- ATOMICIDADE: ON CONFLICT DO UPDATE no mesmo statement — sem race condition.
CREATE OR REPLACE FUNCTION public.reserve_os_number(p_team_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val bigint;
BEGIN
  -- Valida que o caller é do próprio tenant (defense-in-depth além do RLS)
  IF p_team_id IS DISTINCT FROM get_my_team_id() THEN
    -- SuperMaster pode reservar para qualquer tenant (provisioning)
    IF NOT is_platform_master() THEN
      RAISE EXCEPTION 'Acesso negado: team_id inválido'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  INSERT INTO public.tenant_os_counters(team_id, next_val)
  VALUES (p_team_id, 1)
  ON CONFLICT (team_id) DO UPDATE
    SET next_val = tenant_os_counters.next_val + 1
  RETURNING next_val INTO v_val;

  RETURN 'OS-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')
               || '-' || lpad(v_val::text, 5, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_os_number(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reserve_os_number(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.reserve_os_number(uuid) TO authenticated;

-- ── 3. Unicidade do número da OS por tenant ───────────────────────────────────
-- NULLs não participam do UNIQUE no PostgreSQL — OS sem número (rascunhos
-- abandonados antes da geração) são permitidos sem conflito.
-- Guard idempotente: re-executar a migration não quebra se o constraint já existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_service_reports_team_os_number'
  ) THEN
    ALTER TABLE public.service_reports
      ADD CONSTRAINT uq_service_reports_team_os_number
      UNIQUE (team_id, os_number);
  END IF;
END $$;

-- ── 4. Coluna search_vector para busca full-text ──────────────────────────────
-- Configuração 'simple': sem stemming, sem stop words — ideal para dados
-- estruturados de negócio (números de OS, tipos de serviço, descrições técnicas).
-- Consistência garantida: mesmo config para tsvector e tsquery.
-- PostgreSQL 17 calcula automaticamente para todas as linhas existentes.
ALTER TABLE public.service_reports
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(os_number,          '') || ' ' ||
      coalesce(service_type,       '') || ' ' ||
      coalesce(reported_problem,   '') || ' ' ||
      coalesce(final_diagnosis,    '') || ' ' ||
      coalesce(site_location,      '') || ' ' ||
      coalesce(asset_name_manual,  '') || ' ' ||
      coalesce(services_performed, '') || ' ' ||
      coalesce(internal_notes,     '')
    )
  ) STORED;

-- ── 5. Índice GIN — complexidade O(log n) para busca ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_service_reports_search_gin
  ON public.service_reports USING GIN(search_vector);
