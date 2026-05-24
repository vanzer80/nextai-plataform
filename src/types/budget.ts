export type BudgetPeriodType = 'monthly' | 'quarterly' | 'annual';

export const PERIOD_LABELS: Record<BudgetPeriodType, string> = {
  monthly:   'Mensal',
  quarterly: 'Trimestral',
  annual:    'Anual',
};

export interface Budget {
  id: string;
  team_id: string;
  category: string;
  period_type: BudgetPeriodType;
  amount_limit: number;
  start_date: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface BudgetBurnRow {
  category: string;
  period_type: BudgetPeriodType;
  limit_amount: number;
  used_amount: number;
  pct_used: number;
}

export interface BudgetCheckResult {
  status: 'ok' | 'warning' | 'exceeded' | 'no-budget';
  used_amount: number;
  limit_amount: number;
  pct_used: number;
}
