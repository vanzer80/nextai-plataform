import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
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

async function signedUrls(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data } = await supabase.storage
    .from('reports_media')
    .createSignedUrls(paths, 3600);
  return (data ?? []).map(d => d.signedUrl ?? '');
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
        const [reportRes, historyRes, attachmentsRes, signaturesRes, checklistRes] =
          await Promise.all([
            supabase
              .from('service_reports')
              .select('*, clients(name), users(full_name), equipments(name)')
              .eq('id', id)
              .single(),
            supabase
              .from('report_status_history')
              .select('*')
              .eq('report_id', id)
              .order('created_at', { ascending: true }),
            supabase
              .from('report_attachments')
              .select('*')
              .eq('report_id', id),
            supabase
              .from('report_signatures')
              .select('*')
              .eq('report_id', id),
            supabase
              .from('report_checklist_items')
              .select('*')
              .eq('report_id', id)
              .order('created_at', { ascending: true }),
          ]);

        if (cancelled) return;
        if (reportRes.error) throw reportRes.error;

        const rawAttachments = (attachmentsRes.data ?? []) as ReportAttachment[];
        const rawSignatures = (signaturesRes.data ?? []) as ReportSignature[];

        // Generate signed URLs in parallel
        const [attUrls, sigUrls] = await Promise.all([
          signedUrls(rawAttachments.map(a => a.url)),
          signedUrls(rawSignatures.map(s => s.image_url)),
        ]);

        if (cancelled) return;

        setReport(reportRes.data as ServiceReport);
        setHistory((historyRes.data ?? []) as ReportStatusHistory[]);
        setAttachments(rawAttachments.map((a, i) => ({ ...a, url: attUrls[i] || a.url })));
        setSignatures(rawSignatures.map((s, i) => ({ ...s, image_url: sigUrls[i] || s.image_url })));
        setChecklistItems((checklistRes.data ?? []) as ReportChecklistItem[]);
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
