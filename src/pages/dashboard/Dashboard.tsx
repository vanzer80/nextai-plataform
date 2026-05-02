import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { 
  TrendingUp, 
  ClipboardList, 
  Receipt, 
  Clock, 
  ArrowRight,
  DollarSign,
  Briefcase,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, 
  PieChart, Pie, Cell 
} from 'recharts';
import { startOfDay, subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isManager = ['Gestor', 'Admin', 'Financeiro', 'Supervisor', 'Master'].includes(user?.role ?? '');
  
  const [isLoading, setIsLoading] = useState(true);
  
  // States for DB data
  const [reportsCount, setReportsCount] = useState(0);
  const [reimbursementSum, setReimbursementSum] = useState(0);
  const [productivity, setProductivity] = useState(0);
  const [avgTicket, setAvgTicket] = useState(0);
  const [approvalRate, setApprovalRate] = useState<number | null>(null);

  const [barData, setBarData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);

  const fetchDashboardDataRef = useRef<() => void>(() => {});

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);

      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const startDate = subDays(startOfDay(new Date()), 6);

      // Montar as 5 queries independentes
      let repQuery = supabase
        .from('service_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_review');
      if (!isManager) repQuery = repQuery.eq('technician_id', user?.id);

      let rembQuery = supabase.from('reimbursements').select('amount, status');
      if (!isManager) {
        rembQuery = rembQuery.eq('user_id', user?.id).eq('status', 'Aprovado');
      } else {
        rembQuery = rembQuery.eq('status', 'Pendente');
      }

      const statsQuery = supabase
        .from('reimbursements')
        .select('amount, status')
        .gte('created_at', thirtyDaysAgo);

      let barQry = supabase
        .from('service_reports')
        .select('created_at, status')
        .gte('created_at', startDate.toISOString())
        .limit(500);
      if (!isManager) barQry = barQry.eq('technician_id', user?.id);

      let pieQry = supabase
        .from('reimbursements')
        .select('category, amount')
        .gte('created_at', thirtyDaysAgo)
        .limit(500);
      if (!isManager) pieQry = pieQry.eq('user_id', user?.id);

      // Executar em paralelo
      const [repRes, rembRes, statsRes, barRes, pieRes] = await Promise.all([
        repQuery,
        rembQuery,
        statsQuery,
        barQry,
        pieQry,
      ]);

      // --- WIDGET 1: Relatórios Abertos ---
      if (repRes.error) console.warn("Erro ao buscar relatórios", repRes.error);
      setReportsCount(repRes.count || 0);

      // --- WIDGET 2: Reembolsos ---
      if (rembRes.error) console.warn("Erro reembolsos", rembRes.error);
      const activeRemb = (rembRes.data ?? []).filter(r =>
        isManager ? r.status === 'Pendente' : r.status === 'Aprovado'
      );
      setReimbursementSum(activeRemb.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0));

      // --- KPI 4: Ticket Médio e Taxa de Aprovação (30 dias) ---
      if (statsRes.data && statsRes.data.length > 0) {
        const approved = statsRes.data.filter(r => r.status === 'Aprovado');
        const rejected = statsRes.data.filter(r => r.status === 'Rejeitado');
        const totalApproved = approved.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        setAvgTicket(approved.length > 0 ? totalApproved / approved.length : 0);
        const processedCount = approved.length + rejected.length;
        setApprovalRate(processedCount > 0 ? Math.round((approved.length / processedCount) * 100) : null);
      }

      // --- GRÁFICO 1: Bar Chart (Últimos 7 dias) ---
      const groupedByDay: Record<string, { criados: number; concluidos: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const dayName = format(subDays(new Date(), i), 'eee', { locale: ptBR });
        groupedByDay[dayName] = { criados: 0, concluidos: 0 };
      }
      (barRes.data ?? []).forEach(rep => {
        const dayName = format(new Date(rep.created_at), 'eee', { locale: ptBR });
        if (groupedByDay[dayName]) {
          groupedByDay[dayName].criados += 1;
          if (rep.status === 'approved') groupedByDay[dayName].concluidos += 1;
        }
      });
      const formattedBarData = Object.keys(groupedByDay).map(name => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        criados: groupedByDay[name].criados,
        concluidos: groupedByDay[name].concluidos,
      }));
      setBarData(formattedBarData);

      // --- WIDGET 3: Produtividade ---
      const totalCreatedWeek = formattedBarData.reduce((acc, curr) => acc + curr.criados, 0);
      setProductivity(totalCreatedWeek > 0
        ? Math.min(100, Math.round((totalCreatedWeek / 10) * 100))
        : 0);

      // --- GRÁFICO 2: Pie Chart ---
      const catTotals: Record<string, number> = {
        'Transporte': 0, 'Alimentação': 0, 'Hospedagem': 0, 'Outros': 0,
      };
      const PIE_COLORS: Record<string, string> = {
        'Transporte': '#3b82f6', 'Alimentação': '#10b981',
        'Hospedagem': '#f59e0b', 'Outros': '#64748b',
      };
      (pieRes.data ?? []).forEach(p => {
        const ct = catTotals[p.category] !== undefined ? p.category : 'Outros';
        catTotals[ct] += Number(p.amount) || 0;
      });
      const formattedPie = Object.keys(catTotals)
        .filter(k => catTotals[k] > 0)
        .map(key => ({ name: key, value: catTotals[key], fill: PIE_COLORS[key] }));
      if (formattedPie.length === 0) {
        formattedPie.push({ name: 'Sem Despesas (0)', value: 1, fill: '#e2e8f0' });
      }
      setPieData(formattedPie);

    } catch (err: any) {
      console.error("Dashboard data load error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchDashboardDataRef.current = fetchDashboardData; });

  useEffect(() => {
    if (user?.id) fetchDashboardData();
  }, [user?.id, isManager]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel('dashboard_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reimbursements' }, () => {
        fetchDashboardDataRef.current();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reimbursements' }, () => {
        fetchDashboardDataRef.current();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_reports' }, () => {
        fetchDashboardDataRef.current();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return (
    <div className="flex flex-col gap-5 h-full w-full max-w-7xl mx-auto pb-6">
      <header className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Olá, {user?.full_name?.split(' ')[0] || 'Profissional'}!
        </h1>
        <p className="text-sm text-muted-foreground">
          {isManager 
            ? 'Monitoramento em tempo real da equipe e custos.' 
            : 'Resumo das suas atividades e solicitações de campo.'}
        </p>
      </header>

      {/* WIDGETS (KPI CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
        
        {/* WIDGET 1: Relatórios */}
        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isManager ? 'Relatórios Abertos (Geral)' : 'Meus Relatórios Pendentes'}
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-primary opacity-80" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16 mb-2 rounded-lg" />
            ) : (
              <div className="text-3xl font-extrabold text-foreground">
                {reportsCount}
              </div>
            )}
            {isLoading ? (
              <Skeleton className="h-4 w-24 rounded" />
            ) : (
              <p className="text-xs text-muted-foreground font-medium flex items-center mt-1">
                <Clock className="mr-1 h-3 w-3" /> Atualizado agora
              </p>
            )}
          </CardContent>
        </Card>

        {/* WIDGET 2: Reembolsos */}
        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isManager ? 'Reembolsos Pendentes' : 'Meus Reembolsos Aprovados'}
            </CardTitle>
            {isManager ? (
              <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400 opacity-80" />
            ) : (
              <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400 opacity-80" />
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mb-2 rounded-lg" />
            ) : (
              <div className="text-3xl font-extrabold text-foreground">
                R$ {reimbursementSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            )}
            {isLoading ? (
               <Skeleton className="h-4 w-32 rounded" />
            ) : (
              <p className={`text-xs font-medium flex items-center mt-1 rounded-md px-2 py-0.5 w-fit ${isManager ? 'bg-amber-100/70 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-100/70 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'}`}>
                {isManager ? 'Aguardando aprovação' : 'Pronto para pagamento'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* WIDGET 3: Produtividade */}
        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isManager ? 'Índice da Equipe (Semana)' : 'Minha Produtividade'}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary opacity-80" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
               <Skeleton className="h-8 w-20 mb-2 rounded-lg" />
            ) : (
              <div className="text-3xl font-extrabold text-foreground">
                {productivity}%
              </div>
            )}
            {isLoading ? (
              <Skeleton className="h-4 w-28 rounded" />
            ) : (
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center mt-1">
                <TrendingUp className="mr-1 h-3 w-3" /> Produtividade base estimada
              </p>
            )}
          </CardContent>
        </Card>

        {/* WIDGET 4: Ticket Medio (Visivel para gestor) */}
        {isManager && (
          <Card className="shadow-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ticket Médio (Aprovados 30d)
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary opacity-80" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24 mb-2 rounded-lg" />
              ) : (
                <div className="text-3xl font-extrabold text-foreground">
                  R$ {avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1 font-medium">Por solicitação aprovada</p>
            </CardContent>
          </Card>
        )}

        {/* WIDGET 5: Taxa de Aaprovacao */}
        <Card className="shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Taxa de Aprovação
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 opacity-80" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <Skeleton className="h-8 w-20 mb-2 rounded-lg" />
            ) : (
              <div className="text-3xl font-extrabold text-foreground">
                {approvalRate === null ? '—' : `${approvalRate.toFixed(1)}%`}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1 font-medium">Eficiência do faturamento (30d)</p>
          </CardContent>
        </Card>
      </div>

      {/* ÁREA DE GRÁFICOS (RECHARTS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-2 min-h-0">
        
        {/* GRÁFICO 1: Barras (Relatórios Criados vs Concluídos) */}
        <Card className="shadow-sm border-border lg:col-span-2 flex flex-col min-w-0">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-base font-semibold text-foreground flex items-center justify-between">
              Balanço de Relatórios (Últimos 7 dias)
              <Button variant="ghost" size="sm" className="h-8 text-xs text-primary hover:bg-accent" onClick={() => navigate('/reports')}>
                Ver todos <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px] w-full min-w-0 pt-4">
            {isLoading ? (
               <div className="w-full h-full flex items-end gap-2 pb-6">
                 {[...Array(7)].map((_, i) => (
                   <div key={i} className="flex-1 flex gap-1 justify-center items-end h-full">
                     <Skeleton className="w-[45%] rounded-md" style={{ height: `${Math.floor(Math.random() * 60 + 20)}%` }} />
                     <Skeleton className="w-[45%] rounded-md" style={{ height: `${Math.floor(Math.random() * 80 + 20)}%` }} />
                   </div>
                 ))}
               </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: 'var(--accent)' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--popover)', color: 'var(--popover-foreground)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                  <Bar dataKey="criados" name="Criados" fill="var(--muted)" radius={[4, 4, 0, 0]} barSize={isManager ? 24 : 32} />
                  <Bar dataKey="concluidos" name="Concluídos" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={isManager ? 24 : 32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* GRÁFICO 2: Pizza (Despesas por Categoria) */}
        <Card className="shadow-sm border-border flex flex-col min-w-0">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-base font-semibold text-foreground flex items-center justify-between">
              {isManager ? 'Despesas por Categoria (30d)' : 'Meus Gastos por Categoria (30d)'}
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 w-full min-h-[300px] min-w-0 flex flex-col items-center justify-center p-0">
             {isLoading ? (
                <div className="w-full h-full flex items-center justify-center relative">
                  <Skeleton className="h-48 w-48 rounded-full" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-24 w-24 bg-card rounded-full"></div>
                  </div>
                </div>
             ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Volume']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--popover)', color: 'var(--popover-foreground)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
             )}
             
             {/* Legenda Customizada (Abaixo do Gráfico) */}
             {!isLoading && (
               <div className="grid grid-cols-2 gap-x-2 gap-y-3 w-full px-6 mb-4">
                 {pieData.map((item, i) => (
                   <div key={i} className="flex items-center text-xs text-muted-foreground">
                     <span className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: item.fill }}></span>
                     <span className="truncate">{item.name}</span>
                   </div>
                 ))}
               </div>
             )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
