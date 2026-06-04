# Plano de Implementação — Correções Auditoria s69

> **Origem:** Auditoria PRD s69 (2026-06-04)  
> **Prioridade:** Executar na ordem listada — P1 e P2 são pré-requisitos para integrações ERP  
> **Estimativa total:** ~2 dias de desenvolvimento

---

## P1 — Fix FK da migration CP (`public.teams` → `public.tenants`)

**Criticidade:** 🔴 Urgente | **Esforço:** 30 min  
**Risco se não corrigido:** Deploy limpo ou disaster recovery falha ao aplicar a migration do módulo CP

### Por que existe

O arquivo `supabase/migrations/20260526_cp_module.sql` foi escrito com `REFERENCES public.teams(id)` por engano de digitação. Em produção isso não causa problema porque a tabela já existia quando a migration rodou (`CREATE TABLE IF NOT EXISTS` pulou o bloco). Mas num fresh install o Postgres rejeitaria a FK para uma tabela inexistente.

**Confirmado no banco:** as FKs reais apontam corretamente para `public.tenants`.

### Arquivos a criar

```
supabase/migrations/20260604_fix_cp_fk_teams_to_tenants.sql
```

### SQL completo

```sql
-- Migration: fix_cp_fk_teams_to_tenants
-- Corrige referência incorreta public.teams → public.tenants
-- nas tabelas do módulo CP (payables, payable_installments, payable_comments).
-- Em produção as FKs já apontam para tenants (tabela existia antes da migration).
-- Esta migration garante que um deploy limpo (disaster recovery) funcione.

-- payables
ALTER TABLE public.payables
  DROP CONSTRAINT IF EXISTS payables_team_id_fkey,
  ADD CONSTRAINT payables_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- payable_installments
ALTER TABLE public.payable_installments
  DROP CONSTRAINT IF EXISTS payable_installments_team_id_fkey,
  ADD CONSTRAINT payable_installments_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- payable_comments
ALTER TABLE public.payable_comments
  DROP CONSTRAINT IF EXISTS payable_comments_team_id_fkey,
  ADD CONSTRAINT payable_comments_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
```

### Verificação pós-deploy

```sql
-- Confirmar que as 3 FKs apontam para tenants
SELECT tc.table_name, ccu.table_name AS references
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('payables','payable_installments','payable_comments')
  AND tc.table_schema = 'public';
-- Esperado: todas as linhas mostram references = 'tenants'
```

### Aceite

- [ ] Migration aplicada sem erro
- [ ] Query de verificação mostra `tenants` nas 3 tabelas
- [ ] `get_advisors(type='security')` → zero novos alertas
- [ ] `tests/cp-module.spec.ts` → 8/8 pass

---

## P2 — RPC atômica `update_orcamento`

**Criticidade:** 🔴 Alta | **Esforço:** 2–3 h  
**Risco se não corrigido:** Atualização de orçamento em rede instável pode resultar em orçamento com cabeçalho atualizado mas **zero itens** — dado corrompido que propaga para o módulo CP e futuro ERP

### Por que existe

`atualizarOrcamento` em `src/services/orcamentoService.ts` executa 5 operações sequenciais sem transação. Se a rede cair entre o DELETE dos itens (passo 4) e o INSERT dos novos itens (passo 5), o orçamento fica com `valor_total = 0` e `orcamento_itens` vazio.

### Arquivos a criar/modificar

```
supabase/migrations/20260604_update_orcamento_rpc.sql   ← CRIAR
src/services/orcamentoService.ts                         ← MODIFICAR função atualizarOrcamento
```

### SQL da migration

