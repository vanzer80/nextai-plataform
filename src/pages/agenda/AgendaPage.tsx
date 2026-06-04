import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDays, startOfWeek, format, isSameDay, parseISO, subWeeks, addWeeks,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, CalendarDays, UserCheck, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';

type Priority = 'baixa' | 'normal' | 'alta' | 'critica';
type ReportStatus = 'draft' | 'pending_review' | 'returned' | 'approved' | 'rejected';

interface OSRow {
  id: string;
  os_number: string | null;
  service_date: string | null;
  service_type: string | null;
  status: ReportStatus;
  priority: Priority;
  technician_id: string | null;
  client_id: string | null;
  users: { full_name: string } | null;
  clients: { name: string } | null;
}

interface TeamUser {
  id: string;
  full_name: string;
  role: string;
}

const PRIORITY_COLOR: Record<Priority, string> = {
  baixa:   'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300',
  normal:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  alta:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  critica: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

const STATUS_COLOR: Record<ReportStatus, string> = {
  draft:          'bg-slate-100 text-slate-600',
  pending_review: 'bg-amber-100 text-amber-700',
  returned:       'bg-orange-100 text-orange-700',
  approved:       'bg-emerald-100 text-emerald-700',
  rejected:       'bg-rose-100 text-rose-700',
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  draft: 'Rascunho', pending_review: 'Em Análise',
  returned: 'Devolvido', approved: 'Aprovado', rejected: 'Reprovado',
};

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export default function AgendaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isManager = ['Supervisor', 'Gestor', 'Admin', 'Master'].includes(user?.role ?? '');

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [reports, setReports] = useState<OSRow[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [techFilter, setTechFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Dispatch dialog
  const [dispatchTarget, setDispatchTarget] = useState<OSRow | null>(null);
  const [newTechId, setNewTechId] = useState('');
  const [dispatching, setDispatching] = useState(false);

  const weekEnd = addDays(weekStart, 6);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = format(weekStart, 'yyyy-MM-dd');
      const to   = format(addDays(weekStart, 6), 'yyyy-MM-dd');

      let q = supabase
        .from('service_reports')
        .select('id, os_number, service_date, service_type, status, priority, technician_id, client_id, users:technician_id(full_name), clients:client_id(name)')
        .not('status', 'eq', 'draft')
        .gte('service_date', from)
        .lte('service_date', to)
        .order('service_date');

      if (!isManager) q = q.eq('technician_id', user?.id);

      const { data, error } = await q;
      if (error) throw error;
      setReports((data ?? []) as OSRow[]);
    } catch {
      toast.error('Erro ao carregar agenda.');
    } finally {
      setLoading(false);
    }
  }, [weekStart, isManager, user?.id]);

  // Load team users for dispatch dropdown (managers only)
  useEffect(() => {
    if (!isManager || !user?.team_id) return;
    supabase
      .from('users')
      .select('id, full_name, role')
      .eq('team_id', user.team_id)
      .eq('status', 'Ativo')
      .in('role', ['Tecnico', 'Supervisor'])
      .order('full_name')
      .then(({ data }) => setTeamUsers((data ?? []) as TeamUser[]));
  }, [isManager, user?.team_id]);

  useEffect(() => { load(); }, [load]);

  const days = getWeekDays(weekStart);

  const reportsForDay = (day: Date) =>
    reports.filter(r => {
      if (!r.service_date) return false;
      if (!isSameDay(parseISO(r.service_date), day)) return false;
      if (techFilter !== 'all' && r.technician_id !== techFilter) return false;
      return true;
    });

  const openDispatch = (r: OSRow) => {
    setDispatchTarget(r);
    setNewTechId(r.technician_id ?? '');
  };

  const handleDispatch = async () => {
    if (!dispatchTarget || !newTechId) return;
    setDispatching(true);
    try {
      const { error } = await supabase
        .from('service_reports')
        .update({ technician_id: newTechId })
        .eq('id', dispatchTarget.id);
      if (error) throw error;
      toast.success('Técnico atribuído com sucesso.');
      setDispatchTarget(null);
      await load();
    } catch {
      toast.error('Erro ao atribuir técnico.');
    } finally {
      setDispatching(false);
    }
  };

  const totalThisWeek = reports.filter(r => techFilter === 'all' || r.technician_id === techFilter).length;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" /> Agenda / Dispatch
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalThisWeek} OS · semana de {format(weekStart, "d MMM", { locale: ptBR })} a {format(weekEnd, "d MMM", { locale: ptBR })}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isManager && (
            <Select value={techFilter} onValueChange={setTechFilter}>
              <SelectTrigger data-onboarding="agenda-filtro-tecnico" className="w-44 h-10 rounded-xl">
                <SelectValue placeholder="Filtrar técnico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os técnicos</SelectItem>
                {teamUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setWeekStart(d => subWeeks(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-10 rounded-xl px-3 text-xs" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setWeekStart(d => addWeeks(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        /* Calendar grid */
        <div data-onboarding="agenda-semana" className="grid grid-cols-1 sm:grid-cols-7 gap-2 overflow-x-auto">
          {days.map(day => {
            const dayReports = reportsForDay(day);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className="min-w-[130px]">
                {/* Day header */}
                <div className={`text-center py-2 px-1 rounded-lg mb-2 ${isToday ? 'bg-primary text-primary-foreground' : 'bg-muted/50'}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">
                    {format(day, 'EEE', { locale: ptBR })}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? '' : 'text-foreground'}`}>
                    {format(day, 'd')}
                  </p>
                </div>

                {/* OS cards for the day */}
                <div className="space-y-2">
                  {dayReports.length === 0 ? (
                    <div className="h-16 flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground/50">—</span>
                    </div>
                  ) : (
                    dayReports.map(r => (
                      <Card
                        key={r.id}
                        className="p-2 cursor-pointer border-border hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 text-[11px]"
                        onClick={() => navigate(`/reports/${r.id}`)}
                      >
                        <p className="font-bold text-foreground truncate">
                          {r.os_number ? `#${r.os_number}` : r.id.slice(0, 6)}
                        </p>
                        {r.clients?.name && (
                          <p className="text-muted-foreground truncate">{r.clients.name}</p>
                        )}
                        {r.service_type && (
                          <p className="text-muted-foreground truncate">{r.service_type}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${STATUS_COLOR[r.status]}`}>
                            {STATUS_LABEL[r.status]}
                          </span>
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${PRIORITY_COLOR[r.priority ?? 'normal']}`}>
                            {r.priority ?? 'normal'}
                          </span>
                        </div>
                        {r.users?.full_name && (
                          <p className="text-muted-foreground mt-0.5 truncate flex items-center gap-0.5">
                            <UserCheck className="h-2.5 w-2.5 shrink-0" />
                            {r.users.full_name.split(' ')[0]}
                          </p>
                        )}
                        {isManager && (
                          <button
                            className="mt-1 w-full text-[10px] text-primary underline-offset-2 hover:underline text-left"
                            onClick={e => { e.stopPropagation(); openDispatch(r); }}
                          >
                            Atribuir
                          </button>
                        )}
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dispatch Dialog */}
      <Dialog open={!!dispatchTarget} onOpenChange={open => { if (!open) setDispatchTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Atribuir Técnico</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground">
                OS: <strong>{dispatchTarget?.os_number ? `#${dispatchTarget.os_number}` : '—'}</strong>
                {dispatchTarget?.clients?.name && <> · {dispatchTarget.clients.name}</>}
              </p>
              <p className="text-sm text-muted-foreground">
                Técnico atual: <strong>{dispatchTarget?.users?.full_name ?? 'Não atribuído'}</strong>
              </p>
            </div>
            <Select value={newTechId} onValueChange={setNewTechId}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Selecionar técnico" />
              </SelectTrigger>
              <SelectContent>
                {teamUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name} <span className="text-muted-foreground ml-1">({u.role})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchTarget(null)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleDispatch} disabled={dispatching || !newTechId} className="rounded-xl">
              {dispatching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
