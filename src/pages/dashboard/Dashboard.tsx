import { useState, Fragment } from 'react';
import { Navigate } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { useDashboardData } from './useDashboardData';
import { useDashboardPrefs } from './useDashboardPrefs';
import { DashboardCustomizer } from './DashboardCustomizer';
import { WIDGET_COL_SPAN, PERIOD_LABELS } from './widgetRegistry';
import type { WidgetId, DashboardPeriod } from './widgetRegistry';

import { ReportsKpiWidget } from './widgets/ReportsKpiWidget';
import { ReimbursementsKpiWidget } from './widgets/ReimbursementsKpiWidget';
import { ProductivityWidget } from './widgets/ProductivityWidget';
import { TicketMedioWidget } from './widgets/TicketMedioWidget';
import { ApprovalRateWidget } from './widgets/ApprovalRateWidget';
import { ReturnRateWidget } from './widgets/ReturnRateWidget';
import { SlaWidget } from './widgets/SlaWidget';
import { CsatWidget } from './widgets/CsatWidget';
import { ReportsBarWidget } from './widgets/ReportsBarWidget';
import { ReimbursementsPieWidget } from './widgets/ReimbursementsPieWidget';
import { BudgetBurnWidget } from './widgets/BudgetBurnWidget';
import { HrSummaryWidget } from './widgets/HrSummaryWidget';
import { CpqKpiWidget } from './widgets/CpqKpiWidget';
import { AgendaHojeWidget } from './widgets/AgendaHojeWidget';
import { EstoqueCriticoWidget } from './widgets/EstoqueCriticoWidget';

const PERIODS: DashboardPeriod[] = ['7d', '30d', '90d', '12m'];

export default function Dashboard() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const [customizerOpen, setCustomizerOpen] = useState(false);

  const prefs = useDashboardPrefs(user);

  // Só inicia o fetch de dados após as prefs carregarem — evita double fetch
  const dataWidgets = (user?.setup_pending || prefs.isLoading) ? [] : prefs.activeWidgets;
  const data = useDashboardData(user, dataWidgets, period);

  // isLoading unificado: prefs + dados
  const effectiveIsLoading = prefs.isLoading || data.isLoading;

  if (tenant?.isPlatform) return <Navigate to="/admin/tenants" replace />;

  if (user?.setup_pending) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Aguardando configuração de acesso pelo administrador.</p>
      </div>
    );
  }

  const activeWidgets = prefs.activeWidgets;
  const kpiWidgets  = activeWidgets.filter(id => WIDGET_COL_SPAN.get(id) === 1);
  const fullWidgets = activeWidgets.filter(id => WIDGET_COL_SPAN.get(id) === 4);
  const showBar = activeWidgets.includes('reports-bar');
  const showPie = activeWidgets.includes('reimbursements-pie');
  const hasCharts = showBar || showPie;

  return (
    <div className="flex flex-col gap-5 h-full w-full pb-6 animate-in fade-in duration-300">

      {/* Header */}
      <header className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Olá, {user?.full_name?.split(' ')[0] || 'Profissional'}!
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.isTeamReports || data.isTeamFinance
              ? 'Monitoramento em tempo real da equipe e operações.'
              : 'Resumo das suas atividades e solicitações de campo.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1 bg-muted rounded-lg p-1">
            {PERIODS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  period === p
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCustomizerOpen(true)}
            className="gap-1.5"
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Personalizar</span>
          </Button>
        </div>
      </header>

      {/* Seletor de período — mobile */}
      <div className="flex sm:hidden items-center gap-1 bg-muted rounded-lg p-1 self-start">
        {PERIODS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
              period === p
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* KPI Cards — skeleton durante loading de prefs */}
      {prefs.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : kpiWidgets.length > 0 ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0"
          data-onboarding="dashboard-kpis"
        >
          {kpiWidgets.map(id => (
            <Fragment key={id}>
              <WidgetRenderer id={id} data={data} isLoading={effectiveIsLoading} />
            </Fragment>
          ))}
        </div>
      ) : null}

      {/* Seções full-width (hr-summary e futuras) */}
      {!prefs.isLoading && fullWidgets.map(id => (
        <Fragment key={id}>
          <WidgetRenderer id={id} data={data} isLoading={effectiveIsLoading} />
        </Fragment>
      ))}

      {/* Charts */}
      {!prefs.isLoading && hasCharts && (
        <div
          className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-2 min-h-0"
          data-onboarding="dashboard-grafico"
        >
          {showBar && (
            <div className={showPie ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <ReportsBarWidget isLoading={effectiveIsLoading} barData={data.barData} isTeamReports={data.isTeamReports} />
            </div>
          )}
          {showPie && (
            <div className={showBar ? '' : 'lg:col-span-3'}>
              <ReimbursementsPieWidget isLoading={effectiveIsLoading} pieData={data.pieData} isTeamFinance={data.isTeamFinance} />
            </div>
          )}
        </div>
      )}

      <DashboardCustomizer
        open={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        eligibleWidgets={prefs.eligibleWidgets}
        activeWidgets={prefs.activeWidgets}
        isSaving={prefs.isSaving}
        onSave={prefs.savePrefs}
        onReset={prefs.resetPrefs}
      />
    </div>
  );
}

type WidgetData = ReturnType<typeof useDashboardData>;

function WidgetRenderer({ id, data, isLoading }: { id: WidgetId; data: WidgetData; isLoading: boolean }) {
  switch (id) {
    case 'reports-kpi':
      return <ReportsKpiWidget isLoading={isLoading} count={data.reportsCount} isTeamReports={data.isTeamReports} />;
    case 'reimbursements-kpi':
      return <ReimbursementsKpiWidget isLoading={isLoading} sum={data.reimbursementSum} isTeamFinance={data.isTeamFinance} />;
    case 'productivity':
      return <ProductivityWidget isLoading={isLoading} productivity={data.productivity} isTeamReports={data.isTeamReports} />;
    case 'ticket-medio':
      return <TicketMedioWidget isLoading={isLoading} avgTicket={data.avgTicket} />;
    case 'approval-rate':
      return <ApprovalRateWidget isLoading={isLoading} approvalRate={data.approvalRate} />;
    case 'return-rate':
      return (
        <div data-onboarding="dashboard-taxa-retorno">
          <ReturnRateWidget isLoading={isLoading} returnRate={data.returnRate} />
        </div>
      );
    case 'sla-rate':
      return <SlaWidget isLoading={isLoading} slaRate={data.slaRate} />;
    case 'csat-avg':
      return <CsatWidget isLoading={isLoading} csatAvg={data.csatAvg} responseCount={data.csatResponseCount} />;
    case 'cpq-kpi':
      return <CpqKpiWidget isLoading={isLoading} kpis={data.cpqKpis} />;
    case 'agenda-hoje':
      return <AgendaHojeWidget isLoading={isLoading} kpis={data.agendaKpis} />;
    case 'estoque-critico':
      return <EstoqueCriticoWidget isLoading={isLoading} kpis={data.estoqueKpis} />;
    case 'budget-burn':
      return <BudgetBurnWidget isLoading={isLoading} />;
    case 'hr-summary':
      return <HrSummaryWidget />;
    default:
      return null;
  }
}
