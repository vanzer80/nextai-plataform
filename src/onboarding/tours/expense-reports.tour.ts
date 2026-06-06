import type { TourModule } from './index';

export const expenseReportsTour: TourModule = {
  id: 'expense-reports',
  description: 'Relatórios de Despesas: agrupamento de reembolsos por viagem ou período para aprovação em lote',
  steps: [
    {
      element: '[data-onboarding="exp-header"]',
      route: '/reimbursements/expense-reports',
      popover: {
        title: 'Relatórios de Despesas',
        description: 'Agrupe múltiplos reembolsos em um único relatório por viagem ou período — ex: "Visita São Paulo — Jun/2026". O gestor analisa e aprova o lote inteiro de uma vez, sem abrir comprovante por comprovante.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Financeiro', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="exp-novo"]',
      route: '/reimbursements/expense-reports',
      popover: {
        title: 'Criar Relatório',
        description: 'Informe o título e o período da viagem. Depois vincule os reembolsos já cadastrados — cada um mantém seu comprovante, categoria e valor originais.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Financeiro', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="exp-lista"]',
      route: '/reimbursements/expense-reports',
      popover: {
        title: 'Fluxo de Aprovação',
        description: 'Rascunho → Submeter → Gestor aprova ou rejeita (com motivo) → Marcar como Pago. O rejeite retorna o relatório ao solicitante para correção. Todo o histórico de decisões fica registrado para auditoria.',
        side: 'top',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Financeiro', 'Admin', 'Master'],
    },
  ],
};
