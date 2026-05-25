import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Brain, FileJson, FileText, Loader2, ShieldCheck, AlertTriangle,
  BarChart3, BookOpen, Stethoscope, Building2, Search,
  ClipboardList, Banknote, Users, Receipt, Wrench, Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button }  from '@/components/ui/button';
import { Badge }   from '@/components/ui/badge';
import { Input }   from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/src/lib/supabase';

import {
  getIntelligenceStats,
  getDiagnosticCorpus, getKbCorpus,
  getAllReports, getAllReimbursements, getAllClients,
  getAllOrcamentos, getAllEquipments, getAllMaterials,
  logExport,
  fetchAllDiagnosticsForExport, fetchAllKbForExport,
  fetchAllReportsForExport, fetchAllReimbursementsForExport, fetchAllClientsForExport,
  fetchAllOrcamentosForExport, fetchAllEquipmentsForExport, fetchAllMaterialsForExport,
  downloadBlob, toJsonBlob, toCsvBlob,
} from '@/src/services/platformIntelligenceService';
import type {
  PlatformIntelligenceStats,
  PlatformDiagnosticRow, PlatformKbRow,
  PlatformReportRow, PlatformReimbursementRow, PlatformClientRow,
  PlatformOrcamentoRow, PlatformEquipmentRow, PlatformMaterialRow,
} from '@/src/types/platformIntelligence';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return format(new Date(d.includes('T') ? d : d + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR });
}

function BRL(v: number | null): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = status.toLowerCase();
  if (['aprovad', 'approved', 'pago', 'delivered', 'purchased', 'entregue'].some(v => s.includes(v))) return 'default';
  if (['rejeit', 'rejected', 'cancelled', 'cancelad'].some(v => s.includes(v))) return 'destructive';
  if (['draft', 'rascunho'].some(v => s.includes(v))) return 'outline';
  return 'secondary';
}

// ── Tab definitions ───────────────────────────────────────────────────────────

type ActiveTab =
  | 'diagnostics' | 'kb'
  | 'reports' | 'reimbursements' | 'clients'
  | 'orcamentos' | 'equipments' | 'materials';

const TABS: { id: ActiveTab; label: string; icon: React.ElementType; raw: boolean }[] = [
  { id: 'diagnostics',    label: 'Diagnósticos',         icon: Stethoscope,   raw: false },
  { id: 'kb',             label: 'Base de Conhecimento', icon: BookOpen,      raw: false },
  { id: 'reports',        label: 'OS Completas',         icon: ClipboardList, raw: true  },
  { id: 'reimbursements', label: 'Reembolsos',           icon: Banknote,      raw: true  },
  { id: 'clients',        label: 'Clientes',             icon: Users,         raw: true  },
  { id: 'orcamentos',     label: 'Orçamentos',           icon: Receipt,       raw: true  },
  { id: 'equipments',     label: 'Equipamentos',         icon: Wrench,        raw: true  },
  { id: 'materials',      label: 'Materiais',            icon: Package,       raw: true  },
];

