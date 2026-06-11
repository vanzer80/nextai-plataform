-- =============================================================================
-- Migration: client_location_fk
-- Data: 2026-06-07
-- Objetivo: Adiciona FK para client_locations em service_reports e orcamentos,
--           atualiza RPCs submit_report e create_orcamento para propagar o campo.
-- Backward-compat: colunas nullable; OS/orçamentos legados sem filial funcionam.
-- =============================================================================

-- 1. service_reports: FK para a filial selecionada (nullable)
ALTER TABLE public.service_reports
  ADD COLUMN IF NOT EXISTS client_location_id UUID
    REFERENCES public.client_locations(id) ON DELETE SET NULL;

-- 2. orcamentos: FK para filial + texto livre como fallback
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS client_location_id UUID
    REFERENCES public.client_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_location TEXT;

-- 3. Índices de suporte
CREATE INDEX IF NOT EXISTS idx_service_reports_client_location
  ON public.service_reports (client_location_id)
  WHERE client_location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orcamentos_client_location
  ON public.orcamentos (client_location_id)
  WHERE client_location_id IS NOT NULL;

-- 4. RPC submit_report — preserva 100% da lógica existente, adiciona client_location_id
CREATE OR REPLACE FUNCTION public.submit_report(
  p_report      jsonb,
  p_attachments jsonb DEFAULT '[]'::jsonb,
  p_signatures  jsonb DEFAULT '[]'::jsonb,
  p_checklist   jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_id UUID;
  v_team_id   UUID;
  v_tech_name text;
BEGIN
  IF (p_report->>'technician_id')::UUID IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado');
  END IF;

  SELECT team_id, full_name INTO v_team_id, v_tech_name FROM public.users WHERE id = auth.uid();

  INSERT INTO service_reports (
    id, technician_id, local_draft_id, status, description,
    service_type, service_date, os_number, started_at, finished_at,
    client_id, site_location, client_location_id, asset_id, asset_name_manual,
    geo_lat, geo_lng, geo_accuracy, geo_captured_at,
    reported_problem, preliminary_diagnosis, final_diagnosis,
    internal_notes, services_performed, parts_used,
    pending_issues, technical_recommendation,
    team_id
  ) VALUES (
    COALESCE(NULLIF(p_report->>'id', '')::UUID, gen_random_uuid()),
    (p_report->>'technician_id')::UUID,
    p_report->>'local_draft_id',
    'pending_review',
    p_report->>'description',
    p_report->>'service_type',
    (p_report->>'service_date')::DATE,
    NULLIF(p_report->>'os_number', ''),
    NULLIF(p_report->>'started_at', '')::TIMESTAMPTZ,
    NULLIF(p_report->>'finished_at', '')::TIMESTAMPTZ,
    NULLIF(p_report->>'client_id', '')::UUID,
    NULLIF(p_report->>'site_location', ''),
    NULLIF(p_report->>'client_location_id', '')::UUID,
    NULLIF(p_report->>'asset_id', '')::UUID,
    NULLIF(p_report->>'asset_name_manual', ''),
    (p_report->>'geo_lat')::FLOAT,
    (p_report->>'geo_lng')::FLOAT,
    (p_report->>'geo_accuracy')::FLOAT,
    NULLIF(p_report->>'geo_captured_at', '')::TIMESTAMPTZ,
    NULLIF(p_report->>'reported_problem', ''),
    NULLIF(p_report->>'preliminary_diagnosis', ''),
    NULLIF(p_report->>'final_diagnosis', ''),
    NULLIF(p_report->>'internal_notes', ''),
    NULLIF(p_report->>'services_performed', ''),
    NULLIF(p_report->>'parts_used', ''),
    NULLIF(p_report->>'pending_issues', ''),
    NULLIF(p_report->>'technical_recommendation', ''),
    v_team_id
  )
  RETURNING id INTO v_report_id;

  IF jsonb_array_length(p_attachments) > 0 THEN
    INSERT INTO report_attachments (report_id, uploaded_by, url, filename, mime_type, caption)
    SELECT
      v_report_id,
      (a->>'uploaded_by')::UUID,
      a->>'url',
      NULLIF(a->>'filename', ''),
      NULLIF(a->>'mime_type', ''),
      NULLIF(a->>'caption', '')
    FROM jsonb_array_elements(p_attachments) a;
  END IF;

  IF jsonb_array_length(p_signatures) > 0 THEN
    INSERT INTO report_signatures (report_id, signature_type, image_url, signer_name)
    SELECT
      v_report_id,
      (s->>'signature_type')::signature_type,
      s->>'image_url',
      NULLIF(s->>'signer_name', '')
    FROM jsonb_array_elements(p_signatures) s;
  END IF;

  IF jsonb_array_length(p_checklist) > 0 THEN
    INSERT INTO report_checklist_items (
      report_id, template_item_id, label, item_type,
      value_boolean, value_text, value_number, value_option,
      attachment_url, is_conformant
    )
    SELECT
      v_report_id,
      NULLIF(c->>'template_item_id', '')::UUID,
      COALESCE(c->>'label', ''),
      c->>'item_type',
      (c->>'value_boolean')::BOOLEAN,
      NULLIF(c->>'value_text', ''),
      (c->>'value_number')::FLOAT,
      NULLIF(c->>'value_option', ''),
      NULLIF(c->>'attachment_url', ''),
      (c->>'is_conformant')::BOOLEAN
    FROM jsonb_array_elements(p_checklist) c;
  END IF;

  INSERT INTO report_status_history (report_id, to_status, changed_by, comment)
  VALUES (
    v_report_id,
    'pending_review',
    (p_report->>'technician_id')::UUID,
    'Relatório enviado pelo técnico'
  );

  INSERT INTO public.notifications (user_id, title, message, is_read, team_id)
  SELECT u.id,
         'Nova OS para revisão',
         'Técnico ' || COALESCE(v_tech_name, 'desconhecido') || ' enviou uma nova OS para revisão.',
         false,
         v_team_id
    FROM public.users u
   WHERE u.team_id = v_team_id
     AND u.role IN ('Gestor', 'Supervisor', 'Admin', 'Master')
     AND u.id <> auth.uid();

  RETURN jsonb_build_object('success', true, 'report_id', v_report_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_report(jsonb, jsonb, jsonb, jsonb) TO authenticated;

-- 5. RPC create_orcamento — preserva 100% da lógica existente, adiciona client_location_id e site_location
CREATE OR REPLACE FUNCTION public.create_orcamento(
  p_orcamento jsonb,
  p_itens     jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orcamento_id UUID;
  v_team_id      UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado.');
  END IF;

  SELECT team_id INTO v_team_id FROM public.users WHERE id = auth.uid();

  INSERT INTO public.orcamentos (
    report_id,
    client_id,
    technician_id,
    titulo,
    observacoes,
    validade,
    desconto_pct,
    client_location_id,
    site_location,
    team_id
  )
  VALUES (
    (p_orcamento->>'report_id')::UUID,
    (p_orcamento->>'client_id')::UUID,
    (p_orcamento->>'technician_id')::UUID,
    NULLIF(p_orcamento->>'titulo', ''),
    NULLIF(p_orcamento->>'observacoes', ''),
    (p_orcamento->>'validade')::DATE,
    COALESCE((p_orcamento->>'desconto_pct')::NUMERIC, 0),
    NULLIF(p_orcamento->>'client_location_id', '')::UUID,
    NULLIF(p_orcamento->>'site_location', ''),
    v_team_id
  )
  RETURNING id INTO v_orcamento_id;

  IF jsonb_array_length(p_itens) > 0 THEN
    INSERT INTO public.orcamento_itens (orcamento_id, descricao, quantidade, unidade, valor_unitario)
    SELECT
      v_orcamento_id,
      x.descricao,
      x.quantidade,
      COALESCE(NULLIF(x.unidade, ''), 'un'),
      x.valor_unitario
    FROM jsonb_to_recordset(p_itens) AS x(
      descricao      TEXT,
      quantidade     NUMERIC,
      unidade        TEXT,
      valor_unitario NUMERIC
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_orcamento_id);

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_orcamento(jsonb, jsonb) TO authenticated;
