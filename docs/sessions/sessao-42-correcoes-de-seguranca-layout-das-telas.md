# Sessão 42 — 14/05/2026 — Correções de segurança + layout das telas

### Escopo da sessão

**Segurança (backend):**
- Executados Prompts A, B, C, D da Auditoria 2026-05-14 (confirmados via `list_migrations` e queries SQL)
- Identificado bug residual: migration `security_revoke_anon_execute_functions` revogou grants explícitos de `anon` mas não o grant de `PUBLIC` (herança PostgreSQL)
- Corrigido via migration `security_revoke_public_grant_domain_functions`: `REVOKE FROM PUBLIC` + `GRANT TO authenticated` nas 5 funções de domínio e 5 funções trigger. `get_caller_team_id()` e `get_auth_role()` mantidas acessíveis a `anon` (necessário para avaliação de RLS)
- Pendência documentada: **A-05** (Leaked Password Protection) — GitHub Issue #2

**Layout das telas (frontend):**
- Removido `max-w-* mx-auto` do container raiz de 8 páginas de listagem: ReportsList, OrcamentosList, ClientsList, ReimbursementsList, MaterialsList (ambas views), Dashboard, UserManagement, TenantManagement
- Formulários e páginas de detalhe mantidos estreitos (max-w-2xl/3xl) — intencional
- Corrigido overflow da tabela de Reembolsos: `min-w-[850px]`, larguras fixas por coluna (Categoria 130px, Ações 260px), `whitespace-nowrap` na célula de ações

**Commits:**
- `ed6583c` — style(layout): remove max-w-* das páginas de listagem
- `864c7d5` — fix(reembolsos): corrige distribuição de colunas da tabela desktop

**Pendência em aberto — tabela de Reembolsos:**
A tabela ainda não está 100% satisfatória visualmente (usuário sinalizou que falta ajuste). Documentado no GitHub Issue #3 para continuar na próxima sessão.

**URL de produção confirmada:** `portal-mopar.vercel.app`
