import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileText, X, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const SOURCES = [
  { value: 'pdf',    label: 'PDF / Escaneado' },
  { value: 'totvs',  label: 'TOTVS' },
  { value: 'sap',    label: 'SAP' },
  { value: 'omie',   label: 'Omie' },
  { value: 'custom', label: 'Outro sistema' },
] as const;

const PRIORITIES = [
  { value: 'baixa',   label: 'Baixa' },
  { value: 'normal',  label: 'Normal' },
  { value: 'alta',    label: 'Alta' },
  { value: 'critica', label: 'Crítica' },
] as const;

interface ImportResult {
  os_id: string;
  os_number: string;
  client_resolution: string | null;
  duplicate: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve((reader.result as string).split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function ImportOsDialog({ open, onClose, onImported }: Props) {
  const navigate = useNavigate();
  const [mode, setMode]     = useState<'pdf' | 'fields'>('pdf');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<ImportResult | null>(null);

  const [source, setSource]           = useState('pdf');
  const [externalRefId, setExternalRefId] = useState('');

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [clientName, setClientName]           = useState('');
  const [clientCnpj, setClientCnpj]           = useState('');
  const [techName, setTechName]               = useState('');
  const [serviceType, setServiceType]         = useState('');
  const [serviceDate, setServiceDate]         = useState('');
  const [priority, setPriority]               = useState('normal');
  const [siteLocation, setSiteLocation]       = useState('');
  const [assetName, setAssetName]             = useState('');
  const [reportedProblem, setReportedProblem] = useState('');
  const [servicesPerformed, setServicesPerformed] = useState('');
  const [finalDiagnosis, setFinalDiagnosis]   = useState('');
  const [partsUsed, setPartsUsed]             = useState('');

  const reset = () => {
    setMode('pdf'); setLoading(false); setResult(null);
    setSource('pdf'); setExternalRefId(''); setPdfFile(null);
    setClientName(''); setClientCnpj(''); setTechName('');
    setServiceType(''); setServiceDate(''); setPriority('normal');
    setSiteLocation(''); setAssetName('');
    setReportedProblem(''); setServicesPerformed('');
    setFinalDiagnosis(''); setPartsUsed('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (mode === 'pdf' && !pdfFile) {
      toast.error('Selecione um arquivo PDF.');
      return;
    }
    if (mode === 'fields' && !reportedProblem.trim()) {
      toast.error('Problema reportado é obrigatório.');
      return;
    }

    setLoading(true);
    try {
      const refId = externalRefId.trim() || crypto.randomUUID();
      let payload: Record<string, unknown>;

      if (mode === 'pdf') {
        const pdfBase64 = await fileToBase64(pdfFile!);
        payload = { mode: 'pdf', external_source: source, external_ref_id: refId, pdf_base64: pdfBase64 };
      } else {
        payload = {
          mode: 'json',
          external_source: source,
          external_ref_id: refId,
          priority,
          ...(clientName.trim()        && { client_name:         clientName.trim() }),
          ...(clientCnpj.trim()        && { client_cnpj:         clientCnpj.trim() }),
          ...(techName.trim()          && { technician_name:     techName.trim() }),
          ...(serviceType.trim()       && { service_type:        serviceType.trim() }),
          ...(serviceDate              && { service_date:        serviceDate }),
          ...(siteLocation.trim()      && { site_location:       siteLocation.trim() }),
          ...(assetName.trim()         && { asset_name:          assetName.trim() }),
          ...(reportedProblem.trim()   && { reported_problem:    reportedProblem.trim() }),
          ...(servicesPerformed.trim() && { services_performed:  servicesPerformed.trim() }),
          ...(finalDiagnosis.trim()    && { final_diagnosis:     finalDiagnosis.trim() }),
          ...(partsUsed.trim()         && { parts_used:          partsUsed.trim() }),
        };
      }

      const { data, error } = await supabase.functions.invoke('os-import-processor', {
        body: payload,
      });

      if (error) {
        let detail = error.message;
        try {
          if ('context' in error) {
            const body = await (error.context as Response).json();
            detail = body.detail ?? body.message ?? error.message;
          }
        } catch { /* usa error.message */ }
        throw new Error(detail);
      }

      const imported = (data as { data: ImportResult }).data;
      setResult(imported);
      onImported?.();

    } catch (err) {
      toast.error('Falha na importação', {
        description: (err instanceof Error ? err.message : String(err)).slice(0, 200),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar OS de sistema externo</DialogTitle>
          <DialogDescription>
            Importe uma OS do TOTVS, SAP, Omie ou PDF. O sistema resolve cliente e técnico
            automaticamente — zero redigitação.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <div>
              <p className="text-lg font-semibold">
                {result.duplicate ? 'OS já importada anteriormente' : 'OS importada com sucesso!'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Número: <span className="font-mono font-semibold text-foreground">{result.os_number}</span>
              </p>
              {result.client_resolution === 'auto_created' && (
                <p className="text-xs text-amber-600 mt-1">
                  Cliente criado automaticamente — verifique os dados do cliente.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>Fechar</Button>
              <Button onClick={() => { handleClose(); navigate(`/reports/${result.os_id}`); }}>
                Ver OS
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">

            {/* Tab selector */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {(['pdf', 'fields'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-sm font-medium transition-colors ${
                    mode === m
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m === 'pdf' ? <><UploadCloud className="h-3.5 w-3.5" /> Importar PDF</> : <><FileText className="h-3.5 w-3.5" /> Preencher campos</>}
                </button>
              ))}
            </div>

            {/* Campos comuns */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Sistema de origem</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>
                  Referência externa{' '}
                  <span className="text-muted-foreground text-xs font-normal">(opcional)</span>
                </Label>
                <Input
                  placeholder="Nº da OS no sistema de origem"
                  value={externalRefId}
                  onChange={e => setExternalRefId(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* PDF mode */}
            {mode === 'pdf' && (
              <div className="flex flex-col gap-2">
                <Label>Arquivo PDF <span className="text-destructive">*</span></Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                    pdfFile
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  {pdfFile ? (
                    <>
                      <FileText className="h-6 w-6 text-primary" />
                      <p className="text-sm font-medium text-foreground">{pdfFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(pdfFile.size / 1024).toFixed(0)} KB</p>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setPdfFile(null); }}
                        className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 mt-1"
                      >
                        <X className="h-3 w-3" /> Remover
                      </button>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Clique para selecionar o PDF da OS</p>
                      <p className="text-xs text-muted-foreground">
                        O Gemini extrai automaticamente cliente, técnico, problema e serviços
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
                />
              </div>
            )}

            {/* Fields mode */}
            {mode === 'fields' && (
              <div className="flex flex-col gap-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Nome do cliente</Label>
                    <Input placeholder="Ex: Empresa ABC Ltda" value={clientName} onChange={e => setClientName(e.target.value)} className="h-9" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>CNPJ <span className="text-muted-foreground text-xs font-normal">(match exato)</span></Label>
                    <Input placeholder="00.000.000/0000-00" value={clientCnpj} onChange={e => setClientCnpj(e.target.value)} className="h-9" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Técnico responsável</Label>
                    <Input placeholder="Nome do técnico" value={techName} onChange={e => setTechName(e.target.value)} className="h-9" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Tipo de serviço</Label>
                    <Input placeholder="Ex: Manutenção preventiva" value={serviceType} onChange={e => setServiceType(e.target.value)} className="h-9" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Data do serviço</Label>
                    <Input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} className="h-9" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Prioridade</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Local de atendimento</Label>
                    <Input placeholder="Endereço / local" value={siteLocation} onChange={e => setSiteLocation(e.target.value)} className="h-9" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Equipamento</Label>
                    <Input placeholder="Nome ou modelo" value={assetName} onChange={e => setAssetName(e.target.value)} className="h-9" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Problema reportado <span className="text-destructive">*</span></Label>
                  <Textarea
                    placeholder="Descreva o problema conforme registrado no sistema de origem"
                    value={reportedProblem}
                    onChange={e => setReportedProblem(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Serviços executados</Label>
                  <Textarea
                    placeholder="Serviços realizados no atendimento"
                    value={servicesPerformed}
                    onChange={e => setServicesPerformed(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Diagnóstico final</Label>
                    <Textarea
                      placeholder="Diagnóstico técnico"
                      value={finalDiagnosis}
                      onChange={e => setFinalDiagnosis(e.target.value)}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Peças utilizadas</Label>
                    <Textarea
                      placeholder="Lista de peças e quantidades"
                      value={partsUsed}
                      onChange={e => setPartsUsed(e.target.value)}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="gap-1.5">
                {loading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importando...</>
                  : 'Importar OS'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
