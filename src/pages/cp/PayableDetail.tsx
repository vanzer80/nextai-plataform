import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, CheckCircle2, XCircle, CreditCard,
  Loader2, MessageSquare, ExternalLink, Edit2, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button }   from '@/src/components/ui/button';
import { Badge }    from '@/src/components/ui/badge';
import { Input }    from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/src/components/ui/dialog';

import {
  getPayable, submitPayable, approvePayable, rejectPayable,
  payPayable, cancelPayable, addComment, deletePayable,
} from '@/src/services/payableService';
import type { Payable, PayableInstallment } from '@/src/types/payable';
import { useAuth } from '@/src/contexts/AuthContext';

// ── helpers ───────────────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtDatetime(iso?: string | null): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  return dt.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

const STATUS_COLORS: Record<string, string> = {
  rascunho: 'bg-slate-100 text-slate-600',
  pendente:  'bg-amber-100 text-amber-700',
  aprovado:  'bg-sky-100 text-sky-700',
  pago:      'bg-emerald-100 text-emerald-700',
  rejeitado: 'bg-rose-100 text-rose-700',
  cancelado: 'bg-gray-100 text-gray-500',
};

const INSTALL_STATUS_COLORS: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700',
  pago:     'bg-emerald-100 text-emerald-700',
  atrasado: 'bg-rose-100 text-rose-700',
};

// ── Reject Dialog ─────────────────────────────────────────────────────────────

