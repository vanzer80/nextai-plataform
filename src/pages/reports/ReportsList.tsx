import { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ClipboardList, AlertCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { Button } from '@/components/ui/button';
import { useReports } from '@/src/hooks/useReports';
import { useOfflineSync } from '@/src/hooks/useOfflineSync';
import { useAuth } from '@/src/contexts/AuthContext';
import ReportCard from './components/ReportCard';
import ReportFilters from './components/ReportFilters';
import type { ReportsFilter } from '@/src/hooks/useReports';
import type { ServiceReport } from '@/src/types/reports';

const EMPTY_FILTER: ReportsFilter = { status: '', dateFrom: undefined, dateTo: undefined };

export default function ReportsList() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<ReportsFilter>(EMPTY_FILTER);
  const { reports, loading, error, hasMore, loadMore, refresh, updateItem } = useReports(filter);
  const { isOnline, isSyncing, pendingCount } = useOfflineSync();

  // Realtime: atualiza o item afetado na lista sem refetch completo
  useEffect(() => {
    const channel = supabase
      .channel('reports_list_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_reports' },
        payload => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            updateItem(payload.new as ServiceReport);
          } else {
            refresh();
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refresh, updateItem]);

  const isManager = user?.role && ['Gestor', 'Supervisor', 'Admin', 'Master'].includes(user.role);

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto pb-8">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Relatórios Técnicos</h1>
          <p className="text-sm text-slate-500">Histórico de serviços de campo</p>
        </div>
        <Link
          to="/reports/new"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold h-10 px-4 rounded-xl shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> Novo
        </Link>
      </div>

      {/* Indicadores de conectividade e sync */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {isOnline ? 'Online' : 'Offline'}
        </span>
        {isSyncing && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sincronizando...
          </span>
        )}
        {pendingCount > 0 && !isSyncing && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
            {pendingCount} {pendingCount === 1 ? 'relatório' : 'relatórios'} aguardando sync
          </span>
        )}
      </div>

      {/* Filtros — gestor vê todos, técnico vê apenas os seus */}
      <ReportFilters
        filter={filter}
        onChange={setFilter}
        onClear={() => setFilter(EMPTY_FILTER)}
      />

      {/* Aviso de cache offline */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-orange-50 p-3 text-sm text-orange-800 border border-orange-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Lista */}
      <div className="flex flex-col gap-3">
        {loading && reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-blue-600" />
            <p className="text-sm">Carregando relatórios...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
            <ClipboardList className="h-10 w-10 mb-4 text-slate-400" />
            <p className="text-sm font-medium">Nenhum relatório encontrado.</p>
            <p className="text-xs mt-1">
              {isManager ? 'Aguarde que sua equipe envie relatórios.' : 'Crie seu primeiro relatório clicando em Novo.'}
            </p>
          </div>
        ) : (
          reports.map(report => (
            <Fragment key={report.id}><ReportCard report={report} /></Fragment>
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

        {loading && reports.length > 0 && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          </div>
        )}
      </div>
    </div>
  );
}
