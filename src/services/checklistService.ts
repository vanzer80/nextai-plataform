import { supabase } from '@/src/lib/supabase';
import type { ChecklistTemplate, ChecklistTemplateItem, ChecklistItemType, ServiceType } from '@/src/types/reports';

// ── Draft item (local state antes de salvar) ──────────────────

export interface DraftItem {
  localId: string;          // crypto.randomUUID() — usado como key React
  dbId?: string;            // undefined = novo item
  label: string;
  description: string;
  item_type: ChecklistItemType;
  options: string[];        // vazio quando não 'select'
  is_required: boolean;
}

export function blankDraftItem(): DraftItem {
  return {
    localId: crypto.randomUUID(),
    label: '',
    description: '',
    item_type: 'boolean',
    options: [],
    is_required: false,
  };
}

// ── Queries ───────────────────────────────────────────────────

export async function getTemplates(): Promise<ChecklistTemplate[]> {
  const { data, error } = await supabase
    .from('checklist_templates')
    .select('*')
    .order('is_active', { ascending: false })
    .order('name');
  if (error) throw error;
  return (data ?? []) as ChecklistTemplate[];
}

export async function getTemplateWithItems(
  id: string,
): Promise<ChecklistTemplate & { checklist_template_items: ChecklistTemplateItem[] }> {
  const { data, error } = await supabase
    .from('checklist_templates')
    .select('*, checklist_template_items(* )')
    .eq('id', id)
    .order('order_index', { referencedTable: 'checklist_template_items', ascending: true })
    .single();
  if (error) throw error;
  return data as ChecklistTemplate & { checklist_template_items: ChecklistTemplateItem[] };
}

// ── Mutations ─────────────────────────────────────────────────

export async function createTemplate(
  header: { name: string; description: string; service_type: ServiceType | null; asset_category: string; is_active: boolean },
  items: DraftItem[],
  userId: string,
): Promise<string> {
  const { data: tmpl, error: tmplErr } = await supabase
    .from('checklist_templates')
    .insert({
      name:           header.name,
      description:    header.description || null,
      service_type:   header.service_type ?? null,
      asset_category: header.asset_category || null,
      is_active:      header.is_active,
      created_by:     userId,
    })
    .select('id')
    .single();
  if (tmplErr || !tmpl) throw tmplErr ?? new Error('Failed to create template');

  await insertItems(tmpl.id as string, items);
  return tmpl.id as string;
}

export async function updateTemplate(
  id: string,
  header: { name: string; description: string; service_type: ServiceType | null; asset_category: string; is_active: boolean },
  items: DraftItem[],
): Promise<void> {
  const { error: tmplErr } = await supabase
    .from('checklist_templates')
    .update({
      name:           header.name,
      description:    header.description || null,
      service_type:   header.service_type ?? null,
      asset_category: header.asset_category || null,
      is_active:      header.is_active,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', id);
  if (tmplErr) throw tmplErr;

  // Estratégia: delete all → insert all (simples, safe para listas pequenas)
  const { error: delErr } = await supabase
    .from('checklist_template_items')
    .delete()
    .eq('template_id', id);
  if (delErr) throw delErr;

  await insertItems(id, items);
}

async function insertItems(templateId: string, items: DraftItem[]): Promise<void> {
  if (items.length === 0) return;
  const rows = items.map((item, idx) => ({
    template_id:  templateId,
    order_index:  idx,
    label:        item.label,
    description:  item.description || null,
    item_type:    item.item_type,
    options:      item.item_type === 'select' && item.options.length > 0 ? item.options : null,
    is_required:  item.is_required,
  }));
  const { error } = await supabase.from('checklist_template_items').insert(rows);
  if (error) throw error;
}

export async function toggleTemplateActive(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase
    .from('checklist_templates')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTemplate(id: string): Promise<void> {
  // RLS + CASCADE garante que os itens são deletados junto
  const { error } = await supabase
    .from('checklist_templates')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
