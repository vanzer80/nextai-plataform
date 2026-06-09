import type { TourModule } from './index';

export const osImportTour: TourModule = {
  id: 'os-import',
  description: 'Importação de OSs de sistemas externos via API (TOTVS, SAP, Omie, PDF)',
  steps: [
    {
      element: '[data-onboarding="os-imports-page"]',
      popover: {
        title: 'Importação de OS',
        description: 'Acompanhe OSs recebidas de sistemas externos — TOTVS, SAP, Omie ou PDF. Cada importação é normalizada para o padrão NextAI e fica disponível imediatamente para gerar orçamento. Clique em qualquer linha para ver detalhes e payload.',
        side: 'bottom',
      },
      roles: ['Admin', 'Master'],
      route: '/admin/os-imports',
    },
    {
      element: '[data-onboarding="os-imports-filters"]',
      popover: {
        title: 'Filtros de monitoramento',
        description: 'Filtre por status (Sucesso / Falha / Duplicado) ou sistema de origem para identificar rapidamente importações com problema. Falhas exibem o detalhe do erro e o botão "Reprocessar" para copiar o payload e reenviar.',
        side: 'bottom',
      },
      roles: ['Admin', 'Master'],
      route: '/admin/os-imports',
    },
  ],
};
