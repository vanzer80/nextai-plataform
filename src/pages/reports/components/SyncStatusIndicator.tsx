import type { ReactNode } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, HardDrive } from 'lucide-react';
import type { SyncStatus } from '@/src/lib/reportIndexedDB';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  className?: string;
}

const CONFIG: Record<SyncStatus, { icon: ReactNode; label: string; className: string }> = {
  local:      { icon: <HardDrive className="h-3.5 w-3.5" />,                          label: 'Salvo localmente',    className: 'text-slate-500 bg-slate-100' },
  pending:    { icon: <Clock className="h-3.5 w-3.5" />,                              label: 'Aguardando sync',     className: 'text-amber-700 bg-amber-100' },
  syncing:    { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,               label: 'Sincronizando...',    className: 'text-blue-700 bg-blue-100' },
  synced:     { icon: <CheckCircle2 className="h-3.5 w-3.5" />,                       label: 'Sincronizado',        className: 'text-emerald-700 bg-emerald-100' },
  error:      { icon: <XCircle className="h-3.5 w-3.5" />,                            label: 'Erro ao sincronizar', className: 'text-rose-700 bg-rose-100' },
  conflicted: { icon: <XCircle className="h-3.5 w-3.5" />,                            label: 'Conflito detectado',  className: 'text-orange-700 bg-orange-100' },
};

export default function SyncStatusIndicator({ status, className = '' }: SyncStatusIndicatorProps) {
  const { icon, label, className: colorClass } = CONFIG[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${colorClass} ${className}`}>
      {icon}
      {label}
    </span>
  );
}
