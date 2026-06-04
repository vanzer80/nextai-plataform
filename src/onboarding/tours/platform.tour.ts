import type { TourModule } from './index';

export const platformTour: TourModule = {
  id: 'platform',
  description: 'SuperMaster panel — NextAI platform management',
  steps: [
    {
      element: '[data-onboarding="platform-tenants-lista"]',
      route: '/platform/tenants',
      popover: {
        title: 'Gerenciamento de Tenants',
        description: 'Visão completa de todas as empresas na plataforma: status, data de criação, usuários ativos. Você é o SuperMaster — acesso cross-tenant para suporte e operação da NextAI.',
        side: 'bottom',
      },
      roles: ['SuperMaster'],
    },
    {
      element: '[data-onboarding="platform-tenants-novo"]',
      route: '/platform/tenants',
      popover: {
        title: 'Provisionar Novo Tenant',
        description: 'Cria uma nova empresa na plataforma com slug único, usuário Master e isolamento RLS automático. O processo é 100% server-side via Edge Function — zero configuração manual.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['SuperMaster'],
    },
    {
      element: '[data-onboarding="platform-users-lista"]',
      route: '/platform/users',
      popover: {
        title: 'Usuários Cross-Tenant',
        description: 'Veja e gerencie usuários de todos os tenants em um único painel. Útil para suporte: resetar acesso, alterar perfil ou desativar conta sem precisar logar como o tenant.',
        side: 'bottom',
      },
      roles: ['SuperMaster'],
    },
    {
      element: '[data-onboarding="platform-settings-logo"]',
      route: '/platform/settings',
      popover: {
        title: 'Logo e Branding',
        description: 'Faça upload do logo e configure a cor primária da plataforma NextAI. Cada tenant pode ter seu próprio branding sobreposto — este é o padrão base para novos tenants provisionados.',
        side: 'bottom',
      },
      roles: ['SuperMaster'],
    },
    {
      element: '[data-onboarding="platform-intelligence-header"]',
      route: '/platform/intelligence',
      popover: {
        title: 'Banco de Inteligência',
        description: 'Corpus de dados cross-tenant anonimizado: OS, diagnósticos, KB e tabelas operacionais de todos os tenants. Os KPIs mostram o volume total que alimenta o modelo de IA. Todos os acessos são registrados na trilha de auditoria.',
        side: 'bottom',
      },
      roles: ['SuperMaster'],
    },
    {
      element: '[data-onboarding="platform-intelligence-tabs"]',
      route: '/platform/intelligence',
      popover: {
        title: '15 Abas + Monitor de Roteamento IA',
        description: 'Corpus IA (Diagnósticos + KB) e 13 tabelas brutas exportáveis em JSON/CSV. O widget "Roteamento IA" aparece quando há chamadas registradas — mostra se o fallback para OpenAI foi ativado (custo ~10× maior que Gemini). Fica vermelho quando o fallback ultrapassa 15%.',
        side: 'bottom',
      },
      roles: ['SuperMaster'],
    },
  ],
};
