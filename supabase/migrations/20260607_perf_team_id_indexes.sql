-- Migration: perf_team_id_indexes
-- Objetivo: adicionar índices em team_id nas tabelas sem cobertura
-- Evidência: pg_indexes — ausência confirmada; RLS dessas tabelas filtra por team_id via get_caller_team_id()
-- Risco: baixíssimo — CREATE INDEX sem CONCURRENTLY é válido em migration transacional; tabelas em early-data
-- Rollback: DROP INDEX IF EXISTS <nome> para cada índice abaixo

-- RH module (maior ROI — crescimento linear com headcount × período)
CREATE INDEX IF NOT EXISTS idx_payroll_entries_team_id
  ON public.payroll_entries (team_id);

CREATE INDEX IF NOT EXISTS idx_time_records_team_id
  ON public.time_records (team_id);

CREATE INDEX IF NOT EXISTS idx_vacation_schedules_team_id
  ON public.vacation_schedules (team_id);

-- Filas / logs (webhook_deliveries cresce rápido com entregas)
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_team_id
  ON public.webhook_deliveries (team_id);

-- Financeiro
CREATE INDEX IF NOT EXISTS idx_payable_installments_team_id
  ON public.payable_installments (team_id);

CREATE INDEX IF NOT EXISTS idx_payable_status_history_team_id
  ON public.payable_status_history (team_id);

CREATE INDEX IF NOT EXISTS idx_payable_comments_team_id
  ON public.payable_comments (team_id);

-- Peças por OS
CREATE INDEX IF NOT EXISTS idx_os_parts_team_id
  ON public.os_parts (team_id);

-- RH — cargos
CREATE INDEX IF NOT EXISTS idx_positions_team_id
  ON public.positions (team_id);

-- API pública / webhooks
CREATE INDEX IF NOT EXISTS idx_api_keys_team_id
  ON public.api_keys (team_id);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_team_id
  ON public.webhook_endpoints (team_id);

-- CSAT
CREATE INDEX IF NOT EXISTS idx_csat_responses_team_id
  ON public.csat_responses (team_id);
