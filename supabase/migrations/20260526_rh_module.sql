-- Migration: RH Module — Recursos Humanos (Enterprise)
-- Tables: departments, positions, employees, employee_certifications,
--         employee_documents, employee_history
-- RPCs: generate_employee_matricula, get_employees_with_expiring_certs

-- ── 1. departments ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.departments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  code             TEXT,
  parent_id        UUID        REFERENCES public.departments(id),
  cost_center      TEXT,
  headcount_target INTEGER     DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, code)
);

-- ── 2. positions (cargos) ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.positions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  cbo_code      TEXT,
  department_id UUID        REFERENCES public.departments(id),
  salary_min    NUMERIC(12,2),
  salary_mid    NUMERIC(12,2),
  salary_max    NUMERIC(12,2),
  job_family    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. employees ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employees (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id                   UUID        UNIQUE REFERENCES public.users(id),
  matricula                 TEXT        UNIQUE,

  -- Dados pessoais
  full_name                 TEXT        NOT NULL,
  cpf                       TEXT        NOT NULL,
  rg                        TEXT,
  rg_orgao_emissor          TEXT,
  rg_uf                     TEXT,
  data_nascimento           DATE,
  sexo                      TEXT        CHECK(sexo IN ('M','F','O')),
  estado_civil              TEXT        CHECK(estado_civil IN ('solteiro','casado','divorciado','viuvo','uniao_estavel')),
  naturalidade              TEXT,
  nacionalidade             TEXT        DEFAULT 'Brasileiro',
  nome_mae                  TEXT,
  nome_pai                  TEXT,

  -- Contato
  email                     TEXT,
  telefone                  TEXT,
  celular                   TEXT,
  endereco_logradouro       TEXT,
  endereco_numero           TEXT,
  endereco_complemento      TEXT,
  endereco_bairro           TEXT,
  endereco_cidade           TEXT,
  endereco_uf               TEXT,
  endereco_cep              TEXT,

  -- Dados profissionais
  position_id               UUID        REFERENCES public.positions(id),
  department_id             UUID        REFERENCES public.departments(id),
  manager_id                UUID        REFERENCES public.employees(id),
  data_admissao             DATE        NOT NULL,
  tipo_contrato             TEXT        NOT NULL
    CHECK(tipo_contrato IN ('CLT','PJ','Estagio','Aprendiz','Temporario','Autonomo')),
  regime_horario            TEXT
    CHECK(regime_horario IN ('44h','40h','36h','30h','20h','flexivel')),
  horario_entrada           TEXT,
  horario_saida             TEXT,
  horario_intervalo_minutos INTEGER     DEFAULT 60,

  -- Dados financeiros
  salario_base              NUMERIC(12,2) NOT NULL,
  banco                     TEXT,
  agencia                   TEXT,
  conta                     TEXT,
  tipo_conta                TEXT        CHECK(tipo_conta IN ('corrente','poupanca')),
  pix_key                   TEXT,

  -- Documentos legais
  pis_pasep                 TEXT,
  ctps_numero               TEXT,
  ctps_serie                TEXT,
  ctps_uf                   TEXT,
  titulo_eleitor            TEXT,
  cnh_numero                TEXT,
  cnh_categoria             TEXT,
  cnh_validade              DATE,

  -- Benefícios
  vt_ativo                  BOOLEAN     DEFAULT false,
  vt_valor_diario           NUMERIC(8,2),
  vr_valor_diario           NUMERIC(8,2),
  va_valor_diario           NUMERIC(8,2),
  plano_saude_ativo         BOOLEAN     DEFAULT false,
  plano_saude_operadora     TEXT,
  plano_saude_tipo          TEXT,
  plano_odonto_ativo        BOOLEAN     DEFAULT false,

  -- Status e lifecycle
  status                    TEXT        NOT NULL DEFAULT 'ativo'
    CHECK(status IN ('ativo','ferias','afastado','desligado','pre_admissao')),
  data_desligamento         DATE,
  motivo_desligamento       TEXT
    CHECK(motivo_desligamento IN (
      'pedido_demissao','sem_justa_causa','justa_causa',
      'acordo_mutuo','fim_contrato','aposentadoria'
    )),

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(team_id, cpf)
);

-- ── 4. employee_certifications ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employee_certifications (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id        UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  certification_name TEXT        NOT NULL,
  issuing_body       TEXT,
  issue_date         DATE,
  expiry_date        DATE,
  certificate_url    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. employee_documents ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type  TEXT        NOT NULL,
  filename       TEXT        NOT NULL,
  storage_path   TEXT        NOT NULL,
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by    UUID        REFERENCES public.users(id)
);

