import type { TourModule } from './index';

export const dpTour: TourModule = {
  id: 'dp',
  description: 'Departamento Pessoal: folha de pagamento, férias e controle de ponto',
  steps: [
    {
      element: '[data-onboarding="dp-kpis"]',
      route: '/dp/payroll',
      popover: {
        title: 'Consolidado Anual da Folha',
        description: 'Total bruto, líquido e FGTS acumulado no ano. O indicador "Competências Abertas" sinaliza folhas pendentes de cálculo ou fechamento — não deixe passar do prazo bancário.',
        side: 'bottom',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="dp-nova-competencia"]',
      route: '/dp/payroll',
      popover: {
        title: 'Nova Competência',
        description: 'Abra a competência do mês. O sistema puxa automaticamente todos os colaboradores ativos e calcula INSS e IRRF com as tabelas vigentes. Você só revisa e fecha.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="dp-tabela"]',
      route: '/dp/payroll',
      popover: {
        title: 'Histórico de Competências',
        description: 'Clique em qualquer competência para ver o holerite de cada colaborador com quebra de proventos, descontos e líquido. Status: Aberta → Calculada → Fechada → Paga.',
        side: 'top',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="dp-ferias-kpis"]',
      route: '/dp/vacation',
      popover: {
        title: 'Painel de Férias',
        description: 'Quantos colaboradores estão em gozo hoje, quantas férias aguardam aprovação e quantos períodos aquisitivos vencem em 30 dias — tempo de agir antes de gerar passivo trabalhista.',
        side: 'bottom',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="dp-ferias-novo"]',
      route: '/dp/vacation',
      popover: {
        title: 'Agendar Férias',
        description: 'Informe o período aquisitivo, as datas de gozo e, se houver, a venda de 1/3 (abono pecuniário). O sistema calcula os dias automaticamente e aguarda aprovação do gestor.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="dp-ferias-tabela"]',
      route: '/dp/vacation',
      popover: {
        title: 'Controle de Férias',
        description: 'Aprove, inicie gozo ou conclua férias diretamente na tabela. Períodos que vençam em 30 dias ficam destacados em laranja — alerta antecipado de passivo.',
        side: 'top',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="dp-ponto-filtros"]',
      route: '/dp/timerecords',
      popover: {
        title: 'Controle de Ponto',
        description: 'Selecione o colaborador e o mês para visualizar os registros de jornada. O sistema registra entrada, saída para almoço, retorno e saída — calculando horas trabalhadas e horas extras automaticamente por dia.',
        side: 'bottom',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
  ],
};
