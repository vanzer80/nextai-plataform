# Sessão 45 — 17/05/2026 — Auditoria de Segurança: Isolamento Multi-Tenant (Cross-Tenant)

**Commit:** `1cc7b74` — "sec: corrige isolamento cross-tenant em 10 tabelas + Edge Function + frontend"

### Contexto

Descoberta crítica: Admin/Master de uma empresa conseguia visualizar usuários e dados de outras empresas. A plataforma é um SaaS multi-tenant onde cada tenant (empresa) deve ver APENAS seus próprios dados. Foram encontradas 8 vulnerabilidades de isolamento cross-tenant.

---

### Auditoria — 8 vulnerabilidades encontradas e corrigidas

| # | ID | Gravidade | Componente | Vulnerabilidade | Correção |
|---|---|---|---|---|---|
| 1 | V-01 | 🔴 Crítico | `users` table | Sem policy RESTRICTIVE `team_isolation` → Admin via `eq('team_id', X)` era contornável | Policy RESTRICTIVE criada com `get_caller_team_id()` |
| 2 | V-02 | 🔴 Crítico | `reimbursement_history` table | Sem RESTRICTIVE → histórico de outros tenants visível via JOIN | RESTRICTIVE via EXISTS JOIN `reimbursements.team_id` |
| 3 | V-03 | 🔴 Crítico | `client_locations` table | Policy `_select` era `auth.uid() IS NOT NULL` (sem filtro de tenant) | Policy recriada com EXISTS JOIN `clients.team_id` + RESTRICTIVE |
| 4 | V-04 | 🟠 Alto | `orcamento_itens` table | Tabela filha sem RESTRICTIVE → itens de orçamentos de outros tenants visíveis | RESTRICTIVE via EXISTS JOIN `orcamentos.team_id` |
| 5 | V-05 | 🟠 Alto | `report_attachments` table | Tabela filha sem RESTRICTIVE | RESTRICTIVE via EXISTS JOIN `service_reports.team_id` |
| 6 | V-06 | 🟠 Alto | `report_checklist_items` table | Tabela filha sem RESTRICTIVE | RESTRICTIVE via EXISTS JOIN `service_reports.team_id` |
| 7 | V-07 | 🟠 Alto | `report_signatures` + `report_status_history` + `notifications` | Sem RESTRICTIVE | RESTRICTIVE criadas (team_id direto ou via JOIN) |
| 8 | V-08 | 🔴 Crítico | `UserManagement.tsx` + `admin-delete-user` EF | Frontend sem `.eq('team_id')` — listava todos usuários. EF v2 não validava `team_id` do alvo. | Frontend: `.eq('team_id', currentUser.team_id)`. EF: v3 com cross-tenant guard + SuperMaster exception |

---

### Migrações aplicadas

**`sec_multitenant_rls_critical_v01_v04`** — V-01 a V-04:
```sql
-- V-01: users
CREATE POLICY "team_isolation" ON public.users AS RESTRICTIVE FOR ALL TO authenticated
  USING (team_id = get_caller_team_id());

-- V-02: reimbursement_history
CREATE POLICY "team_isolation" ON public.reimbursement_history AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM reimbursements r WHERE r.id = reimbursement_id AND r.team_id = get_caller_team_id()));

-- V-03: client_locations (drop + recreate)
DROP POLICY "client_locations_select" ON public.client_locations;
CREATE POLICY "client_locations_team_isolation" ON public.client_locations AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM clients c WHERE c.id = client_id AND c.team_id = get_caller_team_id()));

-- V-04: orcamento_itens
CREATE POLICY "team_isolation" ON public.orcamento_itens AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM orcamentos o WHERE o.id = orcamento_id AND o.team_id = get_caller_team_id()));
```

**`sec_multitenant_rls_defense_depth_v05_v07`** — V-05 a V-07:
```sql
-- report_attachments, report_checklist_items, report_signatures, report_status_history
-- via EXISTS JOIN service_reports.team_id
-- notifications: team_id = get_caller_team_id() direto
```

---

### Edge Function admin-delete-user v3 (V-08b)

Nova lógica de segurança adicionada:
1. Busca `role, team_id` do caller (v2 buscava só `role`)
2. Busca `team_id, role` do usuário alvo via service_role
3. Verifica se caller é SuperMaster (`role='Master'` + `tenants.is_platform=true`)
4. Bloqueia deleção cross-tenant se não for SuperMaster → HTTP 403

```typescript
const isSuperMaster = callerProfile.role === "Master" && callerTenant?.is_platform === true;
if (!isSuperMaster && targetProfile.team_id !== callerProfile.team_id) {
  return new Response(JSON.stringify({ error: "Permissao negada. Usuario pertence a outro tenant." }), { status: 403 });
}
```

---

### Validação pós-correção (RLS simulation)

```sql
-- Simulação: SET LOCAL ROLE authenticated + set_config('request.jwt.claims', ...)
-- Resultado:
-- Master Mopar    → 7 usuários (apenas mopar) ✅
-- Master Zambrano → 1 usuário  (apenas zamb-eng) ✅
-- SuperMaster NextAI → 1 usuário (apenas nextai) ✅
-- Reembolsos: 17 rows, tenants_visiveis = 1 ✅
```

Todas as 19 tabelas públicas com dados sensíveis possuem policy RESTRICTIVE `team_isolation`.
