# NextAI — Portal Mopar · Contexto de Desenvolvimento

## Ambiente

- **Diretório local:** `C:\Users\vanze\OneDrive\Área de Trabalho\portal-mopar`
- **GitHub:** `https://github.com/vanzer80/nextai-plataform.git`
- **Produção:** `https://nextai-plataform.vercel.app` (auto-deploy ao push no master)
- **Supabase Project ID:** `sksursvmgvxqbbdsztcd`
- **Dev server:** `npm run dev` (porta 3001)
- **Obsidian vault:** `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\`

## Verificações obrigatórias após qualquer mudança

```bash
npx tsc --noEmit          # deve retornar EXIT:0 sem output
npm run build             # chunk principal ≤ 100 kB gzip
npx vitest run            # 117+ testes passando
```

Após migrations: rodar `get_advisors(type='security')` via MCP Supabase → zero novos alertas.

## Stack técnica

React 19 + TypeScript + Vite (SPA com lazy loading por módulo)  
Tailwind CSS + Shadcn/UI (base-ui) + tw-animate-css + @formkit/auto-animate  
Supabase: Auth, PostgreSQL, RLS multi-tenant, Storage, Realtime, Edge Functions  
jsPDF + jspdf-autotable · react-hook-form + Zod v4 · date-fns (ptBR) · sonner  
driver.js v1.4.0 · Vitest (unit) + Playwright (E2E) · PWA: `public/sw.js` cache `nextai-v7`

## Roles

```typescript
type UserRole = 'Tecnico' | 'Administrativo' | 'Supervisor' | 'Gestor' |
                'Financeiro' | 'Comprador' | 'Admin' | 'Master' | 'Cliente';
// SuperMaster = role=Master + isPlatform=true (via tenant.is_platform)
```

## Tenants ativos

| Tenant | Slug | Email | Status |
|--------|------|-------|--------|
| NextAI (plataforma) | nextai | nextai@gmail.com | SuperMaster (is_platform=true) |
| Mopar Engenharia | mopar | master@gmail.com | Ativo |
| Zambrano Engenharia | zamb-eng | zambrano@zambranoengenharia.com.br | Ativo |

Usuários de teste Mopar: `equipemoparsul02@gmail.com` (Técnico), `gestao@gmail.com` (Gestor)

## Regras críticas do banco (não violar)

### getTeamId() — único padrão correto
```typescript
async function getTeamId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const { data } = await supabase.from('users').select('team_id').eq('id', user.id).single();
  if (!data?.team_id) throw new Error('Usuário sem equipe');
  return data.team_id;
}
```
**NUNCA usar `team_members`** — tabela não existe. A tabela é `public.users`.

### RLS multi-tenant
- **Reads:** NÃO adicionar `.eq('team_id', teamId)` — o RLS já filtra via `get_my_team_id()`
- **Writes (INSERT):** injetar `team_id` manualmente — `{ ...dto, team_id }` — RLS não injeta em inserts
- Toda nova tabela precisa de policy `team_isolation` RESTRICTIVE no mesmo migration

### FK ambígua employees ↔ departments (PGRST201)
```typescript
// ✅ CERTO — hint por coluna
department:department_id(name)
// ❌ ERRADO — PGRST201
department:departments(name)
```

### Auth cold-start (Supabase Free Tier hiberna 15-30s)
- `withTimeout(8000)` em todas as queries de perfil
- Cache `localStorage` `nextai-profile-v1-{uid}` com TTL 7 dias
- Safety net de 10s no AuthContext desbloqueando loading compulsoriamente
- Pré-aquecer 30min antes de demos: logar no app

### RPCs — padrão de segurança
```sql
-- Padrão normal
CREATE FUNCTION minha_rpc() RETURNS ... LANGUAGE plpgsql
SECURITY INVOKER SET search_path = 'public' AS $$...$$;

