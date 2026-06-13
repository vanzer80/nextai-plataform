import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { Input } from '@/src/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/src/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  ExternalLink, Image as ImageIcon, Calendar, MapPin, Building2,
  Package, Wrench, Loader2, User, Truck, Store, FileText, Plus, Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { generatePurchaseOrder } from '@/src/services/purchaseOrderService';
import type { GeneratePOInput } from '@/src/types/purchaseOrder';

export type PurchaseRequest = {
  id: string;
  request_number?: string;
  tech_id: string;
  item: string;
  quantity: string;
  status: string;
  created_at: string;
  cidade?: string;
  loja?: string;
  maintenance_type?: string;
  prazo?: string;
  especificacao_tecnica?: string;
  foto_url?: string;
  link_referencia?: string;
  obs?: string;
  comprador_response?: string;
  comprador_id?: string;
  processed_at?: string;
  purchase_price?: number;
  purchase_link?: string;
  logistics_type?: 'retirada' | 'entrega' | null;
  supplier_name?: string | null;
  pickup_address?: string | null;
  clients?: { name: string };
  users?: { full_name: string };
};

interface Props {
  request: PurchaseRequest | null;
  canProcess: boolean;
  onClose: () => void;
  onUpdated: (updated: PurchaseRequest) => void;
}

