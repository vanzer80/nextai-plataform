import { useState, useEffect, useMemo } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { Plus, ClipboardList, AlertCircle, Loader2, Wifi, WifiOff, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { Button } from '@/components/ui/button';
import { exportarOsExcel } from '@/src/utils/exportarOsExcel';
import type { ServiceReport } from '@/src/types/reports';
import { useReports } from '@/src/hooks/useReports';
import { useAuth } from '@/src/contexts/AuthContext';
import { useClients } from '@/src/hooks/useClients';
import { useTechnicians } from '@/src/hooks/useTechnicians';
import type { AppLayoutOutletContext } from '@/src/components/layout/AppLayout';
import ReportCard from './components/ReportCard';
import ReportFilters from './components/ReportFilters';
import ImportOsDialog from '@/src/components/reports/ImportOsDialog';
import type { ReportsFilter } from '@/src/hooks/useReports';

const EMPTY_FILTER: ReportsFilter = {
  status: '', priority: '', dateFrom: undefined, dateTo: undefined,
  query: undefined, technicianId: undefined,
  sortBy: 'created_at', sortDir: 'desc',
};

export default function ReportsList() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Lazy init: lê URL na montagem para suportar deep links (ex: ?status=approved&sort=sla_due_at)
  const [filter, setFilter] = useState<ReportsFilter>(() => ({
    status:       (searchParams.get('status') as ReportsFilter['status'])   ?? '',
    priority:     (searchParams.get('priority') as ReportsFilter['priority']) ?? '',
    dateFrom:     searchParams.get('dateFrom') ?? undefined,
    dateTo:       searchParams.get('dateTo')   ?? undefined,
    query:        searchParams.get('q')        ?? undefined,
    technicianId: searchParams.get('tid')      ?? undefined,
    sortBy:       (searchParams.get('sort') as ReportsFilter['sortBy'])   ?? 'created_at',
    sortDir:      (searchParams.get('dir')  as ReportsFilter['sortDir'])  ?? 'desc',
  }));

  // Sincroniza filter → URL (replace: não polui o histórico de navegação)
  // Defaults são omitidos para manter links limpos
  useEffect(() => {
    const p = new URLSearchParams();
    if (filter.status)                             p.set('status',   filter.status);
    if (filter.priority)                           p.set('priority', filter.priority);
    if (filter.dateFrom)                           p.set('dateFrom', filter.dateFrom);
    if (filter.dateTo)                             p.set('dateTo',   filter.dateTo);
    if (filter.query)                              p.set('q',        filter.query);
    if (filter.technicianId)                       p.set('tid',      filter.technicianId);
    if (filter.sortBy  && filter.sortBy  !== 'created_at') p.set('sort', filter.sortBy);
    if (filter.sortDir && filter.sortDir !== 'desc')       p.set('dir',  filter.sortDir);
    setSearchParams(p, { replace: true });
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const clients = useClients();
  const technicians = useTechnicians();
  const isManager = user?.role && ['Gestor', 'Supervisor', 'Admin', 'Master'].includes(user.role);

  // Resolve clientIds a partir do nome digitado (cache em memória, zero latência).
  // Quando o texto bate com um cliente, passa clientIds ao invés de textSearch,
  // pois GENERATED COLUMN não inclui client_name (cross-table não suportado).
  const matchingClientIds = useMemo(() => {
    if (!filter.query?.trim()) return undefined;
    const q = filter.query.trim().toLowerCase();
    const ids = clients
      .filter(c => c.name.toLowerCase().includes(q))
      .map(c => c.id);
    return ids.length > 0 ? ids : undefined;
  }, [filter.query, clients]);

  const resolvedFilter = useMemo(
    () => ({ ...filter, clientIds: matchingClientIds }),
    [filter, matchingClientIds],
  );

  const { reports, loading, error, hasMore, loadMore, refresh, updateItem } = useReports(resolvedFilter);
  const [isExporting, setIsExporting]     = useState(false);
  const [importOpen, setImportOpen]       = useState(false);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      // Faz fetch completo sem paginação, aplicando os mesmos filtros ativos
      let query = supabase
        .from('service_reports')
        .select(`
          id, created_at, status, service_type, os_number, service_date,
          site_location, reported_problem, final_diagnosis, services_performed,
          parts_used, priority, asset_name_manual,
          clients(name), users:technician_id(full_name), equipments:asset_id(name)
        `)
        .order('created_at', { ascending: false });

      if (resolvedFilter.status)       query = query.eq('status', resolvedFilter.status);
      if (resolvedFilter.priority)     query = query.eq('priority', resolvedFilter.priority);
      if (resolvedFilter.dateFrom)     query = query.gte('service_date', resolvedFilter.dateFrom);
      if (resolvedFilter.dateTo)       query = query.lte('service_date', resolvedFilter.dateTo);
      if (resolvedFilter.technicianId) query = query.eq('technician_id', resolvedFilter.technicianId);
      if (resolvedFilter.clientIds?.length) query = query.in('client_id', resolvedFilter.clientIds);
      else if (resolvedFilter.query?.trim()) {
        query = query.textSearch('search_vector', resolvedFilter.query.trim(), { type: 'websearch', config: 'simple' });
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      if (!data?.length) {
        toast.warning('Nenhuma OS encontrada com os filtros atuais.');
        return;
      }
      exportarOsExcel(data as ServiceReport[]);
      toast.success(`${data.length} OS exportadas com sucesso.`);
    } catch {
      toast.error('Erro ao exportar. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };
  const [listRef] = useAutoAnimate({ duration: 200 });
  const outletCtx = useOutletContext<AppLayoutOutletContext | undefined>();
  const isOnline    = outletCtx?.isOnline    ?? true;
  const isSyncing   = outletCtx?.isSyncing   ?? false;
  const pendingCount = outletCtx?.pendingCount ?? 0;

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

  return (
    <div className="flex flex-col gap-4 w-full pb-8 animate-in fade-in duration-300">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground">Histórico de serviços de campo</p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={isExporting}
                className="h-10 rounded-xl gap-1.5 text-sm font-semibold border-border"
              >
                {isExporting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <FileSpreadsheet className="h-4 w-4" />}
                <span className="hidden sm:inline">Exportar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportOpen(true)}
                className="h-10 rounded-xl gap-1.5 text-sm font-semibold border-border"
                data-onboarding="os-importar"
              >
                <UploadCloud className="h-4 w-4" />
                <span className="hidden sm:inline">Importar OS</span>
              </Button>
            </>
          )}
          <Link
            to="/reports/new"
            data-onboarding="os-nova"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold h-10 px-4 rounded-xl shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" /> Nova OS
          </Link>
        </div>
      </div>

      {/* Indicadores de conectividade e sync */}
      <div className="flex items-center gap-2 flex-wrap" data-onboarding="os-sync-badge">
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
      <div data-onboarding="os-filtros">
      <ReportFilters
        filter={filter}
        onChange={setFilter}
        onClear={() => setFilter(EMPTY_FILTER)}
        technicians={isManager ? technicians : undefined}
      />
      </div>

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
            <p className="text-sm">Carregando OS...</p>
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
              data-onboarding={index === 0 ? 'os-card-primeiro' : undefined}
              className="animate-in fade-in fill-mode-backwards slide-in-from-bottom-2 duration-200"
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

      <ImportOsDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={refresh}
      />
    </div>
  );
}
