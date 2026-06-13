# Sessão 51 — 22/05/2026 — Sistema de Onboarding com Coach Marks (driver.js)

**Commit:** a ser criado nesta sessão

### Contexto e motivação

Após as features de produto (Equipamentos, Taxa de Retorno, Logo no PDF) serem entregues na s50, o foco desta sessão foi implementar o sistema de onboarding interativo com coach marks para guiar novos usuários pelo SaaS. A solução precisava:
- Cobrir **todas** as telas e funcionalidades do SaaS de ponta a ponta
- Ser role-aware (Técnico, Gestor, Admin, Master, SuperMaster veem tours distintos)
- Suportar tour multi-página com navegação automática entre rotas
- Ser extensível: adicionar onboarding para uma nova feature = criar 1 arquivo `.tour.ts` + registrar

### Biblioteca escolhida: driver.js v1.4.0

Avaliadas Intro.js (paga), Shepherd.js (30 kB), e **driver.js** (≈10 kB minificado, 6.16 kB gzip no bundle). driver.js ganhou por ter zero dependência React, API simples, e fit perfeito com o design system via CSS custom properties (`var(--card)`, `var(--border)`, etc.).

---

### Arquivos novos

| Arquivo | Descrição |
|---|---|
| `src/onboarding/tours/index.ts` | Registry central: tipos `Role`, `TourStep`, `TourModule`; array `TOUR_MODULES`; função `getTourSteps(role)` — extensibilidade documentada (3 passos para adicionar nova feature) |
| `src/onboarding/tours/layout.tour.ts` | 13 steps de navegação (dashboard, OS, orçamentos, reembolsos, compras, clientes, equipamentos, admin, notificações, perfil) — roles por link |
| `src/onboarding/tours/dashboard.tour.ts` | 3 steps: KPIs, taxa de retorno, gráficos |
| `src/onboarding/tours/os-list.tour.ts` | 5 steps: nova OS, sync badge, filtros, card, status badge |
| `src/onboarding/tours/os-wizard.tour.ts` | 11 steps cobrindo os 7 steps do wizard (indicador, tipo, cliente, ativo, geo, checklist, diagnóstico, serviços, fotos, assinatura, enviar) |
| `src/onboarding/tours/os-detail.tour.ts` | 4 steps: status, PDF, aprovação (Supervisor+), assinaturas |
| `src/onboarding/tours/equipamentos.tour.ts` | 3 steps: novo, coluna preventiva, botão detalhe |
| `src/onboarding/tours/clientes.tour.ts` | 1 step: botão Novo Cliente (CNPJ auto-fill) |
| `src/onboarding/tours/orcamentos.tour.ts` | 2 steps: novo, card primeiro |
| `src/onboarding/tours/reembolsos.tour.ts` | 2 steps: novo, card primeiro |
| `src/onboarding/tours/materiais.tour.ts` | 3 steps: nova solicitação, IA capture, card primeiro |
| `src/onboarding/tours/admin.tour.ts` | 5 steps: templates novo, lista, tipo serviço, convidar usuário, tabela — Gestor+/Admin/Master |
| `src/onboarding/tours/platform.tour.ts` | 4 steps: lista tenants, novo tenant, lista usuários, logo — SuperMaster only |
| `src/onboarding/useOnboardingDriver.ts` | Hook que cria instância driver.js com `onNextClick`/`onPrevClick` overrides; `waitForElement(selector, 4000ms)` via MutationObserver para componentes lazy; `navigateForStep` verifica rota antes de avançar |
| `src/onboarding/OnboardingContext.tsx` | Provider: auto-trigger modal após 1200ms (primeira visita); `startTour`, `resetTour`, `hasCompleted`; `getEffectiveRole()` mapeia `role=Master + isPlatform=true` → `'SuperMaster'`; localStorage key `onboarding_v1_done_{userId}` |
| `src/onboarding/WelcomeModal.tsx` | Portal para `document.body`; backdrop `fixed inset-0`; Rocket icon; "Fazer tour agora" / "Pular por enquanto"; `animate-in fade-in zoom-in-95 fill-mode-backwards` (sem Framer Motion) |
| `src/onboarding/OnboardingButton.tsx` | Botão "Ver tour" no perfil sheet → chama `resetTour()` |

---

### Arquivos editados

| Arquivo | Mudança |
|---|---|
| `src/index.css` | `@import 'driver.js/dist/driver.css'` antes do Tailwind; ~50 linhas de override `.driver-popover*` usando `var(--card)`, `var(--border)`, `var(--primary)` etc. com `!important` |
| `vite.config.ts` | `manualChunks: { 'vendor-driver': ['driver.js'] }` — isola driver.js do chunk principal |
| `src/App.tsx` | `OnboardingProvider` envolvendo `<Routes>` dentro do `BrowserRouter` |
| `src/components/layout/AppLayout.tsx` | `NAV_ONBOARDING` map (path→key); `data-onboarding` em cada NavLink, sino, e botão de perfil; `<OnboardingButton>` no sheet do perfil |
| **25+ páginas/componentes** | `data-onboarding="[modulo]-[elemento]"` adicionado a todos os elementos-alvo do tour: wizard steps 1–7, dashboard KPIs/gráficos, lista OS/cards, detalhe OS, equipamentos, clientes, orçamentos, reembolsos, compras, admin (checklists/tipos/usuários), platform (tenants/users/settings) |
| `tests/helpers/auth.ts` | Após login, `page.evaluate()` lê sessão Supabase do localStorage e define `onboarding_v1_done_{userId}` — evita WelcomeModal bloquear cliques nos testes E2E |

---

### Bug fixes desta sessão

| Bug | Causa | Fix |
|---|---|---|
| `Cannot find namespace 'React'` em `OnboardingContext` | `React.ReactNode` sem import de React | Adicionado `type ReactNode` ao import do react |
| WelcomeModal bloqueia testes Playwright (`strict mode violation: 2 dialogs`) | Timer 1200ms disparava antes do `loginAs` suprimir o localStorage | `OnboardingContext`: timer re-verifica localStorage no momento do disparo (não só na criação) |

---

### Convenção `data-onboarding`

Padrão: `[modulo]-[elemento]`

Exemplos: `os-nova`, `wizard-step2-ativo`, `eq-preventiva-col`, `dashboard-taxa-retorno`, `platform-settings-logo`

Para adicionar tour de nova feature: 1) criar `src/onboarding/tours/nova-feature.tour.ts`, 2) registrar em `TOUR_MODULES` em `index.ts`, 3) adicionar `data-onboarding` nos elementos alvo.

---

### Validação

- `npx tsc --noEmit` → **EXIT:0**
- `npm run build` → **EXIT:0** | chunk principal **95.77 kB gzip (< 100 kB)** | `vendor-driver`: 6.16 kB gzip
- `npx playwright test` → **14/14 passando**
