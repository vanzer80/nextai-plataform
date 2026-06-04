# PRD — NextAI · Plataforma SaaS

> **Documento:** Product Requirements Document — estado real da plataforma  
> **Produto:** NextAI — plataforma SaaS B2B multi-tenant para gestão de field service  
> **Gerado em:** 2026-04-22 · **Atualizado em:** 2026-06-04 (Sessão 68)  
> **Versão do código:** Sprints A–F + Sessões 31–68 · **Commits totais:** 135  
> **TypeScript:** `npx tsc --noEmit` → EXIT:0

---

## 1. Visão Geral

O **NextAI** é uma plataforma SaaS B2B multi-tenant **white-label** para gestão de field service — ordens de serviço, manutenção, reembolsos, compras, RH e financeiro. Empresas (tenants) operam isoladas na mesma instância Supabase com branding próprio, dados completamente separados por RLS e provisionamento self-service pelo SuperMaster.

A **Mopar Engenharia** é o primeiro tenant ativo. O produto é vendido como **NextAI** — o nome "portal-mopar" refere-se apenas ao repositório legado.

### O que o app faz hoje

- Técnicos de campo **criam Ordens de Serviço (OS)** em wizard de 7 steps (checklist dinâmico, GPS, IA de diagnóstico, assinatura digital canvas, drafts offline) e as submetem para aprovação.
- Gestores **aprovam, devolvem ou rejeitam** OS com trilha de auditoria completa.
- Técnicos **solicitam reembolso de despesas** com extração automática via IA (foto/voz), SHA-256 para detecção de duplicatas, validação de CNPJ via API pública (cnpj.ws) e alerta de anomalia de valor.
- Financeiro confirma o **pagamento efetivo** (status "Pago", colunas `paid_at`/`paid_by`) encerrando o ciclo financeiro real.
- Técnicos e administrativos **solicitam materiais**; compradores gerenciam Ordens de Compra (PO) com upload de NF.
- Técnicos **criam orçamentos técnicos (CPQ)** com itens, aprovação, versionamento e **assinatura eletrônica** do cliente. Vinculação direta OS↔Orçamento com auto-fill de itens (fluxo SAP SD/PM).
- **Dashboard** personalizável com 15 widgets configuráveis por usuário (filtros de período, preferências persistidas no banco via `dashboard_preferences`).
- **Onboarding** interativo com 25 tours e 85+ steps (driver.js), cobertura 100% dos módulos, role-aware.
- **SLA** com escalonamento automático, **agenda de dispatch** com calendário, **portal do cliente** (read-only de OS), **CSAT pós-OS** público.
- Módulos enterprise: **RH** (CLT), **DP** (folha de pagamento INSS/IRRF/FGTS/VT, holerite PDF, ponto, férias), **CP** (contas a pagar com workflow multinível).
- **Banco de inteligência** cross-tenant para o SuperMaster (15 abas, 13 tabelas, 7 RPCs SECURITY DEFINER anonimizados).
- **Plataforma SuperMaster:** 5 páginas dedicadas + Cadastro Comercial de Tenants (CNPJ, endereço, dados fiscais).
- **Notificações** in-app em tempo real (Supabase Realtime), push nativas (Web Push API) e sino com badge.
- **PWA** instalável (manifest, Service Worker `nextai-v7`, IndexedDB offline).
- Cada tenant tem **branding dinâmico** (cor primária em OKLCH, logo próprio) e provisionamento via Edge Function.

### Público-alvo

| Perfil | Função principal no app |
|--------|------------------------|
| **Tecnico** | Criar OS, reembolsos, compras, visualizar KB |
| **Supervisor** | Acompanhar equipe, aprovar OS |
| **Gestor** | Visão gerencial completa, aprovações, orçamentos, agenda |
| **Comprador** | Processar Ordens de Compra |
| **Financeiro** | Aprovar reembolsos, confirmar pagamentos, contas a pagar |
| **Admin** | Gestão de usuários, checklists, SLA, budget, tipos de serviço |
| **Master** | Acesso total ao tenant |
| **Administrativo** | Compras e operações internas |
| **Cliente** | Portal de leitura das próprias OS |
| **SuperMaster** | `is_platform=true` — gerencia todos os tenants (NextAI) |

