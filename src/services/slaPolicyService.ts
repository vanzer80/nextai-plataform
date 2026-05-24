import { supabase } from '@/src/lib/supabase';
import type { SlaPolicy, CreateSlaPolicyDTO, UpdateSlaPolicyDTO } from '@/src/types/slaPolicy';

export async function getSlaPolicies(): Promise<SlaPolicy[]> {
  const { data, error } = await supabase
    .from('sla_policies')
    .select('*')
    .order('priority');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSlaPolicy(dto: CreateSlaPolicyDTO): Promise<SlaPolicy> {
  const { data, error } = await supabase
    .from('sla_policies')
    .insert(dto)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSlaPolicy(id: string, dto: UpdateSlaPolicyDTO): Promise<SlaPolicy> {
  const { data, error } = await supabase
    .from('sla_policies')
    .update(dto)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSlaPolicy(id: string): Promise<void> {
  const { error } = await supabase.from('sla_policies').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
