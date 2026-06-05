-- Supabase advisor: function_search_path_mutable (WARN)
-- Prevents search_path injection attacks by pinning to 'public'.

CREATE OR REPLACE FUNCTION public.set_updated_at_rh()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.create_payable_installments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  i             INTEGER;
  parcela_valor NUMERIC(14,2);
  parcela_data  DATE;
BEGIN
  IF NEW.numero_parcelas <= 1 THEN
    INSERT INTO public.payable_installments(payable_id, team_id, numero, valor, data_vencimento)
    VALUES (NEW.id, NEW.team_id, 1, NEW.valor_total, NEW.data_vencimento);
  ELSE
    parcela_valor := ROUND(NEW.valor_total / NEW.numero_parcelas, 2);
    FOR i IN 1..NEW.numero_parcelas LOOP
      parcela_data := NEW.data_vencimento + ((i - 1) * INTERVAL '1 month');
      INSERT INTO public.payable_installments(payable_id, team_id, numero, valor, data_vencimento)
      VALUES (
        NEW.id, NEW.team_id, i,
        CASE WHEN i = NEW.numero_parcelas
          THEN NEW.valor_total - parcela_valor * (NEW.numero_parcelas - 1)
          ELSE parcela_valor
        END,
        parcela_data
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.payable_from_material()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.status <> 'comprado' AND NEW.status = 'comprado' AND NEW.purchase_cost IS NOT NULL THEN
    INSERT INTO public.payables (
      team_id, tipo, descricao, valor_total,
      data_vencimento, status, material_id, supplier_id, submitted_at
    ) VALUES (
      NEW.team_id, 'material',
      COALESCE(NEW.description, 'Material comprado'),
      NEW.purchase_cost,
      CURRENT_DATE + INTERVAL '30 days',
      'pendente', NEW.id, NEW.supplier_id, NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.payable_from_reimbursement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_team_id UUID;
BEGIN
  IF OLD.status <> 'aprovado' AND NEW.status = 'aprovado' THEN
    SELECT tm.team_id INTO v_team_id
      FROM public.team_members tm WHERE tm.user_id = NEW.user_id LIMIT 1;
    IF v_team_id IS NOT NULL THEN
      INSERT INTO public.payables (
        team_id, tipo, descricao, valor_total,
        data_vencimento, status, reimbursement_id, submitted_by, submitted_at
      ) VALUES (
        v_team_id, 'reembolso',
        COALESCE(NEW.description, 'Reembolso aprovado'),
        NEW.total_amount,
        CURRENT_DATE + INTERVAL '5 days',
        'aprovado', NEW.id, NEW.user_id, NOW()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
