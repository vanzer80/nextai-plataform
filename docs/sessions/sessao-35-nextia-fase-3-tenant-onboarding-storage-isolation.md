# Sessão 35 — 06/05/2026 — NextIA Fase 3: tenant onboarding + storage isolation
**Commit:** `83b87e0` — `feat(nextia): Fase 3 — tenant onboarding + storage isolation`
**Arquivos criados:** `supabase/functions/admin-provision-tenant/index.ts`, `src/pages/admin/TenantManagement.tsx`
**Arquivos alterados:** `src/App.tsx`, `src/components/layout/AppLayout.tsx`, `src/lib/storage.ts`, `src/services/reportService.ts`, `src/services/offlineQueue.ts`, `src/hooks/useOfflineSync.ts`, `src/pages/reports/NewReport.tsx`, `src/pages/materials/NewMaterialRequest.tsx`, `src/pages/reimbursements/NewReimbursement.tsx`, `src/pages/materials/MaterialsList.tsx`
**Migrations aplicadas:** `nextia_fase3_tenants_rls`, `nextia_fase3_storage_rls`

### B — Tenant Onboarding (Master-only)

**Edge function `admin-provision-tenant`:**
- Apenas role=Master pode chamar
- Fluxo: valida slug único → INSERT tenants → createUser (service_role) → wait 2s → UPDATE users (role=Master, team_id)
- Rollback: se createUser falhar, DELETE tenants WHERE id = new_tenant_id
- Retorna `{ tenantId, userId, slug }`

**Página `/admin/tenants`:**
- Listagem com query `tenants + users!users_team_id_fkey(count)` — conta usuários por tenant
- Dialog "Novo Tenant" com 5 campos: nome, slug, cor primária (color picker + hex input), admin.full_name, admin.email, admin.password
- Validação Zod client-side: slug regex `/^[a-z][a-z0-9-]{2,49}$/`, senha ≥ 8 chars
- Toast diferenciado para `success` vs `warning` (tenant criado mas UPDATE falhou)

**Routing + Nav:**
- Rota `/admin/tenants` com `RoleGuard allowedRoles={['Master']}`
- Link "Tenants" na `NAV_LINKS` do AppLayout com `roles: ['Master']` + ícone `Globe`

**RLS tabela `tenants`:**
- Policy `tenants_master_select_all` (PERMISSIVE SELECT) → Master vê todos os tenants
- Convive com `tenants_select` existente (self-read via `get_caller_team_id()`)

### A — Storage Isolation

**Buckets após a sessão:**

| Bucket | Antes | Depois |
|--------|-------|--------|
| `materials_media` | PUBLIC | PRIVATE |
| `reimbursements_media` | PRIVATE | PRIVATE |
| `reports_media` | PRIVATE | PRIVATE |

**Políticas antigas removidas (todas permissivas sem team_id):**
`Publicar Recibos Autenticados`, `materials_media_delete/insert/select`, `reimbursements_media_delete/insert/select/update`, `reports_media_delete/insert/select`

**Políticas novas (5 por bucket = 15 total):**
- `{bucket}_team_select` — SELECT where `(foldername(name))[1] = team_id`
- `{bucket}_legacy_select` — SELECT transitional (relatórios: `IN ('attachments','signatures')`; materials/reimbursements: `= auth.uid()::text`)
- `{bucket}_team_insert` — INSERT WITH CHECK `[1] = team_id`
- `{bucket}_team_update` — UPDATE USING (team + legacy) WITH CHECK (team only)
- `{bucket}_team_delete` — DELETE USING (team + legacy)

**Upload paths namespaced:**

| Módulo | Path antigo | Path novo |
|--------|-------------|-----------|
| Relatórios — assinatura | `signatures/{reportId}/...` | `{teamId}/reports/{reportId}/signatures/...` |
| Relatórios — foto | `attachments/{reportId}/...` | `{teamId}/reports/{reportId}/attachments/...` |
| Compras | `{userId}/{ts}.ext` | `{teamId}/materials/{userId}/{ts}.ext` |
| Reembolsos | `{userId}/{rnd}_{ts}.ext` | `{teamId}/reimbursements/{userId}/{rnd}_{ts}.ext` |

**Signed URLs:**
- `MaterialsList.tsx` migrado: após fetch, resolve `foto_url` via `batchSignedUrls` + `extractStoragePath` (padrão idêntico ao `ReimbursementsList`)
- `useReportDetail.ts` já usava signed URLs (sem mudança)
- `ReimbursementsList.tsx` já usava signed URLs (sem mudança)

**Propagação de teamId:**
- `reportService.ts`: `teamId` adicionado a `SubmitReportPayload`; `uploadSignature` e `uploadAttachment` recebem `teamId`
- `offlineQueue.ts`: `processQueue(teamId)` e `processItem(item, teamId)` — `teamId` vem do caller (hook)
- `useOfflineSync.ts`: `await processQueue(tenant?.id ?? '')`
- `NewReport.tsx`: `useTenant()` → `tenant.id` → `submitReport({ ..., teamId: tenant?.id ?? '' })`

**Helper novo em `storage.ts`:**
```typescript
export function tenantPath(teamId: string, ...segments: string[]): string {
  return [teamId, ...segments].join('/');
}
```

### Fix pós-Sessão 35 — commit `e759cf5`
- **Bug:** `materials_media_legacy_select` e `reimbursements_media_legacy_select` só permitiam o próprio uploader (`auth.uid() = first_segment`) — Comprador/Gestor/Financeiro não conseguiam ver arquivos de outros usuários.
- **Fix:** Policy nova: `first_segment ~ UUID_regex AND first_segment != team_id_do_usuário` — qualquer autenticado acessa paths legados, mas novos uploads namespaced (`{teamId}/...`) continuam isolados por tenant.

### Pendências para Fase 4
- **Backfill storage legado:** paths antigos do Mopar (`signatures/...`, `attachments/...`, `{userId}/...`) precisam ser movidos para `{mopar_team_id}/legacy/...` via edge function (Storage `move()` — não pode ser feito só com SQL UPDATE pois o objeto S3 real não se move)
- Após backfill: remover policies `*_legacy_*` e `OLD` transitionals
- Melhorias opcionais: logo do tenant em bucket dedicado (PUBLIC), aplicação de `primary_color` no tema via CSS variable

### Verificações
- `npm run build` → ✅ zero erros TS
- Security advisors → nenhum warning novo (todos pré-existentes de Fases 0–2)
- `git push origin master` → `83b87e0`
