import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Plus, Trash2, Loader2, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button }   from '@/src/components/ui/button';
import { Badge }    from '@/src/components/ui/badge';
import { Input }    from '@/src/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/src/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/src/components/ui/dialog';

import {
  getTimeRecords, upsertTimeRecord, deleteTimeRecord,
} from '@/src/services/payrollService';
import { getEmployees } from '@/src/services/employeeService';
import type { TimeRecord } from '@/src/types/payroll';
import type { Employee } from '@/src/types/employee';

// ── helpers ───────────────────────────────────────────────────────────────────

const RECORD_LABELS: Record<TimeRecord['record_type'], string> = {
  entrada:        'Entrada',
  saida_almoco:   'Saída Almoço',
  retorno_almoco: 'Retorno Almoço',
  saida:          'Saída',
};

const RECORD_COLORS: Record<TimeRecord['record_type'], string> = {
  entrada:        'bg-emerald-100 text-emerald-700',
  saida_almoco:   'bg-amber-100 text-amber-700',
  retorno_almoco: 'bg-sky-100 text-sky-700',
  saida:          'bg-rose-100 text-rose-700',
};

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function getDaysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function computeWorkedHours(records: TimeRecord[]): number {
  const byType: Record<TimeRecord['record_type'], string> = {} as never;
  records.forEach(r => { byType[r.record_type] = r.record_time; });

  const toMins = (t?: string) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const entrada = toMins(byType.entrada);
  const saidaAlm = toMins(byType.saida_almoco);
  const retornoAlm = toMins(byType.retorno_almoco);
  const saida = toMins(byType.saida);

  if (entrada === null || saida === null) return 0;

  let total = saida - entrada;
  if (saidaAlm !== null && retornoAlm !== null) {
    total -= retornoAlm - saidaAlm;
  }
  return Math.max(0, total / 60);
}

// ── Add Record Form ───────────────────────────────────────────────────────────

interface AddRecordFormProps {
  employeeId: string;
  month: string;
  onSave: () => void;
  onCancel: () => void;
}

