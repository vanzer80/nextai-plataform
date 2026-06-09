# CLAUDE.md — NextAI Platform (Portal Mopar)

> **Fonte de verdade para todas as sessões de desenvolvimento assistido por IA.**
> Atualizado em: 2026-06-07 | Sessão: sprint-filial-fk

---

## 1. Identidade do Projeto

- **Produto:** NextAI Platform — SaaS white-label multi-tenant de gestão de manutenção.
- **Cliente/tenant de referência:** Mopar Engenharia. "Mopar" é um cliente, não o nome do produto.
- **Repositório:** `C:\dev\portal-mopar`
- **Stack:** React 19 · TypeScript 5.8 · Vite 6 · TailwindCSS 4 · Supabase (Auth + DB + Storage + Edge Functions)

---

## 2. Stack Completa

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| UI Framework | React | 19.0 |
| Bundler | Vite | 6.2 |
| Linguagem | TypeScript | 5.8 |
| Roteamento | react-router-dom | 7.14 |
| Estilização | TailwindCSS | 4.1 |
| Componentes | shadcn/ui + @base-ui/react | — |
| Formulários | react-hook-form + Zod | 7.72 / 4.3 |
| Testes | Vitest + @testing-library/react | — |
| E2E | Playwright | — |
| Backend | Supabase (PostgreSQL + Auth + RLS + Storage) | — |

---

## 3. Arquitetura Multi-Tenant

- `users.team_id` → identifica o tenant do usuário autenticado.
- `get_caller_team_id()` → função SQL helper que retorna o `team_id` do `auth.uid()`.
- **Leitura:** as RLS policies filtram por `team_id` via `get_caller_team_id()`. **Não** adicionar `.eq('team_id', ...)` nas queries client-side — a RLS já garante o isolamento.
- **Escrita:** RPCs `SECURITY DEFINER` buscam `team_id` de `users` e injetam no INSERT. Client-side direto deixa o `DEFAULT get_caller_team_id()` agir.
- **`client_locations`:** não tem `team_id` próprio — isolamento é via JOIN em `clients.team_id` (policy `team_isolation`).

---

## 4. Regras de Banco (INEGOCIÁVEIS)

### 4.1 Queries
- Usar `.maybeSingle()` em vez de `.single()` para evitar erro quando não encontra.
- FK ambígua → usar hint por coluna: `users:technician_id(full_name)`.
- Nunca usar `.eq('team_id', ...)` em reads client-side — a RLS faz isso.
- Writes diretos: o `DEFAULT get_caller_team_id()` preenche `team_id` automaticamente.

### 4.2 Migrations
- Arquivo em `supabase/migrations/YYYYMMDD_nome.sql`.
- Aplicar via `supabase/migrations/` + `mcp__supabase__apply_migration`.
- Toda tabela nova precisa de `ENABLE ROW LEVEL SECURITY` + policies no mesmo arquivo.
- Colunas novas em tabelas existentes: usar `ADD COLUMN IF NOT EXISTS` (idempotente).
- RPCs `SECURITY DEFINER` devem ter `SET search_path = public`.
- `GRANT EXECUTE ON FUNCTION` ao role `authenticated` explícito após cada RPC.

### 4.3 Status de `service_reports`
Sempre em inglês: `draft`, `pending_review`, `returned`, `approved`, `rejected`.

---

## 5. Convenções de Código

### 5.1 Ordem canônica ao tocar em dados
**migration → types → service → hook → componente → página → rota/nav**

### 5.2 Rotas novas em App.tsx
Sempre com `React.lazy()` + `Suspense`.

### 5.3 Comentários
Zero comentários de "o quê". Só comentários de "por quê" quando não óbvio.

### 5.4 Sem qualquer
Proibido usar `any` em TypeScript. Prefira `unknown` + type guards.

### 5.5 Componentes reutilizáveis
Criar em `src/components/`. Hooks em `src/hooks/`. Services em `src/services/`.

---

## 6. Módulos e Serviços

| Módulo | Service | Principais tabelas |
|--------|---------|-------------------|
| Clientes | `clientService.ts` | `clients`, `client_locations` |
| OS/Relatórios | `reportService.ts` | `service_reports`, `report_attachments`, `report_signatures`, `report_checklist_items` |
| Orçamentos | `orcamentoService.ts` | `orcamentos`, `orcamento_itens`, `orcamento_versions` |
| Reembolsos | `reimbursementService.ts` | `reimbursements`, `reimbursement_history` |
| Materiais | `materialService.ts` | `material_requests` |
| Equipamentos | `equipmentService.ts` | `equipments` |
| Checklists | `checklistService.ts` | `checklist_templates`, `checklist_template_items` |
| Clientes (hook) | `useClients.ts` | `clients` (cache em módulo) |
| Filiais (hook) | `useClientLocations.ts` | `client_locations` (sem cache, fresh por clientId) |

