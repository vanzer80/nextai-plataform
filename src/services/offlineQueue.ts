import { supabase } from '@/src/lib/supabase';
import { generateUUID } from '@/src/lib/uuid';
import {
  getAllQueueItems,
  dequeue,
  incrementRetry,
  updateDraftStatus,
  cacheReport,
  getDraft,
  getPendingBlobs,
  deletePendingBlobs,
  type QueueItem,
} from '@/src/lib/reportIndexedDB';
import { submitReport, type SubmitReportPayload } from '@/src/services/reportService';
import type { EvidenceFile } from '@/src/types/reports';

const MAX_RETRIES = 3;

async function processItem(item: QueueItem, teamId: string): Promise<boolean> {
  try {
    if (item.type === 'create_full') {
      const draft = await getDraft(item.localDraftId);
      if (!draft) throw new Error('Rascunho não encontrado');
      const blobs = await getPendingBlobs(item.localDraftId);

      const attachments: EvidenceFile[] = (blobs?.attachments ?? []).map(att => ({
        id: generateUUID(),
        file: new File([att.blob], att.name, { type: att.type }),
        preview: '',
        caption: att.caption,
      }));

      const reportId = await submitReport({
        formValues: draft.data as unknown as SubmitReportPayload['formValues'],
        technicianId: draft.data.technician_id,
        teamId,
        localDraftId: item.localDraftId,
        checklistAnswers: (blobs?.checklistAnswers ?? {}) as SubmitReportPayload['checklistAnswers'],
        attachments,
        technicianSignature: blobs?.technicianSignature ?? null,
        clientSignature: blobs?.clientSignature ?? null,
        clientSignerName: blobs?.clientSignerName ?? '',
      });

      await updateDraftStatus(item.localDraftId, 'synced', reportId);
      await deletePendingBlobs(item.localDraftId);
      return true;
    }

    // Legacy path — mantido para itens 'create' já na fila antes do P-03
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

export async function processQueue(teamId: string): Promise<{ processed: number; failed: number }> {
  const items = await getAllQueueItems();
  let processed = 0;
  let failed = 0;

  for (const item of items) {
    if (item.retries >= MAX_RETRIES) {
      await updateDraftStatus(item.localDraftId, 'error', undefined, 'Máximo de tentativas atingido');
      await dequeue(item.id!);
      failed++;
      continue;
    }

    await updateDraftStatus(item.localDraftId, 'syncing');
    const success = await processItem(item, teamId);

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
