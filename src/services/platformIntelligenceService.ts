import { supabase } from '@/src/lib/supabase';
import type {
  PlatformIntelligenceStats,
  PlatformDiagnosticRow, PlatformKbRow, CorpusFilters,
  PlatformReportRow, PlatformReimbursementRow, PlatformClientRow,
  PlatformOrcamentoRow, PlatformEquipmentRow, PlatformMaterialRow,
  PlatformChecklistItemRow, PlatformAttachmentRow,
  PlatformReportStatusHistoryRow, PlatformSignatureRow,
  PlatformReimbursementHistoryRow, PlatformClientLocationRow,
  PlatformNotificationRow,
  RawFilters, ExportResource,
} from '@/src/types/platformIntelligence';

// ── Corpus (anonimizado) ──────────────────────────────────────────────────────

export async function getIntelligenceStats(): Promise<PlatformIntelligenceStats> {
  const { data, error } = await supabase.rpc('platform_get_intelligence_stats');
  if (error) throw new Error(error.message);
  return data as unknown as PlatformIntelligenceStats;
}

export async function getDiagnosticCorpus(f: CorpusFilters = {}): Promise<PlatformDiagnosticRow[]> {
  const { data, error } = await supabase.rpc('platform_get_diagnostic_corpus', {
    p_tenant_id: f.tenantId ?? null, p_service_type: f.serviceType ?? null,
    p_limit: f.limit ?? 50, p_offset: f.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformDiagnosticRow[];
}

export async function getKbCorpus(f: CorpusFilters = {}): Promise<PlatformKbRow[]> {
  const { data, error } = await supabase.rpc('platform_get_kb_corpus', {
    p_tenant_id: f.tenantId ?? null, p_service_type: f.serviceType ?? null,
    p_limit: f.limit ?? 50, p_offset: f.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformKbRow[];
}

// ── Raw — tabelas principais ──────────────────────────────────────────────────

export async function getAllReports(f: RawFilters = {}): Promise<PlatformReportRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_reports', {
    p_tenant_id: f.tenantId ?? null, p_limit: f.limit ?? 50, p_offset: f.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformReportRow[];
}

export async function getAllReimbursements(f: RawFilters = {}): Promise<PlatformReimbursementRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_reimbursements', {
    p_tenant_id: f.tenantId ?? null, p_limit: f.limit ?? 50, p_offset: f.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformReimbursementRow[];
}

export async function getAllClients(f: RawFilters = {}): Promise<PlatformClientRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_clients', {
    p_tenant_id: f.tenantId ?? null, p_limit: f.limit ?? 50, p_offset: f.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformClientRow[];
}

export async function getAllOrcamentos(f: RawFilters = {}): Promise<PlatformOrcamentoRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_orcamentos', {
    p_tenant_id: f.tenantId ?? null, p_limit: f.limit ?? 50, p_offset: f.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformOrcamentoRow[];
}

export async function getAllEquipments(f: RawFilters = {}): Promise<PlatformEquipmentRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_equipments', {
    p_tenant_id: f.tenantId ?? null, p_limit: f.limit ?? 50, p_offset: f.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformEquipmentRow[];
}

export async function getAllMaterials(f: RawFilters = {}): Promise<PlatformMaterialRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_materials', {
    p_tenant_id: f.tenantId ?? null, p_limit: f.limit ?? 50, p_offset: f.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformMaterialRow[];
}

// ── Raw — tabelas secundárias/históricas ─────────────────────────────────────

export async function getAllChecklistItems(f: RawFilters = {}): Promise<PlatformChecklistItemRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_checklist_items', {
    p_tenant_id: f.tenantId ?? null, p_limit: f.limit ?? 50, p_offset: f.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformChecklistItemRow[];
}

export async function getAllAttachments(f: RawFilters = {}): Promise<PlatformAttachmentRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_attachments', {
    p_tenant_id: f.tenantId ?? null, p_limit: f.limit ?? 50, p_offset: f.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformAttachmentRow[];
}

export async function getAllReportStatusHistory(f: RawFilters = {}): Promise<PlatformReportStatusHistoryRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_report_status_history', {
    p_tenant_id: f.tenantId ?? null, p_limit: f.limit ?? 50, p_offset: f.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformReportStatusHistoryRow[];
}

