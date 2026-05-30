export type FrequencyType = 'diario' | 'semanal' | 'quinzenal' | 'mensal' | 'trimestral' | 'personalizado';

export const FREQUENCY_LABEL: Record<FrequencyType, string> = {
  diario:       'Diário',
  semanal:      'Semanal',
  quinzenal:    'Quinzenal',
  mensal:       'Mensal',
  trimestral:   'Trimestral',
  personalizado:'Personalizado',
};

export const FREQUENCY_DAYS: Record<Exclude<FrequencyType, 'personalizado'>, number> = {
  diario:    1,
  semanal:   7,
  quinzenal: 14,
  mensal:    30,
  trimestral:90,
};

export interface MaintenancePlan {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  service_type: string;
  client_id: string | null;
  asset_id: string | null;
  asset_name_manual: string | null;
  site_location: string | null;
  priority: 'baixa' | 'normal' | 'alta' | 'critica';
  frequency_type: FrequencyType;
  frequency_days: number;
  lead_days: number;
  next_due_at: string;
  assigned_technician_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  clients?: { name: string } | null;
  users?: { full_name: string } | null;
}

export type CreateMaintenancePlanDTO = Omit<
  MaintenancePlan,
  'id' | 'team_id' | 'created_at' | 'updated_at' | 'clients' | 'users'
>;