```sql
-- Migration: update_orcamento_rpc
-- RPC atômica para atualização de orçamento + itens + versionamento.
-- Substitui os 5 roundtrips sequenciais em atualizarOrcamento.

CREATE OR REPLACE FUNCTION public.update_orcamento(
  p_id          UUID,
  p_orcamento   JSONB,
  p_itens       JSONB,
  p_changed_by  UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_current RECORD;
BEGIN
  -- 1. Buscar versão atual para snapshot
  SELECT version, titulo, observacoes, validade, desconto_pct
    INTO v_current
    FROM public.orcamentos
   WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Orçamento não encontrado.');
  END IF;

  -- 2. Snapshot da versão atual em orcamento_versions
  INSERT INTO public.orcamento_versions (
    orcamento_id, version, titulo, observacoes, validade, desconto_pct, itens, changed_by
  )
  SELECT
    p_id,
    v_current.version,
    v_current.titulo,
    v_current.observacoes,
    v_current.validade,
    v_current.desconto_pct,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'descricao',      oi.descricao,
          'quantidade',     oi.quantidade,
          'unidade',        oi.unidade,
          'valor_unitario', oi.valor_unitario
        )
      ) FROM public.orcamento_itens oi WHERE oi.orcamento_id = p_id),
      '[]'::jsonb
    ),
    p_changed_by;

  -- 3. Atualizar cabeçalho do orçamento
  UPDATE public.orcamentos SET
    report_id    = (p_orcamento->>'report_id')::UUID,
    client_id    = (p_orcamento->>'client_id')::UUID,
    titulo       = p_orcamento->>'titulo',
    observacoes  = p_orcamento->>'observacoes',
    validade     = (p_orcamento->>'validade')::DATE,
    desconto_pct = COALESCE((p_orcamento->>'desconto_pct')::NUMERIC, 0),
    version      = v_current.version + 1
  WHERE id = p_id;

  -- 4. Substituir itens atomicamente (DELETE + INSERT na mesma transação)
  DELETE FROM public.orcamento_itens WHERE orcamento_id = p_id;

  INSERT INTO public.orcamento_itens (orcamento_id, descricao, quantidade, unidade, valor_unitario)
  SELECT
    p_id,
    item->>'descricao',
    (item->>'quantidade')::NUMERIC,
    COALESCE(item->>'unidade', 'un'),
    (item->>'valor_unitario')::NUMERIC
  FROM jsonb_array_elements(p_itens) AS item;

  RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_orcamento(UUID, JSONB, JSONB, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_orcamento(UUID, JSONB, JSONB, UUID) TO authenticated;
```

### Alteração em `src/services/orcamentoService.ts`

Substituir a função `atualizarOrcamento` (linhas 84–147) por:

```typescript
export async function atualizarOrcamento(
  id: string,
  payload: UpdateOrcamentoPayload,
  changedBy?: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('update_orcamento', {
    p_id: id,
    p_orcamento: {
      report_id:    payload.report_id ?? null,
      client_id:    payload.client_id,
      titulo:       payload.titulo || null,
      observacoes:  payload.observacoes || null,
      validade:     payload.validade ?? null,
      desconto_pct: payload.desconto_pct ?? 0,
    },
    p_itens: payload.itens.map(item => ({
      descricao:      item.descricao,
      quantidade:     item.quantidade,
      unidade:        item.unidade || 'un',
      valor_unitario: item.valor_unitario,
    })),
    p_changed_by: changedBy ?? null,
  }) as { data: { success: boolean; error?: string } | null; error: { message: string } | null };

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Falha ao atualizar orçamento.');
}
```

### Verificação

```sql
-- Simular falha: o orçamento nunca pode ter itens vazios após update bem-sucedido
SELECT o.id, o.titulo, COUNT(oi.id) as total_itens
FROM public.orcamentos o
LEFT JOIN public.orcamento_itens oi ON oi.orcamento_id = o.id
GROUP BY o.id, o.titulo
HAVING COUNT(oi.id) = 0 AND o.status != 'rascunho';
-- Esperado: 0 linhas
```

### Aceite

- [ ] Migration aplicada sem erro
- [ ] Atualização de orçamento via UI funciona normalmente
- [ ] Versionamento continua funcionando (histórico de versões aparece no detalhe)
- [ ] `tests/orcamentos-sprint-d.spec.ts` → 5/5 pass
- [ ] `tests/os-orcamento-vinculacao.spec.ts` → 31+/33 pass
- [ ] `npx tsc --noEmit` → EXIT:0

---

## P3 — Observabilidade de Custos de IA

**Criticidade:** 🔴 Alta | **Esforço:** 1 dia  
**Risco se não corrigido:** Chave Gemini revogada → 100% do tráfego vai para OpenAI (~10× mais caro) sem nenhum alerta → descoberta apenas na fatura mensal

### Componentes a implementar

```
supabase/migrations/20260604_ai_routing_log.sql           ← CRIAR
src/types/platformIntelligence.ts                          ← MODIFICAR (adicionar tipos)
src/services/platformIntelligenceService.ts                ← MODIFICAR (adicionar função)
src/pages/platform/PlatformIntelligence.tsx                ← MODIFICAR (adicionar widget)
supabase/functions/ai-proxy/index.ts                       ← MODIFICAR (logar chamadas)
```

