# Prompts Claude Code — NextAI 2026
*Pré-requisito: CLAUDE.md na raiz do repositório (copiar de `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\CLAUDE.md` para `C:\Users\vanze\OneDrive\Área de Trabalho\portal-mopar\CLAUDE.md`)*

---

## PROMPT 1 — GitHub Actions: Keep-alive Supabase (15 min)

```
Leia o CLAUDE.md na raiz do repositório antes de começar.

TAREFA: Criar workflow GitHub Actions para prevenir hibernação do Supabase Free Tier.

ARQUIVO A CRIAR: .github/workflows/supabase-keepalive.yml

REQUISITOS:
- Cron: "0 8 */3 * *" (todo 3 dias às 08h UTC)
- Usa secrets: SUPABASE_URL, SUPABASE_ANON_KEY (já no repositório)
- Faz GET em $SUPABASE_URL/rest/v1/tenants?select=id&limit=1
  com header apikey: $SUPABASE_ANON_KEY
- Se resposta HTTP != 200, falha o step (curl --fail)
- Job name: "ping-supabase"

VERIFICAÇÃO:
- Fazer `act --list` para confirmar o job existe (se act estiver instalado)
- Caso contrário: cat .github/workflows/supabase-keepalive.yml e confirmar YAML válido

GIT: git add .github/workflows/supabase-keepalive.yml && git commit -m "ci: github actions keep-alive supabase free tier"
```

---

## PROMPT 2 — IA de Escrita de OS (1-2 dias)

```
Leia o CLAUDE.md na raiz do repositório antes de começar.

TAREFA: Implementar assistente de IA para preenchimento de Ordens de Serviço.

CONTEXTO:
- Edge Function ai-proxy v8 já existe (GEMINI_API_KEY_1, GEMINI_API_KEY_2, OPENAI_API_KEY)
- OS (service_reports) tem wizard 7 passos em src/pages/reports/NewReport.tsx
- Modelo de dados em src/types/models.ts

ARQUIVOS PARA LER ANTES DE EDITAR:
- src/pages/reports/NewReport.tsx
- src/services/reportService.ts
- supabase/functions/ai-proxy/index.ts

IMPLEMENTAR:
1. Botão "✨ Sugestão IA" nos steps do wizard (descrição do problema, diagnóstico, solução)
2. Hook src/hooks/useAiSuggestion.ts:
   - Chama ai-proxy com prompt contextualizado (tipo de serviço, equipamento, histórico recente da OS)
   - Modelo: gemini-2.0-flash-exp (custo zero)
   - Loading state com skeleton no textarea
   - Erro silencioso: toast "IA indisponível, preencha manualmente"
3. Botão aceitar/descartar sugestão (não sobrescreve automaticamente)
4. Supabase: adicionar coluna `ai_suggestion_used BOOLEAN DEFAULT false` na tabela service_reports

MIGRATION (idempotente):
ALTER TABLE service_reports ADD COLUMN IF NOT EXISTS ai_suggestion_used BOOLEAN DEFAULT false;
CREATE POLICY "team_isolation" ON service_reports ... (seguir padrão RLS do CLAUDE.md)
-- Rodar get_advisors(security) após migration e confirmar zero novos alertas

TESTES (src/hooks/__tests__/useAiSuggestion.test.ts):
- Mock fetch, retorna sugestão → state.suggestion === "texto mockado"
- Mock fetch retorna erro → state.suggestion === null, errorShown === true
- Aceitar sugestão → callback chamado com o texto
- Descartar → state limpo

VERIFICAÇÃO FINAL:
npx tsc --noEmit          # EXIT:0 obrigatório
npx vitest run            # todos os testes passando
npm run build             # chunk principal ≤ 100 kB gzip

GIT: git add -A && git commit -m "feat(ai): assistente IA para preenchimento de OS

- Hook useAiSuggestion com gemini-2.0-flash-exp via ai-proxy
- Botão Sugestão IA nos steps descrição/diagnóstico/solução
- ai_suggestion_used column em service_reports
- Testes unitários: 3 cenários (sucesso, erro, aceitar/descartar)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## PROMPT 3 — Email nas aprovações (Resend) (1-2 dias)

```
Leia o CLAUDE.md na raiz do repositório antes de começar.

