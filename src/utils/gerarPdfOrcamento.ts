import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OrcamentoComItens } from '@/src/types/orcamento';
import { urlToDataUrl, detectImageFormat, fitInBox, measureImage } from '@/src/utils/imageUtils';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

const OS_STATUS_LABEL_PT: Record<string, string> = {
  approved:       'Aprovada',
  returned:       'Devolvida',
  pending_review: 'Ag. Revisão',
  draft:          'Rascunho',
  rejected:       'Reprovada',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export interface PdfOrcamentoOptions {
  tenantLogoUrl?: string | null;
  signatureDataUrl?: string | null;
  signerName?: string | null;
  signerEmail?: string | null;
  signedAt?: string | null;
}

export async function gerarPdfOrcamento(
  orcamento: OrcamentoComItens,
  tenantName: string,
  options: PdfOrcamentoOptions = {},
): Promise<void> {
  const {
    tenantLogoUrl,
    signatureDataUrl,
    signerName,
    signerEmail,
    signedAt,
  } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const marginL  = 15;
  const marginR  = 15;
  const pageW    = doc.internal.pageSize.getWidth();
  const pageH    = doc.internal.pageSize.getHeight();
  const contentW = pageW - marginL - marginR;

  const hoje  = formatDate(new Date().toISOString().slice(0, 10));
  const numOrc = `ORC-${orcamento.id.slice(0, 8).toUpperCase()}`;
  const cli           = orcamento.clients;
  const clienteNome   = cli?.name ?? '—';
  const clienteCnpj   = cli?.cnpj ?? null;
  const clienteEndereco = cli
    ? [cli.logradouro, cli.numero].filter(Boolean).join(', ')
    : '';
  const clienteCidade = cli
    ? [cli.bairro, cli.cidade, cli.estado].filter(Boolean).join(' — ')
    : '';
  const clienteContato  = cli?.contato_nome ?? null;
  const clienteTelefone = cli?.contato_telefone ?? null;
  const clienteEmail    = cli?.contato_email ?? null;
  const tecnicoNome = orcamento.users?.full_name ?? '—';

  // Pré-carrega logo e mede dimensões reais — falha silenciosa (PDF gerado mesmo sem logo)
  const logoDataUrl = tenantLogoUrl
    ? await urlToDataUrl(tenantLogoUrl).catch(() => null)
    : null;
  // measureImage usa HTMLImageElement.naturalWidth/Height — confiável para qualquer formato
  const logoDims = logoDataUrl ? await measureImage(logoDataUrl) : null;
  const logoFmt  = logoDataUrl ? detectImageFormat(null, logoDataUrl) : null;
  const { w: logoW, h: logoH } = logoDims
    ? fitInBox(logoDims.width, logoDims.height, 40, 16)
    : { w: 0, h: 0 };
  const logoY = logoH > 0 ? (30 - logoH) / 2 : 7;

  // ── Cabeçalho azul (consistente com OS e PO) ─────────────────
  const HEADER_H = 30;
  const headerTextX = (logoDataUrl && logoW > 0) ? marginL + logoW + 4 : marginL;

  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageW, HEADER_H, 'F');

  if (logoDataUrl && logoFmt && logoW > 0) {
    doc.addImage(logoDataUrl, logoFmt, marginL, logoY, logoW, logoH);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(tenantName, headerTextX, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 210, 255);
  doc.text('Orçamento Técnico', headerTextX, 21);

  // Número e datas no canto direito do cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(numOrc, pageW - marginR, 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 210, 255);
  doc.text(`Emissão: ${hoje}`, pageW - marginR, 21, { align: 'right' });
  if (orcamento.validade) {
    doc.text(`Válido até: ${formatDate(orcamento.validade)}`, pageW - marginR, 27, { align: 'right' });
  }

  // ── Dados do cliente ─────────────────────────────────────────
  let y = 40;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('CLIENTE', marginL, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(clienteNome, marginL, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  if (clienteCnpj) {
    y += 5;
    doc.text(clienteCnpj, marginL, y);
  }
  if (clienteEndereco) {
    y += 5;
    doc.text(clienteEndereco, marginL, y);
  }
  if (clienteCidade) {
    y += 5;
    doc.text(clienteCidade, marginL, y);
  }
  if (clienteContato || clienteTelefone || clienteEmail) {
    y += 5;
    const contatoParts = [clienteContato, clienteTelefone, clienteEmail].filter(Boolean);
    doc.text(contatoParts.join(' · '), marginL, y);
  }

  y += 5;
  doc.text(`Técnico responsável: ${tecnicoNome}`, marginL, y);

  if (orcamento.titulo) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 95);
    doc.text(orcamento.titulo, marginL, y);
  }

  // ── OS Vinculada (box destacado) ─────────────────────────────
  if (orcamento.report_id) {
    y += 7;
    const sr = orcamento.service_reports;
    const boxH = 20;
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(marginL, y, contentW, boxH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(29, 78, 216);
    doc.text('ORDEM DE SERVIÇO VINCULADA', marginL + 4, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(sr?.os_number ?? 'OS sem número', marginL + 4, y + 13);

    const meta: string[] = [];
    if (sr?.service_type) meta.push(sr.service_type);
    if (sr?.service_date) meta.push(formatDate(sr.service_date));
    if (sr?.status)       meta.push(OS_STATUS_LABEL_PT[sr.status] ?? sr.status);
    if (meta.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(meta.join('   ·   '), marginL + 4, y + 18);
    }
    y += boxH + 4;
  }

  y += 8;

  // ── Tabela de itens ──────────────────────────────────────────
  const rows = orcamento.orcamento_itens.map((item, i) => {
    const total = item.quantidade * item.valor_unitario;
    return [
      String(i + 1),
      item.descricao,
      NUM.format(item.quantidade),
      item.unidade,
      BRL.format(item.valor_unitario),
      BRL.format(total),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Descrição', 'Qtd', 'Un.', 'Valor Unit.', 'Total']],
    body: rows,
    margin: { left: marginL, right: marginR },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center' },
      1: { cellWidth: contentW - 8 - 15 - 12 - 30 - 30 },
      2: { cellWidth: 15, halign: 'right' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
    },
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles:          { fontSize: 9, textColor: [15, 23, 42] },
    alternateRowStyles:  { fillColor: [245, 247, 250] },
    styles:              { cellPadding: 3 },
    // Rodapé com número do documento em páginas adicionais
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFillColor(30, 58, 95);
        doc.rect(0, 0, pageW, HEADER_H, 'F');
        if (logoDataUrl && logoFmt && logoW > 0) {
          doc.addImage(logoDataUrl, logoFmt, marginL, logoY, logoW, logoH);
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text(numOrc, pageW - marginR, 14, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(180, 210, 255);
        doc.text(`${tenantName} — Orçamento Técnico`, headerTextX, 14);
      }
    },
  });

  // ── Totais ────────────────────────────────────────────────────
  const finalY: number = (doc as jsPDF & { lastAutoTable?: { finalY?: number } })
    .lastAutoTable?.finalY ?? y + 10;

  const subtotal = orcamento.orcamento_itens.reduce(
    (acc, item) => acc + item.quantidade * item.valor_unitario,
    0,
  );
  const desconto = subtotal * (orcamento.desconto_pct / 100);
  const total    = subtotal - desconto;

  let ty = finalY + 6;
  const col1X = pageW - marginR - 70;
  const col2X = pageW - marginR;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal:', col1X, ty);
  doc.text(BRL.format(subtotal), col2X, ty, { align: 'right' });

  if (orcamento.desconto_pct > 0) {
    ty += 6;
    doc.text(`Desconto (${orcamento.desconto_pct}%):`, col1X, ty);
    doc.text(`- ${BRL.format(desconto)}`, col2X, ty, { align: 'right' });
  }

  ty += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 95);
  doc.text('TOTAL:', col1X, ty);
  doc.text(BRL.format(total), col2X, ty, { align: 'right' });

  // ── Observações ───────────────────────────────────────────────
  if (orcamento.observacoes) {
    ty += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('OBSERVAÇÕES', marginL, ty);

    ty += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(orcamento.observacoes, contentW);
    doc.text(lines, marginL, ty);
    ty += lines.length * 5;
  }

  // ── Rodapé com assinatura ─────────────────────────────────────
  const footerY = pageH - 35;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(marginL, footerY, pageW - marginR, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);

  if (signatureDataUrl) {
    try {
      const imgFormat = signatureDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(signatureDataUrl, imgFormat, pageW / 2 - 30, footerY + 2, 60, 18);
    } catch {
      doc.text('_______________________________', pageW / 2, footerY + 12, { align: 'center' });
    }

    const assinadoPor = signerName
      ? `Assinado digitalmente por: ${signerName}`
      : 'Assinado digitalmente';
    const assinadoEm = signedAt
      ? ` em ${new Date(signedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
      : '';

    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(assinadoPor + assinadoEm, pageW / 2, footerY + 22, { align: 'center' });
    if (signerEmail) {
      doc.setTextColor(100, 116, 139);
      doc.text(signerEmail, pageW / 2, footerY + 26, { align: 'center' });
    }
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text('Assinatura eletrônica simples · Lei 14.063/2020', pageW / 2, footerY + 30, { align: 'center' });
  } else {
    doc.text(
      'Assinatura do Cliente: _______________________________',
      pageW / 2,
      footerY + 10,
      { align: 'center' },
    );
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);

  // Paginação — exibida no rodapé de todas as páginas
  const totalPages = (doc.internal as unknown as { getNumberOfPages(): number }).getNumberOfPages();
  const pageLabel  = totalPages > 1 ? ` · Pág. ${totalPages}/${totalPages}` : '';
  doc.text(`Gerado em ${hoje} · ${numOrc}${pageLabel}`, pageW / 2, footerY + 34, { align: 'center' });

  // Páginas intermediárias recebem rodapé de navegação
  if (totalPages > 1) {
    for (let p = 1; p < totalPages; p++) {
      doc.setPage(p);
      const fY = pageH - 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`${tenantName} · ${numOrc}`, marginL, fY);
      doc.text(`Pág. ${p}/${totalPages}`, pageW - marginR, fY, { align: 'right' });
    }
    doc.setPage(totalPages);
  }

  doc.save(`orcamento-${orcamento.id.slice(0, 8)}.pdf`);
}
