import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

interface ConnectionStatusProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
}

// Indicador flutuante de conectividade/sincronização. Crítico para o técnico de
// campo (offline-first) e inofensivo para o gestor: some quando online e sem fila.
export default function ConnectionStatus({ isOnline, isSyncing, pendingCount }: ConnectionStatusProps) {
  // Online e sem trabalho pendente → não polui a tela.
  if (isOnline && !isSyncing && pendingCount === 0) return null;

  const offline = !isOnline;

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        'fixed z-[60] bottom-[84px] left-1/2 -translate-x-1/2',
        'lg:bottom-4 lg:left-auto lg:right-4 lg:translate-x-0',
        'flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold shadow-lg border',
        offline ? 'bg-amber-500 text-white border-amber-600' : 'bg-card text-foreground border-border',
      )}
    >
      {offline ? (
        <>
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          <span>Offline{pendingCount > 0 ? ` · ${pendingCount} na fila` : ''}</span>
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
          <span>Sincronizando{pendingCount > 0 ? ` ${pendingCount}` : ''}…</span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4 text-amber-500" aria-hidden="true" />
          <span>{pendingCount} pendente{pendingCount > 1 ? 's' : ''} para sincronizar</span>
        </>
      )}
    </div>
  );
}
