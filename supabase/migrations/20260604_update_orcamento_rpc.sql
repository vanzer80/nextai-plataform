-- Migration: update_orcamento_rpc
-- RPC atômica para atualização de orçamento + versionamento + substituição de itens.
-- SECURITY DEFINER: necessário para que DELETE em orcamento_itens não seja bloqueado
-- pela policy orcamento_itens_delete (que restringe por technician_id OU role).
-- O RBAC é replicado explicitamente dentro da função.

CREATE OR REPLACE FUNCTION public.update_orcamento(
  p_id          UUID,
  p_orcamento   JSONB,
  p_itens       JSONB,
  p_changed_by  UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orcamento RECORD;
  v_caller_id UUID  := auth.uid();
  v_role      public.user_role;
BEGIN
  -- 1. Autenticação
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Não autenticado.');
  END IF;

  -- 2. Role do chamador
  SELECT role INTO v_role FROM public.users WHERE id = v_caller_id;

  -- 3. Buscar orçamento (com isolamento de tenant implícito via get_caller_team_id)
  SELECT id, team_id, technician_id, status, version, titulo, observacoes, validade, desconto_pct
    INTO v_orcamento
    FROM public.orcamentos
   WHERE id = p_id
     AND team_id = get_caller_team_id();

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Orçamento não encontrado.');
  END IF;

  -- 4. RBAC: técnico dono (apenas rascunho) OU Gestor/Admin/Master (qualquer status)
  IF NOT (
    (v_orcamento.technician_id = v_caller_id AND v_orcamento.status = 'rascunho')
    OR v_role IN ('Gestor', 'Admin', 'Master')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Permissão negada.');
  END IF;

  -- 5. Validação de itens
  IF jsonb_array_length(p_itens) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Orçamento deve ter pelo menos 1 item.');
  END IF;

  -- 6. Snapshot da versão atual em orcamento_versions
  --    team_id tem DEFAULT get_caller_team_id() — não precisa ser explícito,
  --    mas é incluído para clareza e auditabilidade.
  INSERT INTO public.orcamento_versions (
    orcamento_id, team_id, version, titulo, observacoes,
    validade, desconto_pct, itens, changed_by
  )
  SELECT
    p_id,
    v_orcamento.team_id,
    v_orcamento.version,
    v_orcamento.titulo,
    v_orcamento.observacoes,
    v_orcamento.validade,
    v_orcamento.desconto_pct,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'descricao',      oi.descricao,
        'quantidade',     oi.quantidade,
        'unidade',        oi.unidade,
        'valor_unitario', oi.valor_unitario
      )) FROM public.orcamento_itens oi WHERE oi.orcamento_id = p_id),
      '[]'::jsonb
    ),
    p_changed_by;

  -- 7. Atualizar cabeçalho
  UPDATE public.orcamentos SET
    report_id    = (p_orcamento->>'report_id')::UUID,
    client_id    = (p_orcamento->>'client_id')::UUID,
    titulo       = NULLIF(p_orcamento->>'titulo', ''),
    observacoes  = NULLIF(p_orcamento->>'observacoes', ''),
    validade     = (p_orcamento->>'validade')::DATE,
    desconto_pct = COALESCE((p_orcamento->>'desconto_pct')::NUMERIC, 0),
    version      = v_orcamento.version + 1
  WHERE id = p_id;

  -- 8. Substituir itens (DELETE + INSERT na mesma transação = atômico)
  DELETE FROM public.orcamento_itens WHERE orcamento_id = p_id;

  INSERT INTO public.orcamento_itens (orcamento_id, descricao, quantidade, unidade, valor_unitario)
  SELECT
    p_id,
    item->>'descricao',
    (item->>'quantidade')::NUMERIC,
    COALESCE(NULLIF(item->>'unidade', ''), 'un'),
    (item->>'valor_unitario')::NUMERIC
  FROM jsonb_array_elements(p_itens) AS item;

  RETURN json_build_object('success', true, 'version', v_orcamento.version + 1);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_orcamento(UUID, JSONB, JSONB, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_orcamento(UUID, JSONB, JSONB, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_orcamento(UUID, JSONB, JSONB, UUID) TO authenticated;
