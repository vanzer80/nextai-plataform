import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { TenantProvider } from '@/src/contexts/TenantContext';
import { OnboardingProvider } from '@/src/onboarding/OnboardingContext';
import { ProtectedRoute, RoleGuard, PlatformGuard } from '@/src/components/auth/ProtectedRoute';
import AppLayout from '@/src/components/layout/AppLayout';
import PlatformLayout from '@/src/components/layout/PlatformLayout';
import ClientPortalLayout from '@/src/components/layout/ClientPortalLayout';
import Login from '@/src/pages/auth/Login';
import CsatPage from '@/src/pages/csat/CsatPage';
const PrivacyPolicy = lazy(() => import('@/src/pages/PrivacyPolicy'));
import { Toaster } from '@/components/ui/sonner';

// All routes are lazy — only the shell (Login + AppLayout) is in the initial bundle
const Dashboard          = lazy(() => import('@/src/pages/dashboard/Dashboard'));
const ReportsList        = lazy(() => import('@/src/pages/reports/ReportsList'));
const NewReport          = lazy(() => import('@/src/pages/reports/NewReport'));
const ReportDetail       = lazy(() => import('@/src/pages/reports/ReportDetail'));
const ChecklistTemplates = lazy(() => import('@/src/pages/reports/admin/ChecklistTemplates'));
const TemplateEditor     = lazy(() => import('@/src/pages/reports/admin/TemplateEditor'));
const ReimbursementsList = lazy(() => import('@/src/pages/reimbursements/ReimbursementsList'));
const NewReimbursement   = lazy(() => import('@/src/pages/reimbursements/NewReimbursement'));
const ExpenseReports     = lazy(() => import('@/src/pages/reimbursements/ExpenseReports'));
const UserManagement     = lazy(() => import('@/src/pages/admin/UserManagement'));
const TenantManagement   = lazy(() => import('@/src/pages/admin/TenantManagement'));
const CompanyProfile     = lazy(() => import('@/src/pages/admin/CompanyProfile'));
const ServiceTypes       = lazy(() => import('@/src/pages/admin/ServiceTypes'));
const ClientsList           = lazy(() => import('@/src/pages/clients/ClientsList'));
const EquipmentManagement   = lazy(() => import('@/src/pages/equipments/EquipmentManagement'));
const SupplierManagement    = lazy(() => import('@/src/pages/suppliers/SupplierManagement'));
const PartsManagement       = lazy(() => import('@/src/pages/parts/PartsManagement'));
const SlaManagement         = lazy(() => import('@/src/pages/admin/SlaManagement'));
const MaterialsList      = lazy(() => import('@/src/pages/materials/MaterialsList'));
const NewMaterialRequest = lazy(() => import('@/src/pages/materials/NewMaterialRequest'));
const OrcamentosList     = lazy(() => import('@/src/pages/orcamentos/OrcamentosList'));
const NovoOrcamento      = lazy(() => import('@/src/pages/orcamentos/NovoOrcamento'));
const OrcamentoDetail    = lazy(() => import('@/src/pages/orcamentos/OrcamentoDetail'));
const ClientPortal       = lazy(() => import('@/src/pages/portal/ClientPortal'));
const AgendaPage         = lazy(() => import('@/src/pages/agenda/AgendaPage'));
const KnowledgeBase      = lazy(() => import('@/src/pages/knowledge/KnowledgeBase'));
const BudgetManagement      = lazy(() => import('@/src/pages/admin/BudgetManagement'));
const MaintenancePlans      = lazy(() => import('@/src/pages/admin/MaintenancePlans'));

// RH — Recursos Humanos
const EmployeesList      = lazy(() => import('@/src/pages/rh/EmployeesList'));
const EmployeeForm       = lazy(() => import('@/src/pages/rh/EmployeeForm'));
const DepartmentsList    = lazy(() => import('@/src/pages/rh/DepartmentsList'));

// DP — Departamento Pessoal
const PayrollList        = lazy(() => import('@/src/pages/dp/PayrollList'));
const PayrollDetail      = lazy(() => import('@/src/pages/dp/PayrollDetail'));
const VacationSchedule   = lazy(() => import('@/src/pages/dp/VacationSchedule'));
const TimeRecordsPage    = lazy(() => import('@/src/pages/dp/TimeRecordsPage'));

