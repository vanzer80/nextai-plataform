import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ChevronRight, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent } from '@/src/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';

type ReportStatus = 'draft' | 'pending_review' | 'returned' | 'approved' | 'rejected';

const STATUS_LABEL: Record<ReportStatus, string> = {
  draft:          'Rascunho',
  pending_review: 'Em Análise',
  returned:       'Devolvido',
  approved:       'Aprovado',
  rejected:       'Reprovado',
};

const STATUS_COLOR: Record<ReportStatus, string> = {
  draft:          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  pending_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  returned:       'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  approved:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected:       'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

interface OSRow {
  id: string;
  os_number: string | null;
  service_date: string | null;
  service_type: string | null;
  status: ReportStatus;
  created_at: string;
  users: { full_name: string } | null;
}

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

export default function ClientPortal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<OSRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    supabase
      .from('service_reports')
      .select('id, os_number, service_date, service_type, status, created_at, users:technician_id(full_name)')
      .not('status', 'eq', 'draft')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) { toast.error('Erro ao carregar OS.'); return; }
        setReports((data ?? []) as OSRow[]);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const filtered = reports.filter(r => statusFilter === 'all' || r.status === statusFilter);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div data-onboarding="portal-header" className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Minhas Ordens de Serviço
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhe o status dos serviços realizados.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-10 rounded-xl">
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending_review">Em Análise</SelectItem>
            <SelectItem value="returned">Devolvido</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="rejected">Reprovado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-semibold text-muted-foreground">Nenhuma OS encontrada</p>
            <p className="text-sm text-muted-foreground">As Ordens de Serviço aparecerão aqui após serem registradas.</p>
          </CardContent>
        </Card>
      ) : (
        <div data-onboarding="portal-lista" className="space-y-3">
          {filtered.map(r => (
            <Card
              key={r.id}
              className="shadow-sm border-border hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
              onClick={() => navigate(`/reports/${r.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {r.os_number ? `OS #${r.os_number}` : 'OS sem número'}
                      </span>
                      <Badge className={`text-xs ${STATUS_COLOR[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {r.service_type ?? 'Serviço'} · {fmt(r.service_date)}
                    </p>
                    {r.users?.full_name && (
                      <p className="text-xs text-muted-foreground">Técnico: {r.users.full_name}</p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
