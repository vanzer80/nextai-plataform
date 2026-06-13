# Sprint D — CPQ: Assinatura Eletrônica + Versionamento de Orçamento
*Status: Planejado | Pré-requisito: [[Sprint C — Portal Cliente + CSAT + Agenda]] concluído*

---

## Objetivo

Fechar o ciclo **quote-to-cash** do módulo de Orçamentos com assinatura eletrônica do cliente e rastreabilidade completa de versões. Esses dois recursos transformam o orçamento de um PDF enviado por fora em um contrato digital rastreável — diferencial direto contra Salesforce CPQ.

---

## Feature D1 — Assinatura Eletrônica no Orçamento

### Problema
O orçamento é aprovado internamente pelo Gestor, mas a aceitação formal do cliente acontece fora do sistema (email/WhatsApp "tudo bem, pode fazer"). Salesforce CPQ integra DocuSign/EchoSign. Para o porte do NextAI, uma solução own-built com canvas signature é suficiente e elimina dependência de serviço externo.

### Referência de mercado
Salesforce CPQ: DocuSign integration. Coupa: e-signature nativo. Para MVP: canvas draw + timestamp + IP como evidência de aceite.

### Acceptance Criteria
- [ ] Após orçamento aprovado, Gestor pode "Enviar para assinatura do cliente" — gera link único com token
- [ ] Página pública `/orcamentos/{id}/assinar/{token}` — sem autenticação
  - Exibe resumo do orçamento (itens, totais, validade)
  - Canvas para assinatura com dedo/mouse
  - Campos: nome completo do signatário, cargo, email
  - Botão "Assinar e Aceitar" → salva assinatura + timestamp + IP
- [ ] Token expira em `validade` do orçamento ou 30 dias, o que vier primeiro
- [ ] Após assinatura, status muda para `assinado`, PDF é gerado com assinatura no rodapé
- [ ] Notificação para Gestor e Técnico dono do orçamento
- [ ] Gestor pode ver status "Assinado por {nome}" no OrcamentoDetail

### Schema DB (Migration: `orcamento_signature_flow`)

```sql
-- Novo status no enum
ALTER TYPE public.orcamento_status ADD VALUE IF NOT EXISTS 'assinado';

-- Tokens para assinatura pública
CREATE TABLE public.orcamento_sign_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id    uuid NOT NULL UNIQUE REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at      timestamptz NOT NULL,
  created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  team_id         uuid NOT NULL DEFAULT get_caller_team_id()
);

-- Registro de assinatura
CREATE TABLE public.orcamento_signatures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id    uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  token_id        uuid NOT NULL REFERENCES public.orcamento_sign_tokens(id),
  signer_name     text NOT NULL,
  signer_email    text,
  signer_role     text,
  signature_url   text NOT NULL,   -- Storage path do canvas PNG
  signed_at       timestamptz NOT NULL DEFAULT now(),
  signer_ip       text,
  team_id         uuid NOT NULL
);

ALTER TABLE public.orcamento_sign_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_signatures   ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_isolation ON public.orcamento_sign_tokens AS RESTRICTIVE
  FOR ALL TO authenticated USING (team_id = get_caller_team_id()) WITH CHECK (team_id = get_caller_team_id());
CREATE POLICY team_isolation ON public.orcamento_signatures AS RESTRICTIVE
  FOR ALL TO authenticated USING (team_id = get_caller_team_id()) WITH CHECK (team_id = get_caller_team_id());

-- Acesso anon para assinar
CREATE POLICY orcamento_sign_public_insert ON public.orcamento_signatures
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orcamento_sign_tokens
      WHERE id = token_id AND expires_at > now()
    )
  );
```

### RPC: `sign_orcamento(p_token, p_signer_name, p_signer_email, p_signer_role, p_signature_url, p_signer_ip)`
- SECURITY DEFINER (acesso anon controlado)
- Valida token (existe + não expirado)
- Insere em `orcamento_signatures`
- Atualiza `orcamentos.status = 'assinado'`
- Insere em `orcamento_history`
- Notifica Gestor + Técnico via `notifications`
- SET search_path = 'public'