export async function getAllSignatures(f: RawFilters = {}): Promise<PlatformSignatureRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_signatures', {
    p_tenant_id: f.tenantId ?? null, p_limit: f.limit ?? 50, p_offset: f.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformSignatureRow[];
}

export async function getAllReimbursementHistory(f: RawFilters = {}): Promise<PlatformReimbursementHistoryRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_reimbursement_history', {
    p_tenant_id: f.tenantId ?? null, p_limit: f.limit ?? 50, p_offset: f.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformReimbursementHistoryRow[];
}

export async function getAllClientLocations(f: RawFilters = {}): Promise<PlatformClientLocationRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_client_locations', {
    p_tenant_id: f.tenantId ?? null, p_limit: f.limit ?? 50, p_offset: f.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformClientLocationRow[];
}

export async function getAllNotifications(f: RawFilters = {}): Promise<PlatformNotificationRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_notifications', {
    p_tenant_id: f.tenantId ?? null, p_limit: f.limit ?? 50, p_offset: f.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformNotificationRow[];
}

// ── Auditoria ─────────────────────────────────────────────────────────────────

export async function logExport(
  resource: ExportResource,
  tenantFilter: string | null,
  rowCount: number,
): Promise<void> {
  await supabase.rpc('platform_log_export', {
    p_resource: resource, p_tenant_filter: tenantFilter ?? null, p_row_count: rowCount,
  });
}

// ── Paginação completa (para export) ─────────────────────────────────────────

const PAGE = 1000;

async function paginate<T>(fetch: (o: number) => Promise<T[]>): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const page = await fetch(offset);
    all.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export const fetchAllDiagnosticsForExport = (f: Omit<CorpusFilters, 'limit' | 'offset'>) =>
  paginate(o => getDiagnosticCorpus({ ...f, limit: PAGE, offset: o }));

export const fetchAllKbForExport = (f: Omit<CorpusFilters, 'limit' | 'offset'>) =>
  paginate(o => getKbCorpus({ ...f, limit: PAGE, offset: o }));

export const fetchAllReportsForExport        = (tid: string | null) => paginate(o => getAllReports({ tenantId: tid, limit: PAGE, offset: o }));
export const fetchAllReimbursementsForExport = (tid: string | null) => paginate(o => getAllReimbursements({ tenantId: tid, limit: PAGE, offset: o }));
export const fetchAllClientsForExport        = (tid: string | null) => paginate(o => getAllClients({ tenantId: tid, limit: PAGE, offset: o }));
export const fetchAllOrcamentosForExport     = (tid: string | null) => paginate(o => getAllOrcamentos({ tenantId: tid, limit: PAGE, offset: o }));
export const fetchAllEquipmentsForExport     = (tid: string | null) => paginate(o => getAllEquipments({ tenantId: tid, limit: PAGE, offset: o }));
export const fetchAllMaterialsForExport      = (tid: string | null) => paginate(o => getAllMaterials({ tenantId: tid, limit: PAGE, offset: o }));
export const fetchAllChecklistForExport      = (tid: string | null) => paginate(o => getAllChecklistItems({ tenantId: tid, limit: PAGE, offset: o }));
export const fetchAllAttachmentsForExport    = (tid: string | null) => paginate(o => getAllAttachments({ tenantId: tid, limit: PAGE, offset: o }));
export const fetchAllRptStatusHxForExport    = (tid: string | null) => paginate(o => getAllReportStatusHistory({ tenantId: tid, limit: PAGE, offset: o }));
export const fetchAllSignaturesForExport     = (tid: string | null) => paginate(o => getAllSignatures({ tenantId: tid, limit: PAGE, offset: o }));
export const fetchAllReimHxForExport         = (tid: string | null) => paginate(o => getAllReimbursementHistory({ tenantId: tid, limit: PAGE, offset: o }));
export const fetchAllLocationsForExport      = (tid: string | null) => paginate(o => getAllClientLocations({ tenantId: tid, limit: PAGE, offset: o }));
export const fetchAllNotificationsForExport  = (tid: string | null) => paginate(o => getAllNotifications({ tenantId: tid, limit: PAGE, offset: o }));

// ── Blobs ─────────────────────────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function toJsonBlob(rows: unknown[]): Blob {
  return new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
}

export function toCsvBlob(rows: Record<string, unknown>[]): Blob {
  if (!rows.length) return new Blob([''], { type: 'text/csv' });
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))];
  return new Blob([lines.join('\n')], { type: 'text/csv' });
}
