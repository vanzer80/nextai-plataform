import { useState, useEffect, useCallback, useRef } from 'react';
import { processQueue } from '@/src/services/offlineQueue';
import { getQueueSize } from '@/src/lib/reportIndexedDB';

export interface OfflineSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  triggerSync: () => Promise<void>;
}

export function useOfflineSync(): OfflineSyncState {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const syncInProgress = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await getQueueSize();
    setPendingCount(count);
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncInProgress.current || !navigator.onLine) return;

    syncInProgress.current = true;
    setIsSyncing(true);

    try {
      await processQueue();
      setLastSyncAt(new Date());
    } finally {
      syncInProgress.current = false;
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  // Listener de conectividade
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Conta inicial de itens pendentes
    refreshPendingCount();

    // Se já estiver online na montagem, tenta sync
    if (navigator.onLine) triggerSync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync, refreshPendingCount]);

  return { isOnline, isSyncing, pendingCount, lastSyncAt, triggerSync };
}
