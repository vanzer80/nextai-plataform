import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ServiceReport, ReportChecklistItem, ReportSignature } from '@/src/types/reports';

export interface PdfReportData {
  report: ServiceReport;
  checklistItems: ReportChecklistItem[];
  signatures: ReportSignature[];
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR }); } catch { return d; }
}

function fmtDateTime(d: string | null): string {
  if (!d) return '—';
  try { return format(parseISO(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return d; }
}

function fmtTime(d: string | null): string {
  if (!d) return '—';
  try { return format(parseISO(d), 'HH:mm', { locale: ptBR }); } catch { return d; }
}

// ── Image helpers ─────────────────────────────────────────────────────────────

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function checkPageBreak(doc: jsPDF, y: number, needed = 20): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 22) {
    doc.addPage();
    return 22;
  }
  return y;
}

function drawSectionHeader(
  doc: jsPDF, label: string, y: number,
  marginL: number, pageW: number, marginR: number,
): number {
  doc.setFillColor(241, 245, 249);
  doc.rect(marginL, y, pageW - marginL - marginR, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 58, 95);
  doc.text(label, marginL + 3, y + 5.5);
  return y + 11;
}

function drawField(
  doc: jsPDF, label: string, value: string | null | undefined,
  x: number, y: number, maxW: number,
): number {
  if (!value) return y;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(label.toUpperCase(), x, y);

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const lines = doc.splitTextToSize(value, maxW) as string[];
  doc.text(lines, x, y);

  return y + lines.length * 4.5 + 4;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function gerarPdfRelatorio({ report, checklistItems, signatures }: PdfReportData): Promise<void> {
  // Pre-fetch signature images in parallel (must be data URLs for jsPDF)
  const sigImageMap = new Map<string, string | null>();
  await Promise.all(
    signatures.map(async (sig) => {
      sigImageMap.set(sig.id, await urlToDataUrl(sig.image_url));
    }),
  );

  // ── Init ─────────────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const marginL = 15;
  const marginR = 15;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - marginL - marginR;
  const col1X = marginL + 3;
  const col2X = marginL + contentW / 2 + 3;
  const colW  = contentW / 2 - 6;
  const fullW = contentW - 6;

  const hoje   = fmtDate(new Date().toISOString().slice(0, 10));
  const refNum = report.os_number
    ? `OS ${report.os_number}`
    : `REL-${report.id.slice(0, 8).toUpperCase()}`;

  const clientName = report.clients?.name ?? null;
  const techName   = report.users?.full_name ?? null;
  const assetName  = report.equipments?.name ?? report.asset_name_manual ?? null;

  // ── Cabeçalho ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 58, 95);
  doc.text('PORTAL MOPAR', marginL, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Relatório de Serviço Técnico', marginL, 29);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(refNum, pageW - marginR, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Emitido em: ${hoje}`, pageW - marginR, 26, { align: 'right' });

  // Badge APROVADO
  doc.setFillColor(16, 122, 87);
  doc.roundedRect(pageW - marginR - 30, 29, 30, 7, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('✓ APROVADO', pageW - marginR - 15, 34, { align: 'center' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(marginL, 40, pageW - marginR, 40);

  let y = 48;

  // ── Identificação ─────────────────────────────────────────────────────────────
  y = drawSectionHeader(doc, 'IDENTIFICAÇÃO', y, marginL, pageW, marginR);

  // Linha 1 — 2 colunas: tipo + data
  let y1 = y; let y2 = y;
  y1 = drawField(doc, 'Tipo de Serviço', report.service_type, col1X, y1, colW);
  y2 = drawField(doc, 'Data do Serviço', fmtDate(report.service_date), col2X, y2, colW);
  y = Math.max(y1, y2);

  // Linha 2 — OS + Técnico
  y1 = y; y2 = y;
  if (report.os_number) y1 = drawField(doc, 'Número OS', report.os_number, col1X, y1, colW);
  if (techName)         y2 = drawField(doc, 'Técnico Responsável', techName, col2X, y2, colW);
  y = Math.max(y1, y2);

  // Linha 3 — horários
  if (report.started_at || report.finished_at) {
    y1 = y; y2 = y;
    if (report.started_at)  y1 = drawField(doc, 'Hora Início', fmtTime(report.started_at), col1X, y1, colW);
    if (report.finished_at) y2 = drawField(doc, 'Hora Término', fmtTime(report.finished_at), col2X, y2, colW);
    y = Math.max(y1, y2);
  }

  if (report.total_minutes != null) {
    y = drawField(doc, 'Duração Total', `${report.total_minutes} minutos`, col1X, y, colW);
  }

  if (clientName)          y = drawField(doc, 'Cliente', clientName, col1X, y, fullW);
  if (report.site_location) y = drawField(doc, 'Unidade / Local', report.site_location, col1X, y, fullW);
  if (assetName)            y = drawField(doc, 'Equipamento / Ativo', assetName, col1X, y, fullW);

  y += 2;

  // ── Diagnóstico ───────────────────────────────────────────────────────────────
  const hasDiagnosis =
    report.reported_problem || report.preliminary_diagnosis ||
    report.final_diagnosis  || report.internal_notes;

  if (hasDiagnosis) {
    y = checkPageBreak(doc, y, 30);
    y = drawSectionHeader(doc, 'DIAGNÓSTICO TÉCNICO', y, marginL, pageW, marginR);

    if (report.reported_problem)       y = drawField(doc, 'Problema Relatado pelo Cliente', report.reported_problem, col1X, y, fullW);
    if (report.preliminary_diagnosis)  y = drawField(doc, 'Diagnóstico Preliminar', report.preliminary_diagnosis, col1X, y, fullW);
    if (report.final_diagnosis)        y = drawField(doc, 'Diagnóstico Final', report.final_diagnosis, col1X, y, fullW);
    if (report.internal_notes)         y = drawField(doc, 'Notas Internas', report.internal_notes, col1X, y, fullW);

    y += 2;
  }

  // ── Execução ──────────────────────────────────────────────────────────────────
  const hasExecution =
    report.services_performed || report.parts_used ||
    report.pending_issues     || report.technical_recommendation;

  if (hasExecution) {
    y = checkPageBreak(doc, y, 30);
    y = drawSectionHeader(doc, 'EXECUÇÃO DO SERVIÇO', y, marginL, pageW, marginR);

    if (report.services_performed)        y = drawField(doc, 'Serviços Executados', report.services_performed, col1X, y, fullW);
    if (report.parts_used)                y = drawField(doc, 'Peças / Materiais Utilizados', report.parts_used, col1X, y, fullW);
    if (report.pending_issues)            y = drawField(doc, 'Pendências', report.pending_issues, col1X, y, fullW);
    if (report.technical_recommendation)  y = drawField(doc, 'Recomendação Técnica', report.technical_recommendation, col1X, y, fullW);

    y += 2;
  }

  // ── Checklist ─────────────────────────────────────────────────────────────────
  if (checklistItems.length > 0) {
    y = checkPageBreak(doc, y, 30);
    y = drawSectionHeader(doc, `CHECKLIST (${checklistItems.length} itens)`, y, marginL, pageW, marginR);

    const checklistRows = checklistItems.map(item => {
      const value = (() => {
        if (item.item_type === 'boolean') return item.value_boolean == null ? '—' : item.value_boolean ? 'Sim' : 'Não';
        if (item.item_type === 'text')   return item.value_text   ?? '—';
        if (item.item_type === 'number') return item.value_number?.toString() ?? '—';
        if (item.item_type === 'select') return item.value_option ?? '—';
        if (item.item_type === 'photo')  return item.attachment_url ? 'Foto anexada' : '—';
        return '—';
      })();
      const conf = item.is_conformant === true ? '✓' : item.is_conformant === false ? '✗' : '—';
      return [item.label, value, conf];
    });

    autoTable(doc, {
      startY: y,
      head: [['Item', 'Resposta', 'Conforme']],
      body: checklistRows,
      margin: { left: marginL, right: marginR },
      columnStyles: {
        0: { cellWidth: contentW - 40 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 15, halign: 'center' },
      },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      styles: { cellPadding: 2.5 },
      didParseCell: (data) => {
        if (data.column.index === 2 && data.section === 'body') {
          const v = String(data.cell.raw);
          if (v === '✓') data.cell.styles.textColor = [16, 122, 87];
          else if (v === '✗') data.cell.styles.textColor = [185, 28, 28];
        }
      },
    });

    y = ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y) + 6;
  }

  // ── Assinaturas ───────────────────────────────────────────────────────────────
  if (signatures.length > 0) {
    const sigCount = Math.min(signatures.length, 3);
    const sigImgH  = 30;
    const sigNeeded = 7 + sigImgH + 12;

    y = checkPageBreak(doc, y, sigNeeded);
    y = drawSectionHeader(doc, 'ASSINATURAS', y, marginL, pageW, marginR);

    const sigW = (contentW - (sigCount - 1) * 6) / sigCount;

    for (let i = 0; i < sigCount; i++) {
      const sig  = signatures[i];
      const sigX = marginL + i * (sigW + 6);

      const typeLabel =
        sig.signature_type === 'technician' ? 'TÉCNICO' :
        sig.signature_type === 'client'     ? 'CLIENTE' : 'SUPERVISOR';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(typeLabel, sigX, y);

      if (sig.signer_name) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(sig.signer_name, sigX, y + 4);
      }

      const imgY = y + 7;

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.rect(sigX, imgY, sigW, sigImgH);

      const dataUrl = sigImageMap.get(sig.id);
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, 'PNG', sigX + 1, imgY + 1, sigW - 2, sigImgH - 2);
        } catch {
          // Failed to embed — box already drawn, leave empty
        }
      }

      if (sig.signed_at) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(fmtDateTime(sig.signed_at), sigX, imgY + sigImgH + 4);
      }
    }

    y += sigNeeded;
  }

  // ── Rodapé em todas as páginas ────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginL, pageH - 14, pageW - marginR, pageH - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${p} de ${totalPages}  ·  ${refNum}  ·  Portal Mopar  ·  Gerado em ${hoje}`,
      pageW / 2, pageH - 9, { align: 'center' },
    );
  }

  // ── Salvar ────────────────────────────────────────────────────────────────────
  const filename = report.os_number
    ? `relatorio-OS-${report.os_number}.pdf`
    : `relatorio-${report.id.slice(0, 8)}.pdf`;

  doc.save(filename);
}
