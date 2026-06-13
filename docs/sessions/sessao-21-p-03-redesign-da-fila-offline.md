# Sessão 21 — 26/04/2026 — P-03: Redesign da Fila Offline

### O que foi executado

**Branch:** `feature/offline-queue-redesign` → merge em `master`
**Commit:** `90b74ba`

**Problema resolvido:**
A fila offline (`offlineQueue.ts`) fazia `.insert()` direto na tabela `service_reports` — bypassando completamente a RPC `submit_report`. Resultado: relatórios criados sem internet chegavam sem fotos, checklist e assinatura. O toast anterior até avisava "Fotos e assinatura precisam ser adicionadas após reconectar".

**Arquitetura implementada:**

| Arquivo | Mudança |
|---|---|
| `reportIndexedDB.ts` | DB_VERSION 1→2; novo store `pendingBlobs` (keyPath: `draftId`); tipos `StoredBlob` e `PendingBlob`; CRUD: `savePendingBlobs`, `getPendingBlobs`, `deletePendingBlobs`; migração incremental via `oldVersion` |
| `offlineQueue.ts` | Novo tipo `create_full` em `QueueItemType`; `processItem` reconstrói `File[]` de `Blob[]` do IndexedDB e chama `submitReport` RPC (upload paralelo + transação atômica); paths `create`/`update` mantidos para retrocompatibilidade |
| `useReportDraft.ts` | `submitDraft` agora recebe `checklistAnswers`, `attachments: EvidenceFile[]`, `technicianSignature`, `clientSignature`, `clientSignerName`; salva tudo em `pendingBlobs` antes de enfileirar como `create_full`; `discardDraft` limpa `pendingBlobs` também |
| `NewReport.tsx` | Fallback offline passa todos os dados ao `submitDraft`; toast atualizado: "Fotos, checklist e assinatura incluídos" |
| `AppLayout.tsx` | `useOfflineSync` wired; badge âmbar com `pendingCount` no link "Relatórios" quando fila > 0 |

**Fluxo completo offline→online:**
1. Técnico preenche relatório offline → clica Enviar → `submitReport` falha (sem rede)
2. `submitDraft` salva `ReportDraft` (texto) + `PendingBlob` (File[], assinaturas, checklist) no IndexedDB
3. Item `create_full` entra na `offlineSyncQueue`
4. Badge âmbar aparece em "Relatórios" na sidebar
5. Ao reconectar → `useOfflineSync` detecta `online` → `processQueue()` → `processItem` type=`create_full`
6. Reconstrói `File[]` de `Blob[]`, chama `submitReport` RPC → upload Storage + transação DB
7. Draft marcado `synced`, blobs limpos, badge some

**IndexedDB migration:**
- `upgrade(db, oldVersion)` com cases por versão — store `pendingBlobs` só criado quando `oldVersion < 2`
- Usuários com DB versão 1 fazem upgrade automático na próxima abertura

### Próximos passos
- **Sprint 12**: Notificações externas (Resend email + Evolution API WhatsApp)
