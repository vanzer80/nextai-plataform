import type { TourModule } from './index';

export const adminBudgetTour: TourModule = {
  id: 'admin-budget',
  description: 'Orçamento Operacional: limites de despesa por categoria e período para controle de reembolsos',
  steps: [
    {
      element: '[data-onboarding="budget-novo"]',
      route: '/admin/budget',
      popover: {
        title: 'Novo Orçamento',
        description: 'Defina um limite de gasto por categoria (Alimentação, Transporte, Hospedagem) e período (mensal, trimestral, anual). O módulo de Reembolsos avisa quando o colaborador está próximo do limite — zero surpresas na conciliação.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="budget-grid"]',
      route: '/admin/budget',
      popover: {
        title: 'Orçamentos Configurados',
        description: 'Limites ativos por categoria e período. O indicador de uso mostra o percentual consumido em tempo real com base nos reembolsos aprovados. Acima de 80%, o aprovador é notificado antes do fechamento.',
        side: 'top',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
  ],
};
