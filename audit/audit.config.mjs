export default {
  baseUrl: process.env.AUDIT_BASE_URL || 'https://nextai-plataform.vercel.app',
  credentials: {
    email:    process.env.AUDIT_USER || 'master@gmail.com',
    password: process.env.AUDIT_PASS || '123456',
  },
  timeout: 60000,
  appReadyTimeout: 25000,   // timeout waitForAppReady após warm-up
  warmupTimeout: 35000,     // timeout primeiro waitForAppReady (cold-start Supabase)
  breakpoints: [320, 375, 768, 1280, 1440],

  // Rotas REAIS do app (fonte: nav discovery da rodada anterior)
  responsiveRoutes: ['/dashboard', '/reports', '/clients', '/rh/employees'],

  // Rotas conhecidas com nomes CORRETOS (inglês)
  // Serão mescladas com as rotas descobertas dinamicamente
  knownRoutes: [
    '/dashboard',
    '/reports',
    '/agenda',
    '/admin/maintenance-plans',
    '/clients',
    '/orcamentos',
    '/materials',
    '/suppliers',
    '/parts',
    '/equipments',
    '/reimbursements',
    '/cp/payables',
    '/admin/budget',
    '/financeiro/cr',
    '/rh/employees',
    '/rh/departments',
    '/dp/payroll',
    '/dp/vacation',
    '/dp/timerecords',
    '/knowledge',
    '/admin/service-types',
    '/admin/sla',
    '/admin/checklist-templates',
    '/admin/company-profile',
    '/admin/usuarios',
    '/admin/os-imports',
    '/admin/api-keys',
    '/admin/webhooks',
    '/platform/tenants',
    '/platform/company-profile',
    '/platform/intelligence',
  ],

  // Rotas STALE: existiam na documentação mas o app usa nomes em inglês.
  // Testadas separadamente para confirmar/documentar o comportamento de redirect.
  legacyRoutes: [
    '/os',
    '/agenda',          // manter: pode coincidir
    '/manutencao-preventiva',
    '/clientes',
    '/compras',
    '/fornecedores',
    '/pecas',
    '/equipamentos',
    '/reembolsos',
    '/financeiro/cp',
    '/financeiro/budget',
    '/rh',
    '/dp',
    '/conhecimento',
    '/admin/checklists',
    '/admin',
  ],
};
