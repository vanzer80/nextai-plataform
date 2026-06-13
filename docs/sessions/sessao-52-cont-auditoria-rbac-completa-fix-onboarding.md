# Sessão 52 cont. — 23/05/2026 — Auditoria RBAC Completa + Fix Onboarding

**Commits:** `52845cd` (rbac matrix) · `2515c4e` (remove orcamentos tecnico) · `86f5e6e` (rolegard redirect) · `15e2b71` (fix onboarding tour)

### Contexto

Continuação da sessão 52 (mesma data). Auditoria completa da implementação de controle de acesso por perfil (RBAC) identificou 6 problemas de segurança e consistência, todos corrigidos na sequência.

---

### 1 — Defense-in-depth: rotas desprotegidas (commit `52845cd`)

**Problema:** rotas `/reports/*`, `/orcamentos/*`, `/reimbursements/*`, `/materials/*` não tinham `RoleGuard` no React Router. Qualquer usuário autenticado podia acessar digitando a URL diretamente — a proteção existia apenas no DB (RLS, camada 3) e na nav (camada 1), mas não nas rotas (camada 2).

**Fix:**
```tsx
// Adicionados RoleGuards a todos os grupos de rotas
<Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor', 'Supervisor', 'Tecnico']} />}>
  <Route path="/reports" ... />
</Route>
<Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor', 'Supervisor']} />}>
  <Route path="/orcamentos" ... />
</Route>
// + reimbursements + materials
```

**Arquivo:** `src/App.tsx`

---

### 2 — Correção da matriz de acesso no NAV_LINKS (commit `52845cd`)

**Inconsistências corrigidas:**

| Link | Antes | Depois |
|---|---|---|
| Reembolsos | sem `Administrativo` | com `Administrativo` (têm acesso ao módulo) |
| Compras | com `Tecnico`, sem `Financeiro` | ajustado para espelhar o RoleGuard |
| Orçamentos | com `Tecnico` | sem `Tecnico` |

**Arquivo:** `src/components/layout/AppLayout.tsx`

---

### 3 — Remoção explícita de Orçamentos para Técnico (commit `2515c4e`)

Commit dedicado para garantir rastreabilidade: `Tecnico` removido tanto da rota (`App.tsx`) quanto do `NAV_LINKS` (`AppLayout.tsx`) para Orçamentos. Decisão de produto: Técnico cria e executa OS; proposta comercial é responsabilidade de Supervisor/Gestor.

---

### 4 — dashboardConfig: widgets de OS removidos de roles sem acesso (commit `52845cd`)

**Princípio aplicado:** role só deve ver KPI de módulo que pode acessar e investigar. Sem isso, métricas aparecem mas não têm contexto acionável.

| Role | Widgets removidos |
|---|---|
| Administrativo | `reports-kpi`, `productivity`, `approval-rate`, `reports-bar` |
| Comprador | `reports-kpi`, `productivity`, `approval-rate`, `reports-bar` |
| Financeiro | `approval-rate` (métrica de OS, não de finanças) |

**Arquivo:** `src/pages/dashboard/dashboardConfig.ts`

---

### 5 — RoleGuard: redirect em vez de erro UI (commit `86f5e6e`)

**Problema:** `RoleGuard` exibia card "Acesso Restrito" dentro do `AppLayout` — sidebar continuava visível, vazando estrutura de navegação. Comportamento inconsistente com `PlatformGuard` que redireciona.

**Fix:**
```tsx
// Antes
return (
  <div className="flex h-full flex-col items-center justify-center ...">
    <h2>Acesso Restrito</h2>
    <p>Seu nível de acesso atual ({user?.role}) não permite...</p>
  </div>
);

// Depois
return <Navigate to="/dashboard" replace />;
```

**Arquivo:** `src/components/auth/ProtectedRoute.tsx`

---

### 6 — Padronização de ordenação de allowedRoles (commit `86f5e6e`)

**Problema:** arrays antigos usavam rank-decrescente (`['Master', 'Admin', ...]`); novos usavam rank-crescente (`['Tecnico', ..., 'Master']`). Mistura tornava auditoria visual difícil.

**Convenção adotada:** rank-decrescente (Master primeiro) em todos os `RoleGuard` e comentários de rota.

---

### 7 — Bug onboarding: Técnico navegado para /orcamentos pelo tour (commit `15e2b71`)

**Root cause:** `orcamentos.tour.ts` e `layout.tour.ts` listavam `'Tecnico'` nas `roles` de steps com `route: '/orcamentos'`. O `useOnboardingDriver` inclui **incondicionalmente** steps que têm `route` definido (sem verificar permissão) e chama `navigate('/orcamentos')` durante o tour.

**Fluxo do bug:**
1. Técnico faz login pela 1ª vez → onboarding auto-dispara após 1200ms
2. Tour avança até módulo Orçamentos → `navigate('/orcamentos')` 
3. (Antes do fix de RoleGuard) página `/orcamentos` renderizava dentro do AppLayout — módulo visível
4. (Depois do fix de RoleGuard) redirect para `/dashboard`, mas driver.js ainda mostrava popover "Novo Orçamento" flutuando na tela

**Fix:** remover `'Tecnico'` das roles dos steps de Orçamentos:
```ts
// orcamentos.tour.ts — ambos os steps:
roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],  // era: ['Tecnico', ...]

// layout.tour.ts — step nav-orcamentos:
roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],  // era: ['Tecnico', ...]
```

**Arquivos:** `src/onboarding/tours/orcamentos.tour.ts`, `src/onboarding/tours/layout.tour.ts`

---

### Validação

- `tsc --noEmit` → EXIT:0
- `npm run build` → EXIT:0 | chunk principal **95.97 kB gzip** (< 100 kB)
- Nenhum spec Playwright afetado (rotas existentes não foram removidas nem renomeadas)
