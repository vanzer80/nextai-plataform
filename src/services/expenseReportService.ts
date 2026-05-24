import { supabase } from '@/src/lib/supabase';
import type { ExpenseReport } from '@/src/types/expenseReport';

const ER_SELECT = `
  *, users(full_name),
  reimbursements(id, description, amount, status)
`;

export async function getExpenseReports(): Promise<ExpenseReport[]> {
  const { data, error } = await supabase
    .from('expense_reports')
    .select(ER_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createExpenseReport(dto: {
  title: string;
  period_start?: string | null;
  period_end?: string | null;
}): Promise<ExpenseReport> {
  const { data, error } = await supabase
    .from('expense_reports')
    .insert(dto)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateExpenseReport(
  id: string,
  dto: { title?: string; period_start?: string | null; period_end?: string | null },
): Promise<void> {
  const { error } = await supabase.from('expense_reports').update(dto).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteExpenseReport(id: string): Promise<void> {
  const { error } = await supabase.from('expense_reports').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function linkReimbursement(
  reimbursementId: string,
  reportId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('reimbursements')
    .update({ expense_report_id: reportId })
    .eq('id', reimbursementId);
  if (error) throw new Error(error.message);
}

export async function submitExpenseReport(reportId: string): Promise<void> {
  const { data, error } = await supabase.rpc('submit_expense_report', { p_report_id: reportId });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Erro ao submeter relatório.');
}

export async function reviewExpenseReport(
  reportId: string,
  action: 'aprovar' | 'rejeitar' | 'pagar',
  rejectionReason?: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('review_expense_report', {
    p_report_id: reportId,
    p_action: action,
    p_rejection_reason: rejectionReason ?? null,
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Erro ao processar.');
}
