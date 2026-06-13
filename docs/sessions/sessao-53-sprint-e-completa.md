# Sessão 53 — 24/05/2026 — Sprint E Completa

**Commits:** `8a7ddad` (Sprint E) | Push: `origin/master` atualizado

### Features entregues

**E1 — OCR em Comprovantes** (já existia): confirmado que `aiService.ts` + `CaptureStep` já cobrem todos os acceptance criteria via Edge Function `ai-proxy`.

**E2 — Controle de Budget:**
- Tabela `budgets` + RPCs `check_budget` e `get_budget_burn` (migration `budget_control_v2`)
- `BudgetManagement.tsx` em `/admin/budget` — CRUD com toggle ativo/inativo
- `BudgetBurnWidget` — progress bars CSS por categoria (sem Recharts para não inflar bundle)
- Widget no dashboard de Financeiro, Gestor, Admin, Master
- `checkBudget()` pré-submit em `NewReimbursement`: bloqueia Técnico, avisa Gestor/Admin/Master

**E3 — Base de Conhecimento:**
- Tabela `kb_articles` com FTS `to_tsvector('portuguese', ...)` e índice GIN
- `KnowledgeBase.tsx` em `/knowledge` — busca + filtros por tipo/tag + CRUD para Gestor+
- Sugestões inline no Step 1 do wizard de OS quando service_type é selecionado
- `view_count` via RPC `increment_kb_view`

**E4 — Ciclo de Vida do Ativo:**
- Colunas `acquisition_cost`, `acquisition_date`, `useful_life_years`, `residual_value` em `equipments`
- `calculateLifecycle()` com depreciação linear em `src/types/equipment.ts`
- Painel financeiro no `EquipmentDetailDialog` (valor contábil, depreciação, anos restantes)
- Alertas: vermelho (vida útil encerrada), âmbar (< 1 ano restante)
- Formulário de equipamento com seção "Ciclo de Vida Financeiro"

### Validação
- `tsc --noEmit` EXIT:0
- `npm run build` chunk principal 99.36 kB gzip (limite 100 kB)
- Playwright: 21 passed, 32 skipped, 0 failed

### Bug corrigido
- `KnowledgeBase.tsx` — `'new' as const | null` causava TS2304; simplificado para `useState<KbArticle | null>(null)`
- `equipment.test.ts` — mock `makeEquipment` atualizado com campos E4 obrigatórios
