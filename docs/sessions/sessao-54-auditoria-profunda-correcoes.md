# Sessão 54 — 24/05/2026 — Auditoria Profunda + Correções

**Commits:** `2e8e608` (auditoria-1) · `8a5b940` (auditoria-2) · `f59c6ed` (stepper fix) | Push: `origin/master` atualizado | Deploy: Vercel prod
**URL de produção:** https://nextai-plataform.vercel.app (alias `portal-mopar.vercel.app` removido)

### Escopo
Auditoria completa de todas as features entregues (Fases 0–4 + Sprints A–E + Equipamentos + Taxa de Retorno + Logo PDF).

### Metodologia
- `tsc --noEmit` como baseline de ausência de erros de tipo
- Leitura linha a linha dos arquivos críticos das sprints mais recentes
- Verificação de consistência entre rotas (`App.tsx`), nav links (`AppLayout.tsx`) e guards (`RoleGuard`)
- Análise de queries Supabase: validação de multi-coluna, operadores PostgREST, RLS implícito
- Revisão de lógica de negócio (cálculos de SLA, depreciação, burn rate)

### Bugs encontrados e corrigidos (5)

| # | Severidade | Arquivo | Bug | Fix |
|---|-----------|---------|-----|-----|
| 1 | 🔴 Crítico | `kbService.ts:25` | `textSearch('title, content')` — coluna composta inválida no PostgREST; toda pesquisa na KB retornava erro 400 silencioso | Substituído por `.or('title.ilike.%term%,content.ilike.%term%')` |
| 2 | 🟡 Importante | `gerarPdfRelatorio.ts:138` | Logo com `width=40, height=16` fixos distorce logos não-horizontais | `width=0` (auto-aspecto a partir da height=16) |
| 3 | 🟡 Importante | `useDashboardData.ts:190` | SLA rate comparava `sla_due_at > hoje` em OS **resolvidas** — qualquer OS aprovada há > X dias resultava em 0% | Recalculado em OS **abertas**: % das OS abertas ainda dentro do prazo SLA |
| 4 | 🟡 Importante | `EquipmentDetailDialog.tsx:118` | `acquisition_cost!` non-null assertion desnecessária | `acquisition_cost ?? 0` |
| 5 | 🟢 Melhoria | `EquipmentManagement.tsx:243` | `catch (e: any)` perde type safety | `catch (e)` com `instanceof Error` |

### Limitações documentadas (não corrigidas — requerem decisão arquitetural)
- **KB Markdown render**: `react-markdown` inflaria bundle além de 100 kB — aguarda decisão sobre renderização server-side ou parser leve
- **SLA rate histórico real**: precisão absoluta exige coluna `resolved_at` em `service_reports` ou RPC com join em `report_status_history`
- **`window.confirm()`**: usado em `BudgetManagement.tsx` e `KnowledgeBase.tsx` — inconsistente com padrão de Dialog do app; requer substituição por Dialog de confirmação

### Validação pós-correção (auditoria-1)
- `tsc --noEmit` EXIT:0
- `npm run build` chunk principal 99.37 kB gzip (limite 100 kB) ✅
- Sem regressão em rotas, guards ou lógica existente

### Bugs adicionais corrigidos — auditoria-2 (commit `8a5b940`)

| # | Severidade | Arquivo | Bug | Fix |
|---|-----------|---------|-----|-----|
| 6 | 🔴 Segurança | `ClientPortalLayout.tsx` | `supabase.auth.signOut()` direto bypassa limpeza de localStorage/sessionStorage do AuthContext | Usa `signOut()` do `useAuth()` |
| 7 | 🔴 Segurança | `AppLayout.tsx` | Cache de clientes (`useClients`) não era invalidado no logout — dados cross-tenant persistiam em memória | Chama `invalidateClientsCache()` antes de `signOut()` |
| 8 | 🟡 Correção | `partService.ts:60` | Typo: parâmetro `osPardId` → `osPartId` (afetava rastreabilidade de erros) | Renomeado |
| 9 | 🟡 Correção | `AgendaPage.tsx` | `weekEnd = addDays(weekStart, 6)` recalculado a cada render mas listado nas deps do `useCallback` — causava recriação desnecessária | Computado inline dentro do callback; deps corrigidas para `[weekStart, isManager, user?.id]` |
| 10 | 🟢 UX | `ClientPortal.tsx` | Loading exibia `<p>Carregando...</p>` em texto puro — inconsistente com padrão `Loader2` do app | Substituído por `<Loader2 className="h-7 w-7 animate-spin text-primary" />` |
| 11 | 🟢 Acessibilidade | `KnowledgeBase.tsx` | Botão de limpar busca sem `aria-label` — inacessível a leitores de tela | Adicionado `aria-label="Limpar pesquisa"` |

### Validação pós-correção (auditoria-2)
- `tsc --noEmit` EXIT:0
- `npm run build` chunk principal 99.42 kB gzip ✅
- Deploy Vercel prod: `https://nextai-plataform-gkscst2mk-luis-projects-1fb80015.vercel.app`

### Fix de RLS — 403 em `/suppliers` e `/parts` (migration `fix_rls_suppliers_and_parts`)

**Causa raiz:** `suppliers` e `parts` tinham apenas a policy RESTRICTIVE `team_isolation` mas nenhuma policy PERMISSIVE. PostgreSQL bloqueia 100% dos acessos quando só há RESTRICTIVE sem PERMISSIVE — resulta em HTTP 403 em todas as queries dessas tabelas.

**Fix:** adicionadas policies PERMISSIVE espelhando o padrão de `clients` e `equipments`:

| Tabela | Policy | Tipo | Efeito |
|--------|--------|------|--------|
| `suppliers` | `suppliers_select_authenticated` | PERMISSIVE SELECT | Qualquer autenticado lê (dentro do team) |
| `suppliers` | `suppliers_managers_all` | PERMISSIVE ALL | Gestão cria/edita/exclui |
| `parts` | `parts_select_authenticated` | PERMISSIVE SELECT | Qualquer autenticado lê (dentro do team) |
| `parts` | `parts_managers_all` | PERMISSIVE ALL | Gestão cria/edita/exclui |

### Fix de UX — Stepper do wizard Nova OS (commit `f59c6ed`)

**Problema:** `NewReport.tsx` renderizava dois elementos redundantes sobrepostos: uma barra fina `h-1.5` (linha 244) + círculos numerados com conectores `w-4` fixos (linha 252). A barra ficava flutuando solta acima dos círculos, visualmente quebrado.

**Varredura:** único arquivo afetado — `NewMaterialRequest.tsx` e `NewReimbursement.tsx` usam `'capture'|'form'` sem stepper numerado.

**Fix:** removida a barra standalone e a variável `progress`. Stepper redesenhado como elemento único: conectores `flex-1` que se preenchem com a cor primária via `style={{ width: isDone ? '100%' : '0%' }}`. Círculos com `title={label}` para acessibilidade.

- `tsc --noEmit` EXIT:0 | bundle: 99.43 kB gzip ✅

### Infra — remoção do alias `portal-mopar.vercel.app`

Alias removido via CLI Vercel (`vercel alias rm portal-mopar.vercel.app`). Domínio principal consolidado em **https://nextai-plataform.vercel.app**.
