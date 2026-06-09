import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ServiceReport, ReportChecklistItem, ReportSignature, ReportAttachment } from '@/src/types/reports';
import { urlToDataUrl, detectImageFormat, fitInBox, measureImage } from '@/src/utils/imageUtils';

export interface PdfReportData {
  report: ServiceReport;
  checklistItems: ReportChecklistItem[];
  signatures: ReportSignature[];
  attachments: ReportAttachment[];
  tenantName: string;
  tenantLogoUrl?: string | null;
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

export async function gerarPdfRelatorio({
  report,
  checklistItems,
  signatures,
  attachments,
  tenantName,
  tenantLogoUrl,
}: PdfReportData): Promise<void> {

  // Fotos válidas (somente imagens)
  const photoAttachments = attachments.filter(
    a => !a.mime_type || a.mime_type.startsWith('image/'),
  );

  // Pre-fetch ALL images in parallel before drawing anything
  const sigImageMap = new Map<string, string | null>();
  const attImageMap = new Map<string, string | null>();

  let logoDataUrl: string | null = null;
  await Promise.all([
    (async () => { logoDataUrl = tenantLogoUrl ? await urlToDataUrl(tenantLogoUrl).catch(() => null) : null; })(),
    ...signatures.map(async sig => {
      sigImageMap.set(sig.id, await urlToDataUrl(sig.image_url));
    }),
    ...photoAttachments.map(async att => {
      attImageMap.set(att.id, await urlToDataUrl(att.url));
    }),
  ]);

  // Mede dimensões reais via browser Image API (confiável para qualquer formato)
  const logoDims = logoDataUrl ? await measureImage(logoDataUrl) : null;
  const logoFmtRelatorio = logoDataUrl ? detectImageFormat(null, logoDataUrl) : null;
  const { w: logoRelW, h: logoRelH } = logoDims
    ? fitInBox(logoDims.width, logoDims.height, 44, 16)
    : { w: 0, h: 0 };

  // Apenas fotos que carregaram com sucesso
  const photosToShow = photoAttachments.filter(att => attImageMap.get(att.id) !== null);

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
  const headerTextXRel = (logoDataUrl && logoRelW > 0) ? marginL + logoRelW + 4 : marginL;

  if (logoDataUrl && logoFmtRelatorio && logoRelW > 0) {
    doc.addImage(logoDataUrl, logoFmtRelatorio, marginL, 10, logoRelW, logoRelH);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 58, 95);
  doc.text(tenantName.toUpperCase(), headerTextXRel, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Relatório de Serviço Técnico', headerTextXRel, 29);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(refNum, pageW - marginR, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Emitido em: ${hoje}`, pageW - marginR, 26, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(marginL, 36, pageW - marginR, 36);

  let y = 44;

  // ── Identificação ─────────────────────────────────────────────────────────────
  y = drawSectionHeader(doc, 'IDENTIFICAÇÃO', y, marginL, pageW, marginR);

  let y1 = y; let y2 = y;
  y1 = drawField(doc, 'Tipo de Serviço', report.service_type, col1X, y1, colW);
  y2 = drawField(doc, 'Data do Serviço', fmtDate(report.service_date), col2X, y2, colW);
  y = Math.max(y1, y2);

  y1 = y; y2 = y;
  if (report.os_number) y1 = drawField(doc, 'Número OS', report.os_number, col1X, y1, colW);
  if (techName)         y2 = drawField(doc, 'Técnico Responsável', techName, col2X, y2, colW);
  y = Math.max(y1, y2);

  if (report.started_at || report.finished_at) {
    y1 = y; y2 = y;
    if (report.started_at)  y1 = drawField(doc, 'Hora Início', fmtTime(report.started_at), col1X, y1, colW);
    if (report.finished_at) y2 = drawField(doc, 'Hora Término', fmtTime(report.finished_at), col2X, y2, colW);
    y = Math.max(y1, y2);
  }

  if (report.total_minutes != null) {
    y = drawField(doc, 'Duração Total', `${report.total_minutes} minutos`, col1X, y, colW);
  }

  if (clientName)           y = drawField(doc, 'Cliente', clientName, col1X, y, fullW);
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

    if (report.reported_problem)      y = drawField(doc, 'Problema Relatado pelo Cliente', report.reported_problem, col1X, y, fullW);
    if (report.preliminary_diagnosis) y = drawField(doc, 'Diagnóstico Preliminar', report.preliminary_diagnosis, col1X, y, fullW);
    if (report.final_diagnosis)       y = drawField(doc, 'Diagnóstico Final', report.final_diagnosis, col1X, y, fullW);
    if (report.internal_notes)        y = drawField(doc, 'Notas Internas', report.internal_notes, col1X, y, fullW);

    y += 2;
  }

  // ── Execução ──────────────────────────────────────────────────────────────────
  const hasExecution =
    report.services_performed || report.parts_used ||
    report.pending_issues     || report.technical_recommendation;

  if (hasExecution) {
    y = checkPageBreak(doc, y, 30);
    y = drawSectionHeader(doc, 'EXECUÇÃO DO SERVIÇO', y, marginL, pageW, marginR);

    if (report.services_performed)       y = drawField(doc, 'Serviços Executados', report.services_performed, col1X, y, fullW);
    if (report.parts_used)               y = drawField(doc, 'Peças / Materiais Utilizados', report.parts_used, col1X, y, fullW);
    if (report.pending_issues)           y = drawField(doc, 'Pendências', report.pending_issues, col1X, y, fullW);
    if (report.technical_recommendation) y = drawField(doc, 'Recomendação Técnica', report.technical_recommendation, col1X, y, fullW);

    y += 2;
  }

  // ── Checklist ─────────────────────────────────────────────────────────────────
  if (checklistItems.length > 0) {
    y = checkPageBreak(doc, y, 30);
    y = drawSectionHeader(doc, `CHECKLIST (${checklistItems.length} itens)`, y, marginL, pageW, marginR);

    const checklistRows = checklistItems.map(item => {
      const value = (() => {
        if (item.item_type === 'boolean') return item.value_boolean == null ? '—' : item.value_boolean ? 'Sim' : 'Não';
        if (item.item_type === 'text')    return item.value_text   ?? '—';
        if (item.item_type === 'number')  return item.value_number?.toString() ?? '—';
        if (item.item_type === 'select')  return item.value_option ?? '—';
        if (item.item_type === 'photo')   return item.attachment_url ? 'Foto anexada' : '—';
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

  // ── Evidências Fotográficas ───────────────────────────────────────────────────
  if (photosToShow.length > 0) {
    const photoGap  = 4;   // gap entre colunas
    const photoH    = 55;  // altura fixa de cada foto (mm)
    const captionH  = 8;   // espaço reservado para legenda
    const rowH      = photoH + captionH + 3;
    const photoW    = (contentW - photoGap) / 2;

    y = checkPageBreak(doc, y, rowH + 20); // header + pelo menos 1 linha de fotos
    y = drawSectionHeader(
      doc,
      `EVIDÊNCIAS FOTOGRÁFICAS (${photosToShow.length} foto${photosToShow.length > 1 ? 's' : ''})`,
      y, marginL, pageW, marginR,
    );

    for (let i = 0; i < photosToShow.length; i++) {
      const col   = i % 2;
      const att   = photosToShow[i];
      const photoX = marginL + col * (photoW + photoGap);

      // Início de nova linha → verificar quebra de página
      if (col === 0) {
        y = checkPageBreak(doc, y, rowH);
      }

      const dataUrl = attImageMap.get(att.id)!;
      const fmt     = detectImageFormat(att.mime_type, dataUrl);

      // Borda do frame
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.rect(photoX, y, photoW, photoH);

      // Imagem dentro do frame
      try {
        doc.addImage(dataUrl, fmt, photoX + 1, y + 1, photoW - 2, photoH - 2);
      } catch {
        // Formato não suportado — tenta JPEG como fallback
        try {
          doc.addImage(dataUrl, 'JPEG', photoX + 1, y + 1, photoW - 2, photoH - 2);
        } catch {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.text('Foto indisponível', photoX + photoW / 2, y + photoH / 2, { align: 'center' });
        }
      }

      // Legenda (primeira linha apenas)
      if (att.caption) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        const captionLines = doc.splitTextToSize(att.caption, photoW) as string[];
        doc.text(captionLines[0], photoX, y + photoH + 5);
      }

      // Avança y ao final de cada linha (coluna 1 ou último item)
      if (col === 1 || i === photosToShow.length - 1) {
        y += rowH;
      }
    }

    y += 2;
  }

  // ── Assinaturas ───────────────────────────────────────────────────────────────
  if (signatures.length > 0) {
    const sigCount  = Math.min(signatures.length, 3);
    const sigImgH   = 30;
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
          // Embed falhou — box já desenhada, deixa vazia
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
      `Página ${p} de ${totalPages}  ·  ${refNum}  ·  ${tenantName}  ·  Gerado em ${hoje}`,
      pageW / 2, pageH - 9, { align: 'center' },
    );
  }

  // ── Salvar ────────────────────────────────────────────────────────────────────
  const filename = report.os_number
    ? `relatorio-OS-${report.os_number}.pdf`
    : `relatorio-${report.id.slice(0, 8)}.pdf`;

  doc.save(filename);
}
