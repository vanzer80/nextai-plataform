# Roadmap Técnico — NextAI

> Última atualização: 2026-06-13 (Sessão 69)  
> Ver também: [[11 - Auditoria 2026-04-25]], [[Problemas e Dívida Técnica]], [[Segurança — Checklist]], [[14 - Auditoria de Performance 2026-05-02]]

---

## Status Geral

| Sprint / Fase | Status | Foco |
|---|---|---|
| Sprint 10 | ✅ Completo | Orçamentos CRUD + fluxo + PDF client-side |
| Sprint 11 (Dark Mode) | ✅ Completo | Dark Mode + IndexedDB offline queue redesign |
| Sprint 12 (Clientes) | ✅ Completo | Módulo Clientes + unidades + info cliente nos orçamentos |
| PERF-nav-01 | ✅ Completo | Fix remount de navegação + lazy loading |
| PERF-bundle-01 | ✅ Completo | Lazy load total + manualChunks + motion removido + deploy Vercel |
| fix(compat) | ✅ Completo | vercel.json SPA rewrite + SW network-first + generateUUID polyfill Safari |
| fix(ux-27) | ✅ Completo | Light mode padrão + auth loop fix + Sheet perfil + bottom nav personalizável |
| feat(dash-28) | ✅ Completo | Dashboard role-based: dashboardConfig + widgetRegistry |
| sec(audit-29) | ✅ Completo | Auditoria segurança: 12 achados corrigidos |
| s30 | ✅ Completo | OS: PGRST201 + auth race + equipamento manual + PDF export |
| NextIA s31–39 | ✅ Completo | Multi-tenancy Fases 0–4 completas |
| s40 | ✅ Completo | Docs: README reescrito + PRD + 5 docs Obsidian |
| s41 | ✅ Completo | Auditoria completa do banco — 37 achados |
| s42 | ✅ Completo | Correções de segurança + layout |
| s43 | ✅ Completo | Desbloqueio comercial (Sprints A+B+C+D+E) + service_types |
| s44 | ✅ Completo | Reembolsos completos: Pago + antifraude (SHA-256 + CNPJ + anomalia) |
| s45 | ✅ Completo | Auditoria isolamento cross-tenant: 8 vulnerabilidades corrigidas |
| s46 | ✅ Completo | PlatformLayout + PlatformGuard + 5 rotas SuperMaster |
| s47 | ✅ Completo | RLS fix PostgreSQL 42P17 + race condition SuperMaster + E2E 14/14 |
| s48 | ✅ Completo | Renomeação UI "Relatório" → "Ordem de Serviço (OS)" |
| s49 | ✅ Completo | Animações UI (tw-animate-css + auto-animate) |
| s50 | ✅ Completo | Módulo Equipamentos + Taxa de Retorno KPI + logo no PDF OS |
| s51 | ✅ Completo | Onboarding interativo — driver.js 13 tours iniciais |
| s52 | ✅ Completo | Módulo Tenants auditado + RBAC completo + SPA SW fix |
| s53 | ✅ Completo | Sprint E completa (OCR + Budget + KB + Lifecycle) |
| s54 | ✅ Completo | Auditoria profunda + 11 bugs corrigidos |
| s55 | ✅ Completo | Fix IA diagnóstico: texto completo + botão Copiar |
| s56 | ✅ Completo | Banco de inteligência cross-tenant (8 RPCs + `/platform/intelligence`) |
| s57 | ✅ Completo | Expansão Intelligence: 15 abas, 13 tabelas, 7 RPCs |
| s58 | ✅ Completo | Reimplementação s57 (terminal perdido) + migrations aplicadas via MCP |
| s59 | ✅ Completo | RH + DP + CP enterprise (qualidade SAP/TOTVS) + 117 testes |
| s59+ / s60 | ✅ Completo | E2E UX/UI SAP-level (37 testes) + CLAUDE.md + fix branding tenant |
| s61 | ✅ Completo | OS SAP-level: 14 features + manutenção preventiva + push notifications |
| s62 | ✅ Completo | OS↔Orçamento SAP SD/PM + 33 E2E + 16 correções CPQ |
| s63 | ✅ Completo | Landing redesign + logo tenant em todos os PDFs |
| s64 | ✅ Completo | Fix race condition CPQ + fix logo rendering + seção OS no PDF |
| s65 | ✅ Completo | 22 E2E tests para RH, DP, CP (7+7+8) |
| s66–67 | ✅ Completo | Cadastro comercial tenants + onboarding 25 tours 85+ steps |
| s68 | ✅ Completo | SuperMaster edita perfil comercial + 6 testes E2E Platform |
| s69 | ✅ Completo | Correção de rolagem de tabelas e responsividade (min-h-full e overflow-x-auto) |
| **Background Sync** | **⏳ Pendente** | **Offline-first completo: sync automático ao reconectar** |
| Notificações externas | ⏳ Pendente | Email (Resend) + WhatsApp (Evolution API) |
| Fase 6 SaaS | ⏳ Pendente | Subdomain routing + billing + pentest |

