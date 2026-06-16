-- Torna client_id nullable para suportar cliente não cadastrado
ALTER TABLE public.orcamentos
  ALTER COLUMN client_id DROP NOT NULL;

-- Colunas de cliente não cadastrado
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS cliente_avulso_nome TEXT,
  ADD COLUMN IF NOT EXISTS cliente_avulso_documento TEXT,
  ADD COLUMN IF NOT EXISTS cliente_avulso_email TEXT,
  ADD COLUMN IF NOT EXISTS cliente_avulso_telefone TEXT,
  ADD COLUMN IF NOT EXISTS cliente_tipo TEXT NOT NULL DEFAULT 'cadastrado';

-- Garante consistência: se for não cadastrado, nome é obrigatório; se for cadastrado, client_id é obrigatório
ALTER TABLE public.orcamentos
  ADD CONSTRAINT ck_orcamento_cliente CHECK (
    (cliente_tipo = 'cadastrado' AND client_id IS NOT NULL) OR
    (cliente_tipo = 'avulso' AND cliente_avulso_nome IS NOT NULL)
  );

-- Atualiza RPC create_orcamento
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
    cliente_tipo,
    cliente_avulso_nome,
    cliente_avulso_documento,
    cliente_avulso_email,
    cliente_avulso_telefone,
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
    NULLIF(p_orcamento->>'client_id', '')::UUID,
    COALESCE(p_orcamento->>'cliente_tipo', 'cadastrado'),
    NULLIF(p_orcamento->>'cliente_avulso_nome', ''),
    NULLIF(p_orcamento->>'cliente_avulso_documento', ''),
    NULLIF(p_orcamento->>'cliente_avulso_email', ''),
    NULLIF(p_orcamento->>'cliente_avulso_telefone', ''),
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

REVOKE FROM PUBLIC FUNCTION public.create_orcamento(jsonb, jsonb);
REVOKE FROM anon FUNCTION public.create_orcamento(jsonb, jsonb);
GRANT EXECUTE ON FUNCTION public.create_orcamento(jsonb, jsonb) TO authenticated;
