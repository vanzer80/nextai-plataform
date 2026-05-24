import { supabase } from '@/src/lib/supabase';
import type { Budget, BudgetBurnRow, BudgetCheckResult } from '@/src/types/budget';

export async function listBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .order('category');
  if (error) throw new Error(error.message);
  return (data ?? []) as Budget[];
}

export async function createBudget(
  payload: Pick<Budget, 'category' | 'period_type' | 'amount_limit' | 'start_date'>,
  userId: string,
): Promise<Budget> {
  const { data, error } = await supabase
    .from('budgets')
    .insert({ ...payload, created_by: userId })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Budget;
}

export async function updateBudget(
  id: string,
  payload: Partial<Pick<Budget, 'category' | 'period_type' | 'amount_limit' | 'start_date' | 'is_active'>>,
): Promise<void> {
  const { error } = await supabase.from('budgets').update(payload).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function checkBudget(
  category: string,
  amount: number,
  date?: string,
): Promise<BudgetCheckResult | null> {
  const { data, error } = await supabase.rpc('check_budget', {
    p_category: category,
    p_amount:   amount,
    p_date:     date ?? new Date().toISOString().slice(0, 10),
  });
  if (error || !data || data.length === 0) return null;
  return data[0] as BudgetCheckResult;
}

export async function getBudgetBurn(): Promise<BudgetBurnRow[]> {
  const { data, error } = await supabase.rpc('get_budget_burn');
  if (error) throw new Error(error.message);
  return (data ?? []) as BudgetBurnRow[];
}
