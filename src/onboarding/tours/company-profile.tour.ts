import type { TourModule } from './index';

export const companyProfileTour: TourModule = {
  id: 'company-profile',
  description: 'Company profile: fiscal data, address and commercial contact',
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
