# NextAI — Design System

> **Produto:** NextAI · **Atualizado em:** 2026-06-04 (Sessão 68)  
> Documenta o design system real extraído do código — tokens, componentes, padrões e armadilhas.

---

## Stack Visual

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Utilidades CSS | Tailwind CSS v4 (via `@tailwindcss/vite`) | 4.1 |
| Primitivos UI | @base-ui/react | 1.4 |
| Componentes | shadcn/ui (CLI `shadcn@4.2`) | — |
| Ícones | lucide-react | 0.546 |
| Fonte | Geist Variable (`@fontsource-variable/geist`) | 5.2 |
| Animações | tw-animate-css + @formkit/auto-animate | — |
| Toasts | Sonner | 2.0 |
| Temas | next-themes | 0.4 |
| Onboarding | driver.js | 1.4 |

---

## Tokens de Cor e Sistema OKLCH

### Variáveis CSS principais

O design system usa variáveis CSS nativas. Os tokens de cor primários são substituídos dinamicamente pelo branding do tenant.

```css
/* Cores primárias (variam por tenant via applyTenantBrand) */
--primary
--primary-foreground
--ring

/* Background e superfície */
--background
--foreground
--card / --card-foreground
--muted / --muted-foreground
--border

/* Sidebar — conjunto independente (ver armadilha #1 abaixo) */
--sidebar-background
--sidebar-foreground
--sidebar-primary / --sidebar-primary-foreground
--sidebar-ring
--sidebar-border
--sidebar-accent / --sidebar-accent-foreground
```

### Branding dinâmico por tenant

**Arquivo:** `src/lib/color.ts`

Cada tenant define uma `primary_color` (hex). No login, `applyTenantBrand()` injeta um `<style id="tenant-brand">` no `<head>` com variáveis OKLCH calculadas para light e dark mode.

```typescript
hexToOklch(hex)           // Converte hex → OKLCH via matrizes OKLab (Björn Ottosson)
applyTenantBrand(tenant)  // Injeta <style id="tenant-brand"> no <head>
applyTenantBrand(null)    // Remove branding (chamado no logout — restaura tema padrão)
```

**Invariantes de luminância preservados:**
- Light mode: L = 0.52 (preservado)
- Dark mode: L = 0.72 (preservado)
- Chroma dark = 86% do chroma light

**Variáveis injetadas:** `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring` (para light e dark).

**Cor padrão da plataforma NextAI:** `#6366F1` (indigo).

---

## ⚠️ Armadilhas Críticas de Design

### Armadilha 1 — Sidebar: sempre usar `bg-sidebar-*` / `text-sidebar-*`

Nunca usar `bg-background`, `text-foreground` ou `border-border` **dentro de componentes renderizados na sidebar**. O contexto da sidebar define seus próprios valores para essas variáveis — componentes que usam os tokens genéricos ficam invisíveis (fundo igual ao da sidebar).

```tsx
// ❌ ERRADO — componente fica invisível dentro da sidebar
<div className="bg-background text-foreground border border-border">

// ✅ CERTO
<div className="bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border">
```

### Armadilha 2 — Base UI `DialogContent` max-width

O `DialogContent` do @base-ui/react aplica `sm:max-w-sm` por padrão. Sobrescrever com `max-w-4xl` sem prefixo responsivo **não funciona** — o `sm:` da base tem maior especificidade via Tailwind v4.

```tsx
// ❌ ERRADO — sm:max-w-sm do base UI não é sobrescrito
<DialogContent className="max-w-4xl">

// ✅ CERTO — usar prefixo responsivo do mesmo tier ou maior
<DialogContent className="sm:max-w-4xl">
```

### Armadilha 3 — Logo NextAI: `tspan` deve ser `"ext"`, nunca `"Next"`

O símbolo geométrico SVG **já representa o "N"** — a wordmark é formada por `símbolo N + texto "extAI"`. Se o `tspan` receber `"Next"`, o resultado visual é **"NNextAI"** (N duplicado).

```svg
<!-- ❌ ERRADO — gera "NNextAI" -->
<tspan>Next</tspan>AI

<!-- ✅ CERTO — gera "NextAI" (N do símbolo + "extAI" do texto) -->
<tspan>ext</tspan>AI
```

**Parâmetros do logo (`src/components/brand/NextAILogo.tsx`):**
- `viewBox="0 0 555 200"`
- x do tspan: `133` (gap de 6u após o símbolo geométrico)
- Altura padrão: `28px` em Navbar, Footer e PDFs

