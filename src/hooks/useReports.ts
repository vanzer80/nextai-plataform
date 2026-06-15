import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import { getAllCachedReports, cacheReport, getLastFullSync, setLastFullSync } from '@/src/lib/reportIndexedDB';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ServiceReport, ReportStatus } from '@/src/types/reports';

export interface ReportsFilter {
  status?: ReportStatus | '';
  priority?: 'baixa' | 'normal' | 'alta' | 'critica' | '';
  dateFrom?: string;
  dateTo?: string;
  technicianId?: string;
  query?: string;
  clientIds?: string[];
  sortBy?: 'created_at' | 'service_date' | 'sla_due_at' | 'os_number';
  sortDir?: 'asc' | 'desc';
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
      const sortCol = filter.sortBy ?? 'created_at';
      const sortAsc = filter.sortDir === 'asc';

      let query = supabase
        .from('service_reports')
        .select(`
          id, created_at, updated_at, status, service_type, os_number,
          service_date, site_location, technician_id, client_id, asset_id,
          reported_problem, final_diagnosis, local_draft_id, last_synced_at,
          priority, sla_due_at, maintenance_plan_id,
          clients(name), users:technician_id(full_name), equipments:asset_id(name)
        `)
        .order(sortCol, { ascending: sortAsc, nullsFirst: false })
        .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);

      if (filter.status)      query = query.eq('status', filter.status);
      if (filter.priority)    query = query.eq('priority', filter.priority);
      if (filter.dateFrom)    query = query.gte('service_date', filter.dateFrom);
      if (filter.dateTo)      query = query.lte('service_date', filter.dateTo);
      if (filter.technicianId) query = query.eq('technician_id', filter.technicianId);

      // Busca semântica: cliente por nome (via cache) tem prioridade sobre text-search,
      // pois GENERATED COLUMN não inclui dados de outras tabelas.
      if (filter.clientIds?.length) {
        query = query.in('client_id', filter.clientIds);
      } else if (filter.query?.trim()) {
        query = query.textSearch('search_vector', filter.query.trim(), {
          type: 'websearch',
          config: 'simple',
        });
      }

      const { data, error: err } = await query;
      if (err) throw err;

      const rows = (data ?? []) as ServiceReport[];
      setReports(prev => pageIndex === 0 ? rows : [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);

      // Write-through: o que o técnico vê online fica disponível para leitura offline.
      void Promise.all(rows.map(r => cacheReport(r.id, r))).catch(() => {});
      if (pageIndex === 0) setLastFullSync(Date.now());
    } catch (err: unknown) {
      console.warn('[useReports] Supabase falhou, usando cache IndexedDB');
      const cached = await getAllCachedReports();
      // Aplica filtros client-side no cache offline (JavaScript ILIKE simples)
      let rows = cached.map(c => c.data) as ServiceReport[];
      if (filter.status)       rows = rows.filter(r => r.status === filter.status);
      if (filter.priority)     rows = rows.filter(r => r.priority === filter.priority);
      if (filter.technicianId) rows = rows.filter(r => r.technician_id === filter.technicianId);
      if (filter.dateFrom)     rows = rows.filter(r => r.service_date != null && r.service_date >= filter.dateFrom!);
      if (filter.dateTo)       rows = rows.filter(r => r.service_date != null && r.service_date <= filter.dateTo!);
      if (filter.clientIds?.length) rows = rows.filter(r => r.client_id != null && filter.clientIds!.includes(r.client_id));
      if (filter.query?.trim()) {
        const q = filter.query.trim().toLowerCase();
        rows = rows.filter(r =>
          r.os_number?.toLowerCase().includes(q) ||
          r.service_type?.toLowerCase().includes(q) ||
          r.reported_problem?.toLowerCase().includes(q) ||
          r.final_diagnosis?.toLowerCase().includes(q) ||
          r.site_location?.toLowerCase().includes(q) ||
          r.asset_name_manual?.toLowerCase().includes(q)
        );
      }
      setReports(prev => pageIndex === 0 ? rows : [...prev, ...rows]);
      setHasMore(false); // sem paginação no cache offline
      const last = getLastFullSync();
      const ago = last ? ` (sincronizado ${formatDistanceToNow(last, { addSuffix: true, locale: ptBR })})` : '';
      setError(`Exibindo dados em cache${ago} — verifique sua conexão.`);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.status, filter.priority, filter.dateFrom, filter.dateTo, filter.technicianId, filter.query, filter.clientIds?.join(','), filter.sortBy, filter.sortDir]);

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
