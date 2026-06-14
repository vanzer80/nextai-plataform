# NextAI — Portal Mopar · Regras para Agentes de IA

> Espelho condensado do `CLAUDE.md` (fonte da verdade — leia-o para detalhes completos,
> incluindo as 66 armadilhas documentadas). Responder sempre em português do Brasil.

## Projeto

- App SaaS multi-tenant white-label de field service (OS, orçamentos, RH/DP, financeiro, API pública).
- Repo: `https://github.com/vanzer80/nextai-plataform.git` · Produção: `https://nextai-plataform.vercel.app` (auto-deploy ao push no master).
- **NUNCA commitar a pasta `nextai-landing/`** — é outro repositório.

## Stack

React 19 + TypeScript 5.8 + Vite 6 (SPA, lazy loading por rota) · Tailwind CSS 4 + Shadcn/UI (base-ui) · Supabase (Auth, PostgreSQL com RLS multi-tenant, Storage, Realtime, Edge Functions em Deno) · react-hook-form + Zod v4 · jsPDF 4 · Vitest + Playwright · PWA (`public/sw.js`).

## Verificações obrigatórias após qualquer mudança

```bash
npx tsc --noEmit     # EXIT:0 sem output
npm run build        # chunk principal ≤ 100 kB gzip
npx vitest run       # todos os testes passando
```

Dev server: `npm run dev` (porta 3001).

## Segurança — antes de commitar (não pular)

Código de IA = **não confiável por padrão**. Antes de commitar mudança que toque SQL/migration, Edge Function, `service_role`, RLS, Storage ou auth/roles:

```bash
pwsh -File .claude/scripts/security-scan.ps1   # resolva todo [BLOCK] (segredo, team_members); [WARN] = revisar
```

O mesmo script roda no hook `.githooks/pre-commit` (bloqueia em BLOCK) e no CI `security-scan.yml` (autoridade). Auditoria de domínio completa (RLS, authz, SECURITY DEFINER, field injection): skill `/revisar-seguranca`, complementa o `/security-review` genérico.

## Regras críticas de banco (não violar)

- `team_id` vem de `public.users` (NUNCA `team_members` — não existe). Padrão `getTeamId()` no CLAUDE.md.
- **Reads:** NÃO adicionar `.eq('team_id', teamId)` — o RLS já filtra.
- **Writes (INSERT):** injetar `team_id` manualmente — RLS não injeta em inserts.
- Toda nova tabela: policy `team_isolation` RESTRICTIVE + índice em `team_id` no mesmo migration.
- Policies RLS: sempre `(SELECT auth.uid())`, nunca `auth.uid()` raw (initplan).
- FK ambígua employees↔departments: usar hint por coluna `department:department_id(name)`.
- `.single()` que pode retornar 0 linhas → `.maybeSingle()`.
- SECURITY DEFINER: sempre `SET search_path = 'public'` + guard (`get_caller_team_id()` OU `is_platform_master()`) + `REVOKE FROM PUBLIC` + `REVOKE FROM anon` + `GRANT TO authenticated`.
- `CREATE OR REPLACE` não muda tipo de retorno de TABLE functions → `DROP FUNCTION` antes.
- `schema-atual.sql` está desatualizado — inspecionar o banco real, não o arquivo.
- Status de `service_reports`: `draft|pending_review|returned|approved|rejected` (nunca PT).

## Convenções de código

- Nenhum `any` explícito. Nenhum comentário óbvio (só WHY não-óbvio).
- Toda rota em `App.tsx` deve ser `React.lazy()` — sem exceção.
- Novo módulo: migration → types → service → hook → componente → página → rota + nav + onboarding tour.
- Item de sidebar: adicionar em `NAV_GROUPS` (AppLayout.tsx) no grupo funcional correto.
- Dentro da sidebar: SEMPRE tokens `bg-sidebar-*` / `text-sidebar-*` (nunca `bg-background`).
- Tailwind: nunca classes dinâmicas tipo `bg-${color}-50` — usar classes literais completas.
- Zod v4: sem `invalid_type_error`; sem `.default()` com `zodResolver` (usar `defaultValues`).
- React 19: `key` em `<Fragment key={id}>`; `react-signature-canvas` incompatível (canvas nativo).
- Storage privado: nunca `getPublicUrl` — usar `createSignedUrls`. Arquivos em `{bucket}/{team_id}/...`.
- Dashboard KPIs: nunca valores hardcoded de fallback — 0 quando sem dados reais.
- jsPDF 4.x: sem `setLineDash`; medir imagens com `measureImage` (src/utils/imageUtils.ts), nunca `getImageProperties`.

## Edge Functions (Deno — supabase/functions/)

- try/catch EXTERNO cobrindo o handler inteiro, sempre respondendo com corsHeaders.
- `Deno.openKv()` lança em produção — rate limit fail-open com fallback `Map` in-memory (ver ai-proxy v15).
- Guard: `Authorization: Bearer` + JWT (nunca comparar com `apikey`). Content-Type validado antes de `req.json()` (415).
- Writes via service_role: whitelist explícita de campos (`pick(body, ALLOWED_FIELDS)`) — nunca spread do body.
- ai-proxy usa gemini-2.5-flash + thinkingBudget:0 — NUNCA voltar para gemini-2.0-flash (free tier zerado).
- Secrets só via Supabase secrets, nunca no .env.

## Testes

- **NUNCA rodar spec files Playwright em paralelo** — Supabase free tier + Vite não aguentam (ERR_CONNECTION_REFUSED em cascata). Um spec por vez.
- `waitForResponse` configurado ANTES do click. Credenciais em `tests/.env.test` (gitignored).
- Supabase free tier hiberna: pré-aquecer logando no app antes de E2E/demos.
- Novo export em service mockado: atualizar o `vi.mock` correspondente.

## Roles e tenants

```
Tecnico | Administrativo | Supervisor | Gestor | Financeiro | Comprador | Admin | Master | Cliente
SuperMaster = Master + tenant.is_platform=true
```
Tenants: nextai (plataforma) · mopar · zamb-eng. RoleGuard de `/orcamentos/*` exclui Tecnico.
