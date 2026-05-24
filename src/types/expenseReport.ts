export type ExpenseReportStatus = 'rascunho' | 'submetido' | 'aprovado' | 'pago' | 'rejeitado';

export interface ExpenseReport {
  id: string;
  team_id?: string;
  user_id: string;
  title: string;
  period_start: string | null;
  period_end: string | null;
  status: ExpenseReportStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  users?: { full_name: string } | null;
  reimbursements?: { id: string; description: string; amount: number; status: string }[];
}

export const EXPENSE_STATUS_LABEL: Record<ExpenseReportStatus, string> = {
  rascunho:  'Rascunho',
  submetido: 'Submetido',
  aprovado:  'Aprovado',
  pago:      'Pago',
  rejeitado: 'Rejeitado',
};

export const EXPENSE_STATUS_COLOR: Record<ExpenseReportStatus, string> = {
  rascunho:  'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
  submetido: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  aprovado:  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  pago:      'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  rejeitado: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
};
