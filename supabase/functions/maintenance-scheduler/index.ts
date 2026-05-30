/**
 * maintenance-scheduler — Supabase Edge Function
 *
 * Cria OS automaticamente para planos de manutenção preventiva cujo
 * next_due_at está dentro do lead_days configurado.
 *
 * DEPLOY:
 *   supabase functions deploy maintenance-scheduler
 *
 * SCHEDULE (Supabase Dashboard → Edge Functions → maintenance-scheduler → Schedule):
 *   Cron: 0 9 * * *   (09:00 UTC = 06:00 BRT, diariamente)
 *
 * Também pode ser chamada manualmente via POST /functions/v1/maintenance-scheduler
 * (botão "Executar agora" na página admin/maintenance-plans).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data, error } = await supabase.rpc('create_due_maintenance_orders');

    if (error) {
      console.error('[maintenance-scheduler] RPC error:', error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[maintenance-scheduler] Created ${data} OS(es)`);
    return new Response(JSON.stringify({ created: data, timestamp: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[maintenance-scheduler] Unexpected error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
