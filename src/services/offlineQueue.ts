import { supabase } from '@/src/lib/supabase';
import {
  getAllQueueItems,
  dequeue,
  incrementRetry,
  updateDraftStatus,
  cacheReport,
  type QueueItem,
} from '@/src/lib/reportIndexedDB';

const MAX_RETRIES = 3;

// Processa um item da fila. Retorna true se processado com sucesso.
async function processItem(item: QueueItem): Promise<boolean> {
  try {
    if (item.type === 'create') {
      const payload = item.payload as Record<string, unknown>;
      const { data, error } = await supabase
        .from('service_reports')
        .insert(payload)
        .select('id, updated_at')
        .single();

      if (error) throw error;

      await updateDraftStatus(item.localDraftId, 'synced', data.id);
      await cacheReport(data.id, { ...payload, id: data.id, updated_at: data.updated_at });
      return true;
    }

    if (item.type === 'update') {
      const { supabaseId, ...payload } = item.payload as Record<string, unknown>;
      const { data, error } = await supabase
        .from('service_reports')
        .update(payload)
        .eq('id', supabaseId)
        .select('id, updated_at')
        .single();

      if (error) throw error;

      await updateDraftStatus(item.localDraftId, 'synced', String(supabaseId));
      await cacheReport(String(supabaseId), { ...payload, id: supabaseId, updated_at: data.updated_at });
      return true;
    }

    return false;
  } catch (err) {
    console.error('[offlineQueue] erro ao processar item', item.id, err);
    return false;
  }
}

// Processa toda a fila FIFO. Para no primeiro erro permanente (3 retries).
export async function processQueue(): Promise<{ processed: number; failed: number }> {
  const items = await getAllQueueItems();
  let processed = 0;
  let failed = 0;

  for (const item of items) {
    if (item.retries >= MAX_RETRIES) {
      // Marca como erro permanente e remove da fila para não bloquear
      await updateDraftStatus(item.localDraftId, 'error', undefined, 'Máximo de tentativas atingido');
      await dequeue(item.id!);
      failed++;
      continue;
    }

    await updateDraftStatus(item.localDraftId, 'syncing');
    const success = await processItem(item);

    if (success) {
      await dequeue(item.id!);
      processed++;
    } else {
      await incrementRetry(item.id!);
      await updateDraftStatus(item.localDraftId, 'pending', undefined, 'Falha temporária, tentando novamente');
      failed++;
    }
  }

  return { processed, failed };
}
