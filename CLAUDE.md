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

### Auth cold-start (Supabase Free Tier hiberna 15-30s)
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

## Convenções de código

- Nenhum comentário óbvio — só comentar WHY não-óbvio
- Nenhum `any` explícito — `tsc --noEmit` deve ser EXIT:0
- Services: async/await com throw em erro, sem `.eq('team_id', teamId)` nos reads
- Lazy loading: toda rota em `App.tsx` deve ser `React.lazy()` — sem exceção
- Bundle alvo: chunk principal ≤ 100 kB gzip
- Novo módulo: migration → types → service → hook → componente → página → rota + nav + **onboarding tour** (ver seção abaixo)
- Responder sempre em português do Brasil

## Edge Functions deployadas

`ai-proxy` v8 · `admin-create-user` v4 · `admin-delete-user` v3  
`admin-reset-password` v1 · `admin-provision-tenant` v1  
`platform-update-user` v1 · `sla-checker` v1 · `send-csat-email` v1

Secrets (nunca no .env): `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `OPENAI_API_KEY`

## Estado dos testes

- **Vitest (unit):** 117+ testes passando (`npx vitest run`)
- **Playwright E2E:**
  - `tests/ux/` — 37 testes UX/UI (login, RBAC, responsividade, estados)
  - `tests/orcamentos-sprint-d.spec.ts` — 5 testes Sprint D (assinatura eletrônica)
  - `tests/os-orcamento-vinculacao.spec.ts` — 33 testes OS↔Orçamento linkage (31 pass, 1 flaky timing, 1 probe pendente)
  - `tests/dashboard-verify.spec.ts` — 5 testes Dashboard (Gestor, Personalizar, Período, RBAC, Master HR)
  - `tests/rh-module.spec.ts` — 7 testes RH (RBAC, lista, KPIs, admissão, departamentos) ✅ 7/7
  - `tests/dp-module.spec.ts` — 7 testes DP (RBAC, folha, status, dialog, subrotas) ✅ 7/7
  - `tests/cp-module.spec.ts` — 8 testes CP (RBAC, lista, KPIs, status, navegação, filtro REST) ✅ 8/8
  - `tests/platform-company-profile.spec.ts` — 6 testes Perfil Comercial SuperMaster ✅ 6/6
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

## Onboarding SAP-level — concluído 2026-06-03

### Arquitetura

```
src/onboarding/
  OnboardingContext.tsx    — provider: auto-trigger 1200ms, startTour(), resetTour(), hasCompleted
  WelcomeModal.tsx         — modal inicial (Fazer tour agora / Pular)
  useOnboardingDriver.ts   — driver.js: navega por rota, waitForElement(4s), skip gracioso
  tours/
    index.ts               — TOUR_MODULES[], getTourSteps(role), TourStep interface
    *.tour.ts              — 24 módulos (ver lista abaixo)
```

### Como adicionar onboarding a um novo módulo

1. Adicionar `data-onboarding="modulo-elemento"` ao elemento alvo no TSX  
2. Criar `src/onboarding/tours/meu-modulo.tour.ts` exportando `TourModule`  
3. Importar e adicionar ao array `TOUR_MODULES` em `index.ts` (posição correta por categoria)  
4. **Verificar antes de commitar:**
   - Elemento alvo é sempre visível quando na rota? (não condicional a dados)
   - `route:` do step bate com `path=` real em `App.tsx`? (sem redirects, sem hífen errado)
   - `roles:[]` do step ⊆ `allowedRoles` do `RoleGuard` da rota?

### 25 tour modules (cobertura 100% dos módulos)

| Categoria | Tour | Steps | Roles |
|-----------|------|-------|-------|
| Nav & Dashboard | layout, dashboard, dashboard-customizer | 14+3+1 | todos |
| Field Service | os-list, os-wizard, os-detail, agenda | 5+11+4+2 | Tecnico+ |
| Assets & Clients | equipamentos, clientes | 3+1 | Supervisor+ |
| Commercial | orcamentos | 2 | Supervisor+ |
| Finance & Procurement | reembolsos, materiais, cp | 2+3+4 | Tecnico+/Financeiro+ |
| Inventory | fornecedores, pecas | 2+2 | Supervisor+ |
| Knowledge | conhecimento | 3 | todos |
| HR & Payroll | rh, dp | 6+7 | Gestor+ |
| Admin | admin, admin-sla, admin-budget, admin-manutencao, admin-tenants-mgmt | 5+2+2+2+1 | Gestor+/Master |
| Platform | platform, platform-company-profile | 4+1 | SuperMaster |

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

## Próximas sprints disponíveis

Arquivos completos em `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\Sprints\`

- **Sprint D** — CPQ: ✅ Assinatura eletrônica + Versionamento + **OS↔Orçamento linkage (concluído 2026-05-30)**
- **Sprint E** — OCR comprovantes + Budget + Base KB + Lifecycle de ativo (concluída)
- **Dashboard Real** — ✅ Concluído 2026-05-31 (personalização, 3 novos widgets, período, refresh automático)
- **Holerite PDF** — `gerarHolerite.ts` já existe
- **Notificações cross-módulo** — alertas SLA, aprovações pendentes, vencimentos CP (próximo passo SAP)
- **CR (Contas a Receber)** — ciclo financeiro completo: fatura → pagamento → aging
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
