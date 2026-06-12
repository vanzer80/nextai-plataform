import type { UserRole } from '@/src/contexts/AuthContext';

/**
 * Matriz de acesso por grupo de rotas — fonte ÚNICA de verdade.
 *
 * Consumida tanto pelos `<RoleGuard>` em App.tsx quanto pelo drill-down dos
 * KPIs do dashboard (widgetRegistry → WIDGET_ROUTES). Mantê-la centralizada
 * impede que o gate de um card divirja do RoleGuard real da rota (clique morto
 * que o RoleGuard rebate para /dashboard).
 *
 * Grupos distintos podem compartilhar o mesmo conjunto de roles hoje, mas
 * permanecem separados para documentar intenção e permitir evolução independente.
 */
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  reports:        ['Master', 'Admin', 'Gestor', 'Supervisor', 'Tecnico'],
  orcamentos:     ['Master', 'Admin', 'Gestor', 'Supervisor'],
  reimbursements: ['Master', 'Admin', 'Gestor', 'Supervisor', 'Financeiro', 'Administrativo', 'Tecnico'],
  materials:      ['Master', 'Admin', 'Gestor', 'Supervisor', 'Financeiro', 'Comprador', 'Administrativo', 'Tecnico'],
  agenda:         ['Master', 'Admin', 'Gestor', 'Supervisor'],
  clients:        ['Master', 'Admin', 'Gestor', 'Supervisor'],
  equipments:     ['Master', 'Admin', 'Gestor', 'Supervisor'],
  inventory:      ['Master', 'Admin', 'Gestor', 'Supervisor'],
  knowledge:      ['Master', 'Admin', 'Gestor', 'Supervisor', 'Tecnico', 'Financeiro', 'Administrativo', 'Comprador'],
  admin:          ['Master', 'Admin', 'Gestor'],
  tenants:        ['Master'],
  rh:             ['Gestor', 'Admin', 'Master'],
  dp:             ['Gestor', 'Admin', 'Master'],
  cp:             ['Financeiro', 'Gestor', 'Admin', 'Master'],
};
