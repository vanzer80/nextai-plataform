# PROMPT DE EXECUÇÃO — Portal Mopar B2B Enterprise Roadmap

> **Uso:** Cole este prompt integralmente no início de cada sessão de implementação.  
> **Projeto:** `C:\dev\portal-mopar`  
> **Documentação:** `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\Sprints\`  
> **Repositório GitHub:** `vanzer80/nextai-plataform`

---

## CONTEXTO DO PROJETO

Você está trabalhando no **NextAI Portal Mopar**, um SaaS B2B multi-tenant para gestão de field service, manutenção industrial, reembolsos e compras. O projeto usa **React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui** no frontend e **Supabase** (PostgreSQL + RLS + Realtime + Storage + Edge Functions) no backend. PWA com service worker e suporte offline.

### Stack completa
- Frontend: `C:\dev\portal-mopar\src\`
- DB/Auth: Supabase (projeto referenciado no `.env`)
- PDF: jsPDF + jspdf-autotable
- Icons: lucide-react
- Animations: @formkit/auto-animate
- Toast: sonner
- Forms: react-hook-form + zod
- Date: date-fns + ptBR locale
- Tests: Playwright (`tests/`)

### Padrões estabelecidos (OBRIGATÓRIO seguir)
1. **Componentes de lista**: padrão de `ClientsList.tsx` — cards com `hover:shadow-lg hover:-translate-y-0.5`, `animate-in fade-in duration-300`
2. **Dialogs**: Base UI `DialogContent` com `sm:max-w-{size}` (prefixo responsivo OBRIGATÓRIO ou não sobrescreve)
3. **Cores sidebar**: usar `bg-sidebar-*` e `text-sidebar-*` (nunca `bg-background` dentro da sidebar)
4. **Serviços**: padrão de `clientService.ts` — async/await, throw em erro, sem `team_id` no INSERT (DEFAULT cuida)
5. **RLS**: toda tabela nova tem policy `team_isolation` RESTRICTIVE no mesmo migration
6. **RPCs**: `SECURITY INVOKER` + `SET search_path = 'public'` por padrão; `SECURITY DEFINER` apenas quando acesso anon necessário
7. **Rotas**: lazy import em `App.tsx`; role guard via `RoleGuard` existente
8. **Nav**: nova entrada em `AppLayout.tsx` NAV_LINKS com `roles[]` corretos
9. **TypeScript**: sem `any` explícito; `tsc --noEmit` deve ser EXIT:0

### Multi-tenant: regras invioláveis
- `team_id` nunca passado manualmente no INSERT (DEFAULT `get_caller_team_id()`)
- Toda nova tabela tem RLS `team_isolation` RESTRICTIVE
- Após cada migration: `mcp__supabase__get_advisors(type='security')` — zero novos alertas
- RPCs novas: `SECURITY INVOKER` herda RLS. Se SECURITY DEFINER necessário: `REVOKE ... FROM anon` + `REVOKE ... FROM authenticated` quando aplicável

### Estado atual implementado
- ✅ OS (service_reports) com wizard 7 passos, offline draft, sync, SLA baseline (sem políticas ainda)
- ✅ Reembolsos com aprovação multinível, histórico de auditoria (reimbursement_history)
- ✅ Compras (material_requests) com campos de logística (supplier_name texto, logistics_type, pickup_address)
- ✅ Orçamentos com aprovação, histórico (orcamento_history), status expirado, aging badges, versionamento parcial
- ✅ Equipamentos: CRUD, preventiva, histórico de OS, alerta de manutenção (maintenance_interval_days)
- ✅ Dashboard: KPIs, taxa de retorno (get_dashboard_return_rate RPC), gráficos por perfil
- ✅ Notificações: Realtime, insert via RPCs, tabela notifications(id, user_id, title, message, is_read, team_id)
- ✅ PDF de OS com logo do tenant (tenantLogoUrl em gerarPdfRelatorio)
- ✅ PWA + service worker (public/sw.js)
- ✅ Aging badges em cards (src/lib/aging.ts)

---

## INSTRUÇÕES GERAIS DE EXECUÇÃO

### Antes de iniciar qualquer feature
1. **Ler o arquivo de sprint** correspondente em `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\Sprints\`
2. **Ler o ADR** relacionado em `C:\dev\portal-mopar\docs\adr\`
3. **Verificar estado atual** dos arquivos que serão modificados com Read tool
4. **Nunca assumir** o conteúdo de um arquivo sem lê-lo primeiro

### Ordem de execução por feature
```
1. Migration DB → apply_migration → get_advisors (security)
2. Types TypeScript → src/types/
3. Service → src/services/
4. Hook (se necessário) → src/hooks/
5. Componentes → src/pages/.../components/
6. Página principal → src/pages/
7. Rota em App.tsx + Nav em AppLayout.tsx
8. tsc --noEmit → EXIT:0
9. npm run build → bundle check
10. Playwright spec → escrever + rodar
11. Commit por sprint (não por feature individual)
```

### Verificações obrigatórias após cada sprint
```bash
# 1. Type check
npx --prefix "C:\dev\portal-mopar" tsc --noEmit --project "C:\dev\portal-mopar\tsconfig.json"
# Esperado: nenhuma saída (EXIT:0)