### SQL da migration

```sql
-- Migration: ai_routing_log
-- Tabela de telemetria de roteamento da Edge Function ai-proxy.
-- Permite monitorar custos e detectar fallback silencioso para OpenAI.

CREATE TABLE IF NOT EXISTS public.ai_routing_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type  TEXT        NOT NULL,   -- receipt_images | material_images | receipt_voice | material_voice | diagnostic
  provider      TEXT        NOT NULL,   -- gemini_1 | gemini_2 | openai
  is_fallback   BOOLEAN     NOT NULL DEFAULT false,
  latency_ms    INTEGER,
  success       BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_routing_log_created ON public.ai_routing_log (created_at DESC);
CREATE INDEX idx_ai_routing_log_provider ON public.ai_routing_log (provider, created_at DESC);

-- RPC de estatísticas — somente SuperMaster
CREATE OR REPLACE FUNCTION public.get_ai_routing_stats(p_hours INT DEFAULT 24)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH window_data AS (
    SELECT provider, is_fallback, success, latency_ms
    FROM public.ai_routing_log
    WHERE created_at > now() - (p_hours || ' hours')::INTERVAL
  ),
  totals AS (
    SELECT
      COUNT(*)                                              AS total_requests,
      COUNT(*) FILTER (WHERE is_fallback)                  AS fallback_count,
      COUNT(*) FILTER (WHERE provider = 'openai')          AS openai_count,
      COUNT(*) FILTER (WHERE provider LIKE 'gemini%')      AS gemini_count,
      ROUND(AVG(latency_ms))                               AS avg_latency_ms,
      COUNT(*) FILTER (WHERE NOT success)                  AS error_count
    FROM window_data
  ),
  by_provider AS (
    SELECT jsonb_object_agg(provider, cnt) AS data
    FROM (SELECT provider, COUNT(*) cnt FROM window_data GROUP BY provider) sub
  )
  SELECT jsonb_build_object(
    'total_requests',  t.total_requests,
    'fallback_count',  t.fallback_count,
    'fallback_pct',    ROUND(100.0 * t.fallback_count / NULLIF(t.total_requests, 0), 1),
    'openai_count',    t.openai_count,
    'gemini_count',    t.gemini_count,
    'avg_latency_ms',  t.avg_latency_ms,
    'error_count',     t.error_count,
    'by_provider',     COALESCE(p.data, '{}'::jsonb),
    'window_hours',    p_hours
  )
  FROM totals t, by_provider p;
$$;

REVOKE EXECUTE ON FUNCTION public.get_ai_routing_stats(INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_ai_routing_stats(INT) TO authenticated;

-- Sem RLS — tabela só é escrita pela Edge Function (service role) e lida por SuperMaster via RPC
ALTER TABLE public.ai_routing_log DISABLE ROW LEVEL SECURITY;
```

### Tipos a adicionar em `src/types/platformIntelligence.ts`

```typescript
export interface AiRoutingStats {
  total_requests: number;
  fallback_count: number;
  fallback_pct: number;       // 0–100
  openai_count: number;
  gemini_count: number;
  avg_latency_ms: number;
  error_count: number;
  by_provider: Record<string, number>;
  window_hours: number;
}
```

### Função a adicionar em `src/services/platformIntelligenceService.ts`

```typescript
export async function getAiRoutingStats(hours = 24): Promise<AiRoutingStats> {
  const { data, error } = await supabase.rpc('get_ai_routing_stats', { p_hours: hours });
  if (error) throw new Error(error.message);
  return data as unknown as AiRoutingStats;
}
```

### Widget a adicionar em `PlatformIntelligence.tsx`

Adicionar logo após os 4 cards de métricas existentes (linha ~433):

