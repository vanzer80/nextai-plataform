import type { TourModule } from './index';

export const reembolsosTour: TourModule = {
  id: 'reembolsos',
  description: 'Expense reimbursement requests with photo receipts and approval',
  steps: [
    {
      element: '[data-onboarding="reimb-novo"]',
      route: '/reimbursements',
      popover: {
        title: 'Solicitar Reembolso',
        description: 'Informe o valor, categoria e data da despesa. Anexe a foto do comprovante direto da câmera do celular. O financeiro/gestor recebe notificação em tempo real para aprovação.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Financeiro', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="reimb-card-primeiro"]',
      route: '/reimbursements',
      popover: {
        title: 'Histórico de Reembolsos',
        description: 'Cada solicitação mostra status, valor e categoria. Financeiro e gestores aprovam, rejeitam ou devolvem com comentário. Todo o histórico de decisões fica registrado para auditoria.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Financeiro', 'Admin', 'Master'],
    },
    // ── Formulário de Reembolso (NewReimbursement) ────────────────────────────
    {
      element: '[data-onboarding="reimb-form-detalhes"]',
      route: '/reimbursements/new',
      popover: {
        title: 'Detalhes da Despesa',
        description: 'Preencha categoria, valor, data e favorecido. Se você tirou foto do comprovante na etapa anterior, a IA já preencheu os campos em azul — confirme ou ajuste os valores antes de enviar.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Financeiro', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="reimb-form-acoes"]',
      route: '/reimbursements/new',
      popover: {
        title: 'Enviar para Aprovação',
        description: '"Solicitar" envia o reembolso com o comprovante para o fluxo de aprovação. "Voltar" retorna para a tela de captura de foto. O sistema verifica o budget da categoria e alerta se o limite estiver próximo.',
        side: 'top',
        align: 'end',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Financeiro', 'Admin', 'Master'],
    },
  ],
};
