import type { TourModule } from './index';

export const adminManutencaoTour: TourModule = {
  id: 'admin-manutencao',
  description: 'Planos de Manutenção: manutenção preventiva recorrente com geração automática de OS',
  steps: [
    {
      element: '[data-onboarding="manut-novo"]',
      route: '/admin/maintenance-plans',
      popover: {
        title: 'Novo Plano de Manutenção',
        description: 'Configure a frequência (diária, semanal, mensal, trimestral), o equipamento/cliente, o técnico responsável e a prioridade. O sistema gera as OS preventivas automaticamente conforme o prazo — sem depender de lembretes manuais.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="manut-grid"]',
      route: '/admin/maintenance-plans',
      popover: {
        title: 'Planos Ativos',
        description: 'Lista ordenada por próxima execução. "Dias de lead" é o antecedência com que a OS é criada antes da data de vencimento — permite ao técnico se preparar. Planos inativos ficam pausados mas mantêm o histórico.',
        side: 'top',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
  ],
};
