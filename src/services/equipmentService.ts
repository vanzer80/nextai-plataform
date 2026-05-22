import { supabase } from '@/src/lib/supabase';
import type { Equipment, EquipmentReport, CreateEquipmentDTO, UpdateEquipmentDTO } from '@/src/types/equipment';

export async function getEquipments(): Promise<Equipment[]> {
  const { data, error } = await supabase
    .from('equipments')
    .select('*, clients(name)')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Equipment[];
}

export async function getEquipmentById(id: string): Promise<Equipment> {
  const { data, error } = await supabase
    .from('equipments')
    .select('*, clients(name)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Equipment;
}

export async function createEquipment(dto: CreateEquipmentDTO): Promise<Equipment> {
  const { data, error } = await supabase
    .from('equipments')
    .insert(dto)
    .select('*, clients(name)')
    .single();
  if (error) throw error;
  return data as Equipment;
}

export async function updateEquipment(id: string, dto: UpdateEquipmentDTO): Promise<Equipment> {
  const { data, error } = await supabase
    .from('equipments')
    .update(dto)
    .eq('id', id)
    .select('*, clients(name)')
    .single();
  if (error) throw error;
  return data as Equipment;
}

export async function deleteEquipment(id: string): Promise<void> {
  const { error } = await supabase.from('equipments').delete().eq('id', id);
  if (error) throw error;
}

export async function getEquipmentReports(equipmentId: string): Promise<EquipmentReport[]> {
  const { data, error } = await supabase
    .from('service_reports')
    .select('id, os_number, service_date, status, created_at')
    .eq('asset_id', equipmentId)
    .order('service_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EquipmentReport[];
}