TAREFA: Enviar emails transacionais nas aprovações/rejeições de OS e Reembolsos via Resend.

CONTEXTO:
- Edge Function send-csat-email já existe — usar como modelo de arquitetura
- Resend free tier: 3.000 emails/mês
- Secret RESEND_API_KEY já deve ser adicionado no Supabase (fazer isso primeiro)

ARQUIVOS PARA LER ANTES DE EDITAR:
- supabase/functions/send-csat-email/index.ts
- src/services/reportService.ts (função processReportAction)
- src/services/reimbursementService.ts (função processReimbursementAction)

IMPLEMENTAR:
1. Nova Edge Function: supabase/functions/send-notification-email/index.ts
   - Aceita POST: { to: string, subject: string, type: 'approved'|'rejected'|'returned', entityType: 'report'|'reimbursement', entityId: string, comment?: string }
   - Guard: Authorization Bearer + JWT (conforme armadilha #13 do CLAUDE.md)
   - HTML template inline simples com logo NextAI e status badge colorido
   - Chama https://api.resend.com/emails com RESEND_API_KEY
   - From: "NextAI <notificacoes@nextai.com.br>"

2. Chamar a EF após cada ação de aprovação/rejeição/devolução:
   - reportService.ts: processReportAction → após sucesso, fire-and-forget para a EF
   - reimbursementService.ts: processReimbursementAction → idem

3. Buscar email do solicitante: já disponível no JOIN com users (coluna email)

DEPLOY: supabase functions deploy send-notification-email

TESTES (supabase/functions/send-notification-email/index.test.ts com Deno test):
- Payload válido → fetch para Resend chamado com corpo correto
- Authorization ausente → retorna 401
- RESEND_API_KEY ausente → retorna 500 com mensagem genérica

VERIFICAÇÃO FINAL:
npx tsc --noEmit          # EXIT:0
npx vitest run            # todos passando
npm run build             # ≤ 100 kB gzip

GIT: git add -A && git commit -m "feat(email): notificações Resend em aprovações de OS e Reembolsos

- Edge Function send-notification-email com template HTML
- Fire-and-forget em reportService e reimbursementService
- Guard JWT conforme padrão de segurança do projeto
- Testes unitários Deno para a EF

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## PROMPT 4 — NFS-e via API terceira (Focus NF-e) (3-5 dias)

```
Leia o CLAUDE.md na raiz do repositório antes de começar.

TAREFA: Integrar emissão de NFS-e (Nota Fiscal de Serviço Eletrônica) via Focus NF-e API.
OBRIGAÇÃO LEGAL: Vigente desde janeiro/2026 para empresas de serviço no Brasil.

CONTEXTO:
- Integração via Focus NF-e (https://focusnfe.com.br) — API REST
- Emissão acionada ao aprovar um Orçamento (status: approved)
- Dados do orçamento: orcamentos + orcamento_itens + clients + users
- Secrets a adicionar no Supabase: FOCUS_NFE_TOKEN, FOCUS_NFE_ENV (producao|homologacao)

ARQUIVOS PARA LER ANTES DE EDITAR:
- src/services/orcamentoService.ts
- src/pages/orcamentos/OrcamentoDetail.tsx
- src/types/models.ts (interface Orcamento)

MIGRATION:
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS nfse_id TEXT;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS nfse_status TEXT; -- pendente|emitida|erro|cancelada
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS nfse_url TEXT;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS nfse_numero TEXT;
-- RLS: herda da policy existente de orcamentos (team_id = get_caller_team_id())
-- Rodar get_advisors(security) após migration

IMPLEMENTAR:
1. Edge Function: supabase/functions/emit-nfse/index.ts
   - Aceita POST: { orcamento_id: string }
   - Guard: Authorization Bearer + JWT
   - Busca orçamento completo do Supabase (join com client, itens, tenant)
   - Monta payload NFS-e conforme Focus NF-e schema (campos: tomador, servicos, valor_servicos, iss_retido, etc.)
   - POST para https://api.focusnfe.com.br/v2/nfse (header Authorization: Token FOCUS_NFE_TOKEN)
   - Atualiza orcamentos: nfse_id, nfse_status='emitida', nfse_url, nfse_numero
   - Em caso de erro da Focus: nfse_status='erro', não lança exceção (registra e retorna 200 com body {error})

2. src/services/orcamentoService.ts: nova função emitirNfse(orcamentoId: string)
   - Chama a EF
   - Retorna { success: boolean, nfseNumero?: string, error?: string }

3. src/pages/orcamentos/OrcamentoDetail.tsx: botão "Emitir NFS-e"
   - Visível apenas para status=approved E nfse_status != 'emitida'
   - Roles: Gestor, Admin, Master
   - Após emissão: badge verde com número da NFS-e + link PDF (nfse_url)
   - Loading state durante emissão (processo pode levar 5-30s)

4. src/types/models.ts: adicionar campos nfse_* na interface Orcamento

DEPLOY: supabase functions deploy emit-nfse

TESTES (src/services/__tests__/orcamentoService.nfse.test.ts):
- Mock EF retorna sucesso → nfse_status = 'emitida', número preenchido
- Mock EF retorna erro Focus → nfse_status = 'erro', sem throw
- Botão invisível quando nfse_status = 'emitida' (teste de render)

VERIFICAÇÃO FINAL:
npx tsc --noEmit
npx vitest run
npm run build

GIT: git add -A && git commit -m "feat(fiscal): integração NFS-e via Focus NF-e API

- Edge Function emit-nfse com payload conforme schema Focus NF-e
- Campos nfse_* em orcamentos (migration idempotente + RLS herdada)
- Botão Emitir NFS-e em OrcamentoDetail (Gestor+)
- Badge com número NFS-e e link PDF pós-emissão
- Testes: sucesso, erro Focus, visibilidade do botão

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## PROMPT 5 — Billing + Subdomains (Stripe) (3-4 semanas)

```
Leia o CLAUDE.md na raiz do repositório antes de começar.

TAREFA: Implementar billing SaaS com Stripe e routing por subdomínio por tenant.
ESCOPO DESTA SESSÃO: Apenas Fase 1 — schema de billing + webhook Stripe + UI de planos.

FASE 1 — Schema e Stripe Webhook:

MIGRATION:
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                    -- 'starter'|'professional'|'enterprise'
  price_monthly NUMERIC(10,2) NOT NULL,
  max_users INT NOT NULL,
  max_storage_gb INT NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  stripe_price_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES billing_plans(id);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'trial';
  -- valores: trial|active|past_due|canceled
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '30 days');

