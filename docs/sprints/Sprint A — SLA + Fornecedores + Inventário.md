# Sprint A — SLA + Fornecedores + Inventário de Peças
*Status: Planejado | Referência: [[00 - Master Roadmap B2B Enterprise]]*

---

## Objetivo

Implementar a **fundação operacional** que diferencia o NextAI de uma simples planilha digital: contratos de nível de serviço (SLA), base de fornecedores estruturada e rastreabilidade de peças/materiais. Esses três módulos são pré-requisito para os sprints B e C.

---

## Feature A1 — SLA Tracking + Escalonamento

### Problema
Gestores não sabem se uma OS está dentro do prazo contratual. Não existe conceito de urgência sistêmica — apenas o campo manual de serviço.

### Referência de mercado
ServiceNow define SLA por tipo de serviço + prioridade. Jira SM tem SLA clocks visíveis no ticket. Limble associa SLA a tipo de work order.

### Acceptance Criteria
- [ ] Gestor/Admin pode configurar políticas de SLA por `service_type` e prioridade
- [ ] Ao criar OS, `sla_due_at` é calculado automaticamente com base na política aplicável
- [ ] ReportCard exibe countdown de SLA (verde/âmbar/vermelho) quando status = `pending_review`
- [ ] Quando SLA é violado, notificação automática para Gestor e Supervisor do team
- [ ] Relatório de SLA no dashboard (% cumprido nos últimos 30d)
- [ ] `tsc --noEmit` EXIT:0, build sem regressão

### Schema DB (Migration: `sla_policies_and_report_sla`)

```sql
-- Políticas de SLA configuráveis por tenant
CREATE TABLE public.sla_policies (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id              uuid NOT NULL DEFAULT get_caller_team_id() REFERENCES public.tenants(id),
  service_type         text,                          -- NULL = aplica a todos os tipos
  priority             text NOT NULL DEFAULT 'normal', -- 'baixa' | 'normal' | 'alta' | 'critica'
  hours_to_respond     integer NOT NULL DEFAULT 4,    -- tempo até primeira resposta (mudar status)
  hours_to_resolve     integer NOT NULL DEFAULT 24,   -- tempo até resolução (approved/rejected)
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_isolation ON public.sla_policies AS RESTRICTIVE
  FOR ALL TO authenticated USING (team_id = get_caller_team_id()) WITH CHECK (team_id = get_caller_team_id());

-- Adicionar campos SLA em service_reports
ALTER TABLE public.service_reports
  ADD COLUMN IF NOT EXISTS priority         text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS sla_policy_id    uuid REFERENCES public.sla_policies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sla_due_at       timestamptz,   -- prazo de resolução calculado
  ADD COLUMN IF NOT EXISTS sla_responded_at timestamptz;   -- quando saiu de pending_review pela 1ª vez

CREATE INDEX IF NOT EXISTS idx_service_reports_sla_due_at ON public.service_reports(sla_due_at) WHERE sla_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sla_policies_team_id ON public.sla_policies(team_id);
```

### RPC: `calculate_sla_due_at(p_report_id, p_service_type, p_priority)`
- Busca política mais específica (service_type + priority > service_type > priority > default)
- Calcula `now() + interval '${hours_to_resolve} hours'`
- Chamado dentro de `submit_report` após INSERT

### RPC: `check_sla_breaches()` (SECURITY DEFINER, service_role)
- Seleciona OS com `sla_due_at < now()` e `status IN ('pending_review', 'returned')`
- Insere notificação para Gestores/Supervisores do team
- Chamado por Edge Function agendada (a cada 30 min)

### Arquivos afetados
| Arquivo | Ação |
|---------|------|
| `src/types/reports.ts` | Adicionar `priority`, `sla_policy_id`, `sla_due_at`, `sla_responded_at` |
| `src/pages/reports/components/ReportCard.tsx` | Adicionar SLA countdown badge |
| `src/pages/reports/components/steps/Step1Identification.tsx` | Adicionar campo `priority` |
| `src/pages/dashboard/widgets/SlaWidget.tsx` | Widget novo: % SLA cumprido |
| `src/pages/admin/SlaManagement.tsx` | CRUD de políticas de SLA |
| `src/App.tsx` | Rota `/admin/sla` |
| `supabase/functions/sla-checker/index.ts` | Edge Function scheduler |

---

## Feature A2 — Gestão de Fornecedores

### Problema
`supplier_name` é texto livre em `material_requests`. Não há histórico de compras por fornecedor, avaliação de desempenho, CNPJ para NF, ou prazo médio de entrega.

### Referência de mercado
Coupa tem Supplier Portal completo. Para MVP, o equivalente é um cadastro estruturado com uso no módulo de Compras.

### Acceptance Criteria
- [ ] CRUD completo de fornecedores (nome, CNPJ, contato, endereço, prazo médio entrega)
- [ ] PurchaseDetailModal usa dropdown de fornecedores do DB em vez de texto livre
- [ ] Histórico: quantas compras por fornecedor, valor total, última compra
- [ ] Campo `rating` (1-5) preenchido pelo Comprador após recebimento
- [ ] `supplier_name` em `material_requests` substituído por `supplier_id` FK (manter `supplier_name` como legado nullable)

