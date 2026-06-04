import type { TourModule } from './index';

export const adminSlaTour: TourModule = {
  id: 'admin-sla',
  description: 'SLA: políticas de tempo de resposta e resolução por tipo de serviço e prioridade',
  steps: [
    {
      element: '[data-onboarding="sla-novo"]',
      route: '/admin/sla',
      popover: {
        title: 'Nova Política de SLA',
        description: 'Configure o tempo de resposta e resolução por combinação de tipo de serviço e prioridade (baixa, normal, alta, crítica). É o contrato interno de qualidade que o dashboard de KPIs usa para calcular o SLA cumprido.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="sla-grid"]',
      route: '/admin/sla',
      popover: {
        title: 'Políticas de SLA Ativas',
        description: 'Cada card mostra horas para resposta e resolução. Políticas inativas não afetam o cálculo do dashboard. Ajuste os tempos conforme os contratos com seus clientes — cada tenant tem suas próprias regras.',
        side: 'top',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
  ],
};
