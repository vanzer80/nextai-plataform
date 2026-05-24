import { differenceInDays, parseISO } from 'date-fns';

export type AgingLevel = 'ok' | 'warning' | 'critical';

export interface AgingInfo {
  days: number;
  level: AgingLevel;
  label: string;
}

// Retorna info de aging se o item está "parado" há mais dias do que o threshold de aviso.
// Retorna null se ainda não ultrapassou o limiar de aviso.
export function getAgingInfo(
  createdAt: string,
  warningDays: number,
  criticalDays: number,
): AgingInfo | null {
  const days = differenceInDays(new Date(), parseISO(createdAt));
  if (days < warningDays) return null;

  const level: AgingLevel = days >= criticalDays ? 'critical' : 'warning';
  const label = days === 1 ? '1 dia' : `${days} dias`;
  return { days, level, label };
}

export const AGING_CLASSES: Record<AgingLevel, string> = {
  ok:       '',
  warning:  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};
