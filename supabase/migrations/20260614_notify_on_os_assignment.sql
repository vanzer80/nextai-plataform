-- =============================================================================
-- Migration: notify_on_os_assignment
-- Propósito:
--   Notificar o técnico quando uma OS é ATRIBUÍDA a ele — isto é, quando
--   service_reports.technician_id passa a apontar para ele, tanto na criação
--   (INSERT) quanto na reatribuição (UPDATE). Complementa
--   notify_on_os_status_change (20260530_notifications.sql), que só cobre
--   approved/rejected/returned via report_status_history.
--
--   A linha inserida em public.notifications alimenta o sino in-app (Realtime)
--   e, via Database Webhook em INSERT, o push (Edge Function push-notification).
-- =============================================================================

-- SECURITY DEFINER: insere em notifications ignorando RLS (executa como dono).
CREATE OR REPLACE FUNCTION public.notify_on_os_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid;
BEGIN
  -- Sem técnico atribuído → nada a notificar.
  IF NEW.technician_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- UPDATE que não alterou o técnico → ignora (o gatilho dispara em SET técnico=mesmo valor).
  IF TG_OP = 'UPDATE' AND NEW.technician_id IS NOT DISTINCT FROM OLD.technician_id THEN
    RETURN NEW;
  END IF;

  -- auth.uid() é computado AQUI (dentro do BEGIN), não na DECLARE: uma exceção na
  -- inicialização de variável da DECLARE escaparia do EXCEPTION abaixo e abortaria a OS.
  v_actor := auth.uid();   -- quem atribuiu (NULL em imports via service_role)

  -- Auto-atribuição (técnico criando/pegando a própria OS) → não notifica a si mesmo.
  IF NEW.technician_id = v_actor THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications(team_id, user_id, title, message, report_id)
  VALUES (
    NEW.team_id,
    NEW.technician_id,
    'OS Atribuída',
    CASE WHEN NEW.os_number IS NOT NULL THEN NEW.os_number || ' — ' ELSE '' END
      || 'Uma OS foi atribuída a você.',
    NEW.id
  );

  RETURN NEW;
EXCEPTION
  -- Best-effort: uma falha ao notificar NUNCA pode abortar a criação/edição da OS
  -- (caminho core do app de campo). Engole o erro e deixa a operação prosseguir.
  WHEN OTHERS THEN
    RETURN NEW;
END; $$;

-- AFTER ... OF technician_id: em UPDATE só dispara quando technician_id está no SET.
DROP TRIGGER IF EXISTS trg_notify_on_os_assignment ON public.service_reports;
CREATE TRIGGER trg_notify_on_os_assignment
  AFTER INSERT OR UPDATE OF technician_id ON public.service_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_os_assignment();

-- Trigger function não deve ser chamável via REST API (só pelo mecanismo de trigger).
REVOKE EXECUTE ON FUNCTION public.notify_on_os_assignment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_os_assignment() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_os_assignment() FROM authenticated;
