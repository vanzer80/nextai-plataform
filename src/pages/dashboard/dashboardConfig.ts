import type { UserRole } from '@/src/contexts/AuthContext';

// Declaração explícita e auditável: qual perfil vê quais widgets.
// Personalização por usuário futura deve operar apenas dentro deste conjunto — nunca ampliá-lo.
export const dashboardConfigByRole: Record<UserRole, string[]> = {
  // Operacional de campo — vê OS + orçamentos + reembolsos + compras
  Tecnico:        ['reports-kpi', 'reimbursements-kpi', 'productivity', 'approval-rate', 'reports-bar', 'reimbursements-pie'],
  // Apoio interno — vê reembolsos + compras; sem KPIs de OS (não acessa o módulo)
  Administrativo: ['reimbursements-kpi', 'reimbursements-pie'],
  // Financeiro — foco em custo e fluxo; ticket médio é KPI de receita relevante
  Financeiro:     ['reimbursements-kpi', 'ticket-medio', 'reimbursements-pie'],
  // Comprador — foco em suprimentos; reembolsos como proxy de gastos operacionais
  Comprador:      ['reimbursements-kpi', 'reimbursements-pie'],
  // Liderança operacional — visão completa incluindo taxa de retorno e ticket médio
  Supervisor:     ['reports-kpi', 'reimbursements-kpi', 'productivity', 'ticket-medio', 'approval-rate', 'return-rate', 'sla-rate', 'csat-avg', 'reports-bar', 'reimbursements-pie'],
  Gestor:         ['reports-kpi', 'reimbursements-kpi', 'productivity', 'ticket-medio', 'approval-rate', 'return-rate', 'sla-rate', 'csat-avg', 'reports-bar', 'reimbursements-pie'],
  Admin:          ['reports-kpi', 'reimbursements-kpi', 'productivity', 'ticket-medio', 'approval-rate', 'return-rate', 'sla-rate', 'csat-avg', 'reports-bar', 'reimbursements-pie'],
  Master:         ['reports-kpi', 'reimbursements-kpi', 'productivity', 'ticket-medio', 'approval-rate', 'return-rate', 'sla-rate', 'csat-avg', 'reports-bar', 'reimbursements-pie'],
  Cliente:        [],
};

// Retorna lista vazia para role desconhecida — fallback seguro (não renderiza nada)
export function getWidgetIds(role: UserRole | undefined): string[] {
  if (!role) return [];
  return dashboardConfigByRole[role] ?? [];
}
