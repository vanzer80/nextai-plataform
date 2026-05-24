import { Link } from 'react-router-dom';
import { CalendarDays, User, Building2, AlertTriangle, Timer } from 'lucide-react';
import { OrcamentoStatusBadge } from './OrcamentoStatusBadge';
import type { Orcamento } from '@/src/types/orcamento';
import { getAgingInfo, AGING_CLASSES } from '@/src/lib/aging';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function isExpired(validade: string | null): boolean {
  if (!validade) return false;
  return new Date(validade) < new Date(new Date().toDateString());
}

export function OrcamentoCard({ orcamento }: { orcamento: Orcamento }) {
  const titulo = orcamento.titulo || `Orçamento #${orcamento.id.slice(0, 8).toUpperCase()}`;
  const expired = isExpired(orcamento.validade);
  const aging = orcamento.status === 'enviado'
    ? getAgingInfo(orcamento.updated_at ?? orcamento.created_at, 3, 7)
    : null;

  return (
    <Link
      to={`/orcamentos/${orcamento.id}`}
      className="block bg-card rounded-xl border border-border p-4 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{titulo}</p>
          {orcamento.service_reports?.os_number && (
            <p className="text-xs text-muted-foreground mt-0.5">OS: {orcamento.service_reports.os_number}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <OrcamentoStatusBadge status={orcamento.status} />
          {aging && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${AGING_CLASSES[aging.level]}`}>
              <Timer className="h-3 w-3" /> {aging.label}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {orcamento.clients?.name && (
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {orcamento.clients.name}
          </span>
        )}
        {orcamento.users?.full_name && (
          <span className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {orcamento.users.full_name}
          </span>
        )}
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(orcamento.created_at)}
        </span>
        {orcamento.validade && (
          <span className={`flex items-center gap-1 ${expired ? 'text-destructive font-medium' : ''}`}>
            {expired && <AlertTriangle className="h-3.5 w-3.5" />}
            Válido até {formatDate(orcamento.validade)}
          </span>
        )}
      </div>
    </Link>
  );
}
