---
description: Revisão de segurança do diff atual (código de IA ou humano) — checks mecânicos via script único + julgamento das invariantes de segurança do NextAI (RLS, authz, SECURITY DEFINER, field injection, segredos). Camada de domínio que complementa o /security-review genérico.
---

Trate **todo código como não confiável por padrão** — gerado por IA (Claude, Codex, Gemini) ou humano. A revisão tem duas naturezas: o que é **mecânico** (determinístico, scriptável) e o que exige **julgamento** (só o LLM faz, cruzando o diff com as regras do projeto). Não misture.

Ordem de prioridade: **1) segurança → 2) correção lógica → 3) qualidade/aderência à arquitetura.**

## Passo 1 — Checks mecânicos (UMA chamada)

Rode o script portável único:

```
pwsh -File .claude/scripts/security-scan.ps1            # mudanças não-commitadas vs HEAD
pwsh -File .claude/scripts/security-scan.ps1 -Staged    # o que está em stage
pwsh -File .claude/scripts/security-scan.ps1 -Range origin/master..HEAD   # branch inteira
```

Severidade: `[BLOCK]` = zero falso-positivo (segredo hard-coded, `team_members` inexistente) — com `-Strict` reprova; `[WARN]` = heurística (SECURITY DEFINER sem `search_path`/`REVOKE`, `getPublicUrl`, spread de body, `auth.uid()` cru) que **alimenta o julgamento do Passo 2**, nunca bloqueia sozinha.

**Não re-execute esses greps na mão** — o script é a fonte única. Leia a saída e use os WARN como ponto de partida do Passo 2.

## Passo 2 — Julgamento das invariantes NextAI (só o LLM faz)

O grep não entende semântica. Para cada arquivo tocado no diff, cruze contra as regras que exigem raciocínio (cite a armadilha quando aplicável):

**Autorização & multi-tenant**
- Rota nova/alterada: `<RoleGuard>` usa `ROUTE_ROLES` de `src/config/routeAccess.ts` (fonte única) — nunca array de role inline (#70). KPI/drill-down idem.
- Read Supabase: **sem** `.eq('team_id', …)` (o RLS já filtra). Write (INSERT): `team_id` injetado manualmente. Toda tabela nova: policy `team_isolation` RESTRICTIVE + índice em `team_id` no mesmo migration (#59).
- Acesso a recurso por id vindo do cliente: o RLS isola por tenant? Há checagem de ownership quando o tenant não basta?

**SECURITY DEFINER (cruzar com o WARN do script)**
- Tem guard de runtime? — `get_caller_team_id()` (isolamento) **ou** `IF NOT is_platform_master() THEN RAISE` (SuperMaster only) (#47). Sem um dos dois, é falha.
- `SET search_path = 'public'` (#22) + `REVOKE FROM PUBLIC` **e** `FROM anon` + `GRANT TO authenticated` (#48). Trigger function: também `REVOKE FROM authenticated` (#49).
- Após migration: rodar `get_advisors(type='security')` via MCP Supabase → zero **novos** alertas.

**Edge Functions / API pública (service_role bypassa RLS)**
- INSERT/UPDATE via service_role: whitelist explícita `pick(body, ALLOWED_FIELDS)` — nunca `...body` spread (#53). Campos protegidos fora do allow-list: `id, team_id, created_at, os_number, reviewer_id, finished_at`.
- Guard: valida `Authorization: Bearer` + JWT (nunca `== apikey`) (#12). Content-Type checado antes de `req.json()` → 415 (#55).
- Cursor pagination: composto `(created_at, id)` — `created_at` sozinho perde registros em timestamps iguais (#54).
- Erro ao client: genérico; detalhe só em log/telemetria. Rate limit fail-open (#60).

**Segredos & dados sensíveis**
- Nada hard-coded — chaves só via Supabase secrets (`GEMINI_API_KEY_*`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Confirmar que os `[WARN] secret-assign`/`jwt-literal` do script vêm de `env`/secret manager.
- PII/segredo não vaza em log nem em mensagem de erro. Storage privado: `createSignedUrls`, caminho `{bucket}/{team_id}/…`, nunca `getPublicUrl` (#5).

**Validação de input**
- Toda entrada externa validada antes do uso (Zod no front; validação campo-a-campo → 400 RFC 7807 na API). Allowlist > blocklist. Sem concatenação de string em SQL/HTML/shell.

## Passo 3 — OWASP genérico

Para cobertura genérica aprofundada (injection clássica, XSS, CSRF, deps com CVE) que não seja específica do NextAI, delegue ao **`/security-review`** nativo em vez de reimplementar aqui. Esta skill é a camada de **domínio** por cima dele.

## Passo 4 — Gate de merge

Responda item a item com ✅/❌ + justificativa curta (qualquer ❌ bloqueia o merge):

- [ ] `security-scan -Strict` sem `[BLOCK]`?
- [ ] Entradas externas validadas/sanitizadas antes do uso?
- [ ] Sem concatenação de string em SQL/HTML/shell?
- [ ] Autenticação exigida onde devida?
- [ ] Autorização consistente (ROUTE_ROLES / RLS / ownership), sem confiar em id do cliente?
- [ ] RLS: reads sem `.eq(team_id)`, writes injetam `team_id`; tabela nova com policy + índice?
- [ ] SECURITY DEFINER com guard + `search_path` + REVOKE/GRANT? `get_advisors` sem novos alertas?
- [ ] service_role com whitelist (sem `...body`)? Guard de JWT + Content-Type?
- [ ] Sem segredo/PII hard-coded ou em log/erro? Storage privado via signed URL?
- [ ] Testes cobrindo caminho feliz, erro, borda e **autorização** (autorizado × não-autorizado)?

Formato do relatório final: **(1)** resumo (3–5 bullets) · **(2)** achados por severidade (Crítico/Alto/Médio/Baixo) com arquivo:linha + correção em código · **(3)** testes recomendados · **(4)** o gate acima. Se faltar contexto, diga explicitamente e peça — nunca presuma.

---

> **Portabilidade:** o trabalho mecânico vive em `.claude/scripts/security-scan.ps1` — qualquer harness (Codex, Gemini) roda `pwsh -File .claude/scripts/security-scan.ps1` direto, sem precisar desta skill. O mesmo script é a autoridade do CI (`.github/workflows/security-scan.yml -Strict`) e do hook local advisory (`.githooks/pre-commit`). Esta skill é a camada de julgamento do Claude Code por cima dele.