---

## s30 — ✅ OS: fixes críticos (2026-05-03)

| Fix | Descrição |
|---|---|
| PGRST201 | Query de relatórios retornava 201 — corrigido na query de listagem |
| Auth race | `isFetchingRef` + `fetchedUserIdRef` |
| Equipamento manual | Campo `asset_name_manual TEXT` adicionado a `service_reports` |
| PDF export | Fotos e assinaturas incluídas no PDF de OS |

---

## NextIA — ✅ Multi-tenancy Fases 0–4 (Sessões 31–39)

### Fase 0a — Fundação (s31)
- Tabela `tenants` (slug, name, logo_url, primary_color, is_platform) + Mopar como primeiro tenant
- `users.team_id UUID FK → tenants(id)` + backfill
- `get_caller_team_id()` — RPC STABLE SECURITY DEFINER
- Fix R-02: `notify_compradores` filtrada por `team_id` do caller

### Fase 0b (s32)
- `handle_new_user` trigger propaga `team_id` automaticamente
- `admin-create-user` Edge Function v4 com `team_id`
- `notifications.team_id` + backfill + policy

### Fase 1 — Isolamento (s33)
- `team_id` em 8 tabelas de domínio + backfill + DEFAULT `get_caller_team_id()`
- Políticas RLS RESTRICTIVE em todas as tabelas
- 5 RPCs SECURITY DEFINER atualizadas

### Fase 2 — Branding (s34)
- `TenantContext` + `useTenant()` + `applyTenantBrand()` OKLCH
- 6 hardcodes substituídos; IndexedDB `${slug}-reports`

### Fase 3 — Onboarding de tenants (s35)
- `admin-provision-tenant` Edge Function v1
- `TenantManagement.tsx`: tabela, dialog criação/edição
- Storage `service_reports_media`: 15 policies com isolamento por tenant

### Fase 4 — Storage backfill (s36)
- Backfill de 43 objetos legados do Mopar para paths `{teamId}/`
- Políticas legacy dropadas após backfill confirmado

### Adições pós-Fase 4 (s37–39)
| Sessão | Entrega |
|---|---|
| s37 | `is_platform BOOLEAN`; tenant NextAI (`#6366F1`); SuperMaster `nextai@gmail.com` |
| s38 | `hexToOklch()` + `applyTenantBrand()` OKLCH vars; guard `isPlatform → /admin/tenants` |
| s39 | Bucket `tenant-assets` + 3 policies; upload logo; dialog edição tenant; `admin-provision-tenant` com `logo_url` |

---

## s40 — ✅ Documentação (2026-05-13)

README reescrito (React 18→19, Router v6→v7.14, @base-ui, multi-tenancy). PRD_MVP.md corrigido. 5 docs Obsidian atualizados — Fases 1–4 marcadas como concluídas.

