import jsPDF from 'jspdf';
import type { Equipment } from '@/src/types/equipment';

function buildQrUrl(equipment: Equipment): string {
  const base = window.location.origin;
  const params = new URLSearchParams();
  params.set('asset_id', equipment.id);
  if (equipment.client_id) params.set('client_id', equipment.client_id);
  return `${base}/reports/new?${params.toString()}`;
}

async function renderQrToCanvas(url: string, size: number): Promise<HTMLCanvasElement> {
  // Dynamic import to keep qr-code-styling out of initial bundle
  const QRCodeStyling = (await import('qr-code-styling')).default;
  const qr = new QRCodeStyling({
    width: size,
    height: size,
    type: 'canvas',
    data: url,
    dotsOptions: { color: '#1e3a5f', type: 'rounded' },
    backgroundOptions: { color: '#ffffff' },
    cornersSquareOptions: { type: 'extra-rounded' },
  });

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  // qr-code-styling appends to a container; we get the canvas by appending to a temp div
  const div = document.createElement('div');
  document.body.appendChild(div);
  qr.append(div);
  await new Promise(r => setTimeout(r, 300)); // wait for render
  const rendered = div.querySelector('canvas') as HTMLCanvasElement | null;
  const ctx = canvas.getContext('2d')!;
  if (rendered) ctx.drawImage(rendered, 0, 0, size, size);
  document.body.removeChild(div);
  return canvas;
}

export async function exportarEtiquetaQR(equipment: Equipment): Promise<void> {
  const url = buildQrUrl(equipment);

  // A7 format: 74mm × 105mm
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [74, 105] });
  const W = 74;

  // Background
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, W, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  const nameLines = doc.splitTextToSize(equipment.name, 62) as string[];
  doc.text(nameLines, 6, 7);

  // QR code
  const QR_SIZE_PX = 320;
  const QR_MM = 52;
  const qrCanvas = await renderQrToCanvas(url, QR_SIZE_PX);
  const qrDataUrl = qrCanvas.toDataURL('image/png');
  const qrX = (W - QR_MM) / 2;
  doc.addImage(qrDataUrl, 'PNG', qrX, 20, QR_MM, QR_MM);

  // Serial number
  let y = 77;
  if (equipment.serial_number) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('SERIAL', 6, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(equipment.serial_number, 6, y + 4);
    y += 11;
  }

  // URL hint
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(150, 150, 150);
  doc.text('Escaneie para abrir OS', W / 2, 100, { align: 'center' });

  doc.save(`etiqueta-${equipment.name.replace(/\s+/g, '-')}.pdf`);
}

export function getQrUrl(equipment: Equipment): string {
  return buildQrUrl(equipment);
}
