# Sessão 46 — 17/05/2026 — Painel SuperMaster + 5 Bugs Críticos

**Commits:** `ca8e0ef` (feat) · `3125492` (fix auditoria)

### PlatformLayout + 4 rotas `/platform/*`

- `PlatformLayout.tsx`: sidebar dedicada para SuperMaster com links Empresas / Usuários / Configurações
- `PlatformGuard`: bloqueia `role !== 'Master' || !isPlatform` → redireciona para `/dashboard`
- `SmartRedirect`: na raiz `/`, SuperMaster vai para `/platform/tenants`, demais para `/dashboard`
- Páginas: `PlatformTenants` (lista + criar + editar + suspender) · `PlatformUsers` (cross-tenant) · `PlatformSettings` (nome/cor/logo + conta)

### 5 bugs críticos corrigidos (auditoria pós-implementação)

| # | Componente | Bug | Correção |
|---|---|---|---|
| 1 | `PlatformTenants` | Query `tenants` sem policy correta (RLS block) | Ver Sessão 47 — RLS fix |
| 2 | `platform-list-users` EF | Não validava se caller é SuperMaster | Guard adicionado |
| 3 | `PlatformSettings` | Form não carregava dados ao abrir | `reset()` com dados do tenant no `useEffect` |
| 4 | `PlatformGuard` | Race condition com `TenantContext` | Ver Sessão 47 — movido para AuthContext |
| 5 | `PlatformLayout` | Token CSS sidebar invisível | Usa `bg-sidebar-*` em vez de `bg-background` |
