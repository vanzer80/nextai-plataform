import { supabase } from '@/src/lib/supabase';

// Importação de OS de sistema legado (TOTVS/SAP/Omie/PDF) via Edge Function os-import-processor.
// Retorna { data, error } bruto — o caller inspeciona error.context (FunctionsHttpError) para o detalhe.
export function importOs(payload: Record<string, unknown>) {
  return supabase.functions.invoke('os-import-processor', { body: payload });
}