---

## s41 — ✅ Auditoria Banco de Dados (2026-05-14)

37 achados em 4 grupos: A-Segurança (5 — 14 funções SECURITY DEFINER expostas a `anon`), B-Integridade/RLS (6 — enum duplicado `Revisão`/`Revisao`), C-Performance (22 FKs sem índice), D-Observabilidade (4). Arquivo: `Auditoria de Banco de Dados 2026-05-14.md`. Descoberta do 3º tenant (`zamb-eng`).

---

## s42 — ✅ Correções de Segurança + Layout (2026-05-14)

Correção de grant `PUBLIC` herdado (migration). Frontend: remoção de `max-w-* mx-auto` de 8 páginas de listagem.

---

## s43 — ✅ Desbloqueio Comercial (2026-05-17)

Remoção de todo branding "Mopar" visível a clientes externos (12 arquivos). Service Types: migração enum → tabela `service_types` com `team_id` + CRUD admin. Tabela de Reembolsos com DropdownMenu. Issued Password manual.

---

## s44 — ✅ Módulo Reembolsos Completo (2026-05-17)

- Status `Pago` + `paid_at`/`paid_by` + RPC `process_reimbursement_action`
- SHA-256 via `crypto.subtle.digest` — detecção de comprovante duplicado
- CNPJ via `cnpj.ws` — validação automática no upload do comprovante
- Alerta de anomalia de valor para gestores (média histórica do usuário)

---

## s45 — ✅ Auditoria de Isolamento Cross-Tenant (2026-05-17)

8 vulnerabilidades cross-tenant corrigidas (V-01 a V-08) em 10 tabelas — policies RESTRICTIVE `team_isolation`. `admin-delete-user` v3 com guard cross-tenant.

---

## s46–47 — ✅ SuperMaster + PlatformGuard (2026-05-18)

- `PlatformLayout` + `PlatformGuard` + `SmartRedirect`
- 5 rotas `/platform/*`: Tenants, Users, Settings + Company Profile + Intelligence
- Fix RLS infinite recursion (PostgreSQL 42P17) via `is_platform_master()` SECURITY DEFINER
- Race condition de roteamento resolvida: `isPlatform` movido do TenantContext para AuthContext
- Suite Playwright 14/14 passando

---

## s48–49 — ✅ UX (2026-05-18/19)

- s48: Renomeação UI "Relatório" → "Ordem de Serviço (OS)" (9 arquivos UI + 4 testes)
- s49: Animações tw-animate-css + @formkit/auto-animate (sem Framer Motion — zero custo de bundle)

---

## s50 — ✅ Equipamentos + KPI + Logo PDF (2026-05-22)

- Equipamentos: migration `equipments_asset_management`, CRUD, manutenção preventiva client-side
- Widget Taxa de Retorno: RPC `get_dashboard_return_rate`
- Logo do tenant no PDF de OS (padrão `urlToDataUrl`)
- 19/19 testes unitários adicionados

---

## s51 — ✅ Onboarding driver.js (2026-05-22)

13 arquivos `.tour.ts` cobrindo todos os módulos existentes. `useOnboardingDriver` hook, `OnboardingContext`, `WelcomeModal`. Convenção `data-onboarding` em 25+ páginas. Tour multi-página com navegação automática.

---

## s52 — ✅ Auditoria Tenants + RBAC + SW Fix (2026-05-23)

- 5 bugs no módulo tenants + 4 melhorias de production readiness
- RBAC: 7 correções (defense-in-depth nas rotas, matriz NAV_LINKS, remoção Orçamentos para Técnico)
- SPA Service Worker: tratava rotas como assets → tela branca; bump `nextai-v1→v2`

---

## s53 — ✅ Sprint E Completa (2026-05-24)

