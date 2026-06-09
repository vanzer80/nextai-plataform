import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PayrollEntry, PayrollPeriod } from '@/src/types/payroll';
import { urlToDataUrl, detectImageFormat, fitInBox, measureImage } from '@/src/utils/imageUtils';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function fmtCompetencia(comp: string): string {
  const [y, m] = comp.split('-');
  const months = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
  ];
  return `${months[parseInt(m) - 1]} / ${y}`;
}

function pct(val: number, base: number): string {
  if (!base) return '0,00%';
  return (val / base * 100).toFixed(2).replace('.', ',') + '%';
}

export async function gerarHolerite(
  period: PayrollPeriod,
  entry: PayrollEntry,
  companyName: string,
  companyLogoUrl?: string | null,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const emp      = entry.employee;
  const mL = 15, mR = 15;
  const W        = doc.internal.pageSize.getWidth();
  const contentW = W - mL - mR;

  // Pré-carrega logo e mede dimensões reais via browser Image API — falha silenciosa
  const logoDataUrl = companyLogoUrl
    ? await urlToDataUrl(companyLogoUrl).catch(() => null)
    : null;
  const logoDims = logoDataUrl ? await measureImage(logoDataUrl) : null;
  const logoFmt  = logoDataUrl ? detectImageFormat(null, logoDataUrl) : null;
  const { w: logoW, h: logoH } = logoDims
    ? fitInBox(logoDims.width, logoDims.height, 40, 16)
    : { w: 0, h: 0 };

  // ── Cabeçalho azul com logo (consistente com OS e Orçamento) ──
  const HEADER_H = 28;
  const logoY       = logoH > 0 ? (HEADER_H - logoH) / 2 : 6;
  const headerTextX = (logoDataUrl && logoW > 0) ? mL + logoW + 4 : mL;

  doc.setFillColor(30, 64, 175);   // azul DP/RH, diferencia dos demais docs
  doc.rect(0, 0, W, HEADER_H, 'F');

  if (logoDataUrl && logoFmt && logoW > 0) {
    doc.addImage(logoDataUrl, logoFmt, mL, logoY, logoW, logoH);
  }

  // Nome da empresa (esquerda)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(companyName.toUpperCase(), headerTextX, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 210, 255);
  doc.text('Holerite / Recibo de Pagamento', headerTextX, 20);

  // Competência (direita)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('COMPETÊNCIA', W - mR, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(fmtCompetencia(period.competencia), W - mR, 20, { align: 'right' });

  let y = HEADER_H + 8;

  // ── Employee header box ───────────────────────────────────────
  doc.setDrawColor(180, 180, 180);
  doc.setFillColor(248, 250, 252);
  doc.rect(mL, y, contentW, 22, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const col1 = mL + 4;
  const col2 = mL + contentW / 2 + 4;

  doc.text('Colaborador:', col1, y + 6);
  doc.text('Matrícula:',   col2, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  doc.text(emp?.full_name ?? '—', col1 + 22, y + 6);
  doc.text(emp?.matricula ?? '—', col2 + 18, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Cargo:',        col1, y + 12);
  doc.text('Departamento:', col2, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(emp?.position?.title   ?? '—', col1 + 14, y + 12);
  doc.text(emp?.department?.name  ?? '—', col2 + 26, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('CPF:',       col1, y + 18);
  doc.text('PIS/PASEP:', col2, y + 18);
  doc.setFont('helvetica', 'normal');
  const cpfMasked = emp?.cpf
    ? emp.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    : '—';
  doc.text(cpfMasked,       col1 + 10, y + 18);
  doc.text(emp?.pis_pasep ?? '—', col2 + 22, y + 18);

  y += 28;

  // ── Vencimentos / Descontos ───────────────────────────────────
  const vencimentos: (string | number)[][] = [
    ['Salário Base', '—', BRL.format(entry.salario_base)],
  ];
  if (entry.horas_extras_valor > 0)
    vencimentos.push(['Horas Extras', '—', BRL.format(entry.horas_extras_valor)]);
  if (entry.adicional_noturno > 0)
    vencimentos.push(['Adicional Noturno', '—', BRL.format(entry.adicional_noturno)]);
  if (entry.comissoes > 0)
    vencimentos.push(['Comissões', '—', BRL.format(entry.comissoes)]);
  if (entry.outros_vencimentos > 0)
    vencimentos.push(['Outros Vencimentos', '—', BRL.format(entry.outros_vencimentos)]);

  const descontos: (string | number)[][] = [
    ['INSS', `${pct(entry.inss_valor, entry.inss_base)}`,  BRL.format(entry.inss_valor)],
    ['IRRF', `${pct(entry.irrf_valor, entry.irrf_base)}`,  BRL.format(entry.irrf_valor)],
  ];
  if (entry.vt_valor > 0)
    descontos.push(['Vale Transporte (6%)', '6,00%', BRL.format(entry.vt_valor)]);
  if (entry.plano_saude_desconto > 0)
    descontos.push(['Plano de Saúde', '—', BRL.format(entry.plano_saude_desconto)]);
  if (entry.plano_odonto_desconto > 0)
    descontos.push(['Plano Odontológico', '—', BRL.format(entry.plano_odonto_desconto)]);
  if (entry.outros_descontos > 0)
    descontos.push(['Outros Descontos', '—', BRL.format(entry.outros_descontos)]);

  autoTable(doc, {
    startY: y,
    head:  [['VENCIMENTOS', 'Ref.', 'Valor']],
    body:  vencimentos,
    foot:  [['TOTAL VENCIMENTOS', '', BRL.format(entry.total_bruto)]],
    margin: { left: mL, right: W / 2 + 2 },
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175],  fontSize: 8 },
    footStyles: { fillColor: [219, 234, 254], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 2: { halign: 'right' } },
  });

  const tableEndY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: y,
    head:  [['DESCONTOS', 'Alíq.', 'Valor']],
    body:  descontos,
    foot:  [['TOTAL DESCONTOS', '', BRL.format(entry.total_descontos)]],
    margin: { left: W / 2 + 2, right: mR },
    theme: 'grid',
    headStyles: { fillColor: [185, 28, 28],  fontSize: 8 },
    footStyles: { fillColor: [254, 226, 226], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 2: { halign: 'right' } },
  });

  y = Math.max(
    tableEndY,
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY,
  ) + 6;

  // ── Barra de salário líquido ──────────────────────────────────
  doc.setFillColor(30, 64, 175);
  doc.rect(mL, y, contentW, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('SALÁRIO LÍQUIDO:', col1, y + 8);
  doc.text(BRL.format(entry.total_liquido), W - mR - 4, y + 8, { align: 'right' });
  doc.setTextColor(0);
  y += 18;

  // ── FGTS info ─────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(
    `FGTS do mês (não descontado do salário): ${BRL.format(entry.fgts_valor)}  |  Base INSS: ${BRL.format(entry.inss_base)}  |  Base IRRF: ${BRL.format(entry.irrf_base)}`,
    W / 2, y, { align: 'center' },
  );
  y += 8;

  // ── Dados bancários ───────────────────────────────────────────
  if (emp?.banco) {
    doc.setTextColor(0);
    doc.setFontSize(8);
    doc.text(
      `Banco: ${emp.banco}  |  Agência: ${emp.agencia ?? '—'}  |  Conta: ${emp.conta ?? '—'} (${emp.tipo_conta === 'poupanca' ? 'Poupança' : 'Corrente'})`,
      W / 2, y, { align: 'center' },
    );
    y += 8;
  }

  // ── Assinaturas ───────────────────────────────────────────────
  y += 10;
  const sigW = 70;
  const sigX1 = mL + 10;
  const sigX2 = W - mR - sigW - 10;
  doc.setDrawColor(0);
  doc.line(sigX1, y, sigX1 + sigW, y);
  doc.line(sigX2, y, sigX2 + sigW, y);
  doc.setFontSize(8);
  doc.text('Assinatura do Colaborador', sigX1 + sigW / 2, y + 4, { align: 'center' });
  doc.text('Assinatura do Empregador',  sigX2 + sigW / 2, y + 4, { align: 'center' });

  // ── Rodapé discreto ───────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 7;
  doc.setFontSize(6);
  doc.setTextColor(180, 180, 180);
  doc.text(
    `${companyName} · Competência: ${fmtCompetencia(period.competencia)} · Documento gerado pelo NextAI`,
    W / 2,
    footerY,
    { align: 'center' },
  );

  const fileName = `holerite_${emp?.matricula ?? emp?.full_name?.split(' ')[0] ?? 'colaborador'}_${period.competencia}.pdf`;
  doc.save(fileName);
}
