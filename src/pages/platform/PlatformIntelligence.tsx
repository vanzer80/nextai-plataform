import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Brain, Download, FileJson, FileText, Loader2, ShieldCheck,
  BarChart3, BookOpen, Stethoscope, Building2, Search,
  ClipboardList, Paperclip, History, PenLine, Receipt,
  MapPin, Package, Wrench, Bell, FileCheck,
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
  getDiagnosticCorpus,
  getKbCorpus,
  fetchAllDiagnosticsForExport,
  fetchAllKbForExport,
  getAllReports,          fetchAllReportsForExport,
  getAllReimbursements,   fetchAllReimbursementsForExport,
  getAllClients,          fetchAllClientsForExport,
  getAllOrcamentos,       fetchAllOrcamentosForExport,
  getAllEquipments,       fetchAllEquipmentsForExport,
  getAllMaterials,        fetchAllMaterialsForExport,
  getAllChecklistItems,   fetchAllChecklistItemsForExport,
  getAllAttachments,      fetchAllAttachmentsForExport,
  getAllStatusHistory,    fetchAllStatusHistoryForExport,
  getAllSignatures,       fetchAllSignaturesForExport,
  getAllReimbursementHistory, fetchAllReimbursementHistoryForExport,
  getAllClientLocations,  fetchAllClientLocationsForExport,
  getAllNotifications,    fetchAllNotificationsForExport,
  logExport,
  downloadBlob,
  toJsonBlob,
  toCsvBlob,
} from '@/src/services/platformIntelligenceService';

import type {
  PlatformIntelligenceStats,
  ExportResource,
} from '@/src/types/platformIntelligence';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type TabId =
  | 'diagnostics' | 'kb'
  | 'reports' | 'checklist' | 'attachments' | 'status_history' | 'signatures'
  | 'reimbursements' | 'reimbursement_history'
  | 'clients' | 'client_locations'
  | 'orcamentos' | 'equipments' | 'materials' | 'notifications';

interface ColDef {
  key: string;
  label: string;
  truncate?: boolean;
  isDate?: boolean;
  isBadge?: boolean;
  isNum?: boolean;
}

interface TabMeta {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exportResource: ExportResource;
  columns: ColDef[];
}

interface TabData {
  rows: Record<string, unknown>[];
  page: number;
  loading: boolean;
  hasMore: boolean;
}

// ── Configuração das 15 abas ───────────────────────────────────────────────────

