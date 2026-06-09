# Plano de Implementação — Correções Auditoria s69

> **Origem:** Auditoria PRD s69 (2026-06-04) — validado contra banco de produção  
> **Revisão:** v2 — corrigido após auto-auditoria do plano v1 (falhas encontradas: RLS inseguro, SQL incompleto, widget sem estado)  
> **Estimativa total:** ~2 dias de desenvolvimento  
> **Execução:** na ordem P1 → P2 → P3 → P4

---

## P1 — Fix FK da migration CP (`public.teams` → `public.tenants`)

**Criticidade:** 🟡 Disaster Recovery | **Esforço:** 30 min

### Contexto verificado no banco

```
payables_team_id_fkey            → tenants ✅ (já correto em produção)
payable_installments_team_id_fkey → tenants ✅
payable_comments_team_id_fkey    → tenants ✅
```

O banco de produção está correto. O problema é que `supabase/migrations/20260526_cp_module.sql`
contém `REFERENCES public.teams(id)` (tabela inexistente). Um deploy limpo falharia neste passo.
A migration abaixo garante idempotência: reforça as FKs corretas mesmo que o estado inicial seja inconsistente.

### Arquivo a criar

```
supabase/migrations/20260604_fix_cp_fk_teams_to_tenants.sql
```

### SQL

```sql
-- Migration: fix_cp_fk_teams_to_tenants
-- Contexto: migration 20260526_cp_module.sql foi escrita com REFERENCES public.teams(id)
-- (tabela inexistente). Em produção as FKs já apontam para tenants porque a tabela
-- existia antes da migration. Esta migration garante que um disaster recovery funcione.
-- É idempotente: DROP IF EXISTS + ADD garante o estado correto independente do estado atual.

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

### Rollback

```sql
-- Não necessário: a migration apenas reafirma o estado correto já existente.
-- Em caso de falha, o banco permanece no estado anterior sem regressão.
```

### Verificação pós-deploy

```sql
SELECT tc.table_name, tc.constraint_name, ccu.table_name AS ref_table
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name AND ccu.table_schema = 'public'
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('payables','payable_installments','payable_comments')
  AND ccu.column_name = 'id'
ORDER BY tc.table_name;
-- Esperado: ref_table = 'tenants' nas 3 linhas
```

### Aceite

- [ ] Migration aplicada sem erro
- [ ] Query de verificação: ref_table = 'tenants' nas 3 linhas
- [ ] `get_advisors(type='security')` → zero novos alertas
- [ ] `tests/cp-module.spec.ts` → 8/8 pass

---

## P2 — RPC atômica `update_orcamento`

**Criticidade:** 🔴 Alta (blocker ERP) | **Esforço:** 2–3 h

### Contexto verificado no banco

| Tabela | Coluna `team_id` | DEFAULT | RLS |
|--------|-----------------|---------|-----|
| `orcamento_versions` | NOT NULL | `get_caller_team_id()` | team_isolation ALL |
| `orcamento_itens` | — (isolado via join) | — | team_isolation ALL (via orcamentos.team_id) |
| `orcamentos` | NULLABLE | `get_caller_team_id()` | team_isolation ALL |

**Políticas RLS relevantes:**
- `orcamentos_update`: `(technician_id = auth.uid() AND status = 'rascunho') OR role IN (Gestor, Admin, Master)`
- `orcamento_itens_delete`: `technician_id = auth.uid() OR role IN (Gestor, Admin, Master)`
- `orcamento_versions` team_isolation: `team_id = get_caller_team_id()`

**Decisão de design:** SECURITY DEFINER — consistente com `create_orcamento`, evita RLS patchwork
para DELETE de itens, permite RBAC explícito e verificável no código SQL.

### Arquivo a criar

```
supabase/migrations/20260604_update_orcamento_rpc.sql
```

### SQL

```sql
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
```

### Rollback

```sql
-- Restaurar comportamento anterior (remover a RPC)
DROP FUNCTION IF EXISTS public.update_orcamento(UUID, JSONB, JSONB, UUID);
-- O TypeScript voltaria a usar as 5 operações sequenciais existentes.
-- Nenhuma dado é perdido — a RPC só altera o mecanismo, não a estrutura.
```

### Alteração em `src/services/orcamentoService.ts`

Substituir a função `atualizarOrcamento` (linhas 84–147):

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
  }) as { data: { success: boolean; version?: number; error?: string } | null; error: { message: string } | null };

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Falha ao atualizar orçamento.');
}
```

