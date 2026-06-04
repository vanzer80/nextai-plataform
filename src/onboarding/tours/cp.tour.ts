import type { TourModule } from './index';

export const cpTour: TourModule = {
  id: 'cp',
  description: 'Contas a Pagar: gestão de pagamentos, workflow de aprovação e vencimentos',
  steps: [
    {
      element: '[data-onboarding="cp-kpis"]',
      route: '/cp/payables',
      popover: {
        title: 'Dashboard Financeiro',
        description: 'Cinco indicadores críticos: a vencer, vencido, pago no mês, aprovado aguardando pagamento e quantidade pendente de aprovação. O vermelho exige ação imediata.',
        side: 'bottom',
      },
      roles: ['Financeiro', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="cp-nova"]',
      route: '/cp/payables',
      popover: {
        title: 'Nova Conta a Pagar',
        description: 'Cadastre qualquer tipo de despesa: fornecedor, reembolso, material, serviço, imposto, aluguel ou folha. Suporta parcelamento automático — informe o número de parcelas e o sistema divide.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Financeiro', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="cp-filtros"]',
      route: '/cp/payables',
      popover: {
        title: 'Filtros de Contas',
        description: 'Combine status (pendente, aprovado, pago, rejeitado) com tipo de despesa. Excelente para conciliação bancária: filtre "pago no mês" e exporte para conferência.',
        side: 'bottom',
      },
      roles: ['Financeiro', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="cp-tabela"]',
      route: '/cp/payables',
      popover: {
        title: 'Fila de Pagamentos',
        description: 'Datas em vermelho = vencidas. Clique em qualquer linha para ver o detalhe completo: parcelas, histórico de aprovações, comentários e opções de aprovar/rejeitar/registrar pagamento.',
        side: 'top',
      },
      roles: ['Financeiro', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
