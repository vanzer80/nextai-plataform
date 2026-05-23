import type { TourModule } from './index';

export const orcamentosTour: TourModule = {
  id: 'orcamentos',
  description: 'Commercial proposals with PDF generation and approval flow',
  steps: [
    {
      element: '[data-onboarding="orc-novo"]',
      route: '/orcamentos',
      popover: {
        title: 'Novo Orçamento',
        description: 'Adicione itens, quantidades, valores unitários e desconto percentual. O total é calculado em tempo real. O PDF é gerado diretamente no navegador — sem backend, sem custo de servidor.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="orc-card-primeiro"]',
      route: '/orcamentos',
      popover: {
        title: 'Card de Orçamento',
        description: 'Clique para abrir o detalhe. Gestores e supervisores aprovam ou rejeitam o orçamento aqui. O PDF com logo do tenant pode ser gerado e enviado ao cliente diretamente.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