---

## 7. Padrão de Filiais (client_locations)

### 7.1 Constraint de banco
`client_locations.client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE` — **nenhuma filial órfã é possível**. A UI sempre passa `clientId` ao criar/editar.

### 7.2 Vínculo em OS e Orçamentos
A partir da sessão sprint-filial-fk (2026-06-07):

**`service_reports`:**
- `client_location_id UUID REFERENCES client_locations(id) ON DELETE SET NULL` — nullable, backward-compat.
- `site_location TEXT` — texto livre (fallback quando não há filial cadastrada OU quando o técnico digita manualmente).
- Quando `client_location_id` preenchido: `site_location` contém o label formatado da filial (`nome — logradouro, numero — cidade/UF`).

**`orcamentos`:**
- `client_location_id UUID REFERENCES client_locations(id) ON DELETE SET NULL` — nullable.
- `site_location TEXT` — texto livre.
- Mesma semântica dual do `service_reports`.

### 7.3 Comportamento do ClientLocationSelect

O componente tem **três estados exclusivos** (renderiza apenas um por vez):

| Estado | Condição | O que aparece |
|--------|----------|---------------|
| **A — FK selecionada** | `selectedLocationId` resolve para uma filial | Card de preview com todos os dados + botão "Trocar" (volta ao C) + link "Digitar manualmente" (vai para B) |
| **B — Texto livre** | `manualMode === true` | Input de texto + link "Selecionar da lista" (volta ao C) |
| **C — Select** | sem seleção, sem manual | `<Select>` Radix com as filiais + opção "Digitar manualmente" (vai para B) |

**Regras de transição:**
- `C → A`: usuário escolhe filial no Select → componente chama `onLocationSelect(loc)` (sem chamar `onManualTextChange`)
- `A → C`: usuário clica "Trocar" → componente chama `onLocationSelect(null)`
- `A → B` ou `C → B`: usuário clica "Digitar manualmente" → componente chama `onLocationSelect(null)` + `onManualTextChange('')`
- Troca de cliente → reseta para estado C (via `prevClientId` guard no render)

**Contrato dos callbacks no pai:**
```tsx
onLocationSelect={(loc) => {
  if (loc) {
    setValue('client_location_id', loc.id);
    setValue('site_location', formatLocationLabel(loc));   // ← OBRIGATÓRIO
  } else {
    setValue('client_location_id', undefined);
    setValue('site_location', '');                         // ← limpa ao trocar/voltar
  }
}}
onManualTextChange={(text) => {
  setValue('site_location', text);
  setValue('client_location_id', undefined);               // ← modo manual: sem FK
}}
```

`formatLocationLabel` deve ser importada do próprio componente: `import ClientLocationSelect, { formatLocationLabel } from '@/src/components/ClientLocationSelect'`

### 7.4 RPCs atualizadas
- `submit_report`: inclui `client_location_id` no INSERT de `service_reports`.
- `create_orcamento`: inclui `client_location_id` e `site_location` no INSERT de `orcamentos`.
- Ambas são `SECURITY DEFINER SET search_path = public`, GRANT a `authenticated`.

---

## 8. Migrations (log)

| Data | Arquivo | Descrição |
|------|---------|-----------|
| 2026-05-23 | `20260523_platform_tenants_rpc.sql` | RPCs de platform/tenants |
| 2026-05-23 | `20260523_security_revoke_internal_functions.sql` | REVOKE em funções internas |
| 2026-05-23 | `20260523_tenant_slug_immutable.sql` | Slug de tenant imutável |
| 2026-05-23 | `20260523_tenants_business_fields.sql` | Campos de negócio em tenants |
| 2026-06-07 | `20260607_client_location_fk.sql` | FK `client_location_id` em `service_reports` e `orcamentos`; atualiza RPCs `submit_report` e `create_orcamento` |
| 2026-06-08 | `20260608_fix_clients_rls_cross_tenant.sql` | Remove `clients_select_authenticated` — policy permitia cross-tenant leak; `team_isolation` cobre SELECT |

---

## 9. Armadilhas Conhecidas

