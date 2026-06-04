import React, { useState, useEffect, useCallback } from 'react';
import { Umbrella, Plus, CheckCircle2, XCircle, Loader2, Search, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Input }    from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import {
  getVacationSchedules, createVacationSchedule,
  approveVacation, updateVacationStatus,
} from '@/src/services/payrollService';
import { getEmployees } from '@/src/services/employeeService';
import type { VacationSchedule, CreateVacationDTO } from '@/src/types/payroll';
import type { Employee } from '@/src/types/employee';

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  agendada:  { label: 'Agendada',   className: 'bg-sky-100 text-sky-700' },
  aprovada:  { label: 'Aprovada',   className: 'bg-emerald-100 text-emerald-700' },
  em_gozo:   { label: 'Em Gozo',    className: 'bg-violet-100 text-violet-700' },
  concluida: { label: 'Concluída',  className: 'bg-slate-100 text-slate-600' },
  cancelada: { label: 'Cancelada',  className: 'bg-rose-100 text-rose-700' },
};

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function diffDays(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1;
}

// ── Schedule Form ─────────────────────────────────────────────────────────────

interface ScheduleFormProps {
  employees: Employee[];
  onSave: (dto: CreateVacationDTO) => Promise<void>;
  onCancel: () => void;
}

function ScheduleForm({ employees, onSave, onCancel }: ScheduleFormProps) {
  const [form, setForm] = useState<Partial<CreateVacationDTO>>({
    dias_direito: 30,
    dias_vendidos: 0,
    abono_pecuniario: false,
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof CreateVacationDTO>(k: K, v: CreateVacationDTO[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employee_id || !form.acquisition_start || !form.acquisition_end
        || !form.vacation_start || !form.vacation_end) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    try {
      setSaving(true);
      await onSave(form as CreateVacationDTO);
    } finally {
      setSaving(false);
    }
  }

  const duration = form.vacation_start && form.vacation_end
    ? diffDays(form.vacation_start, form.vacation_end)
    : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Colaborador *</label>
        <Select onValueChange={v => set('employee_id', v as string)}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {employees.map(e => (
              <SelectItem key={e.id} value={e.id}>
                {e.full_name} {e.matricula ? `(${e.matricula})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Início Aquisição *</label>
          <Input type="date" value={form.acquisition_start ?? ''} onChange={e => set('acquisition_start', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Fim Aquisição *</label>
          <Input type="date" value={form.acquisition_end ?? ''} onChange={e => set('acquisition_end', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Início Férias *</label>
          <Input type="date" value={form.vacation_start ?? ''} onChange={e => set('vacation_start', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Fim Férias *</label>
          <Input type="date" value={form.vacation_end ?? ''} onChange={e => set('vacation_end', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Dias de Direito</label>
          <Input
            type="number" min={1} max={30}
            value={form.dias_direito ?? 30}
            onChange={e => set('dias_direito', parseInt(e.target.value))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Dias Vendidos (1/3)</label>
          <Input
            type="number" min={0} max={10}
            value={form.dias_vendidos ?? 0}
            onChange={e => set('dias_vendidos', parseInt(e.target.value))}
          />
        </div>
      </div>

      {duration > 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm text-sky-700">
          Período: <strong>{duration} dias</strong>
          {(form.dias_vendidos ?? 0) > 0 && ` · Abono pecuniário: ${form.dias_vendidos} dias`}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="abono"
          checked={form.abono_pecuniario ?? false}
          onChange={e => set('abono_pecuniario', e.target.checked)}
          className="rounded"
        />
        <label htmlFor="abono" className="text-sm text-muted-foreground">Abono Pecuniário (venda de 1/3)</label>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
        <Input
          value={form.notes ?? ''}
          onChange={e => set('notes', e.target.value)}
          placeholder="Opcional..."
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Agendar Férias
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VacationSchedulePage() {
  const [vacations, setVacations]   = useState<VacationSchedule[]>([]);
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [actionId, setActionId]     = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [vacs, emps] = await Promise.all([
        getVacationSchedules(),
        getEmployees({ status: 'ativo' }),
      ]);
      setVacations(vacs);
      setEmployees(emps);
    } catch (err) {
      toast.error('Erro ao carregar férias');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(dto: CreateVacationDTO) {
    await createVacationSchedule(dto);
    toast.success('Férias agendadas com sucesso');
    setShowForm(false);
    load();
  }

  async function handleApprove(id: string) {
    try {
      setActionId(id);
      await approveVacation(id);
      toast.success('Férias aprovadas');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setActionId(null);
    }
  }

  async function handleStatusChange(id: string, status: VacationSchedule['status']) {
    try {
      setActionId(id);
      await updateVacationStatus(id, status);
      toast.success(`Status atualizado para ${STATUS_CONFIG[status]?.label}`);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setActionId(null);
    }
  }

  const filtered = vacations.filter(v => {
    const q = search.toLowerCase();
    const nameMatch = (v.employee?.full_name ?? '').toLowerCase().includes(q);
    const statusMatch = !filterStatus || v.status === filterStatus;
    return nameMatch && statusMatch;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const emGozo    = vacations.filter(v => v.status === 'em_gozo').length;
  const agendadas = vacations.filter(v => v.status === 'agendada').length;
  const vencendo  = vacations.filter(v => {
    if (!v.acquisition_end) return false;
    const daysLeft = diffDays(today, v.acquisition_end);
    return daysLeft >= 0 && daysLeft <= 30 && v.status !== 'concluida' && v.status !== 'cancelada';
  }).length;

  return (
    <div className="p-6 space-y-6">
      {/* ── Title row ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-100 rounded-xl">
            <Umbrella className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Férias & Ausências</h1>
            <p className="text-xs text-muted-foreground">Controle de períodos aquisitivos e gozo</p>
          </div>
        </div>
        <Button data-onboarding="dp-ferias-novo" onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Agendar Férias
        </Button>
      </div>

      {/* ── KPI cards ── */}
      <div data-onboarding="dp-ferias-kpis" className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Em Gozo Hoje</p>
          <p className="text-2xl font-bold mt-1 text-violet-600">{emGozo}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Agendadas (pendentes)</p>
          <p className="text-2xl font-bold mt-1 text-sky-600">{agendadas}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Períodos Vencendo (30d)</p>
          <p className={`text-2xl font-bold mt-1 ${vencendo > 0 ? 'text-amber-600' : 'text-foreground'}`}>{vencendo}</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar colaborador..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todos status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
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
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm">Nenhuma férias encontrada</p>
        </div>
      ) : (
        <div data-onboarding="dp-ferias-tabela" className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Colaborador</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Período Aquisitivo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Gozo</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Dias</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="w-36 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => {
                const gozoDays = v.vacation_start && v.vacation_end
                  ? diffDays(v.vacation_start, v.vacation_end)
                  : 0;
                const cfg = STATUS_CONFIG[v.status];
                const isLoading = actionId === v.id;
                const daysToExpiry = v.acquisition_end ? diffDays(today, v.acquisition_end) : null;

                return (
                  <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium">{v.employee?.full_name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{v.employee?.department?.name ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p>{fmtDate(v.acquisition_start)} – {fmtDate(v.acquisition_end)}</p>
                      {daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30 && v.status !== 'concluida' && (
                        <p className="text-xs text-amber-600 font-medium">Vence em {daysToExpiry} dias!</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {v.vacation_start ? `${fmtDate(v.vacation_start)} – ${fmtDate(v.vacation_end)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">
                      {gozoDays > 0 ? gozoDays : '—'}
                      {v.dias_vendidos > 0 && (
                        <span className="block text-[10px] text-muted-foreground">+{v.dias_vendidos}d vendidos</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${cfg.className} border-0`}>{cfg.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {v.status === 'agendada' && (
                          <Button
                            size="sm" variant="outline"
                            className="h-7 gap-1 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleApprove(v.id)}
                            disabled={isLoading}
                          >
                            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Aprovar
                          </Button>
                        )}
                        {v.status === 'aprovada' && (
                          <Button
                            size="sm" variant="outline"
                            className="h-7 gap-1 text-[11px]"
                            onClick={() => handleStatusChange(v.id, 'em_gozo')}
                            disabled={isLoading}
                          >
                            Iniciar Gozo
                          </Button>
                        )}
                        {v.status === 'em_gozo' && (
                          <Button
                            size="sm" variant="outline"
                            className="h-7 gap-1 text-[11px]"
                            onClick={() => handleStatusChange(v.id, 'concluida')}
                            disabled={isLoading}
                          >
                            Concluir
                          </Button>
                        )}
                        {(v.status === 'agendada' || v.status === 'aprovada') && (
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50"
                            onClick={() => handleStatusChange(v.id, 'cancelada')}
                            disabled={isLoading}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Form dialog ── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agendar Férias</DialogTitle>
          </DialogHeader>
          <ScheduleForm
            employees={employees}
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
