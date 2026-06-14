-- ===========================================================================
-- Migration: fix_process_orcamento_status_grant
-- Recria a tabela orcamento_history (se não existir) e a função
-- process_orcamento_status com todos os guards de segurança corretos:
-- SECURITY DEFINER + SET search_path + REVOKE/GRANT.
--
-- Contexto: a função + tabela foram criadas em 2026-05-24 diretamente no
-- banco sem migration rastreada. Por isso a função ficou sem REVOKE FROM
-- PUBLIC/anon, causando HTTP 403 ao chamar
--   supabase.rpc('process_orcamento_status')
-- via anon key com JWT de usuário autenticado.
--
-- Resolve: erro 403 no endpoint /rest/v1/rpc/process_orcamento_status ao
-- clicar em "Enviar para aprovação" / "Aprovar" / "Rejeitar" em
-- OrcamentoDetail.tsx (atualizarStatus → process_orcamento_status).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabela de auditoria (idempotente)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orcamento_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id  UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  team_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  changed_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  old_status    TEXT NOT NULL,
  new_status    TEXT NOT NULL,
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orcamento_history_orcamento_id ON public.orcamento_history (orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_history_team_id      ON public.orcamento_history (team_id);

-- RLS: team_isolation RESTRICTIVE (padrão de todas as novas tabelas)
ALTER TABLE public.orcamento_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_isolation ON public.orcamento_history;
CREATE POLICY team_isolation ON public.orcamento_history
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (team_id = (SELECT team_id FROM public.users WHERE id = (SELECT auth.uid())));

-- ---------------------------------------------------------------------------
-- 2. Função RPC (CREATE OR REPLACE — idempotente)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_orcamento_status(
  p_orcamento_id  UUID,
  p_new_status    public.orcamento_status,
  p_comment       TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID := (SELECT auth.uid());
  v_role        public.user_role;
  v_orcamento   RECORD;
  v_old_status  public.orcamento_status;
  v_notif_title   TEXT;
  v_notif_message TEXT;
BEGIN
  -- 1. Autenticação obrigatória
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Não autenticado.');
  END IF;

  -- 2. Role do chamador
  SELECT role INTO v_role
    FROM public.users
   WHERE id = v_caller_id;

  -- 3. Buscar orçamento com isolamento de tenant
  SELECT id, team_id, technician_id, status, titulo
    INTO v_orcamento
    FROM public.orcamentos
   WHERE id = p_orcamento_id
     AND team_id = get_caller_team_id();

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Orçamento não encontrado.');
  END IF;

  v_old_status := v_orcamento.status;

  -- 4. RBAC — transições permitidas por papel
  IF p_new_status = 'enviado' THEN
    -- Técnico dono OU gestor/admin/master/supervisor pode enviar
    IF NOT (
      v_orcamento.technician_id = v_caller_id
      OR v_role IN ('Gestor', 'Admin', 'Master', 'Supervisor')
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Permissão negada.');
    END IF;
    IF v_old_status <> 'rascunho' THEN
      RETURN json_build_object('success', false, 'error', 'Apenas orçamentos em rascunho podem ser enviados.');
    END IF;

  ELSIF p_new_status IN ('aprovado', 'rejeitado') THEN
    -- Apenas gestores/admins/master/supervisor podem aprovar ou rejeitar
    IF v_role NOT IN ('Gestor', 'Admin', 'Master', 'Supervisor') THEN
      RETURN json_build_object('success', false, 'error', 'Permissão negada.');
    END IF;
    IF v_old_status <> 'enviado' THEN
      RETURN json_build_object('success', false, 'error', 'Apenas orçamentos enviados podem ser aprovados ou rejeitados.');
    END IF;

  ELSE
    RETURN json_build_object('success', false, 'error', 'Transição de status inválida.');
  END IF;

  -- 5. Atualizar status
  UPDATE public.orcamentos
     SET status           = p_new_status,
         rejection_reason = CASE
                              WHEN p_new_status = 'rejeitado' THEN p_comment
                              ELSE NULL
                            END
   WHERE id = p_orcamento_id;

  -- 6. Auditoria
  INSERT INTO public.orcamento_history
    (orcamento_id, team_id, changed_by, old_status, new_status, comment)
  VALUES
    (p_orcamento_id, v_orcamento.team_id, v_caller_id,
     v_old_status::TEXT, p_new_status::TEXT, p_comment);

  -- 7. Notificação ao técnico dono
  IF p_new_status = 'aprovado' THEN
    v_notif_title   := 'Orçamento Aprovado';
    v_notif_message := 'Seu orçamento "' || COALESCE(v_orcamento.titulo, 'sem título') || '" foi aprovado!';
  ELSIF p_new_status = 'rejeitado' THEN
    v_notif_title   := 'Orçamento Rejeitado';
    v_notif_message := 'Seu orçamento "' || COALESCE(v_orcamento.titulo, 'sem título')
                       || '" foi rejeitado. Motivo: ' || COALESCE(p_comment, 'Não informado.');
  ELSE -- enviado
    v_notif_title   := 'Orçamento Enviado para Aprovação';
    v_notif_message := 'O orçamento "' || COALESCE(v_orcamento.titulo, 'sem título')
                       || '" foi enviado para aprovação.';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, is_read)
  VALUES (v_orcamento.technician_id, v_notif_title, v_notif_message, false);

  RETURN json_build_object('success', true, 'new_status', p_new_status::TEXT);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Segurança da função — fechar acesso anônimo
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.process_orcamento_status(UUID, public.orcamento_status, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_orcamento_status(UUID, public.orcamento_status, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.process_orcamento_status(UUID, public.orcamento_status, TEXT) TO authenticated;
