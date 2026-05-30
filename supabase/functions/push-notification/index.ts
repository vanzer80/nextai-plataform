/**
 * push-notification — Supabase Edge Function
 *
 * Envia Web Push quando uma notificação in-app é criada (trigger via Database Webhook).
 *
 * SETUP:
 *   1. Gere VAPID keys: npx web-push generate-vapid-keys
 *   2. Supabase Dashboard → Settings → Edge Functions → Secrets:
 *      VAPID_PRIVATE_KEY=<chave_privada>
 *      VAPID_PUBLIC_KEY=<chave_pública>
 *      VAPID_SUBJECT=mailto:admin@seudominio.com
 *   3. Adicione ao .env do projeto: VITE_VAPID_PUBLIC_KEY=<chave_pública>
 *   4. Deploy: supabase functions deploy push-notification
 *   5. Database Webhook em Supabase Dashboard:
 *      Table: public.notifications | Event: INSERT
 *      URL: https://<project>.supabase.co/functions/v1/push-notification
 *      Headers: Authorization: Bearer <service_role_key>
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

interface WebhookPayload {
  type: 'INSERT';
  table: string;
  record: {
    id: string;
    user_id: string;
    title: string;
    message: string;
    report_id: string | null;
  };
}

Deno.serve(async (req: Request) => {
  try {
    const payload: WebhookPayload = await req.json();
    const notif = payload.record;

    const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
    const vapidSubject    = Deno.env.get('VAPID_SUBJECT')      ?? 'mailto:admin@example.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('[push-notification] VAPID keys not configured — skipping push');
      return new Response('VAPID not configured', { status: 200 });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('user_id', notif.user_id);

    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    const pushPayload = JSON.stringify({
      title: notif.title,
      body:  notif.message,
      data:  { report_id: notif.report_id },
      icon:  '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
    });

    let sent = 0;
    const expired: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(sub.subscription as webpush.PushSubscription, pushPayload);
          sent++;
        } catch (err: any) {
          // 410 Gone = subscription expired/unsubscribed
          if (err?.statusCode === 410) expired.push(sub.id);
          else console.warn('[push-notification] Send failed:', err?.message);
        }
      }),
    );

    // Limpa subscriptions expiradas
    if (expired.length) {
      await supabase.from('push_subscriptions').delete().in('id', expired);
    }

    console.log(`[push-notification] Sent: ${sent}, Expired removed: ${expired.length}`);
    return new Response(JSON.stringify({ sent, expired: expired.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[push-notification] Error:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
