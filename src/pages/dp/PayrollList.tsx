import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Landmark, Plus, ChevronRight, Loader2, Calculator,
  CheckCircle2, Clock, CreditCard, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input }    from '@/components/ui/input';

import {
  getPayrollPeriods, createPayrollPeriod, calculatePeriod,
} from '@/src/services/payrollService';
import type { PayrollPeriod } from '@/src/types/payroll';

// ── helpers ───────────────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function fmtCompetencia(comp: string): string {
  const [y, m] = comp.split('-');
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; Icon: React.ElementType }> = {
  aberta:    { label: 'Aberta',    className: 'bg-sky-100 text-sky-700',    Icon: Clock },
  calculada: { label: 'Calculada', className: 'bg-amber-100 text-amber-700', Icon: Calculator },
  fechada:   { label: 'Fechada',   className: 'bg-violet-100 text-violet-700', Icon: CheckCircle2 },
  paga:      { label: 'Paga',      className: 'bg-emerald-100 text-emerald-700', Icon: CreditCard },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PayrollList() {
  const navigate = useNavigate();
  const [periods, setPeriods]     = useState<PayrollPeriod[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [newComp, setNewComp]     = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [creating, setCreating]   = useState(false);
  const [calcId, setCalcId]       = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setPeriods(await getPayrollPeriods());
    } catch (err) {
      toast.error('Erro ao carregar folhas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!newComp) return;
    try {
      setCreating(true);
      const period = await createPayrollPeriod({ competencia: newComp });
      toast.success(`Folha ${fmtCompetencia(newComp)} criada`);
      setShowNew(false);
      navigate(`/dp/payroll/${period.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar folha';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleCalculate(e: React.MouseEvent, period: PayrollPeriod) {
    e.stopPropagation();
    if (period.status !== 'aberta') return;
    try {
      setCalcId(period.id);
      await calculatePeriod(period.id);
      toast.success('Folha calculada com sucesso');
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao calcular';
      toast.error(msg);
    } finally {
      setCalcId(null);
    }
  }

  // ── Aggregates ───────────────────────────────────────────────────────────────
  const ytdBruto   = periods.filter(p => p.status !== 'aberta').reduce((s, p) => s + (p.total_bruto ?? 0), 0);
  const ytdLiquido = periods.filter(p => p.status !== 'aberta').reduce((s, p) => s + (p.total_liquido ?? 0), 0);
  const ytdFgts    = periods.filter(p => p.status !== 'aberta').reduce((s, p) => s + (p.total_fgts ?? 0), 0);
  const pendentes  = periods.filter(p => p.status === 'aberta' || p.status === 'calculada').length;

  return (
    <div className="p-6 space-y-6">
      {/* ── Title row ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-xl">
            <Landmark className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Folha de Pagamento</h1>
            <p className="text-xs text-muted-foreground">Gestão de competências e holerites</p>
          </div>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Competência
        </Button>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Bruto (ano)',  value: BRL.format(ytdBruto),   cls: 'text-foreground' },
          { label: 'Total Líquido (ano)', value: BRL.format(ytdLiquido), cls: 'text-emerald-600' },
          { label: 'FGTS Acumulado',     value: BRL.format(ytdFgts),    cls: 'text-violet-600' },
          { label: 'Competências Abertas', value: String(pendentes),    cls: pendentes > 0 ? 'text-amber-600' : 'text-foreground' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={`text-xl font-bold mt-1 ${kpi.cls}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ── Periods list ── */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : periods.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm">Nenhuma competência cadastrada</p>
          <Button variant="outline" size="sm" onClick={() => setShowNew(true)}>
            Criar primeira competência
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Competência</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Colaboradores</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Bruto</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Líquido</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">FGTS</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {periods.map(p => {
                const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.aberta;
                const isCalcLoading = calcId === p.id;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/dp/payroll/${p.id}`)}
                  >
                    <td className="px-4 py-3 font-semibold">{fmtCompetencia(p.competencia)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge className={`${cfg.className} border-0 gap-1.5`}>
                          <cfg.Icon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                        {p.status === 'aberta' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2 gap-1"
                            onClick={e => handleCalculate(e, p)}
                            disabled={isCalcLoading}
                          >
                            {isCalcLoading
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Calculator className="h-3 w-3" />
                            }
                            Calcular
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{p.entry_count ?? 0}</td>
                    <td className="px-4 py-3 text-right font-mono">{BRL.format(p.total_bruto ?? 0)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600">{BRL.format(p.total_liquido ?? 0)}</td>
                    <td className="px-4 py-3 text-right font-mono text-violet-600">{BRL.format(p.total_fgts ?? 0)}</td>
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

      {/* ── New Period Dialog ── */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Competência</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Selecione o mês/ano da competência. Os colaboradores ativos serão incluídos automaticamente.
            </p>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Mês / Ano</label>
              <Input
                type="month"
                value={newComp}
                onChange={e => setNewComp(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !newComp}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar Folha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
