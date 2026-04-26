-- =============================================================================
-- Schema real do Portal Mopar
-- Gerado em: 2026-04-25
-- Fonte: pg_catalog + information_schema (leitura direta do banco)
-- Uso: referência e disaster recovery
-- NÃO editar manualmente — regenerar via queries de auditoria
-- =============================================================================


-- ---------------------------------------------------------------------------
-- ENUMs (public schema)
-- ---------------------------------------------------------------------------

CREATE TYPE public.checklist_item_type AS ENUM (
  'boolean', 'text', 'number', 'photo', 'select'
);

CREATE TYPE public.material_status AS ENUM (
  'Pendente', 'Comprado', 'Entregue', 'Em Análise', 'Cancelado'
);

CREATE TYPE public.orcamento_status AS ENUM (
  'rascunho', 'enviado', 'aprovado', 'rejeitado'
);

CREATE TYPE public.reimbursement_status AS ENUM (
  'Pendente', 'Aprovado', 'Rejeitado', 'Revisão', 'Revisao'
);

CREATE TYPE public.report_status AS ENUM (
  'draft', 'pending_review', 'returned', 'approved', 'rejected'
);

CREATE TYPE public.service_type AS ENUM (
  'Preventiva', 'Corretiva', 'Instalação', 'Vistoria', 'Emergência'
);

CREATE TYPE public.signature_type AS ENUM (
  'technician', 'client', 'supervisor'
);

CREATE TYPE public.urgency_level AS ENUM (
  'Alta', 'Média', 'Baixa'
);

CREATE TYPE public.user_role AS ENUM (
  'Tecnico', 'Supervisor', 'Gestor', 'Financeiro',
  'Comprador', 'Admin', 'Master', 'Administrativo'
);

CREATE TYPE public.user_status AS ENUM (
  'Ativo', 'Inativo'
);


-- ---------------------------------------------------------------------------
-- TABELAS
-- Ordem respeitando dependências de FK
-- ---------------------------------------------------------------------------

-- auth.users é gerenciado pelo Supabase Auth; users.id tem FK para auth.users.id

CREATE TABLE public.users (
  id         UUID PRIMARY KEY,  -- FK → auth.users.id ON DELETE CASCADE (gerenciado pelo Supabase)
  email      TEXT NOT NULL,
  full_name  TEXT,
  role       public.user_role   DEFAULT 'Tecnico',
  team_id    UUID,
  status     public.user_status DEFAULT 'Ativo',
  created_at TIMESTAMPTZ        DEFAULT now()
);