```tsx
{/* Widget de Roteamento IA */}
{aiStats && (
  <div className={`rounded-xl border p-4 shadow-sm flex flex-col gap-3 ${
    aiStats.fallback_pct > 15
      ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40'
      : 'border-border bg-card'
  }`}>
    <div className="flex items-center justify-between">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Zap className="h-3.5 w-3.5" /> Roteamento IA — últimas {aiStats.window_hours}h
      </p>
      {aiStats.fallback_pct > 15 && (
        <Badge variant="destructive" className="text-xs animate-pulse">
          ⚠️ Fallback alto: {aiStats.fallback_pct}%
        </Badge>
      )}
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Requisições', value: aiStats.total_requests },
        { label: 'Fallback OpenAI',   value: `${aiStats.fallback_pct}%`,
          highlight: aiStats.fallback_pct > 15 },
        { label: 'Latência Média',    value: `${aiStats.avg_latency_ms}ms` },
        { label: 'Erros',             value: aiStats.error_count,
          highlight: aiStats.error_count > 0 },
      ].map(({ label, value, highlight }) => (
        <div key={label} className="flex flex-col">
          <p className={`text-xl font-bold ${highlight ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  </div>
)}
```

### Alteração na Edge Function `ai-proxy`

Após cada chamada bem-sucedida ou de fallback, inserir log via Supabase client interno:

```typescript
// Dentro de ai-proxy/index.ts — após determinar o provider usado:
await supabaseAdmin.from('ai_routing_log').insert({
  request_type: requestType,   // 'receipt_images' | 'diagnostic' | etc.
  provider: providerUsed,      // 'gemini_1' | 'gemini_2' | 'openai'
  is_fallback: isFallback,     // true se não foi o provider primário
  latency_ms: Date.now() - startTime,
  success: callSucceeded,
});
// Erro de log nunca deve propagar para o usuário — use try/catch sem rethrow
```

### Aceite

- [ ] Migration aplicada sem erro
- [ ] Chamada à IA via app registra linha em `ai_routing_log`
- [ ] Widget aparece em `/platform/intelligence` para SuperMaster
- [ ] Widget fica vermelho quando `fallback_pct > 15%`
- [ ] `tests/platform/` → todos pass
- [ ] `npx tsc --noEmit` → EXIT:0

---

## P4 — Versionar `ai-proxy` no repositório

**Criticidade:** 🟡 Média | **Esforço:** 1–2 h  
**Risco se não corrigido:** Disaster recovery não restaura a função; sem histórico de mudanças

### O que fazer

1. Obter o código atual da função deployada no Supabase Dashboard (Functions → ai-proxy → View source)
2. Criar o arquivo local:

```
supabase/functions/ai-proxy/index.ts   ← CRIAR com o código obtido no passo 1
```

3. Adicionar ao `.github/workflows` (se existir) o deploy automático da função no push

### Estrutura esperada do arquivo

```typescript
// supabase/functions/ai-proxy/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_KEY_1  = Deno.env.get('GEMINI_API_KEY_1')!;
const GEMINI_KEY_2  = Deno.env.get('GEMINI_API_KEY_2')!;
const OPENAI_KEY    = Deno.env.get('OPENAI_API_KEY')!;

serve(async (req) => {
  // ... lógica de fallback Gemini1 → Gemini2 → OpenAI
  // ... logging em ai_routing_log (após P3)
});
```

### Aceite

- [ ] Arquivo existe em `supabase/functions/ai-proxy/index.ts`
- [ ] `supabase functions deploy ai-proxy` roda sem erro a partir do arquivo local
- [ ] Funcionalidade de IA no app continua funcionando após redeploy

---

## Ordem de Execução Recomendada

```
Dia 1 — manhã (2h)
  └── P1: Fix FK migration (30 min)
  └── P2: RPC update_orcamento — migration + service (2h)

Dia 1 — tarde (4h)
  └── P3: ai_routing_log migration + RPC + tipos + service (2h)
  └── P3: Widget PlatformIntelligence + Edge Function logging (2h)

Dia 2 — manhã (2h)
  └── P4: Versionar ai-proxy (1-2h)
  └── Testes de regressão completos (npx vitest run + Playwright críticos)
  └── Commit + push + deploy Supabase migrations
```

---

## Checklist Final de Entrega

- [ ] `npx tsc --noEmit` → EXIT:0
- [ ] `npx vitest run` → 117+ testes passando
- [ ] `tests/cp-module.spec.ts` → 8/8
- [ ] `tests/orcamentos-sprint-d.spec.ts` → 5/5
- [ ] `tests/os-orcamento-vinculacao.spec.ts` → 31+/33
- [ ] `tests/platform-company-profile.spec.ts` → 6/6
- [ ] Widget de roteamento IA visível em `/platform/intelligence`
- [ ] `get_advisors(type='security')` → zero novos alertas
- [ ] Todas as 4 migrations aplicadas sem erro em produção
- [ ] `ai-proxy` versionada e redeploy funcionando

---

*Criado em: 2026-06-04 (s69) | Responsável: próxima sessão de desenvolvimento*
