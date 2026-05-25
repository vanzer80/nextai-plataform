import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Brain, FileJson, FileText, Loader2, ShieldCheck, AlertTriangle,
  BarChart3, BookOpen, Stethoscope, Building2, Search,
  ClipboardList, Banknote, Users, Receipt, Wrench, Package,
  CheckSquare, Paperclip, History, PenLine, Bell,
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
  getAllChecklistItems, getAllAttachments, getAllReportStatusHistory,
  getAllSignatures, getAllReimbursementHistory, getAllClientLocations, getAllNotifications,
  logExport,
  fetchAllDiagnosticsForExport, fetchAllKbForExport,
  fetchAllReportsForExport, fetchAllReimbursementsForExport, fetchAllClientsForExport,
  fetchAllOrcamentosForExport, fetchAllEquipmentsForExport, fetchAllMaterialsForExport,
  fetchAllChecklistForExport, fetchAllAttachmentsForExport, fetchAllRptStatusHxForExport,
  fetchAllSignaturesForExport, fetchAllReimHxForExport, fetchAllLocationsForExport,
  fetchAllNotificationsForExport,
  downloadBlob, toJsonBlob, toCsvBlob,
} from '@/src/services/platformIntelligenceService';
import type {
  PlatformIntelligenceStats,
  PlatformDiagnosticRow, PlatformKbRow,
  PlatformReportRow, PlatformReimbursementRow, PlatformClientRow,
  PlatformOrcamentoRow, PlatformEquipmentRow, PlatformMaterialRow,
  PlatformChecklistItemRow, PlatformAttachmentRow,
  PlatformReportStatusHistoryRow, PlatformSignatureRow,
  PlatformReimbursementHistoryRow, PlatformClientLocationRow,
  PlatformNotificationRow,
} from '@/src/types/platformIntelligence';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return format(new Date(d.includes('T') ? d : d + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR });
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  return format(new Date(d), 'dd/MM/yy HH:mm', { locale: ptBR });
}

function BRL(v: number | null | undefined): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function statusVariant(status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!status) return 'outline';
  const s = status.toLowerCase();
  if (['aprovad', 'approved', 'pago', 'delivered', 'purchased', 'entregue', 'conformant'].some(v => s.includes(v))) return 'default';
  if (['rejeit', 'rejected', 'cancelled', 'cancelad', 'não conforme'].some(v => s.includes(v))) return 'destructive';
  if (['draft', 'rascunho'].some(v => s.includes(v))) return 'outline';
  return 'secondary';
}

// ── Tab definitions ───────────────────────────────────────────────────────────

type ActiveTab =
  | 'diagnostics' | 'kb'
  | 'reports' | 'checklist' | 'attachments' | 'report_history' | 'signatures'
  | 'reimbursements' | 'reim_history'
  | 'clients' | 'locations'
  | 'orcamentos' | 'equipments' | 'materials'
  | 'notifications';

const TABS: { id: ActiveTab; label: string; icon: React.ElementType; raw: boolean }[] = [
  { id: 'diagnostics',   label: 'Diagnósticos',   icon: Stethoscope,   raw: false },
  { id: 'kb',            label: 'Base KB',         icon: BookOpen,      raw: false },
  { id: 'reports',       label: 'OS Completas',    icon: ClipboardList, raw: true  },
  { id: 'checklist',     label: 'Checklist OS',    icon: CheckSquare,   raw: true  },
  { id: 'attachments',   label: 'Anexos OS',       icon: Paperclip,     raw: true  },
  { id: 'report_history',label: 'Hist. Status OS', icon: History,       raw: true  },
  { id: 'signatures',    label: 'Assinaturas',     icon: PenLine,       raw: true  },
  { id: 'reimbursements',label: 'Reembolsos',      icon: Banknote,      raw: true  },
  { id: 'reim_history',  label: 'Hist. Reem.',     icon: History,       raw: true  },
  { id: 'clients',       label: 'Clientes',        icon: Users,         raw: true  },
  { id: 'locations',     label: 'Unidades',        icon: Building2,     raw: true  },
  { id: 'orcamentos',    label: 'Orçamentos',      icon: Receipt,       raw: true  },
  { id: 'equipments',    label: 'Equipamentos',    icon: Wrench,        raw: true  },
  { id: 'materials',     label: 'Materiais',       icon: Package,       raw: true  },
  { id: 'notifications', label: 'Notificações',    icon: Bell,          raw: true  },
];

interface TenantOption { id: string; name: string; slug: string; }

// ── Macros para estado de aba paginada ────────────────────────────────────────