-- ── 6. employee_history (audit log) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employee_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  changed_by   UUID        NOT NULL REFERENCES public.users(id),
  change_type  TEXT        NOT NULL,
  old_values   JSONB,
  new_values   JSONB,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 7. manager_id on departments (DEFERRABLE — avoids circular FK) ─────────────

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS manager_id UUID
  REFERENCES public.employees(id)
  DEFERRABLE INITIALLY DEFERRED;

-- ── 8. updated_at triggers ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at_rh()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_rh();

CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_rh();

-- ── 9. RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.departments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_history        ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_my_team_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_id FROM public.users WHERE id = auth.uid() LIMIT 1
$$;

-- departments
CREATE POLICY "rh_dept_select" ON public.departments FOR SELECT USING (team_id = public.get_my_team_id());
CREATE POLICY "rh_dept_insert" ON public.departments FOR INSERT WITH CHECK (team_id = public.get_my_team_id());
CREATE POLICY "rh_dept_update" ON public.departments FOR UPDATE USING (team_id = public.get_my_team_id());
CREATE POLICY "rh_dept_delete" ON public.departments FOR DELETE USING (team_id = public.get_my_team_id());

-- positions
CREATE POLICY "rh_pos_select" ON public.positions FOR SELECT USING (team_id = public.get_my_team_id());
CREATE POLICY "rh_pos_insert" ON public.positions FOR INSERT WITH CHECK (team_id = public.get_my_team_id());
CREATE POLICY "rh_pos_update" ON public.positions FOR UPDATE USING (team_id = public.get_my_team_id());
CREATE POLICY "rh_pos_delete" ON public.positions FOR DELETE USING (team_id = public.get_my_team_id());

-- employees
CREATE POLICY "rh_emp_select" ON public.employees FOR SELECT USING (team_id = public.get_my_team_id());
CREATE POLICY "rh_emp_insert" ON public.employees FOR INSERT WITH CHECK (team_id = public.get_my_team_id());
CREATE POLICY "rh_emp_update" ON public.employees FOR UPDATE USING (team_id = public.get_my_team_id());
CREATE POLICY "rh_emp_delete" ON public.employees FOR DELETE USING (team_id = public.get_my_team_id());

-- employee_certifications
CREATE POLICY "rh_cert_select" ON public.employee_certifications FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.team_id = public.get_my_team_id()));
CREATE POLICY "rh_cert_insert" ON public.employee_certifications FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.team_id = public.get_my_team_id()));
CREATE POLICY "rh_cert_delete" ON public.employee_certifications FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.team_id = public.get_my_team_id()));

-- employee_documents
CREATE POLICY "rh_doc_select" ON public.employee_documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.team_id = public.get_my_team_id()));
CREATE POLICY "rh_doc_insert" ON public.employee_documents FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.team_id = public.get_my_team_id()));
CREATE POLICY "rh_doc_delete" ON public.employee_documents FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.team_id = public.get_my_team_id()));

-- employee_history
CREATE POLICY "rh_hist_select" ON public.employee_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.team_id = public.get_my_team_id()));
CREATE POLICY "rh_hist_insert" ON public.employee_history FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.team_id = public.get_my_team_id()));

-- ── 10. RPCs ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_employee_matricula(p_team_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slug  TEXT;
  v_count INTEGER;
BEGIN
  SELECT UPPER(LEFT(COALESCE(slug, 'EMP'), 3)) INTO v_slug
    FROM public.tenants WHERE id = p_team_id;
  IF v_slug IS NULL OR v_slug = '' THEN v_slug := 'EMP'; END IF;

  SELECT COALESCE(MAX(
    CASE WHEN matricula ~ ('^' || v_slug || '-[0-9]+$')
      THEN CAST(REGEXP_REPLACE(matricula, '^[A-Z]+-', '') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO v_count
  FROM public.employees
  WHERE team_id = p_team_id;

  RETURN v_slug || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_employee_matricula(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.generate_employee_matricula(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_employees_with_expiring_certs(
  p_team_id UUID,
  p_days    INTEGER DEFAULT 30
)
RETURNS TABLE (
  employee_id        UUID,
  employee_name      TEXT,
  matricula          TEXT,
  certification_name TEXT,
  expiry_date        DATE,
  days_until_expiry  INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    e.id,
    e.full_name,
    e.matricula,
    c.certification_name,
    c.expiry_date,
    (c.expiry_date - CURRENT_DATE)::INTEGER
  FROM public.employee_certifications c
  JOIN public.employees e ON e.id = c.employee_id
  WHERE e.team_id = p_team_id
    AND e.status   = 'ativo'
    AND c.expiry_date IS NOT NULL
    AND c.expiry_date >= CURRENT_DATE
    AND c.expiry_date <= CURRENT_DATE + (p_days || ' days')::INTERVAL
  ORDER BY c.expiry_date ASC
$$;

REVOKE ALL ON FUNCTION public.get_employees_with_expiring_certs(UUID, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_employees_with_expiring_certs(UUID, INTEGER) TO authenticated;
