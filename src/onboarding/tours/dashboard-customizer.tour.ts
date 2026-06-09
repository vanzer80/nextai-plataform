import type { TourModule } from './index';

export const dashboardCustomizerTour: TourModule = {
  id: 'dashboard-customizer',
  description: 'Personalização do Dashboard: ativar, desativar e reordenar widgets por perfil',
  steps: [
    {
      element: '[data-onboarding="dashboard-personalizar"]',
      route: '/dashboard',
      popover: {
        title: 'Personalizar Dashboard',
        description: 'Escolha quais indicadores aparecem e em qual ordem. Cada perfil de usuário tem um conjunto elegível de widgets — o Gestor vê tudo, o Técnico vê OS e agenda. As preferências ficam salvas no banco, não no navegador.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