CREATE TABLE public.clients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  cnpj       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.sites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  address    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.equipments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT,
  serial_number TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.checklist_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  description    TEXT,
  service_type   public.service_type,
  asset_category TEXT,
  is_active      BOOLEAN     DEFAULT true,
  created_by     UUID REFERENCES public.users(id) ON DELETE NO ACTION,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.checklist_template_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  order_index  INTEGER     NOT NULL DEFAULT 0,
  label        TEXT        NOT NULL,
  description  TEXT,
  item_type    public.checklist_item_type NOT NULL DEFAULT 'boolean',
  options      JSONB,
  is_required  BOOLEAN     DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.service_reports (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id           UUID REFERENCES public.users(id)       ON DELETE CASCADE,
  client_id               UUID REFERENCES public.clients(id)     ON DELETE CASCADE,
  asset_id                UUID REFERENCES public.equipments(id)  ON DELETE SET NULL,
  description             TEXT,
  status                  public.report_status NOT NULL DEFAULT 'draft',
  signature_url           TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  os_number               TEXT,
  service_type            public.service_type,
  site_location           TEXT,
  service_date            DATE,
  started_at              TIMESTAMPTZ,
  finished_at             TIMESTAMPTZ,
  reported_problem        TEXT,
  preliminary_diagnosis   TEXT,
  final_diagnosis         TEXT,
  services_performed      TEXT,
  parts_used              TEXT,
  pending_issues          TEXT,
  technical_recommendation TEXT,
  internal_notes          TEXT,
  geo_lat                 NUMERIC,
  geo_lng                 NUMERIC,
  geo_accuracy            NUMERIC,
  geo_captured_at         TIMESTAMPTZ,
  reviewer_id             UUID REFERENCES public.users(id) ON DELETE NO ACTION,
  reviewer_comment        TEXT,
  reviewed_at             TIMESTAMPTZ,
  local_draft_id          TEXT,
  last_synced_at          TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.report_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES public.service_reports(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.users(id)           ON DELETE NO ACTION,
  url         TEXT NOT NULL,
  filename    TEXT,
  mime_type   TEXT,
  size_bytes  INTEGER,
  caption     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.report_checklist_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id        UUID NOT NULL REFERENCES public.service_reports(id)        ON DELETE CASCADE,
  template_item_id UUID          REFERENCES public.checklist_template_items(id) ON DELETE SET NULL,
  label            TEXT NOT NULL,
  item_type        public.checklist_item_type NOT NULL,
  value_boolean    BOOLEAN,
  value_text       TEXT,
  value_number     NUMERIC,
  value_option     TEXT,
  attachment_url   TEXT,
  is_conformant    BOOLEAN,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.report_signatures (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id      UUID NOT NULL REFERENCES public.service_reports(id) ON DELETE CASCADE,
  signature_type public.signature_type NOT NULL,
  signer_name    TEXT,
  signer_role    TEXT,
  image_url      TEXT NOT NULL,
  geo_lat        NUMERIC,
  geo_lng        NUMERIC,
  signed_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.report_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES public.service_reports(id) ON DELETE CASCADE,
  from_status public.report_status,
  to_status   public.report_status NOT NULL,
  changed_by  UUID NOT NULL REFERENCES public.users(id) ON DELETE NO ACTION,
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.reimbursements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES public.users(id)   ON DELETE CASCADE,
  category         TEXT NOT NULL,
  amount           NUMERIC NOT NULL,
  status           public.reimbursement_status DEFAULT 'Pendente',
  receipt_url      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  description      TEXT,
  maintenance_type TEXT,
  client_id        UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  branch           TEXT,
  budget           TEXT,
  rejection_reason TEXT,
  revision_reason  TEXT,
  favorecido       TEXT,
  pix_key          TEXT,
  expense_date     DATE
);

CREATE TABLE public.reimbursement_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reimbursement_id UUID NOT NULL REFERENCES public.reimbursements(id) ON DELETE CASCADE,
  changed_by       UUID          REFERENCES public.users(id)          ON DELETE SET NULL,
  old_status       TEXT,
  new_status       TEXT NOT NULL,
  reason           TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.material_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tech_id               UUID REFERENCES public.users(id)   ON DELETE CASCADE,
  item                  TEXT NOT NULL,
  quantity              TEXT NOT NULL,
  urgency               public.urgency_level NOT NULL DEFAULT 'Baixa',
  reason                TEXT NOT NULL,
  status                public.material_status DEFAULT 'Pendente',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  cidade                TEXT,
  client_id             UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  loja                  TEXT,
  maintenance_type      TEXT,
  prazo                 DATE,
  especificacao_tecnica TEXT,
  foto_url              TEXT,
  link_referencia       TEXT,
  obs                   TEXT,
  comprador_response    TEXT,
  comprador_id          UUID REFERENCES public.users(id) ON DELETE NO ACTION,
  processed_at          TIMESTAMPTZ,
  purchase_price        NUMERIC,
  purchase_link         TEXT,
  request_number        TEXT UNIQUE
);

CREATE TABLE public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.orcamentos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id      UUID REFERENCES public.service_reports(id) ON DELETE SET NULL,
  client_id      UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  technician_id  UUID NOT NULL REFERENCES public.users(id)   ON DELETE RESTRICT,
  status         public.orcamento_status NOT NULL DEFAULT 'rascunho',
  titulo         TEXT,
  observacoes    TEXT,
  rejection_reason TEXT,
  validade       DATE,
  desconto_pct   NUMERIC NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.orcamento_itens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id   UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  descricao      TEXT    NOT NULL,
  quantidade     NUMERIC NOT NULL DEFAULT 1,
  unidade        TEXT    NOT NULL DEFAULT 'un',
  valor_unitario NUMERIC NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- ÍNDICES
-- ---------------------------------------------------------------------------

CREATE INDEX idx_template_items_template          ON public.checklist_template_items (template_id, order_index);
CREATE INDEX idx_service_reports_tech_status_date  ON public.service_reports          (technician_id, status, created_at DESC);
CREATE INDEX idx_service_reports_technician        ON public.service_reports          (technician_id);
CREATE INDEX idx_service_reports_client            ON public.service_reports          (client_id);
CREATE INDEX idx_service_reports_status            ON public.service_reports          (status);
CREATE INDEX idx_service_reports_date              ON public.service_reports          (service_date DESC NULLS LAST);
CREATE INDEX idx_service_reports_os                ON public.service_reports          (os_number);
CREATE INDEX idx_service_reports_local_draft       ON public.service_reports          (local_draft_id);
CREATE INDEX idx_report_attachments_report         ON public.report_attachments       (report_id);
CREATE INDEX idx_checklist_items_report            ON public.report_checklist_items   (report_id);
CREATE INDEX idx_report_signatures_report          ON public.report_signatures        (report_id);
CREATE INDEX idx_report_history_report             ON public.report_status_history    (report_id);
CREATE INDEX idx_report_status_history_report_date ON public.report_status_history    (report_id, created_at DESC);
CREATE INDEX idx_reimbursements_user_id            ON public.reimbursements           (user_id);
CREATE INDEX idx_reimbursements_status             ON public.reimbursements           (status);
CREATE INDEX idx_reimbursements_created_at         ON public.reimbursements           (created_at DESC);
CREATE INDEX idx_reimbursement_history_reimbursement_id ON public.reimbursement_history (reimbursement_id);
CREATE INDEX idx_material_requests_tech_id         ON public.material_requests        (tech_id);
CREATE INDEX idx_material_requests_status          ON public.material_requests        (status);
CREATE INDEX idx_material_requests_created_at      ON public.material_requests        (created_at DESC);
CREATE INDEX idx_notifications_user_id             ON public.notifications            (user_id);
CREATE INDEX idx_notifications_user_unread         ON public.notifications            (user_id, created_at DESC) WHERE is_read = false;
CREATE INDEX idx_orcamentos_technician_id          ON public.orcamentos               (technician_id);
CREATE INDEX idx_orcamentos_client_id              ON public.orcamentos               (client_id);
CREATE INDEX idx_orcamentos_status                 ON public.orcamentos               (status);
CREATE INDEX idx_orcamento_itens_orcamento_id      ON public.orcamento_itens          (orcamento_id);
CREATE INDEX idx_users_role                        ON public.users                    (role);


-- ---------------------------------------------------------------------------
-- FUNÇÕES RPC (assinaturas — ver supabase-approval-function.sql para corpo completo)
-- ---------------------------------------------------------------------------

-- submit_report(p_report jsonb, p_attachments jsonb, p_signatures jsonb, p_checklist jsonb)
--   SECURITY DEFINER — cria service_report + attachments + signatures + checklist atomicamente
--   GRANT authenticated

-- process_reimbursement_action(p_reimbursement_id uuid, p_action text, p_reason text)
--   SECURITY DEFINER — RBAC: Gestor, Admin, Supervisor, Financeiro, Master
--   Atualiza status + INSERT reimbursement_history + notificação
--   GRANT authenticated

-- process_report_action(p_report_id uuid, p_action text, p_comment text)
--   SECURITY DEFINER — gestão do fluxo de aprovação de relatórios
--   GRANT authenticated

-- notify_compradores(p_title text, p_message text)
--   SECURITY DEFINER — envia notificação para todos os Compradores
--   GRANT authenticated

-- create_orcamento(p_orcamento jsonb, p_itens jsonb)
--   SECURITY DEFINER — cria orcamento + itens atomicamente (P-12 fix 2026-04-25)
--   GRANT authenticated

-- handle_new_user()        — trigger: INSERT em public.users ao criar auth.user
-- handle_updated_at()      — trigger genérico: atualiza updated_at
-- update_orcamentos_updated_at() — trigger: updated_at em orcamentos
-- generate_material_request_number() — trigger: gera request_number sequencial
-- get_auth_role()          — helper: retorna role do caller via auth.uid()
-- is_admin_role()          — helper legacy (substituído por EXISTS inline nas policies)
-- is_manager_or_admin()    — helper legacy (substituído por EXISTS inline nas policies)
-- rls_auto_enable()        — utilitário de setup


-- ---------------------------------------------------------------------------
-- NOTA: RLS
-- Row Level Security está habilitado em todas as tabelas.
-- As policies usam padrão EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN (...))
-- Não há policies com funções is_admin_role() ou is_manager_or_admin() ativas (deprecadas).
-- ---------------------------------------------------------------------------
