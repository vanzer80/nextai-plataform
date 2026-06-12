import type { TourModule } from './index';

export const osWizardTour: TourModule = {
  id: 'os-wizard',
  description: 'New OS creation wizard — 7 guided steps',
  steps: [
    {
      element: '[data-onboarding="wizard-step-indicator"]',
      route: '/reports/new',
      popover: {
        title: 'Wizard de 7 Etapas',
        description: 'O formulário é dividido em etapas para facilitar o preenchimento em campo, inclusive com uma mão. Você pode voltar e editar qualquer etapa antes de enviar. O rascunho é salvo automaticamente.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="wizard-step1-tipo"]',
      route: '/reports/new',
      popover: {
        title: 'Etapa 1 — Tipo de Serviço',
        description: 'Selecione a categoria do atendimento (ex: Manutenção Corretiva, Preventiva, Instalação). Os tipos são configurados pelo administrador e são exclusivos do seu tenant.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="wizard-step2-cliente"]',
      route: '/reports/new',
      popover: {
        title: 'Etapa 2 — Cliente',
        description: 'Selecione o cliente para filtrar apenas os equipamentos cadastrados para ele. Após selecionar o cliente, o dropdown de equipamento atualiza automaticamente.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="wizard-step2-ativo"]',
      route: '/reports/new',
      popover: {
        title: 'Equipamento / Ativo',
        description: 'Selecione o equipamento específico atendido. Se o ativo não estiver cadastrado, use a opção "Digitar manualmente" — sem travar o atendimento de campo.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="wizard-step2-geo"]',
      route: '/reports/new',
      popover: {
        title: 'Geolocalização do Atendimento',
        description: 'Captura as coordenadas GPS do local do serviço. Serve como evidência de presença e fica registrado no detalhe da OS. Toque no botão para capturar automaticamente pelo GPS do dispositivo.',
        side: 'top',
      },
      roles: ['Tecnico', 'Supervisor'],
    },
    {
      element: '[data-onboarding="wizard-step3-checklist"]',
      route: '/reports/new',
      popover: {
        title: 'Etapa 3 — Checklist',
        description: 'Checklist estruturado definido pelo admin para este tipo de serviço. Itens podem ser Sim/Não, numéricos, texto livre, seleção ou foto. Itens não conformes são destacados no relatório final.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="wizard-step4-problema"]',
      route: '/reports/new',
      popover: {
        title: 'Etapa 4 — Diagnóstico',
        description: 'Documente o problema relatado pelo cliente, diagnóstico preliminar e diagnóstico final. Notas internas não aparecem no PDF entregue ao cliente.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="wizard-step5-servicos"]',
      route: '/reports/new',
      popover: {
        title: 'Etapa 5 — Execução',
        description: 'Descreva os serviços executados, peças utilizadas, pendências em aberto e recomendações técnicas. Tudo fica documentado no relatório para o cliente.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="wizard-step5-ia"]',
      route: '/reports/new',
      popover: {
        title: 'Melhorar com IA',
        description: 'Descreva informalmente o que você fez e toque em "Melhorar com IA". A IA reescreve em linguagem técnica profissional e sugere recomendação técnica e pendências. Você sempre revisa antes de aplicar.',
        side: 'top',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="wizard-step6-fotos"]',
      route: '/reports/new',
      popover: {
        title: 'Etapa 6 — Evidências Fotográficas',
        description: 'Anexe fotos do antes, durante e depois do serviço. As imagens são armazenadas com segurança e aparecem no PDF do relatório. Adicione legenda em cada foto para facilitar a identificação.',
        side: 'bottom',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="wizard-step7-assinatura"]',
      route: '/reports/new',
      popover: {
        title: 'Etapa 7 — Assinatura Digital',
        description: 'O técnico e o cliente assinam diretamente no touchscreen. As assinaturas ficam embutidas no PDF — sem papel, sem scanner. Juridicamente equivalente à assinatura manuscrita.',
        side: 'top',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="wizard-step7-enviar"]',
      route: '/reports/new',
      popover: {
        title: 'Enviar para Revisão',
        description: 'Ao enviar, a OS muda de Rascunho para "Aguardando Revisão" e o supervisor recebe notificação em tempo real. Se devolvida para ajuste, você recebe o comentário explicativo aqui.',
        side: 'top',
        align: 'end',
      },
      roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'],
    },
  ],
};
