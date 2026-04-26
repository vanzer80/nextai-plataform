-- ===========================================================================
-- FUNÇÃO RPC: process_reimbursement_action
-- Versão canônica (2026-04-25) — deployada via migration canonize_process_reimbursement_action
-- Roles permitidos: Gestor, Admin, Supervisor, Financeiro, Master
-- Inclui: INSERT em reimbursement_history (auditoria)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.process_reimbursement_action(
  p_reimbursement_id UUID,
  p_action           TEXT,
  p_reason           TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.user_role;
  v_reimb       RECORD;
  v_notif_title   TEXT;
  v_notif_message TEXT;
BEGIN
  -- 1. Role do chamador
  SELECT u.role INTO v_caller_role
    FROM public.users u
   WHERE u.id = auth.uid();

  -- 2. RBAC
  IF v_caller_role NOT IN ('Gestor', 'Admin', 'Supervisor', 'Financeiro', 'Master') THEN
    RETURN json_build_object('success', false, 'error', 'Permissao negada.');
  END IF;

  -- 3. Acao válida
  IF p_action NOT IN ('Aprovado', 'Rejeitado', 'Revisao') THEN
    RETURN json_build_object('success', false, 'error', 'Acao invalida.');
  END IF;

  -- 4. Buscar reembolso
  SELECT * INTO v_reimb FROM public.reimbursements WHERE id = p_reimbursement_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reembolso nao encontrado.');
  END IF;

  IF v_reimb.status NOT IN ('Pendente', 'Revisao') THEN
    RETURN json_build_object('success', false, 'error', 'Reembolso ja processado.');
  END IF;

  -- 5. Atualizar status
  IF p_action = 'Rejeitado' THEN
    UPDATE public.reimbursements
       SET status           = 'Rejeitado'::public.reimbursement_status,
           rejection_reason = p_reason,
           revision_reason  = NULL
     WHERE id = p_reimbursement_id;
  ELSIF p_action = 'Revisao' THEN
    UPDATE public.reimbursements
       SET status           = 'Revisao'::public.reimbursement_status,
           revision_reason  = p_reason,
           rejection_reason = NULL
     WHERE id = p_reimbursement_id;
  ELSE
    UPDATE public.reimbursements
       SET status           = 'Aprovado'::public.reimbursement_status,
           rejection_reason = NULL,
           revision_reason  = NULL
     WHERE id = p_reimbursement_id;
  END IF;

  -- 6. Auditoria
  INSERT INTO public.reimbursement_history
    (reimbursement_id, changed_by, old_status, new_status, reason)
  VALUES
    (p_reimbursement_id, auth.uid(), v_reimb.status::TEXT, p_action, p_reason);

  -- 7. Notificação ao solicitante
  IF p_action = 'Aprovado' THEN
    v_notif_title   := 'Reembolso Aprovado';
    v_notif_message := 'Sua solicitacao de R$ ' || to_char(v_reimb.amount, 'FM999990.00')
                       || ' (' || v_reimb.category || ') foi aprovada!';
  ELSIF p_action = 'Rejeitado' THEN
    v_notif_title   := 'Reembolso Reprovado';
    v_notif_message := 'Sua solicitacao foi reprovada. Motivo: '
                       || COALESCE(p_reason, 'Nao informado.');
  ELSE
    v_notif_title   := 'Reembolso Devolvido para Ajuste';
    v_notif_message := 'Sua solicitacao foi devolvida. Motivo: '
                       || COALESCE(p_reason, 'Nao informado.');
  END IF;

  INSERT INTO public.notifications (user_id, title, message, is_read)
  VALUES (v_reimb.user_id, v_notif_title, v_notif_message, false);

  RETURN json_build_object('success', true, 'action', p_action);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_reimbursement_action(UUID, TEXT, TEXT) TO authenticated;