### Arquivos afetados
| Arquivo | Ação |
|---------|------|
| `src/types/orcamento.ts` | Adicionar `'assinado'` ao OrcamentoStatus |
| `src/pages/orcamentos/OrcamentoSign.tsx` | Página pública de assinatura (novo) |
| `src/components/SignatureCanvas.tsx` | Reutilizar componente existente (se houver) ou novo |
| `src/pages/orcamentos/OrcamentoDetail.tsx` | Botão "Enviar para assinatura" + exibição "Assinado por" |
| `src/utils/gerarPdfOrcamento.ts` | Incluir assinatura no PDF (novo arquivo de PDF de orçamento) |
| `src/App.tsx` | Rota pública `/orcamentos/:id/assinar/:token` |

---

## Feature D2 — Versionamento de Orçamento

### Problema
Quando um orçamento é rejeitado e o técnico o edita para reenvio, não há registro do que mudou entre a v1 e a v2. Salesforce CPQ mantém histórico completo de versões com diff de conteúdo.

### Acceptance Criteria
- [ ] Toda edição de um orçamento (atualizarOrcamento) cria um snapshot JSON antes de salvar
- [ ] OrcamentoDetail exibe histórico de versões ("v1 enviado em ...", "v2 enviado em ...")
- [ ] Usuário pode expandir versão e ver os itens/valores daquela versão
- [ ] Versão não é um novo orçamento — é um snapshot vinculado ao mesmo `orcamento.id`
- [ ] `orcamento_history` (já existente) registra a mudança de versão

### Schema DB (Migration: `orcamento_versions`)

```sql
CREATE TABLE public.orcamento_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id    uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  version_number  integer NOT NULL,
  snapshot        jsonb NOT NULL,   -- { titulo, observacoes, validade, desconto_pct, itens: [...] }
  created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  team_id         uuid NOT NULL DEFAULT get_caller_team_id()
);

ALTER TABLE public.orcamento_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_isolation ON public.orcamento_versions AS RESTRICTIVE
  FOR ALL TO authenticated USING (team_id = get_caller_team_id()) WITH CHECK (team_id = get_caller_team_id());

CREATE INDEX IF NOT EXISTS idx_orcamento_versions_orcamento_id ON public.orcamento_versions(orcamento_id);
```

### Lógica de versioning em `atualizarOrcamento` (orcamentoService.ts)

```typescript
// Antes de UPDATE, INSERT snapshot:
await supabase.from('orcamento_versions').insert({
  orcamento_id: id,
  version_number: (currentVersionCount + 1),
  snapshot: {
    titulo: current.titulo,
    observacoes: current.observacoes,
    validade: current.validade,
    desconto_pct: current.desconto_pct,
    itens: currentItems,
  },
});
```

### Arquivos afetados
| Arquivo | Ação |
|---------|------|
| `src/services/orcamentoService.ts` | Criar snapshot antes de atualizarOrcamento |
| `src/pages/orcamentos/OrcamentoDetail.tsx` | Painel "Histórico de Versões" colapsável |
| `src/pages/orcamentos/components/OrcamentoVersionPanel.tsx` | Componente de versões (novo) |

---

## Checklist de Sprint D

- [ ] Migrations aplicadas: `orcamento_signature_flow`, `orcamento_versions`
- [ ] RPC `sign_orcamento` testada manualmente com token válido e expirado
- [ ] `get_advisors` — verificar exposição anon da RPC sign_orcamento
- [ ] `tsc --noEmit` EXIT:0
- [ ] Playwright:
  - [ ] D1: URL /orcamentos/:id/assinar/:token exibe formulário e bloqueia token expirado
  - [ ] D1: após assinar, status muda para 'assinado' na listagem
  - [ ] D2: editar orçamento cria entrada em orcamento_versions
- [ ] ADR-007 (E-signature: own-built vs DocuSign) em `docs/adr/`
- [ ] Atualizar `src/types/orcamento.ts` mapas LABEL e COLOR para 'assinado'
- [ ] Commit: `feat(sprint-d): e-signature on quotes, quote versioning`
