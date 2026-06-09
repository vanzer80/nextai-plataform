-- =============================================================================
-- Migration: maintenance_plans — Manutenção Preventiva (padrão SAP PM)
-- Propósito:
--   1. Tabela de planos de manutenção preventiva por tenant
--   2. Campo maintenance_plan_id em service_reports para rastrear origem
--   3. RPC create_due_maintenance_orders() chamada pelo Edge Function scheduler
-- Agendamento: Supabase Edge Function /functions/maintenance-scheduler
--   Configure no Dashboard → Edge Functions → Schedule: '0 9 * * *' (09:00 UTC)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.maintenance_plans (
  id                     uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                uuid    NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  name                   text    NOT NULL,
  description            text,
  service_type           text    NOT NULL,
  client_id              uuid    REFERENCES public.clients(id)            ON DELETE SET NULL,
  asset_id               uuid    REFERENCES public.equipments(id)         ON DELETE SET NULL,
  asset_name_manual      text,
  site_location          text,
  priority               text    NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('baixa','normal','alta','critica')),
  frequency_type         text    NOT NULL DEFAULT 'mensal'
    CHECK (frequency_type IN ('diario','semanal','quinzenal','mensal','trimestral','personalizado')),
  frequency_days         integer NOT NULL DEFAULT 30 CHECK (frequency_days > 0),
  lead_days              integer NOT NULL DEFAULT 1  CHECK (lead_days >= 0),
  next_due_at            date    NOT NULL,
  assigned_technician_id uuid    REFERENCES public.users(id)              ON DELETE SET NULL,
  is_active              boolean NOT NULL DEFAULT true,
  created_by             uuid    REFERENCES public.users(id)              ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_isolation" ON public.maintenance_plans;
CREATE POLICY "team_isolation" ON public.maintenance_plans
  AS RESTRICTIVE FOR ALL USING (team_id = get_my_team_id());

CREATE INDEX IF NOT EXISTS idx_maintenance_plans_due
  ON public.maintenance_plans(team_id, next_due_at) WHERE is_active = true;

ALTER TABLE public.service_reports
  ADD COLUMN IF NOT EXISTS maintenance_plan_id uuid
  REFERENCES public.maintenance_plans(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.create_due_maintenance_orders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan  RECORD;
  v_tech  uuid;
  v_count integer := 0;
BEGIN
  FOR v_plan IN
    SELECT * FROM maintenance_plans
    WHERE is_active = true AND next_due_at <= CURRENT_DATE + lead_days
  LOOP
    v_tech := COALESCE(v_plan.assigned_technician_id, v_plan.created_by);
    CONTINUE WHEN v_tech IS NULL;
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM service_reports
      WHERE maintenance_plan_id = v_plan.id AND status = 'draft'
        AND created_at >= NOW() - INTERVAL '2 days'
    );

    INSERT INTO service_reports(
      team_id, technician_id, status, service_type, service_date,
      client_id, asset_id, asset_name_manual, site_location,
      priority, maintenance_plan_id, description
    ) VALUES (
      v_plan.team_id, v_tech, 'draft', v_plan.service_type, v_plan.next_due_at,
      v_plan.client_id, v_plan.asset_id, v_plan.asset_name_manual, v_plan.site_location,
      v_plan.priority, v_plan.id,
      'OS gerada automaticamente — Plano: ' || v_plan.name
    );

    UPDATE maintenance_plans
    SET next_due_at = next_due_at + (frequency_days || ' days')::interval, updated_at = now()
    WHERE id = v_plan.id;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

REVOKE EXECUTE ON FUNCTION public.create_due_maintenance_orders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_due_maintenance_orders() FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_due_maintenance_orders() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.create_due_maintenance_orders() TO service_role;
