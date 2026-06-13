# Sessão 31 — 04/05/2026 — NextIA: Diagnóstico White-Label + Fix R-02 notify_compradores
**DB changes:** tabela `tenants` + FK `users.team_id` + `get_caller_team_id()` + `notify_compradores` corrigida

### O que foi executado

**Diagnóstico de viabilidade white-label (READ-ONLY analysis)**

Investigação dupla: código real (`C:\dev\portal-mopar`) + banco real (MCP). Resultado consolidado em [[15 - NextIA White-Label Diagnóstico]].

Achados confirmados:
- 10 arquivos com branding "PORTAL MOPAR" / "Mopar Engenharia" hardcoded
- 18 tabelas com RLS ativo mas ZERO políticas filtram por `team_id`
- `team_id` existe em `users` (orphan column) — nunca usada em queries, RLS ou INSERTs
- 7 RPCs SECURITY DEFINER sem isolamento de tenant
- **Bug crítico R-02:** `notify_compradores` notificava TODOS os Compradores do banco independente de empresa
- `notifications` e 9 outras tabelas sem `team_id`

**Fix R-02 — `notify_compradores` (bug crítico cross-tenant)**

Sequência executada no banco:

1. Tabela `tenants` criada com RLS habilitado
2. Mopar inserido como primeiro tenant (`slug: 'mopar'`, `name: 'Mopar Engenharia'`, `primary_color: '#10b981'`)
3. Todos os 7 usuários backfillados com `team_id = mopar.id`
4. FK `users.team_id → tenants(id) ON DELETE SET NULL` adicionada
5. `get_caller_team_id()` criada: `SELECT team_id FROM users WHERE id = auth.uid()` (STABLE SECURITY DEFINER)
6. `notify_compradores` reescrita com filtro `AND team_id = v_team_id`

Antes:
```sql
INSERT INTO notifications (user_id, title, message)
SELECT id, p_title, p_message FROM users WHERE role = 'Comprador';
-- PROBLEMA: pega Compradores de TODOS os tenants
```

Depois:
```sql
SELECT team_id INTO v_team_id FROM users WHERE id = auth.uid();
INSERT INTO notifications (user_id, title, message)
SELECT id, p_title, p_message FROM users
WHERE role = 'Comprador' AND team_id = v_team_id;
-- CORRETO: zero cross-tenant leakage
```

**Documentação**

- `15 - NextIA White-Label Diagnóstico.md` criado (diagnóstico completo + arquitetura + plano de fases)
- `09 - Visão de Produto e Roadmap NextIA.md` — Fase 10 atualizada com plano detalhado
- `05 - Roadmap de Implementação.md` — Fase 0 NextIA adicionada
- GitHub issue #1 criado: https://github.com/vanzer80/portal-mopar/issues/1

### Estado pós-sessão
- Banco: Fase 0 NextIA 4/7 itens concluídos — `tenants`, FK, `get_caller_team_id()`, R-02 fix
- Pendentes Fase 0: trigger `handle_new_user`, Edge Function `admin-create-user`, `team_id` em `notifications`
- Zero regressões no app existente — mudanças são additive (nova tabela + update de RPC)
