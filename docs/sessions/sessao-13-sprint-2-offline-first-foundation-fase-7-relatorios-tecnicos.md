# Sessão 13 — 21/04/2026 — Sprint 2: Offline-First Foundation (Fase 7 — Relatórios Técnicos)

### O que foi executado

**Pacote instalado:** `idb` (~2KB, wrapper tipado do IndexedDB)

**`src/lib/reportIndexedDB.ts`** — Inicialização e CRUD dos 3 stores:
- `reportDrafts` (keyPath: `localDraftId`) — rascunhos locais com `syncStatus`, `supabaseId`, `data`, `retries`
- `offlineSyncQueue` (autoIncrement) — ações pendentes `create | update | uploadAttachment`
- `cachedReports` (keyPath: `supabaseId`) — cache de relatórios sincronizados

Funções exportadas: `saveDraft`, `getDraft`, `getAllDrafts`, `deleteDraft`, `updateDraftStatus`, `enqueue`, `peekQueue`, `getAllQueueItems`, `dequeue`, `incrementRetry`, `getQueueSize`, `cacheReport`, `getCachedReport`, `getAllCachedReports`, `removeCachedReport`

**`src/services/offlineQueue.ts`** — Processador FIFO:
- Processa items em ordem de `id` (FIFO)
- `create` → `supabase.from('service_reports').insert()`
- `update` → `supabase.from('service_reports').update()`
- Sucesso → `dequeue` + `updateDraftStatus('synced')` + `cacheReport`
- Falha → `incrementRetry` + `updateDraftStatus('pending')`
- Após 3 retries → `updateDraftStatus('error')` + `dequeue` (não bloqueia a fila)

**`src/hooks/useOfflineSync.ts`** — Listener de conectividade:
- Escuta `window.addEventListener('online'/'offline')`
- Ao reconectar: chama `processQueue()` automaticamente
- Expõe: `isOnline`, `isSyncing`, `pendingCount`, `lastSyncAt`, `triggerSync()`
- Guard `syncInProgress` (ref) evita execuções paralelas

**`src/hooks/useReportDraft.ts`** — Autosave e ciclo de vida do draft:
- `localDraftId` gerado via `crypto.randomUUID()` (nativo, sem dependência `uuid`)
- Autosave a cada 30s quando `isDirty = true`
- `saveNow(data)` → salva imediatamente no IndexedDB
- `submitDraft(data)` → salva + enfileira na `offlineSyncQueue` (tipo `create` ou `update` dependendo de `supabaseId`)
- `discardDraft()` → remove do IndexedDB

**`src/pages/reports/components/SyncStatusIndicator.tsx`** — Badge visual:
- 6 estados: `local` (slate), `pending` (amber), `syncing` (blue + spin), `synced` (emerald), `error` (rose), `conflicted` (orange)
- Ícones Lucide correspondentes a cada estado

### Problema corrigido

`React.ReactNode` usado sem import → `Cannot find namespace 'React'` → corrigido com `import type { ReactNode } from 'react'`

### Build verificado

10 erros pré-existentes (withTimeout + ReimbursementCardProps). Nenhum erro novo nos arquivos da Sprint 2.

### Sprint 2 — Status: ✅ Concluída