# 2. Build
Push-Location "C:\dev\portal-mopar"; npm run build 2>&1; Pop-Location
# Esperado: "built in X.XXs" sem erros; chunk inicial ≤ 100 kB gzip

# 3. Playwright
Push-Location "C:\dev\portal-mopar"; npx playwright test 2>&1; Pop-Location
# Esperado: todos os testes passando (sem regressão dos existentes)

# 4. Security advisors
mcp__supabase__get_advisors(type='security')
# Esperado: zero novos alertas comparado ao baseline
```

---

## SPRINT A — SLA + Fornecedores + Inventário de Peças

### Leitura prévia obrigatória
- `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\Sprints\Sprint A — SLA + Fornecedores + Inventário.md`
- `C:\dev\portal-mopar\docs\adr\001-sla-policy-architecture.md`
- `C:\dev\portal-mopar\docs\adr\002-parts-inventory-atomicity.md`
- `C:\dev\portal-mopar\src\pages\reports\components\ReportCard.tsx` (para inserir SLA badge)
- `C:\dev\portal-mopar\src\pages\materials\components\PurchaseDetailModal.tsx` (para trocar supplier)
- `C:\dev\portal-mopar\src\pages\reports\components\steps\Step5Execution.tsx` (para parts picker — ler antes)

### Feature A1: SLA Tracking

**Migration 1: `sla_policies_and_report_sla`**
Criar tabela `sla_policies` (ver schema no Sprint A doc) + adicionar colunas em `service_reports` (`priority`, `sla_policy_id`, `sla_due_at`, `sla_responded_at`).

**Migration 2: `sla_checker_function`**
Criar função `check_sla_breaches()` (SECURITY DEFINER, SET search_path='public', REVOKE de anon/authenticated, GRANT a service_role).

**Atualizar `submit_report` RPC** (já existente):
Após INSERT em `service_reports`, buscar política SLA aplicável (`service_type` + `priority`) e calcular `sla_due_at`. Atualizar o registro com `UPDATE service_reports SET sla_due_at = ... WHERE id = v_report_id`.

**TypeScript: `src/types/reports.ts`**
Adicionar: `priority?: string; sla_policy_id?: string | null; sla_due_at?: string | null; sla_responded_at?: string | null;`

**Componente: `src/lib/sla.ts`** (novo)
```typescript
export type SlaStatus = 'ok' | 'warning' | 'breached' | 'none';
export function getSlaStatus(sla_due_at: string | null): { status: SlaStatus; hoursRemaining: number | null; label: string }
// warning = < 25% do tempo restante
// breached = sla_due_at < now()
// none = sem sla_due_at
```

**ReportCard.tsx**: Após aging badge, adicionar SLA countdown se `report.status === 'pending_review' && report.sla_due_at`.

**Página: `src/pages/admin/SlaManagement.tsx`** (novo)
Padrão de ClientsList: tabela de políticas + dialog de criação/edição. Roles: Admin/Master/Gestor.

**Edge Function: `supabase/functions/sla-checker/index.ts`** (novo)
Chama `check_sla_breaches()` via `supabase.rpc(...)` com service_role key. Retorna count de breaches notificadas.

**Dashboard widget: `src/pages/dashboard/widgets/SlaWidget.tsx`** (novo)
KPI: "% OS dentro do SLA (30d)" — RPC `get_sla_compliance(p_days int)` a ser criado.

### Feature A2: Gestão de Fornecedores

**Migration: `suppliers_table`**
Criar tabela `suppliers` + adicionar `supplier_id` em `material_requests` (manter `supplier_name` legado como nullable).

**Arquivos novos**: `src/types/supplier.ts`, `src/services/supplierService.ts`, `src/hooks/useSuppliers.ts`, `src/pages/suppliers/SupplierManagement.tsx`

**Editar `PurchaseDetailModal.tsx`**: Substituir input text de fornecedor por Select que usa `useSuppliers()`. Manter fallback de texto manual quando supplier_id = null.

**App.tsx + AppLayout.tsx**: Rota `/suppliers`, nav item "Fornecedores" com ícone `Building2`, roles `['Comprador','Admin','Master','Gestor']`.

### Feature A3: Inventário de Peças

**Migration: `parts_inventory`**
Criar tabelas `parts` e `os_parts` (ver schema em Sprint A doc) + RLS em ambas.

**RPC: `use_part(p_report_id uuid, p_part_id uuid, p_qty numeric)`**
Migration separada: `use_part_rpc`. SECURITY INVOKER, SET search_path='public'.

**Arquivos novos**: `src/types/part.ts`, `src/services/partService.ts`, `src/hooks/useParts.ts`, `src/pages/parts/PartsManagement.tsx`

**Editar `Step5Execution.tsx`** (wizard OS):
Adicionar seção "Peças Utilizadas" com ComboBox de busca de peças do catálogo + campo de quantidade + botão "Adicionar". Manter textarea `parts_used` como fallback/notas.

**App.tsx + AppLayout.tsx**: Rota `/parts`, nav item "Estoque" com ícone `Package`, roles `['Admin','Master','Gestor','Supervisor']`.

---

## SPRINT B — Ordem de Compra + Relatório de Despesas + QR Code

### Leitura prévia obrigatória
- `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\Sprints\Sprint B — PO + Expense Reports + QR Code.md`
- `C:\dev\portal-mopar\docs\adr\003-expense-report-total-amount.md`
- `C:\dev\portal-mopar\docs\adr\004-qr-code-library.md`
- `C:\dev\portal-mopar\src\pages\materials\MaterialsList.tsx` (para entender o fluxo de compras atual)
- `C:\dev\portal-mopar\src\pages\reports\NewReport.tsx` (para adicionar query param handling)
- `C:\dev\portal-mopar\src\pages\reports\components\steps\Step2AssetContext.tsx` (para initial values)

### Feature B1: Purchase Order

**Migrations**: `purchase_orders` (tabelas `po_sequences`, `purchase_orders`, `purchase_order_items` + RLS)
**RPC**: `generate_purchase_order(p_request_id uuid, p_items jsonb)` — atômico, gera PO number via `po_sequences`

**Instalar**: sem novas dependências (jsPDF já existente)

**`src/utils/gerarPdfPO.ts`** (novo): Padrão idêntico a `gerarPdfRelatorio.ts`. Cabeçalho com logo tenant, dados fornecedor, tabela de itens, total, campo de assinatura.

**Editar `PurchaseDetailModal.tsx`**: Após status "Comprado", exibir botão "Gerar Ordem de Compra" que abre `POFormDialog` (selecionar itens + valor + confirmar). Após geração, exibir número do PO e link para PDF.

**`PODetailDialog.tsx`** (novo): Visualização do PO com botão "Confirmar Recebimento" (chama RPC `receive_purchase_order(p_po_id)`).

### Feature B2: Relatório de Despesas

**Migrations**: `expense_reports` (tabela + FK em reimbursements + view `expense_reports_with_total`)

**Criar `ExpenseReportService.ts`**: `listarRelatorios()`, `criarRelatorio()`, `adicionarReembolso(reportId, reimbursementId)`, `submeterRelatorio()`, `aprovarRelatorio()`, `rejeitarRelatorio()`.

**`src/pages/reimbursements/ExpenseReports.tsx`** (novo): Lista de relatórios de despesa. Botão "Novo Relatório" → dialog de criação (título + período) → após criar, usuário seleciona reembolsos pendentes para vincular.

**Modificar `ReimbursementsList.tsx`**: Adicionar tab ou toggle "Avulsos / Relatórios".

### Feature B3: QR Code → OS

**Instalar dependências**:
```
npm install qr-code-styling --prefix "C:\dev\portal-mopar"
```
(`@zxing/browser` carregado dinamicamente, não instalar diretamente)

**`src/utils/gerarEtiquetaQR.ts`** (novo):
- `gerarQrDataUrl(equipmentId, clientId)` → QR encoda URL `/reports/new?asset_id=X&client_id=Y`
- `exportarEtiquetaPDF(equipment)` → jsPDF A7 com QR + nome + serial + logo

**`src/components/QRScanner.tsx`** (novo):
- Tenta `BarcodeDetector` nativo primeiro
- Fallback: `await import('@zxing/browser')`
- Props: `onScan(data: string): void; onClose(): void`

**Editar `EquipmentManagement.tsx`**: Botão "Etiqueta QR" por linha da tabela → chama `exportarEtiquetaPDF`.

**Editar `NewReport.tsx`**: Ler `useSearchParams()` → se `asset_id` e `client_id` presentes, passar como `initialValues` para o wizard.

**Editar `Step2AssetContext.tsx`**: Aceitar prop `initialAssetId?: string` e `initialClientId?: string` → pré-selecionar sem necessidade de interação do usuário.

---

## SPRINT C — Portal do Cliente + CSAT + Agenda

### Leitura prévia obrigatória
- `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\Sprints\Sprint C — Portal Cliente + CSAT + Agenda.md`
- `C:\dev\portal-mopar\docs\adr\005-client-portal-auth.md`
- `C:\dev\portal-mopar\docs\adr\006-dispatch-calendar-library.md`
- `C:\dev\portal-mopar\src\contexts\AuthContext.tsx` (entender redirect logic)
- `C:\dev\portal-mopar\src\App.tsx` (entender estrutura de rotas e guards)

### Feature C1: Portal do Cliente

**⚠️ Ponto crítico de segurança**: Testar isolamento RLS com dois clientes distintos antes de qualquer outro passo. Criar 2 usuários com `role=Cliente` e `client_id` diferentes; verificar que cada um vê apenas suas próprias OS via `execute_sql`.

**Migration `client_portal_role`**: ADD VALUE 'Cliente' ao enum + ADD COLUMN `client_id` em `users` + policy adicional em `service_reports`.

**Verificar interação de policies**: Após migration, rodar `get_advisors(security)` e testar manualmente com dois client users.

**`src/components/layout/ClientLayout.tsx`** (novo): Layout simplificado (sem sidebar de admin, sem nav de módulos internos, apenas logo + nome do tenant + logout).

**`src/pages/client/ClientDashboard.tsx`** (novo): Lista de OS do cliente logado. Sem filtros de time, sem dados de outros clientes. Link para detalhe.

**`src/pages/client/ClientReportDetail.tsx`** (novo): Detalhe read-only da OS. Sem internal_notes, sem reviewer_comment internos. Botão "Baixar PDF" apenas se status=approved.

**AuthContext.tsx**: Após login, se `user.role === 'Cliente'`, redirecionar para `/client` em vez de `/dashboard`.

### Feature C2: CSAT

**Migration `csat_system`**: Tabelas `csat_tokens` + `csat_responses` + policy anon para INSERT.

**`process_report_action` RPC** (já existente): Adicionar bloco após status → 'approved' que insere em `csat_tokens` para o report_id.

**Edge Function `send-csat-email`**: Envia email ao `clients.contato_email` com link `/csat/{token}`.

**`src/pages/csat/CsatSurvey.tsx`** (novo — rota pública `/csat/:token`): Sem auth. 5 estrelas (ícone Star), campo de comentário, botão Enviar. Após resposta: mensagem de agradecimento.

**Rota em App.tsx**: `/csat/:token` fora do AuthGuard (acessível sem login).

### Feature C3: Agenda de Despacho

**Instalar**:
```
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction --prefix "C:\dev\portal-mopar"
```

**`src/hooks/useDispatchReports.ts`** (novo): Busca `service_reports` com `service_date IS NOT NULL`, select mínimo (id, service_date, status, technician_id, client_id, clients(name), users(full_name)).

**`src/pages/dispatch/DispatchCalendar.tsx`** (novo):
- FullCalendar com views month + week
- Eventos coloridos por status (usar REPORT_STATUS_COLOR existente)
- Drag-and-drop: on `eventDrop`, `supabase.from('service_reports').update({service_date: newDate}).eq('id', event.id)` — apenas Gestor/Supervisor
- Filtro por técnico (multiselect de users com role=Técnico)

---

## SPRINT D — CPQ: Assinatura Eletrônica + Versionamento

### Leitura prévia obrigatória
- `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\Sprints\Sprint D — CPQ Assinatura + Versionamento.md`
- `C:\dev\portal-mopar\docs\adr\007-esignature-approach.md`
- `C:\dev\portal-mopar\src\pages\orcamentos\OrcamentoDetail.tsx` (fluxo de aprovação atual)
- `C:\dev\portal-mopar\src\services\orcamentoService.ts` (atualizarOrcamento — onde snapshot vai)
- `C:\dev\portal-mopar\src\utils\gerarPdfRelatorio.ts` (padrão para PDF do orçamento)

### Feature D1: Assinatura Eletrônica

**Migration `orcamento_signature_flow`**: ADD VALUE 'assinado' ao enum + tabelas `orcamento_sign_tokens` + `orcamento_signatures` + policy anon INSERT.

**RPC `sign_orcamento(...)`**: SECURITY DEFINER (acesso anon), SET search_path='public', REVOKE de PUBLIC/anon/authenticated antes de GRANT específico.

**`src/pages/orcamentos/OrcamentoSign.tsx`** (novo): Rota pública `/orcamentos/:id/assinar/:token`. Canvas de assinatura (reutilizar lógica de `report_signatures` existente se houver canvas).

**OrcamentoDetail.tsx**: Botão "Enviar para Assinatura" após status=aprovado (apenas Gestor/Admin/Master) → gera token via RPC + exibe link copiável.

**`src/utils/gerarPdfOrcamento.ts`** (novo): PDF de orçamento com itens, totais, condições e — se assinado — imagem da assinatura + "Assinado por {nome} em {data}".

**Atualizar `src/types/orcamento.ts`**: Adicionar 'assinado' ao OrcamentoStatus enum + LABEL + COLOR (ex: bg-violet-100 text-violet-800).

### Feature D2: Versionamento

**Migration `orcamento_versions`**: Tabela `orcamento_versions` + RLS.

**Editar `orcamentoService.ts` — `atualizarOrcamento`**: Antes do UPDATE, buscar dados atuais (titulo, observacoes, validade, desconto_pct + itens) e inserir em `orcamento_versions` com `version_number = count+1`.

**`src/pages/orcamentos/components/OrcamentoVersionPanel.tsx`** (novo): Accordion de versões. Cada versão mostra data, autor, itens e valores daquele momento.

---

## SPRINT E — OCR + Budget + Knowledge Base + Lifecycle

### Leitura prévia obrigatória
- `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\Sprints\Sprint E — OCR + Budget + Knowledge Base + Lifecycle.md`
- `C:\dev\portal-mopar\docs\adr\008-ocr-provider.md`
- `C:\dev\portal-mopar\src\pages\reimbursements\NewReimbursement.tsx` (para inserir OCR)
- `C:\dev\portal-mopar\src\pages\equipments\components\EquipmentDetailDialog.tsx` (para lifecycle panel)

### Feature E1: OCR

**Pré-requisito**: `OPENAI_API_KEY` configurado no Supabase Edge Function secrets.

**Edge Function `extract-receipt`**: Input `{ image_url }`, output `OcrResult` (validado com Zod).

**NewReimbursement.tsx**: Após upload de foto (`foto_url`), exibir botão "Extrair dados automaticamente" → chama `ocrService.extractReceipt(url)` → preenche campos com `setValue` (react-hook-form). Spinner durante extração. Se confidence < 0.6: "Extração incerta — verifique os dados".

### Feature E2: Budget Control

**Migration `budget_control`**: Tabela `budgets` + RLS.

**RPC `check_budget(p_category text, p_amount numeric, p_date date)`**: SECURITY INVOKER, retorna `{ status, used_amount, limit_amount, pct_used }`.

**NewReimbursement.tsx**: No `onSubmit`, antes de salvar, chamar `check_budget`. Se `status === 'exceeded'`: exibir dialog de confirmação com justificativa obrigatória (salvo em `description` ou novo campo `budget_override_reason`).

**BudgetManagement.tsx** (novo): CRUD de orçamentos por categoria. Roles: Financeiro/Gestor/Admin/Master.

### Feature E3: Knowledge Base

**Migration `knowledge_base`**: Tabela `kb_articles` com GIN index para full-text search.

**Instalar**: `@uiw/react-md-editor` ou similar para editor markdown. Verificar tamanho do bundle e lazy import.

**kbService.ts** (novo): `search(query)` usa `supabase.from('kb_articles').select(...).textSearch('fts_col', query, { type: 'websearch', config: 'portuguese' })`.

**Step1Identification.tsx**: Após seleção de `service_type`, buscar artigos relevantes via `kbService.search(serviceType)` e exibir como sugestões colapsáveis.

### Feature E4: Asset Lifecycle

**Migration `equipment_lifecycle`**: ADD COLUMNs em `equipments` (acquisition_cost, acquisition_date, useful_life_years, residual_value).

**`src/types/equipment.ts`**: Adicionar campos + função `calculateLifecycle(equipment, maintenanceCost)`.

**EquipmentDetailDialog.tsx**: Nova aba/seção "Financeiro" com: valor aquisição, depreciação acumulada, valor contábil atual, custo total de manutenção (soma de os_parts). Alert vermelho se custo manutenção > valor contábil.

---

## REGRAS DE COMMIT

```
# Por sprint (não por feature):
git commit -m "feat(sprint-a): SLA tracking, supplier management, parts inventory"
git commit -m "feat(sprint-b): purchase orders, expense reports, QR code asset flow"
git commit -m "feat(sprint-c): client portal, CSAT surveys, dispatch calendar"
git commit -m "feat(sprint-d): e-signature on quotes, quote versioning"
git commit -m "feat(sprint-e): OCR receipts, budget control, knowledge base, asset lifecycle"

# Co-authored sempre:
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## ATUALIZAÇÃO DE DOCUMENTAÇÃO PÓS-SPRINT

Após cada sprint concluído:
1. Atualizar `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\Fluxos de Processo — Portal Mopar.md` com novos fluxos
2. Marcar features como `✅ Concluído` no arquivo de sprint correspondente
3. Atualizar `ROADMAP.md` no repositório (Status: Planned → Done)
4. Atualizar `06 - Histórico de Sessões.md` no Obsidian

---

*Prompt versão 1.0 — criado em 2026-05-24*
*Próxima revisão: após conclusão do Sprint B*
