import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { TenantProvider } from '@/src/contexts/TenantContext';
import { ProtectedRoute, RoleGuard } from '@/src/components/auth/ProtectedRoute';
import AppLayout from '@/src/components/layout/AppLayout';
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
const ClientsList        = lazy(() => import('@/src/pages/clients/ClientsList'));
const MaterialsList      = lazy(() => import('@/src/pages/materials/MaterialsList'));
const NewMaterialRequest = lazy(() => import('@/src/pages/materials/NewMaterialRequest'));
const OrcamentosList     = lazy(() => import('@/src/pages/orcamentos/OrcamentosList'));
const NovoOrcamento      = lazy(() => import('@/src/pages/orcamentos/NovoOrcamento'));
const OrcamentoDetail    = lazy(() => import('@/src/pages/orcamentos/OrcamentoDetail'));

export default function App() {
  return (
    <AuthProvider>
      <TenantProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              
              <Route path="/reports" element={<ReportsList />} />
              <Route path="/reports/new" element={<NewReport />} />
              <Route path="/reports/:id" element={<ReportDetail />} />
              
              <Route path="/reimbursements" element={<ReimbursementsList />} />
              <Route path="/reimbursements/new" element={<NewReimbursement />} />
              <Route path="/reimbursements/:id/edit" element={<NewReimbursement />} />

              {/* Orçamentos - qualquer usuário autenticado */}
              <Route path="/orcamentos" element={<OrcamentosList />} />
              <Route path="/orcamentos/novo" element={<NovoOrcamento />} />
              <Route path="/orcamentos/:id/editar" element={<NovoOrcamento />} />
              <Route path="/orcamentos/:id" element={<OrcamentoDetail />} />

              {/* Compras - qualquer usuário autenticado */}
              <Route path="/materials" element={<MaterialsList />} />
              <Route path="/materials/new" element={<NewMaterialRequest />} />
              <Route path="/materials/:id/edit" element={<NewMaterialRequest />} />

              {/* Clientes - Gestor, Admin, Master, Supervisor */}
              <Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor', 'Supervisor']} />}>
                <Route path="/clients" element={<ClientsList />} />
              </Route>

              {/* Admin Area */}
              <Route element={<RoleGuard allowedRoles={['Master', 'Admin', 'Gestor']} />}>
                <Route path="/admin/usuarios" element={<UserManagement />} />
                <Route path="/admin/checklist-templates" element={<ChecklistTemplates />} />
                <Route path="/admin/checklist-templates/new" element={<TemplateEditor />} />
                <Route path="/admin/checklist-templates/:id/edit" element={<TemplateEditor />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </TenantProvider>
      <Toaster />
    </AuthProvider>
  );
}
