# Sessão 38 — 06/05/2026 — Branding dinâmico por tenant + redirect plataforma
**Commit:** `70ee21c` — `feat(tenant): branding dinâmico por cor primária + redirect plataforma`
**Arquivos criados:** `src/lib/color.ts`
**Arquivos alterados:** `src/contexts/TenantContext.tsx`, `src/pages/dashboard/Dashboard.tsx`

### `src/lib/color.ts`

Dois exports:

**`hexToOklch(hex)`** — converte `#rrggbb` para `{ l, c, h }` usando as matrizes oficiais do OKLab (Björn Ottosson):
- hex → sRGB → linearisa (gamma inverso) → LMS → OKLab → OKLch

**`applyTenantBrand(primaryColor | null)`** — injeta `<style id="tenant-brand">` no `<head>`:
```css
:root { --primary: oklch(0.52 C H); --ring: ...; --sidebar-primary: ...; --sidebar-ring: ... }
.dark { --primary: oklch(0.72 C*0.86 H); ... }
```
- Preserva a luminância do design system (0.52 light / 0.72 dark) — contraste estável
- Chroma dark = 86 % do light (mesma proporção do tema padrão: 0.19/0.22)
- Usa `<style>` injetado (não inline style) para preservar corretamente a cascata do dark mode
- `null` → remove o `<style>` e restaura o tema padrão

### `TenantContext.tsx`

- Chama `applyTenantBrand(data.primary_color)` após setTenant bem-sucedido
- Chama `applyTenantBrand(null)` quando `user.team_id` é nulo (logout/sem tenant)

### `Dashboard.tsx`

- Importa `useTenant` e `Navigate`
- `useTenant()` chamado como primeiro hook (antes de `useDashboardData`)
- Guard antes do `setup_pending`: `if (tenant?.isPlatform) return <Navigate to="/admin/tenants" replace />`
- Usuário `nextai@gmail.com` nunca vê o dashboard operacional vazio — cai direto em `/admin/tenants`

### Verificações
- `npm run build` → ✅ zero erros TS
- `git push origin master` → `70ee21c`
