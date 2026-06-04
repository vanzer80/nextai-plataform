import type { TourModule } from './index';

export const adminTenantsMgmtTour: TourModule = {
  id: 'admin-tenants-mgmt',
  description: 'Gerenciar Tenant: configurações do próprio tenant — dados, logo, cor e usuários',
  steps: [
    {
      element: '[data-onboarding="tenant-mgmt-tabela"]',
      route: '/admin/tenants',
      popover: {
        title: 'Gerenciar Organização',
        description: 'Configurações do seu tenant: razão social, slug único de URL, cor primária da marca e logo. Qualquer alteração aqui reflete em tempo real em todos os PDFs, portal do cliente e relatórios.',
        side: 'top',
      },
      roles: ['Master'],
    },
  ],
};
