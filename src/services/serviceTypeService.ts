import { supabase } from '@/src/lib/supabase';
import type { ServiceTypeRow } from '@/src/hooks/useServiceTypes';

const COLUMNS = 'id, value, label, sort_order, is_active';

export async function getServiceTypes(): Promise<ServiceTypeRow[]> {
  const { data, error } = await supabase
    .from('service_types')
    .select(COLUMNS)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as ServiceTypeRow[];
}

export async function setServiceTypeActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('service_types')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) throw error;
}

// Troca a ordem de dois tipos (uma operação visual de reordenação).
// Erros são ignorados, como no comportamento original do handleMove.
export async function swapServiceTypeOrder(
  aId: string, aOrder: number,
  bId: string, bOrder: number,
): Promise<void> {
  await Promise.all([
    supabase.from('service_types').update({ sort_order: aOrder }).eq('id', aId),
    supabase.from('service_types').update({ sort_order: bOrder }).eq('id', bId),
  ]);
}

// Retorna o resultado bruto { data, error } para o caller inspecionar
// error.code === '23505' (valor duplicado) vs erro genérico.
export function createServiceType(value: string, label: string, sortOrder: number) {
  return supabase
    .from('service_types')
    .insert({ value, label, sort_order: sortOrder })
    .select(COLUMNS)
    .single();
}
