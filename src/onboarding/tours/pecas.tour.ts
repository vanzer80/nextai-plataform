import type { TourModule } from './index';

export const pecasTour: TourModule = {
  id: 'pecas',
  description: 'Inventário de Peças: estoque, alertas de mínimo e vínculo com fornecedores',
  steps: [
    {
      element: '[data-onboarding="peca-novo"]',
      route: '/parts',
      popover: {
        title: 'Nova Peça',
        description: 'Cadastre nome, código, unidade, custo unitário, estoque atual e estoque mínimo. O badge âmbar no topo avisa quando alguma peça fica abaixo do mínimo — sinal de reposição antes que o campo fique sem peça.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="peca-grid"]',
      route: '/parts',
      popover: {
        title: 'Catálogo de Peças',
        description: 'Cards com borda laranja estão com estoque abaixo do mínimo. Clique em editar para ajustar o estoque após entrada de NF ou devolução. Vincule ao fornecedor para que o módulo de Compras sugira a reposição automaticamente.',
        side: 'top',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