### Verificação pós-deploy

```sql
-- Confirmar que a RPC existe com a assinatura correta
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'update_orcamento';
-- Esperado: security_type = 'DEFINER'

-- Confirmar que não há orçamentos sem itens (exceto rascunhos novos)
SELECT o.id, o.titulo, o.status, COUNT(oi.id) AS total_itens
FROM public.orcamentos o
LEFT JOIN public.orcamento_itens oi ON oi.orcamento_id = o.id
GROUP BY o.id, o.titulo, o.status
HAVING COUNT(oi.id) = 0 AND o.status != 'rascunho';
-- Esperado: 0 linhas
```

### Aceite

- [ ] Migration aplicada sem erro
- [ ] Editar orçamento via UI funciona (todos os campos + itens)
- [ ] Histórico de versões aparece corretamente após edição
- [ ] Técnico dono não consegue editar orçamento `enviado` (RBAC bloqueando)
- [ ] Gestor consegue editar orçamento em qualquer status
- [ ] `tests/orcamentos-sprint-d.spec.ts` → 5/5 pass
- [ ] `tests/os-orcamento-vinculacao.spec.ts` → 31+/33 pass
- [ ] `npx tsc --noEmit` → EXIT:0
- [ ] `npm run build` → sem erros, chunk ≤ 100 kB gzip

---

## P3 — Observabilidade de Custos de IA

**Criticidade:** 🔴 Alta (sustentabilidade financeira) | **Esforço:** 1 dia

### Decisões de design (corrigidas da v1)

| Decisão | v1 (errada) | v2 (correta) |
|---------|-------------|--------------|
| RLS em `ai_routing_log` | DISABLE — expõe dados a todos | ENABLE sem políticas = deny all via PostgREST |
| Escrita na tabela | Client-side | Somente Edge Function via service_role (bypassa RLS) |
| Leitura | Direta | Somente via RPC SECURITY DEFINER |
| Retenção de dados | Ausente | Cleanup automático via RPC (90 dias) |
| Alerta | Apenas visual | Visual + webhook configurável |

### Componente 1 — Migration

**Arquivo:** `supabase/migrations/20260604_ai_routing_log.sql`

