import { useState, useEffect, useCallback, useRef } from 'react';
import {
  saveDraft,
  getDraft,
  deleteDraft,
  enqueue,
  type ReportDraft,
  type SyncStatus,
} from '@/src/lib/reportIndexedDB';
import type { CreateServiceReportDTO } from '@/src/types/reports';

const AUTOSAVE_INTERVAL_MS = 30_000;

export interface UseReportDraftReturn {
  localDraftId: string;
  syncStatus: SyncStatus;
  isDirty: boolean;
  saveNow: (data: CreateServiceReportDTO, checklistAnswers?: Record<string, object>) => Promise<void>;
  submitDraft: (data: CreateServiceReportDTO) => Promise<void>;
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

  // Autosave a cada 30s se houver dados
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

  // Registra dados alterados (chamado pelo form ao mudar)
  const markDirty = useCallback((data: CreateServiceReportDTO) => {
    latestData.current = data;
    setIsDirty(true);
  }, []);

  // Submete o relatório: salva localmente e enfileira para sync
  const submitDraft = useCallback(async (data: CreateServiceReportDTO) => {
    await saveNow(data);
    const existing = await getDraft(localDraftId);
    const type = existing?.supabaseId ? 'update' : 'create';
    const payload = type === 'update'
      ? { supabaseId: existing!.supabaseId, ...data }
      : data;

    await enqueue({ type, localDraftId, payload, retries: 0, createdAt: Date.now() });
    setSyncStatus('pending');
  }, [localDraftId, saveNow]);

  const discardDraft = useCallback(async () => {
    await deleteDraft(localDraftId);
    setSyncStatus('local');
    setIsDirty(false);
    latestData.current = null;
  }, [localDraftId]);

  const loadDraft = useCallback(async (id: string) => {
    return getDraft(id);
  }, []);

  // Expõe markDirty via efeito colateral — o componente chama saveNow diretamente
  // quando o usuário clica em "salvar" ou o autosave dispara.
  void markDirty;

  return { localDraftId, syncStatus, isDirty, saveNow, submitDraft, discardDraft, loadDraft };
}
