import { useState, useEffect, useCallback } from 'react';
import { listarOrcamentos, type OrcamentosFilter } from '@/src/services/orcamentoService';
import type { Orcamento } from '@/src/types/orcamento';

export type { OrcamentosFilter };

const PAGE_SIZE = 20;

export function useOrcamentos(filter: OrcamentosFilter = {}) {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const fetchOrcamentos = useCallback(async (pageIndex: number) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listarOrcamentos(filter, pageIndex);
      setOrcamentos(prev => pageIndex === 0 ? rows : [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar orçamentos.');
    } finally {
      setLoading(false);
    }
  }, [filter.status, filter.client_id]); // eslint-disable-line

  useEffect(() => {
    setPage(0);
    fetchOrcamentos(0);
  }, [fetchOrcamentos]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchOrcamentos(next);
  }, [page, fetchOrcamentos]);

  const refresh = useCallback(() => {
    setPage(0);
    fetchOrcamentos(0);
  }, [fetchOrcamentos]);

  const updateItem = useCallback((updated: Orcamento) => {
    setOrcamentos(prev => prev.map(o => o.id === updated.id ? updated : o));
  }, []);

  return { orcamentos, loading, error, hasMore, loadMore, refresh, updateItem };
}