---

## 2. Funcionalidades Atuais

### 2.1 Autenticação e RBAC

- **Login** com email/senha via Supabase Auth (JWT).
- **Perfil** carregado da tabela `public.users` após autenticação (`role`, `full_name`, `team_id`), com cache `localStorage` `nextai-profile-v1-{uid}` TTL 7 dias.
- **ProtectedRoute** redireciona não autenticados para `/login`.
- **RoleGuard** bloqueia rotas por array de roles permitidos.
- **PlatformGuard** bloqueia acesso ao layout `/platform/*` para não-SuperMaster.
- **SmartRedirect** em `/`: SuperMaster → `/platform/tenants`, Cliente → `/portal`, demais → `/dashboard`.
- **Race condition resolvida:** role carregado apenas via `initializeAuth()`, não duplicado no listener `INITIAL_SESSION`.
- **Logout agressivo:** limpa `localStorage` + `sessionStorage` + restaura tema padrão antes de invocar o SDK.
- Safety net de 10 s no `AuthContext` desbloqueando loading compulsoriamente (proteção contra cold-start Supabase free tier).

### 2.2 AppLayout e Navegação

- **Sidebar desktop** fixa com logo, links filtrados por role e dropdown de perfil.
- **Header mobile** com hamburger → Sheet lateral.
- **Bottom nav mobile** personalizável (8 atalhos configuráveis por usuário via localStorage).
- **Notificações realtime** no sino: badge animado, dropdown com histórico de 10, marcação como lida ao clicar; clique navega para a OS/item relacionado.
- **Animações:** tw-animate-css + @formkit/auto-animate (hover lift em cards, fade-in em páginas, pulse em badges).

### 2.3 Dashboard

**15 widgets configuráveis** (customizer; preferências por usuário persistidas em `dashboard_preferences`):

| Widget | Função |
|--------|--------|
| ReportsKpi | OS pendentes de review (técnico) / total abertas (gestor) |
| ReimbursementsKpi | Reembolsos do usuário / total pendentes financeiro |
| Productivity | % produtividade da semana vs meta |
| TicketMedio | R$ médio por reembolso aprovado (30d) |
| ApprovalRate | % aprovadas/processadas (30d) |
| ReturnRate | Taxa de OS devolvidas |
| ReportsBar | Bar chart: OS criadas vs concluídas (últimos 7d) |
| ReimbursementsPie | Pie chart: despesas por categoria (30d) |
| SLA | Status de SLAs (vencidos, em risco, ok) |
| BudgetBurn | Burn rate por categoria (orçamento vs realizado) |
| CpqKpi | Orçamentos por status |
| EstoqueCritico | Peças abaixo do estoque mínimo |
| HrSummary | KPIs RH (colaboradores ativos, folha estimada, horas registradas) |
| Agenda | Próximas OS agendadas |
| Csat | Score de satisfação recente |

**Filtros:** Período configurável (7d, 30d, 90d) com preferência salva no banco. Realtime via `postgres_changes`.

### 2.4 Ordens de Serviço (OS)

**Wizard de criação — 7 steps (lazy loading):**

| Step | Conteúdo | Validação obrigatória |
|------|---------|----------------------|
| 1 — Identificação | Tipo de serviço, data, nº OS (automático), prioridade | `service_type`, `service_date` |
| 2 — Ativo e Contexto | Cliente, local, equipamento, geolocalização GPS | — |
| 3 — Checklist | Perguntas dinâmicas do template ativo | — |
| 4 — Diagnóstico | Problema relatado, diagnóstico IA enriquecido + botão copiar | `reported_problem` |
| 5 — Execução | Serviços, peças (baixa automática de estoque na aprovação), pendências | `services_performed` |
| 6 — Evidências | Upload de fotos (Storage privado, signed URLs renovadas a cada 50 min) | — |
| 7 — Assinatura e Envio | Canvas HTML5 — técnico e cliente | — |

