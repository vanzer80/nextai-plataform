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
- Novo módulo: migration → types → service → hook → componente → página → rota + nav
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
- Credenciais em `tests/.env.test` (gitignored)

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
31. **Guard async `useRef` + `useState`** → para handlers async chamados de listas (ex: `handleSelectOS`): `ref` bloqueia reentrada síncrona (imune a race entre renders); `state` controla `disabled` visual. Usar `try/finally` para reset garantido. Padrão consolidado em `useOfflineSync.ts`.
32. **`gerarPdfOrcamento.ts`** → `osNum` foi removida (era variável para linha crua de OS). Não recriar. OS vinculada agora é box dedicado `roundedRect` após o título, condicionado a `orcamento.report_id`.
33. **jsPDF logo width=0 + browser Image API** → NUNCA usar `addImage(..., 0, height)` em PDFs com texto ao lado — jsPDF calcula largura pelo aspect ratio e pode invadir o texto. NUNCA usar `doc.getImageProperties(dataUrl)` para pré-medir: em browser mode (canvas), retorna valores errados vs Node. Padrão correto: `await measureImage(dataUrl)` (src/utils/imageUtils.ts — usa `HTMLImageElement.naturalWidth/Height`, garantido para qualquer formato) + `fitInBox(w, h, maxW, maxH)` → passar `{w, h}` EXPLÍCITOS ao `addImage`. `headerTextX = marginL + logoW + 4`. Aplicado nos 4 PDFs. ATENÇÃO: corrigir também o callback `didDrawPage` de autoTable — pode ter `addImage` separado com o bug.
28. **Playwright getByText partial match** → `'OS Pendentes'` casa com "reembolsos **pendentes**". Sempre usar `{ exact: true }` para labels de widget no customizer.
29. **Double fetch no dashboard** → nunca passar `activeWidgets` ao `useDashboardData` enquanto `prefs.isLoading`. Usar `effectiveWidgets = prefs.isLoading ? [] : prefs.activeWidgets`. O hook trata `widgetKey === ''` retornando `isLoading: false` imediato.
30. **Onboarding modal 1200ms** → o welcome dialog aparece 1200ms após login. Testes E2E devem usar `loginAs` de `tests/helpers/auth.ts` que seta `onboarding_v1_done_{uid}` no localStorage dentro desse janela.

## Próximas sprints disponíveis

Arquivos completos em `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\Sprints\`

- **Sprint D** — CPQ: ✅ Assinatura eletrônica + Versionamento + **OS↔Orçamento linkage (concluído 2026-05-30)**
- **Sprint E** — OCR comprovantes + Budget + Base KB + Lifecycle de ativo (concluída)
- **Dashboard Real** — ✅ Concluído 2026-05-31 (personalização, 3 novos widgets, período, refresh automático)
- **Holerite PDF** — `gerarHolerite.ts` já existe
- **Notificações cross-módulo** — alertas SLA, aprovações pendentes, vencimentos CP (próximo passo SAP)
- **CR (Contas a Receber)** — ciclo financeiro completo: fatura → pagamento → aging
- **Testes E2E RH/DP/CP** — Playwright para os módulos enterprise

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
