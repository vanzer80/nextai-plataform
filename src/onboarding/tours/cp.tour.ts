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
    // ── Nova Conta a Pagar (formulário) ──────────────────────────────────────
    {
      element: '[data-onboarding="cp-form-classificacao"]',
      route: '/cp/new',
      popover: {
        title: 'Classificação da Despesa',
        description: 'Selecione o tipo (fornecedor, imposto, aluguel, folha…), informe a categoria e a descrição. O campo Fornecedor é opcional — vincule a um cadastro existente para facilitar o histórico por fornecedor.',
        side: 'bottom',
      },
      roles: ['Financeiro', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="cp-form-valores"]',
      route: '/cp/new',
      popover: {
        title: 'Valor e Parcelamento',
        description: 'Informe o valor total e o número de parcelas. O sistema calcula automaticamente o valor de cada parcela e o cronograma de vencimentos a partir da primeira data informada.',
        side: 'bottom',
      },
      roles: ['Financeiro', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="cp-form-acoes"]',
      route: '/cp/new',
      popover: {
        title: 'Salvar ou Enviar para Aprovação',
        description: '"Salvar Rascunho" mantém a conta editável sem notificar ninguém. "Enviar para Aprovação" dispara o workflow imediatamente — Gestor/Admin recebe a solicitação e pode aprovar ou rejeitar com comentário.',
        side: 'top',
        align: 'end',
      },
      roles: ['Financeiro', 'Gestor', 'Admin', 'Master'],
    },
    // ── Detalhe da Conta (PayableDetail) ─────────────────────────────────────
    {
      element: '[data-onboarding="cp-detalhe-info"]',
      route: '/cp/payables',
      popover: {
        title: 'Dados e Status de Aprovação',
        description: 'Veja tipo, categoria, fornecedor, valor, vencimento, forma de pagamento e o histórico completo do workflow: quando foi enviado, quem aprovou, quando foi rejeitado e o motivo.',
        side: 'bottom',
      },
      roles: ['Financeiro', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="cp-detalhe-historico"]',
      route: '/cp/payables',
      popover: {
        title: 'Comentários e Auditoria',
        description: 'Toda decisão do workflow (aprovação, rejeição, pagamento) gera um evento de sistema registrado aqui. Adicione comentários manuais para comunicação interna — tudo fica auditável e com timestamp.',
        side: 'top',
      },
      roles: ['Financeiro', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
