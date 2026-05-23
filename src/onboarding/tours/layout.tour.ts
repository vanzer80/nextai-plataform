import type { TourModule } from './index';

export const layoutTour: TourModule = {
  id: 'layout',
  description: 'Main navigation, notifications, profile, dark mode and offline indicator',
  steps: [
    {
      element: '[data-onboarding="nav-dashboard"]',
      popover: {
        title: 'Dashboard',
        description: 'Visão geral em tempo real: OS abertas, taxa de aprovação, taxa de retorno e produtividade. Os dados atualizam automaticamente via WebSocket — sem precisar recarregar a página.',
        side: 'right',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="nav-os"]',
      popover: {
        title: 'Ordens de Serviço',
        description: 'Central de OS: visualize todas as ordens da equipe, filtre por status e acompanhe o histórico completo de cada atendimento técnico.',
        side: 'right',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="nav-orcamentos"]',
      popover: {
        title: 'Orçamentos',
        description: 'Crie propostas comerciais com itens, valores e descontos. Fluxo completo: Rascunho → Enviado → Aprovado ou Rejeitado. PDF gerado localmente no navegador.',
        side: 'right',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="nav-reembolsos"]',
      popover: {
        title: 'Reembolsos',
        description: 'Técnicos submetem despesas de campo com comprovante fotográfico. Gestores e financeiro aprovam com histórico completo de cada decisão.',
        side: 'right',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Financeiro', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="nav-compras"]',
      popover: {
        title: 'Compras',
        description: 'Solicite materiais e peças. A IA preenche os campos automaticamente a partir de uma descrição em linguagem natural — sem formulário manual.',
        side: 'right',
      },
      roles: ['Tecnico', 'Administrativo', 'Supervisor', 'Gestor', 'Comprador', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="nav-clientes"]',
      popover: {
        title: 'Clientes',
        description: 'Base de clientes com CNPJ, endereço, contato e unidades. Clientes são vinculados a equipamentos e OS para rastreabilidade completa.',
        side: 'right',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="nav-equipamentos"]',
      popover: {
        title: 'Equipamentos',
        description: 'Cadastre e gerencie os ativos dos clientes. Cada equipamento tem histórico de OS vinculadas e controle automático de manutenção preventiva.',
        side: 'right',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="nav-checklists"]',
      popover: {
        title: 'Templates de Checklist',
        description: 'Crie modelos estruturados de verificação por tipo de serviço. O técnico preenche o checklist durante a criação da OS.',
        side: 'right',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="nav-service-types"]',
      popover: {
        title: 'Tipos de Serviço',
        description: 'Personalize as categorias de OS: "Manutenção Corretiva", "Startup", "Comissionamento" — você define o vocabulário da empresa.',
        side: 'right',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="nav-admin-usuarios"]',
      popover: {
        title: 'Gestão de Usuários',
        description: 'Convide membros da equipe por e-mail e defina o perfil de acesso. O app adapta menus e permissões automaticamente por role.',
        side: 'right',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="nav-tenants"]',
      popover: {
        title: 'Tenants',
        description: 'Provisione e gerencie empresas (tenants) na plataforma. Cada tenant tem dados, usuários e configurações totalmente isolados — multi-tenant com RLS no banco.',
        side: 'right',
      },
      roles: ['Master'],
    },
    {
      element: '[data-onboarding="nav-notificacoes"]',
      popover: {
        title: 'Notificações em Tempo Real',
        description: 'Alertas instantâneos via Supabase Realtime: nova OS para revisar, reembolso aprovado, compra autorizada. O sino fica destacado quando há itens não lidos.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Tecnico', 'Administrativo', 'Supervisor', 'Gestor', 'Financeiro', 'Comprador', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="nav-perfil"]',
      popover: {
        title: 'Seu Perfil',
        description: 'Acesse dados da conta, personalize o tema (claro/escuro) e configure os atalhos da barra inferior. O botão "Repetir tutorial" fica aqui quando precisar rever alguma funcionalidade.',
        side: 'top',
        align: 'start',
      },
      roles: ['Tecnico', 'Administrativo', 'Supervisor', 'Gestor', 'Financeiro', 'Comprador', 'Admin', 'Master'],
    },
  ],
};