interface TenantOption { id: string; name: string; slug: string; }

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlatformIntelligence() {

  // Stats
  const [stats, setStats]               = useState<PlatformIntelligenceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Navigation
  const [activeTab, setActiveTab]       = useState<ActiveTab>('diagnostics');
  const isRaw = TABS.find(t => t.id === activeTab)?.raw ?? false;

  // Shared filters
  const [tenants, setTenants]           = useState<TenantOption[]>([]);
  const [tenantFilter, setTenantFilter] = useState('');
  const [stFilter, setStFilter]         = useState('');
  const [search, setSearch]             = useState('');
  const [exporting, setExporting]       = useState(false);

  // Corpus tab state
  const [diagRows, setDiagRows]         = useState<PlatformDiagnosticRow[]>([]);
  const [diagPage, setDiagPage]         = useState(0);
  const [diagLoading, setDiagLoading]   = useState(false);
  const [diagHasMore, setDiagHasMore]   = useState(true);

  const [kbRows, setKbRows]             = useState<PlatformKbRow[]>([]);
  const [kbPage, setKbPage]             = useState(0);
  const [kbLoading, setKbLoading]       = useState(false);
  const [kbHasMore, setKbHasMore]       = useState(true);

  // Raw tab state
  const [rptRows, setRptRows]           = useState<PlatformReportRow[]>([]);
  const [rptPage, setRptPage]           = useState(0);
  const [rptLoading, setRptLoading]     = useState(false);
  const [rptHasMore, setRptHasMore]     = useState(true);

  const [reimRows, setReimRows]         = useState<PlatformReimbursementRow[]>([]);
  const [reimPage, setReimPage]         = useState(0);
  const [reimLoading, setReimLoading]   = useState(false);
  const [reimHasMore, setReimHasMore]   = useState(true);

  const [cliRows, setCliRows]           = useState<PlatformClientRow[]>([]);
  const [cliPage, setCliPage]           = useState(0);
  const [cliLoading, setCliLoading]     = useState(false);
  const [cliHasMore, setCliHasMore]     = useState(true);

  const [orcRows, setOrcRows]           = useState<PlatformOrcamentoRow[]>([]);
  const [orcPage, setOrcPage]           = useState(0);
  const [orcLoading, setOrcLoading]     = useState(false);
  const [orcHasMore, setOrcHasMore]     = useState(true);

  const [equipRows, setEquipRows]       = useState<PlatformEquipmentRow[]>([]);
  const [equipPage, setEquipPage]       = useState(0);
  const [equipLoading, setEquipLoading] = useState(false);
  const [equipHasMore, setEquipHasMore] = useState(true);

  const [matRows, setMatRows]           = useState<PlatformMaterialRow[]>([]);
  const [matPage, setMatPage]           = useState(0);
  const [matLoading, setMatLoading]     = useState(false);
  const [matHasMore, setMatHasMore]     = useState(true);

  // Tenant name lookup
  const tenantMap = useMemo(
    () => Object.fromEntries(tenants.map(t => [t.id, t.name])),
    [tenants],
  );
  const tn = (id: string) => tenantMap[id] ?? id.slice(0, 8) + '…';

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    getIntelligenceStats()
      .then(setStats)
      .catch((err: Error) => toast.error('Erro ao carregar métricas', { description: err.message }))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    supabase.rpc('get_platform_tenants').then(({ data }) => {
      setTenants(((data ?? []) as TenantOption[]).map((t: any) => ({ id: t.id, name: t.name, slug: t.slug })));
    });
  }, []);

  // ── Load callbacks ─────────────────────────────────────────────────────────

  const loadDiag = useCallback(async (page: number, reset: boolean) => {
    setDiagLoading(true);
    try {
      const rows = await getDiagnosticCorpus({ tenantId: tenantFilter || null, serviceType: stFilter || null, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setDiagRows(prev => reset ? rows : [...prev, ...rows]);
      setDiagHasMore(rows.length === PAGE_SIZE);
    } catch (err: any) { toast.error('Erro ao carregar diagnósticos', { description: err.message }); }
    finally { setDiagLoading(false); }
  }, [tenantFilter, stFilter]);

  const loadKb = useCallback(async (page: number, reset: boolean) => {
    setKbLoading(true);
    try {
      const rows = await getKbCorpus({ tenantId: tenantFilter || null, serviceType: stFilter || null, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setKbRows(prev => reset ? rows : [...prev, ...rows]);
      setKbHasMore(rows.length === PAGE_SIZE);
    } catch (err: any) { toast.error('Erro ao carregar artigos', { description: err.message }); }
    finally { setKbLoading(false); }
  }, [tenantFilter, stFilter]);

  const loadRpt = useCallback(async (page: number, reset: boolean) => {
    setRptLoading(true);
    try {
      const rows = await getAllReports({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setRptRows(prev => reset ? rows : [...prev, ...rows]);
      setRptHasMore(rows.length === PAGE_SIZE);
    } catch (err: any) { toast.error('Erro ao carregar OS', { description: err.message }); }
    finally { setRptLoading(false); }
  }, [tenantFilter]);

  const loadReim = useCallback(async (page: number, reset: boolean) => {
    setReimLoading(true);
    try {
      const rows = await getAllReimbursements({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setReimRows(prev => reset ? rows : [...prev, ...rows]);
      setReimHasMore(rows.length === PAGE_SIZE);
    } catch (err: any) { toast.error('Erro ao carregar reembolsos', { description: err.message }); }
    finally { setReimLoading(false); }
  }, [tenantFilter]);

  const loadCli = useCallback(async (page: number, reset: boolean) => {
    setCliLoading(true);
    try {
      const rows = await getAllClients({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setCliRows(prev => reset ? rows : [...prev, ...rows]);
      setCliHasMore(rows.length === PAGE_SIZE);
    } catch (err: any) { toast.error('Erro ao carregar clientes', { description: err.message }); }
    finally { setCliLoading(false); }
  }, [tenantFilter]);

  const loadOrc = useCallback(async (page: number, reset: boolean) => {
    setOrcLoading(true);
    try {
      const rows = await getAllOrcamentos({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setOrcRows(prev => reset ? rows : [...prev, ...rows]);
      setOrcHasMore(rows.length === PAGE_SIZE);
    } catch (err: any) { toast.error('Erro ao carregar orçamentos', { description: err.message }); }
    finally { setOrcLoading(false); }
  }, [tenantFilter]);

  const loadEquip = useCallback(async (page: number, reset: boolean) => {
    setEquipLoading(true);
    try {
      const rows = await getAllEquipments({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setEquipRows(prev => reset ? rows : [...prev, ...rows]);
      setEquipHasMore(rows.length === PAGE_SIZE);
    } catch (err: any) { toast.error('Erro ao carregar equipamentos', { description: err.message }); }
    finally { setEquipLoading(false); }
  }, [tenantFilter]);

  const loadMat = useCallback(async (page: number, reset: boolean) => {
    setMatLoading(true);
    try {
      const rows = await getAllMaterials({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setMatRows(prev => reset ? rows : [...prev, ...rows]);
      setMatHasMore(rows.length === PAGE_SIZE);
    } catch (err: any) { toast.error('Erro ao carregar materiais', { description: err.message }); }
    finally { setMatLoading(false); }
  }, [tenantFilter]);

  // Corpus tabs respond to stFilter; raw tabs don't
  useEffect(() => {
    if (activeTab === 'diagnostics') { setDiagPage(0); loadDiag(0, true); }
    else if (activeTab === 'kb')     { setKbPage(0);   loadKb(0, true);   }
  }, [activeTab, tenantFilter, stFilter, loadDiag, loadKb]);

  useEffect(() => {
    switch (activeTab) {
      case 'reports':        setRptPage(0);   loadRpt(0, true);   break;
      case 'reimbursements': setReimPage(0);  loadReim(0, true);  break;
      case 'clients':        setCliPage(0);   loadCli(0, true);   break;
      case 'orcamentos':     setOrcPage(0);   loadOrc(0, true);   break;
      case 'equipments':     setEquipPage(0); loadEquip(0, true); break;
      case 'materials':      setMatPage(0);   loadMat(0, true);   break;
    }
  }, [activeTab, tenantFilter, loadRpt, loadReim, loadCli, loadOrc, loadEquip, loadMat]);

  // ── Local search ───────────────────────────────────────────────────────────

  const sl = search.toLowerCase();
  const filteredDiag  = sl ? diagRows.filter(r =>
    [r.reported_problem, r.final_diagnosis, r.preliminary_diagnosis, r.technical_recommendation].some(f => f?.toLowerCase().includes(sl))) : diagRows;
  const filteredKb    = sl ? kbRows.filter(r =>
    [r.title, r.content].some(f => f?.toLowerCase().includes(sl))) : kbRows;
  const filteredRpt   = sl ? rptRows.filter(r =>
    [r.os_number, r.reported_problem, r.technician_name, r.client_name].some(f => f?.toLowerCase().includes(sl))) : rptRows;
  const filteredReim  = sl ? reimRows.filter(r =>
    [r.favorecido, r.description, r.submitter_name, r.client_name].some(f => f?.toLowerCase().includes(sl))) : reimRows;
  const filteredCli   = sl ? cliRows.filter(r =>
    [r.name, r.cnpj, r.contato_nome, r.contato_email].some(f => f?.toLowerCase().includes(sl))) : cliRows;
  const filteredOrc   = sl ? orcRows.filter(r =>
    [r.titulo, r.client_name, r.technician_name].some(f => f?.toLowerCase().includes(sl))) : orcRows;
  const filteredEquip = sl ? equipRows.filter(r =>
    [r.name, r.serial_number, r.client_name, r.manufacturer].some(f => f?.toLowerCase().includes(sl))) : equipRows;
  const filteredMat   = sl ? matRows.filter(r =>
    [r.item, r.requester_name, r.client_name, r.supplier_name].some(f => f?.toLowerCase().includes(sl))) : matRows;

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = async (fmt: 'json' | 'csv') => {
    setExporting(true);
    const tid = tenantFilter || null;
    try {
      let rows: unknown[] = [];
      let resource: Parameters<typeof logExport>[0] = 'diagnostics';
      let filename = `nextai-export-${Date.now()}.${fmt}`;

      if (activeTab === 'diagnostics') {
        rows = await fetchAllDiagnosticsForExport({ tenantId: tid, serviceType: stFilter || null });
        resource = 'diagnostics'; filename = `nextai-diagnostics-${Date.now()}.${fmt}`;
      } else if (activeTab === 'kb') {
        rows = await fetchAllKbForExport({ tenantId: tid, serviceType: stFilter || null });
        resource = 'kb'; filename = `nextai-kb-${Date.now()}.${fmt}`;
      } else if (activeTab === 'reports') {
        rows = await fetchAllReportsForExport(tid);
        resource = 'reports'; filename = `nextai-os-${Date.now()}.${fmt}`;
      } else if (activeTab === 'reimbursements') {
        rows = await fetchAllReimbursementsForExport(tid);
        resource = 'reimbursements'; filename = `nextai-reembolsos-${Date.now()}.${fmt}`;
      } else if (activeTab === 'clients') {
        rows = await fetchAllClientsForExport(tid);
        resource = 'clients'; filename = `nextai-clientes-${Date.now()}.${fmt}`;
      } else if (activeTab === 'orcamentos') {
        rows = await fetchAllOrcamentosForExport(tid);
        resource = 'orcamentos'; filename = `nextai-orcamentos-${Date.now()}.${fmt}`;
      } else if (activeTab === 'equipments') {
        rows = await fetchAllEquipmentsForExport(tid);
        resource = 'equipments'; filename = `nextai-equipamentos-${Date.now()}.${fmt}`;
      } else if (activeTab === 'materials') {
        rows = await fetchAllMaterialsForExport(tid);
        resource = 'materials'; filename = `nextai-materiais-${Date.now()}.${fmt}`;
      }

      const blob = fmt === 'json' ? toJsonBlob(rows) : toCsvBlob(rows as Record<string, unknown>[]);
      downloadBlob(blob, filename);
      await logExport(resource, tid, rows.length);
      toast.success(`${rows.length} registros exportados.`);
    } catch (err: any) {
      toast.error('Erro ao exportar', { description: err.message });
    } finally {
      setExporting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 h-full w-full pb-8 animate-in fade-in duration-300">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          Inteligência
        </h1>
        <p className="text-sm text-muted-foreground">
          Acesso cross-tenant para análise, corpus de IA e exportação de dados.
        </p>
      </div>

      {/* Banner */}
      {!isRaw ? (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3">
          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Dados <strong>anonimizados</strong>: sem nomes de técnicos ou clientes, sem notas internas e sem GPS.
            Coletados para melhoria contínua da IA do NextAI.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Dados <strong>completos e não anonimizados</strong>. Acesso exclusivo SuperMaster NextAI.
            Toda exportação é auditada em <code className="text-xs bg-amber-100 dark:bg-amber-900 rounded px-1">platform_access_log</code>.
          </p>
        </div>
      )}

      {/* Metric cards */}
      {statsLoading ? (
        <div className="flex items-center justify-center h-28">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'OS no Corpus',        value: stats.total_reports,        icon: Stethoscope, color: 'text-indigo-500' },
            { label: 'Com Diagnóstico IA',  value: stats.reports_with_diag,    icon: Brain,       color: 'text-violet-500' },
            { label: 'Artigos KB',          value: stats.total_kb,             icon: BookOpen,    color: 'text-emerald-500' },
            { label: 'Tenants Ativos',      value: stats.tenants_contributing, icon: Building2,   color: 'text-amber-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <div className={`p-2 rounded-lg bg-muted ${color}`}><Icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Service type breakdown */}
      {stats && stats.by_service_type.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5" /> OS por Tipo de Serviço
          </p>
          <div className="flex flex-wrap gap-2">
            {stats.by_service_type.map(({ service_type, n }) => (
              <Badge key={service_type} variant="secondary" className="text-sm font-semibold">
                {service_type} — {n}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto scrollbar-none">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); setSearch(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap shrink-0 ${
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Filters + export */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1">
          <Select value={tenantFilter} onValueChange={v => setTenantFilter(v === '_all' ? '' : v)}>
            <SelectTrigger className="h-9 w-44 rounded-lg text-sm">
              <SelectValue placeholder="Todas as empresas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas as empresas</SelectItem>
              {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {!isRaw && (
            <Select value={stFilter} onValueChange={v => setStFilter(v === '_all' ? '' : v)}>
              <SelectTrigger className="h-9 w-44 rounded-lg text-sm">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos os tipos</SelectItem>
                {(stats?.by_service_type ?? []).map(({ service_type }) => (
                  <SelectItem key={service_type} value={service_type}>{service_type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 pl-8 rounded-lg text-sm w-48"
            />
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="h-9 rounded-lg gap-1.5 font-semibold"
            onClick={() => handleExport('json')} disabled={exporting}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileJson className="h-3.5 w-3.5" />}
            JSON
          </Button>
          <Button size="sm" variant="outline" className="h-9 rounded-lg gap-1.5 font-semibold"
            onClick={() => handleExport('csv')} disabled={exporting}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            CSV
          </Button>
        </div>
      </div>

      {/* ── Diagnósticos ────────────────────────────────────────────────────── */}
      {activeTab === 'diagnostics' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {diagLoading && diagRows.length === 0 ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold">Tipo</TableHead>
                    <TableHead className="font-semibold">Problema Relatado</TableHead>
                    <TableHead className="font-semibold">Diagnóstico Final</TableHead>
                    <TableHead className="font-semibold">Recomendação</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Data OS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDiag.map(r => (
                    <TableRow key={r.report_id} className="hover:bg-muted/50 transition-colors border-border align-top">
                      <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.tenant_id)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{r.service_type ?? '—'}</Badge></TableCell>
                      <TableCell className="text-sm max-w-[200px]"><p className="line-clamp-3 text-muted-foreground">{r.reported_problem ?? '—'}</p></TableCell>
                      <TableCell className="text-sm max-w-[240px]"><p className="line-clamp-3">{r.final_diagnosis ?? r.preliminary_diagnosis ?? '—'}</p></TableCell>
                      <TableCell className="text-sm max-w-[200px]"><p className="line-clamp-3 text-muted-foreground">{r.technical_recommendation ?? r.services_performed ?? '—'}</p></TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDate(r.service_date)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredDiag.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {search ? 'Nenhum resultado para a busca.' : 'Nenhuma OS aprovada no corpus.'}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {diagHasMore && !search && (
            <div className="p-4 border-t border-border flex justify-center">
              <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold" disabled={diagLoading}
                onClick={() => { const n = diagPage + 1; setDiagPage(n); loadDiag(n, false); }}>
                {diagLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Base de Conhecimento ─────────────────────────────────────────────── */}
      {activeTab === 'kb' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {kbLoading && kbRows.length === 0 ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold">Título</TableHead>
                    <TableHead className="font-semibold">Tipo</TableHead>
                    <TableHead className="font-semibold">Tags</TableHead>
                    <TableHead className="font-semibold">Views</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Criado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKb.map(r => (
                    <TableRow key={r.article_id} className="hover:bg-muted/50 transition-colors border-border align-top">
                      <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.tenant_id)}</TableCell>
                      <TableCell className="text-sm max-w-[260px]">
                        <p className="line-clamp-2 font-medium">{r.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.content}</p>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{r.service_type ?? '—'}</Badge></TableCell>
                      <TableCell className="max-w-[160px]">
                        <div className="flex flex-wrap gap-1">
                          {(r.tags ?? []).slice(0, 3).map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                          {(r.tags ?? []).length > 3 && <Badge variant="secondary" className="text-xs">+{r.tags.length - 3}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.view_count}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredKb.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {search ? 'Nenhum resultado para a busca.' : 'Nenhum artigo ativo.'}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {kbHasMore && !search && (
            <div className="p-4 border-t border-border flex justify-center">
              <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold" disabled={kbLoading}
                onClick={() => { const n = kbPage + 1; setKbPage(n); loadKb(n, false); }}>
                {kbLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── OS Completas ─────────────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {rptLoading && rptRows.length === 0 ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">OS#</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Tipo</TableHead>
                    <TableHead className="font-semibold">Técnico</TableHead>
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold">Problema</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRpt.map(r => (
                    <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                      <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{r.os_number ?? '—'}</TableCell>
                      <TableCell><Badge variant={statusVariant(r.status)} className="text-xs whitespace-nowrap">{r.status}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{r.service_type ?? '—'}</Badge></TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.technician_name ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.client_name ?? '—'}</TableCell>
                      <TableCell className="text-sm max-w-[200px]"><p className="line-clamp-2 text-muted-foreground">{r.reported_problem ?? '—'}</p></TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDate(r.service_date)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredRpt.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      {search ? 'Nenhum resultado para a busca.' : 'Nenhuma OS encontrada.'}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {rptHasMore && !search && (
            <div className="p-4 border-t border-border flex justify-center">
              <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold" disabled={rptLoading}
                onClick={() => { const n = rptPage + 1; setRptPage(n); loadRpt(n, false); }}>
                {rptLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Reembolsos ──────────────────────────────────────────────────────── */}
      {activeTab === 'reimbursements' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {reimLoading && reimRows.length === 0 ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Categoria</TableHead>
                    <TableHead className="font-semibold">Valor</TableHead>
                    <TableHead className="font-semibold">Favorecido</TableHead>
                    <TableHead className="font-semibold">Chave PIX</TableHead>
                    <TableHead className="font-semibold">Solicitante</TableHead>
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReim.map(r => (
                    <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                      <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                      <TableCell><Badge variant={statusVariant(r.status)} className="text-xs whitespace-nowrap">{r.status}</Badge></TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.category ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap font-semibold">{BRL(r.amount)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.favorecido ?? '—'}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{r.pix_key ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.submitter_name ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.client_name ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDate(r.expense_date)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredReim.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {search ? 'Nenhum resultado para a busca.' : 'Nenhum reembolso encontrado.'}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {reimHasMore && !search && (
            <div className="p-4 border-t border-border flex justify-center">
              <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold" disabled={reimLoading}
                onClick={() => { const n = reimPage + 1; setReimPage(n); loadReim(n, false); }}>
                {reimLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Clientes ─────────────────────────────────────────────────────────── */}
      {activeTab === 'clients' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {cliLoading && cliRows.length === 0 ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold">Razão Social</TableHead>
                    <TableHead className="font-semibold">CNPJ</TableHead>
                    <TableHead className="font-semibold">Cidade/UF</TableHead>
                    <TableHead className="font-semibold">Contato</TableHead>
                    <TableHead className="font-semibold">Telefone</TableHead>
                    <TableHead className="font-semibold">E-mail</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Criado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCli.map(r => (
                    <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                      <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                      <TableCell className="text-sm font-medium whitespace-nowrap">{r.name}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{r.cnpj ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.cidade && r.estado ? `${r.cidade}/${r.estado}` : r.cidade ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.contato_nome ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{r.contato_telefone ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.contato_email ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredCli.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      {search ? 'Nenhum resultado para a busca.' : 'Nenhum cliente encontrado.'}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {cliHasMore && !search && (
            <div className="p-4 border-t border-border flex justify-center">
              <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold" disabled={cliLoading}
                onClick={() => { const n = cliPage + 1; setCliPage(n); loadCli(n, false); }}>
                {cliLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Orçamentos ───────────────────────────────────────────────────────── */}
      {activeTab === 'orcamentos' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {orcLoading && orcRows.length === 0 ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Título</TableHead>
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold">Técnico</TableHead>
                    <TableHead className="font-semibold">Total</TableHead>
                    <TableHead className="font-semibold">Validade</TableHead>
                    <TableHead className="font-semibold">Assinado por</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Criado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrc.map(r => (
                    <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                      <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                      <TableCell><Badge variant={statusVariant(r.status)} className="text-xs whitespace-nowrap">{r.status}</Badge></TableCell>
                      <TableCell className="text-sm max-w-[180px]"><p className="line-clamp-2">{r.titulo}</p></TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.client_name ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.technician_name ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap font-semibold">{BRL(r.total_value)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDate(r.validade)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.signer_name ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredOrc.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {search ? 'Nenhum resultado para a busca.' : 'Nenhum orçamento encontrado.'}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {orcHasMore && !search && (
            <div className="p-4 border-t border-border flex justify-center">
              <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold" disabled={orcLoading}
                onClick={() => { const n = orcPage + 1; setOrcPage(n); loadOrc(n, false); }}>
                {orcLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Equipamentos ─────────────────────────────────────────────────────── */}
      {activeTab === 'equipments' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {equipLoading && equipRows.length === 0 ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">Tipo</TableHead>
                    <TableHead className="font-semibold">Fabricante</TableHead>
                    <TableHead className="font-semibold">Serial</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Garantia até</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Últ. Manutenção</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEquip.map(r => (
                    <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                      <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                      <TableCell className="text-sm font-medium whitespace-nowrap">{r.name}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.type ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.manufacturer ?? '—'}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{r.serial_number ?? '—'}</TableCell>
                      <TableCell>{r.status ? <Badge variant={statusVariant(r.status)} className="text-xs">{r.status}</Badge> : '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.client_name ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDate(r.warranty_until)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDate(r.last_maintenance_at)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredEquip.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {search ? 'Nenhum resultado para a busca.' : 'Nenhum equipamento encontrado.'}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {equipHasMore && !search && (
            <div className="p-4 border-t border-border flex justify-center">
              <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold" disabled={equipLoading}
                onClick={() => { const n = equipPage + 1; setEquipPage(n); loadEquip(n, false); }}>
                {equipLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Materiais ────────────────────────────────────────────────────────── */}
      {activeTab === 'materials' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {matLoading && matRows.length === 0 ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Req#</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Urgência</TableHead>
                    <TableHead className="font-semibold">Item</TableHead>
                    <TableHead className="font-semibold">Qtd</TableHead>
                    <TableHead className="font-semibold">Solicitante</TableHead>
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold">Preço Compra</TableHead>
                    <TableHead className="font-semibold">Fornecedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMat.map(r => (
                    <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                      <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{r.request_number ?? '—'}</TableCell>
                      <TableCell><Badge variant={statusVariant(r.status)} className="text-xs whitespace-nowrap">{r.status}</Badge></TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.urgency ?? '—'}</TableCell>
                      <TableCell className="text-sm max-w-[180px]"><p className="line-clamp-2">{r.item}</p></TableCell>
                      <TableCell className="text-sm text-center">{r.quantity}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.requester_name ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.client_name ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap font-semibold">{BRL(r.purchase_price)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.supplier_name ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                  {filteredMat.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                      {search ? 'Nenhum resultado para a busca.' : 'Nenhum material encontrado.'}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {matHasMore && !search && (
            <div className="p-4 border-t border-border flex justify-center">
              <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold" disabled={matLoading}
                onClick={() => { const n = matPage + 1; setMatPage(n); loadMat(n, false); }}>
                {matLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
