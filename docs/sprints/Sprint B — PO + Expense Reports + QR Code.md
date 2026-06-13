# Sprint B — Ordem de Compra + Relatório de Despesas + QR Code
*Status: Planejado | Pré-requisito: [[Sprint A — SLA + Fornecedores + Inventário]] concluído*

---

## Objetivo

Implementar o **ciclo de compra completo** (requisição → PO → recebimento), o **agrupamento de reembolsos** em relatórios de despesa e a **identificação de ativos por QR code** em campo. Esses três módulos fecham os gaps mais críticos contra Coupa, SAP Concur e Limble.

---

## Feature B1 — Ordem de Compra (Purchase Order)

### Problema
O fluxo atual para quando o Comprador marca "Comprado". Não há documento formal de PO enviado ao fornecedor, não há confirmação de recebimento, e sem PO numerado o fornecedor não consegue emitir NF corretamente.

### Referência de mercado
Coupa: requisição aprovada → PO gerado automaticamente com número único → enviado ao fornecedor por email/EDI → fornecedor confirma → goods receipt → 3-way matching com NF.

### Acceptance Criteria
- [ ] Comprador pode gerar PO a partir de uma solicitação com status "Comprado"
- [ ] PO recebe número único sequencial por tenant (formato: `PO-{ANO}-{NNNN}`)
- [ ] PDF de PO é gerado (cabeçalho tenant, dados fornecedor, itens, valor total, assinatura)
- [ ] PO pode ser enviado por email ao fornecedor (via Supabase Edge Function + Resend/SendGrid)
- [ ] Fluxo de recebimento: Técnico ou Comprador marca PO como "Recebido" → notifica solicitante
- [ ] Status do PO: `rascunho` → `emitido` → `recebido` → `cancelado`
- [ ] Histórico de POs visível por solicitação de compra

### Schema DB (Migration: `purchase_orders`)

```sql
-- Sequência de PO por tenant (armazenada em tabela para atomicidade)
CREATE TABLE IF NOT EXISTS public.po_sequences (
  team_id    uuid PRIMARY KEY REFERENCES public.tenants(id),
  last_seq   integer NOT NULL DEFAULT 0
);

CREATE TABLE public.purchase_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid NOT NULL DEFAULT get_caller_team_id() REFERENCES public.tenants(id),
  po_number       text NOT NULL,                     -- gerado: PO-2026-0001
  request_id      uuid REFERENCES public.material_requests(id) ON DELETE SET NULL,
  supplier_id     uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name   text,                              -- snapshot no momento da emissão
  status          text NOT NULL DEFAULT 'rascunho'
                    CHECK (status IN ('rascunho','emitido','recebido','cancelado')),
  total_value     numeric(12,2),
  notes           text,
  issued_at       timestamptz,
  received_at     timestamptz,
  issued_by       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  received_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_order_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  description     text NOT NULL,
  qty             numeric(10,2) NOT NULL DEFAULT 1,
  unit            text NOT NULL DEFAULT 'un',
  unit_price      numeric(10,2) NOT NULL DEFAULT 0,
  total_price     numeric(10,2) GENERATED ALWAYS AS (qty * unit_price) STORED
);

ALTER TABLE public.purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_sequences         ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_isolation ON public.purchase_orders AS RESTRICTIVE
  FOR ALL TO authenticated USING (team_id = get_caller_team_id()) WITH CHECK (team_id = get_caller_team_id());
CREATE POLICY team_isolation ON public.purchase_order_items AS RESTRICTIVE
  FOR ALL TO authenticated
  USING  ((SELECT team_id FROM public.purchase_orders WHERE id = po_id) = get_caller_team_id())
  WITH CHECK ((SELECT team_id FROM public.purchase_orders WHERE id = po_id) = get_caller_team_id());
CREATE POLICY team_isolation ON public.po_sequences AS RESTRICTIVE
  FOR ALL TO authenticated USING (team_id = get_caller_team_id()) WITH CHECK (team_id = get_caller_team_id());

CREATE INDEX IF NOT EXISTS idx_purchase_orders_team_id    ON public.purchase_orders(team_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_request_id ON public.purchase_orders(request_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po_id             ON public.purchase_order_items(po_id);
```

