import type { TourModule } from './index';

export const companyProfileTour: TourModule = {
  id: 'company-profile',
  description: 'Company profile: fiscal data, address and commercial contact (Master/Admin self-service)',
  steps: [
    {
      element: '[data-onboarding="company-profile-header"]',
      route: '/admin/company-profile',
      popover: {
        title: 'Perfil da Empresa',
        description: 'Aqui você cadastra os dados completos da empresa: CNPJ, razão social, inscrição estadual, endereço e contato comercial. Essas informações aparecem automaticamente em todos os documentos e PDFs gerados pelo sistema.',
        side: 'bottom',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
    {
      element: '[data-onboarding="company-profile-salvar"]',
      route: '/admin/company-profile',
      popover: {
        title: 'Salvar Alterações',
        description: 'Após preencher os campos, clique em Salvar. O CEP preenche logradouro, bairro, cidade e estado automaticamente ao sair do campo.',
        side: 'top',
        align: 'end',
      },
      roles: ['Gestor', 'Admin', 'Master'],
    },
  ],
};

export const platformCompanyProfileTour: TourModule = {
  id: 'platform-company-profile',
  description: 'Platform: edit commercial profile of any tenant (SuperMaster)',
  steps: [
    {
      element: '[data-onboarding="platform-company-profile-seletor"]',
      route: '/platform/company-profile',
      popover: {
        title: 'Perfil Comercial das Empresas',
        description: 'Selecione qualquer empresa cliente e preencha ou edite os dados comerciais: nome fantasia, razão social, CNPJ, inscrição estadual, contato e endereço completo com preenchimento automático por CEP.',
        side: 'bottom',
      },
      roles: ['SuperMaster'],
    },
  ],
};
