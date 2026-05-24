export interface Equipment {
  id: string;
  client_id: string | null;
  name: string;
  type: string | null;
  serial_number: string | null;
  status: 'ativo' | 'inativo' | 'manutencao';
  manufacturer: string | null;
  model: string | null;
  installation_date: string | null;
  warranty_until: string | null;
  maintenance_interval_days: number | null;
  last_maintenance_at: string | null;
  // E4 — Ciclo de Vida Financeiro
  acquisition_cost: number | null;
  acquisition_date: string | null;
  useful_life_years: number | null;
  residual_value: number;
  created_at: string;
  clients?: { name: string } | null;
}

export type CreateEquipmentDTO = Omit<Equipment, 'id' | 'created_at' | 'clients'>;
export type UpdateEquipmentDTO = Partial<CreateEquipmentDTO>;

export interface LifecycleInfo {
  currentBookValue: number;
  totalDepreciation: number;
  yearsElapsed: number;
  yearsRemaining: number;
  totalMaintenanceCost: number;
  shouldConsiderReplacement: boolean;
}

export function calculateLifecycle(
  eq: Equipment,
  totalMaintenanceCost: number,
): LifecycleInfo | null {
  const { acquisition_cost, acquisition_date, useful_life_years, residual_value } = eq;
  if (!acquisition_cost || !acquisition_date || !useful_life_years) return null;

  const acquiredAt = new Date(acquisition_date);
  const today = new Date();
  const yearsElapsed = Math.max(0,
    (today.getTime() - acquiredAt.getTime()) / (365.25 * 24 * 3600 * 1000),
  );

  const depreciableValue = acquisition_cost - residual_value;
  const annualDepreciation = depreciableValue / useful_life_years;
  const totalDepreciation = Math.min(depreciableValue, annualDepreciation * yearsElapsed);
  const currentBookValue = Math.max(residual_value, acquisition_cost - totalDepreciation);
  const yearsRemaining = Math.max(0, useful_life_years - yearsElapsed);

  return {
    currentBookValue,
    totalDepreciation,
    yearsElapsed,
    yearsRemaining,
    totalMaintenanceCost,
    shouldConsiderReplacement: totalMaintenanceCost > currentBookValue,
  };
}

export interface EquipmentReport {
  id: string;
  os_number: string | null;
  service_date: string | null;
  status: string;
  created_at: string;
}

export type MaintenanceStatus = 'vencida' | 'proxima' | 'ok' | 'sem-dados';

export function maintenanceStatus(eq: Equipment): MaintenanceStatus {
  if (!eq.maintenance_interval_days) return 'sem-dados';
  const base = eq.last_maintenance_at ?? eq.installation_date;
  if (!base) return 'sem-dados';
  const dueDate = new Date(base);
  dueDate.setDate(dueDate.getDate() + eq.maintenance_interval_days);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
  if (daysUntil < 0) return 'vencida';
  if (daysUntil <= 15) return 'proxima';
  return 'ok';
}
