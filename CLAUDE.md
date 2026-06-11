# NextAI — Portal Mopar · Contexto de Desenvolvimento

## Ecossistema NextAI — repositórios

| Repositório | Diretório local | Produção | Finalidade |
|---|---|---|---|
| `nextai-plataform` | `portal-mopar/` | `nextai-plataform.vercel.app` | App SaaS (este repo) |
| `nextai-landing` | `nextai-landing/` | `nextai-landing-gilt.vercel.app` | Landing page pública |

**NUNCA commitar a pasta `nextai-landing/` dentro do repo `nextai-plataform`** — são repos independentes com deploys separados na Vercel.

---

## Ambiente (app principal)

- **Diretório local:** `C:\Users\vanze\OneDrive\Área de Trabalho\portal-mopar`
- **GitHub:** `https://github.com/vanzer80/nextai-plataform.git`
- **Produção:** `https://nextai-plataform.vercel.app` (auto-deploy ao push no master)
- **Supabase Project ID:** `sksursvmgvxqbbdsztcd`
- **Dev server:** `npm run dev` (porta 3001)
- **Obsidian vault:** `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\`

## Verificações obrigatórias após qualquer mudança

```bash
npx tsc --noEmit          # deve retornar EXIT:0 sem output
npm run build             # chunk principal ≤ 100 kB gzip
npx vitest run            # 117+ testes passando
```

Após migrations: rodar `get_advisors(type='security')` via MCP Supabase → zero novos alertas.

## Stack técnica

React 19 + TypeScript + Vite (SPA com lazy loading por módulo)  
Tailwind CSS + Shadcn/UI (base-ui) + tw-animate-css + @formkit/auto-animate  
Supabase: Auth, PostgreSQL, RLS multi-tenant, Storage, Realtime, Edge Functions  
jsPDF + jspdf-autotable · react-hook-form + Zod v4 · date-fns (ptBR) · sonner  
driver.js v1.4.0 · Vitest (unit) + Playwright (E2E) · PWA: `public/sw.js` cache `nextai-v7`

## Roles

```typescript
type UserRole = 'Tecnico' | 'Administrativo' | 'Supervisor' | 'Gestor' |
                'Financeiro' | 'Comprador' | 'Admin' | 'Master' | 'Cliente';
// SuperMaster = role=Master + isPlatform=true (via tenant.is_platform)
```

## Tenants ativos

| Tenant | Slug | Email | Status |
|--------|------|-------|--------|
| NextAI (plataforma) | nextai | nextai@gmail.com | SuperMaster (is_platform=true) |
| Mopar Engenharia | mopar | master@gmail.com | Ativo |
| Zambrano Engenharia | zamb-eng | zambrano@zambranoengenharia.com.br | Ativo |

Usuários de teste Mopar: `equipemoparsul02@gmail.com` (Técnico), `gestao@gmail.com` (Gestor)

## Regras críticas do banco (não violar)

### getTeamId() — único padrão correto
```typescript
async function getTeamId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const { data } = await supabase.from('users').select('team_id').eq('id', user.id).single();
  if (!data?.team_id) throw new Error('Usuário sem equipe');
  return data.team_id;
}
```
**NUNCA usar `team_members`** — tabela não existe. A tabela é `public.users`.

### RLS multi-tenant
- **Reads:** NÃO adicionar `.eq('team_id', teamId)` — o RLS já filtra via `get_my_team_id()`
- **Writes (INSERT):** injetar `team_id` manualmente — `{ ...dto, team_id }` — RLS não injeta em inserts
- Toda nova tabela precisa de policy `team_isolation` RESTRICTIVE no mesmo migration

### FK ambígua employees ↔ departments (PGRST201)
```typescript
// ✅ CERTO — hint por coluna
department:department_id(name)
// ❌ ERRADO — PGRST201
department:departments(name)
```

### Auth cold-start (Supabase Free Tier hiberna ~7 dias sem atividade)
- **Keep-alive automático ✅** — `.github/workflows/supabase-keepalive.yml` faz PATCH em `public.app_health` diariamente às 08:17 UTC via `SUPABASE_SERVICE_ROLE_KEY` (GitHub Secret). Tabela singleton `app_health(id=1, last_ping)` com RLS sem policies → só service_role acessa (BYPASSRLS).
- `withTimeout(8000)` em todas as queries de perfil
- Cache `localStorage` `nextai-profile-v1-{uid}` com TTL 7 dias
- Safety net de 10s no AuthContext desbloqueando loading compulsoriamente
- Pré-aquecer 30min antes de demos: logar no app

### RPCs — padrão de segurança
```sql
-- Padrão normal
CREATE FUNCTION minha_rpc() RETURNS ... LANGUAGE plpgsql
SECURITY INVOKER SET search_path = 'public' AS $$...$$;