### Schema DB (Migration: `suppliers_table`)

```sql
CREATE TABLE public.suppliers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id             uuid NOT NULL DEFAULT get_caller_team_id() REFERENCES public.tenants(id),
  name                text NOT NULL,
  cnpj                text,
  contato_nome        text,
  contato_telefone    text,
  contato_email       text,
  logradouro          text,
  cidade              text,
  estado              char(2),
  avg_delivery_days   integer,
  rating              numeric(2,1) CHECK (rating BETWEEN 1 AND 5),
  status              text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_isolation ON public.suppliers AS RESTRICTIVE
  FOR ALL TO authenticated USING (team_id = get_caller_team_id()) WITH CHECK (team_id = get_caller_team_id());

ALTER TABLE public.material_requests
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_team_id ON public.suppliers(team_id);
CREATE INDEX IF NOT EXISTS idx_material_requests_supplier_id ON public.material_requests(supplier_id);
```

### Arquivos afetados
| Arquivo | Ação |
|---------|------|
| `src/types/supplier.ts` | Interface Supplier (novo) |
| `src/services/supplierService.ts` | CRUD (novo) |
| `src/hooks/useSuppliers.ts` | Hook (novo) |
| `src/pages/suppliers/SupplierManagement.tsx` | Tela admin (novo) |
| `src/pages/materials/components/PurchaseDetailModal.tsx` | Troca text→select supplier |
| `src/App.tsx` | Rota `/suppliers` |
| `src/components/layout/AppLayout.tsx` | Nav item Fornecedores |

---

## Feature A3 — Inventário de Peças

### Problema
`parts_used` em OS é texto livre. Sem controle de estoque não há rastreabilidade de custo de materiais por OS, nem alertas de reposição.

### Referência de mercado
Limble CMMS tem gestão de peças com níveis de estoque, fornecedor preferencial e custo por peça.

### Acceptance Criteria
- [ ] CRUD de peças/materiais com código, unidade, custo unitário, estoque atual e mínimo
- [ ] No wizard de OS (Step 5 — Execução), Técnico seleciona peças usadas do catálogo + quantidade; fallback para texto livre
- [ ] Quando peça selecionada, estoque é decrementado (via RPC atômico)
- [ ] Badge de alerta em PartsManagement quando `stock_qty <= min_stock_qty`
- [ ] Custo de peças por OS calculado e exibido no detalhe da OS

### Schema DB (Migration: `parts_inventory`)

```sql
CREATE TABLE public.parts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid NOT NULL DEFAULT get_caller_team_id() REFERENCES public.tenants(id),
  code            text,
  name            text NOT NULL,
  unit            text NOT NULL DEFAULT 'un',
  unit_cost       numeric(10,2) NOT NULL DEFAULT 0,
  stock_qty       numeric(10,2) NOT NULL DEFAULT 0,
  min_stock_qty   numeric(10,2) NOT NULL DEFAULT 0,
  supplier_id     uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  location        text,                               -- prateleira / almoxarifado
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.os_parts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id           uuid NOT NULL REFERENCES public.service_reports(id) ON DELETE CASCADE,
  part_id             uuid REFERENCES public.parts(id) ON DELETE SET NULL,
  part_name_manual    text,                           -- fallback quando sem cadastro
  qty_used            numeric(10,2) NOT NULL DEFAULT 1,
  unit_cost_at_time   numeric(10,2),                 -- snapshot do custo no momento do uso
  team_id             uuid NOT NULL DEFAULT get_caller_team_id()
);

ALTER TABLE public.parts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_isolation ON public.parts AS RESTRICTIVE
  FOR ALL TO authenticated USING (team_id = get_caller_team_id()) WITH CHECK (team_id = get_caller_team_id());
CREATE POLICY team_isolation ON public.os_parts AS RESTRICTIVE
  FOR ALL TO authenticated USING (team_id = get_caller_team_id()) WITH CHECK (team_id = get_caller_team_id());

CREATE INDEX IF NOT EXISTS idx_parts_team_id      ON public.parts(team_id);
CREATE INDEX IF NOT EXISTS idx_os_parts_report_id ON public.os_parts(report_id);
CREATE INDEX IF NOT EXISTS idx_os_parts_part_id   ON public.os_parts(part_id);
```

### RPC: `use_part(p_report_id, p_part_id, p_qty)` (SECURITY INVOKER)
- Verifica `stock_qty >= p_qty` (retorna erro se insuficiente)
- Decrementa `parts.stock_qty` atomicamente
- Insere em `os_parts` com snapshot de `unit_cost_at_time`

---

## Checklist de Sprint A

- [ ] Migrations aplicadas e validadas com `get_advisors` (zero novos alertas)
- [ ] `tsc --noEmit` EXIT:0
- [ ] `npm run build` — chunk inicial ≤ 100 kB gzip
- [ ] Playwright: ao menos 1 spec por feature (SLA badge, supplier CRUD, parts low-stock alert)
- [ ] ADR-001 (SLA) e ADR-002 (Parts Inventory) escritos em `docs/adr/`
- [ ] Atualizar [[Fluxos de Processo — Portal Mopar]] com novos fluxos
- [ ] Commit: `feat(sprint-a): SLA tracking, supplier management, parts inventory`
