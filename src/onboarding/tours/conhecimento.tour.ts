import type { TourModule } from './index';

export const conhecimentoTour: TourModule = {
  id: 'conhecimento',
  description: 'Base de Conhecimento: artigos técnicos internos e conteúdo público para o portal do cliente',
  steps: [
    {
      element: '[data-onboarding="kb-novo"]',
      route: '/knowledge',
      popover: {
        title: 'Novo Artigo',
        description: 'Escreva procedimentos, manuais ou resoluções de problemas recorrentes. Suporta Markdown. Marque como "Público" para que o artigo apareça no Portal do Cliente — evita chamados repetitivos.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="kb-busca"]',
      route: '/knowledge',
      popover: {
        title: 'Pesquisa na Base',
        description: 'Busca por título e conteúdo. Filtre por tipo de serviço ou tag para encontrar o procedimento certo na hora da OS. Técnicos consultam a KB direto do wizard sem sair do fluxo.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Administrativo', 'Supervisor', 'Financeiro', 'Comprador', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="kb-grid"]',
      route: '/knowledge',
      popover: {
        title: 'Artigos Técnicos',
        description: 'Cada card mostra tags, tipo de serviço, visibilidade (público/interno) e contador de visualizações. Artigos mais vistos são os procedimentos mais consultados pela equipe — priorize mantê-los atualizados.',
        side: 'top',
      },
      roles: ['Tecnico', 'Administrativo', 'Supervisor', 'Financeiro', 'Comprador', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
