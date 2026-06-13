# Sessão 32 — 04/05/2026 — NextIA Fase 0: conclusão (handle_new_user + admin-create-user v4 + notifications.team_id)
**Commit:** `16306e0` — `feat(multi-tenant): admin-create-user v4 propaga team_id do caller ao novo usuario`
**DB changes (via MCP):** `handle_new_user` substituído + `notifications.team_id` coluna + backfill 22 rows + policy `notifications_managers_all` recriada + `tenants_select` policy

### O que foi executado

**Revisão crítica do diagnóstico NextIA**

Antes de executar, foi feita auditoria completa do diagnóstico anterior (Sessão 31 / `15 - NextIA White-Label Diagnóstico.md`). Inacurácias encontradas e corrigidas:
- `service_report_photos` → nome real: `report_attachments`
- Faltavam 5 tabelas: `sites`, `client_locations`, `report_checklist_items`, `report_signatures`, `report_status_history`
- "Bucket único" errado → 3 buckets: `reports_media`, `reimbursements_media`, `materials_media`
- `UserManagement.tsx:208` com "Mopar Engenharia" errado → tem placeholder `joao@mopar.com`

**Fase 0 — execução completa**

| # | Item | Resultado |
|---|---|---|
| 1 | `tenants_select` policy | ✅ `CREATE POLICY "tenants_select" ON public.tenants FOR SELECT TO authenticated USING (id = get_caller_team_id())` |
| 2 | `handle_new_user` trigger | ✅ Substituído — role sempre `'Tecnico'` (removido read de `raw_user_meta_data` — era user-editable, risco de escalada), team_id de metadata (opcional), `ON CONFLICT (id) DO NOTHING` adicionado |
| 3 | `admin-create-user` Edge Function v4 | ✅ Deployed — `.select("role, team_id")` no perfil do caller; UPDATE inclui `team_id: profile.team_id ?? null`; body aceita `team_id?` (ignorado — usa sempre o do caller para evitar escalada cross-tenant) |
| 4 | `notifications.team_id` coluna | ✅ `ALTER TABLE notifications ADD COLUMN team_id UUID REFERENCES tenants(id) ON DELETE SET NULL` |
| 5 | Backfill notifications | ✅ 22/22 rows — `UPDATE notifications n SET team_id = u.team_id FROM users u WHERE n.user_id = u.id` |
| 6 | `notifications_managers_all` policy | ✅ DROP + CREATE com `(team_id = get_caller_team_id() OR team_id IS NULL)` — `OR NULL` transitional porque RPCs `process_report_action` e `process_reimbursement_action` (SECURITY DEFINER) criam notificações sem team_id; será removido na Fase 1 |

**Segurança: armadilha `raw_user_meta_data`**

`handle_new_user` anterior lia `role` de `raw_user_meta_data` — campo editável pelo próprio usuário via `supabase.auth.updateUser()`. Qualquer usuário podia se promover a `Admin` no signup. Corrigido: role hardcoded `'Tecnico'`; Edge Function sobrescreve via `service_role` UPDATE.

**Storage audit (read-only)**

| Bucket | Público | Risco |
|--------|---------|-------|
| `reports_media` | Não | SELECT policy filtra só por `bucket_id` — sem team_id (Fase 1) |
| `reimbursements_media` | Não | Idem |
| `materials_media` | **Sim** | URL pública acessível sem autenticação — **decisão pendente** |

Decisão sobre `materials_media` adiada para Fase 1.

### Verificações finais
- `npx tsc --noEmit` → EXIT:0
- `git status` → apenas `admin-create-user/index.ts` modificado

### Estado pós-sessão
- Banco: **Fase 0 NextIA 100% concluída**
- `notifications_managers_all` usa `OR team_id IS NULL` transitional (será removido na Fase 1)
- Próxima sessão: Fase 1 — ADD COLUMN `team_id` em 9 tabelas + backfill + policies + 4 RPCs
- Pendência: decisão sobre `materials_media` PUBLIC
