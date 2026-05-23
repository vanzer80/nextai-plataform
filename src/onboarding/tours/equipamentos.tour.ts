import type { TourModule } from './index';

export const equipamentosTour: TourModule = {
  id: 'equipamentos',
  description: 'Asset management and preventive maintenance control',
  steps: [
    {
      element: '[data-onboarding="eq-novo"]',
      route: '/equipments',
      popover: {
        title: 'Cadastrar Ativo',
        description: 'Registre o equipamento com fabricante, modelo, número de série, data de instalação, prazo de garantia e o intervalo de manutenção preventiva em dias.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="eq-preventiva-col"]',
      route: '/equipments',
      popover: {
        title: 'Controle de Preventiva',
        description: 'O sistema calcula automaticamente: "Em dia" (>15 dias para vencer), "Próxima" (≤15 dias) ou "Vencida". Sem cron, sem configuração — funciona direto no navegador a partir das datas cadastradas.',
        side: 'bottom',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="eq-detalhe-btn"]',
      route: '/equipments',
      popover: {
        title: 'Histórico do Ativo',
        description: 'Abre o painel de detalhe com dados técnicos completos e todas as OS já realizadas neste equipamento — clicáveis para navegar ao relatório. Trace a vida útil do ativo em segundos.',
        side: 'left',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
