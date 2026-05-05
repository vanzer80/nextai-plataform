import { openDB, IDBPDatabase } from 'idb';
import type { CreateServiceReportDTO } from '@/src/types/reports';

// ── Tipos dos stores ──────────────────────────────────────────

export type SyncStatus = 'local' | 'pending' | 'syncing' | 'synced' | 'error' | 'conflicted';

export interface ReportDraft {
  localDraftId: string;
  syncStatus: SyncStatus;
  supabaseId: string | null;
  data: CreateServiceReportDTO;
  checklistAnswers?: Record<string, object>;
  updatedAt: number;
  retries: number;
  errorMessage: string | null;
}

export type QueueItemType = 'create' | 'update' | 'uploadAttachment' | 'create_full';

export interface QueueItem {
  id?: number;
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

export interface StoredBlob {
  blob: Blob;
  name: string;
  type: string;
  caption: string;
}

// Blobs e metadados salvos offline para submissão completa via RPC
export interface PendingBlob {
  draftId: string;
  attachments: StoredBlob[];
  technicianSignature: string | null;
  clientSignature: string | null;
  clientSignerName: string;
  checklistAnswers: Record<string, unknown>;
}

// ── Schema do banco ───────────────────────────────────────────

const DB_VERSION = 2;

let dbName = 'portal-mopar-reports';
let dbPromise: Promise<IDBPDatabase> | null = null;

export function initDBName(tenantSlug: string): void {
  const newName = `${tenantSlug}-reports`;
  if (newName !== dbName) {
    dbName = newName;
    dbPromise = null;
  }
}

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(dbName, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('reportDrafts', { keyPath: 'localDraftId' });
          db.createObjectStore('offlineSyncQueue', { keyPath: 'id', autoIncrement: true });
          db.createObjectStore('cachedReports', { keyPath: 'supabaseId' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('pendingBlobs', { keyPath: 'draftId' });
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

// ── pendingBlobs ──────────────────────────────────────────────

export async function savePendingBlobs(entry: PendingBlob): Promise<void> {
  const db = await getDB();
  await db.put('pendingBlobs', entry);
}

export async function getPendingBlobs(draftId: string): Promise<PendingBlob | undefined> {
  const db = await getDB();
  return db.get('pendingBlobs', draftId);
}

export async function deletePendingBlobs(draftId: string): Promise<void> {
  const db = await getDB();
  await db.delete('pendingBlobs', draftId);
}
