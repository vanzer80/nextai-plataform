# Sprint C — Portal do Cliente + CSAT + Agenda de Despacho
*Status: Planejado | Pré-requisito: [[Sprint A — SLA + Fornecedores + Inventário]] concluído*

---

## Objetivo

Abrir o sistema para o **cliente final** (self-service de OS), capturar **satisfação** após cada serviço e dar ao gestor uma **visão de agenda** de quem faz o quê e quando. Esses são os diferenciais mais visíveis para o tomador de decisão B2B durante uma demo.

---

## Feature C1 — Portal do Cliente (Self-Service)

### Problema
O cliente hoje recebe o PDF de OS por WhatsApp/email. Não tem visibilidade em tempo real do status dos seus chamados, histórico de serviços ou documentos. Concorrentes como ServiceNow e Jira SM entregam portais self-service ao cliente final.

### Referência de mercado
ServiceNow Customer Service Portal: cliente loga, vê seus tickets, abre novos, comenta. Jira SM: similar, com portal de solicitações públicas e acompanhamento de status.

### Decisão arquitetural (ADR-005)
**Abordagem: tenant separado de "cliente"** — criar role `Cliente` no enum `user_role` e usar o mesmo sistema de auth, com RLS restritiva que filtra apenas registros do `client_id` vinculado ao usuário. Evitar criar infraestrutura auth completamente separada.

```sql
-- Adicionar role Cliente ao enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'Cliente';

-- Vincular usuário a um client_id específico
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
```

**RLS**: política adicional em `service_reports` — se `auth.jwt() ->> 'role' = 'Cliente'`, filtra por `client_id = (SELECT client_id FROM users WHERE id = auth.uid())`.

### Acceptance Criteria
- [ ] Gestor pode convidar contato de cliente (email → Supabase invite link) com role `Cliente`
- [ ] Usuário Cliente faz login e vê **apenas as OS do seu cliente** (client_id)
- [ ] Layout separado `/client/*` sem menu de admin (AppLayout simplificado)
- [ ] Cliente pode: ver lista de OS, ver detalhe, baixar PDF de OS aprovada
- [ ] Cliente **não pode**: criar OS, editar, ver reembolsos ou dados de outros clientes
- [ ] Supabase RLS impede vazamento cross-client mesmo com manipulação de request

### Schema DB (Migration: `client_portal_role`)

```sql
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'Cliente';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Política adicional em service_reports para role Cliente
CREATE POLICY client_portal_select ON public.service_reports
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) <> 'Cliente'
    OR client_id = (SELECT client_id FROM public.users WHERE id = auth.uid())
  );
```

> **Atenção**: verificar interação com policy `team_isolation` RESTRICTIVE existente. A política de cliente deve ser aditiva (OR com a de team), não substitutiva. Testar com 2 clientes distintos para confirmar isolamento.

### Arquivos afetados
| Arquivo | Ação |
|---------|------|
| `src/types/user.ts` | Adicionar `'Cliente'` ao UserRole |
| `src/components/layout/ClientLayout.tsx` | Layout simplificado (novo) |
| `src/pages/client/ClientDashboard.tsx` | Lista OS do cliente (novo) |
| `src/pages/client/ClientReportDetail.tsx` | Detalhe read-only + PDF download (novo) |
| `src/App.tsx` | Rotas `/client/*` com guard ClientGuard |
| `src/contexts/AuthContext.tsx` | Redirect para /client se role=Cliente |
| `src/pages/admin/ClientInvite.tsx` | Formulário de convite (novo) |

---

## Feature C2 — CSAT (Pesquisa de Satisfação Pós-OS)

### Problema
Após aprovação da OS, o cliente não é consultado sobre a qualidade do serviço. Gestor não tem NPS/CSAT por técnico, tipo de serviço ou cliente. Jira SM e ServiceNow enviam survey automaticamente após resolução.

### Acceptance Criteria
- [ ] Quando OS muda para `approved`, sistema gera token único de CSAT e envia email ao contato do cliente (se configurado)
- [ ] Página pública `/csat/{token}` — sem autenticação, responsiva — exibe nome do técnico e serviço, pede avaliação 1-5 estrelas + comentário opcional
- [ ] Token expira em 7 dias e só pode ser respondido uma vez
- [ ] Dashboard Gestor: widget CSAT mostrando média do período e breakdown por técnico
- [ ] Relatório de CSAT exportável (Excel)

### Schema DB (Migration: `csat_system`)

