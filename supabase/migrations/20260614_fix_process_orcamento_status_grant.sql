-- ===========================================================================
-- Migration: fix_process_orcamento_status_grant
-- Root cause: orcamento_history tem RLS com apenas policy RESTRICTIVE
-- (sem nenhuma PERMISSIVE) → INSERT pelo authenticated falha com
-- 42501 permission_denied → PostgREST devolve HTTP 403.
-- Fix: SECURITY DEFINER (roda como postgres/BYPASSRLS).
-- Mantém TEXT no parâmetro (não cria overload).
-- Usa from_status/to_status = nomes reais das colunas da tabela.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.process_orcamento_status(
  p_orcamento_id UUID,
  p_new_status   TEXT,
  p_comment      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller_id    UUID   := (SELECT auth.uid());
  v_orcamento    RECORD;
  v_caller       RECORD;
  v_title        TEXT;
  v_message      TEXT;
  v_target_roles TEXT[];
  v_old_status   TEXT;
BEGIN
  -- 1. Auth guard
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado.');
  END IF;

  -- 2. Buscar orçamento com isolamento de tenant
  SELECT o.*, c.name AS client_name
    INTO v_orcamento
    FROM public.orcamentos o
    LEFT JOIN public.clients c ON c.id = o.client_id
   WHERE o.id      = p_orcamento_id
     AND o.team_id = get_caller_team_id();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orçamento não encontrado.');
  END IF;

  v_old_status := v_orcamento.status::TEXT;

  IF v_old_status = p_new_status THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status já é ' || p_new_status);
  END IF;

  -- 3. Dados do chamador
  SELECT id, full_name, role, team_id
    INTO v_caller
    FROM public.users
   WHERE id = v_caller_id;

  -- 4. RBAC + transições permitidas
  CASE p_new_status
    WHEN 'enviado' THEN
      IF NOT (
        v_orcamento.technician_id = v_caller_id
        OR v_caller.role::TEXT = ANY(ARRAY['Gestor', 'Admin', 'Master', 'Supervisor'])
      ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permissão negada.');
      END IF;
      IF v_old_status <> 'rascunho' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas orçamentos em rascunho podem ser enviados.');
      END IF;
      v_title        := 'Orçamento enviado para aprovação';
      v_message      := 'Orçamento para ' || COALESCE(v_orcamento.client_name, 'cliente') ||
                        ' foi enviado por ' || COALESCE(v_caller.full_name, 'usuário') ||
                        ' e aguarda aprovação.' ||
                        CASE WHEN p_comment IS NOT NULL THEN ' Obs: ' || p_comment ELSE '' END;
      v_target_roles := ARRAY['Gestor', 'Admin', 'Master'];

    WHEN 'aprovado' THEN
      IF v_caller.role::TEXT NOT IN ('Gestor', 'Admin', 'Master', 'Supervisor') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permissão negada.');
      END IF;
      IF v_old_status <> 'enviado' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas orçamentos enviados podem ser aprovados.');
      END IF;
      v_title        := 'Orçamento aprovado';
      v_message      := 'Orçamento para ' || COALESCE(v_orcamento.client_name, 'cliente') ||
                        ' foi aprovado por ' || COALESCE(v_caller.full_name, 'usuário') || '.' ||
                        CASE WHEN p_comment IS NOT NULL THEN ' Obs: ' || p_comment ELSE '' END;
      v_target_roles := ARRAY['Técnico', 'Supervisor', 'Gestor', 'Admin', 'Master'];

    WHEN 'rejeitado' THEN
      IF v_caller.role::TEXT NOT IN ('Gestor', 'Admin', 'Master', 'Supervisor') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Permissão negada.');
      END IF;
      IF v_old_status <> 'enviado' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas orçamentos enviados podem ser rejeitados.');
      END IF;
      v_title        := 'Orçamento rejeitado';
      v_message      := 'Orçamento para ' || COALESCE(v_orcamento.client_name, 'cliente') ||
                        ' foi rejeitado por ' || COALESCE(v_caller.full_name, 'usuário') || '.' ||
                        CASE WHEN p_comment IS NOT NULL THEN ' Motivo: ' || p_comment ELSE '' END;
      v_target_roles := ARRAY['Técnico', 'Supervisor'];

    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Status inválido: ' || p_new_status);
  END CASE;

  -- 5. Atualizar status (SECURITY DEFINER bypassa RLS — isolamento garantido pelo guard do passo 2)
  UPDATE public.orcamentos
     SET status     = p_new_status::public.orcamento_status,
         updated_at = now()
   WHERE id      = p_orcamento_id
     AND team_id = v_orcamento.team_id;

  -- 6. Auditoria (from_status/to_status = nomes reais das colunas da tabela)
  INSERT INTO public.orcamento_history
    (orcamento_id, team_id, changed_by, from_status, to_status, comment)
  VALUES
    (p_orcamento_id, v_orcamento.team_id, v_caller_id,
     v_old_status, p_new_status, p_comment);

  -- 7. Notificações para os roles relevantes
  INSERT INTO public.notifications (user_id, title, message, is_read, team_id)
  SELECT u.id, v_title, v_message, false, v_caller.team_id
    FROM public.users u
   WHERE u.team_id    = v_caller.team_id
     AND u.role::TEXT = ANY(v_target_roles)
     AND u.id        <> v_caller_id;

  RETURN jsonb_build_object('success', true, 'orcamento_id', p_orcamento_id, 'new_status', p_new_status);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Fechar acesso anônimo (armadilha #48: REVOKE FROM PUBLIC + FROM anon)
REVOKE EXECUTE ON FUNCTION public.process_orcamento_status(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_orcamento_status(UUID, TEXT, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.process_orcamento_status(UUID, TEXT, TEXT) TO authenticated;