OCR comprovantes (existia) + Budget Control (tabela `budgets` + RPCs + widget burn) + Base de Conhecimento (KB — FTS GIN + `/knowledge`) + Ciclo de Vida do Ativo (depreciação linear). Commit `8a7ddad`.

---

## s54 — ✅ Auditoria Profunda (2026-05-24)

11 bugs corrigidos: `textSearch` coluna composta inválida na KB, `signOut` bypass, cache cross-tenant no logout, RLS 403 em `/suppliers` e `/parts` (faltavam policies PERMISSIVE), stepper wizard unificado. Alias `portal-mopar.vercel.app` removido → `nextai-plataform.vercel.app`.

---

## s55 — ✅ Fix IA Diagnóstico (2026-05-24)

2 bugs no Step 4 do wizard OS — texto incompleto em preliminary/final diagnosis (React 19 concurrent mode). `buildAppliedText()` + botão "Copiar". Commit `75b354f`.

---

## s56–58 — ✅ Banco de Inteligência SuperMaster (2026-05-24/26)

- s56: 4 RPCs SECURITY DEFINER + tabela `platform_access_log` + `/platform/intelligence`
- s57: expansão 8→15 abas, 13 tabelas brutas, 7 RPCs (migration `platform_complete_access_rpcs`)
- s58: recuperação após terminal perdido — reimplementação do código + migrations aplicadas via MCP

---

## s59 — ✅ RH + DP + CP Enterprise (2026-05-26)

3 novos módulos enterprise (commit `9bbb649`):
- **RH:** employees/departments/certifications/events — 3 migrations via MCP
- **DP:** Folha INSS 2024 progressivo + IRRF + FGTS + VT, holerite PDF, ponto, férias
- **CP:** Workflow multinível submit/approve/pay/reject, parcelas, comentários
- Suite 117/117 testes unitários passando

---

## s59+ / s60 — ✅ E2E UX + CLAUDE.md + Fixes (2026-05-29/30)

- Suite E2E Playwright `tests/ux/` — 37 testes UX/UI SAP-level
- Criação do `CLAUDE.md` na raiz do projeto (contexto automático)
- Fix branding tenant: edição não persistia (RPC + armadilha REVOKE FROM anon)
- Fix campo Cliente na Nova OS exibia UUID (Radix SelectValue)
- PWA bump: `nextai-v2→v3`

---

## s61 — ✅ OS SAP-Level + 14 Features (2026-05-30)

6 commits, 7 migrations via MCP:
- Numeração automática OS (`reserve_os_number`, `tenant_os_counters`)
- Busca full-text GIN (`search_vector` GENERATED STORED)
- Filtros + ordenação + deep link URL
- Edição de OS devolvida inline; reabrir rejeitada; duplicar OS
- Exportação Excel com filtros ativos
- Notificações in-app + clique navega para OS
- Manutenção Preventiva (CRUD + Edge Function `maintenance-scheduler`)
- Baixa automática de estoque na aprovação (trigger)
- Push notifications nativas (Web Push API + Edge Function `push-notification`)
- QR Code scanner (`@zxing/browser`)

---

## s62 — ✅ OS↔Orçamento SAP SD/PM (2026-05-30)

Vinculação bidirecional OS↔Orçamento. Auto-fill de itens/observações. Chips "• OS" no CPQ. Auditoria: 16 correções. 33 testes E2E (encontraram bug de role 'Técnico' com acento — corrigido). Commits: `e918ed7`, `62a2bfd`, `f632645`.

---

## s63 — ✅ Landing Redesign + PDFs com Logo (2026-05-31)

Landing NextAI redesign AI-first (AiOrb 3D, 3 rodadas). Logo do tenant em todos os PDFs (Orçamento + Holerite). Fix logo duplicado (tspan "ext" não "Next"). Múltiplos commits em 2 repositórios.

---

## s64 — ✅ Fix Race Condition CPQ + Logo Rendering (2026-05-31)

