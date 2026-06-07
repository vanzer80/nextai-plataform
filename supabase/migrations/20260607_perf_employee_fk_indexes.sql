-- Migration: perf_employee_fk_indexes
-- Objetivo: índices nas FKs de tabelas filhas de employees sem cobertura
-- Evidência: pg_indexes — employee_certifications, employee_documents, employee_history sem índice não-PK
-- RLS dessas tabelas usa JOIN em employees.team_id; sem índice na FK = seq scan em cada acesso
-- Risco: baixíssimo
-- Rollback: DROP INDEX IF EXISTS para cada índice abaixo

CREATE INDEX IF NOT EXISTS idx_employee_certifications_employee_id
  ON public.employee_certifications (employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id
  ON public.employee_documents (employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_history_employee_id
  ON public.employee_history (employee_id);
