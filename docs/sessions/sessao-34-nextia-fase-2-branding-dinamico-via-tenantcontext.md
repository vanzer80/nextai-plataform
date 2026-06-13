# Sessão 34 — 04/05/2026 — NextIA Fase 2: branding dinâmico via TenantContext
**Commit:** `07d52bf` — `feat(nextia-f2): branding dinâmico via TenantContext`
**Arquivos criados:** `src/contexts/TenantContext.tsx`
**Arquivos alterados:** `App.tsx`, `useOfflineSync.ts`, `reportIndexedDB.ts`, `OrcamentoDetail.tsx`, `ReimbursementsList.tsx`, `ReportDetail.tsx`, `gerarPdfOrcamento.ts`, `gerarPdfRelatorio.ts`

### Hardcodes encontrados e tratados

| # | Arquivo | Linha | Hardcode | Tratamento |
|---|---------|-------|----------|------------|
| 1 | `src/utils/gerarPdfRelatorio.ts` | 157 | `'PORTAL MOPAR'` | → `tenantName.toUpperCase()` |
| 2 | `src/utils/gerarPdfRelatorio.ts` | 422 | `'Portal Mopar'` | → `tenantName` |
| 3 | `src/utils/gerarPdfOrcamento.ts` | 42 | `'PORTAL MOPAR'` | → `tenantName.toUpperCase()` |
| 4 | `src/lib/reportIndexedDB.ts` | 55 | `'portal-mopar-reports'` | → `initDBName(slug)` + default fallback |
| 5 | `src/pages/reimbursements/ReimbursementsList.tsx` | 293 | `'Mopar Engenharia'` | → `tenant?.name \|\| 'Portal Mopar'` |
| 6 | `src/pages/reimbursements/ReimbursementsList.tsx` | 406 | `'Mopar Engenharia'` | → `tenant?.name \|\| 'Portal Mopar'` |
| — | `public/sw.js`, `manifest.json`, `index.html` | — | `'portal-mopar-v2'`, `"Portal Mopar"` | **Excluídos** — arquivos pré-React estáticos, sem acesso a React context |

### Arquitetura do TenantContext

- `src/contexts/TenantContext.tsx`: busca `tenants WHERE id = user.team_id` via `.maybeSingle()`. Expõe `{ tenant: TenantData | null, loading: boolean }` + hook `useTenant()`.
- `TenantProvider` integrado em `App.tsx` dentro de `AuthProvider` (e fora de `BrowserRouter` — não precisa de roteamento).
- `tenant: null` no login (user sem session) — sem erro.

### IndexedDB — namespacing por tenant

- `reportIndexedDB.ts` exporta `initDBName(tenantSlug: string)`: seta `dbName = ${slug}-reports` e reseta `dbPromise = null` para re-abertura.
- Chamado de `useOfflineSync` via `useTenant()` em `useEffect([tenant?.slug])`.
- Fallback default `'portal-mopar-reports'` é usado até o tenant resolver (na montagem inicial).
- ⚠️ **Nota de migração:** dados existentes em `portal-mopar-reports` ficam isolados quando o slug mudar. Aceitável para migração única.

### Verificações finais
- `npx tsc --noEmit` → EXIT:0
- `git push origin master` → `07d52bf`
