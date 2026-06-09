-- ─── 1. payables: add updated_by column ───────────────────────────────────────
ALTER TABLE public.payables
  ADD COLUMN IF NOT EXISTS updated_by UUID
    REFERENCES public.users(id) ON DELETE SET NULL;

-- ─── 2. payable_status_history: full status transition log ────────────────────
CREATE TABLE IF NOT EXISTS public.payable_status_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_id  UUID        NOT NULL REFERENCES public.payables(id) ON DELETE CASCADE,
  team_id     UUID        NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT        NOT NULL,
  changed_by  UUID        REFERENCES public.users(id)             ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payable_status_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payable_status_history_payable
  ON public.payable_status_history (payable_id, created_at DESC);

CREATE POLICY "tenant_isolation_payable_status_history"
  ON public.payable_status_history
  FOR ALL
  USING (team_id = public.get_caller_team_id());

-- ─── 3. Trigger: log status changes ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_payable_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.payable_status_history(payable_id, team_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NEW.team_id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_payable_status_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_payable_status_change() FROM anon;

DROP TRIGGER IF EXISTS trg_payable_status_history ON public.payables;
CREATE TRIGGER trg_payable_status_history
  AFTER UPDATE ON public.payables
  FOR EACH ROW EXECUTE FUNCTION public.log_payable_status_change();

-- ─── 4. Trigger: stamp updated_by + updated_at on any payable edit ────────────
CREATE OR REPLACE FUNCTION public.set_payable_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_payable_updated_by() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_payable_updated_by() FROM anon;

DROP TRIGGER IF EXISTS trg_payable_updated_by ON public.payables;
CREATE TRIGGER trg_payable_updated_by
  BEFORE UPDATE ON public.payables
  FOR EACH ROW EXECUTE FUNCTION public.set_payable_updated_by();

-- ─── 5. reimbursements: add missing updated_at + updated_by ──────────────────
ALTER TABLE public.reimbursements
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by UUID
    REFERENCES public.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_reimbursement_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_reimbursement_updated_by() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_reimbursement_updated_by() FROM anon;

DROP TRIGGER IF EXISTS trg_reimbursement_updated_by ON public.reimbursements;
CREATE TRIGGER trg_reimbursement_updated_by
  BEFORE UPDATE ON public.reimbursements
  FOR EACH ROW EXECUTE FUNCTION public.set_reimbursement_updated_by();