-- SECURITY DEFINER apenas para cross-tenant (SuperMaster)
-- Obrigatório: REVOKE FROM PUBLIC; REVOKE FROM anon; GRANT TO authenticated;
```

## Armadilhas conhecidas (não repetir)

1. `withTimeout` + Supabase builder → tipar explicitamente como `{ data: T; error: E | null }`
2. React 19 `key` prop → usar `<Fragment key={id}>` em vez de passar key diretamente ao componente
3. `AlertDialogCancel` → não aceita `disabled`; usar `Dialog` para confirmações destrutivas
4. `react-signature-canvas` → incompatível com React 19; usar canvas HTML5 nativo
5. Bucket privado Storage → nunca `getPublicUrl`; usar `createSignedUrls`
6. Dialogs com `max-w` → sempre `sm:max-w-4xl` (com prefixo responsivo) ou não sobrescreve
7. `.single()` quando pode retornar 0 linhas → usar `.maybeSingle()` (evita 406)
8. `status` de `service_reports` → valores válidos: `draft|pending_review|returned|approved|rejected` (nunca PT)
9. Dashboard KPIs → nunca valores hardcoded de fallback; 0 quando sem dados reais
10. SW SPA blank page → handler `request.mode === 'navigate'` network-first com fallback `index.html`; ao alterar `sw.js` sempre bumpar `CACHE_NAME`
11. Zod v4 → sem `invalid_type_error`; sem `.default()` com `zodResolver` (usar `defaultValues` no `useForm`)
12. Edge Function guard → verificar `Authorization: Bearer` + JWT; nunca comparar com `apikey`
13. jsPDF 4.x → sem `setLineDash`; usar `setLineWidth + line()`
14. Trigger `updated_at` → nome correto é `handle_updated_at()`
15. Tailwind classes dinâmicas → nunca `bg-${color}-50`; criar array com classes completas literais
16. Stagger com `animationDelay` → obrigatório `fill-mode-backwards` para evitar flash
17. Transition no `:active` → não incluir `transition:` na regra `:active`, apenas `transform: scale()`
18. `useOutletContext` → sempre com optional chaining: `outletCtx?.isOnline ?? true`
19. `kbService.ts` → usar `.or('title.ilike.%term%,content.ilike.%term%')` (nunca `.textSearch`)
20. Botão submit Nova OS → texto "Enviar OS", atributo `data-onboarding="wizard-step7-enviar"`
21. Testes Playwright (SPA navigation) → usar `waitForFunction(() => !window.location.pathname.includes('/login'))` em vez de `waitForURL` com `waitUntil:'load'`
22. Supabase REVOKE: `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC` **não remove** grants explícitos por role (`anon=X/postgres` permanece no proacl). Sempre fazer `REVOKE ... FROM anon` explicitamente em funções SECURITY DEFINER.
23. `SelectValue` Radix + `setValue` programático → sempre passar `children` explícitos: `<SelectValue>{clients.find(c => c.id === watch('client_id'))?.name}</SelectValue>`. Sem isso, exibe UUID bruto quando valor é setado via `setValue`.
24. Testes E2E com Supabase free-tier → usar `waitForResponse(resp => resp.url().includes('/rest/v1/<tabela>'))` para aguardar a resposta real da API; nunca depender de texto da UI ("Carregando...") para saber quando a lista carregou — pode não aparecer se o DB responder rápido.
25. `handleSelectOS` (NovoOrcamento) → sem guard de concorrência. Duplo-clique chama a função duas vezes; Estado 2 pode não aparecer. Adicionar flag `isSelecting` ou `useRef` antes de implementar qualquer UI que possa disparar dois cliques seguidos.
26. RoleGuard de `/orcamentos/*` = `['Master','Admin','Gestor','Supervisor']` — **Tecnico não tem acesso**. Nunca mostrar botão de navegação para `/orcamentos` para role Tecnico.

## Sidebar CSS tokens (crítico)

Dentro da sidebar, SEMPRE usar tokens `bg-sidebar-*` / `text-sidebar-*`.  
Nunca `bg-background` ou `border-border` dentro da sidebar — componentes ficam invisíveis.

## Estrutura do sidebar (NAV_GROUPS)

`AppLayout.tsx` usa `NAV_GROUPS: NavGroup[]` — 9 grupos funcionais estilo SAP:

| Grupo | Módulos principais |
|---|---|
| `` (sem label) | Dashboard |
| Operações de Campo | OS · Agenda · Manutenção Preventiva |
| Comercial | Clientes · Orçamentos |
| Suprimentos | Compras · Fornecedores · Peças/Estoque · Equipamentos |
| Financeiro | Reembolsos · Contas a Pagar · Budget |
| Recursos Humanos | Colaboradores · Departamentos · Folha · Férias · Ponto |
| Conhecimento | Base de Conhecimento |
| Configurações | Tipos de Serviço · SLA · Checklists |
| Administração | Perfil da Empresa · Administrador · Tenants |

Decisões de design: Orçamentos é CPQ (documento comercial) → Comercial. Manutenção Preventiva gera OSs → Operações de Campo. Equipamentos é ativo físico gerenciado junto ao estoque → Suprimentos. Configurações separa "configurar o sistema" de "administrar acesso" (Administração).

`authorizedLinks` = `NAV_GROUPS.flatMap(g => g.items).filter(role + tenant)` — permanece flat para `UserProfileDropdown`.  
Labels usam `text-sidebar-foreground/40` (nunca `text-muted-foreground` — fica invisível no sidebar).

## Convenções de código

- Nenhum comentário óbvio — só comentar WHY não-óbvio
- Nenhum `any` explícito — `tsc --noEmit` deve ser EXIT:0
- Services: async/await com throw em erro, sem `.eq('team_id', teamId)` nos reads
- Lazy loading: toda rota em `App.tsx` deve ser `React.lazy()` — sem exceção (inclui Login; AppLayout é o único componente síncrono no initial bundle)
- Bundle alvo: chunk principal ≤ 100 kB gzip
- Novo módulo: migration → types → service → hook → componente → página → rota + nav + **onboarding tour** (ver seção abaixo)
- **Adicionar item ao sidebar:** incluir em `NAV_GROUPS` (AppLayout.tsx) no grupo funcional correto. Nunca adicionar fora de um grupo existente — se necessário, criar novo `NavGroup`. `authorizedLinks` é derivado via `flatMap` automático.
- Responder sempre em português do Brasil

## Edge Functions deployadas

`ai-proxy` v15 (**modelo gemini-2.5-flash + thinkingBudget:0** — o free tier do gemini-2.0-flash foi ZERADO pelo Google (429 `limit: 0`), nunca voltar para ele · rate limiting 20 req/min fail-open: Deno KV → fallback Map in-memory · try/catch externo garante CORS em toda resposta · **CORS allowlist**: vercel.app prod + previews regex + localhost:3001 + secret `ALLOWED_ORIGINS` (CSV, p/ domínio customizado sem redeploy) · validação de payload: máx 5 imagens/8 MB, mime jpeg/png/webp/pdf, textos ≤ 4k chars · erro 500 genérico ao client, detalhe só em telemetria/logs · `console.warn` com motivo da falha Gemini quando fallback salva · `Access-Control-Max-Age: 86400` + `Expose-Headers` p/ `X-RateLimit-*` · versionada em `supabase/functions/ai-proxy/index.ts` · contrato testado em `tests/ai-proxy-contract.spec.ts`)  
`api-gateway` v2 (valida X-API-Key SHA-256 · rate limit 1000 req/hr · RFC 7807 · cursor pagination · idempotency · `api_access_log`)  
`os-import-processor` v7 (X-API-Key + Bearer JWT · scope orders:write · mode json/pdf · **template registry** Decathlon + **IA híbrida** Gemini→OpenAI · per-field confidence scores · resolução client/técnico · `os_import_log` · `import_confidence` em service_reports)  
`webhook-dispatcher` v2 (HMAC-SHA256 · retry 6× backoff [0,1m,5m,30m,2h,24h] · dead = attempts ≥ 6)  
`admin-create-user` v4 · `admin-delete-user` v3 · `admin-reset-password` v1  
`admin-provision-tenant` v1 · `admin-delete-tenant` v1 · `platform-update-user` v1 · `sla-checker` v1 · `send-csat-email` v1

Secrets (nunca no .env): `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `OPENAI_API_KEY`

## Estado dos testes

- **Vitest (unit):** 117 testes passando ✅ (`npx vitest run`)
- **Playwright E2E:**
  - `tests/ux/` — 37 testes UX/UI (login, RBAC, responsividade, estados)
  - `tests/orcamentos-sprint-d.spec.ts` — 5 testes Sprint D (assinatura eletrônica) — flaky cold-start free tier
  - `tests/os-orcamento-vinculacao.spec.ts` — 33 testes OS↔Orçamento linkage (31 pass, 1 flaky timing, 1 probe pendente)
  - `tests/dashboard-verify.spec.ts` — 5 testes Dashboard (Gestor, Personalizar, Período, RBAC, Master HR)
  - `tests/rh-module.spec.ts` — 7 testes RH (RBAC, lista, KPIs, admissão, departamentos) ✅ 7/7
  - `tests/dp-module.spec.ts` — 7 testes DP (RBAC, folha, status, dialog, subrotas) ✅ 7/7
  - `tests/cp-module.spec.ts` — 8 testes CP (RBAC, lista, KPIs, status, navegação, filtro REST) ✅ 8/8
  - `tests/platform-company-profile.spec.ts` — 6 testes Perfil Comercial SuperMaster ✅ 6/6
  - `tests/sidebar-verify.spec.ts` — 5 testes sidebar SAP groups (grupos, roles, ordem, navegação, console errors)
  - `tests/os-import.spec.ts` — 25 testes OS Import Bridge (IM-01→IM-25): RBAC, dialog UI, CORS, auth 401/403, validação 400/415, import mínima, deduplicação, resolução entidades, prioridade, admin page, filtros; IM-25 skipped sem `TEST_PDF_IMPORT=true`
  - `tests/ai-proxy-contract.spec.ts` — 10 testes de contrato ai-proxy (AI-01→AI-10): CORS em todo caminho de resposta (armadilha #60), allowlist de Origin (echo, hostil bloqueada, localhost dev), preflight Max-Age, auth 401, validação de payload (máx imagens, tamanho, mimeType, length de texto); nenhum consome quota de IA ✅ 10/10
- Credenciais em `tests/.env.test` (gitignored)
- **CRÍTICO:** nunca rodar spec files em paralelo com `run_in_background` — Supabase free tier + Vite não aguentam carga simultânea (ERR_CONNECTION_REFUSED cascata)

## Dashboard Real — concluído 2026-05-31

### Arquitetura

```
src/pages/dashboard/
  widgetRegistry.ts          — 15 widgets definidos; WIDGET_COL_SPAN Map O(1); DashboardPeriod type
  dashboardConfig.ts         — defaults por role (sem personalização)
  dashboardPreferencesService.ts — load/save/reset no Supabase (3 round-trips)
  useDashboardPrefs.ts       — hook: carrega prefs do banco, merge com role, segurança contra downgrade
  useDashboardData.ts        — fetch paralelo; período (7d/30d/90d/12m); visibilitychange refresh
  DashboardCustomizer.tsx    — modal toggle + setas reorder + validação ≥1 widget + toast
  Dashboard.tsx              — effectiveWidgets (sem double fetch); skeleton durante prefs load; fullWidgets (colSpan 4)
  widgets/
    CpqKpiWidget.tsx         — aprovados/pendentes/expirados/conversão/tendência
    AgendaHojeWidget.tsx     — OS hoje/técnicos/criticas/SLA vencido
    EstoqueCriticoWidget.tsx — itens abaixo do mínimo/valor total
```

### Migrations aplicadas (2026-05-31)

- `20260531_dashboard_preferences` — tabela `dashboard_preferences` + RLS + 3 RPCs
- `20260531_dashboard_bugfixes` — FK `ON DELETE CASCADE` + `expirados` no CPQ RPC

### Banco

```sql
-- Tabela
dashboard_preferences (user_id UNIQUE, team_id, widget_order jsonb)
-- RLS: user_id = auth.uid()
-- FK: user_id → auth.users(id) ON DELETE CASCADE

-- RPCs (SECURITY INVOKER)
get_dashboard_cpq_kpis(p_days int)     → jsonb  -- total, aprovados, pendentes, expirados, rejeitados, anterior
get_dashboard_estoque_kpis()           → jsonb  -- criticos, total_itens, valor_total
get_dashboard_agenda_kpis()            → jsonb  -- os_hoje, tecnicos_hoje, criticas_abertas, vencidas_sla
```

### Armadilhas novas (não repetir)

27. **Base-UI Switch** → usa `data-checked` / `data-unchecked`, não `data-state` (Radix). Em testes Playwright: `el.hasAttribute('data-checked')`.
34. **Playwright `getByPlaceholder` não é exact por default** → `getByPlaceholder('Nome completo')` casa com "Nome completo da mãe". Sempre usar `{ exact: true }` em placeholders que são substrings de outros.
35. **Playwright `getByText` em forms tabulados** → se o form tem abas (Shadcn/Radix Tabs), o mesmo texto aparece no tab button E no h2 interno. Usar `getByRole('heading', { name: '...', exact: true })` para o h2.
36. **Playwright `Promise.any` com `isVisible()`** → `isVisible()` NUNCA rejeita (resolve com `false`), então `Promise.any` resolve com o primeiro valor independente de ser `true` ou `false`. Para "qualquer badge visível", usar loop com `count()` em vez de `Promise.any`.
37. **Specs Playwright em paralelo vs Supabase free tier** → rodar dois spec files simultaneamente (ex: `run_in_background` duplo) sobrecarrega o Vite + Supabase: `waitForResponse` timeout → Vite crasha → `ERR_CONNECTION_REFUSED` em cascata. Sempre rodar um spec por vez.
31. **Guard async `useRef` + `useState`** → para handlers async chamados de listas (ex: `handleSelectOS`): `ref` bloqueia reentrada síncrona (imune a race entre renders); `state` controla `disabled` visual. Usar `try/finally` para reset garantido. Padrão consolidado em `useOfflineSync.ts`.
32. **`gerarPdfOrcamento.ts`** → `osNum` foi removida (era variável para linha crua de OS). Não recriar. OS vinculada agora é box dedicado `roundedRect` após o título, condicionado a `orcamento.report_id`.
33. **jsPDF logo width=0 + browser Image API** → NUNCA usar `addImage(..., 0, height)` em PDFs com texto ao lado — jsPDF calcula largura pelo aspect ratio e pode invadir o texto. NUNCA usar `doc.getImageProperties(dataUrl)` para pré-medir: em browser mode (canvas), retorna valores errados vs Node. Padrão correto: `await measureImage(dataUrl)` (src/utils/imageUtils.ts — usa `HTMLImageElement.naturalWidth/Height`, garantido para qualquer formato) + `fitInBox(w, h, maxW, maxH)` → passar `{w, h}` EXPLÍCITOS ao `addImage`. `headerTextX = marginL + logoW + 4`. Aplicado nos 4 PDFs. ATENÇÃO: corrigir também o callback `didDrawPage` de autoTable — pode ter `addImage` separado com o bug.
28. **Playwright getByText partial match** → `'OS Pendentes'` casa com "reembolsos **pendentes**". Sempre usar `{ exact: true }` para labels de widget no customizer.
29. **Double fetch no dashboard** → nunca passar `activeWidgets` ao `useDashboardData` enquanto `prefs.isLoading`. Usar `effectiveWidgets = prefs.isLoading ? [] : prefs.activeWidgets`. O hook trata `widgetKey === ''` retornando `isLoading: false` imediato.
30. **Onboarding modal 1200ms** → o welcome dialog aparece 1200ms após login. Testes E2E devem usar `loginAs` de `tests/helpers/auth.ts` que seta `onboarding_v1_done_{uid}` no localStorage dentro desse janela.
38. **Tour step com elemento condicional** → se o elemento só existe quando há dados (ex: tabela vazia), o driver.js pode travar. Regra: steps com `route:` cujo elemento só aparece após interação do usuário (selecionar colaborador, ter registros) → mover `data-onboarding` para o container sempre visível da página (ex: filtros). Steps com elemento 100% condicional (badge de alerta) → remover do tour e descrever no step anterior.
39. **Rota do tour ≠ rota do App** → sempre cruzar `route:` no tour com o `path=` real em `App.tsx`. Exemplos de erros: `/dp/time-records` (tour) vs `/dp/timerecords` (App); `/cp` (redirect) vs `/cp/payables` (real). O driver navega para a rota exata — redirect silencia sem erro, rota errada nunca acha o elemento.
40. **Roles do tour ≤ RoleGuard da rota** → os roles de um step nunca devem incluir perfis que o `RoleGuard` de `App.tsx` não deixa acessar. Cruzar explicitamente: `allowedRoles` do RoleGuard ↔ `roles:[]` do TourStep antes de commitar novo tour.
41. **UPDATE cross-tenant em `tenants` falha silenciosamente** → a policy RLS só permite UPDATE quando `is_platform_master()`. Um UPDATE direto do SuperMaster via `.from('tenants').update()` retorna 0 rows sem erro (falha silenciosa). Sempre usar a RPC `update_tenant_commercial` (SECURITY DEFINER). Mesma razão para `get_platform_tenants` existir.
42. **RPC `RETURNS void` → HTTP 204** → funções PostgreSQL que não retornam valor (`RETURNS void`) retornam HTTP 204 No Content via PostgREST, não 200. Em testes Playwright: `expect([200, 204]).toContain(resp.status())`.
43. **PlatformLayout usa `<aside>`, não `<nav>`** → os links da sidebar do PlatformLayout ficam dentro de `<aside>`, não `<nav>`. Seletores Playwright devem usar `a[href="/platform/..."]` sem prefixo de tag, ou `aside a[href=...]`.
44. **Playwright `waitForResponse` deve ser configurado ANTES do click** → configurar o listener depois do click cria race condition: se a resposta chegar antes do listener estar ativo, o teste trava até timeout. Padrão correto: `const p = page.waitForResponse(...); await button.click(); await p;`
45. **Dados de teste Playwright com RPCs de escrita** → ao usar `update_tenant_commercial` em testes, o banco é modificado permanentemente. Se o teste falhar no meio, os dados ficam corrompidos para execuções futuras. Usar campos não-críticos (ex: `phone`) para testes de save, ou restaurar via `afterEach` com limpeza explícita.
46. **Novo export em service mockado no Vitest** → ao adicionar uma função a um service que já tem `vi.mock(...)` em algum teste, a nova função precisa ser adicionada ao mock também — caso contrário o Vitest lança `No "funcao" export is defined on the mock`. Sempre atualizar o mock ao adicionar exports a services testados.
47. **RPCs SECURITY DEFINER: isolamento vs autorização** → distinguir claramente os dois padrões:
    - **Tenant isolation** (`update_orcamento`, `create_orcamento`): `SECURITY DEFINER` + `get_caller_team_id()` — qualquer `authenticated` pode chamar, o tenant é isolado por dentro.
    - **SuperMaster only** (`get_ai_routing_stats`, `update_tenant_commercial`): `SECURITY DEFINER` + `IF NOT is_platform_master() THEN RAISE EXCEPTION` — apenas SuperMaster pode executar.
    Nunca criar RPC SECURITY DEFINER sem ao menos um dos dois padrões. RPCs em `LANGUAGE sql` não suportam guard de runtime — converter para `plpgsql` quando necessário.
48. **`REVOKE FROM anon` não fecha herança via `PUBLIC`** → o complemento da armadilha #22. `REVOKE FROM anon` remove apenas grant explícito para `anon` — `anon` ainda herda acesso via `PUBLIC` (default do `CREATE FUNCTION`). Padrão correto e completo para fechar acesso anônimo: `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC; REVOKE EXECUTE ON FUNCTION ... FROM anon; GRANT EXECUTE ON FUNCTION ... TO authenticated;`
49. **Trigger functions SECURITY DEFINER aparecem no advisor `authenticated_security_definer_function_executable`** → triggers são chamados pelo mecanismo do banco, não por usuários. Para remover do advisor e do endpoint PostgREST: `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC; REVOKE EXECUTE ON FUNCTION ... FROM authenticated;`. O trigger continua funcionando — PostgreSQL executa como owner, independente de grants.
50. **`CREATE OR REPLACE` não muda tipo de retorno em TABLE functions** → `ALTER TABLE ... SET RETURNING` e `CREATE OR REPLACE FUNCTION ... RETURNS TABLE(...)` com colunas diferentes falha com `ERROR: 42P13: cannot change return type of existing function`. Padrão correto: `DROP FUNCTION IF EXISTS public.fn(...); CREATE FUNCTION ...`. Aplicar antes de adicionar colunas (ex: `updated_at`) ao RETURNS TABLE.
51. **PK em api_idempotency_keys deve ser composta (key, team_id)** → PK só em `key` permite cross-tenant collision: dois tenants enviam `Idempotency-Key: uuid-igual` → segundo recebe resposta do primeiro. Sempre PK composta `(key, team_id)` + RLS habilitada.
52. **`COALESCE` em UPDATE impede setar campo para NULL** → `SET description = COALESCE(p_description, description)` nunca atualiza para NULL (usuário quer limpar o campo). Adicionar parâmetro flag separado: `p_clear_description BOOLEAN DEFAULT false` + `CASE WHEN p_clear_description THEN NULL ELSE COALESCE(...) END`.
53. **`...body` spread em insert com service_role = field injection** → `admin.from('t').insert({ ...body, team_id })` permite que o chamador sobrescreva `os_number`, `created_at`, `reviewer_id`, `finished_at` — o service_role bypassa RLS e aceita qualquer campo. Sempre usar whitelist explícita: `pick(body, ALLOWED_FIELDS)` antes de inserir. Ver CLAUDE.md § "Vulnerabilidade 1 — Field Injection".
54. **Cursor pagination por `created_at` único perde registros** → `lt("created_at", cursor.created_at)` pula todos os registros com timestamp idêntico que caem depois do cursor (batch inserts, triggers em loop). Sempre usar cursor composto `(created_at, id)` com condição `.or("created_at.lt.X,and(created_at.eq.X,id.lt.Y)")`. Ver CLAUDE.md § "Vulnerabilidade 2 — Cursor Pagination".
55. **`req.json()` sem validação de Content-Type → 500 opaco** → se o client enviar body sem `Content-Type: application/json` ou com body malformado, `req.json()` lança exceção não tratada e o catch genérico retorna 500. Validar Content-Type antes de chamar `.json()` e retornar 415 explícito.
56. **GET com `!inner` join perde registros quando FK é deletada** → `.select("..., users!inner(team_id)")` filtra fora silenciosamente todo registro cujo `user_id` não existe mais em `users` (usuário deletado). Para isolamento de tenant, sempre preferir `team_id` direto na tabela do recurso — o projeto tem `team_id` em todas as tabelas principais.
57. **Rate limit 1k/hr bloqueia qualquer batch ERP com >1k registros** → sync noturno de 5.000 OS esgota o limite na primeira hora, travando a integração até reset. Antes de onboarding enterprise, implementar tiers (Basic/Pro/Enterprise) ou o cliente simplesmente não consegue usar a API para o caso de uso principal.
58. **RLS performance — sempre `(SELECT auth.uid())`, nunca `auth.uid()` raw** → `auth.uid()` direto numa policy USING/WITH CHECK é reavaliado para cada linha da tabela (O(n) por query). `(SELECT auth.uid())` cria um init plan: avaliado uma vez por query e cacheado. Mesmo problema com `auth.role()`. O lint do Supabase `auth_rls_initplan` detecta o anti-pattern. Toda policy nova deve usar a forma wrapped.
59. **Toda tabela com `team_id` precisa de índice em `team_id`** → a RLS filtra por `team_id = get_caller_team_id()` em todo SELECT de usuário autenticado. Sem índice = seq scan completo na tabela a cada read. Sempre criar `CREATE INDEX IF NOT EXISTS idx_<tabela>_team_id ON public.<tabela>(team_id)` no mesmo migration da tabela.
60. **`Deno.openKv()` não é suportado de forma estável no Supabase Edge Runtime** → é API do Deno Deploy; em produção lança exceção. Se a chamada estiver fora do try/catch do handler, o runtime devolve 500 **sem os corsHeaders** → browser bloqueia por CORS → client recebe `FunctionsFetchError` ("Failed to send a request") em vez do erro real, e a telemetria interna nunca roda (crash antes do try). Diagnóstico clássico: logs mostram `OPTIONS 200 + POST 500` e a tabela de log interna fica vazia. Padrão obrigatório em Edge Functions: (a) try/catch **externo** cobrindo o handler inteiro, sempre respondendo com corsHeaders; (b) rate limiter fail-open com fallback in-memory (`Map` do isolate); (c) nunca mutar objetos module-level (ex: `corsHeaders`) por requisição — estado compartilhado entre requisições concorrentes do isolate. Corrigido na ai-proxy v11 (2026-06-11).

## Padrões de Segurança (s72)

### Audit trail em tabelas financeiras

Toda tabela financeira deve ter:
- `updated_by UUID REFERENCES users(id) ON DELETE SET NULL` + trigger `BEFORE UPDATE` que seta `NEW.updated_by = auth.uid(); NEW.updated_at = now()`
- Tabela `*_status_history` com `(id, record_id, team_id, from_status, to_status, changed_by, created_at)` + trigger `AFTER UPDATE` que insere quando `OLD.status IS DISTINCT FROM NEW.status`
- RLS na tabela de histórico: `FOR ALL USING (team_id = get_caller_team_id())`

Implementado em: `payables` (s72) · `service_reports` (report_status_history) · `reimbursements` (reimbursement_history)

### Nova função SECURITY DEFINER — checklist obrigatório

```sql
CREATE OR REPLACE FUNCTION public.minha_funcao(...)
RETURNS ...
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'   -- obrigatório: evita search_path injection
AS $$
BEGIN
  -- guard: get_caller_team_id() OU is_platform_master()
END;
$$;
REVOKE EXECUTE ON FUNCTION public.minha_funcao(...) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.minha_funcao(...) FROM anon;
GRANT  EXECUTE ON FUNCTION public.minha_funcao(...) TO authenticated;
```

Se for trigger function: também `REVOKE ... FROM authenticated`.

### Storage bucket — política de isolamento por team

Arquivos devem ser organizados como `{bucket}/{team_id}/arquivo`. Policy SELECT:
```sql
USING (
  bucket_id = 'meu-bucket' AND (
    public.is_platform_master()
    OR (auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = (SELECT (team_id)::text FROM public.users WHERE id = auth.uid()))
  )
)
```
Nunca usar `USING (bucket_id = 'meu-bucket')` sem restrição de tenant — permite listing de todos os arquivos.

### Rate limiting em Edge Functions (fail-open obrigatório — ver armadilha #60)

`Deno.openKv()` lança em produção no Supabase Edge Runtime. O padrão correto tenta KV uma vez (lazy, cacheado em módulo), cai para `Map` in-memory do isolate, e **nunca lança** (fail-open — rate limit é proteção de custo, não pode derrubar a feature). Implementação de referência: `supabase/functions/ai-proxy/index.ts` (v11).

```typescript
const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

let kvPromise: Promise<Deno.Kv | null> | null = null;
function getKv(): Promise<Deno.Kv | null> {
  kvPromise ??= (async () => {
    try { return await Deno.openKv(); } catch { return null; }
  })();
  return kvPromise;
}

const memCounts = new Map<string, number>();

async function checkRateLimit(userId: string) {
  try {
    const window = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
    const kv = await getKv();
    if (kv) {
      const key = ['ratelimit', userId, window];
      const entry = await kv.get<number>(key);
      const count = (entry.value ?? 0) + 1;
      if (count > RATE_LIMIT_REQUESTS) return { allowed: false, remaining: 0 };
      await kv.set(key, count, { expireIn: RATE_LIMIT_WINDOW_MS * 2 });
      return { allowed: true, remaining: RATE_LIMIT_REQUESTS - count };
    }
    const memKey = `${userId}:${window}`;
    for (const k of memCounts.keys()) if (!k.endsWith(`:${window}`)) memCounts.delete(k);
    const count = (memCounts.get(memKey) ?? 0) + 1;
    memCounts.set(memKey, count);
    if (count > RATE_LIMIT_REQUESTS) return { allowed: false, remaining: 0 };
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - count };
  } catch {
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS }; // fail-open
  }
}
```

Extrair `userId` do JWT sem round-trip: `JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub`.

---

## Public API & Webhook System — Sprint G (concluída 2026-06-05)

### Visão geral

```
Cliente externo
  → X-API-Key: nxtai_live_<token>
  → Edge Fn api-gateway
      → valida hash SHA-256 da chave → resolve team_id + scopes
      → rate limit por chave (Deno KV)
      → loga em api_access_log
      → roteia para handler do recurso
  → Response RFC 7807 (erro) ou JSON + cursor pagination
```

### Ph1 — Foundation

#### Tabela `api_keys`

```sql
CREATE TABLE public.api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,                          -- "Integração SAP Produção"
  key_hash     TEXT        NOT NULL UNIQUE,                   -- SHA-256 da chave real (nunca armazenar plaintext)
  key_prefix   TEXT        NOT NULL,                          -- primeiros 12 chars para identificação: "nxtai_live_x"
  scopes       TEXT[]      NOT NULL DEFAULT '{}',             -- ['orders:read','reimbursements:read','webhooks:write']
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,                                   -- NULL = sem expiração
  created_by   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_tenant" ON public.api_keys FOR ALL USING (team_id = get_caller_team_id());
-- REVOKE FROM PUBLIC + anon (padrão s72)
```

A chave real (`nxtai_live_<32 bytes random hex>`) é gerada uma vez, mostrada uma vez, e armazenada apenas como `SHA-256(chave)`. Padrão GitHub/Stripe.

#### Tabela `api_access_log`

```sql
CREATE TABLE public.api_access_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id   UUID        REFERENCES public.api_keys(id) ON DELETE SET NULL,
  team_id      UUID        NOT NULL,
  method       TEXT        NOT NULL,   -- GET, POST, PATCH, DELETE
  path         TEXT        NOT NULL,   -- /api/v1/orders
  status_code  INTEGER     NOT NULL,
  duration_ms  INTEGER,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Retenção: 90 dias. Partition by month se volume alto.
-- RLS: platform master lê tudo; tenant lê próprios logs.
```

#### Edge Function `api-gateway`

```typescript
// Fluxo de validação (toda requisição passa por aqui)
const rawKey = req.headers.get('X-API-Key');          // nxtai_live_xxxxx
const keyHash = await sha256(rawKey);
const { data: apiKey } = await supabaseAdmin
  .from('api_keys')
  .select('id, team_id, scopes, is_active, expires_at')
  .eq('key_hash', keyHash)
  .single();

if (!apiKey || !apiKey.is_active) return error(401, 'invalid_api_key');
if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) return error(401, 'api_key_expired');
if (!hasScope(apiKey.scopes, requiredScope)) return error(403, 'insufficient_scope');

// Rate limit: 1000 req/hora por chave (Deno KV, janela 1h)
const { allowed } = await checkRateLimit(`apikey:${apiKey.id}`, 1000, 3_600_000);
if (!allowed) return error(429, 'rate_limit_exceeded');

// Atualiza last_used_at (fire-and-forget)
supabaseAdmin.from('api_keys').update({ last_used_at: new Date() }).eq('id', apiKey.id);
```

#### Formato de erro RFC 7807

```json
{
  "type": "https://api.nextai.com.br/errors/not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "Order OS-2026-001234 not found or not accessible with current API key scopes.",
  "instance": "/api/v1/orders/OS-2026-001234"
}
```

---

### Ph2 — Core Endpoints

#### Estrutura de URL

```
GET    /api/v1/orders                   scope: orders:read
GET    /api/v1/orders/:id               scope: orders:read
POST   /api/v1/orders                   scope: orders:write
PATCH  /api/v1/orders/:id               scope: orders:write
GET    /api/v1/reimbursements           scope: reimbursements:read
GET    /api/v1/clients                  scope: clients:read
POST   /api/v1/clients                  scope: clients:write
GET    /api/v1/quotes                   scope: quotes:read
```

#### Cursor pagination (todas as listagens)

```json
{
  "data": [ /* array de recursos */ ],
  "pagination": {
    "cursor": "eyJpZCI6IjEyMyIsImNyZWF0ZWRfYXQiOiIyMDI2In0=",
    "has_more": true,
    "limit": 50
  }
}
```

Query params: `?limit=50&cursor=<opaque>&filter[status]=aberta&sort=-created_at`

#### Idempotency keys (writes)

Toda requisição POST/PATCH aceita header `Idempotency-Key: <uuid-v4>`.  
Resposta cacheada por 24h: mesmo key → mesmo response. Previne OS/pagamento duplicado em retry de ERP.

```sql
CREATE TABLE public.api_idempotency_keys (
  key         TEXT        PRIMARY KEY,
  team_id     UUID        NOT NULL,
  method      TEXT        NOT NULL,
  path        TEXT        NOT NULL,
  status_code INTEGER     NOT NULL,
  response    JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours'
);
```

---

### Ph3 — Webhook System

#### Tabela `webhook_endpoints`

```sql
CREATE TABLE public.webhook_endpoints (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID     NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  url         TEXT     NOT NULL,
  secret      TEXT     NOT NULL,   -- HMAC secret gerado no cadastro, nunca exposto depois
  events      TEXT[]   NOT NULL,   -- ['order.created','order.completed','reimbursement.approved']
  is_active   BOOLEAN  NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Tabela `webhook_deliveries`

```sql
CREATE TABLE public.webhook_deliveries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id     UUID        NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  team_id         UUID        NOT NULL,
  event_type      TEXT        NOT NULL,   -- 'order.completed'
  event_version   TEXT        NOT NULL DEFAULT '1.0',
  payload         JSONB       NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending',   -- pending|delivered|failed|dead
  attempts        INTEGER     NOT NULL DEFAULT 0,
  next_retry_at   TIMESTAMPTZ,
  last_error      TEXT,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_deliveries_pending ON public.webhook_deliveries(next_retry_at) WHERE status = 'pending';
```

#### Schedule de retry (exponential backoff)

| Tentativa | Delay | Status após falha |
|-----------|-------|------------------|
| 1 | imediato | pending |
| 2 | 1 min | pending |
| 3 | 5 min | pending |
| 4 | 30 min | pending |
| 5 | 2 horas | pending |
| 6 | 24 horas | dead |

#### HMAC-SHA256 signing

```typescript
// Edge Fn webhook-dispatcher assina cada entrega:
const signature = await hmacSha256(endpoint.secret, JSON.stringify(payload));
fetch(endpoint.url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-NextAI-Signature': `sha256=${signature}`,
    'X-NextAI-Event': eventType,          // 'order.completed'
    'X-NextAI-Event-Version': '1.0',      // versionamento de schema
    'X-NextAI-Delivery': deliveryId,      // para idempotência no receptor
  },
  body: JSON.stringify(payload),
});
```

#### Catálogo de eventos (v1.0)

| Evento | Payload principal |
|--------|-----------------|
| `order.created` | `{ id, number, status, client_id, technician_id, created_at }` |
| `order.updated` | `{ id, number, status, updated_by, updated_at }` |
| `order.completed` | `{ id, number, completed_at, signature_url }` |
| `reimbursement.approved` | `{ id, amount, approved_by, approved_at }` |
| `reimbursement.paid` | `{ id, amount, paid_by, paid_at }` |
| `quote.signed` | `{ id, number, total, signed_at, client_id }` |
| `payable.paid` | `{ id, valor_total, paid_by, paid_at }` |

---

### Ph4 — Developer Experience

- **OpenAPI 3.0 spec** gerado a partir dos schemas e servido em `/api/docs` (Swagger UI ou Redoc)
- **Getting started**: autenticação → primeira chamada → receber primeiro webhook (< 5 min)
- **Postman collection** exportável com todas as rotas e exemplos de payload
- **Sandbox**: tenant isolado `team_id = SANDBOX_TEAM_ID` com dados sintéticos, sem afetar produção

---

### Invariantes de segurança da API (não negociáveis)

1. Chave nunca armazenada em plaintext — apenas `SHA-256(key)` no banco
2. Todo endpoint valida scope antes de executar — nunca confiar só na autenticação
3. Todo write tem idempotency key ou é idempotente por natureza (PUT)
4. Webhook payload assinado com HMAC-SHA256 — receptor DEVE verificar antes de processar
5. `api_access_log` escrito em todas as requisições — base para billing e detecção de abuso
6. Rate limit por chave independente do rate limit por usuário do app

---

### API — Vulnerabilidades & Padrões Corretos (Sprint G Patch 2)

#### Vulnerabilidade 1 — Field Injection via service_role (CRÍTICO)

O `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` bypassa RLS completamente.
Fazer spread do body sem whitelist permite que o chamador sobrescreva campos do sistema.

```typescript
// ❌ COMO ESTÁ (vulnerável):
await admin.from("service_reports")
  .insert({ ...body, team_id: apiKey.team_id })
// Chamador pode enviar: { "os_number": "OS-0001", "reviewer_id": "uuid-gestor",
//                         "created_at": "2020-01-01", "finished_at": "2020-01-01" }
// O service_role aceita tudo — sem RLS, sem checks.

// ✅ PADRÃO CORRETO — whitelist explícita:
const ALLOWED_FIELDS_CREATE_ORDER = ['client_id','technician_id','service_date',
  'reported_problem','status'] as const;

function pick<T extends object>(obj: T, keys: readonly string[]): Partial<T> {
  return Object.fromEntries(
    keys.filter(k => k in obj).map(k => [k, (obj as Record<string,unknown>)[k]])
  ) as Partial<T>;
}

const safe = pick(body, ALLOWED_FIELDS_CREATE_ORDER);
await admin.from("service_reports").insert({ ...safe, team_id: apiKey.team_id });
```

**Regra:** Todo INSERT/UPDATE via service_role em endpoint público **deve** ter whitelist explícita.
Campos protegidos nunca devem aparecer no allow-list: `id`, `team_id`, `created_at`, `key_hash`, `os_number` (auto-gerado), `reviewer_id`, `finished_at`.

---

#### Vulnerabilidade 2 — Cursor Pagination com Timestamp Único (CRÍTICO)

Múltiplos registros criados no mesmo instante (batch insert, trigger em loop) têm `created_at` idêntico.
`lt(created_at, ...)` pula todos os registros do mesmo timestamp que vêm "depois" no cursor.

```typescript
// ❌ COMO ESTÁ (perde registros):
if (cursor) {
  const c = parseCursor(cursor);
  if (c) q = q.lt("created_at", c.created_at);
}

// ✅ PADRÃO CORRETO — cursor composto (created_at, id):
// Cursor encoda: { created_at, id } do último item
// Query: (created_at < cursor.created_at) OR (created_at = cursor.created_at AND id < cursor.id)

if (cursor) {
  const c = parseCursor(cursor); // { id: string, created_at: string }
  if (c) q = q.or(
    `created_at.lt.${c.created_at},` +
    `and(created_at.eq.${c.created_at},id.lt.${c.id})`
  );
}
// Garante zero registros perdidos mesmo com timestamps idênticos.
```

---

#### Vulnerabilidade 3 — GET /reimbursements: join frágil em `users`

```typescript
// ❌ COMO ESTÁ (registro desaparece se usuário for deletado):
.select("..., users!inner(team_id)")
.eq("users.team_id", apiKey.team_id)

// ✅ CORRETO — tabela reimbursements tem team_id diretamente:
.select("id, category, amount, status, description, created_at")
.eq("team_id", apiKey.team_id)
// Consistente com o padrão do projeto. A correção do trigger já usa team_id direto.
```

---

#### Padrão: Validação de Input (obrigatório antes de tocar no banco)

Todo endpoint de escrita deve validar antes de executar.
Retornar 400 com detalhe campo a campo, nunca 500 opaco.

```typescript
interface ValidationError { field: string; message: string }

function validateCreateOrder(body: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!body || typeof body !== 'object') return [{ field: 'body', message: 'Must be a JSON object.' }];
  const b = body as Record<string, unknown>;

  if (!b.client_id)  errors.push({ field: 'client_id',  message: 'Required.' });
  if (b.client_id && typeof b.client_id !== 'string')
                     errors.push({ field: 'client_id',  message: 'Must be a UUID string.' });
  if (b.status && !['draft','pending_review','approved','rejected'].includes(b.status as string))
                     errors.push({ field: 'status',     message: 'Invalid value.' });
  return errors;
}

// No handler:
const errors = validateCreateOrder(body);
if (errors.length > 0) {
  return new Response(JSON.stringify({
    type:   'https://api.nextai.com.br/errors/validation_error',
    title:  'Validation Error',
    status: 400,
    errors, // array de { field, message }
    instance,
  }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' } });
}
```

---

#### Padrão: Delta Sync — filtro `updated_after`

Essencial para qualquer ERP que precisa sincronizar incrementalmente.

```typescript
// Em cada endpoint de listagem:
const updatedAfter = url.searchParams.get("updated_after"); // ISO 8601
if (updatedAfter) {
  const ts = new Date(updatedAfter);
  if (isNaN(ts.getTime())) {
    return rfc7807(400, "invalid_parameter",
      "'updated_after' must be an ISO 8601 datetime.", instance);
  }
  q = q.gte("updated_at", ts.toISOString());
}

// Resposta:
headers["X-Total-Count"] = String(totalCount); // query COUNT(*) separada
```

**Nota:** requer que todas as tabelas expostas na API tenham coluna `updated_at` com trigger `handle_updated_at`. Verificar antes de adicionar o filtro.

---

#### Padrão: Content-Type Validation

```typescript
if (["POST", "PATCH"].includes(req.method)) {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return rfc7807(415, "unsupported_media_type",
      "Content-Type must be application/json.", instance);
  }
}
// Garante 415 em vez de 500 quando body não é JSON.
```

---

#### Padrão: Response Envelope Consistente

```typescript
// ✅ Todos os endpoints devem retornar { data: ... }
// List:
return { data: items, pagination: { cursor, has_more, limit } };
// Single:
return { data: record };        // não retornar o objeto diretamente

// Permite que qualquer client genérico acesse sempre response.data
// sem verificar se é lista ou objeto.
```

---

## Onboarding SAP-level — concluído 2026-06-06

### Arquitetura

```
src/onboarding/
  OnboardingContext.tsx    — provider: auto-trigger 1200ms, startTour(), resetTour(), hasCompleted
  WelcomeModal.tsx         — modal inicial (Fazer tour agora / Pular)
  useOnboardingDriver.ts   — driver.js: navega por rota, waitForElement(4s), skip gracioso
  tours/
    index.ts               — TOUR_MODULES[], getTourSteps(role), TourStep interface
    *.tour.ts              — 31 módulos (ver lista abaixo)
```

### Como adicionar onboarding a um novo módulo

1. Adicionar `data-onboarding="modulo-elemento"` ao elemento alvo no TSX  
2. Criar `src/onboarding/tours/meu-modulo.tour.ts` exportando `TourModule`  
3. Importar e adicionar ao array `TOUR_MODULES` em `index.ts` (posição correta por categoria)  
4. **Verificar antes de commitar:**
   - Elemento alvo é sempre visível quando na rota? (não condicional a dados)
   - `route:` do step bate com `path=` real em `App.tsx`? (sem redirects, sem hífen errado)
   - `roles:[]` do step ⊆ `allowedRoles` do `RoleGuard` da rota?

### 31 tour modules (cobertura 100% dos módulos) — atualizado 2026-06-06

| Categoria | Tour | Steps | Roles |
|-----------|------|-------|-------|
| Nav & Dashboard | layout, dashboard, dashboard-customizer | 14+3+1 | todos |
| Field Service | os-list, os-wizard, os-detail, agenda | 5+11+4+2 | Tecnico+ |
| Assets & Clients | equipamentos, clientes | 3+1 | Supervisor+ |
| Commercial | orcamentos | 6 | Supervisor+ |
| Finance & Procurement | reembolsos, expense-reports, materiais, cp | 4+3+5+9 | Tecnico+/Financeiro+ |
| Inventory | fornecedores, pecas | 2+2 | Supervisor+ |
| Knowledge | conhecimento | 3 | todos |
| HR & Payroll | rh, dp | 8+9 | Gestor+ |
| Admin | company-profile, admin, admin-sla, admin-budget, admin-manutencao, admin-tenants-mgmt | 2+7+2+2+2+1 | Gestor+/Master |
| Integrações | api-keys, webhooks, os-import | 4+4+3 | Admin/Master |
| Platform | platform, platform-company-profile | 4+1 | SuperMaster |
| Client Portal | client-portal | 2 | Cliente |

### Storage key
`onboarding_v1_done_{userId}` — resetar via `useOnboarding().resetTour()` ou removendo do localStorage.

---

## Cadastro Comercial de Tenants — concluído 2026-06-04

### Colunas adicionadas à tabela `tenants` (migration `20260603_tenant_commercial_data`)

```sql
razao_social, ie, email_contato,
address_zip, address_street, address_number, address_complement,
address_neighborhood, address_city, address_state (sempre UPPERCASE), address_country
```
Somam às colunas anteriores: `cnpj`, `phone`, `website`, `sector` (migration `20260523_tenants_business_fields`).

### RPCs (migrations `20260603_*`)

```sql
-- SuperMaster edita qualquer tenant (SECURITY DEFINER, verifica is_platform_master())
update_tenant_commercial(p_tenant_id, p_name, p_primary_color, p_logo_url, p_logo_removed, p_cnpj, ...)
  → void (HTTP 204)

-- Master/Admin edita apenas a própria empresa (SECURITY DEFINER, usa auth.uid() internamente)
-- Nunca permite alterar name, slug, primary_color, logo_url, is_platform, is_active
update_own_tenant_commercial(p_razao_social, p_cnpj, p_ie, p_email_contato, ...)
  → void (HTTP 204)

-- Já existia — atualizada para retornar os novos campos
get_platform_tenants() → TABLE(..., razao_social, ie, email_contato, address_*)
```

### Arquitetura das telas

| Quem | Rota | Componente | O que faz |
|---|---|---|---|
| SuperMaster | `/platform/company-profile` | `PlatformCompanyProfile.tsx` | Seletor de empresa + edita qualquer tenant via `update_tenant_commercial` |
| Master / Admin | `/admin/company-profile` | `CompanyProfile.tsx` | Edita apenas a própria empresa via `update_own_tenant_commercial` |
| SuperMaster | `/platform/tenants` → ⋯ → Editar | `PlatformTenants.tsx` Sheet | Edita todos os campos incluindo identidade visual via `update_tenant_commercial` |

### CEP auto-fill (padrão consolidado)
```typescript
// fetch nativo — sem biblioteca; onBlur no campo CEP
const res = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g,'')}/json/`);
const json = await res.json();
if (json.erro) { toast.info('CEP não encontrado.'); return; }
form.setValue('address_street', json.logradouro);
form.setValue('address_neighborhood', json.bairro);
form.setValue('address_city', json.localidade);
form.setValue('address_state', json.uf.toUpperCase());
```

### Onboarding
- `company-profile.tour.ts` — 2 steps, roles `['Gestor','Admin','Master']`
- `platformCompanyProfileTour` (mesmo arquivo) — 1 step, role `['SuperMaster']`

---

## Deletar Empresa (SuperMaster) — concluído 2026-06-06

### Migration `20260606_tenant_delete`

```sql
-- Nova coluna
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Tabela de auditoria (tenant_id sem FK — preserva histórico após hard delete)
CREATE TABLE public.tenant_deletion_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID,
  tenant_slug TEXT NOT NULL,
  tenant_name TEXT NOT NULL,
  operation   TEXT NOT NULL CHECK (operation IN ('soft', 'hard', 'restore')),
  deleted_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RLS: FOR SELECT USING (is_platform_master())