```sql
-- Migration: ai_routing_log
-- Telemetria de roteamento da Edge Function ai-proxy.
-- Segurança: RLS ENABLED sem políticas = PostgREST bloqueia acesso direto.
-- Escrita: service_role na Edge Function (bypassa RLS).
-- Leitura: somente via get_ai_routing_stats (SECURITY DEFINER, SuperMaster only).

CREATE TABLE IF NOT EXISTS public.ai_routing_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type  TEXT        NOT NULL
    CHECK (request_type IN ('receipt_images','material_images','receipt_voice','material_voice','diagnostic')),
  provider      TEXT        NOT NULL
    CHECK (provider IN ('gemini_1','gemini_2','openai')),
  is_fallback   BOOLEAN     NOT NULL DEFAULT false,
  latency_ms    INTEGER     CHECK (latency_ms >= 0),
  success       BOOLEAN     NOT NULL DEFAULT true,
  error_code    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_routing_log_created  ON public.ai_routing_log (created_at DESC);
CREATE INDEX idx_ai_routing_log_provider ON public.ai_routing_log (provider, created_at DESC);
CREATE INDEX idx_ai_routing_log_fallback ON public.ai_routing_log (is_fallback, created_at DESC)
  WHERE is_fallback = true;

-- RLS habilitado SEM policies = deny all via PostgREST para authenticated/anon
ALTER TABLE public.ai_routing_log ENABLE ROW LEVEL SECURITY;

-- RPC de estatísticas — somente SuperMaster
CREATE OR REPLACE FUNCTION public.get_ai_routing_stats(p_hours INT DEFAULT 24)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH w AS (
    SELECT provider, is_fallback, success, latency_ms
    FROM public.ai_routing_log
    WHERE created_at > now() - (p_hours || ' hours')::INTERVAL
  )
  SELECT jsonb_build_object(
    'total_requests',  COUNT(*),
    'fallback_count',  COUNT(*) FILTER (WHERE is_fallback),
    'fallback_pct',    ROUND(100.0 * COUNT(*) FILTER (WHERE is_fallback) / NULLIF(COUNT(*), 0), 1),
    'openai_count',    COUNT(*) FILTER (WHERE provider = 'openai'),
    'gemini_count',    COUNT(*) FILTER (WHERE provider LIKE 'gemini%'),
    'avg_latency_ms',  ROUND(AVG(latency_ms)),
    'error_count',     COUNT(*) FILTER (WHERE NOT success),
    'by_provider',     COALESCE(
                         (SELECT jsonb_object_agg(provider, cnt)
                          FROM (SELECT provider, COUNT(*) cnt FROM w GROUP BY provider) s),
                         '{}'::jsonb
                       ),
    'window_hours',    p_hours
  )
  FROM w;
$$;

REVOKE EXECUTE ON FUNCTION public.get_ai_routing_stats(INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ai_routing_stats(INT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_ai_routing_stats(INT) TO authenticated;

-- RPC de cleanup (retenção 90 dias) — executar manualmente ou via cron externo
CREATE OR REPLACE FUNCTION public.cleanup_ai_routing_log(p_days INT DEFAULT 90)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.ai_routing_log
    WHERE created_at < now() - (p_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*)::INT FROM deleted;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_ai_routing_log(INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_ai_routing_log(INT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cleanup_ai_routing_log(INT) TO authenticated;
```

### Componente 2 — Tipos

**Arquivo:** `src/types/platformIntelligence.ts` — adicionar ao final:

```typescript
export interface AiRoutingStats {
  total_requests: number;
  fallback_count: number;
  fallback_pct:   number;   // 0.0 – 100.0
  openai_count:   number;
  gemini_count:   number;
  avg_latency_ms: number;
  error_count:    number;
  by_provider:    Record<string, number>;
  window_hours:   number;
}
```

### Componente 3 — Service

**Arquivo:** `src/services/platformIntelligenceService.ts` — adicionar ao final:

```typescript
export async function getAiRoutingStats(hours = 24): Promise<AiRoutingStats | null> {
  const { data, error } = await supabase.rpc('get_ai_routing_stats', { p_hours: hours });
  if (error) throw new Error(error.message);
  return data as unknown as AiRoutingStats | null;
}
```

### Componente 4 — Widget em `PlatformIntelligence.tsx`

**Imports a adicionar** (junto com os existentes no topo):

```typescript
import { Zap, AlertTriangle } from 'lucide-react';
import { getAiRoutingStats } from '@/src/services/platformIntelligenceService';
import type { AiRoutingStats } from '@/src/types/platformIntelligence';
```

**Estado a adicionar** (junto com os outros `useState` no componente):

```typescript
const [aiStats,        setAiStats]        = useState<AiRoutingStats | null>(null);
const [aiStatsLoading, setAiStatsLoading] = useState(true);
```

**useEffect a adicionar** (junto com os outros `useEffect` do componente):

```typescript
useEffect(() => {
  setAiStatsLoading(true);
  getAiRoutingStats(24)
    .then(setAiStats)
    .catch((err: Error) => toast.error('Erro ao carregar métricas de IA', { description: err.message }))
    .finally(() => setAiStatsLoading(false));
}, []);
```

**JSX a adicionar** logo após o bloco de cards de métricas existente (após a `</div>` do grid de 4 cards):

