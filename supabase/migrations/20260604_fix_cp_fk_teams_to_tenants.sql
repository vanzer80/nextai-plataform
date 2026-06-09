-- Migration: fix_cp_fk_teams_to_tenants
-- Contexto: migration 20260526_cp_module.sql foi escrita com REFERENCES public.teams(id)
-- (tabela inexistente). Em produção as FKs já apontam para tenants porque a tabela
-- existia antes da migration. Esta migration garante que um disaster recovery funcione.
-- É idempotente: DROP IF EXISTS + ADD garante o estado correto independente do estado atual.

-- payables
ALTER TABLE public.payables
  DROP CONSTRAINT IF EXISTS payables_team_id_fkey,
  ADD CONSTRAINT payables_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- payable_installments
ALTER TABLE public.payable_installments
  DROP CONSTRAINT IF EXISTS payable_installments_team_id_fkey,
  ADD CONSTRAINT payable_installments_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- payable_comments
ALTER TABLE public.payable_comments
  DROP CONSTRAINT IF EXISTS payable_comments_team_id_fkey,
  ADD CONSTRAINT payable_comments_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
