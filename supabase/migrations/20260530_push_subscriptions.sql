-- =============================================================================
-- Migration: push_subscriptions
-- Propósito: armazena subscriptions Web Push por usuário para notificações nativas.
-- Setup necessário após deploy:
--   1. Gere VAPID keys: npx web-push generate-vapid-keys
--   2. Adicione ao .env: VITE_VAPID_PUBLIC_KEY=<chave pública>
--   3. Adicione aos Supabase Secrets: VAPID_PRIVATE_KEY e VAPID_SUBJECT
--   4. Deploy da Edge Function: supabase functions deploy push-notification
--   5. Configure Database Webhook em Supabase Dashboard:
--      Table: public.notifications | Event: INSERT | URL: /functions/v1/push-notification
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, user_agent)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_push_subs_select" ON public.push_subscriptions;
CREATE POLICY "own_push_subs_select" ON public.push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own_push_subs_insert" ON public.push_subscriptions;
CREATE POLICY "own_push_subs_insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_push_subs_delete" ON public.push_subscriptions;
CREATE POLICY "own_push_subs_delete" ON public.push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT ON public.push_subscriptions TO service_role;
