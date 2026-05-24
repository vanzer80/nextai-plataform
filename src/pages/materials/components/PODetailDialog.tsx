import { useState } from 'react';
import { toast } from 'sonner';
import { FileDown, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/src/contexts/TenantContext';
import type { PurchaseOrder } from '@/src/types/purchaseOrder';
import { PO_STATUS_LABEL, PO_STATUS_COLOR } from '@/src/types/purchaseOrder';
import { updatePOStatus } from '@/src/services/purchaseOrderService';
import { gerarPdfPO } from '@/src/utils/gerarPdfPO';

interface Props {
  po: PurchaseOrder | null;
  canProcess: boolean;
  onClose: () => void;
  onUpdated: (po: PurchaseOrder) => void;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

export default function PODetailDialog({ po, canProcess, onClose, onUpdated }: Props) {
  const { tenant } = useTenant();
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!po) return null;

  const handleMarkReceived = async () => {
    setSaving(true);
    try {
      await updatePOStatus(po.id, 'recebido');
      toast.success('PO marcada como recebida.');
      onUpdated({ ...po, status: 'recebido', received_at: new Date().toISOString() });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    setSaving(true);
    try {
      await updatePOStatus(po.id, 'cancelado');
      toast.success('PO cancelada.');
      onUpdated({ ...po, status: 'cancelado' });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await gerarPdfPO({ po, tenantName: tenant?.name ?? 'Empresa', tenantLogoUrl: tenant?.logoUrl });
    } catch (e: any) {
      toast.error('Erro ao gerar PDF: ' + e.message);
    } finally {
      setDownloading(false);
    }
  };

  const items = po.items ?? [];
  const total = items.reduce((s, it) => s + (it.total_price ?? 0), 0);

  return (
    <Dialog open={!!po} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <DialogTitle className="font-mono text-base">{po.po_number}</DialogTitle>
            <Badge className={PO_STATUS_COLOR[po.status]}>{PO_STATUS_LABEL[po.status]}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Supplier + dates */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide mb-1">Fornecedor</p>
              <p className="font-semibold text-foreground">{po.supplier_name ?? po.suppliers?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide mb-1">Emitido em</p>
              <p className="font-medium text-foreground">{fmtDate(po.issued_at ?? po.created_at)}</p>
            </div>
            {po.received_at && (
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide mb-1">Recebido em</p>
                <p className="font-medium text-foreground">{fmtDate(po.received_at)}</p>
              </div>
            )}
            {po.notes && (
              <div className="col-span-2">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide mb-1">Observações</p>
                <p className="text-sm text-muted-foreground">{po.notes}</p>
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Descrição</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground w-16">Qtd</th>
                  <th className="text-center p-3 text-xs font-semibold text-muted-foreground w-16">Un</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground w-28">Preço Unit.</th>
                  <th className="text-right p-3 text-xs font-semibold text-muted-foreground w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map(it => (
                  <tr key={it.id}>
                    <td className="p-3 text-foreground">{it.description}</td>
                    <td className="p-3 text-center text-muted-foreground">{it.qty}</td>
                    <td className="p-3 text-center text-muted-foreground">{it.unit}</td>
                    <td className="p-3 text-right text-muted-foreground">{fmtCurrency(it.unit_price)}</td>
                    <td className="p-3 text-right font-semibold text-foreground">{fmtCurrency(it.total_price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30">
                <tr>
                  <td colSpan={4} className="p-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wide">Total</td>
                  <td className="p-3 text-right font-extrabold text-foreground">{fmtCurrency(po.total_value ?? total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap pt-2">
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="rounded-xl gap-2"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Baixar PDF
            </Button>

            {canProcess && po.status === 'emitido' && (
              <>
                <Button
                  onClick={handleMarkReceived}
                  disabled={saving}
                  className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Marcar como Recebido
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={saving}
                  className="rounded-xl gap-2 text-rose-600 hover:text-rose-700"
                >
                  <XCircle className="h-4 w-4" /> Cancelar PO
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
