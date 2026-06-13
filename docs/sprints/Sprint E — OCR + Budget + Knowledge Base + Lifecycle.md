# Sprint E — OCR + Controle de Budget + Knowledge Base + Ciclo de Vida do Ativo
*Status: **Concluído** ✅ | Commit: `8a7ddad` | 2026-05-24*
*Pré-requisito: [[Sprint D — CPQ Assinatura + Versionamento]] concluído*

---

## Objetivo

Atingir **maturidade de plataforma** com automação de entrada de dados (OCR), controle financeiro por categoria (Budget), base de conhecimento para técnicos (Knowledge Base) e rastreabilidade financeira completa dos ativos (Lifecycle). Estes recursos diferenciam o NextAI de ferramentas de gestão operacional básica e abrem o mercado enterprise.

---

## Feature E1 — OCR em Comprovantes de Reembolso ✅

### Problema
Técnico tira foto do recibo e precisa digitar manualmente valor, estabelecimento e data. SAP Concur extrai esses dados automaticamente via OCR.

### Status
Já estava implementado desde sprints anteriores. `aiService.ts` possui `extractReceiptFromImages()` e `extractReceiptFromVoice()`, chamando a Edge Function `ai-proxy`. `NewReimbursement.tsx` usa `CaptureStep` com extração automática por câmera ou áudio. Acceptance criteria totalmente atendidos.

### Acceptance Criteria
- [x] Após upload de foto do comprovante, extração automática via IA é acionada
- [x] Campos `amount`, `category`, `description` e `expense_date` são preenchidos automaticamente
- [x] Usuário confirma/corrige antes de salvar (campos ficam destacados como "AI filled")
- [x] Se extração falhar, fallback silencioso para preenchimento manual
- [x] Suporte a entrada por voz (`extractReceiptFromVoice`)

### Arquivos relevantes
| Arquivo | Detalhe |
|---------|---------|
| `src/services/aiService.ts` | `extractReceiptFromImages()`, `extractReceiptFromVoice()` |
| `src/components/capture/CaptureStep.tsx` | UI de captura (câmera + voz) |
| `src/pages/reimbursements/NewReimbursement.tsx` | Orquestração do fluxo OCR → form |
| `supabase/functions/ai-proxy/` | Edge Function que chama o modelo LLM |

---

## Feature E2 — Controle de Orçamento por Categoria ✅

### Acceptance Criteria
- [x] Financeiro/Gestor pode definir orçamentos por categoria + período (mensal/trimestral/anual)
- [x] Ao submeter reembolso, sistema verifica gasto acumulado via RPC `check_budget`
- [x] Se > 80% do orçamento: toast de aviso (warning) exibido ao usuário
- [x] Se > 100% do orçamento: bloqueio para Tecnico; Gestor/Admin/Master submetem com aviso
- [x] Dashboard: widget `BudgetBurnWidget` com burn rate por categoria (Financeiro, Gestor, Admin, Master)
- [x] Toggle ativo/inativo por budget, com Switch

### Schema DB aplicado (`budget_control_v2`)
```sql
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL DEFAULT get_caller_team_id() REFERENCES public.tenants(id),
  category text NOT NULL,
  period_type text NOT NULL DEFAULT 'monthly'
    CHECK (period_type IN ('monthly','quarterly','annual')),
  amount_limit numeric(12,2) NOT NULL,
  start_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS RESTRICTIVE team_isolation + policy manage_budget
-- RPCs: check_budget(p_category, p_amount, p_date), get_budget_burn()
```

### Arquivos
| Arquivo | Ação |
|---------|------|
| `src/types/budget.ts` | `Budget`, `BudgetBurnRow`, `BudgetCheckResult`, `PERIOD_LABELS` (novo) |
| `src/services/budgetService.ts` | CRUD + `checkBudget()` + `getBudgetBurn()` (novo) |
| `src/pages/admin/BudgetManagement.tsx` | CRUD de orçamentos em `/admin/budget` (novo) |
| `src/pages/dashboard/widgets/BudgetBurnWidget.tsx` | Progress bars por categoria, sem Recharts (novo) |
| `src/pages/dashboard/widgetRegistry.ts` | `'budget-burn'` adicionado ao WidgetId |
| `src/pages/dashboard/dashboardConfig.ts` | Widget em Financeiro, Gestor, Admin, Master |
| `src/pages/dashboard/Dashboard.tsx` | Render do `BudgetBurnWidget` |
| `src/pages/reimbursements/NewReimbursement.tsx` | `checkBudget()` pré-submit |
| `src/components/layout/AppLayout.tsx` | Link "Controle de Budget" → `/admin/budget` |
| `src/App.tsx` | Rota `/admin/budget` para Gestor/Admin/Master |

---

## Feature E3 — Knowledge Base / Base de Conhecimento ✅

### Acceptance Criteria
- [x] Admin/Gestor pode criar, editar e desativar artigos (título, conteúdo Markdown, service_type, tags, is_public)
- [x] Técnico acessa KB em `/knowledge` — pesquisa full-text em português, filtro por tipo e tag
- [x] No wizard de nova OS (Step 1), após selecionar `service_type`, até 3 artigos sugeridos aparecem inline
- [x] Artigos têm contador de visualizações (incrementado via RPC `increment_kb_view` ao abrir)
- [x] Artigos `is_public: true` marcados com badge Global (pronto para integração com portal cliente)
- [x] Busca usa `to_tsvector('portuguese', ...)` com índice GIN — busca semântica nativa