### RPC: `generate_purchase_order(p_request_id, p_items jsonb)` (SECURITY INVOKER)
- Gera número PO atomicamente via `po_sequences` (UPDATE ... RETURNING)
- Insere `purchase_orders` + `purchase_order_items`
- Notifica solicitante original
- Retorna `{ po_id, po_number }`

### Arquivos afetados
| Arquivo | Ação |
|---------|------|
| `src/types/purchaseOrder.ts` | Interface PurchaseOrder (novo) |
| `src/services/purchaseOrderService.ts` | CRUD + generatePO (novo) |
| `src/utils/gerarPdfPO.ts` | PDF de PO (novo, padrão de gerarPdfRelatorio) |
| `src/pages/materials/components/PurchaseDetailModal.tsx` | Botão "Gerar PO" após Comprado |
| `src/pages/materials/components/PODetailDialog.tsx` | Visualização + recebimento (novo) |
| `supabase/functions/send-po-email/index.ts` | Edge Function envio email PO |

---

## Feature B2 — Relatório de Despesas (Expense Report)

### Problema
Cada reembolso é aprovado individualmente. Em times com campo intensivo, um técnico pode ter 10+ despesas por viagem — aprovar uma a uma é ineficiente e não reflete o processo real de SAP Concur onde se aprova o relatório da viagem.

### Referência de mercado
SAP Concur agrupa despesas por período/projeto em Expense Reports. Uma única aprovação cobre todo o grupo. Permite ver o gasto total da viagem.

### Acceptance Criteria
- [ ] Técnico pode criar um Relatório de Despesas, nomear (ex: "Viagem São Paulo Mar/2026") e adicionar reembolsos pendentes do período
- [ ] Relatório tem status próprio: `rascunho` → `submetido` → `aprovado` → `pago` → `rejeitado`
- [ ] Gestor/Financeiro aprova/rejeita o relatório inteiro (ou com comentário por item)
- [ ] Reembolsos vinculados ao relatório são aprovados em conjunto
- [ ] PDF do relatório (sumário + itens) exportável
- [ ] Técnico continua podendo submeter reembolsos avulsos (campo `expense_report_id` nullable)

### Schema DB (Migration: `expense_reports`)

```sql
CREATE TABLE public.expense_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          uuid NOT NULL DEFAULT get_caller_team_id() REFERENCES public.tenants(id),
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title            text NOT NULL,
  period_start     date,
  period_end       date,
  status           text NOT NULL DEFAULT 'rascunho'
                     CHECK (status IN ('rascunho','submetido','aprovado','pago','rejeitado')),
  total_amount     numeric(12,2) GENERATED ALWAYS AS (
                     (SELECT COALESCE(SUM(amount),0) FROM public.reimbursements WHERE expense_report_id = id)
                   ) STORED,  -- nota: computed column precisa ser trigger ou calculado na app
  rejection_reason text,
  submitted_at     timestamptz,
  reviewed_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Vincular reembolsos a relatórios
ALTER TABLE public.reimbursements
  ADD COLUMN IF NOT EXISTS expense_report_id uuid REFERENCES public.expense_reports(id) ON DELETE SET NULL;

ALTER TABLE public.expense_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_isolation ON public.expense_reports AS RESTRICTIVE
  FOR ALL TO authenticated USING (team_id = get_caller_team_id()) WITH CHECK (team_id = get_caller_team_id());

CREATE INDEX IF NOT EXISTS idx_expense_reports_team_id    ON public.expense_reports(team_id);
CREATE INDEX IF NOT EXISTS idx_expense_reports_user_id    ON public.expense_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reimbursements_expense_report ON public.reimbursements(expense_report_id);
```

