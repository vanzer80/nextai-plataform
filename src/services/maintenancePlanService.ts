import { supabase } from '@/src/lib/supabase';
import type { MaintenancePlan, CreateMaintenancePlanDTO } from '@/src/types/maintenancePlan';

// Lança o erro bruto do supabase (não Error) para preservar o tratamento
// `e instanceof Error ? e.message : <generico>` dos callers.

export async function getMaintenancePlans(): Promise<MaintenancePlan[]> {
  const { data, error } = await supabase
    .from('maintenance_plans')
    .select('*, clients(name), users:assigned_technician_id(full_name)')
    .order('next_due_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MaintenancePlan[];
}

// INSERT injeta team_id manualmente (tabela sem DEFAULT get_caller_team_id()).
export async function createMaintenancePlan(form: CreateMaintenancePlanDTO, teamId: string): Promise<void> {
  const { error } = await supabase
    .from('maintenance_plans')
    .insert({ ...form, team_id: teamId });
  if (error) throw error;
}

export async function updateMaintenancePlan(id: string, form: CreateMaintenancePlanDTO): Promise<void> {
  const { error } = await supabase
    .from('maintenance_plans')
    .update({ ...form, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function setMaintenancePlanActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('maintenance_plans')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMaintenancePlan(id: string): Promise<void> {
  const { error } = await supabase.from('maintenance_plans').delete().eq('id', id);
  if (error) throw error;
}

// RPC que gera as OS vencidas; retorna a contagem criada.
export async function runDueMaintenanceOrders(): Promise<number> {
  const { data, error } = await supabase.rpc('create_due_maintenance_orders');
  if (error) throw error;
  return data as number;
}
