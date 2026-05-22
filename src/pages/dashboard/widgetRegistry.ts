import type { UserRole } from '@/src/contexts/AuthContext';

export type WidgetId =
  | 'reports-kpi'
  | 'reimbursements-kpi'
  | 'productivity'
  | 'ticket-medio'
  | 'approval-rate'
  | 'return-rate'
  | 'reports-bar'
  | 'reimbursements-pie';

export type QueryKey = 'repQuery' | 'rembQuery' | 'statsQuery' | 'barQry' | 'pieQry' | 'returnQry';

export const TEAM_REPORTS_ROLES: UserRole[] = ['Supervisor', 'Gestor', 'Admin', 'Master'];
export const TEAM_FINANCE_ROLES: UserRole[] = ['Supervisor', 'Gestor', 'Admin', 'Master', 'Financeiro'];

// Which DB queries each widget depends on (no query runs for hidden widgets)
export const WIDGET_QUERY_DEPS: Record<WidgetId, QueryKey[]> = {
  'reports-kpi':        ['repQuery'],
  'reimbursements-kpi': ['rembQuery'],
  'productivity':       ['barQry'],
  'ticket-medio':       ['statsQuery'],
  'approval-rate':      ['statsQuery'],
  'return-rate':        ['returnQry'],
  'reports-bar':        ['barQry'],
  'reimbursements-pie': ['pieQry'],
};
