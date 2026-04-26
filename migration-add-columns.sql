-- ===========================================================================
-- MIGRATION: Melhorias de Estrutura do Portal Mopar
-- EXECUTE NO SQL EDITOR DO SUPABASE
-- ===========================================================================

-- 1. ADICIONAR STATUS Revisao AO ENUM (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Revisao'
      AND enumtypid = 'public.reimbursement_status'::regtype
  ) THEN
    BEGIN
      ALTER TYPE public.reimbursement_status ADD VALUE 'Revisao';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;

-- 2. ADICIONAR COLUNAS SEPARADAS (idempotente)
ALTER TABLE public.reimbursements ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.reimbursements ADD COLUMN IF NOT EXISTS revision_reason TEXT;
ALTER TABLE public.reimbursements ADD COLUMN IF NOT EXISTS favorecido TEXT;
ALTER TABLE public.reimbursements ADD COLUMN IF NOT EXISTS pix_key TEXT;

-- 3. MIGRAR DADOS - Extrair favorecido do description
UPDATE public.reimbursements
   SET favorecido = trim(substring(description FROM 'Favorecido:\s*([^\n]+)'))
 WHERE favorecido IS NULL
   AND description ~ 'Favorecido:';

-- Extrair pix_key do description
UPDATE public.reimbursements
   SET pix_key = trim(substring(description FROM 'Chave PIX:\s*([^\n]+)'))
 WHERE pix_key IS NULL
   AND description ~ 'Chave PIX:';

-- Extrair rejection_reason do description
UPDATE public.reimbursements
   SET rejection_reason = trim(substring(description FROM '\[REPROVADO:\s*([^\]]+)\]'))
 WHERE rejection_reason IS NULL
   AND description ~ '\[REPROVADO:';

-- Extrair revision_reason do description
UPDATE public.reimbursements
   SET revision_reason = trim(substring(description FROM '\[REVISAO:\s*([^\]]+)\]'))
 WHERE revision_reason IS NULL
   AND description ~ '\[REVISAO:';

-- Limpar o campo description dos dados redundantes
UPDATE public.reimbursements
   SET description = trim(
     regexp_replace(
       regexp_replace(
         regexp_replace(
           regexp_replace(description,
             '\[REPROVADO:\s*[^\]]*\]\s*\n\n', '', 'g'),
           '\[REVISAO:\s*[^\]]*\]\s*\n\n', '', 'g'),
         'Favorecido:\s*[^\n]*', '', 'g'),
       'Chave PIX:\s*[^\n]*', '', 'g')
   )
 WHERE description ~ '(Favorecido:|Chave PIX:|\[REPROVADO:|\[REVISAO:)';

-- 4. DROPAR FUNCOES ANTIGAS E RECRIAR
DROP FUNCTION IF EXISTS public.process_reimbursement_action(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.process_reimbursement_action(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.process_reimbursement_action(
  p_reimbursement_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.user_role;
  v_reimb RECORD;
  v_notif_title TEXT;
  v_notif_message TEXT;
BEGIN
  SELECT u.role INTO v_caller_role
    FROM public.users u
   WHERE u.id = auth.uid();

  IF v_caller_role NOT IN ('Gestor', 'Admin', 'Supervisor', 'Financeiro') THEN
    RETURN json_build_object('success', false, 'error', 'Permissao negada. Apenas gestores podem processar reembolsos.');
  END IF;

  IF p_action NOT IN ('Aprovado', 'Rejeitado', 'Revisao') THEN
    RETURN json_build_object('success', false, 'error', 'Acao invalida.');
  END IF;

  SELECT * INTO v_reimb FROM public.reimbursements WHERE id = p_reimbursement_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reembolso nao encontrado.');
  END IF;

  IF v_reimb.status NOT IN ('Pendente', 'Revisao') THEN
    RETURN json_build_object('success', false, 'error', 'Este reembolso ja foi processado.');
  END IF;

  UPDATE public.reimbursements
     SET status = p_action::public.reimbursement_status,
         rejection_reason = CASE WHEN p_action = 'Rejeitado' THEN p_reason ELSE rejection_reason END,
         revision_reason  = CASE WHEN p_action = 'Revisao'   THEN p_reason ELSE revision_reason END
   WHERE id = p_reimbursement_id;

  -- 3.5 Inserir no historico (Auditoria)
  INSERT INTO public.reimbursement_history (reimbursement_id, changed_by, old_status, new_status, reason)
  VALUES (p_reimbursement_id, auth.uid(), v_reimb.status, p_action, p_reason);

  IF p_action = 'Aprovado' THEN
    v_notif_title   := 'Reembolso Aprovado';
    v_notif_message := 'Sua solicitacao de R$ ' || to_char(v_reimb.amount, 'FM999990.00') || ' (' || v_reimb.category || ') foi aprovada!';
  ELSIF p_action = 'Rejeitado' THEN
    v_notif_title   := 'Reembolso Reprovado';
    v_notif_message := 'Sua solicitacao de R$ ' || to_char(v_reimb.amount, 'FM999990.00') || ' (' || v_reimb.category || ') foi reprovada. Motivo: ' || COALESCE(p_reason, 'Nao informado.');
  ELSE
    v_notif_title   := 'Ajuste Solicitado';
    v_notif_message := 'Sua solicitacao de R$ ' || to_char(v_reimb.amount, 'FM999990.00') || ' (' || v_reimb.category || ') precisa de ajuste: ' || COALESCE(p_reason, 'Verifique os detalhes.');
  END IF;

  INSERT INTO public.notifications (user_id, title, message, is_read)
  VALUES (v_reimb.user_id, v_notif_title, v_notif_message, false);

  RETURN json_build_object('success', true, 'action', p_action);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 5. PERMISSOES
GRANT EXECUTE ON FUNCTION public.process_reimbursement_action(UUID, TEXT, TEXT) TO authenticated;

-- 6. TABELA DE HISTORICO (Auditoria)
CREATE TABLE IF NOT EXISTS public.reimbursement_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reimbursement_id UUID NOT NULL REFERENCES public.reimbursements(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reimbursement_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reimbursement_history'
      AND policyname = 'Users can view history of own reimbursements'
  ) THEN
    CREATE POLICY "Users can view history of own reimbursements"
      ON public.reimbursement_history FOR SELECT
      USING (
        reimbursement_id IN (
          SELECT id FROM public.reimbursements WHERE user_id = auth.uid()
        )
        OR public.is_manager_or_admin()
      );
  END IF;
END;
$$;

-- 7. VERIFICACAO FINAL
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'reimbursements'
   AND table_schema = 'public'
 ORDER BY ordinal_position;

-- ADICIONAR COLUNA DE TELEFONE PARA WHATSAPP
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
