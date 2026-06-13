# Sessão 37 — 06/05/2026 — Super Master NextAI + is_platform flag
**Commit:** `677fa4e` — `feat(nextia): Super Master nextai + is_platform flag`
**Arquivos alterados:** `src/contexts/TenantContext.tsx`, `src/components/layout/AppLayout.tsx`, `src/pages/admin/TenantManagement.tsx`, `supabase/functions/admin-provision-tenant/index.ts`
**Migration aplicada:** `nextia_platform_tenant`

### Motivação

Necessidade de separar dois níveis de acesso:
- **Master de cliente** (`master@gmail.com` / Mopar Engenharia) — gerencia dados da própria empresa, **não pode criar tenants**
- **Super Master de plataforma** (`nextai@gmail.com` / NextAI) — pode provisionar novas empresas no SaaS

### DB — `nextia_platform_tenant`

- `ALTER TABLE tenants ADD COLUMN is_platform boolean NOT NULL DEFAULT false`
- Inserido tenant `NextAI` (slug: `nextai`, cor: `#6366F1`, `is_platform = true`)
- Criado usuário `nextai@gmail.com` direto em `auth.users` via `crypt()` + `auth.identities` (bypass GoTrue — necessário pois é bootstrapping e não havia caller plataforma ainda)
- Profile atualizado: `role = 'Master'`, `team_id = nextai_id`

**Usuários após a sessão:**

| Email | Tenant | is_platform | Pode criar tenants |
|-------|--------|-------------|-------------------|
| `master@gmail.com` | Mopar Engenharia | false | ❌ |
| `nextai@gmail.com` | NextAI | true | ✅ |

### Edge function `admin-provision-tenant` v2

Adicionada verificação no passo 3 (após checar `role = 'Master'`):
```typescript
const { data: callerTenant } = await supabaseAdmin
  .from("tenants").select("is_platform").eq("id", profile.team_id).maybeSingle();
if (!callerTenant?.is_platform) return json({ error: "..." }, 403);
```
Masters de tenants clientes recebem 403 ao tentar criar tenants.

### Frontend

**`TenantContext.tsx`:**
- Adicionado `isPlatform: boolean` em `TenantData`
- Select inclui `is_platform` no fetch do tenant

**`AppLayout.tsx`:**
- Importa `useTenant()`
- `authorizedLinks` filtra: link `/admin/tenants` só aparece se `tenant?.isPlatform === true`
- Masters de Mopar não veem "Tenants" na sidebar

**`TenantManagement.tsx`:**
- Importa `useTenant()` e `Navigate`
- Guard logo antes do `return`: `if (!tenantLoading && !tenant?.isPlatform) return <Navigate to="/dashboard" replace />`
- Hooks todos chamados antes do guard (cumprindo Rules of Hooks)

### Verificações
- `npm run build` → ✅ zero erros TS
- `git push origin master` → `677fa4e`
