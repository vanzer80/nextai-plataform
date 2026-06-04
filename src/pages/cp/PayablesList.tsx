import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banknote, Plus, Search, Loader2, AlertTriangle, TrendingDown,
  Clock, CheckCircle2, XCircle, ChevronRight, Filter,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Input }    from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import {
  getPayables, getPayableKPIs, type PayableFilters,
} from '@/src/services/payableService';
import type { Payable, PayableKPIs } from '@/src/types/payable';

// ── helpers ───────────────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_CONFIG: Record<string, { label: string; className: string; Icon: React.ElementType }> = {
  rascunho:  { label: 'Rascunho',  className: 'bg-slate-100 text-slate-600',    Icon: Clock },
  pendente:  { label: 'Pendente',  className: 'bg-amber-100 text-amber-700',    Icon: AlertTriangle },
  aprovado:  { label: 'Aprovado',  className: 'bg-sky-100 text-sky-700',        Icon: CheckCircle2 },
  pago:      { label: 'Pago',      className: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle2 },
  rejeitado: { label: 'Rejeitado', className: 'bg-rose-100 text-rose-700',      Icon: XCircle },
  cancelado: { label: 'Cancelado', className: 'bg-gray-100 text-gray-500',      Icon: XCircle },
};

const TIPO_LABELS: Record<string, string> = {
  fornecedor: 'Fornecedor', reembolso: 'Reembolso', material: 'Material',
  servico: 'Serviço', imposto: 'Imposto', aluguel: 'Aluguel',
  salario: 'Salário', folha_pagamento: 'Folha', outro: 'Outro',
};

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function isOverdue(payable: Payable): boolean {
  const today = new Date().toISOString().split('T')[0];
  return payable.data_vencimento < today
    && !['pago','cancelado','rejeitado'].includes(payable.status);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PayablesList() {
  const navigate = useNavigate();
  const [payables, setPayables] = useState<Payable[]>([]);
  const [kpis, setKpis]         = useState<PayableKPIs | null>(null);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTipo, setFilterTipo]     = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const filters: PayableFilters = {};
      if (filterStatus) filters.status = filterStatus;
      if (filterTipo)   filters.tipo   = filterTipo;
      const [data, k] = await Promise.all([
        getPayables(filters),
        getPayableKPIs(),
      ]);
      setPayables(data);
      setKpis(k);
    } catch (err) {
      toast.error('Erro ao carregar contas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterTipo]);

  useEffect(() => { load(); }, [load]);

  const filtered = payables.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.descricao.toLowerCase().includes(q)
      || (p.supplier?.name ?? '').toLowerCase().includes(q)
      || (p.nota_fiscal ?? '').toLowerCase().includes(q);
  });

  const overdue = filtered.filter(isOverdue);
  const today   = new Date().toISOString().split('T')[0];
  const dueSoon = filtered.filter(p =>
    !['pago','cancelado','rejeitado'].includes(p.status)
    && p.data_vencimento >= today
    && p.data_vencimento <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );

  return (
    <div className="p-6 space-y-6">
      {/* ── Title row ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-xl">
            <Banknote className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Contas a Pagar</h1>
            <p className="text-xs text-muted-foreground">Gestão de pagamentos e aprovações</p>
          </div>
        </div>
        <Button data-onboarding="cp-nova" onClick={() => navigate('/cp/new')} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Conta
        </Button>
      </div>

      {/* ── Alert banners ── */}
      {overdue.length > 0 && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
          <p className="text-sm text-rose-700">
            <strong>{overdue.length} conta{overdue.length > 1 ? 's' : ''}</strong> vencida{overdue.length > 1 ? 's' : ''} — total{' '}
            <strong>{BRL.format(overdue.reduce((s, p) => s + p.valor_total, 0))}</strong>
          </p>
        </div>
      )}
      {dueSoon.length > 0 && overdue.length === 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Clock className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">
            <strong>{dueSoon.length} conta{dueSoon.length > 1 ? 's' : ''}</strong> vence{dueSoon.length > 1 ? 'm' : ''} nos próximos 7 dias
          </p>
        </div>
      )}

      {/* ── KPI cards ── */}
      {kpis && (
        <div data-onboarding="cp-kpis" className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'A Vencer',      value: BRL.format(kpis.a_vencer),       cls: 'text-foreground' },
            { label: 'Vencido',       value: BRL.format(kpis.vencido),        cls: 'text-rose-600' },
            { label: 'Pago no Mês',   value: BRL.format(kpis.pago_mes),       cls: 'text-emerald-600' },
            { label: 'Aprovado',      value: BRL.format(kpis.total_aprovado), cls: 'text-sky-600' },
            { label: 'Aguardando Aprovação', value: String(kpis.count_pendente), cls: kpis.count_pendente > 0 ? 'text-amber-600' : 'text-foreground' },
          ].map(k => (
            <div key={k.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`text-xl font-bold mt-1 ${k.cls}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div data-onboarding="cp-filtros" className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar descrição, fornecedor, NF..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos tipos</SelectItem>
            {Object.entries(TIPO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
          <TrendingDown className="h-8 w-8" />
          <p className="text-sm">Nenhuma conta encontrada</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/cp/new')}>
            Cadastrar conta
          </Button>
        </div>
      ) : (
        <div data-onboarding="cp-tabela" className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Descrição</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fornecedor</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const cfg    = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.rascunho;
                const venc   = isOverdue(p);
                const parcelas = p.numero_parcelas > 1 ? ` (${p.numero_parcelas}x)` : '';
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => navigate(`/cp/${p.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground truncate max-w-[200px]">{p.descricao}</p>
                      {p.nf_numero && <p className="text-xs text-muted-foreground">NF {p.nf_numero}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {TIPO_LABELS[p.tipo] ?? p.tipo}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[140px]">
                      {p.supplier?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {BRL.format(p.valor_total)}{parcelas}
                    </td>
                    <td className="px-4 py-3">
                      <span className={venc ? 'text-rose-600 font-semibold' : ''}>
                        {fmtDate(p.data_vencimento)}
                      </span>
                      {venc && <span className="ml-1 text-[10px] text-rose-500">VENCIDO</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${cfg.className} border-0 gap-1`}>
                        <cfg.Icon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
