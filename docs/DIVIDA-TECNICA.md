# Problemas e Dívida Técnica — Portal Mopar

> Atualizado: 2026-05-02 (PERF-bundle-01 concluído — todos os problemas de performance resolvidos + deploy em produção)
> Ver também: [[11 - Auditoria 2026-04-25]], [[Segurança — Checklist]], [[14 - Auditoria de Performance 2026-05-02]]

---

## Problemas de performance (PERF-bundle-01) — ✅ Todos resolvidos

| ID | Severidade | Status | Arquivo | Descrição curta |
|----|------------|--------|---------|-----------------|
| PERF-B01 | 🔴 Crítico | ✅ Resolvido | `AuthContext.tsx:148` | Timeout `withTimeout` 30s → 8s |
| PERF-B02 | 🔴 Crítico | ✅ Resolvido | `App.tsx` | 15 rotas → `React.lazy()` — bundle inicial −84% |
| PERF-B03 | 🔴 Crítico | ✅ Resolvido | `useOfflineSync.ts` | Debounce 5s no sync inicial (era 7 requests simultâneos) |
| PERF-B04 | 🔴 Crítico | ✅ Resolvido | `package.json` | `motion` removido (`npm remove motion`) |
| PERF-B05 | 🔴 Crítico | ✅ Resolvido | `vite.config.ts` | `manualChunks` com 6 vendors (react, supabase, recharts, pdf, xlsx, ui) |
| PERF-B06 | 🟠 Alto | ✅ Resolvido | `Dashboard.tsx:73,80` | `.limit(500)` em `barQry` e `pieQry` |
| INFRA-01 | 🔴 Crítico | ✅ Resolvido | Infra | Deploy Vercel CDN — https://portal-mopar.vercel.app/ funcionando |

---

## Status consolidado (histórico)

| ID | Severidade | Status | Arquivo | Descrição curta |
|----|------------|--------|---------|-----------------|
| P-01 | 🔴 Crítico | ✅ Resolvido | `vite.config.ts:11` | GEMINI_API_KEY no bundle |
| P-02 | 🔴 Crítico | ✅ Resolvido | `UserManagement.tsx:164` | Delete não remove auth.users |
| P-03 | 🟠 Alto | ✅ Resolvido | `offlineQueue.ts` | Fila offline bypassa RPC — relatório incompleto |
| P-04 | 🟠 Alto | ✅ Resolvido | SQL | Duas versões de RPC com RBAC diferente |
| P-05 | 🟠 Alto | ✅ Resolvido | `supabase-schema.sql` | Schema desatualizado — risco DR |
| P-06 | 🟡 Médio | ✅ Resolvido | `Dashboard.tsx:94` | approvalRate = 100% sem dados |
| P-07 | 🟡 Médio | ✅ Resolvido | `Dashboard.tsx:29` | isManager com .includes() errado |
| P-08 | 🟢 Baixo | ✅ Resolvido | `Dashboard.tsx:213` | Realtime não ouve service_reports |
| P-09 | 🟡 Médio | ✅ Resolvido | `UserManagement.tsx:258` | Supervisor faltando no dropdown |
| P-10 | 🟡 Médio | ✅ Resolvido | `package.json:17` | @google/genai no bundle sem uso |
| P-11 | 🟢 Baixo | ✅ Resolvido | `package.json` | Deps nas seções erradas |
| P-12 | 🟢 Baixo | ✅ Resolvido | `orcamentoService.ts:57` | Criação não-atômica → possível órfão |
| P-13 | 🟢 Baixo | ✅ Resolvido | `supabase.ts:31` | alert() em erro de inicialização |
| P-14 | 🟢 Baixo | ✅ Resolvido | `AuthContext.tsx:183` | for...in localStorage |
| P-15 | 🟢 Baixo | ✅ Resolvido | `models.ts:63` | ServiceReport stale com schema antigo |
| P-16 | 🟡 Médio | ✅ Resolvido | `Dashboard.tsx:52` | 5 queries sequenciais |

---

## Dívida técnica resolvida