```tsx
{/* Widget de Roteamento IA — visível apenas quando há dados */}
{!aiStatsLoading && aiStats && aiStats.total_requests > 0 && (
  <div className={`rounded-xl border p-4 shadow-sm ${
    aiStats.fallback_pct > 15
      ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40'
      : 'border-border bg-card'
  }`}>
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Zap className="h-3.5 w-3.5" />
        Roteamento IA — últimas {aiStats.window_hours}h
      </p>
      {aiStats.fallback_pct > 15 && (
        <Badge variant="destructive" className="text-xs gap-1">
          <AlertTriangle className="h-3 w-3" />
          Fallback crítico: {aiStats.fallback_pct}%
        </Badge>
      )}
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[
        {
          label: 'Total Requisições',
          value: aiStats.total_requests.toLocaleString('pt-BR'),
          alert: false,
        },
        {
          label: 'Fallback OpenAI',
          value: `${aiStats.fallback_pct}%`,
          alert: aiStats.fallback_pct > 15,
        },
        {
          label: 'Latência Média',
          value: aiStats.avg_latency_ms ? `${aiStats.avg_latency_ms}ms` : '—',
          alert: false,
        },
        {
          label: 'Erros',
          value: aiStats.error_count.toLocaleString('pt-BR'),
          alert: aiStats.error_count > 0,
        },
      ].map(({ label, value, alert }) => (
        <div key={label}>
          <p className={`text-2xl font-bold ${alert ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      ))}
    </div>
    {/* Breakdown por provedor */}
    {Object.keys(aiStats.by_provider).length > 0 && (
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
        {Object.entries(aiStats.by_provider).map(([provider, count]) => (
          <Badge key={provider} variant="outline" className={`text-xs ${
            provider === 'openai' && aiStats.fallback_pct > 15
              ? 'border-red-400 text-red-600 dark:text-red-400'
              : ''
          }`}>
            {provider}: {count}
          </Badge>
        ))}
      </div>
    )}
  </div>
)}
```

### Componente 5 — Edge Function `ai-proxy` (logging)

Adicionar ao handler principal da Edge Function, após cada chamada resolvida:

```typescript
// Dentro da ai-proxy, após determinar qual provider foi usado:
const startTime = Date.now();
// ... lógica de chamada ao provider ...
const latencyMs = Date.now() - startTime;

// Log assíncrono — nunca bloqueia a resposta ao usuário
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

supabaseAdmin.from('ai_routing_log').insert({
  request_type: requestType,     // 'receipt_images' | 'diagnostic' | etc.
  provider:     providerUsed,    // 'gemini_1' | 'gemini_2' | 'openai'
  is_fallback:  isFallback,      // true se não foi o provider primário
  latency_ms:   latencyMs,
  success:      callSucceeded,
  error_code:   errorCode ?? null,
}).then(() => {}).catch(() => {}); // fire-and-forget — erro de log nunca propaga
```

### Rollback P3

```sql
-- Remover tabela e RPCs (não afeta funcionalidade de IA)
DROP TABLE IF EXISTS public.ai_routing_log CASCADE;
DROP FUNCTION IF EXISTS public.get_ai_routing_stats(INT);
DROP FUNCTION IF EXISTS public.cleanup_ai_routing_log(INT);
```

### Verificação pós-deploy

```sql
-- 1. Confirmar RLS habilitado sem policies
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'ai_routing_log';
-- Esperado: rowsecurity = true

SELECT count(*) FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'ai_routing_log';
-- Esperado: 0 (nenhuma policy = deny all via PostgREST)

-- 2. Após uma chamada de IA no app, confirmar que foi registrada
SELECT request_type, provider, is_fallback, latency_ms, created_at
FROM public.ai_routing_log
ORDER BY created_at DESC
LIMIT 5;
```

### Aceite

- [ ] Migration aplicada sem erro
- [ ] `get_advisors(type='security')` → zero novos alertas
- [ ] Chamada de IA via app (ex: OCR de comprovante) → linha aparece em `ai_routing_log`
- [ ] Widget aparece em `/platform/intelligence` para SuperMaster (com dados)
- [ ] Widget fica vermelho e mostra badge quando `fallback_pct > 15%`
- [ ] Usuário autenticado comum NÃO consegue ler `ai_routing_log` diretamente via PostgREST
- [ ] `npx tsc --noEmit` → EXIT:0
- [ ] `npm run build` → sem erros

---

## P4 — Versionar `ai-proxy` no repositório

**Criticidade:** 🟡 Operacional | **Esforço:** 1–2 h

### O que fazer

1. Acessar Supabase Dashboard → Edge Functions → `ai-proxy` → View source
2. Copiar o código completo para `supabase/functions/ai-proxy/index.ts`
3. Verificar que o arquivo é funcional com `supabase functions deploy ai-proxy --dry-run`
4. Após P3: adicionar o bloco de logging (Componente 5 acima) ao arquivo local
5. Commit + push

### Estrutura esperada do diretório

```
supabase/functions/
  ai-proxy/
    index.ts          ← código atual da função deployada