**Features adicionais:**
- Numeração automática sequencial por tenant (`OS-YYYY-NNNN`, RPC `reserve_os_number`)
- Busca full-text com índice GIN (`search_vector` GENERATED STORED)
- Filtros por prioridade, técnico, ordenação — sincronizados na URL (deep link)
- Edição de OS devolvida inline (sem refazer wizard)
- Reabrir OS rejeitada (`reopen_report` RPC)
- Duplicar OS (`?duplicateFrom=<id>`)
- Exportação Excel com filtros ativos
- Baixa automática de estoque na aprovação (trigger)
- Push notifications nativas (Web Push API + Edge Function, requer setup VAPID)
- Manutenção preventiva (CRUD + Edge Function `maintenance-scheduler`)
- QR Code de equipamento → abrir OS pré-vinculada (`@zxing/browser`)
- SLA tracking com escalonamento e alertas
- Vinculação OS↔Orçamento com auto-fill de itens (SAP SD/PM)
- Draft autosave no IndexedDB a cada alteração

**Fluxo de aprovação:**
```
draft → pending_review → approved
                       → returned   (técnico edita e resubmete)
                       → rejected   (pode ser reaberta)
```

**PDF:** cabeçalho azul com logo do tenant (async + `urlToDataUrl` + `fitInBox`).

### 2.5 Reembolsos

- Fluxo: captura (foto/voz) → IA extrai dados → formulário pré-preenchido → revisão.
- **Antifraude:** SHA-256 da imagem detecta duplicata; validação de CNPJ via API pública (cnpj.ws); alerta de anomalia de valor acima da média histórica do usuário.
- **Status "Pago":** Financeiro confirma depósito (`paid_at`, `paid_by`), encerrando o ciclo financeiro.
- **Expense Reports:** relatório agregado por período e técnico (`/reimbursements/expense-reports`).
- **Aprovação em lote** (Gestor/Financeiro): checkboxes + ação em massa.
- **Exportação:** PDF individual (jsPDF com logo do tenant) + Excel da lista filtrada.
- Histórico de auditoria (`reimbursement_history`): todas as transições com autor, status anterior/posterior, razão.
- Fluxo: `Pendente → Aprovado → Pago / Revisão / Rejeitado`.

### 2.6 Compras (Materiais)

- Criação com IA (foto → extração de especificação + quantidade).
- Ciclo: `Pendente → Em Análise → Comprado → Entregue / Cancelado`.
- **Purchase Orders (PO):** Comprador cria PO formal com upload de Nota Fiscal.
- Realtime, exportação Excel, filtros por status e busca por texto.
- Edição pelo técnico em status `Pendente`.

### 2.7 Orçamentos (CPQ)

- Criação com seleção de cliente (obrigatório), itens dinâmicos (`useFieldArray`), desconto (%), preview de totais em tempo real.
- Fluxo: `rascunho → enviado → aprovado / rejeitado`.
- **Assinatura eletrônica** do cliente (canvas + token único gerado no servidor).
- **Versionamento:** histórico de versões do orçamento.
- **Vinculação OS↔Orçamento:** auto-fill de itens/observações, chips "• OS" bidirecionais.
- PDF com logo do tenant, seção "OS Vinculada", tabela de itens, campo de assinatura do cliente.
- Realtime via Postgres Changes.

### 2.8 RH — Recursos Humanos

- CRUD colaboradores CLT: dados pessoais, cargo, departamento, salário, tipo de contrato.
- CRUD departamentos com hierarquia.
- Gerenciamento de certificações e documentos.
- Timeline de eventos (admissão, promoção, afastamento, desligamento).
- Roles: Gestor, Admin, Master.

### 2.9 DP — Departamento Pessoal

- **Folha de pagamento:** cálculo INSS 2024 progressivo + IRRF + FGTS (8%) + Vale-Transporte.
- **Holerite PDF** com logo do tenant (async + `urlToDataUrl`).
- **Ponto eletrônico:** registro de entradas e saídas (`/dp/timerecords`).
- **Férias:** agendamento e controle de períodos (`/dp/vacation`).
- Roles: Gestor, Admin, Master.

