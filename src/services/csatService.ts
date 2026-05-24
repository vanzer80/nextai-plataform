import { supabase } from '@/src/lib/supabase';
import type { CsatTokenData, CsatAvg } from '@/src/types/csat';

export async function getCsatByToken(token: string): Promise<CsatTokenData | null> {
  const { data, error } = await supabase.rpc('get_csat_by_token', { p_token: token });
  if (error) throw new Error(error.message);
  return data as CsatTokenData | null;
}

export async function submitCsat(
  token: string,
  rating: number,
  comment?: string,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('submit_csat', {
    p_token: token,
    p_rating: rating,
    p_comment: comment || null,
  });
  if (error) throw new Error(error.message);
  return data as { success: boolean; error?: string };
}

export async function getCsatAvg(days = 30): Promise<CsatAvg | null> {
  const { data, error } = await supabase.rpc('get_csat_avg', { p_days: days });
  if (error) throw new Error(error.message);
  return (data?.[0] as CsatAvg) ?? null;
}
