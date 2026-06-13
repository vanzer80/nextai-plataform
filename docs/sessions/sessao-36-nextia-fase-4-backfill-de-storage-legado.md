# Sessão 36 — 06/05/2026 — NextIA Fase 4: backfill de storage legado
**Commit:** `9ad6655` — `feat(nextia-f4): backfill de storage — move objetos legados para paths por tenant`
**Arquivos criados:** `supabase/functions/storage-backfill-mopar/index.ts`
**Arquivos alterados:** `src/pages/admin/TenantManagement.tsx`
**Migrations aplicadas:** `nextia_fase4_backfill_helpers`

### Escopo

43 objetos legados mapeados no Storage do Mopar (`e884160c-...`):
- `materials_media`: 5 objetos (`{userId}/...`)
- `reimbursements_media`: 16 objetos (`{userId}/...`)
- `reports_media`: 10 attachments (`attachments/{reportId}/...`) + 12 signatures (`signatures/{reportId}/...`)

### SQL — `nextia_fase4_backfill_helpers`

**`list_legacy_storage_objects(p_bucket, p_team_id)`** (SECURITY DEFINER):
- Retorna todos os objetos de `storage.objects` cujo primeiro segmento de path ≠ `p_team_id`
- Usada pelo edge function para listar o que precisa mover

**`backfill_storage_paths(p_team_id)`** (SECURITY DEFINER):
- Atualiza 4 colunas nas tabelas de app:

| Tabela | Coluna | Transformação |
|--------|--------|---------------|
| `material_requests` | `foto_url` | URL pública completa → `{teamId}/materials/{userId}/{file}` |
| `reimbursements` | `receipt_url` | `{userId}/{file}` → `{teamId}/reimbursements/{userId}/{file}` |
| `report_attachments` | `url` | `attachments/{reportId}/{file}` → `{teamId}/reports/{reportId}/attachments/{file}` |
| `report_signatures` | `image_url` | `signatures/{reportId}/{file}` → `{teamId}/reports/{reportId}/signatures/{file}` |

### Edge function `storage-backfill-mopar`

- Master-only (valida JWT do caller)
- Busca `team_id` do tenant `mopar` na tabela `tenants`
- Para cada bucket: chama `list_legacy_storage_objects`, move cada objeto com `storage.from(bucket).move(oldPath, newPath)`
- Path transforms:
  - `materials_media`: `{oldPath}` → `{teamId}/materials/{oldPath}`
  - `reimbursements_media`: `{oldPath}` → `{teamId}/reimbursements/{oldPath}`
  - `reports_media attachments`: `attachments/{reportId}/{file}` → `{teamId}/reports/{reportId}/attachments/{file}`
  - `reports_media signatures`: `signatures/{reportId}/{file}` → `{teamId}/reports/{reportId}/signatures/{file}`
- Chama `backfill_storage_paths(teamId)` após todos os moves
- Retorna `{ success, storage: { moved, failed, errors }, db: { ... counts }, summary: { totalMoved, totalFailed } }`

### UI — TenantManagement.tsx

- Seção de manutenção adicionada abaixo da tabela de tenants
- Botão "Executar Backfill" com confirmação inline (dois botões: "Sim, executar" / "Cancelar")
- Após execução: exibe resultado inline (`moved · failed · linhas DB`)
- Toast diferenciado: `success` (0 falhas) vs `warning` (falhas parciais)

### Finalização — migration `nextia_fase4_drop_legacy_policies`

Após backfill confirmado (43 movidos, 0 falhas, 17 linhas DB), removidas as 3 policies transitional:
- `reports_media_legacy_select`
- `materials_media_legacy_select`
- `reimbursements_media_legacy_select`

Policies restantes em storage: apenas `{bucket}_team_{select/insert/update/delete}` — 12 total, 4 por bucket. Isolamento total entre tenants concluído.

### Verificações
- `npm run build` → ✅ zero erros TS
- Backfill: 43 objetos movidos · 0 falhas · 17 linhas DB atualizadas
- Storage policies: 12 restantes (4 × 3 buckets), nenhuma `_legacy_`
- `git push origin master` → `9ad6655`
