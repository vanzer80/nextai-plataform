import { supabase } from '@/src/lib/supabase';
import type {
  PlatformIntelligenceStats,
  PlatformDiagnosticRow,
  PlatformKbRow,
  CorpusFilters,
  PlatformReportRow,
  PlatformReimbursementRow,
  PlatformClientRow,
  PlatformOrcamentoRow,
  PlatformEquipmentRow,
  PlatformMaterialRow,
  PlatformChecklistItemRow,
  PlatformAttachmentRow,
  PlatformStatusHistoryRow,
  PlatformSignatureRow,
  PlatformReimbursementHistoryRow,
  PlatformClientLocationRow,
  PlatformNotificationRow,
  ExportResource,
} from '@/src/types/platformIntelligence';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function rpcPage<T>(
  rpc: string,
  params: Record<string, unknown>,
  limit: number,
  offset: number,
): Promise<T[]> {
  const { data, error } = await supabase.rpc(rpc, { ...params, p_limit: limit, p_offset: offset });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as T[];
}

async function paginateAll<T>(rpc: string, params: Record<string, unknown>): Promise<T[]> {
  const PAGE = 1000;
  let all: T[] = [];
  let offset = 0;
  while (true) {
    const page = await rpcPage<T>(rpc, params, PAGE, offset);
    all = all.concat(page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// ── Corpus IA (anonimizado) ───────────────────────────────────────────────────

export async function getIntelligenceStats(): Promise<PlatformIntelligenceStats> {
  const { data, error } = await supabase.rpc('platform_get_intelligence_stats');
  if (error) throw new Error(error.message);
  return data as unknown as PlatformIntelligenceStats;
}

export async function getDiagnosticCorpus(f: CorpusFilters = {}): Promise<PlatformDiagnosticRow[]> {
  return rpcPage<PlatformDiagnosticRow>('platform_get_diagnostic_corpus', {
    p_tenant_id:    f.tenantId    ?? null,
    p_service_type: f.serviceType ?? null,
  }, f.limit ?? 50, f.offset ?? 0);
}

export async function getKbCorpus(f: CorpusFilters = {}): Promise<PlatformKbRow[]> {
  return rpcPage<PlatformKbRow>('platform_get_kb_corpus', {
    p_tenant_id:    f.tenantId    ?? null,
    p_service_type: f.serviceType ?? null,
  }, f.limit ?? 50, f.offset ?? 0);
}

export async function fetchAllDiagnosticsForExport(f: Omit<CorpusFilters, 'limit' | 'offset'>): Promise<PlatformDiagnosticRow[]> {
  return paginateAll<PlatformDiagnosticRow>('platform_get_diagnostic_corpus', {
    p_tenant_id: f.tenantId ?? null, p_service_type: f.serviceType ?? null,
  });
}

export async function fetchAllKbForExport(f: Omit<CorpusFilters, 'limit' | 'offset'>): Promise<PlatformKbRow[]> {
  return paginateAll<PlatformKbRow>('platform_get_kb_corpus', {
    p_tenant_id: f.tenantId ?? null, p_service_type: f.serviceType ?? null,
  });
}

// ── Acesso bruto: 13 tabelas operacionais ─────────────────────────────────────

// service_reports
export async function getAllReports(tid: string | null, lim: number, off: number): Promise<PlatformReportRow[]> {
  return rpcPage<PlatformReportRow>('platform_get_all_reports', { p_tenant_id: tid }, lim, off);
}
export async function fetchAllReportsForExport(tid: string | null): Promise<PlatformReportRow[]> {
  return paginateAll<PlatformReportRow>('platform_get_all_reports', { p_tenant_id: tid });
}

// reimbursements
export async function getAllReimbursements(tid: string | null, lim: number, off: number): Promise<PlatformReimbursementRow[]> {
  return rpcPage<PlatformReimbursementRow>('platform_get_all_reimbursements', { p_tenant_id: tid }, lim, off);
}
export async function fetchAllReimbursementsForExport(tid: string | null): Promise<PlatformReimbursementRow[]> {
  return paginateAll<PlatformReimbursementRow>('platform_get_all_reimbursements', { p_tenant_id: tid });
}

// clients
export async function getAllClients(tid: string | null, lim: number, off: number): Promise<PlatformClientRow[]> {
  return rpcPage<PlatformClientRow>('platform_get_all_clients', { p_tenant_id: tid }, lim, off);
}
export async function fetchAllClientsForExport(tid: string | null): Promise<PlatformClientRow[]> {
  return paginateAll<PlatformClientRow>('platform_get_all_clients', { p_tenant_id: tid });
}

// orcamentos
export async function getAllOrcamentos(tid: string | null, lim: number, off: number): Promise<PlatformOrcamentoRow[]> {
  return rpcPage<PlatformOrcamentoRow>('platform_get_all_orcamentos', { p_tenant_id: tid }, lim, off);
}
export async function fetchAllOrcamentosForExport(tid: string | null): Promise<PlatformOrcamentoRow[]> {
  return paginateAll<PlatformOrcamentoRow>('platform_get_all_orcamentos', { p_tenant_id: tid });
}

// equipments
export async function getAllEquipments(tid: string | null, lim: number, off: number): Promise<PlatformEquipmentRow[]> {
  return rpcPage<PlatformEquipmentRow>('platform_get_all_equipments', { p_tenant_id: tid }, lim, off);
}
export async function fetchAllEquipmentsForExport(tid: string | null): Promise<PlatformEquipmentRow[]> {
  return paginateAll<PlatformEquipmentRow>('platform_get_all_equipments', { p_tenant_id: tid });
}

// material_requests
export async function getAllMaterials(tid: string | null, lim: number, off: number): Promise<PlatformMaterialRow[]> {
  return rpcPage<PlatformMaterialRow>('platform_get_all_materials', { p_tenant_id: tid }, lim, off);
}
export async function fetchAllMaterialsForExport(tid: string | null): Promise<PlatformMaterialRow[]> {
  return paginateAll<PlatformMaterialRow>('platform_get_all_materials', { p_tenant_id: tid });
}

// report_checklist_items
export async function getAllChecklistItems(tid: string | null, lim: number, off: number): Promise<PlatformChecklistItemRow[]> {
  return rpcPage<PlatformChecklistItemRow>('platform_get_all_checklist_items', { p_tenant_id: tid }, lim, off);
}
export async function fetchAllChecklistItemsForExport(tid: string | null): Promise<PlatformChecklistItemRow[]> {
  return paginateAll<PlatformChecklistItemRow>('platform_get_all_checklist_items', { p_tenant_id: tid });
}

// report_attachments
export async function getAllAttachments(tid: string | null, lim: number, off: number): Promise<PlatformAttachmentRow[]> {
  return rpcPage<PlatformAttachmentRow>('platform_get_all_attachments', { p_tenant_id: tid }, lim, off);
}
export async function fetchAllAttachmentsForExport(tid: string | null): Promise<PlatformAttachmentRow[]> {
  return paginateAll<PlatformAttachmentRow>('platform_get_all_attachments', { p_tenant_id: tid });
}

// report_status_history
export async function getAllStatusHistory(tid: string | null, lim: number, off: number): Promise<PlatformStatusHistoryRow[]> {
  return rpcPage<PlatformStatusHistoryRow>('platform_get_all_status_history', { p_tenant_id: tid }, lim, off);
}
export async function fetchAllStatusHistoryForExport(tid: string | null): Promise<PlatformStatusHistoryRow[]> {
  return paginateAll<PlatformStatusHistoryRow>('platform_get_all_status_history', { p_tenant_id: tid });
}

// report_signatures
export async function getAllSignatures(tid: string | null, lim: number, off: number): Promise<PlatformSignatureRow[]> {
  return rpcPage<PlatformSignatureRow>('platform_get_all_signatures', { p_tenant_id: tid }, lim, off);
}
export async function fetchAllSignaturesForExport(tid: string | null): Promise<PlatformSignatureRow[]> {
  return paginateAll<PlatformSignatureRow>('platform_get_all_signatures', { p_tenant_id: tid });
}

// reimbursement_history
export async function getAllReimbursementHistory(tid: string | null, lim: number, off: number): Promise<PlatformReimbursementHistoryRow[]> {
  return rpcPage<PlatformReimbursementHistoryRow>('platform_get_all_reimbursement_history', { p_tenant_id: tid }, lim, off);
}
export async function fetchAllReimbursementHistoryForExport(tid: string | null): Promise<PlatformReimbursementHistoryRow[]> {
  return paginateAll<PlatformReimbursementHistoryRow>('platform_get_all_reimbursement_history', { p_tenant_id: tid });
}

// client_locations
export async function getAllClientLocations(tid: string | null, lim: number, off: number): Promise<PlatformClientLocationRow[]> {
  return rpcPage<PlatformClientLocationRow>('platform_get_all_client_locations', { p_tenant_id: tid }, lim, off);
}
export async function fetchAllClientLocationsForExport(tid: string | null): Promise<PlatformClientLocationRow[]> {
  return paginateAll<PlatformClientLocationRow>('platform_get_all_client_locations', { p_tenant_id: tid });
}

// notifications
export async function getAllNotifications(tid: string | null, lim: number, off: number): Promise<PlatformNotificationRow[]> {
  return rpcPage<PlatformNotificationRow>('platform_get_all_notifications', { p_tenant_id: tid }, lim, off);
}
export async function fetchAllNotificationsForExport(tid: string | null): Promise<PlatformNotificationRow[]> {
  return paginateAll<PlatformNotificationRow>('platform_get_all_notifications', { p_tenant_id: tid });
}

// ── Export audit log ──────────────────────────────────────────────────────────

export async function logExport(
  resource: ExportResource,
  tenantFilter: string | null,
  rowCount: number,
): Promise<void> {
  await supabase.rpc('platform_log_export', {
    p_resource:      resource,
    p_tenant_filter: tenantFilter ?? null,
    p_row_count:     rowCount,
  });
}

// ── Blob helpers ──────────────────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toJsonBlob(rows: unknown[]): Blob {
  return new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
}

export function toCsvBlob(rows: Record<string, unknown>[]): Blob {
  if (!rows.length) return new Blob([''], { type: 'text/csv' });
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))];
  return new Blob([lines.join('\n')], { type: 'text/csv' });
}
