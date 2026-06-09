import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ServiceReport } from '@/src/types/reports';
import { REPORT_STATUS_LABEL } from '@/src/types/reports';

const PRIORITY_LABEL: Record<string, string> = {
  baixa: 'Baixa', normal: 'Normal', alta: 'Alta', critica: 'Crítica',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR }); } catch { return d; }
}

function fmtDateTime(d: string): string {
  try { return format(parseISO(d), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return d; }
}

export function exportarOsExcel(reports: ServiceReport[], filenameBase = 'ordens-de-servico'): void {
  if (reports.length === 0) return;

  const rows = reports.map(r => ({
    'Nº OS':               r.os_number ?? '—',
    'Status':              REPORT_STATUS_LABEL[r.status] ?? r.status,
    'Prioridade':          PRIORITY_LABEL[r.priority] ?? r.priority ?? '—',
    'Tipo de Serviço':     r.service_type ?? '—',
    'Cliente':             r.clients?.name ?? '—',
    'Técnico':             r.users?.full_name ?? '—',
    'Data do Serviço':     fmtDate(r.service_date),
    'Local':               r.site_location ?? '—',
    'Equipamento':         (r.equipments as { name?: string } | null)?.name ?? r.asset_name_manual ?? '—',
    'Problema Relatado':   r.reported_problem ?? '—',
    'Diagnóstico Final':   r.final_diagnosis ?? '—',
    'Serviços Executados': r.services_performed ?? '—',
    'Peças Utilizadas':    r.parts_used ?? '—',
    'Criado em':           fmtDateTime(r.created_at),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Largura automática de colunas: máximo entre header e conteúdo + padding
  const headers = Object.keys(rows[0]);
  ws['!cols'] = headers.map(h => ({
    wch: Math.max(h.length, ...rows.map(r => String(r[h as keyof typeof r] ?? '').length)) + 2,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ordens de Serviço');
  XLSX.writeFile(wb, `${filenameBase}-${format(new Date(), 'yyyyMMdd-HHmm')}.xlsx`);
}