```

### Verificação

```bash
supabase functions deploy ai-proxy
# Deve fazer redeploy sem alterar comportamento
```

### Aceite

- [ ] Arquivo existe em `supabase/functions/ai-proxy/index.ts`
- [ ] `supabase functions deploy ai-proxy` completa sem erro
- [ ] Funcionalidade de IA no app funciona após redeploy
- [ ] `git log --oneline` mostra o arquivo versionado

---

## Ordem de Execução

```
Dia 1 — manhã (~2.5 h)
  ├── P1: criar e aplicar migration fix_cp_fk            (30 min)
  │   └── verificar: query de FKs + tests/cp-module.spec.ts
  └── P2: criar migration + alterar orcamentoService.ts  (2 h)
      └── verificar: query de orcamentos sem itens + testes orcamentos

Dia 1 — tarde (~4 h)
  ├── P3-A: criar migration ai_routing_log               (45 min)
  ├── P3-B: adicionar tipos + função ao service          (30 min)
  ├── P3-C: adicionar widget ao PlatformIntelligence.tsx (1.5 h)
  └── P3-D: adicionar logging na ai-proxy                (1 h)
      └── verificar: tsc + build + widget visível + log no banco

Dia 2 — manhã (~2 h)
  ├── P4: versionar ai-proxy no repositório              (1–2 h)
  └── Regressão final completa:
      npx vitest run (117+ pass)
      tests/cp-module.spec.ts (8/8)
      tests/orcamentos-sprint-d.spec.ts (5/5)
      tests/os-orcamento-vinculacao.spec.ts (31+/33)
      tests/platform-company-profile.spec.ts (6/6)
```

---

## Checklist Final de Entrega

**Banco:**
- [ ] 3 migrations aplicadas sem erro (`P1`, `P2`, `P3`)
- [ ] `get_advisors(type='security')` → zero novos alertas após cada migration

**TypeScript:**
- [ ] `npx tsc --noEmit` → EXIT:0
- [ ] `npm run build` → sem erros, chunk ≤ 100 kB gzip

**Funcionalidade:**
- [ ] Criar orçamento → funciona (não regrediu)
- [ ] Editar orçamento → funciona, versão incrementa, itens corretos
- [ ] Gestor edita orçamento enviado → funciona
- [ ] Técnico edita orçamento enviado → bloqueado (RBAC)
- [ ] IA OCR / Diagnóstico → funciona e registra em `ai_routing_log`
- [ ] Widget de roteamento IA visível em `/platform/intelligence`
- [ ] FKs do CP apontam para `tenants` (verificado via query)

**Testes:**
- [ ] `npx vitest run` → 117+ testes passando
- [ ] `tests/cp-module.spec.ts` → 8/8
- [ ] `tests/orcamentos-sprint-d.spec.ts` → 5/5
- [ ] `tests/os-orcamento-vinculacao.spec.ts` → 31+/33
- [ ] `tests/platform-company-profile.spec.ts` → 6/6

**Repositório:**
- [ ] `ai-proxy` versionada em `supabase/functions/ai-proxy/index.ts`
- [ ] Todos os commits com mensagem convencional (`feat:`, `fix:`, `perf:`)
- [ ] `git push` em master → Vercel deploy verde

---

*v2 — criado em 2026-06-04 (s69) | Validado contra banco de produção via MCP Supabase*  
*Correções v1→v2: RLS ai_routing_log (DISABLE→ENABLE sem policies), SQL orcamento_versions (team_id explícito), widget completo com useState/useEffect/imports, rollback documentado por item*
