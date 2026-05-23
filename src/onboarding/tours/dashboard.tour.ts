import type { TourModule } from './index';

export const dashboardTour: TourModule = {
  id: 'dashboard',
  description: 'KPIs, charts and performance indicators',
  steps: [
    {
      element: '[data-onboarding="dashboard-kpis"]',
      route: '/dashboard',
      popover: {
        title: 'Indicadores-chave (KPIs)',
        description: 'Cada card mostra um KPI do período: OS abertas, OS pendentes de revisão, taxa de aprovação e produtividade. Os valores são exclusivos do seu tenant — isolados de outros clientes.',
        side: 'bottom',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="dashboard-taxa-retorno"]',
      route: '/dashboard',
      popover: {
        title: 'Taxa de Retorno',
        description: 'Percentual de OS devolvidas ao técnico para ajuste nos últimos 30 dias. Manter abaixo de 20% indica boa qualidade de campo. O card fica vermelho quando ultrapassa esse limiar.',
        side: 'bottom',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="dashboard-grafico"]',
      route: '/dashboard',
      popover: {
        title: 'Balanço de OS (7 dias)',
        description: 'Gráfico de barras comparando OS abertas × aprovadas × devolvidas por dia. Picos de "devolvidas" indicam dias de retrabalho — oportunidade de coaching da equipe técnica.',
        side: 'top',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