```sql
CREATE TABLE public.csat_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     uuid NOT NULL UNIQUE REFERENCES public.service_reports(id) ON DELETE CASCADE,
  token         text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '7 days',
  responded_at  timestamptz,
  team_id       uuid NOT NULL DEFAULT get_caller_team_id()
);

CREATE TABLE public.csat_responses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id    uuid NOT NULL UNIQUE REFERENCES public.csat_tokens(id) ON DELETE CASCADE,
  report_id   uuid NOT NULL REFERENCES public.service_reports(id) ON DELETE CASCADE,
  team_id     uuid NOT NULL,
  score       integer NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment     text,
  responded_at timestamptz NOT NULL DEFAULT now()
);

-- csat_tokens: RLS (time team)
ALTER TABLE public.csat_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_isolation ON public.csat_tokens AS RESTRICTIVE
  FOR ALL TO authenticated USING (team_id = get_caller_team_id()) WITH CHECK (team_id = get_caller_team_id());
CREATE POLICY team_isolation ON public.csat_responses AS RESTRICTIVE
  FOR ALL TO authenticated USING (team_id = get_caller_team_id()) WITH CHECK (team_id = get_caller_team_id());

-- Acesso público (anon) para responder survey via token
CREATE POLICY csat_public_insert ON public.csat_responses
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.csat_tokens
      WHERE id = token_id AND expires_at > now() AND responded_at IS NULL
    )
  );
```

### Arquivos afetados
| Arquivo | Ação |
|---------|------|
| `src/pages/csat/CsatSurvey.tsx` | Página pública de survey (novo) |
| `src/pages/dashboard/widgets/CsatWidget.tsx` | Widget dashboard (novo) |
| `supabase/functions/send-csat-email/index.ts` | Edge Function envio (novo) |
| `src/App.tsx` | Rota pública `/csat/:token` (sem guard) |

---

## Feature C3 — Agenda de Despacho (Dispatch Calendar)

### Problema
Gestor não tem visão de onde cada técnico estará amanhã. Alocação é feita por memória ou WhatsApp. ServiceNow FSM e Limble têm calendários de despacho com drag & drop de atribuição.

### Acceptance Criteria
- [ ] Calendário mensal/semanal mostrando OS por `service_date` e `technician_id`
- [ ] Cada OS aparece como bloco colorido por status no calendário
- [ ] Drag & drop para reagendar OS (atualiza `service_date`) — apenas Gestor/Supervisor
- [ ] Filtro por técnico (multiselect)
- [ ] Visão de carga: quantas OS por técnico por dia (badge numérico)
- [ ] Funciona em mobile (scroll horizontal no modo semana)

### Implementação técnica

**Biblioteca**: `@fullcalendar/react` + `@fullcalendar/daygrid` + `@fullcalendar/interaction`
- Tamanho gzip: ~45 kB — entra como chunk lazy
- Alternativa mais leve: `react-big-calendar` (~28 kB) se bundle for crítico → **ADR-006**

**Data source**: `service_reports` filtrados por `service_date IS NOT NULL AND status NOT IN ('draft', 'rejected')`

**Update on drag**: `supabase.from('service_reports').update({ service_date }).eq('id', reportId)` — sem RPC pois não há side effects além da data

### Arquivos afetados
| Arquivo | Ação |
|---------|------|
| `src/pages/dispatch/DispatchCalendar.tsx` | Calendário (novo) |
| `src/hooks/useDispatchReports.ts` | Hook de dados para calendário |
| `src/App.tsx` | Rota `/dispatch` |
| `src/components/layout/AppLayout.tsx` | Nav: Agenda (Gestor/Supervisor/Admin/Master) |

---

## Checklist de Sprint C

- [ ] Migrations aplicadas: `client_portal_role`, `csat_system`
- [ ] Teste de isolamento RLS com 2 clientes distintos no mesmo tenant
- [ ] `get_advisors` — verificar policy csat_public_insert (anon INSERT controlado)
- [ ] `tsc --noEmit` EXIT:0
- [ ] Playwright:
  - [ ] C1: cliente loga e vê apenas suas OS (não vê OS de outro cliente)
  - [ ] C2: URL /csat/:token exibe formulário; resubmissão é bloqueada
  - [ ] C3: calendário exibe OS com service_date
- [ ] ADR-005 (Client Portal Auth) e ADR-006 (Calendar Library) em `docs/adr/`
- [ ] Commit: `feat(sprint-c): client portal, CSAT surveys, dispatch calendar`