-- RPCs SECURITY DEFINER (armadilha #50: DROP + CREATE)
get_platform_tenants(p_include_deleted boolean DEFAULT false)
  → mesmas 26 colunas anteriores + deleted_at
  → WHERE (p_include_deleted OR t.deleted_at IS NULL)

soft_delete_tenant(p_tenant_id uuid) → void
  -- guards: is_platform_master(), NOT is_platform, NOT já deletado
  -- seta deleted_at = now(), insere log

restore_tenant(p_tenant_id uuid) → void
  -- guards: is_platform_master(), IS deletado
  -- seta deleted_at = NULL, insere log
```

### Edge Function `admin-delete-tenant` v1

Sequência de hard delete (irreversível):
```
(0) UPDATE tenants SET deleted_at = now()   ← mitigação atomicidade: crash = tenant invisível, não zumbi
(a) auth.admin.deleteUser para cada usuário
(b) DELETE FROM <ORPHAN_PURGE_TABLES>        ← ON DELETE SET NULL; apagamos para não deixar orphans
(c) Storage: remove tenant-assets/{slug}/
(d) DELETE FROM tenants                      ← CASCADE apaga 25 tabelas filhas
(e) INSERT INTO tenant_deletion_log
```

`ORPHAN_PURGE_TABLES` = service_reports, clients, orcamentos, equipments, material_requests,
notifications, checklist_templates, reimbursements, sites (FKs ON DELETE SET NULL).

Guards: JWT via `callerClient.auth.getUser()` · SuperMaster check via service_role ·
auto-deleção bloqueada · confirmSlug validado servidor-side · is_platform bloqueado.

### Frontend `PlatformTenants.tsx`

- Toggle "Mostrar removidas / Ocultar removidas" no header → `get_platform_tenants(true/false)`
- Badge "Removida" (vermelho) na coluna Status quando `deleted_at` não é null
- Menu ⋯: "Editar" oculto quando `deleted_at` não é null (fluxo: restaurar → depois editar)
- Menu ⋯: "Restaurar" (verde) só para `!is_platform && deleted_at`
- Menu ⋯: "Deletar empresa" abre Dialog com seletor Modo A / Modo B
  - Modo A (soft): RPC `soft_delete_tenant`; reversível
  - Modo B (hard): Edge Function; exige digitar slug exato; irreversível

---

## Correções Auditoria s69 — concluído 2026-06-04

### Migrations aplicadas (`20260604_*`)

- `fix_cp_fk_teams_to_tenants` — FKs de payables/installments/comments → tenants (idempotente)
- `update_orcamento_rpc` — RPC atômica SECURITY DEFINER (transação única vs 5 roundtrips)
- `ai_routing_log` — tabela telemetria IA + RLS ENABLE sem policies (deny-all) + RPCs

### RPC update_orcamento (SECURITY DEFINER)

```sql
-- Assinatura: update_orcamento(p_id UUID, p_orcamento JSONB, p_itens JSONB, p_changed_by UUID)
-- RBAC: técnico dono (rascunho only) OU Gestor/Admin/Master
-- Atômico: snapshot em orcamento_versions + UPDATE cabeçalho + DELETE/INSERT itens
-- Retorna: JSON {success, version} ou {success: false, error}
```

### Observabilidade IA

```
public.ai_routing_log             — telemetria por chamada (provider, is_fallback, latency_ms)
public.get_ai_routing_stats(hours) — RPC SECURITY DEFINER, SuperMaster only
public.cleanup_ai_routing_log(days) — retenção 90 dias
```

Widget em `/platform/intelligence`: visível quando `total_requests > 0`, vermelho se `fallback_pct > 15%`.

### Edge Function ai-proxy v9

- Versionada em `supabase/functions/ai-proxy/index.ts`
- `callWithFallback` retorna `{text, provider, isFallback}` para alimentar `logRouting`
- `logRouting` é fire-and-forget via `service_role` + `SUPABASE_SERVICE_ROLE_KEY`

---

## OS Import Bridge — concluído 2026-06-06 (pipeline v7)

### Visão geral

Permite que clientes enterprise importem OSs de sistemas legados (TOTVS, SAP, Omie, PDF exportado)
sem redigitação. A OS normalizada fica disponível imediatamente para gerar orçamento via fluxo OS→Orçamento.

**Pipeline de extração PDF (v7):** template registry (zero custo) → IA híbrida (Gemini → OpenAI).
Per-field confidence scores em todos os campos. Badge visual na tela de detalhe da OS.
Ver ADR-010 para decisões de arquitetura detalhadas.

### Endpoint

```
POST /functions/v1/os-import-processor
Headers: X-API-Key: nxtai_live_...    (scope: orders:write)
         Content-Type: application/json
         Idempotency-Key: <uuid-v4>   (opcional)
```

### Schema do payload

```typescript
{
  // Obrigatórios sempre
  mode:              "json" | "pdf";
  external_source:   "totvs" | "sap" | "omie" | "pdf" | "custom";
  external_ref_id:   string;          // ID da OS no sistema de origem

  // Obrigatório apenas em mode="pdf" (um dos dois)
  pdf_base64?:       string;          // PDF em base64
  pdf_url?:          string;          // URL pública do PDF (Deno faz fetch)
  pdf_text?:         string;          // texto pré-extraído pelo browser (pdfjs-dist); opcional mas recomendado

  // Campos opcionais (mode="json"; ou override dos extraídos do PDF)
  client_name?:         string;
  client_cnpj?:         string;       // 14 dígitos ou formatado
  technician_email?:    string;
  technician_name?:     string;
  service_type?:        string;
  service_date?:        string;       // YYYY-MM-DD
  site_location?:       string;
  asset_name?:          string;
  priority?:            string;       // baixa | normal | alta | critica (ou inglês)
  reported_problem?:    string;
  services_performed?:  string;
  final_diagnosis?:     string;
  parts_used?:          string;
  internal_notes?:      string;
  photos?:              Array<{ base64: string; mime_type: string } | string>; // base64 ou URL
}
```

### Schema da resposta

```json
{ "data": {
  "os_id":                 "uuid",
  "os_number":             "OS-202606-00042",
  "client_resolution":     "matched_cnpj | matched_name | auto_created | not_found",
  "technician_resolution": "matched_email | matched_name | not_found",
  "duplicate":             false,
  "photos_uploaded":       3,
  // Presentes somente em mode="pdf":
  "extraction_method":     "template | ai:gemini | ai:openai | hybrid",
  "overall_confidence":    0.921,
  "requires_review":       false,
  "template_id":           "decathlon-chamado | null"
}}
```

Deduplicação: se `(team_id, external_source, external_ref_id)` já existe → retorna OS existente com `duplicate: true`, HTTP 200.

### Exemplo — payload TOTVS

```json
{
  "mode": "json",
  "external_source": "totvs",
  "external_ref_id": "OS-TOTVS-2026-009823",
  "client_name": "Mopar Engenharia Ltda",
  "client_cnpj": "12.345.678/0001-90",
  "technician_email": "tecnico@empresa.com",
  "service_type": "Manutenção Preventiva",
  "service_date": "2026-06-05",
  "site_location": "Planta Industrial São Paulo",
  "asset_name": "Compressor Atlas Copco GA37",
  "priority": "alta",
  "reported_problem": "Compressor com vibração anormal e ruído metálico",
  "services_performed": "Substituição de rolamentos e alinhamento do eixo"
}
```

### Exemplo — payload PDF

```json
{
  "mode": "pdf",
  "external_source": "pdf",
  "external_ref_id": "SAP-PM-2026-00451",
  "pdf_url": "https://storage.empresa.com/os/2026/00451.pdf"
}
```

### Resolução de entidades (invariante: zero redigitação)

| Campo | Estratégia |
|-------|-----------|
| `client_id` | CNPJ exato → name ILIKE → auto_create cliente mínimo |
| `technician_id` | email exato → full_name ILIKE → null (atribui manualmente) |
| `service_type` | match ILIKE em service_types do tenant → string raw |
| `priority` | mapa PT+EN: low/baixa → baixa; critical/urgente → critica |

### Banco

```sql
-- Colunas em service_reports
external_source          TEXT,
external_ref_id          TEXT,
import_confidence        NUMERIC(4,3),   -- 0.0–1.0; NULL = importação manual
import_field_confidences JSONB,          -- snapshot dos scores por campo no momento da importação
UNIQUE INDEX uq_sr_external_dedup (team_id, external_source, external_ref_id) WHERE NOT NULL

-- Tabela de log
os_import_log (id, team_id, api_key_id, external_source, external_ref_id, import_mode,
               status, os_id, client_resolution, technician_resolution, error_detail,
               raw_payload JSONB, extraction_method TEXT, overall_confidence NUMERIC(4,3),
               field_confidences JSONB, created_at)

-- Função sem auth.uid() para service_role
reserve_os_number_service(p_team_id UUID) → TEXT
  SECURITY DEFINER · GRANT TO service_role · REVOKE FROM authenticated
```

### UI Admin

Rota: `/admin/os-imports` · Roles: Admin, Master  
Grupo: Integrações (sidebar) · Ícone: UploadCloud  
Funcionalidades: tabela paginável · filtros status+source · row expandida com payload JSON · botão "Reprocessar" (copia payload) para status=failed

---

## Sprint H — Comunicação & Conformidade (próxima sprint)

### Módulo 1: Notificações (Email + WhatsApp)

**Providers:** Resend (email) · Evolution API (WhatsApp)

**Eventos notificados:**

| Evento | Canal | Destinatário |
|--------|-------|-------------|
| OS criada e atribuída | Email + WhatsApp | Técnico responsável |
| OS concluída | Email | Gestor + criador |
| SLA prestes a vencer (2h antes) | WhatsApp | Técnico + Gestor |
| SLA vencido | Email + WhatsApp | Técnico + Gestor + Admin |
| Reembolso aprovado/rejeitado | Email | Solicitante |
| CP: aprovação pendente | Email | Financeiro + Admin |
| CP: conta quitada | Email | Gestor |

**Arquitetura:**

```
Evento de domínio (trigger Supabase ou webhook Sprint G)
  → Edge Fn notification-dispatcher
      → lê notification_preferences do destinatário (opt-in por canal/tipo)
      → Resend.send() e/ou Evolution API POST
      → insere em notification_log
```

**Schema:**

```sql
-- Preferências por usuário (opt-in granular)
CREATE TABLE public.notification_preferences (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id    UUID NOT NULL,
  channels   JSONB NOT NULL DEFAULT '{"email": true, "whatsapp": false}',
  events     JSONB NOT NULL DEFAULT '{}'  -- { "sla.breach": true, "order.assigned": true }
);

-- Log de envios (auditoria + debug)
CREATE TABLE public.notification_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  channel      TEXT NOT NULL,   -- 'email' | 'whatsapp'
  event_type   TEXT NOT NULL,
  recipient    TEXT NOT NULL,   -- email ou phone
  status       TEXT NOT NULL,   -- 'sent' | 'failed'
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Secrets necessários:** `RESEND_API_KEY` · `EVOLUTION_API_URL` · `EVOLUTION_API_KEY`

---

### Módulo 2: LGPD Baseline

**Requisito:** Lei 13.709/2018 — titular tem direito ao esquecimento. B2B SaaS em Brasil precisa estar em conformidade antes de escalar.

**O que implementar:**

```sql
-- 1. Soft-delete em users
ALTER TABLE public.users
  ADD COLUMN deleted_at   TIMESTAMPTZ,
  ADD COLUMN pii_cleared_at TIMESTAMPTZ;

-- 2. RPC de anonimização (SECURITY DEFINER, Master/Admin only)
CREATE FUNCTION public.anonymize_user_pii(p_user_id UUID)
-- Zera: name → 'Usuário Removido', email → null, phone → null, CPF → null
-- Seta: deleted_at = now(), pii_cleared_at = now()
-- NÃO deleta: mantém registros de OS, reembolso, etc. (integridade referencial)

-- 3. Registro de operações de tratamento
CREATE TABLE public.pii_treatment_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL,
  operation    TEXT NOT NULL,   -- 'anonymize' | 'export' | 'delete_request'
  subject_id   UUID,            -- user_id afetado
  requested_by UUID,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**UI:** Botão "Remover dados pessoais" no perfil do usuário (Admin/Master) com AlertDialog de confirmação.

---

### Módulo 3: AI Report Writer

**Proposta de valor:** Técnico digita "trocou a bomba d'agua que estava com folga e vazamento" → GPT-4o transforma em "Identificado desgaste prematuro no conjunto de vedação da bomba d'água, com folga axial de ~0,8mm e vazamento por falha de gaxeta. Efetuada substituição do conjunto por componente OEM. Teste de pressão realizado com êxito."

**Arquitetura:**

```typescript
// Edge Fn: ai-report-writer (reutiliza ai-proxy)
// Input: { raw_text: string, os_context: { vehicle, symptoms, parts_used } }
// Output: { professional_text: string, tokens_used: number }

// Prompt engineering:
const SYSTEM_PROMPT = `
Você é um redator técnico especializado em laudos de serviços automotivos.
Transforme a descrição informal do técnico em linguagem técnica profissional,
mantendo todas as informações factuais. Tom: objetivo, preciso, norma ABNT NBR.
`;
```

**Integração:** Botão "Melhorar com IA" no campo "Descrição do problema/solução" da OS (step 2 e step 6 do wizard). Substitui o texto selecionado com confirmação do técnico.

**Rate limit:** 10 chamadas/hora por usuário (Deno KV, reutiliza padrão ai-proxy).

---

### Módulo 4: CR — Contas a Receber

**Justificativa:** CP sem CR = módulo financeiro incompleto. Orçamento aprovado (quote.signed) deveria gerar automaticamente uma conta a receber.

**Schema:**

```sql
CREATE TABLE public.receivables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quote_id        UUID REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  client_id       UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  total_amount    NUMERIC(12,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pendente',  -- pendente|parcial|quitado|cancelado
  due_date        DATE NOT NULL,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE public.receivable_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id UUID NOT NULL REFERENCES public.receivables(id) ON DELETE CASCADE,
  team_id       UUID NOT NULL,
  amount        NUMERIC(12,2) NOT NULL,
  payment_date  DATE NOT NULL,
  method        TEXT,   -- 'pix'|'boleto'|'transferência'|'dinheiro'
  notes         TEXT,
  registered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Aging report (widget dashboard):**

```sql
-- RPC get_receivables_aging(p_days int DEFAULT 30)
-- Retorna: { current, d30, d60, d90, over90, total_overdue }
-- Trigger: quote.signed → INSERT INTO receivables (via enqueue_webhook_event reaproveitado)
```

**UI:** Página `/financeiro/cr` com lista + filtros status/vencimento + botão "Registrar Pagamento" + widget aging no dashboard (roles: Financeiro, Gestor, Admin, Master).

---

## Próximas sprints disponíveis

Arquivos completos em `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\Sprints\`

- **Sprint D** — CPQ: ✅ Assinatura eletrônica + Versionamento + **OS↔Orçamento linkage (concluído 2026-05-30)**
- **Sprint E** — OCR comprovantes + Budget + Base KB + Lifecycle de ativo (concluída)
- **Dashboard Real** — ✅ Concluído 2026-05-31 (personalização, 3 novos widgets, período, refresh automático)
- **Correções s69** — ✅ Concluído 2026-06-04 (FK CP, RPC atômica orçamento, observabilidade IA, ai-proxy versionada)
- **Holerite PDF** — `gerarHolerite.ts` já existe
- **Notificações cross-módulo** — ✅ Sprint H (ver acima)
- **CR (Contas a Receber)** — ✅ Sprint H (ver acima)
- **Testes E2E RH/DP/CP** — ✅ Concluído 2026-06-03

---

## Landing Page NextAI — concluída 2026-05-31

**Repo:** `https://github.com/vanzer80/nextai-landing`
**Diretório:** `C:\Users\vanze\OneDrive\Área de Trabalho\nextai-landing`
**Produção:** `https://nextai-landing-gilt.vercel.app`
**Stack:** Vite + React 19 + TypeScript + Tailwind v4 (standalone, sem Supabase)
**Dev server:** `npm run dev` (porta 4321)
**Deploy:** auto-deploy na Vercel ao push no `master`

### Arquitetura da landing

```
src/
  config.ts                 — CALENDLY_URL (TODO: substituir), APP_URL, DEMO_HREF
  content/
    metrics.ts              — Metric { value: string | null, label, collection }
    testimonials.ts         — Testimonial { ..., fictional: boolean }
    faq.ts                  — FaqItem[]
  sections/
    Hero.tsx                — proposta de valor principal
    ProvaRapida.tsx         — barra de contexto de uso
    Pillars.tsx             — 3 pilares de valor (NOVO)
    Flow.tsx                — 3 passos: captura → organiza → decide
    AiStories.tsx           — 3 micro-histórias de IA
    Sectors.tsx             — 4 setores operacionais (substitui Personas)
    Results.tsx             — métricas tipadas + depoimentos
    Integration.tsx         — conexão com ERP/BI + implantação gradual
    Faq.tsx                 — dados de content/faq.ts
    FinalCta.tsx            — CTA final
    Navbar.tsx / Footer.tsx
```

### Padrão de métricas (crítico para não quebrar em produção)

```typescript
// value: null → exibe "—" + badge "Em coleta" (nunca string de placeholder crua)
// value: "47%" → exibe normalmente
const METRICS: Metric[] = [{ value: null, label: '...', collection: 'instrução de coleta' }]
```

### 3 itens pendentes para ativar campanha paga

| Item | Arquivo | Ação |
|---|---|---|
| Métricas reais | `src/content/metrics.ts` | 4x `value: null` → substituir com dados medidos nas semanas 1–4 |
| Calendly | `src/config.ts` | `CALENDLY_URL = 'https://calendly.com/nextai/demo'` → URL real |
| Depoimentos reais | `src/content/testimonials.ts` | `fictional: true` → entradas com clientes reais autorizados |

### Seções removidas da versão anterior

- `Problem.tsx` — absorvida pelo Hero + Pillars (redundante)
- `Personas.tsx` — substituída por `Sectors.tsx` (setores, não roles)

---

## Auditoria v3 + Fixes de A11y / 404 / Login — concluído 2026-06-07

Commit de release: `af996ef` — "release: a11y WCAG, 404 page, login validation, Login lazy bundle"

### Fixes entregues

| Fix | Arquivo | Detalhe |
|---|---|---|
| A11y #1 — botão sino | `AppLayout.tsx:364` | `aria-label` dinâmico com contagem de não lidas; `Bell aria-hidden` |
| A11y #1 — menu mobile | `AppLayout.tsx:604` | `aria-label="Menu principal"`; `Menu aria-hidden` |
| A11y #2 — nested-interactive | `AppLayout.tsx:223` | `SheetTrigger asChild` removido; `<button>` interno eliminado |
| Fix #3 — 404 page | `src/pages/NotFound.tsx` + `App.tsx:228` | `<Route path="*">` dentro de `<AppLayout>` → `NotFound` lazy |
| Fix #4 — Login Zod | `Login.tsx:17,36` | `loginSchema` + `zodResolver` + `role="alert"` + `aria-invalid` |
| Fix #5 — keep-alive | `supabase-keepalive.yml` + `20260607_app_health.sql` | PATCH diário 08:17 UTC via `SUPABASE_SERVICE_ROLE_KEY` |
| Perf — Login lazy | `App.tsx:11` | `Login = lazy(...)` → RHF+zod saem do initial bundle |

### Resultados da auditoria (localhost + produção)

- `axe violations` → **0** (eram 54 antes: 2 por página × 27 páginas)
- `has404Heading` → **true** (`/financeiro/cr` fica na rota; `h1: "Página não encontrada"`)
- `chunk principal` → **110 kB gzip** (paridade com pré-merge, sem regressão)
- Cross-browser: Chromium + Firefox + WebKit × 4 devices → **0 overflows**
- Produção confirmada: `/financeiro/cr` → `h1: Página não encontrada` ✅

### Armadilha nova (não repetir)

35. **Login lazy + RHF/Zod no initial bundle** — Login é renderizado no initial bundle (não lazy). Se adicionarmos `import { useForm } from 'react-hook-form'` diretamente no Login, react-hook-form + zod entram no initial chunk (+31 kB gzip). Solução: Login **deve** ser `lazy()` — único componente público que pode usar RHF sem penalizar o initial load.

---

## Touch Targets WCAG 2.5.8 AA — concluído 2026-06-07

Branch: `fix/touch-targets` (commit `9ce7fa4`)

### Fixes entregues

| Arquivo | Mudança | Antes → Depois |
|---|---|---|
| `ReportCard.tsx:146` | `py-2 min-h-[32px]` no link "Detalhes" | 68×16px → 68×32px (AA ✅) |
| `ThemeToggle.tsx:55` | compact `h-9 w-9` → `h-11 w-11` | 36×36 → 44×44px |
| `AppLayout.tsx:365` | bell: `p-2` → `flex items-center justify-center h-11 w-11` | 36×36 → 44×44px |
| `AppLayout.tsx:605` | hamburger: `h-10 w-10` → `h-11 w-11` | 40×40 → 44×44px |
| `ClientsList.tsx:97` | DropdownMenuTrigger: `h-8 w-8` → `h-11 w-11` | 32×32 → 44×44px |

### Gate — resultado (Chromium mobile 390×844)

| Rota | critical <24px (AA) | small <44px (AAA) |
|---|---|---|
| /reports | ✅ 0 | 29 (filtros/selects ≥32px) |
| /clients | ✅ 0 | 0 |
| /rh/employees | ✅ 0 | 0 |

Ícones internos (`h-4 w-4`, `h-5 w-5`) inalterados. `aria-label` e `focus-visible` preservados.

---

## CI Harness de A11y — concluído 2026-06-07

Branch: `ci/a11y-harness` (commit `5d00e0d`)

### O que foi commitado

- `audit/` diretório completo com `.gitignore` (exclui `node_modules/`, `audit-output/`)
- `audit/audit.config.mjs` — lê `AUDIT_BASE_URL`, `AUDIT_USER`, `AUDIT_PASS` de env vars
- `audit/check-axe-diff.mjs` — diff contra `baseline-axe.json`; falha apenas em NEW critical/serious
- `audit/baseline-axe.json` — baseline atual: 0 violações axe wcag2a/wcag2aa
- `audit/responsive-cross.mjs` — adiciona `criticalTouchTargets` (<24px) separado de `smallTouchTargets` (<44px)
- `.github/workflows/a11y-audit.yml` — PR + `workflow_dispatch`; concurrency cancel; upload artifacts
- Secrets GitHub: `AUDIT_BASE_URL`, `AUDIT_USER`, `AUDIT_PASS`

### Uso

```bash
# Local — rodar auditoria completa + diff
cd audit && npm run ci

# Atualizar baseline (após aceitar violações intencionais)
cd audit && npm run audit && npm run baseline:update

# Verificar diff sem re-rodar audit
cd audit && npm run check:axe
```

### Armadilha nova (não repetir)

36. **`git stash` não captura arquivos untracked** — ao fazer `git stash` em branch que tem diretório não versionado (como `audit/`), os arquivos untracked NÃO são stashados. Ao mudar de branch e commitar esses arquivos no novo branch, eles ficam tracked lá. Ao voltar ao branch original, git remove esses arquivos tracked do working tree. Solução: `git stash -u` para incluir untracked, ou gerenciar os arquivos separadamente.

37. **`manualChunks` com array não captura `react-dom/client`** — `import { createRoot } from 'react-dom/client'` resolve para `react-dom/cjs/react-dom-client.production.js` (93 kB gzip-equiv). O formato objeto/array do manualChunks usa `id.includes('/node_modules/react-dom/')` internamente, mas isso só capturou o stub `react-dom.production.js` (1.8 kB), não o `react-dom-client`. Solução: converter para função com regex ancorada: `/node_modules[/\\]react-dom[/\\]/`.

38. **`id.includes('react-dom')` faz match em `@floating-ui/react-dom`** — ao usar `id.includes('react-dom')` para atribuir ao `vendor-react`, o pacote `@floating-ui/react-dom` (dependência de `@base-ui/react`) também faz match, criando um circular chunk `vendor-ui → vendor-react → vendor-ui`. Solução: usar regex ancorada `/node_modules[/\\]react-dom[/\\]/` E adicionar `@floating-ui` explicitamente ao `vendor-ui`.

---

## Bundle Optimization — concluído 2026-06-07

### Root cause

`react-dom/cjs/react-dom-client.production.js` (93 kB gzip-equiv, módulo `createRoot` do React 18) estava no chunk principal porque o `manualChunks` em formato objeto/array apenas capturava o stub `react-dom.production.js` (1.8 kB), não o arquivo específico `react-dom-client.production.js`.

### Fix aplicado — `vite.config.ts`

Convertido `manualChunks` de objeto/array para função com regex ancorada:

```js
manualChunks(id) {
  if (!id.includes('node_modules')) return;
  if (/node_modules[/\\]react-dom[/\\]/.test(id))     return 'vendor-react';
  if (/node_modules[/\\]react-router/.test(id))        return 'vendor-react';
  if (/node_modules[/\\]react[/\\]/.test(id))          return 'vendor-react';
  if (/node_modules[/\\]scheduler[/\\]/.test(id))      return 'vendor-react';
  if (id.includes('@supabase'))                         return 'vendor-supabase';
  if (id.includes('recharts'))                          return 'vendor-charts';
  if (id.includes('jspdf'))                             return 'vendor-pdf';
  if (id.includes('xlsx'))                              return 'vendor-xlsx';
  if (id.includes('@base-ui'))                          return 'vendor-ui';
  if (id.includes('@floating-ui'))                      return 'vendor-ui';
  if (id.includes('sonner'))                            return 'vendor-ui';
  if (id.includes('next-themes'))                       return 'vendor-ui';
  if (id.includes('driver.js'))                         return 'vendor-driver';
  if (id.includes('tailwind-merge'))                    return 'vendor-utils';
}
```

Também adicionado `rollup-plugin-visualizer` para análise de composição de chunks (`dist/stats.html`).

### Resultado

| Chunk | Antes | Depois |
|---|---|---|
| `index-*.js` (principal) | **110.19 kB gzip** | **44.73 kB gzip** ✅ |
| `vendor-react-*.js` | 17 kB (stub) | 74.50 kB (react-dom-client incluído) |
| `vendor-ui-*.js` | 76.80 kB | 78.41 kB (@floating-ui incluído) |
| `vendor-utils-*.js` | — | 8.23 kB (tailwind-merge separado) |

Gate: tsc EXIT:0, vitest 117/117, chunk principal 44.73 kB ≤ 100 kB ✅

---

## Auditoria QA + Hardening de Escala — concluído 2026-06-07

Commits: `af996ef` (a11y/404/login) · `9ce7fa4` (touch-targets) · `5d00e0d` (CI harness) · `16ea4b8` (bundle) · `897c886` (DB Fases 2+3) · `07c4b57` (DB Fase 4) · `b32b8c1` (merge ci/a11y-harness) · `938b146` (merge perf/bundle-optimization)

### QA Harness automatizado

`audit/` — Playwright + axe-core + Lighthouse rodando contra produção:
- `run-audit.mjs` com `waitForAppReady()` — aguarda `/rest/v1/users?...` responder antes de auditar; resolve falso-negativo do cold-start do free tier (app renderizava antes do DB acordar)
- `check-axe-diff.mjs` — diff contra `baseline-axe.json`; falha apenas em NEW critical/serious (não regride em violações pré-existentes aceitas)
- `.github/workflows/a11y-audit.yml` — CI por PR com concurrency cancel + upload de artefatos; secrets `AUDIT_BASE_URL`, `AUDIT_USER`, `AUDIT_PASS`

### Fixes a11y, 404 e Login

| Fix | Arquivo | Detalhe |
|---|---|---|
| aria-labels botão sino | `AppLayout.tsx:364` | Label dinâmico com contagem; `Bell aria-hidden` |
| aria-label menu mobile | `AppLayout.tsx:604` | `aria-label="Menu principal"`; `Menu aria-hidden` |
| nested-interactive | `AppLayout.tsx:223` | `SheetTrigger asChild` + `<button>` interno eliminados |
| Página 404 | `NotFound.tsx` + `App.tsx:228` | `<Route path="*">` dentro de `<AppLayout>` → `NotFound` lazy |
| Login Zod | `Login.tsx` | `loginSchema` + `zodResolver` + `role="alert"` + `aria-invalid` |
| Login lazy | `App.tsx:11` | `Login = lazy(...)` → RHF+Zod saem do initial bundle (110→44.7 kB gzip) |
| Touch targets | 5 arquivos | Área de clique expandida para ≥24px crítico (WCAG 2.5.8 AA) em sino, hamburger, DropdownTrigger |

### Keep-alive Supabase

`supabase-keepalive.yml` + migration `20260607_app_health` — GitHub Actions faz PATCH em `app_health(id=1, last_ping)` às 08:17 UTC via `SUPABASE_SERVICE_ROLE_KEY`. Tabela singleton RLS sem policies (deny-all público; BYPASSRLS apenas para service_role). Eliminou os "Failed to fetch" de projetos hibernando após 7 dias sem atividade.

### Cross-browser responsivo

Chromium + Firefox + WebKit × 4 viewports (390, 768, 1280, 1440) — **0 overflows** em todas as combinações.

### Prontidão de escala do banco (DBA audit)

| Fase | O que foi feito |
|---|---|
| **Fase 0** — Reconhecimento | P5 eliminado: 7/8 tabelas têm `DEFAULT get_caller_team_id()` na coluna; employees passa `team_id` explícito no service. Tabelas filhas sem team_id (documentos, itens de checklist) isoladas via FK — correto por design. |
| **Fase 2** — Índices | 12 índices `CREATE INDEX … team_id` + 3 FK `idx_employee_*_employee_id` (`897c886`) |
| **Fase 3** — service_types | Policy `team_isolation` migrada de raw subquery `(SELECT users.team_id … WHERE id = auth.uid())` para `get_caller_team_id()` |
| **Fase 4** — RLS initplan | 62 policies `auth.uid()` → `(SELECT auth.uid())` + 2 policies `auth.role()` → `(SELECT auth.role())` em `sites` e `equipments` (`07c4b57`) |

Gate triplo Fase 4: **(a)** `auth_rls_initplan = 0` no advisor de performance; **(b)** isolamento cross-tenant intacto (Mopar vê 75 OS, nextai vê 0; DB truth confirma que nextai tem 0 registros próprios); **(c)** zero novos alertas no advisor de segurança (67 WARNs todos pré-existentes).

### Reconciliação de branches + confirmação master ≡ produção

Branches órfãos mergeados em master na ordem de menor risco:

| Ordem | Branch | Tipo de merge | Gate |
|---|---|---|---|
| 1 | `fix/touch-targets` | fast-forward → `1fef019` | tsc ✅ vitest 117/117 ✅ build ≤100 kB ✅ |
| 2 | `ci/a11y-harness` | merge commit `b32b8c1` (só novos arquivos, sem conflito) | tsc ✅ vitest 117/117 ✅ |
| 3 | `perf/bundle-optimization` | merge commit `938b146` (CLAUDE.md sem conflito — ci não o tocou) | tsc ✅ vitest 117/117 ✅ build 44.73 kB ✅ |

`git push origin master` → `7d601c2..938b146` ✅

**Produção confirmada — 2026-06-07:**
- Vercel `dpl_7MADLPPjg2WagGqeih4FxCyFjiMM` → READY, target `production`, commit `938b146`
- DB: 6 migrations `20260607` aplicadas no Supabase = arquivos no repo (idêntico)
- `vercel.json` não tem migration runner — nenhuma migration foi re-aplicada no push

---

## Roadmap — Prontidão de Escala do Banco

| # | Item | Status |
|---|------|--------|
| 1 | GitHub Actions keep-alive Supabase | ✅ Concluído (2026-06-07) |
| 2 | 15 índices `team_id` + FK `employee_*` | ✅ Concluído (2026-06-07 — `897c886`) |
| 3 | `service_types` RLS → `get_caller_team_id()` | ✅ Concluído (2026-06-07) |
| 4 | `auth_rls_initplan` eliminado em 64 policies | ✅ Concluído (2026-06-07 — `07c4b57`) |
| 5 | P5 — writes sem `team_id` | ✅ Falso-positivo — DEFAULTs existem |
| 6 | P6 — cursor pagination cursor composto | 🔲 Pendente — ver Pendências |
| 7 | `multiple_permissive_policies` | 🔲 Pendente — ver Pendências |
| 8 | Read replica | 🔲 Pendente — ver Pendências |

---

## Pendências — abertos com gatilho de ativação

| Item | Descrição | Gatilho para agir |
|------|-----------|-------------------|
| **P6 — Cursor pagination composto** | Listagens da API paginam por `created_at` único; batch inserts com timestamps idênticos perdem registros. Fix: cursor composto `(created_at, id)` com `.or("created_at.lt.X,and(created_at.eq.X,id.lt.Y)")`. Ver armadilha #54. | Antes do onboarding real do primeiro cliente enterprise que faça sync noturno em batch |
| **multiple_permissive_policies** | Supabase lint: várias policies permissivas (FOR SELECT OR …) na mesma tabela combinam em `OR` — PostgreSQL avalia todas mesmo se a primeira satisfizer. Consolidar em policy única com lógica `OR` explícita. | Quando CPU do Supabase virar gargalo mensurável após os fixes de initplan |
| **Read replica** | Rotear queries de leitura pesada (relatórios, dashboard, listagens paginadas) para réplica Supabase. | Somente no plano Pro+ e somente se CPU do primary saturar após os fixes de initplan; não antecipar |
