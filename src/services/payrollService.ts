import { supabase } from '@/src/lib/supabase';
import type {
  PayrollPeriod, PayrollEntry, TimeRecord, VacationSchedule,
  CreatePayrollPeriodDTO, CreateVacationDTO,
} from '@/src/types/payroll';

// ── helpers ───────────────────────────────────────────────────────────────────

async function getTeamId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const { data } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .single();
  if (!data) throw new Error('Usuário sem equipe');
  return data.team_id;
}

// ── Payroll Periods ───────────────────────────────────────────────────────────

export async function getPayrollPeriods(): Promise<PayrollPeriod[]> {
  const teamId = await getTeamId();
  const { data, error } = await supabase
    .from('payroll_periods')
    .select('*, entry_count:payroll_entries(count)')
    .eq('team_id', teamId)
    .order('competencia', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(d => ({
    ...d,
    entry_count: (d.entry_count as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

export async function getPayrollPeriod(id: string): Promise<PayrollPeriod> {
  const { data, error } = await supabase
    .from('payroll_periods')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createPayrollPeriod(dto: CreatePayrollPeriodDTO): Promise<PayrollPeriod> {
  const teamId = await getTeamId();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('payroll_periods')
    .insert({ team_id: teamId, competencia: dto.competencia, status: 'aberta', created_by: user?.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function calculatePeriod(periodId: string): Promise<void> {
  const { error } = await supabase.rpc('calculate_payroll_period', { p_period_id: periodId });
  if (error) throw error;
}

export async function closePeriod(periodId: string): Promise<void> {
  const { error } = await supabase
    .from('payroll_periods')
    .update({ status: 'fechada', closed_at: new Date().toISOString() })
    .eq('id', periodId);
  if (error) throw error;
}

export async function markPeriodPaid(periodId: string): Promise<void> {
  const { error } = await supabase
    .from('payroll_periods')
    .update({ status: 'paga', paid_at: new Date().toISOString() })
    .eq('id', periodId);
  if (error) throw error;
}

// ── Payroll Entries ───────────────────────────────────────────────────────────

export async function getPayrollEntries(periodId: string): Promise<PayrollEntry[]> {
  const { data, error } = await supabase
    .from('payroll_entries')
    .select(`
      *,
      employee:employees(
        id, full_name, matricula, cpf, banco, agencia, conta, tipo_conta, pis_pasep,
        department:departments(name),
        position:positions(title)
      )
    `)
    .eq('period_id', periodId)
    .order('employee(full_name)');
  if (error) throw error;
  return data ?? [];
}

export async function getPayrollEntry(id: string): Promise<PayrollEntry> {
  const { data, error } = await supabase
    .from('payroll_entries')
    .select(`
      *,
      employee:employees(
        id, full_name, matricula, cpf, banco, agencia, conta, tipo_conta, pis_pasep,
        department:departments(name),
        position:positions(title)
      )
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function updatePayrollEntry(
  id: string,
  patch: Partial<Pick<PayrollEntry, 'horas_extras_valor' | 'adicional_noturno' | 'comissoes' | 'outros_vencimentos' | 'outros_descontos' | 'horas_trabalhadas' | 'faltas' | 'observacoes' | 'irrf_dependentes'>>
): Promise<void> {
  const { error } = await supabase
    .from('payroll_entries')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function calculateEntry(entryId: string): Promise<void> {
  const { error } = await supabase.rpc('calculate_payroll_entry', { p_entry_id: entryId });
  if (error) throw error;
}

// ── Time Records ──────────────────────────────────────────────────────────────

export async function getTimeRecords(employeeId: string, month: string): Promise<TimeRecord[]> {
  // month = 'YYYY-MM'
  const startDate = `${month}-01`;
  const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0)
    .toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('time_records')
    .select('*, employee:employees(full_name, matricula)')
    .eq('employee_id', employeeId)
    .gte('record_date', startDate)
    .lte('record_date', endDate)
    .order('record_date')
    .order('record_time');
  if (error) throw error;
  return data ?? [];
}

export async function getTimeRecordsByPeriod(periodId: string): Promise<TimeRecord[]> {
  const period = await getPayrollPeriod(periodId);
  const teamId = period.team_id;
  const startDate = `${period.competencia}-01`;
  const endDate = new Date(
    parseInt(period.competencia.split('-')[0]),
    parseInt(period.competencia.split('-')[1]),
    0
  ).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('time_records')
    .select('*, employee:employees(full_name, matricula)')
    .eq('team_id', teamId)
    .gte('record_date', startDate)
    .lte('record_date', endDate)
    .order('employee_id')
    .order('record_date')
    .order('record_time');
  if (error) throw error;
  return data ?? [];
}

export async function upsertTimeRecord(record: {
  employee_id: string;
  record_date: string;
  record_type: TimeRecord['record_type'];
  record_time: string;
  source?: TimeRecord['source'];
  notes?: string;
}): Promise<TimeRecord> {
  const teamId = await getTeamId();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('time_records')
    .upsert({
      ...record,
      team_id: teamId,
      source: record.source ?? 'manual',
      created_by: user?.id,
    }, { onConflict: 'employee_id,record_date,record_type' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTimeRecord(id: string): Promise<void> {
  const { error } = await supabase.from('time_records').delete().eq('id', id);
  if (error) throw error;
}

// ── Vacation Schedules ────────────────────────────────────────────────────────

export async function getVacationSchedules(filters?: {
  employee_id?: string;
  status?: string;
  year?: number;
}): Promise<VacationSchedule[]> {
  const teamId = await getTeamId();
  let q = supabase
    .from('vacation_schedules')
    .select('*, employee:employees(full_name, matricula, department:departments(name))')
    .eq('team_id', teamId);

  if (filters?.employee_id) q = q.eq('employee_id', filters.employee_id);
  if (filters?.status) q = q.eq('status', filters.status);
  if (filters?.year) {
    q = q.gte('vacation_start', `${filters.year}-01-01`)
         .lte('vacation_start', `${filters.year}-12-31`);
  }

  const { data, error } = await q.order('vacation_start', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createVacationSchedule(dto: CreateVacationDTO): Promise<VacationSchedule> {
  const teamId = await getTeamId();
  const vacStart = new Date(dto.vacation_start);
  const vacEnd = new Date(dto.vacation_end);
  const dias_gozados = Math.round((vacEnd.getTime() - vacStart.getTime()) / 86_400_000) + 1;

  const { data, error } = await supabase
    .from('vacation_schedules')
    .insert({
      ...dto,
      team_id: teamId,
      dias_gozados,
      dias_vendidos: dto.dias_vendidos ?? 0,
      abono_pecuniario: dto.abono_pecuniario ?? false,
      status: 'agendada',
    })
    .select('*, employee:employees(full_name, matricula, department:departments(name))')
    .single();
  if (error) throw error;
  return data;
}

export async function approveVacation(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('vacation_schedules')
    .update({ status: 'aprovada', approved_by: user?.id, approved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function updateVacationStatus(id: string, status: VacationSchedule['status']): Promise<void> {
  const { error } = await supabase
    .from('vacation_schedules')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

// ── Payroll KPIs ──────────────────────────────────────────────────────────────

export interface PayrollKPIs {
  total_bruto: number;
  total_descontos: number;
  total_liquido: number;
  total_fgts: number;
  headcount: number;
}

export async function getPayrollKPIs(periodId: string): Promise<PayrollKPIs> {
  const { data, error } = await supabase
    .from('payroll_entries')
    .select('total_bruto, total_descontos, total_liquido, fgts_valor')
    .eq('period_id', periodId);
  if (error) throw error;

  const entries = data ?? [];
  return {
    total_bruto:     entries.reduce((s, e) => s + (e.total_bruto ?? 0), 0),
    total_descontos: entries.reduce((s, e) => s + (e.total_descontos ?? 0), 0),
    total_liquido:   entries.reduce((s, e) => s + (e.total_liquido ?? 0), 0),
    total_fgts:      entries.reduce((s, e) => s + (e.fgts_valor ?? 0), 0),
    headcount:       entries.length,
  };
}
