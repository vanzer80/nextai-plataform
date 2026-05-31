import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, FileDown, Pencil, Loader2, AlertCircle, CheckCircle2, XCircle, SendHorizonal, Trash2, PenLine, ShieldCheck, Link2, Calendar, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { buscarOrcamento, atualizarStatus, excluirOrcamento } from '@/src/services/orcamentoService';
import { gerarPdfOrcamento } from '@/src/utils/gerarPdfOrcamento';
import { OrcamentoStatusBadge } from './components/OrcamentoStatusBadge';
import OrcamentoSignDialog from './components/OrcamentoSignDialog';
import OrcamentoVersionHistory from './components/OrcamentoVersionHistory';
import type { OrcamentoComItens } from '@/src/types/orcamento';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

export default function OrcamentoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant } = useTenant();

  const [orcamento, setOrcamento] = useState<OrcamentoComItens | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialogs
  const [showReject, setShowReject] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showSign, setShowSign] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const refresh = () => setTick(t => t + 1);

  const isManager = user?.role && ['Gestor', 'Admin', 'Master'].includes(user.role);
  const isOwner = orcamento?.technician_id === user?.id;
  const canEdit = (isOwner || !!isManager) && orcamento?.status === 'rascunho';

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    buscarOrcamento(id)
      .then(data => setOrcamento(data))
      .catch(() => toast.error('Erro ao carregar orçamento.'))
      .finally(() => setLoading(false));
  }, [id, tick]);

  // Realtime
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`realtime_orcamento_detail_${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orcamentos', filter: `id=eq.${id}` }, () => {
        refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const handleEnviar = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await atualizarStatus(id, 'enviado');
      toast.success('Orçamento enviado para aprovação.');
      refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAprovar = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await atualizarStatus(id, 'aprovado');
      toast.success('Orçamento aprovado.');
      refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aprovar.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejeitar = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await atualizarStatus(id, 'rejeitado', rejectReason);
      toast.success('Orçamento rejeitado.');
      setShowReject(false);
      setRejectReason('');
      refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao rejeitar.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExcluir = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await excluirOrcamento(id);
      toast.success('Orçamento excluído.');
      navigate('/orcamentos');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir.');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!orcamento) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-slate-500">
        <AlertCircle className="h-10 w-10 mb-4 text-slate-400" />
        <p className="text-sm font-medium">Orçamento não encontrado.</p>
        <Link to="/orcamentos" className="mt-4 text-sm text-blue-600 hover:underline">Voltar à lista</Link>
      </div>
    );
  }

  const subtotal = orcamento.orcamento_itens.reduce(
    (acc, i) => acc + i.quantidade * i.valor_unitario, 0,
  );
  const desconto = subtotal * (orcamento.desconto_pct / 100);
  const total = subtotal - desconto;
  const titulo = orcamento.titulo || `Orçamento #${orcamento.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className="max-w-3xl mx-auto pb-8 flex flex-col gap-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/orcamentos" className="text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{titulo}</h1>
              <OrcamentoStatusBadge status={orcamento.status} />
              <span className="text-xs font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                v{orcamento.version}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Criado em {formatDate(orcamento.created_at)}</p>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void gerarPdfOrcamento(orcamento, tenant?.name ?? 'Portal', {
              tenantLogoUrl:    tenant?.logoUrl,
              signatureDataUrl: orcamento.signature_data_url,
              signerName:       orcamento.signer_name,
              signerEmail:      orcamento.signer_email,
              signedAt:         orcamento.signed_at,
            })}
          >
            <FileDown className="h-4 w-4" /> PDF
          </Button>

          {canEdit && (
            <Link to={`/orcamentos/${orcamento.id}/editar`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Informações */}
      <Card>
        <CardContent className="pt-4 flex flex-col gap-4 text-sm">
          {/* Cliente */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Cliente</p>
              <p className="font-semibold text-slate-900 mt-0.5">{orcamento.clients?.name ?? '—'}</p>
              {orcamento.clients?.cnpj && (
                <p className="text-xs text-slate-500 font-mono mt-0.5">{orcamento.clients.cnpj}</p>
              )}
            </div>
            {(orcamento.clients?.logradouro || orcamento.clients?.cidade) && (
              <div className="col-span-2">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Endereço</p>
                {orcamento.clients.logradouro && (
                  <p className="text-slate-700 mt-0.5">
                    {[orcamento.clients.logradouro, orcamento.clients.numero].filter(Boolean).join(', ')}
                  </p>
                )}
                {(orcamento.clients.cidade || orcamento.clients.estado) && (
                  <p className="text-slate-600 text-xs">
                    {[orcamento.clients.bairro, orcamento.clients.cidade, orcamento.clients.estado].filter(Boolean).join(' — ')}
                  </p>
                )}
              </div>
            )}
            {(orcamento.clients?.contato_nome || orcamento.clients?.contato_telefone || orcamento.clients?.contato_email) && (
              <div className="col-span-2">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Contato</p>
                {orcamento.clients.contato_nome && <p className="text-slate-700 mt-0.5">{orcamento.clients.contato_nome}</p>}
                <p className="text-slate-600 text-xs">
                  {[orcamento.clients.contato_telefone, orcamento.clients.contato_email].filter(Boolean).join(' · ')}
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Técnico</p>
              <p className="font-semibold text-slate-900 mt-0.5">{orcamento.users?.full_name ?? '—'}</p>
            </div>
            {orcamento.validade && (
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Válido até</p>
                <p className="font-semibold text-slate-900 mt-0.5">{formatDate(orcamento.validade)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* OS Vinculada */}
      {orcamento.report_id && (
        <Card className="border-blue-100 bg-blue-50/30">
          <CardHeader className="pb-3 border-b border-blue-100">
            <CardTitle className="text-base flex items-center gap-2 text-blue-900">
              <Link2 className="h-4 w-4 text-blue-600" />
              Ordem de Serviço Vinculada
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-sm font-bold bg-white border border-blue-200 text-slate-800 px-2.5 py-1 rounded-md self-start">
                {orcamento.service_reports?.os_number ?? 'OS sem número'}
              </span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                {orcamento.service_reports?.service_type && (
                  <span className="flex items-center gap-1">
                    <Wrench className="h-3 w-3 text-slate-400" />
                    {orcamento.service_reports.service_type}
                  </span>
                )}
                {orcamento.service_reports?.service_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    {formatDate(orcamento.service_reports.service_date)}
                  </span>
                )}
                {orcamento.service_reports?.status && (() => {
                  const s = orcamento.service_reports!.status!;
                  const label: Record<string, string> = { approved: 'Aprovada', returned: 'Devolvida', pending_review: 'Ag. Revisão', draft: 'Rascunho', rejected: 'Reprovada' };
                  const color: Record<string, string> = { approved: 'bg-emerald-100 text-emerald-800', returned: 'bg-orange-100 text-orange-800', pending_review: 'bg-amber-100 text-amber-800', draft: 'bg-slate-100 text-slate-700', rejected: 'bg-rose-100 text-rose-800' };
                  return (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${color[s] ?? 'bg-slate-100 text-slate-600'}`}>
                      {label[s] ?? s}
                    </span>
                  );
                })()}
              </div>
            </div>
            <Link
              to={`/reports/${orcamento.report_id}`}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium shrink-0 transition-colors"
            >
              Ver OS →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Itens */}
      <Card>
        <CardHeader><CardTitle className="text-base">Itens</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left py-2 pr-4 font-medium">Descrição</th>
                  <th className="text-right py-2 pr-4 font-medium">Qtd</th>
                  <th className="text-center py-2 pr-4 font-medium">Un.</th>
                  <th className="text-right py-2 pr-4 font-medium">Valor Unit.</th>
                  <th className="text-right py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {orcamento.orcamento_itens.map(item => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4 text-slate-800">{item.descricao}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-600">{NUM.format(item.quantidade)}</td>
                    <td className="py-2.5 pr-4 text-center text-slate-500">{item.unidade}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-600">{BRL.format(item.valor_unitario)}</td>
                    <td className="py-2.5 text-right font-medium text-slate-800">
                      {BRL.format(item.quantidade * item.valor_unitario)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-3 text-right text-xs text-slate-500">Subtotal</td>
                  <td className="pt-3 text-right text-slate-700">{BRL.format(subtotal)}</td>
                </tr>
                {orcamento.desconto_pct > 0 && (
                  <tr>
                    <td colSpan={4} className="text-right text-xs text-slate-500">
                      Desconto ({orcamento.desconto_pct}%)
                    </td>
                    <td className="text-right text-slate-700">- {BRL.format(desconto)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={4} className="pt-2 border-t border-slate-200 text-right font-bold text-slate-800">
                    Total
                  </td>
                  <td className="pt-2 border-t border-slate-200 text-right font-bold text-blue-700 text-base">
                    {BRL.format(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Observações */}
      {orcamento.observacoes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{orcamento.observacoes}</p>
          </CardContent>
        </Card>
      )}

      {/* Razão de rejeição */}
      {orcamento.status === 'rejeitado' && orcamento.rejection_reason && (
        <Card className="border-rose-200 bg-rose-50">
          <CardHeader><CardTitle className="text-base text-rose-800">Motivo da rejeição</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-rose-700 whitespace-pre-wrap">{orcamento.rejection_reason}</p>
          </CardContent>
        </Card>
      )}

      {/* Assinatura eletrônica */}
      {orcamento.signed_at ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader>
            <CardTitle className="text-base text-emerald-800 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Assinado eletronicamente
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {orcamento.signature_data_url && (
              <div className="flex justify-center">
                <img
                  src={orcamento.signature_data_url}
                  alt="Assinatura do cliente"
                  className="max-h-24 max-w-xs border border-emerald-200 rounded-lg bg-white p-2"
                />
              </div>
            )}
            <div className="text-sm text-emerald-800 space-y-0.5">
              {orcamento.signer_name && (
                <p><span className="font-medium">Signatário:</span> {orcamento.signer_name}</p>
              )}
              {orcamento.signer_email && (
                <p><span className="font-medium">E-mail:</span> {orcamento.signer_email}</p>
              )}
              <p className="text-xs text-emerald-600 mt-1">
                Assinado em {new Date(orcamento.signed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                {' · '}Assinatura eletrônica simples · Lei 14.063/2020
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Histórico de versões */}
      {id && <OrcamentoVersionHistory orcamentoId={id} />}

      {/* Ações de fluxo */}
      <div className="flex flex-wrap gap-2 justify-end">
        {/* Técnico dono, rascunho → enviar */}
        {isOwner && orcamento.status === 'rascunho' && (
          <Button onClick={handleEnviar} disabled={actionLoading} className="gap-2">
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            Enviar para aprovação
          </Button>
        )}

        {/* Gestor/Admin/Master, enviado → aprovar ou rejeitar */}
        {isManager && orcamento.status === 'enviado' && (
          <>
            <Button
              onClick={handleAprovar}
              disabled={actionLoading}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Aprovar
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowReject(true)}
              disabled={actionLoading}
              className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50"
            >
              <XCircle className="h-4 w-4" /> Rejeitar
            </Button>
          </>
        )}

        {/* Coletar assinatura — aprovado e ainda não assinado */}
        {orcamento.status === 'aprovado' && !orcamento.signed_at && (isOwner || isManager) && (
          <Button
            onClick={() => setShowSign(true)}
            disabled={actionLoading}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <PenLine className="h-4 w-4" /> Coletar assinatura
          </Button>
        )}

        {/* Excluir — apenas rascunho */}
        {orcamento.status === 'rascunho' && (isOwner || isManager) && (
          <Button
            variant="outline"
            onClick={() => setShowDelete(true)}
            disabled={actionLoading}
            className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </Button>
        )}
      </div>

      {/* Dialog: Rejeitar */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar orçamento</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="reject-reason">Motivo (opcional)</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              placeholder="Descreva o motivo da rejeição..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>Cancelar</Button>
            <Button
              onClick={handleRejeitar}
              disabled={actionLoading}
              className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Excluir */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir orçamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            Esta ação é irreversível. O orçamento e todos os seus itens serão permanentemente removidos.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancelar</Button>
            <Button
              onClick={handleExcluir}
              disabled={actionLoading}
              className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Assinatura */}
      {id && (
        <OrcamentoSignDialog
          orcamentoId={id}
          open={showSign}
          onClose={() => setShowSign(false)}
          onSigned={refresh}
        />
      )}
    </div>
  );
}