> **Nota arquitetural**: `total_amount` como GENERATED ALWAYS com subquery não é suportado pelo Postgres (subqueries em generated columns). Calcular via trigger ou na camada de aplicação. Ver ADR-003.

### Arquivos afetados
| Arquivo | Ação |
|---------|------|
| `src/types/expenseReport.ts` | Interface ExpenseReport (novo) |
| `src/services/expenseReportService.ts` | CRUD (novo) |
| `src/pages/reimbursements/ExpenseReports.tsx` | Tela de relatórios (novo) |
| `src/pages/reimbursements/components/ExpenseReportCard.tsx` | Card (novo) |
| `src/pages/reimbursements/ReimbursementsList.tsx` | Link para Relatórios de Despesa |

---

## Feature B3 — QR Code: Equipamento → OS

### Problema
Técnico chega no campo, precisa abrir OS para o equipamento X. Hoje navega manualmente pelo wizard. Limble permite escanear etiqueta QR do ativo e a OS abre pré-preenchida.

### Acceptance Criteria
- [ ] Cada equipamento tem botão "Gerar Etiqueta QR" na tela de gestão → baixa PNG com QR + nome + serial
- [ ] QR code encoda a URL `/reports/new?asset_id={id}&client_id={client_id}`
- [ ] Ao abrir essa URL, wizard de OS inicia com Step 2 já preenchido (ativo + cliente)
- [ ] Mobile: câmera do browser lê QR sem instalar app (usar `@zxing/browser` ou API nativa)
- [ ] Fallback: usuário pode digitar código manual se câmera não disponível
- [ ] Etiqueta QR exportada em PDF A7 (tamanho de etiqueta industrial) com nome do ativo e serial

### Implementação técnica

**Geração do QR:**
```
Library: qr-code-styling (já avaliada, 43 kB gzip)
Arquivo: src/utils/gerarEtiquetaQR.ts
```

**Leitura do QR (mobile-first):**
```
API preferida: BarcodeDetector (nativa, zero bundle)
Fallback: @zxing/browser (carregado dinamicamente, lazy import)
Arquivo: src/components/QRScanner.tsx
```

**Deep link:**
```
src/pages/reports/NewReport.tsx — ler searchParams.asset_id + searchParams.client_id
src/pages/reports/components/steps/Step2AssetContext.tsx — aceitar props iniciais
```

**PDF de etiqueta:**
```
jsPDF com formato A7 (74mm × 105mm)
src/utils/gerarEtiquetaQR.ts — função exportarEtiquetaPDF(equipment)
```

### Arquivos afetados
| Arquivo | Ação |
|---------|------|
| `src/components/QRScanner.tsx` | Scanner de câmera (novo) |
| `src/utils/gerarEtiquetaQR.ts` | Geração QR + PDF etiqueta (novo) |
| `src/pages/equipments/EquipmentManagement.tsx` | Botão "Gerar Etiqueta" por equipamento |
| `src/pages/reports/NewReport.tsx` | Ler query params asset_id + client_id |
| `src/pages/reports/components/steps/Step2AssetContext.tsx` | Aceitar initial values |

---

## Checklist de Sprint B

- [ ] Migrations aplicadas: `purchase_orders`, `expense_reports`
- [ ] `get_advisors` — zero novos alertas de segurança
- [ ] `tsc --noEmit` EXIT:0
- [ ] `npm run build` — bundle dentro do budget
- [ ] Playwright:
  - [ ] B1: gerar PO a partir de solicitação comprado
  - [ ] B2: criar expense report e vincular reembolsos
  - [ ] B3: URL com `?asset_id=` pré-preenche Step 2 do wizard
- [ ] ADR-003 (Expense Report total_amount strategy) em `docs/adr/`
- [ ] ADR-004 (QR Code library choice) em `docs/adr/`
- [ ] Commit: `feat(sprint-b): purchase orders, expense reports, QR code asset flow`
