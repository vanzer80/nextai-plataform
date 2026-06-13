# Sessão 39 — 06/05/2026 — Tenants: branding NextAI + upload de logo + dialog de edição
**Commit:** `9cf3ee4` — `feat(tenants): branding NextAI + upload de logo + dialog de edição`
**Arquivos alterados:** `src/pages/admin/TenantManagement.tsx`, `src/components/layout/AppLayout.tsx`, `supabase/functions/admin-provision-tenant/index.ts`
**Storage:** bucket `tenant-assets` criado (público, 2 MB, PNG/JPEG/WebP) + 3 policies RLS

### 1. Branding SuperMaster — `AppLayout.tsx`

**Desktop sidebar** e **mobile header**: adicionado check `tenant?.isPlatform`.
- `isPlatform === true` → renderiza "NextAI" em `text-sidebar-foreground` (sem `text-primary`, sem CSS OKLCH do tenant)
- `isPlatform === false` → comportamento original "PORTAL**MOPAR**" / "P**MOPAR**"

### 2. Upload de logo — `TenantManagement.tsx`

**Storage:**
- Bucket `tenant-assets` criado via MCP (`public: true`, `file_size_limit: 2097152`, `allowed_mime_types: [jpeg, jpg, png, webp]`)
- 3 policies em `storage.objects`:
  - `tenant_assets_public_select` — SELECT aberto (qualquer usuário lê logos)
  - `tenant_assets_platform_master_insert` — INSERT restrito a `role=Master AND is_platform=true`
  - `tenant_assets_platform_master_update` — UPDATE restrito igualmente

**Coluna `logo_url`:** já existia na tabela `tenants` — **sem migration necessária**.

**Form de criação:**
- Campo "Logo (opcional)" adicionado antes de "Cor primária" (full-width no grid 2 cols)
- `<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden">` + botão trigger
- Validação: tipo MIME + tamanho ≤ 2 MB (toast de erro se inválido)
- Preview 40×40px (thumbnail `object-cover rounded-lg`) ao lado do botão
- Upload via `supabase.storage.from('tenant-assets').upload('{slug}/logo.{ext}', file, { upsert: true })`
- URL pública via `getPublicUrl()` passada ao edge function como `tenant.logo_url`
- Limpeza de `URL.createObjectURL()` no close do dialog (evita vazamento de memória)

**Edge function `admin-provision-tenant`:**
- Body type atualizado: `tenant.logo_url?: string | null`
- Insert passou a incluir `logo_url: tenant.logo_url ?? null`

**Tabela de tenants:**
- Coluna Empresa exibe thumbnail 24×24px do logo quando `logo_url` não é null

### 3. Dialog de edição — `TenantManagement.tsx`

**Coluna "Ações":** adicionada à direita da tabela (header vazio `w-12`), `colSpan` do empty state atualizado de 5 para 6.

**Botão por linha:** `<Button variant="ghost" size="icon">` com ícone `Pencil`.

**Dialog "Editar Tenant":**
- Campos editáveis: `tenant_name`, `logo_url` (upload), `primary_color`
- Campo `slug`: desabilitado + `onChange={() => {}}` + `title="O slug não pode ser alterado após a criação"` + hint text abaixo
- Sem campos de Administrador Master
- Submit: `supabase.from('tenants').update({name, primary_color, logo_url?}).eq('id', id)` direto (não via edge function)
- Após save: `fetchTenants()` + `closeEditDialog()`
- Lifecycle: `openEditDialog(t)` inicializa `editLogoPreview` com `t.logo_url` (exibe logo existente), `editLogoFile = null`
- Arquivo novo selecionado → upload no submit; sem novo arquivo → `logo_url` não é incluído no `update` (mantém o existente)

### Correções TypeScript
- Removido `.default('#0066CC')` de `primary_color` no `tenantSchema` (armadilha #16: quebra tipo do zodResolver)
- Cast explícito `(Object.values(backfillResult.db) as number[])` no reduce (TypeScript inferia `unknown[]`)

### Verificações
- `npm run build` / `npx tsc --noEmit` → ✅ EXIT:0