---

## Layouts

### AppLayout

Layout principal da aplicação (todos os usuários exceto Cliente e SuperMaster):

```
┌──────────────────────────────────────────┐
│ Sidebar (240px, desktop)                 │
│ Logo | Links filtrados por role | Perfil │
├──────────────────────────────────────────┤
│ <Outlet> com <Suspense> boundary         │
│ (cada página é React.lazy())             │
└──────────────────────────────────────────┘

Mobile:
┌──────────────────┐
│ Header + Hamburger │  → Sheet lateral
├──────────────────┤
│    <Outlet>      │
├──────────────────┤
│  Bottom Nav (3–4) │  configurável via Sheet "Minha Conta"
└──────────────────┘
```

**Componentes-chave:** `NotificationsDropdown` (sino + badge animado + Realtime), `UserProfileDropdown` (avatar + role badge + tema).

### PlatformLayout

Exclusivo para SuperMaster (`is_platform=true`). Sidebar com links `/platform/*`. Bloqueado por `PlatformGuard`.

### ClientPortalLayout

Exclusivo para role `Cliente`. Acesso read-only ao Portal do Cliente (`/portal`).

---

## Navegação por Role

Links visíveis na sidebar por role (lógica em `NAV_LINKS` no `AppLayout`):

| Link | Roles |
|------|-------|
| Dashboard | Todos (autenticado) |
| OS/Relatórios | Master, Admin, Gestor, Supervisor, Tecnico |
| Orçamentos | Master, Admin, Gestor, Supervisor |
| Reembolsos | Master, Admin, Gestor, Supervisor, Financeiro, Administrativo, Tecnico |
| Compras | Master, Admin, Gestor, Supervisor, Financeiro, Comprador, Administrativo, Tecnico |
| Agenda | Master, Admin, Gestor, Supervisor |
| Clientes | Master, Admin, Gestor, Supervisor |
| Equipamentos | Master, Admin, Gestor, Supervisor |
| Fornecedores | Master, Admin, Gestor, Supervisor |
| Peças/Estoque | Master, Admin, Gestor, Supervisor |
| Base de Conhecimento | Master, Admin, Gestor, Supervisor, Tecnico, Financeiro, Administrativo, Comprador |
| RH | Master, Admin, Gestor |
| DP | Master, Admin, Gestor |
| CP | Master, Admin, Gestor, Financeiro |
| Administração | Master, Admin, Gestor |

---

## Padrões de Componentes

### Wizard de 7 Steps (OS)

`src/pages/reports/components/steps/Step1…Step7.tsx`

- Stepper unificado com barra de progresso e indicador de step (componente único)
- Cada step é `React.lazy()` — não impacta o bundle inicial
- `useReportDraft` persiste o estado no IndexedDB a cada alteração (autosave)
- Step 4 — `AiDiagnosticAssistant`: input livre → Edge Function `ai-proxy` → diagnóstico enriquecido + botão "Copiar"
- Step 7 — `SignatureCanvas`: canvas HTML5 nativo para assinaturas técnico e cliente
- Convensão: `data-onboarding="wizard-step<N>-<elemento>"` em todos os elementos-alvo de onboarding

### Dashboard Widgets (15)

`src/pages/dashboard/widgets/` + `src/pages/dashboard/`

```
widgetRegistry.ts      ← mapa id → componente
dashboardConfig.ts     ← configuração padrão por role
useDashboardPrefs.ts   ← carrega/salva preferências em dashboard_preferences (banco)
DashboardCustomizer.tsx ← toggle de visibilidade dos widgets
```

Cada widget é um componente autocontido com seus próprios queries Supabase. Filtro de período configurável (7d/30d/90d) salvo no banco.

### Padrão de PDF (jsPDF)

Todos os PDFs seguem o padrão obrigatório:

1. Função `async` — nunca síncrona
2. `urlToDataUrl()` para converter logo URL → base64 (`src/utils/imageUtils.ts`)
3. `detectImageFormat()` para identificar PNG vs JPEG vs WebP
4. `measureImage()` + `fitInBox()` para dimensionar o logo sem distorção
5. Cabeçalho azul com logo do tenant posicionado corretamente
6. Conteúdo principal via `jsPDF` + `jspdf-autotable`
7. Call site usa `void gerarPdfXxx(...)` — descarta a Promise retornada

