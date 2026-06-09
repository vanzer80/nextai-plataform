-- Migration: fix_service_types_rls_policy
-- Objetivo: substituir raw subquery em service_types.team_isolation por get_caller_team_id()
-- Evidência: pg_policies WHERE tablename='service_types' AND policyname='team_isolation'
-- Atual: USING (team_id = (SELECT users.team_id FROM users WHERE users.id = auth.uid()))
-- Problema: (1) auth.uid() sem (SELECT ...) = avaliação por linha; (2) ignora get_caller_team_id() STABLE
-- Resultado esperado: semântica idêntica, custo eliminado
-- Risco: baixo — lógica equivalente, só troca implementação
-- Rollback:
--   ALTER POLICY team_isolation ON public.service_types
--     USING (team_id = (SELECT users.team_id FROM users WHERE (users.id = auth.uid())))
--     WITH CHECK (team_id = (SELECT users.team_id FROM users WHERE (users.id = auth.uid())));

ALTER POLICY team_isolation ON public.service_types
  USING (team_id = get_caller_team_id())
  WITH CHECK (team_id = get_caller_team_id());