// CP — Contas a Pagar
const PayablesList       = lazy(() => import('@/src/pages/cp/PayablesList'));
const PayableForm        = lazy(() => import('@/src/pages/cp/PayableForm'));
const PayableDetail      = lazy(() => import('@/src/pages/cp/PayableDetail'));

// Platform admin pages (SuperMaster only)
const PlatformTenants       = lazy(() => import('@/src/pages/platform/PlatformTenants'));
const PlatformUsers         = lazy(() => import('@/src/pages/platform/PlatformUsers'));
const PlatformSettings      = lazy(() => import('@/src/pages/platform/PlatformSettings'));
const PlatformIntelligence  = lazy(() => import('@/src/pages/platform/PlatformIntelligence'));

// Redirects SuperMaster → /platform/tenants, Cliente → /portal, others → /dashboard
function SmartRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  const isSuperMaster = user?.role === 'Master' && user?.isPlatform === true;
  if (isSuperMaster) return <Navigate to="/platform/tenants" replace />;
  if (user?.role === 'Cliente') return <Navigate to="/portal" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <TenantProvider>
      <BrowserRouter>
        <OnboardingProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Public pages — no auth required */}
          <Route path="/csat/:token" element={<CsatPage />} />
          <Route path="/privacy" element={<Suspense fallback={null}><PrivacyPolicy /></Suspense>} />
          
          <Route element={<ProtectedRoute />}>
            {/* Root redirect: fora do AppLayout para evitar flash do menu operacional */}
            <Route path="/" element={<SmartRedirect />} />

            {/* Cliente portal (read-only OS view for role='Cliente') */}
            <Route element={<RoleGuard allowedRoles={['Cliente']} />}>
              <Route element={<ClientPortalLayout />}>
                <Route path="/portal" element={<ClientPortal />} />
              </Route>
            </Route>

            {/* Platform admin (SuperMaster only) */}
            <Route element={<PlatformGuard />}>
              <Route element={<PlatformLayout />}>
                <Route path="/platform" element={<Navigate to="/platform/tenants" replace />} />
                <Route path="/platform/tenants"      element={<PlatformTenants />} />
                <Route path="/platform/users"        element={<PlatformUsers />} />
                <Route path="/platform/intelligence" element={<PlatformIntelligence />} />
                <Route path="/platform/settings"     element={<PlatformSettings />} />
              </Route>
            </Route>

            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              
              {/* OS — Master, Admin, Gestor, Supervisor, Técnico */}
              <Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor', 'Supervisor', 'Tecnico']} />}>
                <Route path="/reports" element={<ReportsList />} />
                <Route path="/reports/new" element={<NewReport />} />
                <Route path="/reports/:id" element={<ReportDetail />} />
              </Route>

              {/* Orçamentos — Master, Admin, Gestor, Supervisor */}
              <Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor', 'Supervisor']} />}>
                <Route path="/orcamentos" element={<OrcamentosList />} />
                <Route path="/orcamentos/novo" element={<NovoOrcamento />} />
                <Route path="/orcamentos/:id/editar" element={<NovoOrcamento />} />
                <Route path="/orcamentos/:id" element={<OrcamentoDetail />} />
              </Route>

              {/* Reembolsos — Master, Admin, Gestor, Supervisor, Financeiro, Administrativo, Técnico */}
              <Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor', 'Supervisor', 'Financeiro', 'Administrativo', 'Tecnico']} />}>
                <Route path="/reimbursements" element={<ReimbursementsList />} />
                <Route path="/reimbursements/new" element={<NewReimbursement />} />
                <Route path="/reimbursements/:id/edit" element={<NewReimbursement />} />
                <Route path="/reimbursements/expense-reports" element={<ExpenseReports />} />
              </Route>

              {/* Compras — Master, Admin, Gestor, Supervisor, Financeiro, Comprador, Administrativo, Técnico */}
              <Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor', 'Supervisor', 'Financeiro', 'Comprador', 'Administrativo', 'Tecnico']} />}>
                <Route path="/materials" element={<MaterialsList />} />
                <Route path="/materials/new" element={<NewMaterialRequest />} />
                <Route path="/materials/:id/edit" element={<NewMaterialRequest />} />
              </Route>

              {/* Agenda/Dispatch — Master, Admin, Gestor, Supervisor */}
              <Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor', 'Supervisor']} />}>
                <Route path="/agenda" element={<AgendaPage />} />
              </Route>

              {/* Clientes — Master, Admin, Gestor, Supervisor */}
              <Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor', 'Supervisor']} />}>
                <Route path="/clients" element={<ClientsList />} />
              </Route>

              {/* Equipamentos — Master, Admin, Gestor, Supervisor */}
              <Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor', 'Supervisor']} />}>
                <Route path="/equipments" element={<EquipmentManagement />} />
              </Route>

              {/* Fornecedores e Peças — Master, Admin, Gestor, Supervisor */}
              <Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor', 'Supervisor']} />}>
                <Route path="/suppliers" element={<SupplierManagement />} />
                <Route path="/parts" element={<PartsManagement />} />
              </Route>

              {/* Base de Conhecimento — todos os perfis operacionais */}
              <Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor', 'Supervisor', 'Tecnico', 'Financeiro', 'Administrativo', 'Comprador']} />}>
                <Route path="/knowledge" element={<KnowledgeBase />} />
              </Route>

              {/* Admin Area */}
              <Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor']} />}>
                <Route path="/admin/usuarios" element={<UserManagement />} />
                <Route path="/admin/checklist-templates" element={<ChecklistTemplates />} />
                <Route path="/admin/checklist-templates/new" element={<TemplateEditor />} />
                <Route path="/admin/checklist-templates/:id/edit" element={<TemplateEditor />} />
                <Route path="/admin/service-types" element={<ServiceTypes />} />
                <Route path="/admin/sla" element={<SlaManagement />} />
                <Route path="/admin/budget" element={<BudgetManagement />} />
                <Route path="/admin/maintenance-plans" element={<MaintenancePlans />} />
                <Route path="/admin/company-profile" element={<CompanyProfile />} />
              </Route>

              {/* Master-only: tenant provisioning */}
              <Route element={<RoleGuard allowedRoles={['Master']} />}>
                <Route path="/admin/tenants" element={<TenantManagement />} />
              </Route>

              {/* RH — Recursos Humanos */}
              <Route element={<RoleGuard allowedRoles={['Gestor', 'Admin', 'Master']} />}>
                <Route path="/rh"                        element={<Navigate to="/rh/employees" replace />} />
                <Route path="/rh/employees"              element={<EmployeesList />} />
                <Route path="/rh/employees/new"          element={<EmployeeForm />} />
                <Route path="/rh/employees/:id/edit"     element={<EmployeeForm />} />
                <Route path="/rh/departments"            element={<DepartmentsList />} />
              </Route>

              {/* DP — Departamento Pessoal */}
              <Route element={<RoleGuard allowedRoles={['Gestor', 'Admin', 'Master']} />}>
                <Route path="/dp"                        element={<Navigate to="/dp/payroll" replace />} />
                <Route path="/dp/payroll"                element={<PayrollList />} />
                <Route path="/dp/payroll/:id"            element={<PayrollDetail />} />
                <Route path="/dp/vacation"               element={<VacationSchedule />} />
                <Route path="/dp/timerecords"            element={<TimeRecordsPage />} />
              </Route>

              {/* CP — Contas a Pagar */}
              <Route element={<RoleGuard allowedRoles={['Financeiro', 'Gestor', 'Admin', 'Master']} />}>
                <Route path="/cp"                        element={<Navigate to="/cp/payables" replace />} />
                <Route path="/cp/payables"               element={<PayablesList />} />
                <Route path="/cp/new"                    element={<PayableForm />} />
                <Route path="/cp/:id"                    element={<PayableDetail />} />
                <Route path="/cp/:id/edit"               element={<PayableForm />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </OnboardingProvider>
      </BrowserRouter>
      </TenantProvider>
      <Toaster />
    </AuthProvider>
  );
}
