import type { TourModule } from './index';

export const orcamentosTour: TourModule = {
  id: 'orcamentos',
  description: 'Commercial proposals with PDF generation and approval flow',
  steps: [
    {
      element: '[data-onboarding="orc-novo"]',
      route: '/orcamentos',
      popover: {
        title: 'Novo Orçamento',
        description: 'Adicione itens, quantidades, valores unitários e desconto percentual. O total é calculado em tempo real. O PDF é gerado diretamente no navegador — sem backend, sem custo de servidor.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="orc-card-primeiro"]',
      route: '/orcamentos',
      popover: {
        title: 'Card de Orçamento',
        description: 'Clique para abrir o detalhe. Gestores e supervisores aprovam ou rejeitam o orçamento aqui. O PDF com logo do tenant pode ser gerado e enviado ao cliente diretamente.',
        side: 'bottom',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    // ── Formulário de Orçamento (NovoOrcamento) ───────────────────────────────
    {
      element: '[data-onboarding="orc-form-dados"]',
      route: '/orcamentos/novo',
      popover: {
        title: 'Dados Gerais',
        description: 'Selecione o cliente e informe o título. Se você clicou em "Gerar Orçamento" a partir de uma OS, esses campos já vêm preenchidos automaticamente — você só revisa e ajusta.',
        side: 'bottom',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="orc-form-itens"]',
      route: '/orcamentos/novo',
      popover: {
        title: 'Itens do Orçamento',
        description: 'Adicione descrição, quantidade, unidade e valor unitário de cada item. O subtotal, desconto percentual e total são calculados em tempo real. Peças utilizadas na OS são importadas automaticamente quando disponíveis.',
        side: 'top',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    // ── Detalhe do Orçamento (OrcamentoDetail) ────────────────────────────────
    {
      element: '[data-onboarding="orc-detalhe-cabecalho"]',
      route: '/orcamentos',
      popover: {
        title: 'Status e Ações do Orçamento',
        description: 'O badge de status mostra o estágio atual: Rascunho → Enviado → Aprovado / Rejeitado / Assinado. O botão PDF gera o documento com logo do tenant, assinatura e versão atual — pronto para envio ao cliente.',
        side: 'bottom',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="orc-detalhe-itens"]',
      route: '/orcamentos',
      popover: {
        title: 'Tabela de Itens e Total',
        description: 'Visualize todos os itens, quantidades, valores unitários e o total com desconto aplicado. Cada versão salva do orçamento fica no histórico — você pode comparar versões e restaurar qualquer uma.',
        side: 'top',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