function RejectDialog({ onConfirm, onCancel }: { onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Rejeitar Pagamento</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">Informe o motivo da rejeição:</p>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Motivo obrigatório..." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button variant="destructive" onClick={() => reason.trim() && onConfirm(reason)} disabled={!reason.trim()}>
            Rejeitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Section / Row helpers ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-3">
      <h2 className="font-semibold text-foreground text-sm border-b border-border pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start text-sm gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value ?? '—'}</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PayableDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [payable, setPayable]   = useState<Payable | null>(null);
  const [loading, setLoading]   = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [showConfirmPay, setShowConfirmPay] = useState<string | null>(null); // installment id or 'all'
  const [comment, setComment]   = useState('');
  const [addingComment, setAddingComment] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setPayable(await getPayable(id));
    } catch {
      toast.error('Erro ao carregar conta');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function runAction(action: string, fn: () => Promise<void>, successMsg: string) {
    try {
      setActionLoading(action);
      await fn();
      toast.success(successMsg);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleComment() {
    if (!comment.trim() || !id) return;
    try {
      setAddingComment(true);
      await addComment(id, comment.trim());
      setComment('');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setAddingComment(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    try {
      await deletePayable(id);
      toast.success('Conta removida');
      navigate('/cp');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!payable) return null;

  const p          = payable;
  const isOverdue  = p.data_vencimento < new Date().toISOString().split('T')[0]
                     && !['pago','cancelado','rejeitado'].includes(p.status);
  const canSubmit  = p.status === 'rascunho' || p.status === 'rejeitado';
  const canApprove = p.status === 'pendente';
  const canPay     = p.status === 'aprovado';
  const canDelete  = ['rascunho','rejeitado','cancelado'].includes(p.status);
  const canEdit    = ['rascunho'].includes(p.status);

  const userRole = (user as unknown as { role?: string })?.role ?? '';
  const canApproveRole = ['Master','Admin','Gestor'].includes(userRole);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" className="gap-1 mt-0.5" onClick={() => navigate('/cp')}>
          <ArrowLeft className="h-4 w-4" /> Contas
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{p.descricao}</h1>
            <Badge className={`${STATUS_COLORS[p.status]} border-0`}>
              {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
            </Badge>
            {isOverdue && <Badge className="bg-rose-100 text-rose-700 border-0">VENCIDO</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{BRL.format(p.valor_total)} · Vencimento: {fmtDate(p.data_vencimento)}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/cp/${id}/edit`)}>
              <Edit2 className="h-4 w-4 mr-1" /> Editar
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="outline" className="text-rose-500 border-rose-200 hover:bg-rose-50" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Action buttons ── */}
      {(canSubmit || canApprove || canPay || p.status !== 'cancelado') && (
        <div className="flex flex-wrap gap-2">
          {canSubmit && (
            <Button
              className="gap-2"
              onClick={() => runAction('submit', () => submitPayable(p.id), 'Enviado para aprovação')}
              disabled={!!actionLoading}
            >
              {actionLoading === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar para Aprovação
            </Button>
          )}
          {canApprove && canApproveRole && (
            <>
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => runAction('approve', () => approvePayable(p.id), 'Pagamento aprovado')}
                disabled={!!actionLoading}
              >
                {actionLoading === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Aprovar
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50"
                onClick={() => setShowReject(true)}
                disabled={!!actionLoading}
              >
                <XCircle className="h-4 w-4" /> Rejeitar
              </Button>
            </>
          )}
          {canPay && (
            <Button
              className="gap-2 bg-violet-600 hover:bg-violet-700"
              onClick={() => setShowConfirmPay('all')}
              disabled={!!actionLoading}
            >
              <CreditCard className="h-4 w-4" /> Marcar como Pago
            </Button>
          )}
          {p.status !== 'cancelado' && !['pago','rejeitado'].includes(p.status) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => runAction('cancel', () => cancelPayable(p.id), 'Conta cancelada')}
              disabled={!!actionLoading}
            >
              Cancelar
            </Button>
          )}
        </div>
      )}

      {/* ── Info sections ── */}
      <div data-onboarding="cp-detalhe-info" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Section title="Dados do Pagamento">
          <Row label="Tipo"        value={p.tipo} />
          <Row label="Categoria"   value={p.categoria} />
          <Row label="Fornecedor"  value={p.supplier?.name} />
          <Row label="Valor"       value={<span className="font-bold text-foreground">{BRL.format(p.valor_total)}</span>} />
          <Row label="Parcelas"    value={p.numero_parcelas > 1 ? `${p.numero_parcelas}x` : 'À vista'} />
          <Row label="Emissão"     value={fmtDate(p.data_emissao)} />
          <Row label="Vencimento"  value={<span className={isOverdue ? 'text-rose-600' : ''}>{fmtDate(p.data_vencimento)}</span>} />
          {p.data_pagamento && <Row label="Pago em" value={fmtDate(p.data_pagamento)} />}
        </Section>

        <Section title="Aprovação">
          <Row label="Status"         value={<Badge className={`${STATUS_COLORS[p.status]} border-0`}>{p.status}</Badge>} />
          <Row label="Nível aprovação" value={p.approval_level} />
          {p.submitted_at && <Row label="Enviado em"   value={fmtDatetime(p.submitted_at)} />}
          {p.approved_at  && <Row label="Aprovado em"  value={fmtDatetime(p.approved_at)} />}
          {p.rejected_at  && <Row label="Rejeitado em" value={fmtDatetime(p.rejected_at)} />}
          {p.rejection_reason && (
            <Row label="Motivo rejeição" value={<span className="text-rose-600">{p.rejection_reason}</span>} />
          )}
        </Section>
      </div>

      {/* ── NF / Pagamento ── */}
      {(p.nota_fiscal || p.nf_numero || p.forma_pagamento) && (
        <Section title="Nota Fiscal e Pagamento">
          <div className="grid grid-cols-2 gap-3">
            {p.nf_numero && <Row label="NF Número" value={p.nf_numero} />}
            {p.forma_pagamento && <Row label="Forma" value={p.forma_pagamento.toUpperCase()} />}
            {p.pix_key && <Row label="PIX" value={p.pix_key} />}
            {p.banco_destino && <Row label="Banco" value={p.banco_destino} />}
            {p.nota_fiscal && (
              <a href={p.nota_fiscal} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-1 text-sm text-blue-600 hover:underline col-span-2">
                <ExternalLink className="h-3.5 w-3.5" /> Ver Nota Fiscal
              </a>
            )}
          </div>
        </Section>
      )}

      {/* ── Installments ── */}
      {(p.installments ?? []).length > 0 && (
        <Section title={`Parcelas (${p.numero_parcelas}x)`}>
          <div className="space-y-2">
            {(p.installments ?? []).map((inst: PayableInstallment) => {
              const instOverdue = inst.status !== 'pago' && inst.data_vencimento < new Date().toISOString().split('T')[0];
              return (
                <div key={inst.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground w-6">#{inst.numero}</span>
                    <span className="font-medium text-sm">{BRL.format(inst.valor)}</span>
                    <span className={`text-xs ${instOverdue ? 'text-rose-600 font-medium' : 'text-muted-foreground'}`}>
                      {fmtDate(inst.data_vencimento)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${INSTALL_STATUS_COLORS[inst.status]} border-0 text-[10px]`}>
                      {inst.status}
                    </Badge>
                    {inst.status !== 'pago' && canPay && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[11px] px-2 gap-1"
                        onClick={() => setShowConfirmPay(inst.id)}
                      >
                        <CreditCard className="h-3 w-3" /> Pagar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Comments ── */}
      <div data-onboarding="cp-detalhe-historico">
      <Section title="Comentários e Histórico">
        <div className="space-y-3">
          {(p.comments ?? []).map(c => (
            <div key={c.id} className={`rounded-lg px-3 py-2.5 text-sm ${c.is_system ? 'bg-muted/40 text-muted-foreground' : 'bg-card border border-border'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-xs">{c.is_system ? 'Sistema' : (c.user?.full_name ?? 'Usuário')}</span>
                <span className="text-[10px] text-muted-foreground">{fmtDatetime(c.created_at)}</span>
              </div>
              <p>{c.content}</p>
            </div>
          ))}
          {(p.comments ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <Input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Adicionar comentário..."
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleComment()}
          />
          <Button onClick={handleComment} disabled={!comment.trim() || addingComment} size="sm">
            {addingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
          </Button>
        </div>
      </Section>

      </div>

      {/* ── Reject dialog ── */}
      {showReject && (
        <RejectDialog
          onConfirm={reason => {
            setShowReject(false);
            runAction('reject', () => rejectPayable(p.id, reason), 'Pagamento rejeitado');
          }}
          onCancel={() => setShowReject(false)}
        />
      )}

      {/* ── Confirm pay dialog ── */}
      {showConfirmPay && (
        <Dialog open onOpenChange={() => setShowConfirmPay(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Confirmar Pagamento</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              {showConfirmPay === 'all'
                ? `Confirmar pagamento total de ${BRL.format(p.valor_total)}?`
                : `Confirmar pagamento desta parcela?`}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmPay(null)}>Cancelar</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  const instId = showConfirmPay === 'all' ? undefined : showConfirmPay;
                  setShowConfirmPay(null);
                  runAction('pay', () => payPayable(p.id, instId), 'Pagamento registrado');
                }}
              >
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
