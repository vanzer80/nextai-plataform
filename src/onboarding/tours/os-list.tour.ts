import type { TourModule } from './index';

export const osListTour: TourModule = {
  id: 'os-list',
  description: 'OS list, filters, status badges and offline sync',
  steps: [
    {
      element: '[data-onboarding="os-nova"]',
      route: '/reports',
      popover: {
        title: 'Nova Ordem de Serviço',
        description: 'Abre o wizard de criação em 7 etapas guiadas: tipo de serviço, equipamento/cliente, checklist, diagnóstico, execução, fotos e assinatura digital.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="os-sync-badge"]',
      route: '/reports',
      popover: {
        title: 'Indicador de Conectividade',
        description: 'Mostra se você está online ou offline. OS criadas sem internet ficam em fila local (IndexedDB) e são sincronizadas automaticamente quando a conexão retorna — sem perder dados.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="os-filtros"]',
      route: '/reports',
      popover: {
        title: 'Filtros de OS',
        description: 'Filtre por status (rascunho, aguardando revisão, aprovada, devolvida), período e técnico responsável. Gestores veem todas as OS da equipe; técnicos veem apenas as suas.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="os-card-primeiro"]',
      route: '/reports',
      popover: {
        title: 'Card de OS',
        description: 'Clique para abrir o detalhe completo: diagnóstico, checklist preenchido, fotos, assinaturas e histórico de status. Gestores e supervisores também aprovam ou devolvem a OS aqui.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="os-status-badge"]',
      route: '/reports',
      popover: {
        title: 'Status da OS',
        description: 'Rascunho → Aguardando Revisão → Aprovada (ou Devolvida). OS devolvidas voltam ao técnico com comentário explicativo — o técnico corrige e reenvia para aprovação.',
        side: 'right',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
