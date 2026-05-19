import { useState, useEffect } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { Link, useOutletContext } from 'react-router-dom';
import { Plus, ClipboardList, AlertCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { Button } from '@/components/ui/button';
import { useReports } from '@/src/hooks/useReports';
import { useAuth } from '@/src/contexts/AuthContext';
import type { AppLayoutOutletContext } from '@/src/components/layout/AppLayout';
import ReportCard from './components/ReportCard';
import ReportFilters from './components/ReportFilters';
import type { ReportsFilter } from '@/src/hooks/useReports';
import type { ServiceReport } from '@/src/types/reports';

const EMPTY_FILTER: ReportsFilter = { status: '', dateFrom: undefined, dateTo: undefined };

export default function ReportsList() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<ReportsFilter>(EMPTY_FILTER);
  const { reports, loading, error, hasMore, loadMore, refresh, updateItem } = useReports(filter);
  const [listRef] = useAutoAnimate({ duration: 200 });
  const { isOnline, isSyncing, pendingCount } = useOutletContext<AppLayoutOutletContext>();

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
    <div className="flex flex-col gap-4 w-full pb-8 animate-in fade-in duration-300">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground">Histórico de serviços de campo</p>
        </div>
        <Link
          to="/reports/new"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold h-10 px-4 rounded-xl shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> Nova OS
        </Link>
      </div>

      {/* Indicadores de conectividade e sync */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${isOnline ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
          {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {isOnline ? 'Online' : 'Offline'}
        </span>
        {isSyncing && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/15 text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sincronizando...
          </span>
        )}
        {pendingCount > 0 && !isSyncing && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            {pendingCount} OS aguardando sync
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
        <div className="flex items-center gap-2 rounded-lg bg-amber-100/70 dark:bg-amber-500/15 p-3 text-sm text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Lista */}
      <div ref={listRef} className="flex flex-col gap-3">
        {loading && reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            <p className="text-sm">Carregando relatórios...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-card rounded-xl border border-dashed border-border">
            <ClipboardList className="h-10 w-10 mb-4 text-muted-foreground/70" />
            <p className="text-sm font-medium">Nenhuma OS encontrada.</p>
            <p className="text-xs mt-1">
              {isManager ? 'Aguarde que sua equipe envie OS.' : 'Crie sua primeira OS clicando em Nova OS.'}
            </p>
          </div>
        ) : (
          reports.map((report, index) => (
            <div
              key={report.id}
              className="animate-in fade-in slide-in-from-bottom-2 duration-200"
              style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
            >
              <ReportCard report={report} />
            </div>
          ))
        )}

        {hasMore && !loading && (
          <Button
            variant="outline"
            onClick={loadMore}
            className="w-full rounded-xl h-11"
          >
            Carregar mais
          </Button>
        )}

        {loading && reports.length > 0 && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
