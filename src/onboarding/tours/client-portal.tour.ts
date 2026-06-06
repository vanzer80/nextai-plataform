import type { TourModule } from './index';

export const clientPortalTour: TourModule = {
  id: 'client-portal',
  description: 'Portal do Cliente: acompanhamento de Ordens de Serviço em modo leitura',
  steps: [
    {
      element: '[data-onboarding="portal-header"]',
      route: '/portal',
      popover: {
        title: 'Portal do Cliente',
        description: 'Aqui você acompanha todas as Ordens de Serviço abertas para sua empresa. Use o filtro de status para ver apenas os serviços em análise, aprovados ou devolvidos.',
        side: 'bottom',
      },
      roles: ['Cliente'],
    },
    {
      element: '[data-onboarding="portal-lista"]',
      route: '/portal',
      popover: {
        title: 'Ordens de Serviço',
        description: 'Clique em qualquer OS para ver o relatório completo: fotos, checklist, assinatura e histórico de status. Orçamentos vinculados também ficam acessíveis no detalhe da OS.',
        side: 'top',
      },
      roles: ['Cliente'],
    },
  ],
};
