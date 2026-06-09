import type { TourModule } from './index';

export const apiKeysTour: TourModule = {
  id: 'api-keys',
  description: 'Gerenciamento de API Keys para integrações externas',
  steps: [
    {
      element: '[data-onboarding="api-keys-page"]',
      popover: {
        title: 'API Keys',
        description: 'Crie e gerencie chaves de acesso à API pública NextAI. Cada chave tem escopos específicos e pode ter expiração configurável. A chave é exibida apenas uma vez — guarde-a com segurança.',
        side: 'bottom',
      },
      roles: ['Admin', 'Master'],
      route: '/admin/api-keys',
    },
    {
      element: '[data-onboarding="api-keys-nova"]',
      popover: {
        title: 'Criar nova chave',
        description: 'Informe um nome descritivo, selecione os escopos necessários (ex: orders:read para leitura de OS) e defina uma expiração opcional. Ideal para integrar ERP, BI ou automações.',
        side: 'bottom',
      },
      roles: ['Admin', 'Master'],
      route: '/admin/api-keys',
    },
  ],
};

export const webhooksTour: TourModule = {
  id: 'webhooks',
  description: 'Configuração de webhooks para receber eventos em tempo real',
  steps: [
    {
      element: '[data-onboarding="webhooks-page"]',
      popover: {
        title: 'Webhooks',
        description: 'Configure endpoints HTTPS para receber eventos em tempo real: OS criada, reembolso aprovado, orçamento assinado, conta quitada. Cada entrega é assinada com HMAC-SHA256 para garantir autenticidade.',
        side: 'bottom',
      },
      roles: ['Admin', 'Master'],
      route: '/admin/webhooks',
    },
    {
      element: '[data-onboarding="webhooks-novo"]',
      popover: {
        title: 'Novo endpoint',
        description: 'Informe a URL HTTPS do seu servidor e selecione os eventos que deseja receber. O segredo HMAC é gerado automaticamente e exibido apenas uma vez — use-o para verificar a assinatura das requisições.',
        side: 'bottom',
      },
      roles: ['Admin', 'Master'],
      route: '/admin/webhooks',
    },
  ],
};
