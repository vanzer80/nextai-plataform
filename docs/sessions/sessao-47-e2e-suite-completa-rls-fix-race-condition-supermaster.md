# Sessão 47 — 18/05/2026 — E2E Suite Completa + RLS Fix + Race Condition SuperMaster

**Commit:** `16d3bbe` — "fix(platform): corrige race condition SuperMaster + adiciona E2E da suite de plataforma"

### Problema raiz: RLS infinite recursion (PostgreSQL 42P17)

A policy `tenants_platform_master_select_all` tinha um subquery que fazia JOIN na própria tabela `tenants`, causando recursão infinita no PostgreSQL. Isso fazia TODAS as queries em `tenants` falhar silenciosamente (`data=null`) para o SuperMaster após login.

**Correção — função SECURITY DEFINER:**
```sql
CREATE OR REPLACE FUNCTION is_platform_master()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u JOIN tenants t ON t.id = u.team_id
    WHERE u.id = auth.uid() AND u.role = 'Master' AND t.is_platform = true
  );
$$;

DROP POLICY IF EXISTS tenants_platform_master_select_all ON tenants;
CREATE POLICY tenants_platform_master_select_all ON tenants
  FOR SELECT TO authenticated USING (is_platform_master());
```
Aplicada diretamente no Supabase remoto via MCP (sem arquivo de migration local).

---

### Race condition de roteamento eliminada

`SmartRedirect` e `PlatformGuard` dependiam de `tenant.isPlatform` do `TenantContext`, que chegava async após o login — causando janela onde `loading=false, tenant=null` e o guard redirecionava SuperMaster para `/dashboard`.

**Solução:** `isPlatform` movido para o perfil do `AuthContext` via join embutido no `fetchUserData`:

```typescript
// AuthContext.tsx — fetchUserData
supabase.from('users')
  .select('role, full_name, team_id, tenant:tenants(is_platform)')
  .eq('id', authUser.id)
  .maybeSingle()
// → setUser({ ...authUser, isPlatform: data.tenant?.is_platform ?? false })

// App.tsx — SmartRedirect
const { user, loading } = useAuth();  // sem TenantContext
const isSuperMaster = user?.role === 'Master' && user?.isPlatform === true;

// ProtectedRoute.tsx — PlatformGuard
const { user, loading } = useAuth();  // sem TenantContext
const isSuperMaster = user?.role === 'Master' && user?.isPlatform === true;
```

---

### Suite Playwright E2E — 14/14 passando

| Arquivo | Testes | Cobertura |
|---|---|---|
| `auth-redirect.spec.ts` | 2 | SuperMaster → `/platform/tenants` · Master Mopar → `/dashboard` |
| `platform-guard.spec.ts` | 3 | `/platform/*` bloqueia Master não-SuperMaster |
| `settings-form.spec.ts` | 4 | Form carrega dados do tenant · cor hex válida · email+badge · botão Salvar desabilitado |
| `tenant-edit.spec.ts` | 1 | Edita nome Zambrano + reverte |
| `tenant-list.spec.ts` | 3 | Lista 3 tenants · badge Platform · menu sem Suspender |
| `users-crosstenant.spec.ts` | 1 | Cria usuário cross-tenant + remove |

**Correções de seletor no processo:**
- `page.getByText(email)` → `page.getByRole('main').getByText(email)` (email aparece na sidebar E no main)
- `locator('td').filter({ hasText: /^Platform$/ })` → `page.getByText('Platform', { exact: true })` (td contém mais texto que só "Platform")
- `platformRow.getByText('NextAI')` → `{ exact: true }` (evita match case-insensitive com slug "nextai")