### Auditoria F1-F4 + Sprint 9-10 (abril 2026)
- ✅ Chaves de IA removidas do .env e do bundle
- ✅ RLS clients corrigido (anônimo → auth.uid() IS NOT NULL)
- ✅ RLS report_status_history ownership check
- ✅ RPC submit_report atômica
- ✅ Índices compostos em service_reports e report_status_history
- ✅ Signed URLs com auto-refresh (50 min interval)
- ✅ toTimestamp fix (HH:MM → HH:MM:SS)
- ✅ express e @types/express removidos
- ✅ Edge Function ai-proxy (zero chaves no bundle JS)
- ✅ RLS clients acesso anônimo corrigido
- ✅ Lazy load do Wizard (7 steps)
- ✅ Playwright smoke tests (S1-S4)

### Auditoria 2026-04-20
- ✅ 9 índices secundários criados
- ✅ Policies RLS consolidadas (is_manager_or_admin → EXISTS direto)
- ✅ FK comprador_id corrigida para public.users
- ✅ withTimeout extraído para módulo compartilhado
- ✅ Canal Realtime do ReimbursementsList corrigido (page fora das deps)
- ✅ AppLayout: subscribe antes do fetch
- ✅ useClients hook com cache de módulo
- ✅ Realtime adicionado ao Dashboard (reimbursements)

### Auditoria 2026-04-25 — BLOCO 1-4 (Sprint 10)
- ✅ P-01: GEMINI_API_KEY removida do bundle (vite.config.ts — define block removido)
- ✅ P-02: Edge Function admin-delete-user deployada (verify_jwt:true, RBAC Master/Admin)
- ✅ P-03: Toast offline corrigido para mensagem honesta
- ✅ P-04: RPC process_reimbursement_action canonizada (Master + audit history)
- ✅ P-06: approvalRate null-safe (`number | null`, exibe '—' sem dados)
- ✅ P-07: isManager corrigido (Supervisor e Master incluídos)
- ✅ P-08: Realtime service_reports adicionado ao Dashboard
- ✅ P-09: Supervisor adicionado ao dropdown de criação de usuário
- ✅ P-10: @google/genai removido do package.json (não era importado em src/)
- ✅ P-11: dotenv e shadcn movidos para devDependencies; vite duplicado removido
- ✅ P-13: alert() → console.error() em supabase.ts
- ✅ P-14: for...in localStorage → for...of Object.keys(localStorage) em AuthContext.tsx
- ✅ P-16: Dashboard 5 queries → Promise.all (paralelo)

### Sprint 11 (2026-04-25)
- ✅ P-15: `models.ts` — aviso de deprecação adicionado (nenhum import ativo encontrado)
- ✅ P-12: RPC `create_orcamento` deployada (atômica); `orcamentoService.criarOrcamento` refatorado para usar RPC; zero órfãos verificados no banco
- ✅ P-05: `supabase/schema-atual.sql` criado com schema completo (tabelas, ENUMs, índices, FKs, funções); `supabase-schema.sql` antigo marcado como DESATUALIZADO

---

## Dívida conhecida que permanece por design

### Fila offline simplificada (P-03)
A fila offline (`offlineQueue.ts`) foi construída antes da migração para o RPC `submit_report`. O redesign completo (armazenar blobs no IndexedDB e remontar payload completo para o RPC) foi postergado para Sprint 11 por complexidade. **Impacto real:** usuário precisa de conexão para submeter um relatório completo — modo offline salva apenas o formulário de texto.

### Schema SQL desatualizado (P-05)
O arquivo `supabase-schema.sql` não será atualizado até que a estrutura de migrations com Supabase CLI seja estabelecida (Fase 4). Enquanto isso, o arquivo tem comentário `/* SCHEMA DESATUALIZADO */`.

> [!hypothesis]
> O custo de criar migrations retroativas para todos os sprints anteriores é alto. A abordagem prática é criar um `schema-atual.sql` via `pg_dump --schema-only` e começar migrations daqui para frente com Supabase CLI.
