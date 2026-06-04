import type { TourModule } from './index';

export const agendaTour: TourModule = {
  id: 'agenda',
  description: 'Agenda/Dispatch: calendário semanal de OS e despacho de técnicos',
  steps: [
    {
      element: '[data-onboarding="agenda-filtro-tecnico"]',
      route: '/agenda',
      popover: {
        title: 'Filtrar por Técnico',
        description: 'Selecione um técnico para ver apenas as OS dele na semana. Ideal para identificar desequilíbrio de carga antes de aceitar novos chamados.',
        side: 'bottom',
        align: 'start',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="agenda-semana"]',
      route: '/agenda',
      popover: {
        title: 'Calendário Semanal & Redespacho',
        description: 'Visão semanal de todas as OS: cliente, status e prioridade em cada dia. Clique em "Atribuir" em qualquer OS para reatribuir o técnico — o novo responsável recebe notificação instantânea e a agenda atualiza em tempo real.',
        side: 'bottom',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
