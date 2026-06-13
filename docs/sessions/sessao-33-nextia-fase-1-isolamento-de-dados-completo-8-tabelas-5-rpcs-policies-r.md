# Sessão 33 — 04/05/2026 — NextIA Fase 1: isolamento de dados completo (8 tabelas + 5 RPCs + policies RESTRICTIVE)
**DB changes (via MCP):** ADD COLUMN team_id em 8 tabelas + backfill + DEFAULT + policies RESTRICTIVE + 5 RPCs atualizadas + notify_compradores corrigida + notifications policy finalizada

### O que foi executado

**Fase 1 — isolamento de dados multi-tenant**

| Passo | Item |
|---|---|
| ADD COLUMN | `team_id UUID FK → tenants` em clients, sites, equipments, service_reports, checklist_templates, reimbursements, material_requests, orcamentos |
| Backfill | 34 rows tagadas com UUID do Mopar (4 clients + 3 service_reports + 17 reimbursements + 6 material_requests + 4 orcamentos; demais com 0 rows) |
| DEFAULT | `ALTER COLUMN team_id SET DEFAULT get_caller_team_id()` em todas as 8 tabelas + notifications — novos inserts propagam automaticamente, zero mudança de frontend |
| Policies | `CREATE POLICY "team_isolation" AS RESTRICTIVE` em 8 tabelas — AND obrigatório sobre todas as permissive existentes (RESTRICTIVE evita que `auth.uid() IS NOT NULL` em clients/sites anule o isolamento via OR) |
| submit_report | `v_team_id` explícito no INSERT de service_reports |
| create_orcamento | `v_team_id` explícito no INSERT de orcamentos |
| process_report_action | SELECT com `AND team_id = v_team_id` (previne cross-tenant approve) + `team_id` na notificação INSERT |
| process_reimbursement_action | SELECT com `AND team_id = v_team_id` + `team_id` na notificação INSERT |
| notify_compradores | `team_id` adicionado ao INSERT de notifications |
| notifications.team_id | `SET DEFAULT get_caller_team_id()` + `notifications_managers_all` sem `OR team_id IS NULL` |

**Por que RESTRICTIVE foi essencial**

Tabelas como `clients` e `sites` tinham policies antigas `auth.uid() IS NOT NULL` (any authenticated). Uma policy permissive adicional seria OR'd com essas, anulando o isolamento. `AS RESTRICTIVE` força um AND mandatório.

**Por que zero mudanças de frontend**

`DEFAULT get_caller_team_id()` é resolvido pelo Postgres no INSERT — qualquer `supabase.from('clients').insert({...})` recebe o `team_id` correto automaticamente.

### Verificações finais
- `npx tsc --noEmit` → EXIT:0
- `git status` → limpo (zero alterações frontend)
- Todas as 8 `team_isolation` policies verificadas no `pg_policies`

### Estado pós-sessão
- **Fases 0 + 1 NextIA 100% concluídas**
- Todas as 11 tabelas do domínio têm `team_id` e isolamento por policy
- Todas as 5 RPCs atualziadas com filtro cross-tenant
- Pendências: branding dinâmico (Fase 2) + `materials_media` PUBLIC (decisão) + storage paths
