export type SlaPriority = 'baixa' | 'normal' | 'alta' | 'critica';

export interface SlaPolicy {
  id: string;
  team_id?: string;
  service_type: string | null;
  priority: SlaPriority;
  hours_to_respond: number;
  hours_to_resolve: number;
  is_active: boolean;
  created_at: string;
}

export type CreateSlaPolicyDTO = Omit<SlaPolicy, 'id' | 'team_id' | 'created_at'>;
export type UpdateSlaPolicyDTO = Partial<CreateSlaPolicyDTO>;

export const SLA_PRIORITY_LABEL: Record<SlaPriority, string> = {
  baixa:   'Baixa',
  normal:  'Normal',
  alta:    'Alta',
  critica: 'Crítica',
};

export const SLA_PRIORITY_COLOR: Record<SlaPriority, string> = {
  baixa:   'bg-slate-100 text-slate-700',
  normal:  'bg-blue-100 text-blue-700',
  alta:    'bg-amber-100 text-amber-700',
  critica: 'bg-rose-100 text-rose-700',
};
