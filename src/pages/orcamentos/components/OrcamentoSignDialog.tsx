import { useRef, useState } from 'react';
import { Loader2, PenLine, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import SignatureCanvas from '@/src/pages/reports/components/SignatureCanvas';
import { assinarOrcamento } from '@/src/services/orcamentoService';

interface Props {
  orcamentoId: string;
  open: boolean;
  onClose: () => void;
  onSigned: () => void;
}

export default function OrcamentoSignDialog({ orcamentoId, open, onClose, onSigned }: Props) {
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const signatureRef = useRef<string | null>(null);

  const handleSignatureChange = (dataUrl: string | null) => {
    signatureRef.current = dataUrl;
  };

  const handleConfirm = async () => {
    if (!signerName.trim()) { toast.warning('Informe o nome do signatário.'); return; }
    if (!signatureRef.current) { toast.warning('Assine no campo de assinatura antes de confirmar.'); return; }

    setSaving(true);
    try {
      await assinarOrcamento(orcamentoId, signerName.trim(), signerEmail.trim(), signatureRef.current);
      toast.success('Orçamento assinado com sucesso.');
      onSigned();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar assinatura.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v && !saving) {
      setSignerName('');
      setSignerEmail('');
      signatureRef.current = null;
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-primary" />
            Coletar Assinatura do Cliente
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <p className="text-sm text-muted-foreground">
            A assinatura registra a aceitação formal do orçamento pelo cliente. Os dados abaixo são declarados pelo signatário.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Nome do signatário *</Label>
              <Input
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                placeholder="Nome completo"
                className="h-11 rounded-xl"
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>E-mail (opcional)</Label>
              <Input
                type="email"
                value={signerEmail}
                onChange={e => setSignerEmail(e.target.value)}
                placeholder="email@empresa.com"
                className="h-11 rounded-xl"
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Assinatura *</Label>
            <SignatureCanvas onSave={handleSignatureChange} label="Assine aqui com o dedo ou mouse" />
          </div>

          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            Assinatura eletrônica simples conforme Lei 14.063/2020. Timestamp registrado no servidor.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving} className="min-w-[130px] gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
            Confirmar assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
