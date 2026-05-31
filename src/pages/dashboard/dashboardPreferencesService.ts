import { supabase } from '@/src/lib/supabase';
import type { WidgetId } from './widgetRegistry';

interface RawPrefs {
  widget_order: WidgetId[];
}

export async function loadDashboardPrefs(): Promise<WidgetId[] | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('dashboard_preferences')
    .select('widget_order')
    .eq('user_id', user.id)
    .maybeSingle() as { data: RawPrefs | null; error: { message: string } | null };

  if (error) { console.warn('loadDashboardPrefs:', error.message); return null; }
  return data?.widget_order ?? null;
}

export async function saveDashboardPrefs(widgetOrder: WidgetId[]): Promise<void> {
  // Uma chamada getUser + uma select para team_id + upsert (3 round-trips, sem duplo getUser)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data: userData, error: userErr } = await supabase
    .from('users')
    .select('team_id')
    .eq('id', user.id)
    .single();
  if (userErr || !userData?.team_id) throw new Error('Usuário sem equipe');

  const { error } = await supabase
    .from('dashboard_preferences')
    .upsert(
      { user_id: user.id, team_id: userData.team_id, widget_order: widgetOrder },
      { onConflict: 'user_id' },
    );
  if (error) throw new Error(error.message);
}

export async function resetDashboardPrefs(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('dashboard_preferences').delete().eq('user_id', user.id);
}