-- SECURITY DEFINER apenas para cross-tenant (SuperMaster)
-- Obrigatório: REVOKE FROM PUBLIC; REVOKE FROM anon; GRANT TO authenticated;
```

## Armadilhas conhecidas (não repetir)

1. `withTimeout` + Supabase builder → tipar explicitamente como `{ data: T; error: E | null }`
2. React 19 `key` prop → usar `<Fragment key={id}>` em vez de passar key diretamente ao componente
3. `AlertDialogCancel` → não aceita `disabled`; usar `Dialog` para confirmações destrutivas
4. `react-signature-canvas` → incompatível com React 19; usar canvas HTML5 nativo
5. Bucket privado Storage → nunca `getPublicUrl`; usar `createSignedUrls`
6. Dialogs com `max-w` → sempre `sm:max-w-4xl` (com prefixo responsivo) ou não sobrescreve
7. `.single()` quando pode retornar 0 linhas → usar `.maybeSingle()` (evita 406)
8. `status` de `service_reports` → valores válidos: `draft|pending_review|returned|approved|rejected` (nunca PT)
9. Dashboard KPIs → nunca valores hardcoded de fallback; 0 quando sem dados reais
10. SW SPA blank page → handler `request.mode === 'navigate'` network-first com fallback `index.html`; ao alterar `sw.js` sempre bumpar `CACHE_NAME`
11. Zod v4 → sem `invalid_type_error`; sem `.default()` com `zodResolver` (usar `defaultValues` no `useForm`)
12. Edge Function guard → verificar `Authorization: Bearer` + JWT; nunca comparar com `apikey`
13. jsPDF 4.x → sem `setLineDash`; usar `setLineWidth + line()`
14. Trigger `updated_at` → nome correto é `handle_updated_at()`
15. Tailwind classes dinâmicas → nunca `bg-${color}-50`; criar array com classes completas literais
16. Stagger com `animationDelay` → obrigatório `fill-mode-backwards` para evitar flash
17. Transition no `:active` → não incluir `transition:` na regra `:active`, apenas `transform: scale()`
18. `useOutletContext` → sempre com optional chaining: `outletCtx?.isOnline ?? true`
19. `kbService.ts` → usar `.or('title.ilike.%term%,content.ilike.%term%')` (nunca `.textSearch`)
20. Botão submit Nova OS → texto "Enviar OS", atributo `data-onboarding="wizard-step7-enviar"`
21. Testes Playwright (SPA navigation) → usar `waitForFunction(() => !window.location.pathname.includes('/login'))` em vez de `waitForURL` com `waitUntil:'load'`
22. Supabase REVOKE: `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC` **não remove** grants explícitos por role (`anon=X/postgres` permanece no proacl). Sempre fazer `REVOKE ... FROM anon` explicitamente em funções SECURITY DEFINER.

## Sidebar CSS tokens (crítico)

Dentro da sidebar, SEMPRE usar tokens `bg-sidebar-*` / `text-sidebar-*`.  
Nunca `bg-background` ou `border-border` dentro da sidebar — componentes ficam invisíveis.

## Convenções de código

- Nenhum comentário óbvio — só comentar WHY não-óbvio
- Nenhum `any` explícito — `tsc --noEmit` deve ser EXIT:0
- Services: async/await com throw em erro, sem `.eq('team_id', teamId)` nos reads
- Lazy loading: toda rota em `App.tsx` deve ser `React.lazy()` — sem exceção
- Bundle alvo: chunk principal ≤ 100 kB gzip
- Novo módulo: migration → types → service → hook → componente → página → rota + nav
- Responder sempre em português do Brasil

## Edge Functions deployadas

`ai-proxy` v8 · `admin-create-user` v4 · `admin-delete-user` v3  
`admin-reset-password` v1 · `admin-provision-tenant` v1  
`platform-update-user` v1 · `sla-checker` v1 · `send-csat-email` v1

Secrets (nunca no .env): `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `OPENAI_API_KEY`

## Próximas sprints disponíveis

Arquivos completos em `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\Sprints\`

- **Sprint D** — CPQ: Assinatura eletrônica em orçamentos + Versionamento
- **Sprint E** — OCR comprovantes + Budget + Base KB + Lifecycle de ativo (concluída)
- **Holerite PDF** — `gerarHolerite.ts` já existe
- **Dashboard real** — KPIs cruzando dados de RH/DP/CP
- **Testes E2E RH/DP/CP** — Playwright para os novos módulos enterprise
