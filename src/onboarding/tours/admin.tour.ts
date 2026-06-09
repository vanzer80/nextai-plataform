import type { TourModule } from './index';

export const adminTour: TourModule = {
  id: 'admin',
  description: 'Administration: checklist templates, service types and user management',
  steps: [
    {
      element: '[data-onboarding="admin-templates-novo"]',
      route: '/admin/checklist-templates',
      popover: {
        title: 'Novo Template de Checklist',
        description: 'Dê um nome ao template (ex: "Manutenção Preventiva — Compressores") e adicione os itens de verificação. Templates são exclusivos do tenant — cada empresa tem os seus.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="admin-templates-lista"]',
      route: '/admin/checklist-templates',
      popover: {
        title: 'Templates de Checklist',
        description: 'Cada template pode ser vinculado a um tipo de serviço. Quando o técnico cria uma OS daquele tipo, o checklist aparece automaticamente no Step 3 do wizard.',
        side: 'bottom',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="admin-st-novo"]',
      route: '/admin/service-types',
      popover: {
        title: 'Novo Tipo de Serviço',
        description: 'Crie categorias de OS personalizadas para o vocabulário da empresa: "Manutenção Corretiva", "Startup", "Comissionamento", "Inspeção". Os tipos são exclusivos do tenant.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="admin-usr-convidar"]',
      route: '/admin/usuarios',
      popover: {
        title: 'Convidar Usuário',
        description: 'Digite o e-mail e selecione o perfil de acesso. O usuário recebe um link de confirmação e já acessa o sistema com as permissões corretas — sem precisar de suporte técnico.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="admin-usr-tabela"]',
      route: '/admin/usuarios',
      popover: {
        title: 'Equipe',
        description: 'Visualize todos os membros, seus perfis e status. Altere o perfil ou desative um usuário a qualquer momento. Cada ação fica registrada no log de auditoria.',
        side: 'top',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    // ── Editor de Template (TemplateEditor) ───────────────────────────────────
    {
      element: '[data-onboarding="admin-template-header"]',
      route: '/admin/checklist-templates/new',
      popover: {
        title: 'Informações do Template',
        description: 'Dê um nome claro ao template e vincule-o a um Tipo de Serviço para que ele apareça automaticamente nas OS daquele tipo. A Categoria de Ativo filtra ainda mais — útil quando há vários templates para o mesmo tipo de serviço.',
        side: 'bottom',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="admin-template-itens"]',
      route: '/admin/checklist-templates/new',
      popover: {
        title: 'Itens do Checklist',
        description: 'Adicione campos de texto, número, data, seleção múltipla ou assinatura. Marque os obrigatórios com o asterisco vermelho. Use as setas para reordenar e o ícone de lápis para editar cada item antes de salvar.',
        side: 'top',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
  ],
};
