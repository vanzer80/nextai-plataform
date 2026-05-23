import type { TourModule } from './index';

export const clientesTour: TourModule = {
  id: 'clientes',
  description: 'Client base with CNPJ auto-fill and locations',
  steps: [
    {
      element: '[data-onboarding="cli-novo"]',
      route: '/clients',
      popover: {
        title: 'Novo Cliente',
        description: 'Digite o CNPJ e os dados são preenchidos automaticamente via API pública (Receita Federal): razão social, endereço, contato. Cadastre quantas unidades (plantas, filiais) forem necessárias.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
