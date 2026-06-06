import type { TourModule } from './index';

export const materiaisTour: TourModule = {
  id: 'materiais',
  description: 'Purchase requests with AI assistant and authorization flow',
  steps: [
    {
      element: '[data-onboarding="mat-novo"]',
      route: '/materials',
      popover: {
        title: 'Nova Solicitação de Compra',
        description: 'Crie manualmente ou use a IA para preencher automaticamente. Descreva em português o que precisa e a IA interpreta e estrutura os campos — item, quantidade, fornecedor sugerido e urgência.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Tecnico', 'Administrativo', 'Supervisor', 'Gestor', 'Comprador', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="mat-ia-prompt"]',
      route: '/materials/new',
      popover: {
        title: 'Assistente de IA',
        description: 'Digite algo como "preciso de 2 filtros de ar para o compressor Atlas Copco GA55, urgente" e a IA preenche automaticamente os campos. Powered by Gemini com fallback para OpenAI.',
        side: 'top',
      },
      roles: ['Tecnico', 'Administrativo', 'Supervisor', 'Gestor', 'Comprador', 'Admin', 'Master'],
    },
    // ── Formulário de Solicitação (NewMaterialRequest) ────────────────────────
    {
      element: '[data-onboarding="mat-form-material"]',
      route: '/materials/new',
      popover: {
        title: 'Especificação do Material',
        description: 'Campos preenchidos pela IA ficam destacados em azul — confirme ou ajuste. Inclua marca, modelo, tensão e código de referência na especificação técnica para facilitar a cotação pelo comprador.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Administrativo', 'Supervisor', 'Gestor', 'Comprador', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="mat-form-acoes"]',
      route: '/materials/new',
      popover: {
        title: 'Enviar Solicitação',
        description: '"Enviar Solicitação" notifica todos os compradores em tempo real. "Voltar" retorna para a tela de captura de foto ou câmera sem perder os dados preenchidos.',
        side: 'top',
        align: 'end',
      },
      roles: ['Tecnico', 'Administrativo', 'Supervisor', 'Gestor', 'Comprador', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="mat-card-primeiro"]',
      route: '/materials',
      popover: {
        title: 'Autorização de Compra',
        description: 'Compradores e gestores autorizam ou rejeitam pedidos aqui. A aprovação notifica o solicitante em tempo real. Histórico completo de decisões por pedido.',
        side: 'bottom',
      },
      roles: ['Comprador', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