### Schema DB aplicado (`knowledge_base`)
```sql
CREATE TABLE public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL DEFAULT get_caller_team_id(),
  title text NOT NULL,
  content text NOT NULL,           -- Markdown
  service_type text,
  tags text[],
  is_public boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- GIN index para FTS português
-- RPC increment_kb_view(p_article_id uuid)
-- trigger updated_at automático
```

### Arquivos
| Arquivo | Ação |
|---------|------|
| `src/types/kb.ts` | `KbArticle`, `CreateKbArticleDTO`, `UpdateKbArticleDTO` (novo) |
| `src/services/kbService.ts` | CRUD + `listKbArticles()` + `getSuggestionsForServiceType()` + `incrementView()` (novo) |
| `src/pages/knowledge/KnowledgeBase.tsx` | Página completa com `ArticleViewDialog` + `ArticleEditorDialog` inline (novo) |
| `src/pages/reports/components/steps/Step1Identification.tsx` | Sugestões KB por service_type |
| `src/components/layout/AppLayout.tsx` | Link "Base de Conhecimento" → `/knowledge` (todos os perfis operacionais) |
| `src/App.tsx` | Rota `/knowledge` para todos exceto Cliente |

---

## Feature E4 — Ciclo de Vida Financeiro do Ativo ✅

### Acceptance Criteria
- [x] Equipamento tem campos: custo de aquisição, data de aquisição, vida útil (anos), valor residual
- [x] Sistema calcula: depreciação linear acumulada, valor contábil atual, anos restantes
- [x] `EquipmentDetailDialog` exibe painel "Ciclo de Vida Financeiro" com esses dados
- [x] Alert vermelho quando vida útil encerrada; alert âmbar quando resta menos de 1 ano
- [x] Formulário de equipamento atualizado com seção "Ciclo de Vida Financeiro"

### Schema DB aplicado (`equipment_lifecycle`)
```sql
ALTER TABLE public.equipments
  ADD COLUMN IF NOT EXISTS acquisition_cost  numeric(12,2),
  ADD COLUMN IF NOT EXISTS acquisition_date  date,
  ADD COLUMN IF NOT EXISTS useful_life_years integer,
  ADD COLUMN IF NOT EXISTS residual_value    numeric(12,2) DEFAULT 0;
```

### Função de cálculo (`src/types/equipment.ts`)
```typescript
export function calculateLifecycle(eq: Equipment, totalMaintenanceCost: number): LifecycleInfo | null
// Depreciação linear: (acquisition_cost - residual_value) / useful_life_years
// currentBookValue = max(residual_value, acquisition_cost - totalDepreciation)
// yearsRemaining = max(0, useful_life_years - yearsElapsed)
```

### Arquivos
| Arquivo | Ação |
|---------|------|
| `src/types/equipment.ts` | Novos campos E4 + `LifecycleInfo` + `calculateLifecycle()` |
| `src/types/__tests__/equipment.test.ts` | Mock atualizado com campos E4 |
| `src/pages/equipments/EquipmentManagement.tsx` | Form com seção "Ciclo de Vida Financeiro" |
| `src/pages/equipments/components/EquipmentDetailDialog.tsx` | Painel financeiro + alertas de vida útil |

---

## Checklist de Sprint E

- [x] Migrations aplicadas: `budget_control_v2`, `knowledge_base`, `equipment_lifecycle`
- [x] RPC `check_budget` e `get_budget_burn` validados
- [x] RPC `increment_kb_view` e trigger `updated_at` em `kb_articles`
- [x] `tsc --noEmit` EXIT:0
- [x] `npm run build` — chunk principal 99.36 kB gzip (limite: 100 kB) ✅
- [x] Playwright: 21 passed, 32 skipped (credenciais), 0 failed
- [x] Commit: `8a7ddad` — `feat(sprint-e): OCR reembolsos, controle de budget, base de conhecimento e ciclo de vida de ativos`
- [x] Push: `origin/master` atualizado
- [x] Vercel: deploy via push (integração GitHub) ou `vercel deploy --prod`

---

## Decisões Arquiteturais

| Decisão | Escolha | Alternativa | Motivo |
|---------|---------|-------------|--------|
| BudgetBurnWidget sem Recharts | Progress bars CSS puras | Recharts `<RadialBarChart>` | Bundle já em 99 kB; evitar inflar o chunk inicial |
| KB inline (sem rota `/knowledge/:id`) | Dialog `ArticleViewDialog` | Rota dedicada | Evita spec Playwright novo; reusa padrão já dominado |
| Budget check non-blocking em falha | try/catch silencioso | Bloquear submit | RPC pode falhar por timeout; despesa não deve ser bloqueada por instabilidade de rede |
| E1 OCR — sem implementação nova | Já coberto por `aiService` | Edge Function `extract-receipt` separada | Acceptance criteria já atendidos; não duplicar |
| Lifecycle TCO com maintenanceCost=0 | Apenas book value/depreciação | Buscar custo de peças | `EquipmentReport` não tem campo de custo; evolução futura via `os_parts` |

---

## Próximos passos sugeridos (pós-Sprint E)

- **Notificações de budget**: cron Supabase que envia email/push quando categoria atingir 80%
- **Portal Cliente — KB pública**: exibir artigos `is_public = true` no `ClientPortal`
- **TCO completo**: somar custos de peças de `os_parts` no `getEquipmentReports` para `totalMaintenanceCost` real
- **Favoritos no KB**: tabela `kb_favorites(user_id, article_id)` com sync realtime
- **Exportação TCO**: relatório PDF de ciclo de vida por equipamento