### 2.10 CP — Contas a Pagar

- CRUD de contas a pagar com parcelas e comentários.
- **Workflow de aprovação multinível:** submit → approve → pay / reject.
- Integração com widget `HrSummary` no Dashboard.
- Roles: Financeiro, Gestor, Admin, Master.

### 2.11 SLA

- Definição de SLAs por tipo de serviço e prioridade (CRUD admin em `/admin/sla`).
- Tracking de tempo de resposta e resolução por OS.
- Escalonamento automático via Edge Function `maintenance-scheduler`.
- Widget `SLA` no Dashboard.

### 2.12 Fornecedores

- CRUD de fornecedores com dados completos.
- Vinculação a POs e solicitações de compra.

### 2.13 Peças / Inventário

- CRUD de peças com estoque atual e mínimo.
- Alerta de estoque crítico (widget `EstoqueCritico` no Dashboard).
- Baixa automática de estoque na aprovação de OS (trigger).
- Entrada manual de estoque.

### 2.14 Agenda / Dispatch

- Calendário de despacho de OS por técnico (biblioteca: ver ADR-006).
- Visualização por dia/semana/mês.
- Widget `Agenda` no Dashboard.

### 2.15 Clientes

- CRUD completo com CNPJ, endereço (auto-fill via ViaCEP), telefone, contato.
- Múltiplas unidades/locais por cliente (`client_locations` com CASCADE).
- Cache em memória (`useClients`) para evitar N+1 queries.

### 2.16 Equipamentos

- CRUD: modelo, nº de série, cliente, data de instalação.
- Histórico de OS por equipamento.
- Ciclo de vida financeiro com depreciação linear.
- QR Code → abrir OS pré-vinculada (scanner `@zxing/browser`).
- Alertas de manutenção preventiva.

### 2.17 Base de Conhecimento (KB)

- CRUD de artigos com busca full-text em português (índice GIN `tsvector` FTS).
- Acessível a todos os roles operacionais.

### 2.18 Portal do Cliente

- Layout dedicado `ClientPortalLayout` (role `Cliente`).
- Visualização read-only das próprias OS.
- Rota: `/portal`.

### 2.19 CSAT

- Página pública `/csat/:token` (sem autenticação, sem login necessário).
- Disparada automaticamente pós-OS aprovada.
- Widget de score CSAT no Dashboard.

### 2.20 Administração

- **Usuários** (`/admin/usuarios`): criar, atribuir role, excluir — via Edge Function `admin-create-user` (nunca service role key no cliente).
- **Checklist Templates**: CRUD completo com editor de itens, reordenação ↑↓, vinculação por tipo de serviço.
- **Service Types** (`/admin/service-types`): tipos de serviço configuráveis por tenant (tabela `service_types` com `team_id`).
- **SLA** (`/admin/sla`): políticas de SLA por tipo e prioridade.
- **Budget** (`/admin/budget`): controle de orçamento por categoria com burn rate.
- **Maintenance Plans** (`/admin/maintenance-plans`): planos de manutenção preventiva.
- **Company Profile** (`/admin/company-profile`): perfil da empresa (dados do tenant visível a Admin/Master do próprio tenant).
- **Tenants** (`/admin/tenants`): visível apenas para Master — gerencia apenas seus próprios dados.

### 2.21 Platform (SuperMaster)

- **Layout dedicado** `PlatformLayout` com `PlatformGuard` (bloqueia não-SuperMaster).
- **Empresas** (`/platform/tenants`): CRUD de tenants, branding, status.
- **Perfil Comercial** (`/platform/company-profile`): SuperMaster edita CNPJ, endereço, dados fiscais de qualquer tenant.
- **Usuários** (`/platform/users`): visão cross-tenant de todos os usuários.
- **Intelligence** (`/platform/intelligence`): banco de dados cross-tenant anonimizado (15 abas, 13 tabelas brutas + 2 corpus de IA) — 7 RPCs SECURITY DEFINER.
- **Configurações** (`/platform/settings`).

### 2.22 Onboarding

