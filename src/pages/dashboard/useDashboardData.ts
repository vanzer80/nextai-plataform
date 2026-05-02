import { useState, useEffect, useCallback, useRef } from 'react';
import { subDays, startOfDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/src/lib/supabase';
import type { AuthUser, UserRole } from '@/src/contexts/AuthContext';
import { WIDGET_QUERY_DEPS, TEAM_REPORTS_ROLES, TEAM_FINANCE_ROLES } from './widgetRegistry';
import type { WidgetId, QueryKey } from './widgetRegistry';

export interface BarEntry { name: string; criados: number; concluidos: number; }
export interface PieEntry { name: string; value: number; fill: string; }

export interface DashboardData {
  isLoading: boolean;
  reportsCount: number;
  reimbursementSum: number;
  productivity: number;
  avgTicket: number;
  approvalRate: number | null;
  barData: BarEntry[];
  pieData: PieEntry[];
  isTeamReports: boolean;
  isTeamFinance: boolean;
}

const PIE_COLORS: Record<string, string> = {
  Transporte: '#3b82f6', Alimentação: '#10b981', Hospedagem: '#f59e0b', Outros: '#64748b',
};

function neededFor(widgetIds: WidgetId[]): Set<QueryKey> {
  return new Set(widgetIds.flatMap(id => WIDGET_QUERY_DEPS[id]));
}

export function useDashboardData(
  user: AuthUser | null | undefined,
  widgetIds: WidgetId[],
): DashboardData {
  const widgetKey = widgetIds.join(',');
  const isTeamReports = TEAM_REPORTS_ROLES.includes(user?.role as UserRole);
  const isTeamFinance = TEAM_FINANCE_ROLES.includes(user?.role as UserRole);

  const [isLoading, setIsLoading] = useState(true);
  const [reportsCount, setReportsCount] = useState(0);
  const [reimbursementSum, setReimbursementSum] = useState(0);
  const [productivity, setProductivity] = useState(0);
  const [avgTicket, setAvgTicket] = useState(0);
  const [approvalRate, setApprovalRate] = useState<number | null>(null);
  const [barData, setBarData] = useState<BarEntry[]>([]);
  const [pieData, setPieData] = useState<PieEntry[]>([]);

  const fetchRef = useRef<() => void>(() => {});

  const fetchData = useCallback(async () => {
    if (!user?.id || widgetKey === '') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const nq = neededFor(widgetIds);
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const startDate = subDays(startOfDay(new Date()), 6).toISOString();

      const promises: Promise<any>[] = [];
      const keys: QueryKey[] = [];

      if (nq.has('repQuery')) {
        let q = supabase.from('service_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending_review');
        if (!isTeamReports) q = q.eq('technician_id', user.id);
        promises.push(q); keys.push('repQuery');
      }
      if (nq.has('rembQuery')) {
        let q = supabase.from('reimbursements').select('amount, status');
        if (!isTeamFinance) q = q.eq('user_id', user.id).eq('status', 'Aprovado');
        else q = q.eq('status', 'Pendente');
        promises.push(q); keys.push('rembQuery');
      }
      if (nq.has('statsQuery')) {
        let q = supabase.from('reimbursements').select('amount, status').gte('created_at', thirtyDaysAgo);
        if (!isTeamFinance) q = q.eq('user_id', user.id);
        promises.push(q); keys.push('statsQuery');
      }
      if (nq.has('barQry')) {
        let q = supabase.from('service_reports').select('created_at, status').gte('created_at', startDate).limit(500);
        if (!isTeamReports) q = q.eq('technician_id', user.id);
        promises.push(q); keys.push('barQry');
      }
      if (nq.has('pieQry')) {
        let q = supabase.from('reimbursements').select('category, amount').gte('created_at', thirtyDaysAgo).limit(500);
        if (!isTeamFinance) q = q.eq('user_id', user.id);
        promises.push(q); keys.push('pieQry');
      }

      const results = await Promise.all(promises);
      const res = Object.fromEntries(keys.map((k, i) => [k, results[i]])) as Record<QueryKey, any>;

      if (res.repQuery) {
        if (res.repQuery.error) console.warn('repQuery', res.repQuery.error);
        setReportsCount(res.repQuery.count ?? 0);
      }

      if (res.rembQuery) {
        if (res.rembQuery.error) console.warn('rembQuery', res.rembQuery.error);
        const data: { amount: number }[] = res.rembQuery.data ?? [];
        setReimbursementSum(data.reduce((s, r) => s + (Number(r.amount) || 0), 0));
      }

      if (res.statsQuery) {
        const data: { amount: number; status: string }[] = res.statsQuery.data ?? [];
        const approved = data.filter(r => r.status === 'Aprovado');
        const rejected = data.filter(r => r.status === 'Rejeitado');
        setAvgTicket(approved.length > 0 ? approved.reduce((s, r) => s + (Number(r.amount) || 0), 0) / approved.length : 0);
        const processed = approved.length + rejected.length;
        setApprovalRate(processed > 0 ? Math.round((approved.length / processed) * 100) : null);
      }

      if (res.barQry) {
        if (res.barQry.error) console.warn('barQry', res.barQry.error);
        const grouped: Record<string, { criados: number; concluidos: number }> = {};
        for (let i = 6; i >= 0; i--) {
          grouped[format(subDays(new Date(), i), 'eee', { locale: ptBR })] = { criados: 0, concluidos: 0 };
        }
        (res.barQry.data ?? []).forEach((r: { created_at: string; status: string }) => {
          const d = format(new Date(r.created_at), 'eee', { locale: ptBR });
          if (grouped[d]) { grouped[d].criados++; if (r.status === 'approved') grouped[d].concluidos++; }
        });
        const formatted = Object.keys(grouped).map(n => ({
          name: n.charAt(0).toUpperCase() + n.slice(1),
          ...grouped[n],
        }));
        setBarData(formatted);
        const total = formatted.reduce((s, r) => s + r.criados, 0);
        setProductivity(total > 0 ? Math.min(100, Math.round((total / 10) * 100)) : 0);
      }

      if (res.pieQry) {
        if (res.pieQry.error) console.warn('pieQry', res.pieQry.error);
        const cats: Record<string, number> = { Transporte: 0, Alimentação: 0, Hospedagem: 0, Outros: 0 };
        (res.pieQry.data ?? []).forEach((p: { category: string; amount: number }) => {
          const k = cats[p.category] !== undefined ? p.category : 'Outros';
          cats[k] += Number(p.amount) || 0;
        });
        const formatted = Object.keys(cats)
          .filter(k => cats[k] > 0)
          .map(k => ({ name: k, value: cats[k], fill: PIE_COLORS[k] }));
        setPieData(formatted.length > 0 ? formatted : [{ name: 'Sem Despesas (0)', value: 1, fill: '#e2e8f0' }]);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, isTeamReports, isTeamFinance, widgetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchRef.current = fetchData; }, [fetchData]);
  useEffect(() => { if (user?.id) fetchData(); }, [fetchData]);

  // Realtime — only subscribe to tables needed for visible widgets
  useEffect(() => {
    if (!user?.id || widgetKey === '') return;

    const nq = neededFor(widgetIds);
    const needsReports = nq.has('repQuery') || nq.has('barQry');
    const needsRemb = nq.has('rembQuery') || nq.has('statsQuery') || nq.has('pieQry');

    const ch = supabase.channel(`dash_rt_${user.id}`);

    if (needsRemb) {
      const rembCfg: { schema: 'public'; table: 'reimbursements'; filter?: string } =
        { schema: 'public', table: 'reimbursements' };
      if (!isTeamFinance) rembCfg.filter = `user_id=eq.${user.id}`;
      ch.on('postgres_changes', { event: 'INSERT', ...rembCfg }, () => fetchRef.current())
        .on('postgres_changes', { event: 'UPDATE', ...rembCfg }, () => fetchRef.current());
    }

    if (needsReports) {
      const repCfg: { schema: 'public'; table: 'service_reports'; filter?: string } =
        { schema: 'public', table: 'service_reports' };
      if (!isTeamReports) repCfg.filter = `technician_id=eq.${user.id}`;
      ch.on('postgres_changes', { event: '*', ...repCfg }, () => fetchRef.current());
    }

    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, isTeamReports, isTeamFinance, widgetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isLoading, reportsCount, reimbursementSum, productivity, avgTicket, approvalRate, barData, pieData, isTeamReports, isTeamFinance };
}