Fix `handleSelectOS` (guard useRef). Seção "OS Vinculada" no PDF de orçamento. Bug logo sobreposto: causa `addImage` com width=0; solução `measureImage`/`fitInBox` via `naturalWidth/Height`. Commit `bd528f2`.

---

## s65 — ✅ E2E RH, DP, CP (2026-06-03)

22 testes Playwright novos — `rh-module.spec.ts` (7), `dp-module.spec.ts` (7), `cp-module.spec.ts` (8). RBAC, REST/RLS, KPIs, status badges, formulários. CLAUDE.md: 4 novas armadilhas (34–37). Commit `78ef868`.

---

## s66–67 — ✅ Cadastro Comercial + Onboarding (2026-06-03)

- **s66:** Migration `20260603_tenant_commercial_data` (CNPJ, endereço, dados fiscais) + RPC `update_own_tenant_commercial` + `CompanyProfile.tsx` Admin + `PlatformCompanyProfile.tsx` SuperMaster
- **s67:** Onboarding expandido para 25 tours / 85+ steps — cobertura SAP-level 100% (commit `e7889c9`)

---

## s68 — ✅ SuperMaster Edita Qualquer Tenant (2026-06-04)

SuperMaster pode editar o Perfil Comercial de qualquer tenant (não apenas o próprio). RPC `update_tenant_commercial_rpc` com guard `is_platform_master()`. 6 testes E2E Platform. Commits: `0c8ad1e`, `5aa547e`, `6294c93`.

---

## sec(audit-29) — ✅ Auditoria de Segurança (2026-05-02/03)

12 achados corrigidos:

| # | Achado | Status |
|---|---|---|
| S-01 | Escalação de privilégio (Admin cria Master) | ✅ |
| S-02 | RBAC bypass por email hardcoded | ✅ |
| S-03 | Permissions-Policy bloqueava câmera/mic/geo | ✅ |
| S-04 | Security headers ausentes | ✅ |
| S-05 | Role "Tecnico de Campo" inconsistente | ✅ |
| S-06 | `ServiceReport.status` enum desatualizado | ✅ |
| S-07 | `test-timeout.ts` executável no root | ✅ deletado |
| S-08 | Bucket referenciado com nome errado | ✅ |
| S-09 | `reports_media` público → privado + RLS | ✅ |
| S-10 | Functions SECURITY DEFINER mortas | ✅ |
| S-11 | `reimbursements_media` público → privado + signed URLs | ✅ |
| S-12 | INSERT policies sem `WITH CHECK` (4 tabelas) | ✅ |

---

## PERF-bundle-01 — ✅ Performance Crítica (2026-05-02)

Bundle inicial −84% (516 kB → 84 kB gzip):
- 15 rotas → `React.lazy()` + `<Suspense>`
- `manualChunks`: react, supabase, recharts, pdf, xlsx, ui
- `npm remove motion` (instalado, nunca importado — ~50 kB)
- Deploy Vercel CDN configurado

---

## Pendências Técnicas Atuais

| Item | Prioridade |
|---|---|
| Background Sync (Service Worker) | 🟡 Média |
| Ícones PNG 192×512 para instalação PWA | 🟢 Baixa |
| Notificações email (Resend) + WhatsApp | 🔴 Alta |
| IA de Escrita de Relatórios | 🔴 Alta |
| `package.json name` = `react-example` → `nextai-plataform` | 🟢 Cosmético |
| Error Boundary global no App.tsx | 🟢 Baixa |
| Criação de orçamento atômica (RPC) | 🟡 Média |
| ESLint (`@typescript-eslint` + react-hooks + jsx-a11y) | 🟡 Média |
| Fase 6 SaaS: subdomain routing + billing + pentest | 🟡 Estratégico |
| RAG Analytics (pgvector + linguagem natural) | 🟡 Estratégico |
| GPS Dispatching Map | 🟡 Estratégico |
| Integração ERP (TOTVS / SAP / Omie) | 🟡 Estratégico |