const TAB_META: TabMeta[] = [
  {
    id: 'diagnostics', label: 'Diagnósticos', icon: Stethoscope, exportResource: 'diagnostics',
    columns: [
      { key: 'service_type', label: 'Tipo', isBadge: true },
      { key: 'reported_problem', label: 'Problema', truncate: true },
      { key: 'final_diagnosis', label: 'Diagnóstico', truncate: true },
      { key: 'service_date', label: 'Data OS', isDate: true },
    ],
  },
  {
    id: 'kb', label: 'Base KB', icon: BookOpen, exportResource: 'kb',
    columns: [
      { key: 'title', label: 'Título', truncate: true },
      { key: 'service_type', label: 'Tipo', isBadge: true },
      { key: 'view_count', label: 'Views', isNum: true },
      { key: 'created_at', label: 'Criado em', isDate: true },
    ],
  },
  {
    id: 'reports', label: 'OS Completas', icon: FileCheck, exportResource: 'reports',
    columns: [
      { key: 'os_number', label: 'Nº OS' },
      { key: 'service_type', label: 'Tipo', isBadge: true },
      { key: 'status', label: 'Status', isBadge: true },
      { key: 'priority', label: 'Prioridade', isBadge: true },
      { key: 'created_at', label: 'Criado em', isDate: true },
    ],
  },
  {
    id: 'checklist', label: 'Checklist OS', icon: ClipboardList, exportResource: 'checklist_items',
    columns: [
      { key: 'label', label: 'Item', truncate: true },
      { key: 'item_type', label: 'Tipo', isBadge: true },
      { key: 'value_text', label: 'Valor Texto', truncate: true },
      { key: 'is_conformant', label: 'Conforme' },
      { key: 'created_at', label: 'Data', isDate: true },
    ],
  },
  {
    id: 'attachments', label: 'Anexos OS', icon: Paperclip, exportResource: 'attachments',
    columns: [
      { key: 'filename', label: 'Arquivo', truncate: true },
      { key: 'mime_type', label: 'Tipo MIME', isBadge: true },
      { key: 'size_bytes', label: 'Tamanho', isNum: true },
      { key: 'caption', label: 'Legenda', truncate: true },
      { key: 'created_at', label: 'Data', isDate: true },
    ],
  },
  {
    id: 'status_history', label: 'Hist. Status OS', icon: History, exportResource: 'status_history',
    columns: [
      { key: 'from_status', label: 'De', isBadge: true },
      { key: 'to_status', label: 'Para', isBadge: true },
      { key: 'comment', label: 'Comentário', truncate: true },
      { key: 'created_at', label: 'Data', isDate: true },
    ],
  },
  {
    id: 'signatures', label: 'Assinaturas', icon: PenLine, exportResource: 'signatures',
    columns: [
      { key: 'signature_type', label: 'Tipo', isBadge: true },
      { key: 'signer_name', label: 'Signatário' },
      { key: 'signer_role', label: 'Cargo' },
      { key: 'signed_at', label: 'Assinado em', isDate: true },
    ],
  },
  {
    id: 'reimbursements', label: 'Reembolsos', icon: Receipt, exportResource: 'reimbursements',
    columns: [
      { key: 'category', label: 'Categoria', isBadge: true },
      { key: 'amount', label: 'Valor', isNum: true },
      { key: 'status', label: 'Status', isBadge: true },
      { key: 'maintenance_type', label: 'Tipo Manutenção' },
      { key: 'created_at', label: 'Data', isDate: true },
    ],
  },
  {
    id: 'reimbursement_history', label: 'Hist. Reembolso', icon: History, exportResource: 'reimbursement_history',
    columns: [
      { key: 'old_status', label: 'De', isBadge: true },
      { key: 'new_status', label: 'Para', isBadge: true },
      { key: 'reason', label: 'Motivo', truncate: true },
      { key: 'created_at', label: 'Data', isDate: true },
    ],
  },
  {
    id: 'clients', label: 'Clientes', icon: Building2, exportResource: 'clients',
    columns: [
      { key: 'name', label: 'Nome' },
      { key: 'cnpj', label: 'CNPJ' },
      { key: 'cidade', label: 'Cidade' },
      { key: 'estado', label: 'UF' },
      { key: 'created_at', label: 'Cadastro', isDate: true },
    ],
  },
  {
    id: 'client_locations', label: 'Unidades', icon: MapPin, exportResource: 'client_locations',
    columns: [
      { key: 'nome', label: 'Unidade' },
      { key: 'logradouro', label: 'Endereço', truncate: true },
      { key: 'cidade', label: 'Cidade' },
      { key: 'created_at', label: 'Cadastro', isDate: true },
    ],
  },
  {
    id: 'orcamentos', label: 'Orçamentos', icon: FileText, exportResource: 'orcamentos',
    columns: [
      { key: 'titulo', label: 'Título', truncate: true },
      { key: 'status', label: 'Status', isBadge: true },
      { key: 'desconto_pct', label: 'Desconto %', isNum: true },
      { key: 'validade', label: 'Validade', isDate: true },
      { key: 'created_at', label: 'Criado em', isDate: true },
    ],
  },
  {
    id: 'equipments', label: 'Equipamentos', icon: Wrench, exportResource: 'equipments',
    columns: [
      { key: 'name', label: 'Nome' },
      { key: 'type', label: 'Tipo' },
      { key: 'status', label: 'Status', isBadge: true },
      { key: 'manufacturer', label: 'Fabricante' },
      { key: 'created_at', label: 'Cadastro', isDate: true },
    ],
  },
  {
    id: 'materials', label: 'Materiais', icon: Package, exportResource: 'materials',
    columns: [
      { key: 'request_number', label: 'Nº Req.' },
      { key: 'maintenance_type', label: 'Tipo', isBadge: true },
      { key: 'status', label: 'Status', isBadge: true },
      { key: 'urgency', label: 'Urgência', isBadge: true },
      { key: 'created_at', label: 'Criado em', isDate: true },
    ],
  },
  {
    id: 'notifications', label: 'Notificações', icon: Bell, exportResource: 'notifications',
    columns: [
      { key: 'title', label: 'Título', truncate: true },
      { key: 'message', label: 'Mensagem', truncate: true },
      { key: 'is_read', label: 'Lida' },
      { key: 'created_at', label: 'Data', isDate: true },
    ],
  },
];

