import { useState, useEffect } from 'react';
import { fetchReportDetail } from '@/src/services/reportService';
import type {
  ServiceReport,
  ReportStatusHistory,
  ReportAttachment,
  ReportSignature,
  ReportChecklistItem,
} from '@/src/types/reports';

export interface ReportDetailData {
  report: ServiceReport | null;
  history: ReportStatusHistory[];
  attachments: ReportAttachment[];
  signatures: ReportSignature[];
  checklistItems: ReportChecklistItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useReportDetail(id: string | undefined): ReportDetailData {
  const [report, setReport] = useState<ServiceReport | null>(null);
  const [history, setHistory] = useState<ReportStatusHistory[]>([]);
  const [attachments, setAttachments] = useState<ReportAttachment[]>([]);
  const [signatures, setSignatures] = useState<ReportSignature[]>([]);
  const [checklistItems, setChecklistItems] = useState<ReportChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = () => setTick(t => t + 1);

  // Auto-refresh signed URLs every 50 minutes (TTL is 60 min)
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => setTick(t => t + 1), 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchReportDetail(id!);
        if (cancelled) return;
        setReport(result.report);
        setHistory(result.history);
        setAttachments(result.attachments);
        setSignatures(result.signatures);
        setChecklistItems(result.checklistItems);
      } catch (err) {
        if (!cancelled) {
          setError('Erro ao carregar o relatório.');
          console.error('[useReportDetail]', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id, tick]);

  return { report, history, attachments, signatures, checklistItems, loading, error, refresh };
}
