import { supabase } from '@/src/lib/supabase';
import type { Supplier, CreateSupplierDTO, UpdateSupplierDTO, SupplierStats } from '@/src/types/supplier';

export async function getSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSupplierById(id: string): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createSupplier(dto: CreateSupplierDTO): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert(dto)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSupplier(id: string, dto: UpdateSupplierDTO): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .update(dto)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getSupplierStats(supplierId: string): Promise<SupplierStats> {
  const { data, error } = await supabase
    .rpc('get_supplier_stats', { p_supplier_id: supplierId });
  if (error) throw new Error(error.message);
  const row = data?.[0] ?? {};
  return {
    total_orders: Number(row.total_orders ?? 0),
    total_spent: row.total_spent != null ? Number(row.total_spent) : null,
    last_purchase_at: row.last_purchase_at ?? null,
  };
}
