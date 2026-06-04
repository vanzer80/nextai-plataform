import type { TourModule } from './index';

export const rhTour: TourModule = {
  id: 'rh',
  description: 'Recursos Humanos: quadro de colaboradores, KPIs de headcount e certificações',
  steps: [
    {
      element: '[data-onboarding="rh-kpis"]',
      route: '/rh/employees',
      popover: {
        title: 'Painel de Headcount',
        description: 'Visão instantânea do quadro: ativos, em férias, afastados e desligamentos no mês. Qualquer variação anormal aqui é o primeiro sinal de ação pelo DP.',
        side: 'bottom',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="rh-admitir"]',
      route: '/rh/employees',
      popover: {
        title: 'Admitir Colaborador',
        description: 'Inicia o fluxo de admissão: dados pessoais, CPF, tipo de contrato (CLT, PJ, Estágio…), cargo e departamento. O sistema gera a matrícula automaticamente e já integra com a folha.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="rh-filtros"]',
      route: '/rh/employees',
      popover: {
        title: 'Filtros de Colaboradores',
        description: 'Combine status (ativo, férias, afastado, desligado) com departamento e nome/CPF para encontrar qualquer colaborador em segundos. Os filtros são cumulativos.',
        side: 'bottom',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="rh-tabela"]',
      route: '/rh/employees',
      popover: {
        title: 'Quadro de Colaboradores',
        description: 'Clique em qualquer linha para abrir o perfil completo: histórico de cargo, certificações, documentos e linha do tempo de eventos. O botão Excel exporta o quadro filtrado para o RH externo.',
        side: 'top',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="rh-dep-novo"]',
      route: '/rh/departments',
      popover: {
        title: 'Estrutura Organizacional',
        description: 'Crie departamentos hierárquicos com código e centro de custo. O org chart mostra em tempo real se algum departamento está acima do headcount alvo — alerta visual automático.',
        side: 'bottom',
        align: 'end',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="rh-dep-tabs"]',
      route: '/rh/departments',
      popover: {
        title: 'Org Chart & Cargos',
        description: 'Alterne entre o organograma hierárquico e a tabela de cargos. Cada cargo pode ter faixa salarial (mínimo/máximo) e código CBO para conformidade trabalhista.',
        side: 'bottom',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
  ],
};