- **25 tours** com **85+ steps** cobrindo 100% dos módulos (driver.js v1.4.0).
- Tours role-aware: cada role vê apenas o subconjunto aplicável.
- Navegação automática entre rotas durante o tour.
- `WelcomeModal` ao primeiro login.
- Convenção `data-onboarding="<identificador>"` em todos os elementos-alvo.
- Regra: roles do tour ⊆ `allowedRoles` do RoleGuard em `App.tsx` (verificar sempre ao criar novo tour).

### 2.23 Assistente de IA

**Edge Function `ai-proxy`** — nenhuma chave de API no bundle JS:

| Tipo | Input | Output |
|------|-------|--------|
| `receipt_images` | Base64 de comprovantes | Valor, favorecido, Pix, categoria, data |
| `receipt_voice` | Transcrição de voz | Idem |
| `material_images` | Fotos de produto | Especificação técnica, quantidade, obs |
| `material_voice` | Transcrição de voz | Idem |
| `diagnostic` | Texto + contexto de OS | Diagnóstico enriquecido, causas, recomendação |

**Cascade de fallback server-side:** Gemini Flash key 1 → Gemini Flash key 2 → OpenAI (todos via secrets, nunca `.env` exposto no bundle).

### 2.24 PWA

- Manifest: nome "NextAI", tema + ícone SVG. Cache `nextai-v7`.
- Service Worker (`public/sw.js`): cache-first para assets; network-first para Supabase.
- IndexedDB via `idb`: drafts de OS, fila offline.
- **Pendente:** ícones PNG 192×512 para instalação no Android/Chrome.
- **Pendente:** Background Sync (sincronização automática ao reconectar).

### 2.25 Multi-Tenancy

- Modelo: **shared database + RLS por `team_id`** (RESTRICTIVE, `USING (team_id = get_caller_team_id())`).
- Tabela `tenants`: `id`, `slug` (imutável), `name`, `logo_url`, `primary_color`, `is_platform` + dados comerciais.
- `get_caller_team_id()`: RPC STABLE SECURITY DEFINER usada em todas as policies RLS.
- Branding dinâmico: `hexToOklch()` + `applyTenantBrand()` injeta CSS vars OKLCH preservando luminância.
- Provisionamento: Edge Function `admin-provision-tenant` cria tenant + Master em transação única.
- **Tenants ativos:** NextAI (`nextai@gmail.com`, SuperMaster, `is_platform=true`), Mopar Engenharia (`master@gmail.com`), Zambrano Engenharia.
- **Regra crítica de INSERTs:** injetar `team_id` manualmente — RLS filtra leituras mas não injeta em writes.

### 2.26 Testes

**Vitest (unitários):** 117 testes passando em 8 arquivos:

| Arquivo | Cobertura |
|---------|-----------|
| `Login.test.tsx` | Autenticação e fluxo de login |
| `PlatformIntelligence.test.tsx` | Componente Intelligence SuperMaster |
| `Step4Diagnosis.integration.test.tsx` | Integração IA diagnóstico |
| `Step4Diagnosis.test.tsx` | Componente diagnóstico OS |
| `payrollCalculations.test.ts` | Cálculos INSS/IRRF/FGTS |
| `platformIntelligenceService.test.ts` | Serviço de inteligência |
| `equipment.test.ts` | Tipos de equipamento |
| `imageUtils.test.ts` | Utilitários de imagem/PDF |

**Playwright (E2E):** 23 arquivos spec, ~166 testes:

| Grupo | Testes |
|-------|--------|
| `tests/ux/01–05` (UX/UI SAP-level) | 37 |
| `tests/os-orcamento-vinculacao.spec.ts` | 33 |
| `tests/reports-audit.spec.ts` | 10 |
| `tests/reports-pdf.spec.ts` | 7 |
| `tests/reports-sync.spec.ts` | 6 |
| `tests/admin/user-management.spec.ts` | 7 |
| `tests/cp-module.spec.ts` | 8 |
| `tests/dp-module.spec.ts` | 7 |
| `tests/rh-module.spec.ts` | 7 |
| `tests/platform-company-profile.spec.ts` | 6 |
| `tests/platform/` (6 specs) | ~14 |
| `tests/dashboard-verify.spec.ts` | 5 |
| `tests/orcamentos-sprint-d.spec.ts` | 5 |
| `tests/smoke.spec.ts` | 4 |

