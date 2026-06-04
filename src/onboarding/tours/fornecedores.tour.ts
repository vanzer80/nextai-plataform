import type { TourModule } from './index';

export const fornecedoresTour: TourModule = {
  id: 'fornecedores',
  description: 'Fornecedores: cadastro com CNPJ, contato, avaliação e prazo de entrega',
  steps: [
    {
      element: '[data-onboarding="forn-novo"]',
      route: '/suppliers',
      popover: {
        title: 'Novo Fornecedor',
        description: 'Cadastre nome, CNPJ, contato e endereço. O campo "Prazo médio de entrega" alimenta o módulo de Compras com sugestões de prazo — quanto mais completo, melhor a IA de compras.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="forn-grid"]',
      route: '/suppliers',
      popover: {
        title: 'Base de Fornecedores',
        description: 'Cada card mostra avaliação em estrelas (1–5), dados de contato e localização. Fornecedores inativos ficam opacos mas mantêm o histórico. O rating médio é atualizado a cada OS onde o fornecedor foi utilizado.',
        side: 'top',
      },
      roles: ['Supervisor', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