function useTabState<T>() {
  const [rows, setRows]       = useState<T[]>([]);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  return { rows, setRows, page, setPage, loading, setLoading, hasMore, setHasMore };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlatformIntelligence() {

  const [stats, setStats]               = useState<PlatformIntelligenceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeTab, setActiveTab]       = useState<ActiveTab>('diagnostics');
  const isRaw = TABS.find(t => t.id === activeTab)?.raw ?? false;

  const [tenants, setTenants]           = useState<TenantOption[]>([]);
  const [tenantFilter, setTenantFilter] = useState('');
  const [stFilter, setStFilter]         = useState('');
  const [search, setSearch]             = useState('');
  const [exporting, setExporting]       = useState(false);

  // Per-tab state
  const diag   = useTabState<PlatformDiagnosticRow>();
  const kb     = useTabState<PlatformKbRow>();
  const rpt    = useTabState<PlatformReportRow>();
  const chk    = useTabState<PlatformChecklistItemRow>();
  const att    = useTabState<PlatformAttachmentRow>();
  const rsh    = useTabState<PlatformReportStatusHistoryRow>();
  const sig    = useTabState<PlatformSignatureRow>();
  const reim   = useTabState<PlatformReimbursementRow>();
  const reimhx = useTabState<PlatformReimbursementHistoryRow>();
  const cli    = useTabState<PlatformClientRow>();
  const loc    = useTabState<PlatformClientLocationRow>();
  const orc    = useTabState<PlatformOrcamentoRow>();
  const equip  = useTabState<PlatformEquipmentRow>();
  const mat    = useTabState<PlatformMaterialRow>();
  const notif  = useTabState<PlatformNotificationRow>();

  const tenantMap = useMemo(
    () => Object.fromEntries(tenants.map(t => [t.id, t.name])),
    [tenants],
  );
  const tn = (id: string | null | undefined) => (id ? (tenantMap[id] ?? id.slice(0, 8) + '…') : '—');

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    getIntelligenceStats()
      .then(setStats)
      .catch((e: Error) => toast.error('Erro ao carregar métricas', { description: e.message }))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    supabase.rpc('get_platform_tenants').then(({ data }) => {
      setTenants(((data ?? []) as TenantOption[]).map((t: any) => ({ id: t.id, name: t.name, slug: t.slug })));
    });
  }, []);

  // ── Load callbacks (corpus usa stFilter; raw não) ─────────────────────────

  function makeLoader<T>(
    fetchFn: (f: { tenantId: string | null; limit: number; offset: number }) => Promise<T[]>,
    tab: ReturnType<typeof useTabState<T>>,
    errLabel: string,
    useStFilter = false,
  ) {
    return useCallback(async (page: number, reset: boolean) => {
      tab.setLoading(true);
      try {
        const rows = await fetchFn({
          tenantId: tenantFilter || null,
          limit: PAGE_SIZE, offset: page * PAGE_SIZE,
        } as any);
        tab.setRows(prev => reset ? rows : [...prev, ...rows]);
        tab.setHasMore(rows.length === PAGE_SIZE);
      } catch (e: any) {
        toast.error(`Erro ao carregar ${errLabel}`, { description: e.message });
      } finally { tab.setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, useStFilter ? [tenantFilter, stFilter] : [tenantFilter]);
  }

  // Infelizmente useCallback não pode ser chamado dentro de outra função
  // (violaria regra de hooks), então declaramos individualmente:

  const loadDiag = useCallback(async (page: number, reset: boolean) => {
    diag.setLoading(true);
    try {
      const rows = await getDiagnosticCorpus({ tenantId: tenantFilter || null, serviceType: stFilter || null, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      diag.setRows(prev => reset ? rows : [...prev, ...rows]);
      diag.setHasMore(rows.length === PAGE_SIZE);
    } catch (e: any) { toast.error('Erro ao carregar diagnósticos', { description: e.message }); }
    finally { diag.setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter, stFilter]);

  const loadKb = useCallback(async (page: number, reset: boolean) => {
    kb.setLoading(true);
    try {
      const rows = await getKbCorpus({ tenantId: tenantFilter || null, serviceType: stFilter || null, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      kb.setRows(prev => reset ? rows : [...prev, ...rows]);
      kb.setHasMore(rows.length === PAGE_SIZE);
    } catch (e: any) { toast.error('Erro ao carregar artigos KB', { description: e.message }); }
    finally { kb.setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter, stFilter]);

  const loadRpt = useCallback(async (p: number, r: boolean) => {
    rpt.setLoading(true);
    try { const rows = await getAllReports({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: p * PAGE_SIZE }); rpt.setRows(prev => r ? rows : [...prev, ...rows]); rpt.setHasMore(rows.length === PAGE_SIZE); }
    catch (e: any) { toast.error('Erro ao carregar OS', { description: e.message }); }
    finally { rpt.setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter]);

  const loadChk = useCallback(async (p: number, r: boolean) => {
    chk.setLoading(true);
    try { const rows = await getAllChecklistItems({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: p * PAGE_SIZE }); chk.setRows(prev => r ? rows : [...prev, ...rows]); chk.setHasMore(rows.length === PAGE_SIZE); }
    catch (e: any) { toast.error('Erro ao carregar checklist', { description: e.message }); }
    finally { chk.setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter]);

  const loadAtt = useCallback(async (p: number, r: boolean) => {
    att.setLoading(true);
    try { const rows = await getAllAttachments({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: p * PAGE_SIZE }); att.setRows(prev => r ? rows : [...prev, ...rows]); att.setHasMore(rows.length === PAGE_SIZE); }
    catch (e: any) { toast.error('Erro ao carregar anexos', { description: e.message }); }
    finally { att.setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter]);

  const loadRsh = useCallback(async (p: number, r: boolean) => {
    rsh.setLoading(true);
    try { const rows = await getAllReportStatusHistory({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: p * PAGE_SIZE }); rsh.setRows(prev => r ? rows : [...prev, ...rows]); rsh.setHasMore(rows.length === PAGE_SIZE); }
    catch (e: any) { toast.error('Erro ao carregar histórico OS', { description: e.message }); }
    finally { rsh.setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter]);

  const loadSig = useCallback(async (p: number, r: boolean) => {
    sig.setLoading(true);
    try { const rows = await getAllSignatures({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: p * PAGE_SIZE }); sig.setRows(prev => r ? rows : [...prev, ...rows]); sig.setHasMore(rows.length === PAGE_SIZE); }
    catch (e: any) { toast.error('Erro ao carregar assinaturas', { description: e.message }); }
    finally { sig.setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter]);

  const loadReim = useCallback(async (p: number, r: boolean) => {
    reim.setLoading(true);
    try { const rows = await getAllReimbursements({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: p * PAGE_SIZE }); reim.setRows(prev => r ? rows : [...prev, ...rows]); reim.setHasMore(rows.length === PAGE_SIZE); }
    catch (e: any) { toast.error('Erro ao carregar reembolsos', { description: e.message }); }
    finally { reim.setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter]);

  const loadReimHx = useCallback(async (p: number, r: boolean) => {
    reimhx.setLoading(true);
    try { const rows = await getAllReimbursementHistory({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: p * PAGE_SIZE }); reimhx.setRows(prev => r ? rows : [...prev, ...rows]); reimhx.setHasMore(rows.length === PAGE_SIZE); }
    catch (e: any) { toast.error('Erro ao carregar histórico reembolsos', { description: e.message }); }
    finally { reimhx.setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter]);

  const loadCli = useCallback(async (p: number, r: boolean) => {
    cli.setLoading(true);
    try { const rows = await getAllClients({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: p * PAGE_SIZE }); cli.setRows(prev => r ? rows : [...prev, ...rows]); cli.setHasMore(rows.length === PAGE_SIZE); }
    catch (e: any) { toast.error('Erro ao carregar clientes', { description: e.message }); }
    finally { cli.setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter]);

  const loadLoc = useCallback(async (p: number, r: boolean) => {
    loc.setLoading(true);
    try { const rows = await getAllClientLocations({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: p * PAGE_SIZE }); loc.setRows(prev => r ? rows : [...prev, ...rows]); loc.setHasMore(rows.length === PAGE_SIZE); }
    catch (e: any) { toast.error('Erro ao carregar unidades', { description: e.message }); }
    finally { loc.setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter]);

  const loadOrc = useCallback(async (p: number, r: boolean) => {
    orc.setLoading(true);
    try { const rows = await getAllOrcamentos({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: p * PAGE_SIZE }); orc.setRows(prev => r ? rows : [...prev, ...rows]); orc.setHasMore(rows.length === PAGE_SIZE); }
    catch (e: any) { toast.error('Erro ao carregar orçamentos', { description: e.message }); }
    finally { orc.setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter]);

  const loadEquip = useCallback(async (p: number, r: boolean) => {
    equip.setLoading(true);
    try { const rows = await getAllEquipments({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: p * PAGE_SIZE }); equip.setRows(prev => r ? rows : [...prev, ...rows]); equip.setHasMore(rows.length === PAGE_SIZE); }
    catch (e: any) { toast.error('Erro ao carregar equipamentos', { description: e.message }); }
    finally { equip.setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter]);

  const loadMat = useCallback(async (p: number, r: boolean) => {
    mat.setLoading(true);
    try { const rows = await getAllMaterials({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: p * PAGE_SIZE }); mat.setRows(prev => r ? rows : [...prev, ...rows]); mat.setHasMore(rows.length === PAGE_SIZE); }
    catch (e: any) { toast.error('Erro ao carregar materiais', { description: e.message }); }
    finally { mat.setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter]);

  const loadNotif = useCallback(async (p: number, r: boolean) => {
    notif.setLoading(true);
    try { const rows = await getAllNotifications({ tenantId: tenantFilter || null, limit: PAGE_SIZE, offset: p * PAGE_SIZE }); notif.setRows(prev => r ? rows : [...prev, ...rows]); notif.setHasMore(rows.length === PAGE_SIZE); }
    catch (e: any) { toast.error('Erro ao carregar notificações', { description: e.message }); }
    finally { notif.setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter]);

  // Corpus tabs (respondem ao stFilter)
  useEffect(() => {
    if (activeTab === 'diagnostics') { diag.setPage(0); loadDiag(0, true); }
    else if (activeTab === 'kb')     { kb.setPage(0);   loadKb(0, true);   }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, tenantFilter, stFilter, loadDiag, loadKb]);

  // Raw tabs (só tenant)
  useEffect(() => {
    const map: Partial<Record<ActiveTab, () => void>> = {
      reports:        () => { rpt.setPage(0);    loadRpt(0, true);    },
      checklist:      () => { chk.setPage(0);    loadChk(0, true);    },
      attachments:    () => { att.setPage(0);    loadAtt(0, true);    },
      report_history: () => { rsh.setPage(0);    loadRsh(0, true);    },
      signatures:     () => { sig.setPage(0);    loadSig(0, true);    },
      reimbursements: () => { reim.setPage(0);   loadReim(0, true);   },
      reim_history:   () => { reimhx.setPage(0); loadReimHx(0, true); },
      clients:        () => { cli.setPage(0);    loadCli(0, true);    },
      locations:      () => { loc.setPage(0);    loadLoc(0, true);    },
      orcamentos:     () => { orc.setPage(0);    loadOrc(0, true);    },
      equipments:     () => { equip.setPage(0);  loadEquip(0, true);  },
      materials:      () => { mat.setPage(0);    loadMat(0, true);    },
      notifications:  () => { notif.setPage(0);  loadNotif(0, true);  },
    };
    map[activeTab]?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, tenantFilter,
      loadRpt, loadChk, loadAtt, loadRsh, loadSig,
      loadReim, loadReimHx, loadCli, loadLoc,
      loadOrc, loadEquip, loadMat, loadNotif]);

  // ── Busca local ────────────────────────────────────────────────────────────

  const sl = search.toLowerCase();
  const fDiag   = sl ? diag.rows.filter(r   => [r.reported_problem, r.final_diagnosis, r.preliminary_diagnosis, r.technical_recommendation].some(f => f?.toLowerCase().includes(sl))) : diag.rows;
  const fKb     = sl ? kb.rows.filter(r     => [r.title, r.content].some(f => f?.toLowerCase().includes(sl))) : kb.rows;
  const fRpt    = sl ? rpt.rows.filter(r    => [r.os_number, r.reported_problem, r.technician_name, r.client_name].some(f => f?.toLowerCase().includes(sl))) : rpt.rows;
  const fChk    = sl ? chk.rows.filter(r    => [r.label, r.value_text, r.os_number].some(f => f?.toLowerCase().includes(sl))) : chk.rows;
  const fAtt    = sl ? att.rows.filter(r    => [r.filename, r.caption, r.os_number, r.uploader_name].some(f => f?.toLowerCase().includes(sl))) : att.rows;
  const fRsh    = sl ? rsh.rows.filter(r    => [r.os_number, r.to_status, r.changed_by_name, r.comment].some(f => f?.toLowerCase().includes(sl))) : rsh.rows;
  const fSig    = sl ? sig.rows.filter(r    => [r.os_number, r.signer_name, r.signer_role].some(f => f?.toLowerCase().includes(sl))) : sig.rows;
  const fReim   = sl ? reim.rows.filter(r   => [r.favorecido, r.description, r.submitter_name, r.client_name].some(f => f?.toLowerCase().includes(sl))) : reim.rows;
  const fReimHx = sl ? reimhx.rows.filter(r => [r.reimbursement_desc, r.changed_by_name, r.new_status].some(f => f?.toLowerCase().includes(sl))) : reimhx.rows;
  const fCli    = sl ? cli.rows.filter(r    => [r.name, r.cnpj, r.contato_nome, r.contato_email].some(f => f?.toLowerCase().includes(sl))) : cli.rows;
  const fLoc    = sl ? loc.rows.filter(r    => [r.client_name, r.nome, r.cidade, r.contato_nome].some(f => f?.toLowerCase().includes(sl))) : loc.rows;
  const fOrc    = sl ? orc.rows.filter(r    => [r.titulo, r.client_name, r.technician_name].some(f => f?.toLowerCase().includes(sl))) : orc.rows;
  const fEquip  = sl ? equip.rows.filter(r  => [r.name, r.serial_number, r.client_name, r.manufacturer].some(f => f?.toLowerCase().includes(sl))) : equip.rows;
  const fMat    = sl ? mat.rows.filter(r    => [r.item, r.requester_name, r.client_name, r.supplier_name].some(f => f?.toLowerCase().includes(sl))) : mat.rows;
  const fNotif  = sl ? notif.rows.filter(r  => [r.title, r.message, r.user_name].some(f => f?.toLowerCase().includes(sl))) : notif.rows;

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = async (fmt: 'json' | 'csv') => {
    setExporting(true);
    const tid = tenantFilter || null;
    try {
      let rows: unknown[] = [];
      let resource: Parameters<typeof logExport>[0] = 'reports';
      let filename = `nextai-export-${Date.now()}.${fmt}`;

      if      (activeTab === 'diagnostics')   { rows = await fetchAllDiagnosticsForExport({ tenantId: tid, serviceType: stFilter || null }); resource = 'diagnostics';         filename = `nextai-diagnosticos.${fmt}`; }
      else if (activeTab === 'kb')            { rows = await fetchAllKbForExport({ tenantId: tid, serviceType: stFilter || null });          resource = 'kb';                  filename = `nextai-kb.${fmt}`; }
      else if (activeTab === 'reports')       { rows = await fetchAllReportsForExport(tid);        resource = 'reports';             filename = `nextai-os.${fmt}`; }
      else if (activeTab === 'checklist')     { rows = await fetchAllChecklistForExport(tid);      resource = 'checklist_items';     filename = `nextai-checklist.${fmt}`; }
      else if (activeTab === 'attachments')   { rows = await fetchAllAttachmentsForExport(tid);    resource = 'attachments';         filename = `nextai-anexos.${fmt}`; }
      else if (activeTab === 'report_history'){ rows = await fetchAllRptStatusHxForExport(tid);    resource = 'report_status_history'; filename = `nextai-historico-os.${fmt}`; }
      else if (activeTab === 'signatures')    { rows = await fetchAllSignaturesForExport(tid);     resource = 'signatures';          filename = `nextai-assinaturas.${fmt}`; }
      else if (activeTab === 'reimbursements'){ rows = await fetchAllReimbursementsForExport(tid); resource = 'reimbursements';      filename = `nextai-reembolsos.${fmt}`; }
      else if (activeTab === 'reim_history')  { rows = await fetchAllReimHxForExport(tid);         resource = 'reimbursement_history'; filename = `nextai-hist-reem.${fmt}`; }
      else if (activeTab === 'clients')       { rows = await fetchAllClientsForExport(tid);        resource = 'clients';             filename = `nextai-clientes.${fmt}`; }
      else if (activeTab === 'locations')     { rows = await fetchAllLocationsForExport(tid);      resource = 'client_locations';    filename = `nextai-unidades.${fmt}`; }
      else if (activeTab === 'orcamentos')    { rows = await fetchAllOrcamentosForExport(tid);     resource = 'orcamentos';          filename = `nextai-orcamentos.${fmt}`; }
      else if (activeTab === 'equipments')    { rows = await fetchAllEquipmentsForExport(tid);     resource = 'equipments';          filename = `nextai-equipamentos.${fmt}`; }
      else if (activeTab === 'materials')     { rows = await fetchAllMaterialsForExport(tid);      resource = 'materials';           filename = `nextai-materiais.${fmt}`; }
      else if (activeTab === 'notifications') { rows = await fetchAllNotificationsForExport(tid);  resource = 'notifications';       filename = `nextai-notificacoes.${fmt}`; }

      const blob = fmt === 'json' ? toJsonBlob(rows) : toCsvBlob(rows as Record<string, unknown>[]);
      downloadBlob(blob, filename);
      await logExport(resource, tid, rows.length);
      toast.success(`${rows.length} registros exportados.`);
    } catch (e: any) {
      toast.error('Erro ao exportar', { description: e.message });
    } finally { setExporting(false); }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const Spinner = () => <div className="flex items-center justify-center h-48"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  function LoadMore({ tab, load }: { tab: ReturnType<typeof useTabState<any>>; load: (p: number, r: boolean) => void }) {
    if (!tab.hasMore || search) return null;
    return (
      <div className="p-4 border-t border-border flex justify-center">
        <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold" disabled={tab.loading}
          onClick={() => { const n = tab.page + 1; tab.setPage(n); load(n, false); }}>
          {tab.loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Carregar mais
        </Button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 h-full w-full pb-8 animate-in fade-in duration-300">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" /> Inteligência
        </h1>
        <p className="text-sm text-muted-foreground">Acesso completo cross-tenant — análise, corpus IA e exportação.</p>
      </div>

      {/* Banner */}
      {!isRaw ? (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3">
          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Dados <strong>anonimizados</strong> para corpus de IA: sem PII, sem GPS, sem notas internas.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Dados <strong>completos e não anonimizados</strong>. Acesso exclusivo SuperMaster NextAI. Toda exportação é auditada.
          </p>
        </div>
      )}

      {/* Metric cards */}
      {statsLoading ? (
        <div className="flex items-center justify-center h-28"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'OS no Corpus',       value: stats.total_reports,        icon: Stethoscope, color: 'text-indigo-500' },
            { label: 'Com Diagnóstico IA', value: stats.reports_with_diag,    icon: Brain,       color: 'text-violet-500' },
            { label: 'Artigos KB',         value: stats.total_kb,             icon: BookOpen,    color: 'text-emerald-500' },
            { label: 'Tenants Ativos',     value: stats.tenants_contributing, icon: Building2,   color: 'text-amber-500'  },
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

      {/* Breakdown por tipo */}
      {stats && stats.by_service_type.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5" /> OS por Tipo de Serviço
          </p>
          <div className="flex flex-wrap gap-2">
            {stats.by_service_type.map(({ service_type, n }) => (
              <Badge key={service_type} variant="secondary" className="text-sm font-semibold">{service_type} — {n}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto scrollbar-none">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setActiveTab(id); setSearch(''); }}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap shrink-0 ${
              activeTab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* Filtros + Export */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1">
          <Select value={tenantFilter} onValueChange={v => setTenantFilter(v === '_all' ? '' : v)}>
            <SelectTrigger className="h-9 w-44 rounded-lg text-sm"><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas as empresas</SelectItem>
              {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {!isRaw && (
            <Select value={stFilter} onValueChange={v => setStFilter(v === '_all' ? '' : v)}>
              <SelectTrigger className="h-9 w-44 rounded-lg text-sm"><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
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
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="h-9 pl-8 rounded-lg text-sm w-48" />
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="h-9 rounded-lg gap-1.5 font-semibold" onClick={() => handleExport('json')} disabled={exporting}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileJson className="h-3.5 w-3.5" />} JSON
          </Button>
          <Button size="sm" variant="outline" className="h-9 rounded-lg gap-1.5 font-semibold" onClick={() => handleExport('csv')} disabled={exporting}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} CSV
          </Button>
        </div>
      </div>

      {/* ── Diagnósticos ─────────────────────────────────────────────────────── */}
      {activeTab === 'diagnostics' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {diag.loading && !diag.rows.length ? <Spinner /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-semibold">Empresa</TableHead><TableHead className="font-semibold">Tipo</TableHead>
                <TableHead className="font-semibold">Problema</TableHead><TableHead className="font-semibold">Diagnóstico</TableHead>
                <TableHead className="font-semibold">Recomendação</TableHead><TableHead className="font-semibold whitespace-nowrap">Data</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fDiag.map(r => (
                  <TableRow key={r.report_id} className="hover:bg-muted/50 transition-colors border-border align-top">
                    <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.tenant_id)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.service_type ?? '—'}</Badge></TableCell>
                    <TableCell className="text-sm max-w-[200px]"><p className="line-clamp-3 text-muted-foreground">{r.reported_problem ?? '—'}</p></TableCell>
                    <TableCell className="text-sm max-w-[220px]"><p className="line-clamp-3">{r.final_diagnosis ?? r.preliminary_diagnosis ?? '—'}</p></TableCell>
                    <TableCell className="text-sm max-w-[200px]"><p className="line-clamp-3 text-muted-foreground">{r.technical_recommendation ?? r.services_performed ?? '—'}</p></TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDate(r.service_date)}</TableCell>
                  </TableRow>
                ))}
                {!fDiag.length && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">{search ? 'Nenhum resultado.' : 'Nenhuma OS aprovada no corpus.'}</TableCell></TableRow>}
              </TableBody>
            </Table></div>
          )}
          <LoadMore tab={diag} load={loadDiag} />
        </div>
      )}

      {/* ── Base KB ──────────────────────────────────────────────────────────── */}
      {activeTab === 'kb' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {kb.loading && !kb.rows.length ? <Spinner /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-semibold">Empresa</TableHead><TableHead className="font-semibold">Título</TableHead>
                <TableHead className="font-semibold">Tipo</TableHead><TableHead className="font-semibold">Tags</TableHead>
                <TableHead className="font-semibold">Views</TableHead><TableHead className="font-semibold whitespace-nowrap">Criado</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fKb.map(r => (
                  <TableRow key={r.article_id} className="hover:bg-muted/50 transition-colors border-border align-top">
                    <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.tenant_id)}</TableCell>
                    <TableCell className="text-sm max-w-[260px]"><p className="line-clamp-2 font-medium">{r.title}</p><p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.content}</p></TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.service_type ?? '—'}</Badge></TableCell>
                    <TableCell className="max-w-[160px]"><div className="flex flex-wrap gap-1">{(r.tags ?? []).slice(0, 3).map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}{(r.tags ?? []).length > 3 && <Badge variant="secondary" className="text-xs">+{r.tags.length - 3}</Badge>}</div></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.view_count}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                  </TableRow>
                ))}
                {!fKb.length && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">{search ? 'Nenhum resultado.' : 'Nenhum artigo.'}</TableCell></TableRow>}
              </TableBody>
            </Table></div>
          )}
          <LoadMore tab={kb} load={loadKb} />
        </div>
      )}

      {/* ── OS Completas ─────────────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {rpt.loading && !rpt.rows.length ? <Spinner /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-semibold">Empresa</TableHead><TableHead className="font-semibold">OS#</TableHead>
                <TableHead className="font-semibold">Status</TableHead><TableHead className="font-semibold">Tipo</TableHead>
                <TableHead className="font-semibold">Técnico</TableHead><TableHead className="font-semibold">Cliente</TableHead>
                <TableHead className="font-semibold">Problema</TableHead><TableHead className="font-semibold whitespace-nowrap">Data</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fRpt.map(r => (
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
                {!fRpt.length && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">{search ? 'Nenhum resultado.' : 'Nenhuma OS.'}</TableCell></TableRow>}
              </TableBody>
            </Table></div>
          )}
          <LoadMore tab={rpt} load={loadRpt} />
        </div>
      )}

      {/* ── Checklist OS ─────────────────────────────────────────────────────── */}
      {activeTab === 'checklist' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {chk.loading && !chk.rows.length ? <Spinner /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-semibold">Empresa</TableHead><TableHead className="font-semibold">OS#</TableHead>
                <TableHead className="font-semibold">Item</TableHead><TableHead className="font-semibold">Tipo</TableHead>
                <TableHead className="font-semibold">Valor</TableHead><TableHead className="font-semibold">Conforme</TableHead>
                <TableHead className="font-semibold whitespace-nowrap">Data</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fChk.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                    <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{r.os_number ?? '—'}</TableCell>
                    <TableCell className="text-sm max-w-[220px]"><p className="line-clamp-2">{r.label}</p></TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.item_type}</Badge></TableCell>
                    <TableCell className="text-sm max-w-[160px]">
                      {r.value_boolean != null ? (r.value_boolean ? 'Sim' : 'Não') : r.value_text ?? r.value_option ?? (r.value_number != null ? String(r.value_number) : '—')}
                    </TableCell>
                    <TableCell>
                      {r.is_conformant == null ? <span className="text-muted-foreground text-sm">—</span>
                        : <Badge variant={r.is_conformant ? 'default' : 'destructive'} className="text-xs">{r.is_conformant ? 'Sim' : 'Não'}</Badge>}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                  </TableRow>
                ))}
                {!fChk.length && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">{search ? 'Nenhum resultado.' : 'Nenhum item de checklist.'}</TableCell></TableRow>}
              </TableBody>
            </Table></div>
          )}
          <LoadMore tab={chk} load={loadChk} />
        </div>
      )}

      {/* ── Anexos OS ────────────────────────────────────────────────────────── */}
      {activeTab === 'attachments' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {att.loading && !att.rows.length ? <Spinner /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-semibold">Empresa</TableHead><TableHead className="font-semibold">OS#</TableHead>
                <TableHead className="font-semibold">Arquivo</TableHead><TableHead className="font-semibold">Tipo</TableHead>
                <TableHead className="font-semibold">Tamanho</TableHead><TableHead className="font-semibold">Enviado por</TableHead>
                <TableHead className="font-semibold">Legenda</TableHead><TableHead className="font-semibold whitespace-nowrap">Data</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fAtt.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                    <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{r.os_number ?? '—'}</TableCell>
                    <TableCell className="text-sm max-w-[180px]">
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-primary underline line-clamp-1 hover:no-underline">{r.filename ?? 'abrir'}</a>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{r.mime_type ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{r.size_bytes != null ? `${Math.round(r.size_bytes / 1024)} KB` : '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.uploader_name ?? '—'}</TableCell>
                    <TableCell className="text-sm max-w-[160px]"><p className="line-clamp-2 text-muted-foreground">{r.caption ?? '—'}</p></TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                  </TableRow>
                ))}
                {!fAtt.length && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">{search ? 'Nenhum resultado.' : 'Nenhum anexo.'}</TableCell></TableRow>}
              </TableBody>
            </Table></div>
          )}
          <LoadMore tab={att} load={loadAtt} />
        </div>
      )}

      {/* ── Histórico de Status OS ───────────────────────────────────────────── */}
      {activeTab === 'report_history' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {rsh.loading && !rsh.rows.length ? <Spinner /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-semibold">Empresa</TableHead><TableHead className="font-semibold">OS#</TableHead>
                <TableHead className="font-semibold">De</TableHead><TableHead className="font-semibold">Para</TableHead>
                <TableHead className="font-semibold">Por</TableHead><TableHead className="font-semibold">Comentário</TableHead>
                <TableHead className="font-semibold whitespace-nowrap">Data</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fRsh.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                    <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{r.os_number ?? '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs whitespace-nowrap">{r.from_status ?? '—'}</Badge></TableCell>
                    <TableCell><Badge variant={statusVariant(r.to_status)} className="text-xs whitespace-nowrap">{r.to_status}</Badge></TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.changed_by_name ?? '—'}</TableCell>
                    <TableCell className="text-sm max-w-[200px]"><p className="line-clamp-2 text-muted-foreground">{r.comment ?? '—'}</p></TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDateTime(r.created_at)}</TableCell>
                  </TableRow>
                ))}
                {!fRsh.length && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">{search ? 'Nenhum resultado.' : 'Nenhum histórico.'}</TableCell></TableRow>}
              </TableBody>
            </Table></div>
          )}
          <LoadMore tab={rsh} load={loadRsh} />
        </div>
      )}

      {/* ── Assinaturas ──────────────────────────────────────────────────────── */}
      {activeTab === 'signatures' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {sig.loading && !sig.rows.length ? <Spinner /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-semibold">Empresa</TableHead><TableHead className="font-semibold">OS#</TableHead>
                <TableHead className="font-semibold">Tipo</TableHead><TableHead className="font-semibold">Assinante</TableHead>
                <TableHead className="font-semibold">Cargo</TableHead><TableHead className="font-semibold">GPS</TableHead>
                <TableHead className="font-semibold">Imagem</TableHead><TableHead className="font-semibold whitespace-nowrap">Assinado em</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fSig.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                    <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{r.os_number ?? '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.signature_type}</Badge></TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.signer_name ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{r.signer_role ?? '—'}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {r.geo_lat != null ? `${r.geo_lat.toFixed(5)}, ${r.geo_lng?.toFixed(5)}` : '—'}
                    </TableCell>
                    <TableCell>
                      <a href={r.image_url} target="_blank" rel="noreferrer" className="text-primary underline text-xs hover:no-underline">ver</a>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDateTime(r.signed_at)}</TableCell>
                  </TableRow>
                ))}
                {!fSig.length && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">{search ? 'Nenhum resultado.' : 'Nenhuma assinatura.'}</TableCell></TableRow>}
              </TableBody>
            </Table></div>
          )}
          <LoadMore tab={sig} load={loadSig} />
        </div>
      )}

      {/* ── Reembolsos ───────────────────────────────────────────────────────── */}
      {activeTab === 'reimbursements' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {reim.loading && !reim.rows.length ? <Spinner /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-semibold">Empresa</TableHead><TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Categoria</TableHead><TableHead className="font-semibold">Valor</TableHead>
                <TableHead className="font-semibold">Favorecido</TableHead><TableHead className="font-semibold">Chave PIX</TableHead>
                <TableHead className="font-semibold">Solicitante</TableHead><TableHead className="font-semibold">Cliente</TableHead>
                <TableHead className="font-semibold whitespace-nowrap">Data</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fReim.map(r => (
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
                {!fReim.length && <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">{search ? 'Nenhum resultado.' : 'Nenhum reembolso.'}</TableCell></TableRow>}
              </TableBody>
            </Table></div>
          )}
          <LoadMore tab={reim} load={loadReim} />
        </div>
      )}

      {/* ── Histórico Reembolsos ─────────────────────────────────────────────── */}
      {activeTab === 'reim_history' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {reimhx.loading && !reimhx.rows.length ? <Spinner /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-semibold">Empresa</TableHead><TableHead className="font-semibold">Reembolso</TableHead>
                <TableHead className="font-semibold">De</TableHead><TableHead className="font-semibold">Para</TableHead>
                <TableHead className="font-semibold">Por</TableHead><TableHead className="font-semibold">Motivo</TableHead>
                <TableHead className="font-semibold whitespace-nowrap">Data</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fReimHx.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                    <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                    <TableCell className="text-sm max-w-[180px]"><p className="line-clamp-2 text-muted-foreground">{r.reimbursement_desc ?? '—'}</p></TableCell>
                    <TableCell><Badge variant="outline" className="text-xs whitespace-nowrap">{r.old_status ?? '—'}</Badge></TableCell>
                    <TableCell><Badge variant={statusVariant(r.new_status)} className="text-xs whitespace-nowrap">{r.new_status}</Badge></TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.changed_by_name ?? '—'}</TableCell>
                    <TableCell className="text-sm max-w-[200px]"><p className="line-clamp-2 text-muted-foreground">{r.reason ?? '—'}</p></TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDateTime(r.created_at)}</TableCell>
                  </TableRow>
                ))}
                {!fReimHx.length && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">{search ? 'Nenhum resultado.' : 'Nenhum histórico.'}</TableCell></TableRow>}
              </TableBody>
            </Table></div>
          )}
          <LoadMore tab={reimhx} load={loadReimHx} />
        </div>
      )}

      {/* ── Clientes ─────────────────────────────────────────────────────────── */}
      {activeTab === 'clients' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {cli.loading && !cli.rows.length ? <Spinner /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-semibold">Empresa</TableHead><TableHead className="font-semibold">Razão Social</TableHead>
                <TableHead className="font-semibold">CNPJ</TableHead><TableHead className="font-semibold">Cidade/UF</TableHead>
                <TableHead className="font-semibold">Contato</TableHead><TableHead className="font-semibold">Telefone</TableHead>
                <TableHead className="font-semibold">E-mail</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fCli.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                    <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                    <TableCell className="text-sm font-medium whitespace-nowrap">{r.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{r.cnpj ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.cidade && r.estado ? `${r.cidade}/${r.estado}` : r.cidade ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.contato_nome ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{r.contato_telefone ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.contato_email ?? '—'}</TableCell>
                  </TableRow>
                ))}
                {!fCli.length && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">{search ? 'Nenhum resultado.' : 'Nenhum cliente.'}</TableCell></TableRow>}
              </TableBody>
            </Table></div>
          )}
          <LoadMore tab={cli} load={loadCli} />
        </div>
      )}

      {/* ── Unidades ─────────────────────────────────────────────────────────── */}
      {activeTab === 'locations' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {loc.loading && !loc.rows.length ? <Spinner /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-semibold">Empresa</TableHead><TableHead className="font-semibold">Cliente</TableHead>
                <TableHead className="font-semibold">Unidade</TableHead><TableHead className="font-semibold">Principal</TableHead>
                <TableHead className="font-semibold">Endereço</TableHead><TableHead className="font-semibold">Cidade/UF</TableHead>
                <TableHead className="font-semibold">CEP</TableHead><TableHead className="font-semibold">Contato</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fLoc.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                    <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.client_name}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap font-medium">{r.nome}</TableCell>
                    <TableCell>{r.is_principal ? <Badge variant="default" className="text-xs">Principal</Badge> : null}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{[r.logradouro, r.numero, r.complemento].filter(Boolean).join(', ') || '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.cidade && r.estado ? `${r.cidade}/${r.estado}` : r.cidade ?? '—'}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{r.cep ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.contato_nome ? `${r.contato_nome}${r.contato_telefone ? ` · ${r.contato_telefone}` : ''}` : '—'}</TableCell>
                  </TableRow>
                ))}
                {!fLoc.length && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">{search ? 'Nenhum resultado.' : 'Nenhuma unidade.'}</TableCell></TableRow>}
              </TableBody>
            </Table></div>
          )}
          <LoadMore tab={loc} load={loadLoc} />
        </div>
      )}

      {/* ── Orçamentos ───────────────────────────────────────────────────────── */}
      {activeTab === 'orcamentos' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {orc.loading && !orc.rows.length ? <Spinner /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-semibold">Empresa</TableHead><TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Título</TableHead><TableHead className="font-semibold">Cliente</TableHead>
                <TableHead className="font-semibold">Técnico</TableHead><TableHead className="font-semibold">Total</TableHead>
                <TableHead className="font-semibold">Validade</TableHead><TableHead className="font-semibold">Assinado por</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fOrc.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                    <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                    <TableCell><Badge variant={statusVariant(r.status)} className="text-xs whitespace-nowrap">{r.status}</Badge></TableCell>
                    <TableCell className="text-sm max-w-[180px]"><p className="line-clamp-2">{r.titulo}</p></TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.client_name ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.technician_name ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap font-semibold">{BRL(r.total_value)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDate(r.validade)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.signer_name ?? '—'}</TableCell>
                  </TableRow>
                ))}
                {!fOrc.length && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">{search ? 'Nenhum resultado.' : 'Nenhum orçamento.'}</TableCell></TableRow>}
              </TableBody>
            </Table></div>
          )}
          <LoadMore tab={orc} load={loadOrc} />
        </div>
      )}

      {/* ── Equipamentos ─────────────────────────────────────────────────────── */}
      {activeTab === 'equipments' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {equip.loading && !equip.rows.length ? <Spinner /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-semibold">Empresa</TableHead><TableHead className="font-semibold">Nome</TableHead>
                <TableHead className="font-semibold">Tipo</TableHead><TableHead className="font-semibold">Fabricante</TableHead>
                <TableHead className="font-semibold">Serial</TableHead><TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Cliente</TableHead><TableHead className="font-semibold whitespace-nowrap">Garantia até</TableHead>
                <TableHead className="font-semibold whitespace-nowrap">Últ. Manutenção</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fEquip.map(r => (
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
                {!fEquip.length && <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">{search ? 'Nenhum resultado.' : 'Nenhum equipamento.'}</TableCell></TableRow>}
              </TableBody>
            </Table></div>
          )}
          <LoadMore tab={equip} load={loadEquip} />
        </div>
      )}

      {/* ── Materiais ────────────────────────────────────────────────────────── */}
      {activeTab === 'materials' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {mat.loading && !mat.rows.length ? <Spinner /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-semibold">Empresa</TableHead><TableHead className="font-semibold">Req#</TableHead>
                <TableHead className="font-semibold">Status</TableHead><TableHead className="font-semibold">Urgência</TableHead>
                <TableHead className="font-semibold">Item</TableHead><TableHead className="font-semibold">Qtd</TableHead>
                <TableHead className="font-semibold">Solicitante</TableHead><TableHead className="font-semibold">Cliente</TableHead>
                <TableHead className="font-semibold">Preço Compra</TableHead><TableHead className="font-semibold">Fornecedor</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fMat.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                    <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{r.request_number ?? '—'}</TableCell>
                    <TableCell><Badge variant={statusVariant(r.status)} className="text-xs whitespace-nowrap">{r.status}</Badge></TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.urgency ?? '—'}</TableCell>
                    <TableCell className="text-sm max-w-[160px]"><p className="line-clamp-2">{r.item}</p></TableCell>
                    <TableCell className="text-sm text-center">{r.quantity}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.requester_name ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.client_name ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap font-semibold">{BRL(r.purchase_price)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.supplier_name ?? '—'}</TableCell>
                  </TableRow>
                ))}
                {!fMat.length && <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">{search ? 'Nenhum resultado.' : 'Nenhum material.'}</TableCell></TableRow>}
              </TableBody>
            </Table></div>
          )}
          <LoadMore tab={mat} load={loadMat} />
        </div>
      )}

      {/* ── Notificações ─────────────────────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {notif.loading && !notif.rows.length ? <Spinner /> : (
            <div className="overflow-x-auto"><Table>
              <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-semibold">Empresa</TableHead><TableHead className="font-semibold">Usuário</TableHead>
                <TableHead className="font-semibold">Título</TableHead><TableHead className="font-semibold">Mensagem</TableHead>
                <TableHead className="font-semibold">Lida</TableHead><TableHead className="font-semibold whitespace-nowrap">Data</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fNotif.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/50 transition-colors border-border align-top">
                    <TableCell className="text-sm font-medium whitespace-nowrap">{tn(r.team_id)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.user_name ?? '—'}</TableCell>
                    <TableCell className="text-sm font-medium max-w-[180px]"><p className="line-clamp-2">{r.title}</p></TableCell>
                    <TableCell className="text-sm max-w-[260px]"><p className="line-clamp-3 text-muted-foreground">{r.message}</p></TableCell>
                    <TableCell>
                      <Badge variant={r.is_read ? 'secondary' : 'default'} className="text-xs">{r.is_read ? 'Sim' : 'Não'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{fmtDateTime(r.created_at)}</TableCell>
                  </TableRow>
                ))}
                {!fNotif.length && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">{search ? 'Nenhum resultado.' : 'Nenhuma notificação.'}</TableCell></TableRow>}
              </TableBody>
            </Table></div>
          )}
          <LoadMore tab={notif} load={loadNotif} />
        </div>
      )}

    </div>
  );
}
