-- Migration: DP Module — Departamento Pessoal (Enterprise)
-- Tables: payroll_periods, payroll_entries, time_records, vacation_schedules
-- Function: calculate_payroll_entry (INSS/IRRF/FGTS 2024)

-- ── 1. payroll_periods ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  competencia   DATE        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'aberta'
    CHECK(status IN ('aberta','calculada','fechada','paga')),
  observacao    TEXT,
  calculated_at TIMESTAMPTZ,
  closed_at     TIMESTAMPTZ,
  created_by    UUID        REFERENCES public.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, competencia)
);

-- ── 2. payroll_entries ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_entries (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id                   UUID        NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id                 UUID        NOT NULL REFERENCES public.employees(id),
  team_id                     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Provento base
  salario_base                NUMERIC(12,2) NOT NULL,
  dias_trabalhados            INTEGER     NOT NULL DEFAULT 30,
  horas_extras_50             NUMERIC(8,2) NOT NULL DEFAULT 0,
  horas_extras_100            NUMERIC(8,2) NOT NULL DEFAULT 0,
  adicional_noturno_horas     NUMERIC(8,2) NOT NULL DEFAULT 0,
  adicional_periculosidade    BOOLEAN     NOT NULL DEFAULT false,
  adicional_insalubridade     TEXT        NOT NULL DEFAULT 'nenhum'
    CHECK(adicional_insalubridade IN ('nenhum','10','20','40')),
  outros_proventos            JSONB       NOT NULL DEFAULT '[]',

  -- Descontos extras
  faltas_dias                 INTEGER     NOT NULL DEFAULT 0,
  outros_descontos            JSONB       NOT NULL DEFAULT '[]',

  -- Calculados por calculate_payroll_entry()
  vencimentos_bruto           NUMERIC(12,2),
  horas_extras_valor          NUMERIC(12,2),
  adicional_noturno_valor     NUMERIC(12,2),
  adicional_periculosidade_valor NUMERIC(12,2),
  adicional_insalubridade_valor  NUMERIC(12,2),
  inss_base                   NUMERIC(12,2),
  inss_aliquota               NUMERIC(5,4),
  inss_valor                  NUMERIC(12,2),
  irrf_base                   NUMERIC(12,2),
  irrf_aliquota               NUMERIC(5,4),
  irrf_valor                  NUMERIC(12,2),
  fgts_valor                  NUMERIC(12,2),
  vt_desconto                 NUMERIC(12,2),
  salario_liquido             NUMERIC(12,2),

  -- Eventos especiais (opcionais)
  ferias_gozo_inicio          DATE,
  ferias_gozo_fim             DATE,
  ferias_abono_dias           INTEGER     DEFAULT 0,
  ferias_valor                NUMERIC(12,2),
  decimo_terceiro_parcela     INTEGER     CHECK(decimo_terceiro_parcela IN (1, 2)),
  decimo_terceiro_valor       NUMERIC(12,2),

  -- Rescisão
  rescisao_tipo               TEXT
    CHECK(rescisao_tipo IN ('sem_justa_causa','com_justa_causa','pedido_demissao','acordo_mutuo')),
  rescisao_aviso_previo_dias  INTEGER,
  rescisao_saldo_fgts         NUMERIC(12,2),
  rescisao_multa_fgts         NUMERIC(12,2),

  pdf_url                     TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(period_id, employee_id)
);

-- ── 3. time_records ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.time_records (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID        NOT NULL REFERENCES public.employees(id),
  team_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_id           UUID        REFERENCES public.service_reports(id),
  data                DATE        NOT NULL,
  tipo                TEXT        NOT NULL DEFAULT 'normal'
    CHECK(tipo IN ('normal','hora_extra','falta','atestado','licenca','feriado','folga')),
  entrada             TEXT,
  saida               TEXT,
  intervalo_minutos   INTEGER     DEFAULT 60,
  horas_trabalhadas   NUMERIC(4,2) DEFAULT 0,
  horas_extras        NUMERIC(4,2) DEFAULT 0,
  justificativa       TEXT,
  atestado_url        TEXT,
  aprovado_por        UUID        REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, data)
);

