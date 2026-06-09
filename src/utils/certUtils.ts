import type { CertStatus } from '@/src/types/employee';

export function computeCertStatus(expiryDate: string | null): CertStatus {
  if (!expiryDate) return 'valido';
  const exp = new Date(expiryDate);
  const now = new Date();
  if (exp < now) return 'vencido';
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  if (exp <= in30) return 'vence_em_breve';
  return 'valido';
}

export const CERT_STATUS_LABEL: Record<CertStatus, string> = {
  valido: 'Válido',
  vence_em_breve: 'Vence em breve',
  vencido: 'Vencido',
};

export const CERT_STATUS_CLASS: Record<CertStatus, string> = {
  valido: 'bg-emerald-100 text-emerald-800',
  vence_em_breve: 'bg-amber-100 text-amber-800',
  vencido: 'bg-rose-100 text-rose-800',
};