-- RLS em billing_plans: somente leitura para authenticated
CREATE POLICY "plans_readable" ON billing_plans FOR SELECT TO authenticated USING (true);
-- tenants: SuperMaster já tem acesso via SECURITY DEFINER RPCs

-- Rodar get_advisors(security) após migration

Edge Function: supabase/functions/stripe-webhook/index.ts
- Valida Stripe-Signature (stripe.webhooks.constructEvent)
- Eventos tratados: customer.subscription.created, .updated, .deleted, invoice.payment_failed
- Atualiza tenants: plan_status conforme evento
- Secret: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY

src/pages/platform/PlatformTenants.tsx (já existe):
- Adicionar coluna "Plano" e "Status" na tabela de tenants
- Badge colorido: trial=azul, active=verde, past_due=laranja, canceled=vermelho

src/pages/admin/BillingPage.tsx (nova página /admin/billing):
- Exibe plano atual, data de trial, botão "Fazer upgrade" (abre Stripe Customer Portal via EF)
- Roles: Admin, Master
- Rota lazy em App.tsx

FASE 2 (próxima sessão — NÃO implementar agora):
- Subdomínio: mopar.nextai.com.br → lookup tenant por slug no middleware Vercel
- vercel.json rewrites para rotear *.nextai.com.br

TESTES:
- Webhook received customer.subscription.updated → tenants.plan_status atualizado
- BillingPage renderiza plano atual do contexto do tenant
- Badge 'past_due' aparece em laranja

VERIFICAÇÃO FINAL:
npx tsc --noEmit
npx vitest run
npm run build

GIT: git add -A && git commit -m "feat(billing): Stripe billing Fase 1 — schema + webhook + BillingPage

- Tabela billing_plans + colunas Stripe em tenants (migration idempotente)
- Edge Function stripe-webhook: subscription created/updated/deleted + payment_failed
- BillingPage /admin/billing com plano atual e status badge
- Coluna Plano/Status em PlatformTenants (SuperMaster)
- Testes: webhook handler, render BillingPage, badge past_due

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## PROMPT 6 — eSocial (transmissão eletrônica) (2-3 semanas)

