import { useState, useEffect, useCallback, useRef } from 'react';
import { processQueue } from '@/src/services/offlineQueue';
import { getQueueSize, initDBName } from '@/src/lib/reportIndexedDB';
import { useTenant } from '@/src/contexts/TenantContext';

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
  const { tenant } = useTenant();

  useEffect(() => {
    if (tenant?.slug) initDBName(tenant.slug);
  }, [tenant?.slug]);

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

    // Aguarda 5s antes do primeiro sync para não competir com a carga inicial do Dashboard
    const initialSyncTimer = setTimeout(() => {
      if (navigator.onLine) triggerSync();
    }, 5000);

    return () => {
      clearTimeout(initialSyncTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync, refreshPendingCount]);

  return { isOnline, isSyncing, pendingCount, lastSyncAt, triggerSync };
}
