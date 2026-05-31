import type { UserRole } from '@/src/contexts/AuthContext';
import type { WidgetId } from './widgetRegistry';

/** Configuração padrão por role — baseline quando usuário não personalizou. */
export const dashboardDefaultByRole: Record<UserRole, WidgetId[]> = {
  Tecnico:        ['reports-kpi', 'approval-rate', 'productivity', 'reimbursements-kpi', 'reports-bar', 'reimbursements-pie'],
  Administrativo: ['reimbursements-kpi', 'reimbursements-pie'],
  Financeiro:     ['reimbursements-kpi', 'ticket-medio', 'budget-burn', 'reimbursements-pie'],
  Comprador:      ['estoque-critico', 'reimbursements-kpi', 'reimbursements-pie'],
  Supervisor:     ['reports-kpi', 'sla-rate', 'csat-avg', 'return-rate', 'cpq-kpi', 'agenda-hoje', 'approval-rate', 'reimbursements-kpi', 'reports-bar', 'reimbursements-pie'],
  Gestor:         ['reports-kpi', 'sla-rate', 'csat-avg', 'return-rate', 'cpq-kpi', 'agenda-hoje', 'estoque-critico', 'budget-burn', 'ticket-medio', 'reimbursements-kpi', 'hr-summary', 'reports-bar', 'reimbursements-pie'],
  Admin:          ['reports-kpi', 'sla-rate', 'csat-avg', 'return-rate', 'cpq-kpi', 'agenda-hoje', 'estoque-critico', 'budget-burn', 'ticket-medio', 'reimbursements-kpi', 'hr-summary', 'reports-bar', 'reimbursements-pie'],
  Master:         ['reports-kpi', 'sla-rate', 'csat-avg', 'return-rate', 'cpq-kpi', 'agenda-hoje', 'estoque-critico', 'budget-burn', 'ticket-medio', 'reimbursements-kpi', 'hr-summary', 'reports-bar', 'reimbursements-pie'],
  Cliente:        [],
};

export function getWidgetIds(role: UserRole | undefined): WidgetId[] {
  if (!role) return [];
  return dashboardDefaultByRole[role] ?? [];
}