-- ── 4. vacation_schedules ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vacation_schedules (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id                 UUID        NOT NULL REFERENCES public.employees(id),
  team_id                     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  periodo_aquisitivo_inicio   DATE        NOT NULL,
  periodo_aquisitivo_fim      DATE        NOT NULL,
  dias_direito                INTEGER     NOT NULL DEFAULT 30,
  dias_abono                  INTEGER     DEFAULT 0,
  gozo_inicio                 DATE,
  gozo_fim                    DATE,
  status                      TEXT        NOT NULL DEFAULT 'programado'
    CHECK(status IN ('programado','aprovado','em_gozo','concluido','cancelado')),
  aprovado_por                UUID        REFERENCES public.users(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. updated_at trigger ──────────────────────────────────────────────────────

CREATE TRIGGER payroll_entries_updated_at
  BEFORE UPDATE ON public.payroll_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_rh();

-- ── 6. RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.payroll_periods     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_schedules  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dp_periods_select" ON public.payroll_periods FOR SELECT USING (team_id = public.get_my_team_id());
CREATE POLICY "dp_periods_insert" ON public.payroll_periods FOR INSERT WITH CHECK (team_id = public.get_my_team_id());
CREATE POLICY "dp_periods_update" ON public.payroll_periods FOR UPDATE USING (team_id = public.get_my_team_id());
CREATE POLICY "dp_periods_delete" ON public.payroll_periods FOR DELETE USING (team_id = public.get_my_team_id());

CREATE POLICY "dp_entries_select" ON public.payroll_entries FOR SELECT USING (team_id = public.get_my_team_id());
CREATE POLICY "dp_entries_insert" ON public.payroll_entries FOR INSERT WITH CHECK (team_id = public.get_my_team_id());
CREATE POLICY "dp_entries_update" ON public.payroll_entries FOR UPDATE USING (team_id = public.get_my_team_id());
CREATE POLICY "dp_entries_delete" ON public.payroll_entries FOR DELETE USING (team_id = public.get_my_team_id());

CREATE POLICY "dp_time_select" ON public.time_records FOR SELECT USING (team_id = public.get_my_team_id());
CREATE POLICY "dp_time_insert" ON public.time_records FOR INSERT WITH CHECK (team_id = public.get_my_team_id());
CREATE POLICY "dp_time_update" ON public.time_records FOR UPDATE USING (team_id = public.get_my_team_id());
CREATE POLICY "dp_time_delete" ON public.time_records FOR DELETE USING (team_id = public.get_my_team_id());

CREATE POLICY "dp_vac_select" ON public.vacation_schedules FOR SELECT USING (team_id = public.get_my_team_id());
CREATE POLICY "dp_vac_insert" ON public.vacation_schedules FOR INSERT WITH CHECK (team_id = public.get_my_team_id());
CREATE POLICY "dp_vac_update" ON public.vacation_schedules FOR UPDATE USING (team_id = public.get_my_team_id());
CREATE POLICY "dp_vac_delete" ON public.vacation_schedules FOR DELETE USING (team_id = public.get_my_team_id());

-- ── 7. calculate_payroll_entry ─────────────────────────────────────────────────
-- Tabelas de referência 2024 (Lei 14.663/2023 — IN 2140/2023)
-- INSS Progressivo: 7.5% até R$1.412,00 | 9% até R$2.666,68 | 12% até R$4.000,03 | 14% até R$7.786,02 | teto R$908,96
-- IRRF 2024: isento até R$2.824,00 | 7.5% até R$3.751,05 (ded. R$142,80) | 15% até R$4.664,68 (ded. R$354,80)
--          | 22.5% até R$5.877,49 (ded. R$636,13) | 27.5% acima (ded. R$869,36)
-- Deducao dependente IRRF: R$189,59 por dependente (usamos 0 na ausência de dados do colaborador)
-- FGTS: 8% do salário bruto (custo patronal — informativo)
-- VT: min(6% salario_base, custo_real_vt_dia * dias_uteis)

CREATE OR REPLACE FUNCTION public.calculate_payroll_entry(p_entry_id UUID)
RETURNS public.payroll_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry  public.payroll_entries;
  v_emp    public.employees;

  -- Provento calculado
  v_hora_base             NUMERIC(12,4);
  v_he50_valor            NUMERIC(12,2);
  v_he100_valor           NUMERIC(12,2);
  v_adicional_noturno     NUMERIC(12,2);
  v_adicional_peric       NUMERIC(12,2);
  v_adicional_insalub     NUMERIC(12,2);
  v_outros_prov           NUMERIC(12,2);
  v_vencimentos_bruto     NUMERIC(12,2);

  -- INSS (progressivo)
  v_inss_base             NUMERIC(12,2);
  v_inss_valor            NUMERIC(12,2) := 0;
  v_inss_aliquota         NUMERIC(5,4);

  -- IRRF
  v_irrf_base             NUMERIC(12,2);
  v_irrf_valor            NUMERIC(12,2);
  v_irrf_aliquota         NUMERIC(5,4);

  -- FGTS (informativo)
  v_fgts                  NUMERIC(12,2);

  -- VT
  v_vt_desconto           NUMERIC(12,2);

  -- Descontos
  v_outros_desc           NUMERIC(12,2);
  v_falta_desconto        NUMERIC(12,2);

  -- Líquido
  v_liquido               NUMERIC(12,2);

  -- Salário mínimo 2024
  v_salario_minimo CONSTANT NUMERIC := 1412.00;
BEGIN
  SELECT * INTO v_entry FROM public.payroll_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry % not found', p_entry_id; END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = v_entry.employee_id;

  -- ── Hora base ──────────────────────────────────────────────────
  v_hora_base := v_entry.salario_base / 220.0;

  -- ── Horas Extras ───────────────────────────────────────────────
  v_he50_valor  := ROUND(v_hora_base * 1.5 * v_entry.horas_extras_50, 2);
  v_he100_valor := ROUND(v_hora_base * 2.0 * v_entry.horas_extras_100, 2);

  -- ── Adicional Noturno (20%) ─────────────────────────────────────
  v_adicional_noturno := ROUND(v_hora_base * 0.20 * v_entry.adicional_noturno_horas, 2);

  -- ── Adicional Periculosidade (30% salário base) ─────────────────
  IF v_entry.adicional_periculosidade THEN
    v_adicional_peric := ROUND(v_entry.salario_base * 0.30, 2);
  ELSE
    v_adicional_peric := 0;
  END IF;

  -- ── Adicional Insalubridade ─────────────────────────────────────
  -- Base: salário mínimo vigente
  CASE v_entry.adicional_insalubridade
    WHEN '10' THEN v_adicional_insalub := ROUND(v_salario_minimo * 0.10, 2);
    WHEN '20' THEN v_adicional_insalub := ROUND(v_salario_minimo * 0.20, 2);
    WHEN '40' THEN v_adicional_insalub := ROUND(v_salario_minimo * 0.40, 2);
    ELSE v_adicional_insalub := 0;
  END CASE;

  -- ── Outros Proventos ────────────────────────────────────────────
  SELECT COALESCE(SUM((item->>'valor')::NUMERIC), 0) INTO v_outros_prov
    FROM jsonb_array_elements(v_entry.outros_proventos) item;

  -- ── Vencimentos Bruto ────────────────────────────────────────────
  v_vencimentos_bruto := v_entry.salario_base
    + v_he50_valor + v_he100_valor
    + v_adicional_noturno + v_adicional_peric + v_adicional_insalub
    + v_outros_prov;

  -- Desconto de faltas proporcional
  v_falta_desconto := ROUND((v_entry.salario_base / 30.0) * v_entry.faltas_dias, 2);

  -- ── INSS Progressivo 2024 ────────────────────────────────────────
  -- Base INSS: salário base + adicionais (excluindo HE)
  v_inss_base := v_entry.salario_base + v_adicional_noturno + v_adicional_peric + v_adicional_insalub;

  IF v_inss_base <= 1412.00 THEN
    v_inss_valor    := ROUND(v_inss_base * 0.075, 2);
    v_inss_aliquota := 0.075;
  ELSIF v_inss_base <= 2666.68 THEN
    v_inss_valor := ROUND(1412.00 * 0.075 + (v_inss_base - 1412.00) * 0.09, 2);
    v_inss_aliquota := 0.09;
  ELSIF v_inss_base <= 4000.03 THEN
    v_inss_valor := ROUND(1412.00 * 0.075 + (2666.68 - 1412.00) * 0.09 + (v_inss_base - 2666.68) * 0.12, 2);
    v_inss_aliquota := 0.12;
  ELSIF v_inss_base <= 7786.02 THEN
    v_inss_valor := ROUND(1412.00 * 0.075 + (2666.68 - 1412.00) * 0.09 + (4000.03 - 2666.68) * 0.12 + (v_inss_base - 4000.03) * 0.14, 2);
    v_inss_aliquota := 0.14;
  ELSE
    -- Teto INSS 2024
    v_inss_valor    := 908.96;
    v_inss_aliquota := 0.14;
  END IF;

  -- ── IRRF Progressivo 2024 ────────────────────────────────────────
  -- Base IRRF: vencimentos bruto - INSS
  v_irrf_base := v_vencimentos_bruto - v_inss_valor;

  IF v_irrf_base <= 2824.00 THEN
    v_irrf_valor    := 0;
    v_irrf_aliquota := 0;
  ELSIF v_irrf_base <= 3751.05 THEN
    v_irrf_valor    := ROUND(v_irrf_base * 0.075 - 142.80, 2);
    v_irrf_aliquota := 0.075;
  ELSIF v_irrf_base <= 4664.68 THEN
    v_irrf_valor    := ROUND(v_irrf_base * 0.15 - 354.80, 2);
    v_irrf_aliquota := 0.15;
  ELSIF v_irrf_base <= 5877.49 THEN
    v_irrf_valor    := ROUND(v_irrf_base * 0.225 - 636.13, 2);
    v_irrf_aliquota := 0.225;
  ELSE
    v_irrf_valor    := ROUND(v_irrf_base * 0.275 - 869.36, 2);
    v_irrf_aliquota := 0.275;
  END IF;
  -- IRRF não pode ser negativo
  IF v_irrf_valor < 0 THEN v_irrf_valor := 0; END IF;

  -- ── FGTS (8% — custo patronal, informativo) ──────────────────────
  v_fgts := ROUND(v_entry.salario_base * 0.08, 2);

  -- ── VT Desconto ────────────────────────────────────────────────
  IF v_emp.vt_ativo AND v_emp.vt_valor_diario IS NOT NULL AND v_emp.vt_valor_diario > 0 THEN
    -- 22 dias úteis estimados por mês
    DECLARE v_custo_real NUMERIC := v_emp.vt_valor_diario * 22;
    DECLARE v_seis_pct   NUMERIC := ROUND(v_entry.salario_base * 0.06, 2);
    BEGIN
      v_vt_desconto := LEAST(v_seis_pct, v_custo_real);
    END;
  ELSE
    v_vt_desconto := 0;
  END IF;

  -- ── Outros Descontos ────────────────────────────────────────────
  SELECT COALESCE(SUM((item->>'valor')::NUMERIC), 0) INTO v_outros_desc
    FROM jsonb_array_elements(v_entry.outros_descontos) item;

  -- ── Salário Líquido ─────────────────────────────────────────────
  v_liquido := v_vencimentos_bruto - v_inss_valor - v_irrf_valor - v_vt_desconto - v_falta_desconto - v_outros_desc;

  -- ── UPDATE ──────────────────────────────────────────────────────
  UPDATE public.payroll_entries SET
    vencimentos_bruto             = v_vencimentos_bruto,
    horas_extras_valor            = v_he50_valor + v_he100_valor,
    adicional_noturno_valor       = v_adicional_noturno,
    adicional_periculosidade_valor = v_adicional_peric,
    adicional_insalubridade_valor  = v_adicional_insalub,
    inss_base                     = v_inss_base,
    inss_aliquota                 = v_inss_aliquota,
    inss_valor                    = v_inss_valor,
    irrf_base                     = v_irrf_base,
    irrf_aliquota                 = v_irrf_aliquota,
    irrf_valor                    = v_irrf_valor,
    fgts_valor                    = v_fgts,
    vt_desconto                   = v_vt_desconto,
    salario_liquido               = v_liquido,
    updated_at                    = now()
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  RETURN v_entry;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_payroll_entry(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.calculate_payroll_entry(UUID) TO authenticated;

-- ── 8. calculate_period (calcula todos os entries de uma competência) ──────────

CREATE OR REPLACE FUNCTION public.calculate_payroll_period(p_period_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry_id UUID;
  v_count    INTEGER := 0;
BEGIN
  -- Verifica que o usuário tem acesso à competência
  IF NOT EXISTS (
    SELECT 1 FROM public.payroll_periods pp
    WHERE pp.id = p_period_id AND pp.team_id = public.get_my_team_id()
  ) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR v_entry_id IN
    SELECT id FROM public.payroll_entries WHERE period_id = p_period_id
  LOOP
    PERFORM public.calculate_payroll_entry(v_entry_id);
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.payroll_periods
    SET status = 'calculada', calculated_at = now()
    WHERE id = p_period_id;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_payroll_period(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.calculate_payroll_period(UUID) TO authenticated;