const TAB_GROUPS: { label: string; ids: TabId[] }[] = [
  { label: 'Corpus IA',   ids: ['diagnostics', 'kb'] },
  { label: 'OS',          ids: ['reports', 'checklist', 'attachments', 'status_history', 'signatures'] },
  { label: 'Reembolsos',  ids: ['reimbursements', 'reimbursement_history'] },
  { label: 'Clientes',    ids: ['clients', 'client_locations'] },
  { label: 'Outros',      ids: ['orcamentos', 'equipments', 'materials', 'notifications'] },
];

const PAGE_SIZE = 25;

function initTabStates(): Record<TabId, TabData> {
  return Object.fromEntries(
    TAB_META.map(t => [t.id, { rows: [], page: 0, loading: false, hasMore: true }])
  ) as Record<TabId, TabData>;
}

function fmtDate(val: unknown): string {
  if (!val) return '—';
  try { return format(new Date(String(val)), 'dd MMM yy', { locale: ptBR }); }
  catch { return String(val); }
}

function fmtNum(val: unknown): string {
  if (val == null) return '—';
  const n = Number(val);
  return isNaN(n) ? String(val) : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

// ── Componente ────────────────────────────────────────────────────────────────

interface TenantOption { id: string; name: string; slug: string; }

export default function PlatformIntelligence() {
  const [stats, setStats]                 = useState<PlatformIntelligenceStats | null>(null);
  const [statsLoading, setStatsLoading]   = useState(true);
  const [tenants, setTenants]             = useState<TenantOption[]>([]);
  const [tenantFilter, setTenantFilter]   = useState<string>('');
  const [stFilter, setStFilter]           = useState<string>('');
  const [search, setSearch]               = useState('');
  const [activeTab, setActiveTab]         = useState<TabId>('diagnostics');
  const [tabStates, setTabStates]         = useState<Record<TabId, TabData>>(initTabStates);
  const [exporting, setExporting]         = useState(false);

  const activeTabMeta = useMemo(() => TAB_META.find(t => t.id === activeTab)!, [activeTab]);

  // ── Fetcher dispatch ──────────────────────────────────────────────────────

  const fetchTab = useCallback(async (
    tab: TabId, page: number, reset: boolean,
  ) => {
    setTabStates(prev => ({
      ...prev,
      [tab]: { ...prev[tab], loading: true },
    }));
    try {
      const tid = tenantFilter || null;
      const lim = PAGE_SIZE;
      const off = page * PAGE_SIZE;

      let rows: Record<string, unknown>[];
      const cast = (v: unknown) => v as unknown as Record<string, unknown>[];
      if (tab === 'diagnostics') {
        rows = cast(await getDiagnosticCorpus({ tenantId: tid, serviceType: stFilter || null, limit: lim, offset: off }));
      } else if (tab === 'kb') {
        rows = cast(await getKbCorpus({ tenantId: tid, serviceType: stFilter || null, limit: lim, offset: off }));
      } else if (tab === 'reports')              { rows = cast(await getAllReports(tid, lim, off)); }
      else if (tab === 'reimbursements')         { rows = cast(await getAllReimbursements(tid, lim, off)); }
      else if (tab === 'clients')                { rows = cast(await getAllClients(tid, lim, off)); }
      else if (tab === 'orcamentos')             { rows = cast(await getAllOrcamentos(tid, lim, off)); }
      else if (tab === 'equipments')             { rows = cast(await getAllEquipments(tid, lim, off)); }
      else if (tab === 'materials')              { rows = cast(await getAllMaterials(tid, lim, off)); }
      else if (tab === 'checklist')              { rows = cast(await getAllChecklistItems(tid, lim, off)); }
      else if (tab === 'attachments')            { rows = cast(await getAllAttachments(tid, lim, off)); }
      else if (tab === 'status_history')         { rows = cast(await getAllStatusHistory(tid, lim, off)); }
      else if (tab === 'signatures')             { rows = cast(await getAllSignatures(tid, lim, off)); }
      else if (tab === 'reimbursement_history')  { rows = cast(await getAllReimbursementHistory(tid, lim, off)); }
      else if (tab === 'client_locations')       { rows = cast(await getAllClientLocations(tid, lim, off)); }
      else                                       { rows = cast(await getAllNotifications(tid, lim, off)); }

      setTabStates(prev => ({
        ...prev,
        [tab]: {
          rows: reset ? rows : [...prev[tab].rows, ...rows],
          page,
          loading: false,
          hasMore: rows.length === PAGE_SIZE,
        },
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao carregar dados', { description: msg });
      setTabStates(prev => ({ ...prev, [tab]: { ...prev[tab], loading: false } }));
    }
  }, [tenantFilter, stFilter]);

  // ── Efeitos ───────────────────────────────────────────────────────────────

  useEffect(() => {
    setStatsLoading(true);
    getIntelligenceStats()
      .then(setStats)
      .catch((err: Error) => toast.error('Erro ao carregar métricas', { description: err.message }))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    supabase.rpc('get_platform_tenants').then(({ data }) => {
      setTenants(((data ?? []) as TenantOption[]).map((t: TenantOption) => ({ id: t.id, name: t.name, slug: t.slug })));
    });
  }, []);

  useEffect(() => {
    setTabStates(prev => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], rows: [], page: 0, hasMore: true },
    }));
    fetchTab(activeTab, 0, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, tenantFilter, stFilter]);

  // ── Filtro de busca local ─────────────────────────────────────────────────

  const currentRows = tabStates[activeTab].rows;
  const searchCols  = activeTabMeta.columns.filter(c => c.truncate || (!c.isDate && !c.isNum && !c.isBadge)).map(c => c.key);

  const displayRows = useMemo(() => {
    if (!search) return currentRows;
    const q = search.toLowerCase();
    return currentRows.filter(r =>
      searchCols.some(k => String(r[k] ?? '').toLowerCase().includes(q))
    );
  }, [currentRows, search, searchCols]);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = async (fmt: 'json' | 'csv') => {
    setExporting(true);
    const tid = tenantFilter || null;
    try {
      let rows: unknown[];
      const res = activeTabMeta.exportResource;
      if (activeTab === 'diagnostics')           { rows = await fetchAllDiagnosticsForExport({ tenantId: tid, serviceType: stFilter || null }); }
      else if (activeTab === 'kb')               { rows = await fetchAllKbForExport({ tenantId: tid, serviceType: stFilter || null }); }
      else if (activeTab === 'reports')          { rows = await fetchAllReportsForExport(tid); }
      else if (activeTab === 'reimbursements')   { rows = await fetchAllReimbursementsForExport(tid); }
      else if (activeTab === 'clients')          { rows = await fetchAllClientsForExport(tid); }
      else if (activeTab === 'orcamentos')       { rows = await fetchAllOrcamentosForExport(tid); }
      else if (activeTab === 'equipments')       { rows = await fetchAllEquipmentsForExport(tid); }
      else if (activeTab === 'materials')        { rows = await fetchAllMaterialsForExport(tid); }
      else if (activeTab === 'checklist')        { rows = await fetchAllChecklistItemsForExport(tid); }
      else if (activeTab === 'attachments')      { rows = await fetchAllAttachmentsForExport(tid); }
      else if (activeTab === 'status_history')   { rows = await fetchAllStatusHistoryForExport(tid); }
      else if (activeTab === 'signatures')       { rows = await fetchAllSignaturesForExport(tid); }
      else if (activeTab === 'reimbursement_history') { rows = await fetchAllReimbursementHistoryForExport(tid); }
      else if (activeTab === 'client_locations') { rows = await fetchAllClientLocationsForExport(tid); }
      else                                       { rows = await fetchAllNotificationsForExport(tid); }

      const blob = fmt === 'json' ? toJsonBlob(rows) : toCsvBlob(rows as Record<string, unknown>[]);
      downloadBlob(blob, `nextai-${res}-${Date.now()}.${fmt}`);
      await logExport(res, tid, rows.length);
      toast.success(`${rows.length} registros exportados.`);
    } catch (err: unknown) {
      toast.error('Erro ao exportar', { description: err instanceof Error ? err.message : 'Erro' });
    } finally {
      setExporting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const { loading, hasMore, page } = tabStates[activeTab];

  return (
    <div className="flex flex-col gap-6 h-full w-full pb-8 animate-in fade-in duration-300">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          Inteligência
        </h1>
        <p className="text-sm text-muted-foreground">
          Acesso cross-tenant completo — corpus IA + 13 tabelas operacionais.
        </p>
      </div>

      {/* Banner de transparência */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3">
        <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Corpus IA</strong> é anonimizado (sem PII, sem GPS, sem notas internas).
          As demais abas exibem dados brutos operacionais — visíveis apenas ao SuperMaster.
          Todos os acessos são registrados na trilha de auditoria.
        </p>
      </div>

      {/* Cards de métricas */}
      {statsLoading ? (
        <div className="flex items-center justify-center h-28">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'OS no Corpus',        value: stats.total_reports,        icon: Stethoscope, color: 'text-indigo-500' },
            { label: 'Com Diagnóstico IA',   value: stats.reports_with_diag,    icon: Brain,       color: 'text-violet-500' },
            { label: 'Artigos KB',           value: stats.total_kb,             icon: BookOpen,    color: 'text-emerald-500' },
            { label: 'Tenants Contribuindo', value: stats.tenants_contributing, icon: Building2,   color: 'text-amber-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <div className={`p-2 rounded-lg bg-muted ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Breakdown por tipo de serviço */}
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

      {/* Tabs agrupadas */}
      <div className="flex flex-col gap-0 border-b border-border">
        {TAB_GROUPS.map(group => (
          <div key={group.label} className="flex items-center gap-0 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 w-20 shrink-0 pl-1 py-2 hidden sm:block">
              {group.label}
            </span>
            <div className="flex items-center gap-0 flex-wrap">
              {group.ids.map(id => {
                const meta = TAB_META.find(t => t.id === id)!;
                const Icon = meta.icon;
                return (
                  <button
                    key={id}
                    onClick={() => { setActiveTab(id); setSearch(''); }}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                      activeTab === id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Filtros + Export */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1">
          {/* Filtro tenant */}
          <Select value={tenantFilter} onValueChange={v => setTenantFilter(v === '_all' ? '' : v)}>
            <SelectTrigger className="h-9 w-44 rounded-lg text-sm">
              <SelectValue placeholder="Todas as empresas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas as empresas</SelectItem>
              {tenants.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro service_type (apenas corpus) */}
          {(activeTab === 'diagnostics' || activeTab === 'kb') && (
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

          {/* Busca local */}
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

        {/* Export */}
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
          <Button size="sm" className="h-9 rounded-lg gap-1.5 font-semibold"
            onClick={() => handleExport('json')} disabled={exporting}>
            <Download className="h-3.5 w-3.5" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Tabela genérica */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {loading && currentRows.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent border-border">
                  {activeTabMeta.columns.map(col => (
                    <TableHead key={col.key} className="font-semibold whitespace-nowrap">
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRows.map((row, i) => (
                  <TableRow key={String(row.id ?? row.report_id ?? i)} className="hover:bg-muted/50 transition-colors border-border align-top">
                    {activeTabMeta.columns.map(col => {
                      const raw = row[col.key];
                      return (
                        <TableCell key={col.key} className={col.truncate ? 'max-w-[220px]' : 'whitespace-nowrap'}>
                          {col.isDate ? (
                            <span className="text-sm text-muted-foreground">{fmtDate(raw)}</span>
                          ) : col.isNum ? (
                            <span className="text-sm tabular-nums">{fmtNum(raw)}</span>
                          ) : col.isBadge ? (
                            raw != null
                              ? <Badge variant="outline" className="text-xs">{String(raw)}</Badge>
                              : <span className="text-muted-foreground">—</span>
                          ) : col.truncate ? (
                            <p className="text-sm text-muted-foreground line-clamp-2">{raw != null ? String(raw) : '—'}</p>
                          ) : (
                            <span className="text-sm">
                              {raw == null ? '—' : typeof raw === 'boolean' ? (raw ? '✓' : '✗') : String(raw)}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {displayRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={activeTabMeta.columns.length} className="h-24 text-center text-muted-foreground">
                      {search ? 'Nenhum resultado para a busca.' : 'Nenhum registro encontrado.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Carregar mais */}
        {hasMore && !search && (
          <div className="p-4 border-t border-border flex justify-center">
            <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold"
              disabled={loading}
              onClick={() => {
                const next = page + 1;
                setTabStates(prev => ({ ...prev, [activeTab]: { ...prev[activeTab], page: next } }));
                fetchTab(activeTab, next, false);
              }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Carregar mais
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