Credenciais em `tests/.env.test` (gitignored). Timeout 90 s (cold-start Supabase free tier).

---

## 3. Pilha Tecnológica

### 3.1 Frontend

| Categoria | Tecnologia | Versão |
|-----------|-----------|--------|
| Framework | React | 19.0 |
| Bundler | Vite | 6.2 |
| Linguagem | TypeScript | 5.8 |
| Roteamento | react-router-dom | 7.14 |
| Estilização | TailwindCSS | 4.1 |
| UI Base | shadcn/ui + @base-ui/react | 4.2 / 1.4 |
| Ícones | lucide-react | 0.546 |
| Formulários | react-hook-form + Zod | 7.72 / 4.3 |
| Animações | tw-animate-css + @formkit/auto-animate | — |
| Gráficos | Recharts | 3.8 |
| Notificações | Sonner | 2.0 |
| Temas | next-themes | 0.4 |
| Fonte | Geist Variable | 5.2 |
| Onboarding | driver.js | 1.4 |
| QR Code | qr-code-styling + @zxing/browser | 1.9 / 0.2 |
| Datas | date-fns (ptBR) | 4.1 |

### 3.2 Backend (Supabase)

| Serviço | Uso |
|---------|-----|
| **PostgreSQL** | Banco principal (25+ tabelas, enums, índices GIN, triggers) |
| **Supabase Auth** | JWT, sessão, refresh token |
| **Row Level Security** | Isolamento por `team_id` via `get_caller_team_id()` |
| **Realtime** | `postgres_changes` em 8+ tabelas |
| **Storage** | Bucket privado `service_reports_media` (fotos, assinaturas) |
| **Storage** | Bucket público `tenant-assets` (logos) |

### 3.3 Edge Functions (8)

| Função | Propósito |
|--------|-----------|
| `admin-create-user` | Criar usuário no Auth + `public.users` com `team_id` |
| `admin-delete-user` | Excluir usuário com guard cross-tenant |
| `admin-provision-tenant` | Criar tenant + Master em transação única |
| `admin-reset-password` | Reset de senha pelo Admin |
| `maintenance-scheduler` | SLA escalonamento + manutenção preventiva |
| `platform-update-user` | SuperMaster atualiza usuário de qualquer tenant |
| `push-notification` | Web Push API (VAPID) — notificações nativas |
| `storage-backfill-mopar` | Script único de migração de storage (legado) |

### 3.4 IA e Integrações

| Provedor | Uso | Fallback |
|---------|-----|---------|
| Google Gemini Flash (key 1) | Extração primária + diagnóstico | → Gemini key 2 |
| Google Gemini Flash (key 2) | Fallback de quota | → OpenAI |
| OpenAI GPT | Fallback final | — |

**Nenhum SDK de IA no bundle cliente** — todas as chamadas passam pela Edge Function.

### 3.5 PDF e Exportação

| Biblioteca | Uso |
|-----------|-----|
| jsPDF 4.2 + jspdf-autotable 5.0 | PDF de OS, reembolsos, orçamentos, holerites (client-side) |
| xlsx 0.18 | Excel de reembolsos, materiais |

### 3.6 Offline e Persistência Local

| Biblioteca | Uso |
|-----------|-----|
| idb 8.0 | IndexedDB — drafts de OS e fila offline |
| Service Worker (`public/sw.js`) | Cache estático + network-first Supabase — `nextai-v7` |

### 3.7 Testes

| Ferramenta | Versão | Uso |
|-----------|--------|-----|
| Vitest | 3.2 | 117 testes unitários em 8 arquivos |
| @testing-library/react | 16.3 | Render de componentes |
| @playwright/test | 1.59 | 23 specs E2E, ~166 testes |
| TypeScript strict | 5.8 | `tsc --noEmit` como verificação pós-feature |

### 3.8 Deploy e Infra