const STATUS_OPTIONS = [
  { value: 'Em Análise', label: 'Em Análise', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  { value: 'Comprado',   label: 'Comprado',   cls: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  { value: 'Entregue',   label: 'Entregue',   cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { value: 'Cancelado',  label: 'Cancelado',  cls: 'text-rose-700 bg-rose-50 border-rose-200' },
];

const STATUS_BADGE: Record<string, string> = {
  'Pendente':   'bg-amber-100 text-amber-800 border-0',
  'Em Análise': 'bg-blue-100 text-blue-800 border-0',
  'Comprado':   'bg-indigo-100 text-indigo-800 border-0',
  'Entregue':   'bg-emerald-100 text-emerald-800 border-0',
  'Cancelado':  'bg-rose-100 text-rose-800 border-0',
};

function buildNotification(
  newStatus: string,
  itemName: string,
  res: string,
  logistics?: { type: string; supplier?: string; address?: string },
) {
  const short = itemName.length > 60 ? itemName.substring(0, 60) + '…' : itemName;
  const resLine = res ? ` ${res}` : '';
  let logLine = '';
  if (logistics?.type) {
    const verb = logistics.type === 'retirada' ? 'Retirada' : 'Entrega';
    const sup = logistics.supplier ? ` em ${logistics.supplier}` : '';
    const addr = logistics.address ? ` — ${logistics.address}` : '';
    logLine = ` ${verb}${sup}${addr}.`;
  }
  switch (newStatus) {
    case 'Em Análise': return { title: 'Solicitação em análise',  message: `Sua solicitação de "${short}" está sendo analisada pelo setor de compras.${resLine}` };
    case 'Comprado':   return { title: 'Material comprado!',      message: `Sua solicitação de "${short}" foi atendida — o material foi comprado.${resLine}${logLine}` };
    case 'Entregue':   return { title: 'Material entregue!',      message: `O material "${short}" foi marcado como entregue.${resLine}${logLine}` };
    case 'Cancelado':  return { title: 'Solicitação cancelada',   message: `Sua solicitação de "${short}" foi cancelada.${resLine}` };
    default:           return { title: 'Atualização de solicitação', message: `Status atualizado para ${newStatus}.` };
  }
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

export default function PurchaseDetailModal({ request, canProcess, onClose, onUpdated }: Props) {
  const { user } = useAuth();
  const [status, setStatus]               = useState(request?.status || '');
  const [response, setResponse]           = useState(request?.comprador_response || '');
  const [price, setPrice]                 = useState(request?.purchase_price ? String(request.purchase_price) : '');
  const [purchaseLink, setPurchaseLink]   = useState(request?.purchase_link || '');
  const [logisticsType, setLogisticsType] = useState<'retirada' | 'entrega' | ''>(request?.logistics_type ?? '');
  const [supplierName, setSupplierName]   = useState(request?.supplier_name ?? '');
  const [pickupAddress, setPickupAddress] = useState(request?.pickup_address ?? '');
  const [saving, setSaving]               = useState(false);

  // PO generation state
  const [showPoForm, setShowPoForm] = useState(false);
  const [poItems, setPoItems] = useState<GeneratePOInput[]>([
    { description: request?.especificacao_tecnica || request?.item || '', qty: 1, unit: 'un', unit_price: request?.purchase_price ?? 0 },
  ]);
  const [poNotes, setPoNotes] = useState('');
  const [generatingPO, setGeneratingPO] = useState(false);

  if (!request) return null;

  const showPriceFields = status === 'Comprado' || status === 'Entregue';

  const handleSave = async () => {
    if (!user || !canProcess || !status) {
      if (!status) toast.error('Selecione um status antes de salvar.');
      return;
    }
    setSaving(true);
    const toastId = toast.loading('Salvando e notificando técnico...');
    try {
      const payload: Record<string, unknown> = {
        status,
        comprador_response: response.trim() || null,
        comprador_id: user.id,
        processed_at: new Date().toISOString(),
        purchase_price: showPriceFields && price ? parseFloat(price) : null,
        purchase_link: showPriceFields && purchaseLink.trim() ? purchaseLink.trim() : null,
        logistics_type: logisticsType || null,
        supplier_name: supplierName.trim() || null,
        pickup_address: logisticsType && pickupAddress.trim() ? pickupAddress.trim() : null,
      };
      const { error } = await supabase.from('material_requests').update(payload).eq('id', request.id);
      if (error) throw error;
      const itemName = request.especificacao_tecnica || request.item;
      const notif = buildNotification(status, itemName, response.trim(), {
        type: logisticsType,
        supplier: supplierName.trim(),
        address: pickupAddress.trim(),
      });
      await supabase.from('notifications').insert({ user_id: request.tech_id, ...notif });
      toast.success('Salvo!', { id: toastId, description: `Status: "${status}" — técnico notificado.` });
      onUpdated({ ...request, ...payload } as PurchaseRequest);
    } catch (err: any) {
      toast.error('Erro ao salvar', { id: toastId, description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[95vw] max-w-4xl sm:max-w-4xl p-0 gap-0 border-0 bg-transparent shadow-none">
        <div className="bg-card rounded-2xl flex flex-col overflow-hidden max-h-[92vh]">

          {/* ── Header ── */}
          <div className="px-5 py-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center justify-between gap-3 flex-wrap pr-6">
              <DialogTitle className="text-base font-bold text-foreground font-mono">
                {request.request_number ?? `#${request.id.substring(0, 8).toUpperCase()}`}
              </DialogTitle>
              <Badge className={clsx('shrink-0', STATUS_BADGE[request.status] || 'bg-slate-100 text-slate-700 border-0')}>
                {request.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-1">
              <User className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="font-semibold text-foreground">{request.users?.full_name || 'Usuário'}</span>
              <span className="text-slate-300">•</span>
              <span>{new Date(request.created_at).toLocaleDateString('pt-BR')}</span>
              {request.prazo && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>Prazo: <strong className={clsx(
                    new Date(request.prazo) < new Date() && request.status === 'Pendente'
                      ? 'text-rose-600' : 'text-foreground'
                  )}>{new Date(request.prazo).toLocaleDateString('pt-BR')}</strong></span>
                </>
              )}
            </div>
          </div>

          <div className={clsx(
            'flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row',
            !canProcess && 'lg:flex-col'
          )}>

          {/* ── Coluna Esquerda: Detalhes (sempre visível) ── */}
          <div className={clsx('overflow-y-auto p-5 space-y-4 min-w-0', canProcess ? 'flex-1' : 'flex-1')}>

            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Localização & Serviço</p>
              <div className="rounded-xl border border-border divide-y divide-border bg-card overflow-hidden">
                {request.cidade && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Cidade" value={request.cidade} />}
                {request.clients?.name && <InfoRow icon={<Building2 className="h-4 w-4" />} label="Cliente" value={request.clients.name} />}
                {request.loja && <InfoRow icon={<Building2 className="h-4 w-4" />} label="Loja / Unidade" value={request.loja} />}
                {request.maintenance_type && <InfoRow icon={<Wrench className="h-4 w-4" />} label="Tipo de Manutenção" value={request.maintenance_type} />}
                <InfoRow icon={<Package className="h-4 w-4" />} label="Quantidade" value={request.quantity} />
                {request.prazo && <InfoRow icon={<Calendar className="h-4 w-4" />} label="Prazo" value={new Date(request.prazo).toLocaleDateString('pt-BR')} />}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Especificação Técnica</p>
              <div className="bg-muted/40 rounded-xl p-4 border border-border">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                  {request.especificacao_tecnica || request.item}
                </p>
              </div>
            </div>

            {request.obs && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Observações</p>
                <p className="text-sm text-foreground italic bg-amber-50 border border-amber-100 rounded-xl p-3 break-words">
                  {request.obs}
                </p>
              </div>
            )}

            {(request.foto_url || request.link_referencia) && (
              <div className="flex gap-2 flex-wrap">
                {request.foto_url && (
                  <a href={request.foto_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-semibold bg-blue-50 border border-blue-100 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors">
                    <ImageIcon className="h-3.5 w-3.5" /> Ver Foto
                  </a>
                )}
                {request.link_referencia && (
                  <a href={request.link_referencia} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-semibold bg-blue-50 border border-blue-100 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" /> Link de Referência
                  </a>
                )}
              </div>
            )}

            {/* Devolutiva anterior para o Comprador */}
            {canProcess && request.comprador_response && (
              <div className="bg-muted/40 rounded-xl p-3 border border-border space-y-1">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Devolutiva anterior</p>
                <p className="text-sm text-muted-foreground italic break-words">{request.comprador_response}</p>
                {request.supplier_name && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Store className="h-3 w-3 shrink-0" /> {request.supplier_name}
                  </p>
                )}
                {request.logistics_type && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {request.logistics_type === 'retirada'
                      ? <Package className="h-3 w-3 shrink-0" />
                      : <Truck className="h-3 w-3 shrink-0" />}
                    {request.logistics_type === 'retirada' ? 'Retirada' : 'Entrega'}
                    {request.pickup_address ? ` — ${request.pickup_address}` : ''}
                  </p>
                )}
              </div>
            )}

            {/* Read-only para técnico */}
            {!canProcess && request.comprador_response && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Resposta do Setor de Compras</p>
                <div className={clsx('rounded-xl p-4 border space-y-2', request.status === 'Cancelado' ? 'bg-rose-50 border-rose-200' : 'bg-blue-50 border-blue-200')}>
                  <p className={clsx('text-sm leading-relaxed break-words', request.status === 'Cancelado' ? 'text-rose-800' : 'text-blue-800')}>
                    {request.comprador_response}
                  </p>
                  {request.supplier_name && (
                    <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                      <Store className="h-3.5 w-3.5 shrink-0" /> {request.supplier_name}
                    </p>
                  )}
                  {request.logistics_type && (
                    <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                      {request.logistics_type === 'retirada'
                        ? <Package className="h-3.5 w-3.5 shrink-0" />
                        : <Truck className="h-3.5 w-3.5 shrink-0" />}
                      {request.logistics_type === 'retirada' ? 'Retirada' : 'Entrega'}
                      {request.pickup_address ? ` — ${request.pickup_address}` : ''}
                    </p>
                  )}
                  {request.purchase_price && (
                    <p className="text-xs font-bold text-blue-700">
                      Valor pago: R$ {Number(request.purchase_price).toFixed(2)}
                    </p>
                  )}
                  {request.purchase_link && (
                    <a href={request.purchase_link} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline">
                      <ExternalLink className="h-3 w-3" /> Ver produto comprado
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Coluna Direita: Painel de Ação (Comprador only) ── */}
          {canProcess && (
            <div className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-muted/40 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Painel de Ação</p>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground">Atualizar Status *</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-11 rounded-xl bg-background border-input focus:ring-ring">
                      <SelectValue placeholder="Selecione um status..." />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="py-2.5">
                          <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-md border', opt.cls)}>
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground">
                    {status === 'Cancelado' ? 'Motivo do Cancelamento' : 'Devolutiva ao Técnico'}
                  </Label>
                  <Textarea
                    value={response}
                    onChange={e => setResponse(e.target.value)}
                    placeholder={status === 'Cancelado' ? 'Informe o motivo do cancelamento...' : 'Fornecedor, prazo de entrega, observações...'}
                    className="min-h-[100px] rounded-xl bg-background border-input focus-visible:ring-ring resize-none text-sm"
                  />
                </div>

                {showPriceFields && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-foreground">Valor Pago (R$)</Label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">R$</span>
                        <Input
                          type="number" step="0.01" placeholder="0,00"
                          value={price} onChange={e => setPrice(e.target.value)}
                          className="h-11 pl-10 rounded-xl bg-background border-input focus-visible:ring-ring"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-foreground">Link de Onde Comprou</Label>
                      <Input
                        type="url" placeholder="https://..."
                        value={purchaseLink} onChange={e => setPurchaseLink(e.target.value)}
                        className="h-11 rounded-xl bg-background border-input focus-visible:ring-ring"
                      />
                    </div>
                  </>
                )}

                {/* Logística */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground">Fornecedor</Label>
                  <Input
                    placeholder="Nome da loja ou fornecedor..."
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    className="h-11 rounded-xl bg-background border-input focus-visible:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground">Logística</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLogisticsType(prev => prev === 'retirada' ? '' : 'retirada')}
                      className={clsx(
                        'flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border text-sm font-semibold transition-colors',
                        logisticsType === 'retirada'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-background text-muted-foreground border-input hover:border-blue-400'
                      )}
                    >
                      <Package className="h-4 w-4" /> Retirada
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogisticsType(prev => prev === 'entrega' ? '' : 'entrega')}
                      className={clsx(
                        'flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border text-sm font-semibold transition-colors',
                        logisticsType === 'entrega'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-background text-muted-foreground border-input hover:border-emerald-400'
                      )}
                    >
                      <Truck className="h-4 w-4" /> Entrega
                    </button>
                  </div>
                </div>

                {logisticsType && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground">
                      {logisticsType === 'retirada' ? 'Endereço de Retirada' : 'Endereço de Entrega'}
                    </Label>
                    <Input
                      placeholder="Rua, número, cidade..."
                      value={pickupAddress}
                      onChange={e => setPickupAddress(e.target.value)}
                      className="h-11 rounded-xl bg-background border-input focus-visible:ring-ring"
                    />
                  </div>
                )}
              </div>

              {/* PO Generation — visible when status = Comprado */}
              {(status === 'Comprado' || status === 'Entregue') && (
                <div className="px-5 pb-4">
                  <button
                    type="button"
                    onClick={() => setShowPoForm(v => !v)}
                    className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    {showPoForm ? 'Ocultar formulário de PO' : 'Gerar Ordem de Compra (PO)'}
                  </button>

                  {showPoForm && (
                    <div className="mt-3 space-y-3 border border-border rounded-xl p-3 bg-background">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Itens da PO</p>
                      {poItems.map((item, idx) => (
                        <div key={idx} className="space-y-2">
                          <Input
                            placeholder="Descrição do item"
                            value={item.description}
                            onChange={e => setPoItems(items => items.map((it, i) => i === idx ? { ...it, description: e.target.value } : it))}
                            className="h-9 rounded-lg bg-muted text-sm"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              type="number" placeholder="Qtd" min={0.01} step={0.01}
                              value={item.qty}
                              onChange={e => setPoItems(items => items.map((it, i) => i === idx ? { ...it, qty: Number(e.target.value) } : it))}
                              className="h-9 rounded-lg bg-muted text-sm"
                            />
                            <Input
                              placeholder="Un"
                              value={item.unit}
                              onChange={e => setPoItems(items => items.map((it, i) => i === idx ? { ...it, unit: e.target.value } : it))}
                              className="h-9 rounded-lg bg-muted text-sm"
                            />
                            <Input
                              type="number" placeholder="R$ unit." min={0} step={0.01}
                              value={item.unit_price}
                              onChange={e => setPoItems(items => items.map((it, i) => i === idx ? { ...it, unit_price: Number(e.target.value) } : it))}
                              className="h-9 rounded-lg bg-muted text-sm"
                            />
                          </div>
                          {poItems.length > 1 && (
                            <button type="button" onClick={() => setPoItems(items => items.filter((_, i) => i !== idx))}
                              className="text-xs text-rose-500 flex items-center gap-1 hover:text-rose-600">
                              <Trash2 className="h-3 w-3" /> Remover item
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => setPoItems(items => [...items, { description: '', qty: 1, unit: 'un', unit_price: 0 }])}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-semibold">
                        <Plus className="h-3.5 w-3.5" /> Adicionar item
                      </button>
                      <Input
                        placeholder="Observações para o fornecedor (opcional)"
                        value={poNotes}
                        onChange={e => setPoNotes(e.target.value)}
                        className="h-9 rounded-lg bg-muted text-sm"
                      />
                      <Button
                        size="sm"
                        disabled={generatingPO || !request}
                        className="w-full rounded-lg gap-2"
                        onClick={async () => {
                          if (!request) return;
                          setGeneratingPO(true);
                          try {
                            const result = await generatePurchaseOrder(request.id, poItems, poNotes || undefined);
                            toast.success(`PO ${result.po_number} gerada com sucesso!`);
                            setShowPoForm(false);
                          } catch (e: any) {
                            toast.error(e.message);
                          } finally {
                            setGeneratingPO(false);
                          }
                        }}
                      >
                        {generatingPO ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando...</> : <><FileText className="h-3.5 w-3.5" /> Emitir PO</>}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Botão fixo na base do painel */}
              <div className="p-5 border-t border-border bg-card shrink-0 space-y-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || !status}
                  className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
                >
                  {saving
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                    : 'Salvar & Notificar Técnico'}
                </Button>
                <p className="text-[10px] text-center text-muted-foreground font-medium">
                  O técnico será notificado automaticamente.
                </p>
              </div>
            </div>
          )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
