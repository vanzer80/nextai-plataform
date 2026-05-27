-- ============================================================
--  Módulo Contas a Pagar (CP)
--  Fase 3 — Portal Mopar / NextAI
--  Inclui: payables, payable_comments, payable_installments
--          triggers de criação automática a partir de:
--            • reembolsos aprovados
--            • materiais comprados
--            • orçamentos aprovados
--  Fluxo de aprovação: rascunho → pendente → aprovado → pago / rejeitado
--  Roteamento por valor:
--    < R$ 500   → qualquer Gestor/Admin/Master
--    ≥ R$ 500   → apenas Admin/Master
--    ≥ R$ 5.000 → apenas Master
-- ============================================================

-- ── Payables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,

  -- Classificação
  tipo            TEXT NOT NULL CHECK (tipo IN (
    'fornecedor','reembolso','material','servico','imposto','aluguel',
    'salario','folha_pagamento','outro'
  )),
  categoria       TEXT,                 -- custom grouping
  descricao       TEXT NOT NULL,
  observacoes     TEXT,

  -- Referências automáticas
  reimbursement_id  UUID REFERENCES public.reimbursements(id)   ON DELETE SET NULL,
  material_id       UUID REFERENCES public.material_requests(id) ON DELETE SET NULL,
  orcamento_id      UUID REFERENCES public.service_reports(id)   ON DELETE SET NULL,
  payroll_period_id UUID REFERENCES public.payroll_periods(id)   ON DELETE SET NULL,
  supplier_id       UUID REFERENCES public.suppliers(id)         ON DELETE SET NULL,

  -- Valor
  valor_total     NUMERIC(14,2) NOT NULL CHECK (valor_total > 0),
  moeda           CHAR(3)        NOT NULL DEFAULT 'BRL',
  numero_parcelas INTEGER        NOT NULL DEFAULT 1 CHECK (numero_parcelas BETWEEN 1 AND 60),

  -- Datas
  data_emissao    DATE           NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE           NOT NULL,
  data_pagamento  DATE,

  -- Documentos
  nota_fiscal     TEXT,
  nf_numero       TEXT,
  nf_chave        TEXT,

  -- Aprovação
  status          TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN (
    'rascunho','pendente','aprovado','pago','rejeitado','cancelado'
  )),
  approval_level  TEXT CHECK (approval_level IN ('gestor','admin','master')),
  submitted_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  submitted_at    TIMESTAMPTZ,
  approved_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  rejected_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  rejected_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  paid_by         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  paid_at         TIMESTAMPTZ,

  -- Banco / Pagamento
  forma_pagamento TEXT CHECK (forma_pagamento IN ('pix','boleto','ted','doc','cheque','dinheiro','cartao','outro')),
  pix_key         TEXT,
  banco_destino   TEXT,
  agencia_destino TEXT,
  conta_destino   TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payables_team_status     ON public.payables(team_id, status);
CREATE INDEX idx_payables_vencimento      ON public.payables(data_vencimento);
CREATE INDEX idx_payables_supplier        ON public.payables(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_payables_reimbursement   ON public.payables(reimbursement_id) WHERE reimbursement_id IS NOT NULL;
CREATE INDEX idx_payables_material        ON public.payables(material_id) WHERE material_id IS NOT NULL;

-- ── Payable Installments (parcelas) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payable_installments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_id      UUID NOT NULL REFERENCES public.payables(id) ON DELETE CASCADE,
  team_id         UUID NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
  numero          INTEGER NOT NULL CHECK (numero >= 1),
  valor           NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  data_vencimento DATE NOT NULL,
  data_pagamento  DATE,
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','atrasado')),
  comprovante_url TEXT,
  paid_by         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(payable_id, numero)
);

CREATE INDEX idx_installments_payable    ON public.payable_installments(payable_id);
CREATE INDEX idx_installments_vencimento ON public.payable_installments(data_vencimento);
CREATE INDEX idx_installments_status     ON public.payable_installments(status);

