import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PurchaseOrder } from '@/src/types/purchaseOrder';
import { urlToDataUrl, detectImageFormat } from '@/src/utils/imageUtils';

export interface PdfPOData {
  po: PurchaseOrder;
  tenantName: string;
  tenantLogoUrl?: string | null;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR }); } catch { return d; }
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

export async function gerarPdfPO({ po, tenantName, tenantLogoUrl }: PdfPOData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW   = doc.internal.pageSize.getWidth();
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR;

  // Pre-fetch logo
  const logoDataUrl = tenantLogoUrl ? await urlToDataUrl(tenantLogoUrl).catch(() => null) : null;

  // ── Header ────────────────────────────────────────────────────
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageW, 30, 'F');

  let textX = marginL;
  if (logoDataUrl) {
    const fmt = detectImageFormat(null, logoDataUrl);
    doc.addImage(logoDataUrl, fmt, marginL, 7, 0, 16);
    textX = marginL + 22;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(tenantName, textX, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Ordem de Compra', textX, 21);

  // PO number badge (top-right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(po.po_number, pageW - marginR, 14, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emitido em: ${fmtDate(po.issued_at ?? po.created_at)}`, pageW - marginR, 21, { align: 'right' });

  let y = 38;

  // ── Status + Supplier ─────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('FORNECEDOR', marginL, y);
  doc.text('STATUS', pageW / 2, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(po.supplier_name ?? po.suppliers?.name ?? '—', marginL, y);

  const statusLabels: Record<string, string> = {
    rascunho: 'Rascunho', emitido: 'Emitido', recebido: 'Recebido', cancelado: 'Cancelado',
  };
  doc.text(statusLabels[po.status] ?? po.status, pageW / 2, y);

  if (po.received_at) {
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Recebido em: ${fmtDate(po.received_at)}`, pageW / 2, y);
  }

  y += 8;

  if (po.notes) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('OBSERVAÇÕES', marginL, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const noteLines = doc.splitTextToSize(po.notes, contentW) as string[];
    doc.text(noteLines, marginL, y);
    y += noteLines.length * 4.5 + 6;
  }

  // ── Items table ───────────────────────────────────────────────
  const items = po.items ?? [];
  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginR },
    head: [['Descrição', 'Qtd', 'Unidade', 'Preço Unit.', 'Total']],
    body: items.map(it => [
      it.description,
      String(it.qty),
      it.unit,
      fmtCurrency(it.unit_price),
      fmtCurrency(it.total_price),
    ]),
    foot: [['', '', '', 'TOTAL', fmtCurrency(po.total_value)]],
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 58, 95], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
  });

  // ── Footer ────────────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`${tenantName} · ${po.po_number}`, marginL, footerY);
    doc.text(`Pág. ${i}/${pageCount}`, pageW - marginR, footerY, { align: 'right' });
  }

  doc.save(`${po.po_number}.pdf`);
}
