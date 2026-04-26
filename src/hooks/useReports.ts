import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import { getAllCachedReports } from '@/src/lib/reportIndexedDB';
import type { ServiceReport, ReportStatus } from '@/src/types/reports';

export interface ReportsFilter {
  status?: ReportStatus | '';
  dateFrom?: string;
  dateTo?: string;
  technicianId?: string;
}

const PAGE_SIZE = 20;

export function useReports(filter: ReportsFilter = {}) {
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const fetchReports = useCallback(async (pageIndex: number) => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('service_reports')
        .select(`
          id, created_at, updated_at, status, service_type, os_number,
          service_date, site_location, technician_id, client_id, asset_id,
          reported_problem, final_diagnosis, local_draft_id, last_synced_at,
          clients(name), users:technician_id(full_name), equipments:asset_id(name)
        `)
        .order('created_at', { ascending: false })
        .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);

      if (filter.status) query = query.eq('status', filter.status);
      if (filter.dateFrom) query = query.gte('service_date', filter.dateFrom);
      if (filter.dateTo) query = query.lte('service_date', filter.dateTo);
      if (filter.technicianId) query = query.eq('technician_id', filter.technicianId);

      const { data, error: err } = await query;
      if (err) throw err;

      const rows = (data ?? []) as ServiceReport[];
      setReports(prev => pageIndex === 0 ? rows : [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err: unknown) {
      console.warn('[useReports] Supabase falhou, usando cache IndexedDB');
      const cached = await getAllCachedReports();
      setReports(cached.map(c => c.data) as ServiceReport[]);
      setError('Exibindo dados em cache — verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }, [filter.status, filter.dateFrom, filter.dateTo, filter.technicianId]); // eslint-disable-line

  useEffect(() => {
    setPage(0);
    fetchReports(0);
  }, [fetchReports]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchReports(next);
  }, [page, fetchReports]);

  const refresh = useCallback(() => {
    setPage(0);
    fetchReports(0);
  }, [fetchReports]);

  // Atualiza um item específico na lista (usado pelo Realtime)
  const updateItem = useCallback((updated: ServiceReport) => {
    setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
  }, []);

  return { reports, loading, error, hasMore, loadMore, refresh, updateItem };
}
