import type { TourModule } from './index';

export const osDetailTour: TourModule = {
  id: 'os-detail',
  description: 'OS detail view: status, PDF export, approval panel, signatures',
  steps: [
    {
      element: '[data-onboarding="detail-status"]',
      popover: {
        title: 'Status da OS',
        description: 'Mostra o estágio atual no fluxo de aprovação. O histórico completo de mudanças de status — com data, hora e responsável — fica registrado abaixo.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="detail-pdf"]',
      popover: {
        title: 'Exportar PDF',
        description: 'Gera o relatório técnico completo em PDF — com logo do tenant, checklist, fotos e assinaturas — diretamente no navegador. Disponível apenas para OS aprovadas. Pronto para envio ao cliente em segundos.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="detail-aprovacao"]',
      popover: {
        title: 'Painel de Aprovação',
        description: 'Supervisores e gestores aprovam ou devolvem a OS aqui. Ao devolver, é obrigatório informar o motivo — o técnico recebe notificação e vê o comentário diretamente na OS.',
        side: 'top',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="detail-assinaturas"]',
      popover: {
        title: 'Assinaturas',
        description: 'Exibe as assinaturas coletadas: técnico, cliente e supervisor. Cada assinatura tem timestamp e nome do signatário — evidência completa e rastreável do aceite do serviço.',
        side: 'top',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
