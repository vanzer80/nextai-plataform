import { supabase } from '@/src/lib/supabase';
import type {
  PlatformIntelligenceStats,
  PlatformDiagnosticRow,
  PlatformKbRow,
  CorpusFilters,
} from '@/src/types/platformIntelligence';

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

export async function logExport(
  resource: 'diagnostics' | 'kb',
  tenantFilter: string | null,
  rowCount: number,
): Promise<void> {
  await supabase.rpc('platform_log_export', {
    p_resource:       resource,
    p_tenant_filter:  tenantFilter ?? null,
    p_row_count:      rowCount,
  });
}

export async function fetchAllDiagnosticsForExport(f: Omit<CorpusFilters, 'limit' | 'offset'>): Promise<PlatformDiagnosticRow[]> {
  const PAGE = 1000;
  let all: PlatformDiagnosticRow[] = [];
  let offset = 0;
  while (true) {
    const page = await getDiagnosticCorpus({ ...f, limit: PAGE, offset });
    all = all.concat(page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export async function fetchAllKbForExport(f: Omit<CorpusFilters, 'limit' | 'offset'>): Promise<PlatformKbRow[]> {
  const PAGE = 1000;
  let all: PlatformKbRow[] = [];
  let offset = 0;
  while (true) {
    const page = await getKbCorpus({ ...f, limit: PAGE, offset });
    all = all.concat(page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

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
