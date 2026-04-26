import { useState, useEffect, useCallback, useRef } from 'react';
import {
  saveDraft,
  getDraft,
  deleteDraft,
  enqueue,
  savePendingBlobs,
  deletePendingBlobs,
  type ReportDraft,
  type SyncStatus,
} from '@/src/lib/reportIndexedDB';
import type { CreateServiceReportDTO, EvidenceFile, ReportChecklistItem } from '@/src/types/reports';

const AUTOSAVE_INTERVAL_MS = 30_000;

export interface UseReportDraftReturn {
  localDraftId: string;
  syncStatus: SyncStatus;
  isDirty: boolean;
  saveNow: (data: CreateServiceReportDTO, checklistAnswers?: Record<string, object>) => Promise<void>;
  submitDraft: (
    data: CreateServiceReportDTO,
    checklistAnswers: Record<string, Partial<ReportChecklistItem>>,
    attachments: EvidenceFile[],
    technicianSignature: string | null,
    clientSignature: string | null,
    clientSignerName: string,
  ) => Promise<void>;
  discardDraft: () => Promise<void>;
  loadDraft: (id: string) => Promise<ReportDraft | undefined>;
}

export function useReportDraft(existingLocalDraftId?: string): UseReportDraftReturn {
  const [localDraftId] = useState<string>(existingLocalDraftId ?? crypto.randomUUID());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [isDirty, setIsDirty] = useState(false);
  const latestData = useRef<CreateServiceReportDTO | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const saveNow = useCallback(async (data: CreateServiceReportDTO, checklistAnswers?: Record<string, object>) => {
    latestData.current = data;
    const draft: ReportDraft = {
      localDraftId,
      syncStatus: 'local',
      supabaseId: null,
      data,
      checklistAnswers,
      updatedAt: Date.now(),
      retries: 0,
      errorMessage: null,
    };
    await saveDraft(draft);
    setSyncStatus('local');
    setIsDirty(false);
  }, [localDraftId]);

  useEffect(() => {
    autosaveTimer.current = setInterval(async () => {
      if (latestData.current && isDirty) {
        await saveNow(latestData.current);
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => {
      if (autosaveTimer.current) clearInterval(autosaveTimer.current);
    };
  }, [saveNow, isDirty]);

  const markDirty = useCallback((data: CreateServiceReportDTO) => {
    latestData.current = data;
    setIsDirty(true);
  }, []);

  const submitDraft = useCallback(async (
    data: CreateServiceReportDTO,
    checklistAnswers: Record<string, Partial<ReportChecklistItem>>,
    attachments: EvidenceFile[],
    technicianSignature: string | null,
    clientSignature: string | null,
    clientSignerName: string,
  ) => {
    await saveNow(data, checklistAnswers as Record<string, object>);

    await savePendingBlobs({
      draftId: localDraftId,
      attachments: attachments.map(att => ({
        blob: att.file,
        name: att.file.name,
        type: att.file.type,
        caption: att.caption,
      })),
      technicianSignature,
      clientSignature,
      clientSignerName,
      checklistAnswers: checklistAnswers as Record<string, unknown>,
    });

    const existing = await getDraft(localDraftId);
    const type = existing?.supabaseId ? 'update' : 'create_full';
    await enqueue({ type, localDraftId, payload: data, retries: 0, createdAt: Date.now() });
    setSyncStatus('pending');
  }, [localDraftId, saveNow]);

  const discardDraft = useCallback(async () => {
    await deleteDraft(localDraftId);
    await deletePendingBlobs(localDraftId);
    setSyncStatus('local');
    setIsDirty(false);
    latestData.current = null;
  }, [localDraftId]);

  const loadDraft = useCallback(async (id: string) => {
    return getDraft(id);
  }, []);

  void markDirty;

  return { localDraftId, syncStatus, isDirty, saveNow, submitDraft, discardDraft, loadDraft };
}
