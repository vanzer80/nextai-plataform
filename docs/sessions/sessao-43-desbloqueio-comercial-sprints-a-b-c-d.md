# Sessão 43 — 17/05/2026 — Desbloqueio comercial: Sprints A+B+C+D

### Sprint D — Issues abertos ✅

**D1 — Issue #3: Tabela de Reembolsos (commit `8f4c709`) — FECHADO**

Substituiu os três botões inline `Aprovar / Ajuste / Reprovar` por um `DropdownMenu` compacto com ícone `MoreHorizontal`. Resolve overflow em todas as resoluções.

| Mudança | Antes | Depois |
|---|---|---|
| Coluna Ações | `w-[260px]` + 3 botões inline | `w-[70px]` + dropdown `...` |
| `min-w` da tabela | `850px` | `720px` |
| `colSpan` empty state (manager) | `8` (bug) | `9` (correto: checkbox + 8 colunas) |

**D2 — Issue #2: Leaked Password Protection — INSTRUÇÃO GERADA**

A-05 confirmado como desabilitado via `get_advisors(security)` do MCP. A configuração de HIBP no Supabase Auth **não é acessível via SQL** — requer ação no painel web:

> **Ação pendente do usuário:**
> 1. Abrir https://supabase.com/dashboard/project/sksursvmgvxqbbdsztcd/auth/providers
> 2. Seção **Email → Password** → ativar **"Check for leaked passwords"** → **Save**

**Novos advisors observados** (não fazem parte do Sprint D — registrar para próxima auditoria):
- `tenant-assets` bucket público com política SELECT ampla (lista todos os arquivos) — baixo impacto mas vale revisar
- `rls_auto_enable()` acessível a `authenticated` — verificar se função é usada ou pode ser dropada
