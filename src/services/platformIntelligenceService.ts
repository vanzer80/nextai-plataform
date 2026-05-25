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
  RawFilters,
  ExportResource,
} from '@/src/types/platformIntelligence';

// ── Corpus (anonymized) ───────────────────────────────────────────────────────

export async function getIntelligenceStats(): Promise<PlatformIntelligenceStats> {
  const { data, error } = await supabase.rpc('platform_get_intelligence_stats');
  if (error) throw new Error(error.message);
  return data as unknown as PlatformIntelligenceStats;
}

export async function getDiagnosticCorpus(f: CorpusFilters = {}): Promise<PlatformDiagnosticRow[]> {
  const { data, error } = await supabase.rpc('platform_get_diagnostic_corpus', {
    p_tenant_id:    f.tenantId    ?? null,
    p_service_type: f.serviceType ?? null,
    p_limit:        f.limit       ?? 50,
    p_offset:       f.offset      ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformDiagnosticRow[];
}

export async function getKbCorpus(f: CorpusFilters = {}): Promise<PlatformKbRow[]> {
  const { data, error } = await supabase.rpc('platform_get_kb_corpus', {
    p_tenant_id:    f.tenantId    ?? null,
    p_service_type: f.serviceType ?? null,
    p_limit:        f.limit       ?? 50,
    p_offset:       f.offset      ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformKbRow[];
}

// ── Raw data (full access) ────────────────────────────────────────────────────

export async function getAllReports(f: RawFilters = {}): Promise<PlatformReportRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_reports', {
    p_tenant_id: f.tenantId ?? null,
    p_limit:     f.limit    ?? 50,
    p_offset:    f.offset   ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformReportRow[];
}

export async function getAllReimbursements(f: RawFilters = {}): Promise<PlatformReimbursementRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_reimbursements', {
    p_tenant_id: f.tenantId ?? null,
    p_limit:     f.limit    ?? 50,
    p_offset:    f.offset   ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformReimbursementRow[];
}

export async function getAllClients(f: RawFilters = {}): Promise<PlatformClientRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_clients', {
    p_tenant_id: f.tenantId ?? null,
    p_limit:     f.limit    ?? 50,
    p_offset:    f.offset   ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformClientRow[];
}

export async function getAllOrcamentos(f: RawFilters = {}): Promise<PlatformOrcamentoRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_orcamentos', {
    p_tenant_id: f.tenantId ?? null,
    p_limit:     f.limit    ?? 50,
    p_offset:    f.offset   ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformOrcamentoRow[];
}

export async function getAllEquipments(f: RawFilters = {}): Promise<PlatformEquipmentRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_equipments', {
    p_tenant_id: f.tenantId ?? null,
    p_limit:     f.limit    ?? 50,
    p_offset:    f.offset   ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformEquipmentRow[];
}

export async function getAllMaterials(f: RawFilters = {}): Promise<PlatformMaterialRow[]> {
  const { data, error } = await supabase.rpc('platform_get_all_materials', {
    p_tenant_id: f.tenantId ?? null,
    p_limit:     f.limit    ?? 50,
    p_offset:    f.offset   ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PlatformMaterialRow[];
}

// ── Audit ─────────────────────────────────────────────────────────────────────

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

// ── Paginação completa (para export) ─────────────────────────────────────────

const PAGE = 1000;

export async function fetchAllDiagnosticsForExport(f: Omit<CorpusFilters, 'limit' | 'offset'>): Promise<PlatformDiagnosticRow[]> {
  const all: PlatformDiagnosticRow[] = [];
  let offset = 0;
  while (true) {
    const page = await getDiagnosticCorpus({ ...f, limit: PAGE, offset });
    all.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export async function fetchAllKbForExport(f: Omit<CorpusFilters, 'limit' | 'offset'>): Promise<PlatformKbRow[]> {
  const all: PlatformKbRow[] = [];
  let offset = 0;
  while (true) {
    const page = await getKbCorpus({ ...f, limit: PAGE, offset });
    all.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export async function fetchAllReportsForExport(tenantId: string | null): Promise<PlatformReportRow[]> {
  const all: PlatformReportRow[] = [];
  let offset = 0;
  while (true) {
    const page = await getAllReports({ tenantId, limit: PAGE, offset });
    all.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export async function fetchAllReimbursementsForExport(tenantId: string | null): Promise<PlatformReimbursementRow[]> {
  const all: PlatformReimbursementRow[] = [];
  let offset = 0;
  while (true) {
    const page = await getAllReimbursements({ tenantId, limit: PAGE, offset });
    all.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export async function fetchAllClientsForExport(tenantId: string | null): Promise<PlatformClientRow[]> {
  const all: PlatformClientRow[] = [];
  let offset = 0;
  while (true) {
    const page = await getAllClients({ tenantId, limit: PAGE, offset });
    all.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export async function fetchAllOrcamentosForExport(tenantId: string | null): Promise<PlatformOrcamentoRow[]> {
  const all: PlatformOrcamentoRow[] = [];
  let offset = 0;
  while (true) {
    const page = await getAllOrcamentos({ tenantId, limit: PAGE, offset });
    all.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export async function fetchAllEquipmentsForExport(tenantId: string | null): Promise<PlatformEquipmentRow[]> {
  const all: PlatformEquipmentRow[] = [];
  let offset = 0;
  while (true) {
    const page = await getAllEquipments({ tenantId, limit: PAGE, offset });
    all.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export async function fetchAllMaterialsForExport(tenantId: string | null): Promise<PlatformMaterialRow[]> {
  const all: PlatformMaterialRow[] = [];
  let offset = 0;
  while (true) {
    const page = await getAllMaterials({ tenantId, limit: PAGE, offset });
    all.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// ── Blobs ─────────────────────────────────────────────────────────────────────

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
