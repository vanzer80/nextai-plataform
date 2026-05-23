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
  ],
};
