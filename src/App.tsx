import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { TenantProvider } from '@/src/contexts/TenantContext';
import { OnboardingProvider } from '@/src/onboarding/OnboardingContext';
import { ProtectedRoute, RoleGuard, PlatformGuard } from '@/src/components/auth/ProtectedRoute';
import AppLayout from '@/src/components/layout/AppLayout';
import PlatformLayout from '@/src/components/layout/PlatformLayout';
import Login from '@/src/pages/auth/Login';
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
const UserManagement     = lazy(() => import('@/src/pages/admin/UserManagement'));
const TenantManagement   = lazy(() => import('@/src/pages/admin/TenantManagement'));
const ServiceTypes       = lazy(() => import('@/src/pages/admin/ServiceTypes'));
const ClientsList           = lazy(() => import('@/src/pages/clients/ClientsList'));
const EquipmentManagement   = lazy(() => import('@/src/pages/equipments/EquipmentManagement'));
const MaterialsList      = lazy(() => import('@/src/pages/materials/MaterialsList'));
const NewMaterialRequest = lazy(() => import('@/src/pages/materials/NewMaterialRequest'));
const OrcamentosList     = lazy(() => import('@/src/pages/orcamentos/OrcamentosList'));
const NovoOrcamento      = lazy(() => import('@/src/pages/orcamentos/NovoOrcamento'));
const OrcamentoDetail    = lazy(() => import('@/src/pages/orcamentos/OrcamentoDetail'));

// Platform admin pages (SuperMaster only)
const PlatformTenants  = lazy(() => import('@/src/pages/platform/PlatformTenants'));
const PlatformUsers    = lazy(() => import('@/src/pages/platform/PlatformUsers'));
const PlatformSettings = lazy(() => import('@/src/pages/platform/PlatformSettings'));

// Redirects SuperMaster to /platform/tenants, regular users to /dashboard
function SmartRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  const isSuperMaster = user?.role === 'Master' && user?.isPlatform === true;
  return <Navigate to={isSuperMaster ? '/platform/tenants' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <TenantProvider>
      <BrowserRouter>
        <OnboardingProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            {/* Root redirect: fora do AppLayout para evitar flash do menu operacional */}
            <Route path="/" element={<SmartRedirect />} />

            {/* Platform admin (SuperMaster only) */}
            <Route element={<PlatformGuard />}>
              <Route element={<PlatformLayout />}>
                <Route path="/platform" element={<Navigate to="/platform/tenants" replace />} />
                <Route path="/platform/tenants" element={<PlatformTenants />} />
                <Route path="/platform/users" element={<PlatformUsers />} />
                <Route path="/platform/settings" element={<PlatformSettings />} />
              </Route>
            </Route>

            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              
              {/* OS — Técnico, Supervisor, Gestor, Admin, Master */}
              <Route element={<RoleGuard allowedRoles={['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master']} />}>
                <Route path="/reports" element={<ReportsList />} />
                <Route path="/reports/new" element={<NewReport />} />
                <Route path="/reports/:id" element={<ReportDetail />} />
              </Route>

              {/* Orçamentos — Supervisor, Gestor, Admin, Master */}
              <Route element={<RoleGuard allowedRoles={['Supervisor', 'Gestor', 'Admin', 'Master']} />}>
                <Route path="/orcamentos" element={<OrcamentosList />} />
                <Route path="/orcamentos/novo" element={<NovoOrcamento />} />
                <Route path="/orcamentos/:id/editar" element={<NovoOrcamento />} />
                <Route path="/orcamentos/:id" element={<OrcamentoDetail />} />
              </Route>

              {/* Reembolsos — Técnico, Administrativo, Financeiro, Supervisor, Gestor, Admin, Master */}
              <Route element={<RoleGuard allowedRoles={['Tecnico', 'Administrativo', 'Financeiro', 'Supervisor', 'Gestor', 'Admin', 'Master']} />}>
                <Route path="/reimbursements" element={<ReimbursementsList />} />
                <Route path="/reimbursements/new" element={<NewReimbursement />} />
                <Route path="/reimbursements/:id/edit" element={<NewReimbursement />} />
              </Route>

              {/* Compras — Técnico, Administrativo, Financeiro, Comprador, Supervisor, Gestor, Admin, Master */}
              <Route element={<RoleGuard allowedRoles={['Tecnico', 'Administrativo', 'Financeiro', 'Comprador', 'Supervisor', 'Gestor', 'Admin', 'Master']} />}>
                <Route path="/materials" element={<MaterialsList />} />
                <Route path="/materials/new" element={<NewMaterialRequest />} />
                <Route path="/materials/:id/edit" element={<NewMaterialRequest />} />
              </Route>

              {/* Clientes - Gestor, Admin, Master, Supervisor */}
              <Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor', 'Supervisor']} />}>
                <Route path="/clients" element={<ClientsList />} />
              </Route>

              {/* Equipamentos - Gestor, Admin, Master, Supervisor */}
              <Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor', 'Supervisor']} />}>
                <Route path="/equipments" element={<EquipmentManagement />} />
              </Route>

              {/* Admin Area */}
              <Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor']} />}>
                <Route path="/admin/usuarios" element={<UserManagement />} />
                <Route path="/admin/checklist-templates" element={<ChecklistTemplates />} />
                <Route path="/admin/checklist-templates/new" element={<TemplateEditor />} />
                <Route path="/admin/checklist-templates/:id/edit" element={<TemplateEditor />} />
                <Route path="/admin/service-types" element={<ServiceTypes />} />
              </Route>

              {/* Master-only: tenant provisioning */}
              <Route element={<RoleGuard allowedRoles={['Master']} />}>
                <Route path="/admin/tenants" element={<TenantManagement />} />
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
