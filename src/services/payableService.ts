import { supabase } from '@/src/lib/supabase';
import type {
  Payable, CreatePayableDTO, PayableComment,
  AgingBucket, CashflowWeek, PayableKPIs,
} from '@/src/types/payable';

// ── helpers ───────────────────────────────────────────────────────────────────

async function getTeamId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const { data } = await supabase
    .from('users')
    .select('team_id')
    .eq('id', user.id)
    .single();
  if (!data?.team_id) throw new Error('Usuário sem equipe');
  return data.team_id;
}

const PAYABLE_SELECT = `
  *,
  supplier:suppliers(id, name, cnpj),
  installments:payable_installments(*),
  comments:payable_comments(*, user:users(full_name))
` as const;

// ── CRUD ──────────────────────────────────────────────────────────────────────

export interface PayableFilters {
  status?: string;
  tipo?: string;
  supplier_id?: string;
  vencimento_ate?: string;
  search?: string;
  overdue_only?: boolean;
}

export async function getPayables(filters: PayableFilters = {}): Promise<Payable[]> {
  let q = supabase
    .from('payables')
    .select(PAYABLE_SELECT);

  if (filters.status)      q = q.eq('status', filters.status);
  if (filters.tipo)        q = q.eq('tipo', filters.tipo);
  if (filters.supplier_id) q = q.eq('supplier_id', filters.supplier_id);
  if (filters.vencimento_ate) q = q.lte('data_vencimento', filters.vencimento_ate);
  if (filters.overdue_only) {
    const today = new Date().toISOString().split('T')[0];
    q = q.lt('data_vencimento', today).not('status', 'in', '("pago","cancelado","rejeitado")');
  }
  if (filters.search) {
    q = q.ilike('descricao', `%${filters.search}%`);
  }

  const { data, error } = await q.order('data_vencimento', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getPayable(id: string): Promise<Payable> {
  const { data, error } = await supabase
    .from('payables')
    .select(PAYABLE_SELECT)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createPayable(dto: CreatePayableDTO): Promise<Payable> {
  const teamId = await getTeamId();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('payables')
    .insert({
      ...dto,
      team_id: teamId,
      moeda: 'BRL',
      status: 'rascunho',
      data_emissao: dto.data_emissao ?? new Date().toISOString().split('T')[0],
      numero_parcelas: dto.numero_parcelas ?? 1,
      submitted_by: user?.id,
    })
    .select(PAYABLE_SELECT)
    .single();
  if (error) throw error;
  return data;
}

export async function updatePayable(id: string, patch: Partial<CreatePayableDTO>): Promise<void> {
  const { error } = await supabase
    .from('payables')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function deletePayable(id: string): Promise<void> {
  const { error } = await supabase.from('payables').delete().eq('id', id);
  if (error) throw error;
}

// ── Workflow RPCs ─────────────────────────────────────────────────────────────

export async function submitPayable(id: string): Promise<void> {
  const { error } = await supabase.rpc('submit_payable', { p_payable_id: id });
  if (error) throw error;
}

export async function approvePayable(id: string, notes?: string): Promise<void> {
  const { error } = await supabase.rpc('approve_payable', {
    p_payable_id: id,
    p_notes: notes ?? null,
  });
  if (error) throw error;
}

export async function rejectPayable(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('reject_payable', {
    p_payable_id: id,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function payPayable(id: string, installmentId?: string): Promise<void> {
  const { error } = await supabase.rpc('pay_payable', {
    p_payable_id: id,
    p_installment_id: installmentId ?? null,
  });
  if (error) throw error;
}

export async function cancelPayable(id: string): Promise<void> {
  const { error } = await supabase
    .from('payables')
    .update({ status: 'cancelado' })
    .eq('id', id);
  if (error) throw error;
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function addComment(payableId: string, content: string): Promise<PayableComment> {
  const teamId = await getTeamId();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('payable_comments')
    .insert({
      payable_id: payableId,
      team_id: teamId,
      user_id: user?.id,
      content,
      is_system: false,
    })
    .select('*, user:users(full_name)')
    .single();
  if (error) throw error;
  return data;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function getAgingReport(): Promise<AgingBucket[]> {
  const teamId = await getTeamId();
  const { data, error } = await supabase.rpc('get_aging_report', { p_team_id: teamId });
  if (error) throw error;
  return data ?? [];
}

export async function getCashflowProjection(days = 90): Promise<CashflowWeek[]> {
  const teamId = await getTeamId();
  const { data, error } = await supabase.rpc('get_cashflow_projection', {
    p_team_id: teamId,
    p_days: days,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getPayableKPIs(): Promise<PayableKPIs> {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.substring(0, 7) + '-01';

  const { data, error } = await supabase
    .from('payables')
    .select('status, valor_total, data_vencimento');
  if (error) throw error;

  const rows = data ?? [];
  return {
    a_vencer:       rows.filter(r => r.status !== 'pago' && r.status !== 'cancelado' && r.status !== 'rejeitado' && r.data_vencimento >= today).reduce((s, r) => s + r.valor_total, 0),
    vencido:        rows.filter(r => r.status !== 'pago' && r.status !== 'cancelado' && r.status !== 'rejeitado' && r.data_vencimento < today).reduce((s, r) => s + r.valor_total, 0),
    pago_mes:       rows.filter(r => r.status === 'pago' && (r.data_vencimento ?? '') >= firstOfMonth).reduce((s, r) => s + r.valor_total, 0),
    total_aprovado: rows.filter(r => r.status === 'aprovado').reduce((s, r) => s + r.valor_total, 0),
    count_pendente: rows.filter(r => r.status === 'pendente').length,
  };
}
