import type { UserRole } from '@/src/contexts/AuthContext';

// Declaração explícita e auditável: qual perfil vê quais widgets.
// Personalização por usuário futura deve operar apenas dentro deste conjunto — nunca ampliá-lo.
export const dashboardConfigByRole: Record<UserRole, string[]> = {
  Tecnico:        ['reports-kpi', 'reimbursements-kpi', 'productivity', 'approval-rate', 'reports-bar', 'reimbursements-pie'],
  Administrativo: ['reports-kpi', 'reimbursements-kpi', 'productivity', 'approval-rate', 'reports-bar', 'reimbursements-pie'],
  Comprador:      ['reports-kpi', 'reimbursements-kpi', 'productivity', 'approval-rate', 'reports-bar', 'reimbursements-pie'],
  Financeiro:     ['reimbursements-kpi', 'ticket-medio', 'approval-rate', 'reimbursements-pie'],
  Supervisor:     ['reports-kpi', 'reimbursements-kpi', 'productivity', 'ticket-medio', 'approval-rate', 'return-rate', 'reports-bar', 'reimbursements-pie'],
  Gestor:         ['reports-kpi', 'reimbursements-kpi', 'productivity', 'ticket-medio', 'approval-rate', 'return-rate', 'reports-bar', 'reimbursements-pie'],
  Admin:          ['reports-kpi', 'reimbursements-kpi', 'productivity', 'ticket-medio', 'approval-rate', 'return-rate', 'reports-bar', 'reimbursements-pie'],
  Master:         ['reports-kpi', 'reimbursements-kpi', 'productivity', 'ticket-medio', 'approval-rate', 'return-rate', 'reports-bar', 'reimbursements-pie'],
};

// Retorna lista vazia para role desconhecida — fallback seguro (não renderiza nada)
export function getWidgetIds(role: UserRole | undefined): string[] {
  if (!role) return [];
  return dashboardConfigByRole[role] ?? [];
}