```
Leia o CLAUDE.md na raiz do repositório antes de começar.

TAREFA: Implementar transmissão eSocial para eventos de folha e ponto.
ESCOPO DESTA SESSÃO: Apenas Fase 1 — geração de XML S-1200 (Remuneração) e S-2206 (Alteração Contrato).
OBRIGAÇÃO LEGAL: eSocial substituiu DIRF em 2024 e é obrigatório em 2026.

CONTEXTO:
- Módulo DP já funciona: folha calculada corretamente (INSS 2024, IRRF, FGTS, VT)
- Cálculos em src/services/payrollService.ts
- Integração via WebmaniaBR API (https://webmaniabr.com/esocial) — REST, sem certificado digital próprio
- Secret a adicionar: WEBMANIABR_TOKEN

ARQUIVOS PARA LER ANTES DE EDITAR:
- src/services/payrollService.ts
- src/pages/dp/PayrollDetail.tsx
- src/types/models.ts (interfaces Employee, PayrollEntry)

MIGRATION:
ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS esocial_status TEXT DEFAULT 'pendente';
  -- pendente|enviado|processado|rejeitado
ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS esocial_protocolo TEXT;
ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS esocial_sent_at TIMESTAMPTZ;
-- Rodar get_advisors(security) após migration

IMPLEMENTAR:
1. src/lib/esocial.ts — helper de montagem do payload S-1200:
   - Função buildS1200Payload(period: PayrollPeriod, entries: PayrollEntry[], tenantCNPJ: string): object
   - Segue schema WebmaniaBR: { competencia, cnpj, trabalhadores: [{cpf, matricula, remuneracao, descontos...}] }
   - Pure function — testável sem side effects

2. Edge Function: supabase/functions/esocial-transmit/index.ts
   - Aceita POST: { period_id: string }
   - Guard: Authorization Bearer + JWT
   - Busca period + entries + employees (com CPF) via Supabase
   - Chama buildS1200Payload
   - POST para WebmaniaBR API com WEBMANIABR_TOKEN
   - Atualiza payroll_periods: esocial_status, esocial_protocolo, esocial_sent_at

3. src/pages/dp/PayrollDetail.tsx: botão "Transmitir eSocial"
   - Visível apenas quando period.status = 'closed' E esocial_status != 'enviado'
   - Roles: Gestor, Admin, Master
   - Badge de status pós-transmissão (verde=processado, laranja=pendente, vermelho=rejeitado)

DEPLOY: supabase functions deploy esocial-transmit

TESTES (src/lib/__tests__/esocial.test.ts):
- buildS1200Payload com 2 funcionários → objeto com 2 trabalhadores, competencia correta
- CPF ausente → lança erro "Funcionário sem CPF"
- Remuneração bruta = base_salary - descontos corretos

VERIFICAÇÃO FINAL:
npx tsc --noEmit
npx vitest run
npm run build

GIT: git add -A && git commit -m "feat(esocial): transmissão eSocial S-1200 via WebmaniaBR

- src/lib/esocial.ts: buildS1200Payload (pure function, testável)
- Edge Function esocial-transmit com guard JWT
- esocial_status/protocolo/sent_at em payroll_periods (migration idempotente)
- Botão Transmitir eSocial em PayrollDetail (period.closed + Gestor+)
- Testes: payload correto, CPF ausente, cálculo remuneração

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## PROMPT 7 — LGPD Sprint 14 (1 semana)

```
Leia o CLAUDE.md na raiz do repositório antes de começar.

TAREFA: Implementar conformidade LGPD — tabela de auditoria, exportação de dados e política de retenção.

ARQUIVOS PARA LER ANTES DE EDITAR:
- src/pages/admin/usuarios/UserManagement.tsx
- src/contexts/AuthContext.tsx
- src/types/models.ts

MIGRATION:
-- Tabela de auditoria imutável (sem UPDATE/DELETE policies)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,            -- 'login'|'logout'|'create'|'update'|'delete'|'export'|'view'
  entity_type TEXT,                -- 'service_report'|'employee'|'orcamento'|...
  entity_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: INSERT permitido para authenticated (team_id = get_caller_team_id())