**Arquivos:**
- `src/utils/gerarPdfRelatorio.ts` — OS
- `src/utils/gerarPdfOrcamento.ts` — Orçamento (inclui seção "OS Vinculada")
- `src/utils/gerarHolerite.ts` — Holerite DP
- `src/utils/imageUtils.ts` — utilitários: `urlToDataUrl`, `detectImageFormat`, `measureImage`, `fitInBox`

---

## Animações

| Efeito | Implementação |
|--------|--------------|
| Hover lift em cards | classe utilitária via `tw-animate-css` |
| Fade-in de páginas | aplicado no container principal de cada página |
| Pulse em badge de notificações | `animate-pulse` Tailwind |
| Transições de listas (add/remove) | `@formkit/auto-animate` (ref no container da lista) |

**Sem Framer Motion** — `motion` foi removido em PERF-bundle-01 (liberou ~50 kB gzip do bundle).

---

## Onboarding (driver.js)

**Arquitetura:** `src/onboarding/tours/*.tour.ts` → registrados em `index.ts` → driver.js executa.

```
src/onboarding/
  tours/
    dashboard.tour.ts
    os-list.tour.ts
    os-wizard.tour.ts
    os-detail.tour.ts
    reembolsos.tour.ts
    materiais.tour.ts
    orcamentos.tour.ts
    agenda.tour.ts
    clientes.tour.ts
    equipamentos.tour.ts
    fornecedores.tour.ts
    pecas.tour.ts
    conhecimento.tour.ts
    rh.tour.ts
    dp.tour.ts
    cp.tour.ts
    admin.tour.ts
    admin-sla.tour.ts
    admin-budget.tour.ts
    admin-manutencao.tour.ts
    admin-tenants-mgmt.tour.ts
    company-profile.tour.ts
    platform.tour.ts
    dashboard-customizer.tour.ts
    layout.tour.ts
  index.ts   ← registra e exporta todos os 25 tours
```

**Regras críticas:**
- Convensão de atributo: `data-onboarding="<módulo>-<elemento>"` em todos os alvos
- **Roles do tour ⊆ `allowedRoles` do RoleGuard em `App.tsx`** — verificar sempre ao criar novo tour (caso contrário, o tour tenta navegar para rota bloqueada)
- Tours multi-página: driver instrui navegação automática antes de destacar o próximo elemento

---

## Responsividade (Mobile-First)

| Breakpoint | Comportamento |
|-----------|---------------|
| `< 640px` | Bottom Nav + Header mobile; sidebar oculta; cards em coluna única |
| `640px (sm)` | Transição; alguns grids de 2 colunas |
| `768px (md)` | Tabelas com mais colunas visíveis |
| `1024px (lg)` | Sidebar fixa visível; grid completo do dashboard (2–3 colunas) |

---

## Paleta de Status

Usada consistentemente em badges e filtros nos módulos de OS, Reembolsos, Orçamentos e CP:

| Status | Cor Tailwind | Hex aprox. |
|--------|-------------|-----------|
| Aprovado | `green-*` | #16a34a |
| Pendente / Enviado | `amber-*` | #d97706 |
| Rejeitado | `red-*` | #dc2626 |
| Devolvido / Revisão | `orange-*` | #ea580c |
| Pago | `violet-*` | #7c3aed |
| Rascunho | `slate-*` | #64748b |
| Em Análise / Comprado | `blue-*` | #2563eb |
| Entregue | `emerald-*` | #059669 |

---

## Identidade Visual da Marca

### NextAI Logo

- **Arquivo:** `src/components/brand/NextAILogo.tsx`
- **Estrutura SVG:** símbolo geométrico "N" (path) + tspan `"ext"` + texto `"AI"` = wordmark **"NextAI"**
- **ViewBox:** `0 0 555 200`
- **x do tspan:** `133` (gap de 6 unidades após o símbolo)
- **Altura padrão:** `28px` em Navbar, Footer e cabeçalho de PDFs
- Símbolo colorido com `--primary` do tenant; texto usa cor do contexto

### Toasts (Sonner)

- Provider: `<Toaster>` no `App.tsx`
- Uso: `import { toast } from 'sonner'` → `toast.success()`, `toast.error()`, `toast.info()`
- Duração padrão: 4 s · Posição: bottom-right (desktop)

---

## Acessibilidade

- Navegação por teclado via primitivos @base-ui/react (focus management nativo)
- Labels associados em todos os inputs (react-hook-form `register` + `<label htmlFor>`)
- `aria-label` em botões de ícone (sem texto visível)
- Contraste de cor mantido com luminância OKLCH preservada no branding dinâmico
- `data-onboarding` attributes são apenas identificadores — não interferem com screen readers
