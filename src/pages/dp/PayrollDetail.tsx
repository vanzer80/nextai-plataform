import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calculator, Lock, CreditCard, Download, Loader2,
  Search, ChevronDown, ChevronUp, Edit2, Save, X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Input }    from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

import {
  getPayrollPeriod, getPayrollEntries, calculatePeriod,
  closePeriod, markPeriodPaid, updatePayrollEntry, calculateEntry,
  getPayrollKPIs, type PayrollKPIs,
} from '@/src/services/payrollService';
import { gerarHolerite } from '@/src/utils/gerarHolerite';
import type { PayrollPeriod, PayrollEntry } from '@/src/types/payroll';
import { useTenant } from '@/src/contexts/TenantContext';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function fmtCompetencia(comp: string): string {
  const [y, m] = comp.split('-');
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

// ── Edit entry modal ──────────────────────────────────────────────────────────

interface EditEntryModalProps {
  entry: PayrollEntry;
  onClose: () => void;
  onSave: () => void;
}

function EditEntryModal({ entry, onClose, onSave }: EditEntryModalProps) {
  const [form, setForm] = useState({
    horas_extras_valor:  String(entry.horas_extras_valor  ?? '0'),
    adicional_noturno:   String(entry.adicional_noturno   ?? '0'),
    comissoes:           String(entry.comissoes           ?? '0'),
    outros_vencimentos:  String(entry.outros_vencimentos  ?? '0'),
    outros_descontos:    String(entry.outros_descontos    ?? '0'),
    irrf_dependentes:    String(entry.irrf_dependentes    ?? '0'),
    observacoes:         entry.observacoes ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    try {
      setSaving(true);
      await updatePayrollEntry(entry.id, {
        horas_extras_valor: parseFloat(form.horas_extras_valor) || 0,
        adicional_noturno:  parseFloat(form.adicional_noturno)  || 0,
        comissoes:          parseFloat(form.comissoes)          || 0,
        outros_vencimentos: parseFloat(form.outros_vencimentos) || 0,
        outros_descontos:   parseFloat(form.outros_descontos)   || 0,
        irrf_dependentes:   parseInt(form.irrf_dependentes)     || 0,
        observacoes:        form.observacoes || undefined,
      });
      await calculateEntry(entry.id);
      toast.success('Lançamento atualizado e recalculado');
      onSave();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof typeof form, label: string, prefix?: string) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
        <Input
          className={prefix ? 'pl-8' : ''}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          type={key === 'observacoes' ? 'text' : 'number'}
          step="0.01"
          min="0"
        />
      </div>
    </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Lançamento — {entry.employee?.full_name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          {field('horas_extras_valor', 'Horas Extras (R$)', 'R$')}
          {field('adicional_noturno', 'Adicional Noturno (R$)', 'R$')}
          {field('comissoes', 'Comissões (R$)', 'R$')}
          {field('outros_vencimentos', 'Outros Vencimentos (R$)', 'R$')}
          {field('outros_descontos', 'Outros Descontos (R$)', 'R$')}
          {field('irrf_dependentes', 'Dependentes IRRF', undefined)}
        </div>
        <div className="pt-1">
          {field('observacoes', 'Observações')}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar e Recalcular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PayrollDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenant } = useTenant();

  const [period, setPeriod]     = useState<PayrollPeriod | null>(null);
  const [entries, setEntries]   = useState<PayrollEntry[]>([]);
  const [kpis, setKpis]         = useState<PayrollKPIs | null>(null);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [sortField, setSortField] = useState<'name' | 'bruto' | 'liquido'>('name');
  const [sortAsc, setSortAsc]   = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<PayrollEntry | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [per, ents] = await Promise.all([
        getPayrollPeriod(id),
        getPayrollEntries(id),
      ]);
      setPeriod(per);
      setEntries(ents);
      // only fetch KPIs if period was already calculated
      if (per.status !== 'aberta') {
        setKpis(await getPayrollKPIs(id));
      }
    } catch (err) {
      toast.error('Erro ao carregar folha');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function runAction(action: string, fn: () => Promise<void>) {
    try {
      setActionLoading(action);
      await fn();
      toast.success(
        action === 'calculate' ? 'Folha calculada com sucesso' :
        action === 'close'     ? 'Folha fechada' :
        'Folha marcada como paga'
      );
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setActionLoading(null);
    }
  }

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortAsc(a => !a);
    else { setSortField(field); setSortAsc(true); }
  }

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field
      ? (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
      : null;

  const filtered = entries
    .filter(e => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (e.employee?.full_name ?? '').toLowerCase().includes(q) ||
             (e.employee?.matricula ?? '').toLowerCase().includes(q) ||
             (e.employee?.cpf ?? '').includes(q);
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name')    cmp = (a.employee?.full_name ?? '').localeCompare(b.employee?.full_name ?? '');
      if (sortField === 'bruto')   cmp = a.total_bruto - b.total_bruto;
      if (sortField === 'liquido') cmp = a.total_liquido - b.total_liquido;
      return sortAsc ? cmp : -cmp;
    });

  const canCalculate = period?.status === 'aberta';
  const canClose     = period?.status === 'calculada';
  const canMarkPaid  = period?.status === 'fechada';
  const isReadonly   = period?.status === 'paga' || period?.status === 'fechada';
  const companyName  = tenant?.name ?? 'Empresa';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!period) return null;

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/dp/payroll')}>
          <ArrowLeft className="h-4 w-4" /> Folhas
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">
            Competência — {fmtCompetencia(period.competencia)}
          </h1>
          <p className="text-xs text-muted-foreground">{entries.length} colaboradores</p>
        </div>
        <div className="flex gap-2">
          {canCalculate && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => runAction('calculate', () => calculatePeriod(period.id))}
              disabled={!!actionLoading}
            >
              {actionLoading === 'calculate'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Calculator className="h-4 w-4" />}
              Calcular Folha
            </Button>
          )}
          {canClose && (
            <Button
              variant="outline"
              className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => runAction('close', () => closePeriod(period.id))}
              disabled={!!actionLoading}
            >
              {actionLoading === 'close'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Lock className="h-4 w-4" />}
              Fechar Folha
            </Button>
          )}
          {canMarkPaid && (
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => runAction('pay', () => markPeriodPaid(period.id))}
              disabled={!!actionLoading}
            >
              {actionLoading === 'pay'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CreditCard className="h-4 w-4" />}
              Marcar como Pago
            </Button>
          )}
        </div>
      </div>

      {/* ── KPI cards ── */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Bruto',    value: BRL.format(kpis.total_bruto),     cls: 'text-foreground' },
            { label: 'Total Descontos', value: BRL.format(kpis.total_descontos), cls: 'text-rose-600' },
            { label: 'Total Líquido',  value: BRL.format(kpis.total_liquido),   cls: 'text-emerald-600' },
            { label: 'FGTS (empresa)', value: BRL.format(kpis.total_fgts),      cls: 'text-violet-600' },
            { label: 'Colaboradores',  value: String(kpis.headcount),           cls: 'text-foreground' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-xl font-bold mt-1 ${kpi.cls}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar colaborador, matrícula ou CPF..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── Table ── */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-3">
                <button className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground" onClick={() => toggleSort('name')}>
                  Colaborador <SortIcon field="name" />
                </button>
              </th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Salário Base</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">+ Venc.</th>
              <th className="text-right px-4 py-3">
                <button className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground ml-auto" onClick={() => toggleSort('bruto')}>
                  Total Bruto <SortIcon field="bruto" />
                </button>
              </th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground text-rose-600">INSS</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground text-rose-600">IRRF</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground text-rose-600">Outros</th>
              <th className="text-right px-4 py-3">
                <button className="flex items-center gap-1 font-medium text-emerald-600 hover:text-emerald-700 ml-auto" onClick={() => toggleSort('liquido')}>
                  Líquido <SortIcon field="liquido" />
                </button>
              </th>
              <th className="text-right px-4 py-3 font-medium text-violet-600">FGTS</th>
              <th className="w-20 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-10 text-muted-foreground">
                  {entries.length === 0 ? 'Nenhum colaborador nesta competência' : 'Nenhum resultado para a busca'}
                </td>
              </tr>
            ) : filtered.map(entry => {
              const extras = (entry.horas_extras_valor ?? 0) + (entry.adicional_noturno ?? 0)
                           + (entry.comissoes ?? 0) + (entry.outros_vencimentos ?? 0);
              const outros = (entry.vt_valor ?? 0) + (entry.plano_saude_desconto ?? 0)
                           + (entry.plano_odonto_desconto ?? 0) + (entry.outros_descontos ?? 0);
              return (
                <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">{entry.employee?.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.employee?.matricula} · {entry.employee?.position?.title ?? '—'}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{BRL.format(entry.salario_base)}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600">
                    {extras > 0 ? `+${BRL.format(extras)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{BRL.format(entry.total_bruto)}</td>
                  <td className="px-4 py-3 text-right font-mono text-rose-600">−{BRL.format(entry.inss_valor)}</td>
                  <td className="px-4 py-3 text-right font-mono text-rose-600">−{BRL.format(entry.irrf_valor)}</td>
                  <td className="px-4 py-3 text-right font-mono text-rose-600">
                    {outros > 0 ? `−${BRL.format(outros)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">{BRL.format(entry.total_liquido)}</td>
                  <td className="px-4 py-3 text-right font-mono text-violet-600">{BRL.format(entry.fgts_valor)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {!isReadonly && (
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={() => setEditEntry(entry)}
                        >
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                      <Button
                        size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => void gerarHolerite(period, entry, companyName, tenant?.logoUrl)}
                        title="Baixar holerite"
                      >
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Edit modal ── */}
      {editEntry && (
        <EditEntryModal
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSave={() => { setEditEntry(null); load(); }}
        />
      )}
    </div>
  );
}