function AddRecordForm({ employeeId, month, onSave, onCancel }: AddRecordFormProps) {
  const [form, setForm] = useState({
    record_date: '',
    record_type: 'entrada' as TimeRecord['record_type'],
    record_time: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.record_date || !form.record_time) {
      toast.error('Data e hora são obrigatórios');
      return;
    }
    try {
      setSaving(true);
      await upsertTimeRecord({ employee_id: employeeId, ...form, source: 'manual' });
      toast.success('Registro adicionado');
      onSave();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const daysInMonth = getDaysInMonth(month);
  const [y, m] = month.split('-');
  const minDate = `${y}-${m}-01`;
  const maxDate = `${y}-${m}-${String(daysInMonth).padStart(2, '0')}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Data *</label>
          <Input
            type="date"
            min={minDate} max={maxDate}
            value={form.record_date}
            onChange={e => setForm(f => ({ ...f, record_date: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo *</label>
          <Select value={form.record_type} onValueChange={v => setForm(f => ({ ...f, record_type: v as TimeRecord['record_type'] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(RECORD_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Hora *</label>
          <Input
            type="time"
            value={form.record_time}
            onChange={e => setForm(f => ({ ...f, record_time: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Observação</label>
          <Input
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Opcional..."
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TimeRecordsPage() {
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<string>('');
  const [records, setRecords]       = useState<TimeRecord[]>([]);
  const [loading, setLoading]       = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    getEmployees({ status: 'ativo' }).then(setEmployees).catch(console.error);
  }, []);

  const loadRecords = useCallback(async () => {
    if (!selectedEmp) return;
    try {
      setLoading(true);
      setRecords(await getTimeRecords(selectedEmp, month));
    } catch (err) {
      toast.error('Erro ao carregar registros');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedEmp, month]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  function navigateMonth(delta: number) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  async function handleDelete(id: string) {
    try {
      setDeletingId(id);
      await deleteTimeRecord(id);
      toast.success('Registro removido');
      loadRecords();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setDeletingId(null);
    }
  }

  // Group records by date
  const byDate = records.reduce<Record<string, TimeRecord[]>>((acc, r) => {
    if (!acc[r.record_date]) acc[r.record_date] = [];
    acc[r.record_date].push(r);
    return acc;
  }, {});

  const dates = Object.keys(byDate).sort();

  const totalHours = dates.reduce((sum, d) => sum + computeWorkedHours(byDate[d]), 0);
  const totalDays  = dates.length;

  const selectedEmployee = employees.find(e => e.id === selectedEmp);

  return (
    <div className="p-6 space-y-6">
      {/* ── Title row ── */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 rounded-xl">
          <Clock className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Ponto / Controle de Horas</h1>
          <p className="text-xs text-muted-foreground">Registros de jornada por colaborador</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div data-onboarding="dp-ponto-filtros" className="flex flex-wrap gap-3 items-center">
        <Select value={selectedEmp} onValueChange={setSelectedEmp}>
          <SelectTrigger className="w-72" aria-label="Selecionar colaborador">
            <SelectValue placeholder="Selecione o colaborador..." />
          </SelectTrigger>
          <SelectContent>
            {employees.map(e => (
              <SelectItem key={e.id} value={e.id}>
                {e.full_name} {e.matricula ? `(${e.matricula})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => navigateMonth(-1)} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[160px] text-center font-medium text-sm">{formatMonth(month)}</div>
          <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => navigateMonth(1)} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {selectedEmp && (
          <Button onClick={() => setShowAdd(true)} className="gap-2 ml-auto">
            <Plus className="h-4 w-4" /> Adicionar Registro
          </Button>
        )}
      </div>

      {!selectedEmp ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm">Selecione um colaborador para visualizar os registros</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ── Summary ── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Dias com Registro</p>
              <p className="text-2xl font-bold mt-1">{totalDays}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Horas Trabalhadas</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600">{totalHours.toFixed(1)}h</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Colaborador</p>
              <p className="text-base font-bold mt-1 truncate">{selectedEmployee?.full_name ?? '—'}</p>
            </div>
          </div>

          {/* ── Daily records ── */}
          {dates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground border border-dashed border-border rounded-xl">
              <p className="text-sm">Nenhum registro em {formatMonth(month)}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dates.map(date => {
                const dayRecords = byDate[date];
                const hours = computeWorkedHours(dayRecords);
                const [y, m, d] = date.split('-');
                const weekday = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' });
                const isComplete = dayRecords.length >= 4;

                return (
                  <div key={date} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{d}/{m}/{y}</span>
                        <span className="text-xs text-muted-foreground capitalize">{weekday}</span>
                        {!isComplete && (
                          <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Incompleto</Badge>
                        )}
                      </div>
                      {hours > 0 && (
                        <span className="text-sm font-medium text-emerald-600">{hours.toFixed(1)}h trabalhadas</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dayRecords.map(r => (
                        <div
                          key={r.id}
                          className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-3 py-1.5 group"
                        >
                          <Badge className={`${RECORD_COLORS[r.record_type]} border-0 text-[10px]`}>
                            {RECORD_LABELS[r.record_type]}
                          </Badge>
                          <span className="font-mono text-sm font-medium">{r.record_time.substring(0, 5)}</span>
                          {r.source === 'manual' && (
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-rose-500"
                              onClick={() => handleDelete(r.id)}
                              disabled={deletingId === r.id}
                              aria-label="Remover registro de ponto"
                            >
                              {deletingId === r.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Trash2 className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Add record dialog ── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Registro de Ponto</DialogTitle>
          </DialogHeader>
          <AddRecordForm
            employeeId={selectedEmp}
            month={month}
            onSave={() => { setShowAdd(false); loadRecords(); }}
            onCancel={() => setShowAdd(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
