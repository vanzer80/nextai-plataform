import { supabase } from '@/src/lib/supabase';
import type { Part, CreatePartDTO, UpdatePartDTO, OsPart } from '@/src/types/part';

export async function getParts(): Promise<Part[]> {
  const { data, error } = await supabase
    .from('parts')
    .select('*, suppliers(name)')
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createPart(dto: CreatePartDTO): Promise<Part> {
  const { data, error } = await supabase
    .from('parts')
    .insert(dto)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePart(id: string, dto: UpdatePartDTO): Promise<Part> {
  const { data, error } = await supabase
    .from('parts')
    .update(dto)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deletePart(id: string): Promise<void> {
  const { error } = await supabase.from('parts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getOsPartsForReport(reportId: string): Promise<OsPart[]> {
  const { data, error } = await supabase
    .from('os_parts')
    .select('*, parts(name, unit)')
    .eq('report_id', reportId)
    .order('id');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function usePart(
  reportId: string,
  partId: string,
  qty: number,
): Promise<{ success: boolean; error?: string; os_part_id?: string }> {
  const { data, error } = await supabase
    .rpc('use_part', { p_report_id: reportId, p_part_id: partId, p_qty: qty });
  if (error) throw new Error(error.message);
  return data as { success: boolean; error?: string; os_part_id?: string };
}

export async function removeOsPart(osPardId: string): Promise<void> {
  const { error } = await supabase.from('os_parts').delete().eq('id', osPardId);
  if (error) throw new Error(error.message);
}
