import { layoutTour }       from './layout.tour';
import { dashboardTour }    from './dashboard.tour';
import { osListTour }       from './os-list.tour';
import { osWizardTour }     from './os-wizard.tour';
import { osDetailTour }     from './os-detail.tour';
import { equipamentosTour } from './equipamentos.tour';
import { clientesTour }     from './clientes.tour';
import { orcamentosTour }   from './orcamentos.tour';
import { reembolsosTour }   from './reembolsos.tour';
import { materiaisTour }    from './materiais.tour';
import { adminTour }        from './admin.tour';
import { platformTour }     from './platform.tour';

export type Role =
  | 'Tecnico' | 'Administrativo' | 'Supervisor' | 'Gestor'
  | 'Financeiro' | 'Comprador' | 'Admin' | 'Master' | 'SuperMaster';

export interface TourStep {
  /** CSS selector using data-onboarding attribute. Ex: [data-onboarding="nav-os"] */
  element: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
    align?: 'start' | 'center' | 'end';
  };
  /** Roles that see this step. Empty array means all roles. */
  roles: Role[];
  /**
   * Route that must be active for the element to exist in the DOM.
   * The driver navigates to this route before showing the step.
   * undefined = element is always visible (sidebar, header).
   */
  route?: string;
}

export interface TourModule {
  id: string;
  description: string;
  steps: TourStep[];
}

/**
 * HOW TO ADD ONBOARDING FOR A NEW FEATURE:
 * 1. Add data-onboarding="module-element" to the target element in the new component
 * 2. Create src/onboarding/tours/my-feature.tour.ts exporting a TourModule
 * 3. Import it below and add to TOUR_MODULES in the correct position
 * 4. Done — the system filters by role and includes the step automatically.
 *
 * Naming convention for data-onboarding values: [module]-[element]
 * Examples: "os-nova", "eq-preventiva", "cli-cnpj", "admin-templates"
 */
export const TOUR_MODULES: TourModule[] = [
  layoutTour,
  dashboardTour,
  osListTour,
  osWizardTour,
  osDetailTour,
  equipamentosTour,
  clientesTour,
  orcamentosTour,
  reembolsosTour,
  materiaisTour,
  adminTour,
  platformTour,
];

export function getTourSteps(role: Role): TourStep[] {
  return TOUR_MODULES
    .flatMap(m => m.steps)
    .filter(s => s.roles.length === 0 || s.roles.includes(role));
}
