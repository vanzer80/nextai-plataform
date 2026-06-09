import type { UserRole } from '@/src/contexts/AuthContext';

export type WidgetId =
  | 'reports-kpi'
  | 'reimbursements-kpi'
  | 'productivity'
  | 'ticket-medio'
  | 'approval-rate'
  | 'return-rate'
  | 'sla-rate'
  | 'csat-avg'
  | 'reports-bar'
  | 'reimbursements-pie'
  | 'budget-burn'
  | 'cpq-kpi'
  | 'agenda-hoje'
  | 'estoque-critico'
  | 'hr-summary';

export type QueryKey =
  | 'repQuery'
  | 'rembQuery'
  | 'statsQuery'
  | 'barQry'
  | 'pieQry'
  | 'returnQry'
  | 'slaQry'
  | 'csatQry'
  | 'cpqQry'
  | 'agendaQry'
  | 'estoqueQry';

export type DashboardPeriod = '7d' | '30d' | '90d' | '12m';

export interface WidgetDefinition {
  id: WidgetId;
  label: string;
  description: string;
  /** Grid col-span: 1=KPI card, 2=chart, 4=full-width section */
  colSpan: 1 | 2 | 4;
  roles: UserRole[];
}

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    id: 'reports-kpi',
    label: 'OS Pendentes',
    description: 'Ordens de serviço aguardando revisão',
    colSpan: 1,
    roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
  },
  {
    id: 'sla-rate',
    label: 'Cumprimento de SLA',
    description: '% de OS abertas dentro do prazo',
    colSpan: 1,
    roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
  },
  {
    id: 'csat-avg',
    label: 'Satisfação (CSAT)',
    description: 'Média de avaliação dos clientes',
    colSpan: 1,
    roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
  },
  {
    id: 'return-rate',
    label: 'Taxa de Retorno',
    description: '% de OS devolvidas para revisão',
    colSpan: 1,
    roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
  },
  {
    id: 'reimbursements-kpi',
    label: 'Reembolsos',
    description: 'Valor total de reembolsos pendentes ou aprovados',
    colSpan: 1,
    roles: ['Tecnico', 'Administrativo', 'Financeiro', 'Comprador', 'Supervisor', 'Gestor', 'Admin', 'Master'],
  },
  {
    id: 'ticket-medio',
    label: 'Ticket Médio',
    description: 'Valor médio de reembolso aprovado no período',
    colSpan: 1,
    roles: ['Financeiro', 'Supervisor', 'Gestor', 'Admin', 'Master'],
  },
  {
    id: 'approval-rate',
    label: 'Taxa de Aprovação',
    description: '% de reembolsos aprovados no período',
    colSpan: 1,
    roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
  },
  {
    id: 'productivity',
    label: 'Produtividade',
    description: 'Índice de produtividade baseado em OS criadas',
    colSpan: 1,
    roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
  },
  {
    id: 'cpq-kpi',
    label: 'Orçamentos (CPQ)',
    description: 'Orçamentos criados, aprovados e pendentes no período',
    colSpan: 1,
    roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
  },
  {
    id: 'agenda-hoje',
    label: 'Agenda & Dispatch',
    description: 'OS agendadas hoje e alertas críticos',
    colSpan: 1,
    roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
  },
  {
    id: 'estoque-critico',
    label: 'Estoque Crítico',
    description: 'Itens abaixo do estoque mínimo',
    colSpan: 1,
    roles: ['Comprador', 'Supervisor', 'Gestor', 'Admin', 'Master'],
  },
  {
    id: 'budget-burn',
    label: 'Burn Rate de Budget',
    description: '% de consumo por categoria de budget',
    colSpan: 1,
    roles: ['Financeiro', 'Gestor', 'Admin', 'Master'],
  },
  {
    id: 'hr-summary',
    label: 'Gestão de Pessoas & Financeiro',
    description: 'Colaboradores, certificações, contas a pagar e folha',
    colSpan: 4,
    roles: ['Gestor', 'Admin', 'Master'],
  },
  {
    id: 'reports-bar',
    label: 'Gráfico de OS',
    description: 'OS criadas vs concluídas nos últimos 7 dias',
    colSpan: 2,
    roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
  },
  {
    id: 'reimbursements-pie',
    label: 'Gráfico de Reembolsos',
    description: 'Distribuição de reembolsos por categoria',
    colSpan: 2,
    roles: ['Administrativo', 'Financeiro', 'Comprador', 'Supervisor', 'Gestor', 'Admin', 'Master'],
  },
];

/** Map para lookup O(1) de colSpan por id */
export const WIDGET_COL_SPAN = new Map<WidgetId, 1 | 2 | 4>(
  WIDGET_DEFINITIONS.map(w => [w.id, w.colSpan])
);

export const TEAM_REPORTS_ROLES: UserRole[] = ['Supervisor', 'Gestor', 'Admin', 'Master'];
export const TEAM_FINANCE_ROLES: UserRole[] = ['Supervisor', 'Gestor', 'Admin', 'Master', 'Financeiro'];

export const WIDGET_QUERY_DEPS: Record<WidgetId, QueryKey[]> = {
  'reports-kpi':        ['repQuery'],
  'reimbursements-kpi': ['rembQuery'],
  'productivity':       ['barQry'],
  'ticket-medio':       ['statsQuery'],
  'approval-rate':      ['statsQuery'],
  'return-rate':        ['returnQry'],
  'sla-rate':           ['slaQry'],
  'csat-avg':           ['csatQry'],
  'reports-bar':        ['barQry'],
  'reimbursements-pie': ['pieQry'],
  'budget-burn':        [],
  'cpq-kpi':            ['cpqQry'],
  'agenda-hoje':        ['agendaQry'],
  'estoque-critico':    ['estoqueQry'],
  'hr-summary':         [],
};

export const PERIOD_DAYS: Record<DashboardPeriod, number> = {
  '7d': 7, '30d': 30, '90d': 90, '12m': 365,
};

export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  '7d': '7 dias', '30d': '30 dias', '90d': '90 dias', '12m': '12 meses',
};

/** Lista de widgets que o role pode ver (para o customizer) */
export function getEligibleWidgets(role: UserRole): WidgetDefinition[] {
  return WIDGET_DEFINITIONS.filter(w => w.roles.includes(role));
}
