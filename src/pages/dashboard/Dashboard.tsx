import { Navigate } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { getWidgetIds } from './dashboardConfig';
import { useDashboardData } from './useDashboardData';
import { ReportsKpiWidget } from './widgets/ReportsKpiWidget';
import { ReimbursementsKpiWidget } from './widgets/ReimbursementsKpiWidget';
import { ProductivityWidget } from './widgets/ProductivityWidget';
import { TicketMedioWidget } from './widgets/TicketMedioWidget';
import { ApprovalRateWidget } from './widgets/ApprovalRateWidget';
import { ReportsBarWidget } from './widgets/ReportsBarWidget';
import { ReimbursementsPieWidget } from './widgets/ReimbursementsPieWidget';
import type { WidgetId } from './widgetRegistry';

export default function Dashboard() {
  const { user } = useAuth();
  const { tenant } = useTenant();

  // Always compute widgetIds (no early return before hooks)
  const widgetIds = (user?.setup_pending ? [] : getWidgetIds(user?.role)) as WidgetId[];
  const data = useDashboardData(user, widgetIds);
  const { isTeamReports, isTeamFinance } = data;

  const has = (id: WidgetId) => widgetIds.includes(id);

  // Usuários da plataforma não têm dados operacionais — ir direto para gestão
  if (tenant?.isPlatform) return <Navigate to="/admin/tenants" replace />;

  if (user?.setup_pending) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Aguardando configuração de acesso pelo administrador.</p>
      </div>
    );
  }

  const showBar = has('reports-bar');
  const showPie = has('reimbursements-pie');

  return (
    <div className="flex flex-col gap-5 h-full w-full max-w-7xl mx-auto pb-6">
      <header className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Olá, {user?.full_name?.split(' ')[0] || 'Profissional'}!
        </h1>
        <p className="text-sm text-muted-foreground">
          {isTeamReports || isTeamFinance
            ? 'Monitoramento em tempo real da equipe e custos.'
            : 'Resumo das suas atividades e solicitações de campo.'}
        </p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
        {has('reports-kpi') && (
          <ReportsKpiWidget isLoading={data.isLoading} count={data.reportsCount} isTeamReports={isTeamReports} />
        )}
        {has('reimbursements-kpi') && (
          <ReimbursementsKpiWidget isLoading={data.isLoading} sum={data.reimbursementSum} isTeamFinance={isTeamFinance} />
        )}
        {has('productivity') && (
          <ProductivityWidget isLoading={data.isLoading} productivity={data.productivity} isTeamReports={isTeamReports} />
        )}
        {has('ticket-medio') && (
          <TicketMedioWidget isLoading={data.isLoading} avgTicket={data.avgTicket} />
        )}
        {has('approval-rate') && (
          <ApprovalRateWidget isLoading={data.isLoading} approvalRate={data.approvalRate} />
        )}
      </div>

      {/* Charts */}
      {(showBar || showPie) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-2 min-h-0">
          {showBar && (
            <div className={showPie ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <ReportsBarWidget isLoading={data.isLoading} barData={data.barData} isTeamReports={isTeamReports} />
            </div>
          )}
          {showPie && (
            <div className={showBar ? '' : 'lg:col-span-3'}>
              <ReimbursementsPieWidget isLoading={data.isLoading} pieData={data.pieData} isTeamFinance={isTeamFinance} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