-- ── Payable Comments ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payable_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_id  UUID NOT NULL REFERENCES public.payables(id) ON DELETE CASCADE,
  team_id     UUID NOT NULL REFERENCES public.teams(id)    ON DELETE CASCADE,
  user_id     UUID REFERENCES public.users(id)             ON DELETE SET NULL,
  content     TEXT NOT NULL,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payable_comments_payable ON public.payable_comments(payable_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payables_updated_at') THEN
    CREATE TRIGGER trg_payables_updated_at
      BEFORE UPDATE ON public.payables
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_installments_updated_at') THEN
    CREATE TRIGGER trg_installments_updated_at
      BEFORE UPDATE ON public.payable_installments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ── Auto-create installments when payable is inserted ────────────────────────

CREATE OR REPLACE FUNCTION create_payable_installments()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  i              INTEGER;
  parcela_valor  NUMERIC(14,2);
  parcela_data   DATE;
BEGIN
  -- Only create installments for multi-parcel payables
  IF NEW.numero_parcelas <= 1 THEN
    INSERT INTO public.payable_installments
      (payable_id, team_id, numero, valor, data_vencimento, status)
    VALUES
      (NEW.id, NEW.team_id, 1, NEW.valor_total, NEW.data_vencimento, 'pendente');
  ELSE
    parcela_valor := ROUND(NEW.valor_total / NEW.numero_parcelas, 2);
    FOR i IN 1..NEW.numero_parcelas LOOP
      parcela_data := NEW.data_vencimento + ((i - 1) * INTERVAL '1 month');
      INSERT INTO public.payable_installments
        (payable_id, team_id, numero, valor, data_vencimento, status)
      VALUES (
        NEW.id, NEW.team_id, i,
        CASE WHEN i = NEW.numero_parcelas
          THEN NEW.valor_total - (parcela_valor * (NEW.numero_parcelas - 1))
          ELSE parcela_valor
        END,
        parcela_data, 'pendente'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_installments
  AFTER INSERT ON public.payables
  FOR EACH ROW EXECUTE FUNCTION create_payable_installments();

-- ── Auto-create payable from approved reimbursement ──────────────────────────

CREATE OR REPLACE FUNCTION payable_from_reimbursement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_team_id UUID;
BEGIN
  -- Fires when status changes to 'aprovado'
  IF OLD.status <> 'aprovado' AND NEW.status = 'aprovado' THEN
    SELECT team_id INTO v_team_id FROM public.users WHERE id = NEW.user_id LIMIT 1;
    IF v_team_id IS NULL THEN
      SELECT tm.team_id INTO v_team_id
        FROM public.team_members tm WHERE tm.user_id = NEW.user_id LIMIT 1;
    END IF;

    IF v_team_id IS NOT NULL THEN
      INSERT INTO public.payables (
        team_id, tipo, descricao, valor_total,
        data_vencimento, status, reimbursement_id,
        submitted_by, submitted_at
      ) VALUES (
        v_team_id, 'reembolso',
        COALESCE(NEW.description, 'Reembolso aprovado'),
        NEW.total_amount,
        CURRENT_DATE + INTERVAL '5 days',
        'aprovado',
        NEW.id,
        NEW.user_id,
        NOW()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payable_from_reimbursement') THEN
    CREATE TRIGGER trg_payable_from_reimbursement
      AFTER UPDATE ON public.reimbursements
      FOR EACH ROW EXECUTE FUNCTION payable_from_reimbursement();
  END IF;
END $$;

-- ── Auto-create payable from purchased material ───────────────────────────────

CREATE OR REPLACE FUNCTION payable_from_material()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Fires when status changes to 'comprado'
  IF OLD.status <> 'comprado' AND NEW.status = 'comprado' AND NEW.purchase_cost IS NOT NULL THEN
    INSERT INTO public.payables (
      team_id, tipo, descricao, valor_total,
      data_vencimento, status, material_id,
      supplier_id, submitted_at
    ) VALUES (
      NEW.team_id, 'material',
      COALESCE(NEW.description, 'Material comprado'),
      NEW.purchase_cost,
      CURRENT_DATE + INTERVAL '30 days',
      'pendente',
      NEW.id,
      NEW.supplier_id,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payable_from_material') THEN
    CREATE TRIGGER trg_payable_from_material
      AFTER UPDATE ON public.material_requests
      FOR EACH ROW EXECUTE FUNCTION payable_from_material();
  END IF;
END $$;

-- ── RPCs ──────────────────────────────────────────────────────────────────────

-- Submit payable for approval (sets approval_level based on value)
CREATE OR REPLACE FUNCTION submit_payable(p_payable_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_valor   NUMERIC;
  v_level   TEXT;
  v_user_id UUID;
BEGIN
  SELECT valor_total INTO v_valor FROM public.payables WHERE id = p_payable_id;
  v_user_id := auth.uid();

  IF v_valor < 500     THEN v_level := 'gestor';
  ELSIF v_valor < 5000 THEN v_level := 'admin';
  ELSE                      v_level := 'master';
  END IF;

  UPDATE public.payables
  SET status = 'pendente', approval_level = v_level,
      submitted_by = v_user_id, submitted_at = NOW()
  WHERE id = p_payable_id;

  INSERT INTO public.payable_comments (payable_id, team_id, user_id, content, is_system)
  SELECT p_payable_id, team_id, v_user_id,
    FORMAT('Enviado para aprovação (%s). Nível requerido: %s', TO_CHAR(v_valor,'FM"R$"999G999G990D00'), v_level),
    TRUE
  FROM public.payables WHERE id = p_payable_id;
END;
$$;

-- Approve payable
CREATE OR REPLACE FUNCTION approve_payable(p_payable_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  UPDATE public.payables
  SET status = 'aprovado', approved_by = v_user_id, approved_at = NOW()
  WHERE id = p_payable_id;

  INSERT INTO public.payable_comments (payable_id, team_id, user_id, content, is_system)
  SELECT p_payable_id, team_id, v_user_id,
    COALESCE(p_notes, 'Pagamento aprovado.'), FALSE
  FROM public.payables WHERE id = p_payable_id;
END;
$$;

-- Reject payable
CREATE OR REPLACE FUNCTION reject_payable(p_payable_id UUID, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  UPDATE public.payables
  SET status = 'rejeitado', rejected_by = v_user_id, rejected_at = NOW(),
      rejection_reason = p_reason
  WHERE id = p_payable_id;

  INSERT INTO public.payable_comments (payable_id, team_id, user_id, content, is_system)
  SELECT p_payable_id, team_id, v_user_id,
    FORMAT('Pagamento rejeitado: %s', p_reason), FALSE
  FROM public.payables WHERE id = p_payable_id;
END;
$$;

-- Mark payable/installment as paid
CREATE OR REPLACE FUNCTION pay_payable(p_payable_id UUID, p_installment_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id      UUID;
  v_all_paid     BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  IF p_installment_id IS NOT NULL THEN
    -- Mark single installment paid
    UPDATE public.payable_installments
    SET status = 'pago', data_pagamento = CURRENT_DATE, paid_by = v_user_id
    WHERE id = p_installment_id;

    -- Check if all installments are now paid
    SELECT BOOL_AND(status = 'pago') INTO v_all_paid
    FROM public.payable_installments WHERE payable_id = p_payable_id;

    IF v_all_paid THEN
      UPDATE public.payables
      SET status = 'pago', paid_by = v_user_id, paid_at = NOW(), data_pagamento = CURRENT_DATE
      WHERE id = p_payable_id;
    END IF;
  ELSE
    -- Mark all installments and payable paid
    UPDATE public.payable_installments
    SET status = 'pago', data_pagamento = CURRENT_DATE, paid_by = v_user_id
    WHERE payable_id = p_payable_id;

    UPDATE public.payables
    SET status = 'pago', paid_by = v_user_id, paid_at = NOW(), data_pagamento = CURRENT_DATE
    WHERE id = p_payable_id;
  END IF;

  INSERT INTO public.payable_comments (payable_id, team_id, user_id, content, is_system)
  SELECT p_payable_id, team_id, v_user_id, 'Pagamento registrado.', FALSE
  FROM public.payables WHERE id = p_payable_id;
END;
$$;

-- ── Aging report RPC ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_aging_report(p_team_id UUID)
RETURNS TABLE (
  bucket        TEXT,
  count         BIGINT,
  total_valor   NUMERIC,
  min_venc      DATE,
  max_venc      DATE
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    CASE
      WHEN data_vencimento > CURRENT_DATE              THEN 'a_vencer'
      WHEN CURRENT_DATE - data_vencimento BETWEEN 1 AND 30  THEN '1_30_dias'
      WHEN CURRENT_DATE - data_vencimento BETWEEN 31 AND 60 THEN '31_60_dias'
      WHEN CURRENT_DATE - data_vencimento BETWEEN 61 AND 90 THEN '61_90_dias'
      ELSE 'acima_90_dias'
    END AS bucket,
    COUNT(*),
    SUM(valor_total),
    MIN(data_vencimento),
    MAX(data_vencimento)
  FROM public.payables
  WHERE team_id = p_team_id
    AND status NOT IN ('pago','cancelado','rejeitado')
  GROUP BY 1
  ORDER BY
    CASE WHEN bucket = 'a_vencer' THEN 0
         WHEN bucket = '1_30_dias' THEN 1
         WHEN bucket = '31_60_dias' THEN 2
         WHEN bucket = '61_90_dias' THEN 3
         ELSE 4 END;
$$;

-- Cash flow projection (next 90 days)
CREATE OR REPLACE FUNCTION get_cashflow_projection(p_team_id UUID, p_days INTEGER DEFAULT 90)
RETURNS TABLE (
  semana        DATE,
  total_previsto NUMERIC,
  total_pago    NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    DATE_TRUNC('week', i.data_vencimento)::DATE AS semana,
    SUM(CASE WHEN i.status <> 'pago' THEN i.valor ELSE 0 END) AS total_previsto,
    SUM(CASE WHEN i.status = 'pago'  THEN i.valor ELSE 0 END) AS total_pago
  FROM public.payable_installments i
  JOIN public.payables p ON p.id = i.payable_id
  WHERE p.team_id = p_team_id
    AND i.data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days * INTERVAL '1 day')
  GROUP BY 1
  ORDER BY 1;
$$;

-- ── RLS Policies ──────────────────────────────────────────────────────────────

ALTER TABLE public.payables               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payable_installments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payable_comments       ENABLE ROW LEVEL SECURITY;

-- payables
CREATE POLICY payables_select ON public.payables
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY payables_insert ON public.payables
  FOR INSERT WITH CHECK (team_id = get_my_team_id());

CREATE POLICY payables_update ON public.payables
  FOR UPDATE USING (team_id = get_my_team_id());

CREATE POLICY payables_delete ON public.payables
  FOR DELETE USING (
    team_id = get_my_team_id()
    AND status IN ('rascunho','rejeitado','cancelado')
  );

-- payable_installments
CREATE POLICY installments_select ON public.payable_installments
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY installments_update ON public.payable_installments
  FOR UPDATE USING (team_id = get_my_team_id());

-- payable_comments
CREATE POLICY comments_select ON public.payable_comments
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY comments_insert ON public.payable_comments
  FOR INSERT WITH CHECK (team_id = get_my_team_id());

-- ── Grants ────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION submit_payable(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_payable(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_payable(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION pay_payable(UUID, UUID)    TO authenticated;
GRANT EXECUTE ON FUNCTION get_aging_report(UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION get_cashflow_projection(UUID, INTEGER) TO authenticated;
