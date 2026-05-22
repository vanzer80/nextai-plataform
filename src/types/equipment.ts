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
  created_at: string;
  clients?: { name: string } | null;
}

export type CreateEquipmentDTO = Omit<Equipment, 'id' | 'created_at' | 'clients'>;
export type UpdateEquipmentDTO = Partial<CreateEquipmentDTO>;

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
