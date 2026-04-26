import { openDB, IDBPDatabase } from 'idb';
import type { CreateServiceReportDTO } from '@/src/types/reports';

// ── Tipos dos stores ──────────────────────────────────────────

export type SyncStatus = 'local' | 'pending' | 'syncing' | 'synced' | 'error' | 'conflicted';

export interface ReportDraft {
  localDraftId: string;         // UUID gerado no cliente
  syncStatus: SyncStatus;
  supabaseId: string | null;    // preenchido após primeiro sync
  data: CreateServiceReportDTO;
  checklistAnswers?: Record<string, object>;
  updatedAt: number;            // timestamp ms
  retries: number;
  errorMessage: string | null;
}

export type QueueItemType = 'create' | 'update' | 'uploadAttachment';

export interface QueueItem {
  id?: number;                  // autoincrement
  type: QueueItemType;
  localDraftId: string;
  payload: unknown;
  retries: number;
  createdAt: number;
}

export interface CachedReport {
  supabaseId: string;
  data: unknown;
  cachedAt: number;
}

// ── Schema do banco ───────────────────────────────────────────

const DB_NAME = 'portal-mopar-reports';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('reportDrafts')) {
          db.createObjectStore('reportDrafts', { keyPath: 'localDraftId' });
        }
        if (!db.objectStoreNames.contains('offlineSyncQueue')) {
          db.createObjectStore('offlineSyncQueue', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('cachedReports')) {
          db.createObjectStore('cachedReports', { keyPath: 'supabaseId' });
        }
      },
    });
  }
  return dbPromise;
}

// ── reportDrafts ──────────────────────────────────────────────

export async function saveDraft(draft: ReportDraft): Promise<void> {
  const db = await getDB();
  await db.put('reportDrafts', { ...draft, updatedAt: Date.now() });
}

export async function getDraft(localDraftId: string): Promise<ReportDraft | undefined> {
  const db = await getDB();
  return db.get('reportDrafts', localDraftId);
}

export async function getAllDrafts(): Promise<ReportDraft[]> {
  const db = await getDB();
  return db.getAll('reportDrafts');
}

export async function deleteDraft(localDraftId: string): Promise<void> {
  const db = await getDB();
  await db.delete('reportDrafts', localDraftId);
}

export async function updateDraftStatus(
  localDraftId: string,
  syncStatus: SyncStatus,
  supabaseId?: string,
  errorMessage?: string,
): Promise<void> {
  const db = await getDB();
  const draft = await db.get('reportDrafts', localDraftId);
  if (!draft) return;
  await db.put('reportDrafts', {
    ...draft,
    syncStatus,
    supabaseId: supabaseId ?? draft.supabaseId,
    errorMessage: errorMessage ?? null,
    updatedAt: Date.now(),
  });
}

// ── offlineSyncQueue ──────────────────────────────────────────

export async function enqueue(item: Omit<QueueItem, 'id'>): Promise<void> {
  const db = await getDB();
  await db.add('offlineSyncQueue', { ...item, createdAt: Date.now() });
}

export async function peekQueue(): Promise<QueueItem | undefined> {
  const db = await getDB();
  const all = await db.getAll('offlineSyncQueue');
  // FIFO: menor id primeiro
  return all.sort((a, b) => (a.id ?? 0) - (b.id ?? 0))[0];
}

export async function getAllQueueItems(): Promise<QueueItem[]> {
  const db = await getDB();
  const all = await db.getAll('offlineSyncQueue');
  return all.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function dequeue(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('offlineSyncQueue', id);
}

export async function incrementRetry(id: number): Promise<void> {
  const db = await getDB();
  const item = await db.get('offlineSyncQueue', id);
  if (!item) return;
  await db.put('offlineSyncQueue', { ...item, retries: item.retries + 1 });
}

export async function getQueueSize(): Promise<number> {
  const db = await getDB();
  return db.count('offlineSyncQueue');
}

// ── cachedReports ─────────────────────────────────────────────

export async function cacheReport(supabaseId: string, data: unknown): Promise<void> {
  const db = await getDB();
  await db.put('cachedReports', { supabaseId, data, cachedAt: Date.now() });
}

export async function getCachedReport(supabaseId: string): Promise<CachedReport | undefined> {
  const db = await getDB();
  return db.get('cachedReports', supabaseId);
}

export async function getAllCachedReports(): Promise<CachedReport[]> {
  const db = await getDB();
  return db.getAll('cachedReports');
}

export async function removeCachedReport(supabaseId: string): Promise<void> {
  const db = await getDB();
  await db.delete('cachedReports', supabaseId);
}
