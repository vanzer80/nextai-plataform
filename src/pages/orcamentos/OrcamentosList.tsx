import { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { Button } from '@/components/ui/button';
import { useOrcamentos } from '@/src/hooks/useOrcamentos';
import { useAuth } from '@/src/contexts/AuthContext';
import { OrcamentoCard } from './components/OrcamentoCard';
import { OrcamentoFilters } from './components/OrcamentoFilters';
import type { OrcamentosFilter } from '@/src/hooks/useOrcamentos';
import type { Orcamento } from '@/src/types/orcamento';

const EMPTY_FILTER: OrcamentosFilter = { status: '', client_id: '' };

export default function OrcamentosList() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<OrcamentosFilter>(EMPTY_FILTER);
  const { orcamentos, loading, error, hasMore, loadMore, refresh, updateItem } = useOrcamentos(filter);
  const isManager = user?.role && ['Gestor', 'Supervisor', 'Admin', 'Master'].includes(user.role);

  useEffect(() => {
    const channel = supabase
      .channel('realtime_orcamentos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orcamentos' }, () => {
        refresh();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orcamentos' }, payload => {
        updateItem(payload.new as Orcamento);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refresh, updateItem]);

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orçamentos</h1>
          <p className="text-sm text-slate-500">
            {isManager ? 'Todos os orçamentos da equipe' : 'Seus orçamentos técnicos'}
          </p>
        </div>
        <Link
          to="/orcamentos/novo"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold h-10 px-4 rounded-xl shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> Novo
        </Link>
      </div>

      <OrcamentoFilters filter={filter} onChange={setFilter} onClear={() => setFilter(EMPTY_FILTER)} />

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-orange-50 p-3 text-sm text-orange-800 border border-orange-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {loading && orcamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-blue-600" />
            <p className="text-sm">Carregando orçamentos...</p>
          </div>
        ) : orcamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
            <FileText className="h-10 w-10 mb-4 text-slate-400" />
            <p className="text-sm font-medium">Nenhum orçamento encontrado.</p>
            <p className="text-xs mt-1">
              {isManager ? 'Aguarde que sua equipe crie orçamentos.' : 'Crie seu primeiro orçamento clicando em Novo.'}
            </p>
          </div>
        ) : (
          orcamentos.map(orc => (
            <Fragment key={orc.id}><OrcamentoCard orcamento={orc} /></Fragment>
          ))
        )}

        {hasMore && !loading && (
          <Button
            variant="outline"
            onClick={loadMore}
            className="w-full rounded-xl border-slate-300 text-slate-700 h-11"
          >
            Carregar mais
          </Button>
        )}

        {loading && orcamentos.length > 0 && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          </div>
        )}
      </div>
    </div>
  );
}