--      SELECT permitido apenas para Admin/Master do mesmo tenant
--      UPDATE e DELETE proibidos (auditoria imutável)
CREATE POLICY "audit_insert" ON audit_log FOR INSERT TO authenticated
  WITH CHECK (team_id = get_caller_team_id());
CREATE POLICY "audit_select_admin" ON audit_log FOR SELECT TO authenticated
  USING (team_id = get_caller_team_id() AND get_auth_role() IN ('Admin','Master','Gestor'));
-- NENHUMA policy UPDATE ou DELETE

-- Rodar get_advisors(security) após migration

IMPLEMENTAR:
1. src/lib/audit.ts — helper:
   - logAction(action, entityType?, entityId?, metadata?): Promise<void>
   - Fire-and-forget (não bloqueia a UI, erro silencioso)
   - Captura ip_address via headers da request (disponível apenas em EF — client-side: null)

2. Instrumentar ações críticas (adicionar logAction após sucesso):
   - AuthContext: login → 'login', logout → 'logout'
   - reportService: create → 'create'/'service_report', approve/reject → 'update'
   - orcamentoService: create, approve, emit-nfse → 'create'/'update'
   - reimbursementService: submit, approve/reject → 'create'/'update'
   - employeeService: create, update, delete → correspondentes

3. src/pages/admin/AuditLogPage.tsx (nova página /admin/audit):
   - Tabela paginada (50/página) com colunas: data/hora, usuário, ação, entidade, IP
   - Filtros: ação, usuário, período (date range picker)
   - Roles: Admin, Master
   - Rota lazy em App.tsx

4. Exportação LGPD Art. 18 — em UserManagement.tsx (botão "Exportar meus dados"):
   - RPC export_my_data() que retorna JSONB com todos os dados do usuário autenticado
   - Gera download JSON no browser
   - Roles: qualquer usuário autenticado (próprios dados)

5. Política de retenção em src/pages/platform/PlatformSettings.tsx:
   - Campo "Retenção de logs (dias)" salvo em tenants.audit_retention_days INT DEFAULT 365
   - Cron GitHub Actions (ou pg_cron): DELETE FROM audit_log WHERE created_at < now() - (SELECT audit_retention_days || ' days')::interval

TESTES (src/lib/__tests__/audit.test.ts):
- logAction 'login' → supabase.from('audit_log').insert chamado com campos corretos
- Erro no insert → não lança, não bloqueia
- AuditLogPage renderiza tabela com dados mockados e filtros funcionando

VERIFICAÇÃO FINAL:
npx tsc --noEmit          # EXIT:0 obrigatório
npx vitest run            # todos os testes passando (118+ com os novos)
npm run build             # chunk principal ≤ 100 kB gzip
npx playwright test       # E2E (se tests/.env.test configurado)

GIT: git add -A && git commit -m "feat(lgpd): auditoria imutável + exportação LGPD + retenção

- audit_log imutável: INSERT allowed, UPDATE/DELETE blocked por RLS
- src/lib/audit.ts: logAction fire-and-forget, instrumentado em 5 services
- AuditLogPage /admin/audit: tabela paginada + filtros + export CSV
- RPC export_my_data: exportação JSON dados próprios (Art. 18)
- tenants.audit_retention_days + política de retenção configurável
- Testes: insert correto, falha silenciosa, render da tabela

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## ANTES DE USAR OS PROMPTS

**Passo obrigatório:** Copie o arquivo `CLAUDE.md` do vault Obsidian para a raiz do repositório:

```
Origem:  C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\CLAUDE.md
Destino: C:\Users\vanze\OneDrive\Área de Trabalho\portal-mopar\CLAUDE.md
```

O Claude Code lê o `CLAUDE.md` automaticamente em toda sessão — isso elimina a necessidade de repassar contexto manualmente.

**Ordem de execução recomendada:**
1. Prompt 1 (Keep-alive) — 15 min, risco zero, resultado imediato
2. Prompt 3 (Email Resend) — fundação para notificações dos demais módulos
3. Prompt 2 (IA de OS) — diferencial competitivo principal
4. Prompt 7 (LGPD) — conformidade legal urgente
5. Prompt 4 (NFS-e) — obrigação legal vigente
6. Prompt 6 (eSocial) — obrigação legal 2026
7. Prompt 5 (Billing/Stripe) — monetização SaaS
