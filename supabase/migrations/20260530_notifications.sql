-- =============================================================================
-- Migration: notifications
-- Propósito:
--   1. Tabela de notificações in-app por usuário (bell icon no AppLayout)
--   2. Trigger automático em report_status_history para notificar o técnico
--      quando sua OS é aprovada, reprovada ou devolvida
-- =============================================================================

-- ── 1. Tabela de notificações ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text        NOT NULL,
  message    text        NOT NULL,
  report_id  uuid        REFERENCES public.service_reports(id) ON DELETE CASCADE,
  is_read    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_notifications_select" ON public.notifications;
CREATE POLICY "own_notifications_select" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own_notifications_update" ON public.notifications;
CREATE POLICY "own_notifications_update" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Índice parcial: busca de não-lidas por usuário — padrão de acesso dominante
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

-- Habilita Realtime para que o AppLayout receba INSERT/UPDATE via websocket
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ── 2. Função de trigger — notifica técnico ao mudar status da OS ─────────────
-- SECURITY DEFINER: precisa ler service_reports e inserir em notifications
-- ignorando RLS (executa como dono da função, normalmente postgres).
CREATE OR REPLACE FUNCTION public.notify_on_os_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tech_id   uuid;
  v_team_id   uuid;
  v_os_number text;
  v_title     text;
  v_message   text;
BEGIN
  -- Só notifica para status relevantes ao técnico
  IF NEW.to_status NOT IN ('approved', 'rejected', 'returned') THEN
    RETURN NEW;
  END IF;

  SELECT technician_id, team_id, os_number
  INTO   v_tech_id, v_team_id, v_os_number
  FROM   service_reports
  WHERE  id = NEW.report_id;

  -- Sem técnico ou o técnico é quem fez a ação (não faz sentido notificar a si mesmo)
  IF v_tech_id IS NULL OR v_tech_id = NEW.changed_by THEN
    RETURN NEW;
  END IF;

  v_title := CASE NEW.to_status
    WHEN 'approved' THEN 'OS Aprovada'
    WHEN 'rejected' THEN 'OS Reprovada'
    WHEN 'returned' THEN 'OS Devolvida para Ajuste'
  END;

  v_message := CASE WHEN v_os_number IS NOT NULL THEN v_os_number || ' — ' ELSE '' END
    || CASE NEW.to_status
         WHEN 'approved' THEN 'Sua OS foi aprovada pelo gestor.'
         WHEN 'rejected' THEN 'Reprovada. ' || COALESCE(trim(NEW.comment), '')
         WHEN 'returned' THEN 'Devolvida para correção. ' || COALESCE(trim(NEW.comment), '')
       END;

  INSERT INTO public.notifications(team_id, user_id, title, message, report_id)
  VALUES (v_team_id, v_tech_id, v_title, trim(v_message), NEW.report_id);

  RETURN NEW;
END; $$;

-- ── 3. Trigger na tabela de histórico de status ───────────────────────────────
DROP TRIGGER IF EXISTS trg_notify_on_os_status ON public.report_status_history;
CREATE TRIGGER trg_notify_on_os_status
  AFTER INSERT ON public.report_status_history
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_os_status_change();

-- Trigger function não deve ser chamável via REST API (só pelo mecanismo de trigger)
REVOKE EXECUTE ON FUNCTION public.notify_on_os_status_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_os_status_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_os_status_change() FROM authenticated;