| Aspecto | Configuração |
|---------|-------------|
| Dev server | `npm run dev` — porta 3001, host 0.0.0.0 |
| Build | `vite build` → `/dist` |
| Deploy | Vercel auto-deploy ao push no `master` |
| Produção | https://nextai-plataform.vercel.app |
| Supabase project ref | `sksursvmgvxqbbdsztcd` |
| Migrations | 23 arquivos em `supabase/migrations/` |

---

## 4. Dívidas Técnicas

Classificação: 🔴 Crítico · 🟡 Importante · 🟢 Melhoria

### 4.1 🔴 `package.json` name incorreto

**Problema:** `name` no `package.json` ainda é `react-example`.  
**Impacto:** Cosmético mas inconsistente com a identidade do produto em ferramentas e npm scripts.  
**Recomendação:** Alterar para `nextai-plataform`.

### 4.2 🟡 Background Sync não implementado

**Problema:** PWA base funciona (manifest, SW, IndexedDB), mas OS criadas offline ficam no IndexedDB sem sincronização automática ao reconectar.  
**Onde:** `public/sw.js`.  
**Recomendação:** Implementar `Background Sync API` com evento `sync` no service worker.

### 4.3 🟡 Ícones PWA ausentes

**Problema:** `public/manifest.json` referencia `icon-192.png` e `icon-512.png`, mas apenas `icon.svg` existe. Instalação como PWA no Android/Chrome falha silenciosamente.  
**Recomendação:** Gerar a partir de `public/icons/icon.svg` com conversor SVG→PNG.

### 4.4 🟡 Criação de orçamento não atômica

**Problema:** `criarOrcamento` em `src/services/orcamentoService.ts` faz 2 roundtrips separados (insert orçamento + insert itens). Compensação manual no erro pode falhar, deixando orçamento órfão sem itens.  
**Recomendação:** Criar RPC `criar_orcamento(p_orcamento JSONB, p_itens JSONB[])` com atomicidade real.

### 4.5 🟡 Sem ESLint

**Problema:** Apenas `tsc --noEmit` como lint. Erros de estilo, unused imports, hooks dependencies e acessibilidade não são capturados.  
**Recomendação:** Adicionar ESLint com `@typescript-eslint`, `eslint-plugin-react-hooks` e `eslint-plugin-jsx-a11y`.

### 4.6 🟢 Sem Error Boundary global

**Problema:** Um erro não capturado em qualquer módulo desmonta toda a aplicação com tela branca, sem fallback.  
**Recomendação:** Adicionar `React.ErrorBoundary` no `App.tsx` wrappando o `<Outlet>`.

### 4.7 🟢 Dark mode não acessível pela UI principal

**Problema:** `next-themes` está instalado e funcional, mas o toggle de tema fica apenas no Sheet "Minha Conta" — não exposto no header ou sidebar.  
**Recomendação:** Expor toggle de tema no header para acesso rápido.

---

## 5. Roadmap de Próximos Passos

| Feature | Prioridade | Esforço estimado |
|---------|-----------|-----------------|
| Notificações email (Resend) + WhatsApp (Evolution API) | 🔴 Alta | 1–2 dias |
| IA de Escrita de Relatórios (texto livre → linguagem técnica profissional) | 🔴 Alta | 1–2 dias |
| Background Sync offline (Service Worker) | 🟡 Média | 1 dia |
| Ícones PNG 192×512 para instalação PWA | 🟢 Baixa | horas |
| RAG Analytics — busca em linguagem natural nos relatórios | 🟡 Estratégico | 5–8 dias |
| Dispatching com mapa GPS em tempo real (localização de técnicos) | 🟡 Estratégico | 5–8 dias |
| Integração ERP (TOTVS / SAP / Omie) via webhook | 🟡 Estratégico | 3–5 dias/ERP |
| Fase 6 SaaS: subdomain routing por tenant + billing (Stripe) | 🟡 Estratégico | 2–3 semanas |

---

*Atualizado em 2026-06-04 (Sessão 68) — 135 commits · Sprints A–F concluídas · 117 testes unitários · 23 specs E2E.*