### 9.1 Race condition: INITIAL_SESSION + initializeAuth
`onAuthStateChange(INITIAL_SESSION)` e `initializeAuth()` podem resolver em ordens diferentes, causando role errado no contexto. Guard com `useRef` para executar apenas uma vez.

### 9.2 Base UI DialogContent max-width
`sm:max-w-sm` da base UI não é sobrescrito por `max-w-4xl` sem prefixo responsivo. Use `max-w-4xl sm:max-w-4xl` ou sobrescreva com classe responsiva explícita.

### 9.3 Tokens CSS na Sidebar
`bg-background`/`border-border` dentro da sidebar torna componentes invisíveis. Use sempre `bg-sidebar-*`/`text-sidebar-*`.

### 9.4 REVOKE FROM PUBLIC não remove grant de anon
Em funções `SECURITY DEFINER`, `REVOKE FROM PUBLIC` não remove grant explícito do role `anon`. Sempre fazer `REVOKE FROM anon` separado.

### 9.5 PDF logo tenant
Todos os PDFs jsPDF devem ser `async` + `urlToDataUrl` + cabeçalho azul com logo. Call site usa `void`.

### 9.6 NextAI Logo wordmark
`tspan` deve ser `"ext"` (não `"Next"`); símbolo geométrico já é o N; viewBox 555, x=133, height=28.

### 9.7 manualChunks react-dom
Array não captura `react-dom-client` (93 kB). `includes('react-dom')` faz false match em `@floating-ui/react-dom`. Use regex ancorada.

### 9.8 Playwright: armadilhas de teste
- `getByPlaceholder` precisa de `exact: true` quando o placeholder contém substring de outros.
- Tabs duplicam DOM — usar seletor mais específico.
- `Promise.any` com `isVisible` pode resolver antes do elemento estar clicável.
- Specs em paralelo matam Vite + Supabase local — rodar sequencial em CI.

### 9.9 NewReport: botão de submit
Botão é `"Enviar OS"` com `data-onboarding="wizard-step7-enviar"`. Smoke tests antigos usavam `/enviar relatório/i` (errado).

### 9.10 schema-atual.sql está desatualizado
O arquivo `supabase/schema-atual.sql` foi gerado em 2026-04-25 e não reflete o banco real. Usar MCP `execute_sql` ou `list_tables(verbose=true)` para inspecionar o schema atual. Tabelas como `client_locations`, `tenants` e colunas `team_id` não aparecem no arquivo.

### 9.11 `vi.fn` generics no Vitest 3.x
A sintaxe `vi.fn<[ArgType], ReturnType>()` não é mais válida. Use `vi.fn<(arg: ArgType) => ReturnType>()` ou simplesmente `vi.fn()` sem generics.

### 9.13 `clients_select_authenticated` — cross-tenant leak
A tabela `clients` tinha uma policy `clients_select_authenticated` que permitia qualquer usuário autenticado ver clientes de **todos** os tenants. Removida em 2026-06-08. Só a `team_isolation` (ALL) deve existir em `clients` — ela já cobre SELECT corretamente para membros do mesmo tenant. Sintoma do bug: filiais não apareciam ao selecionar cliente porque `client_locations` era corretamente isolada por tenant enquanto `clients` não era.

### 9.12 ClientLocationSelect: reset de estado ao trocar de cliente
Não usar `key={clientId}` no React 19 com TS — o prop `key` não é parte do tipo do componente e o TS 5.8 rejeita. Usar o padrão "reset state on prop change" com `useState(prevClientId)` + guard no render.

### 9.14 ClientLocationSelect: onManualTextChange chamado ao selecionar FK limpa o FK
Se `handleSelectChange` chamar `onManualTextChange(formatLocationLabel(loc))` após `onLocationSelect(loc)`, o pai executa `setValue('client_location_id', undefined)` dentro de `onManualTextChange` — apagando o FK imediatamente após setá-lo. Solução: `handleSelectChange` **nunca** chama `onManualTextChange`; o pai seta `site_location` dentro do próprio `onLocationSelect`. Ver seção 7.3 para o contrato correto.

---

## 10. Testes

- **Unitários (Vitest):** `src/**/__tests__/*.test.{ts,tsx}`
- **E2E (Playwright):** `tests/*.spec.ts`
- `npm run test` → Vitest
- `npx tsc --noEmit` → lint TypeScript (deve sair EXIT 0 sem `any`)
- `npm run build` → build de produção (chunk principal ≤ 100 kB gzip)

---

## 11. Variáveis de Ambiente

Arquivo `.env` (não comitar). Referência em `.env.example`.
Supabase URL + anon key em `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
