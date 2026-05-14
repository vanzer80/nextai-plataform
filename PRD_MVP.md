# PRD — Portal Mopar · MVP

> **Documento:** Product Requirements Document — estado real do MVP  
> **Gerado em:** 2026-04-22 · **Atualizado em:** 2026-05-13  
> **Versão do código:** Sprints 1–10 + Sessões 31–39 (Multi-Tenancy / NextAI)  
> **TypeScript:** `npx tsc --noEmit` → EXIT:0

---

## 1. Visão Geral

O **Portal Mopar** é um sistema operacional web para equipes de manutenção, campo e backoffice da Mopar Engenharia. Centraliza processos que antes eram executados por WhatsApp, PDF manual, planilhas e comunicação informal.

### O que o app faz hoje

- Técnicos de campo **criam relatórios técnicos** em 7 etapas guiadas (checklist dinâmico, fotos, geolocalização, assinatura digital do técnico e do cliente) e os submetem para aprovação.
- Gestores **aprovam, devolvem ou rejeitam** relatórios e reembolsos com trilha de auditoria persistida no banco.
- Técnicos **solicitam reembolso de despesas** com extração automática via IA (foto do comprovante ou voz), e o financeiro processa o pagamento.
- Técnicos e administrativos **solicitam compra de materiais**; compradores gerenciam o ciclo (análise → compra → entrega).
- Técnicos **criam orçamentos técnicos** por itens, os enviam para aprovação e exportam PDF profissional para o cliente.
- O **Dashboard** exibe KPIs em tempo real distintos por perfil: relatórios pendentes, reembolsos, produtividade semanal, ticket médio e taxa de aprovação.
- **Notificações em tempo real** chegam via Supabase Realtime com sino e badge de não lidas.
- O app é **instalável como PWA** (manifest + Service Worker) e possui base de operação offline parcial via IndexedDB.
- O app funciona como **plataforma SaaS white-label** (NextAI): o SuperMaster provisiona novas empresas com branding dinâmico por cor primária (OKLCH), logo próprio e isolamento completo de dados por tenant.

### Público-alvo

| Perfil | Função principal no app |
|--------|------------------------|
| **Tecnico** | Criar relatórios, reembolsos, compras, orçamentos |
| **Supervisor** | Acompanhar equipe, aprovar relatórios |
| **Gestor** | Visão gerencial completa, aprovações, orçamentos |
| **Comprador** | Processar solicitações de materiais |
| **Financeiro** | Visualizar e aprovar reembolsos |
| **Admin** | Gestão de usuários, checklists, clientes |
| **Master** | Acesso total, sem restrições |
| **Administrativo** | Acesso a compras e operações internas |

---

## 2. Funcionalidades Atuais

### 2.1 Autenticação e RBAC

- **Login** com email/senha via Supabase Auth (JWT).
- **Perfil carregado** da tabela `public.users` após autenticação (`role`, `full_name`, `team_id`).
- **ProtectedRoute** redireciona não autenticados para `/login`.
- **RoleGuard** bloqueia rotas por array de roles permitidos.
- **Fallback de timeout:** se o banco não responder em 30 s, mantém role em memória ou usa `'Tecnico'` como padrão seguro.
- **Race condition resolvida:** role é carregado apenas via `initializeAuth()`, não duplicado no listener `INITIAL_SESSION`.
- **Logout** agressivo: limpa `localStorage` e `sessionStorage` antes de invocar o SDK.
- **setup_pending:** flag ativada quando usuário existe no Auth mas não na tabela `users` (trigger pendente).

### 2.2 AppLayout e Navegação

- **Sidebar desktop** fixa com logo, links de navegação filtrados por role e dropdown de perfil.
- **Header mobile** com hamburger que abre Sheet lateral.
- **Bottom nav mobile** com atalhos para Dashboard, Relatórios e Compras.
- **Notificações realtime** no sino: badge animado, dropdown com histórico de 10, marcação como lida ao clicar.
- Links visíveis por role:

| Link | Roles |
|------|-------|
| Dashboard | Todos |
| Relatórios | Tecnico, Supervisor, Gestor, Admin, Master |
| Orçamentos | Tecnico, Supervisor, Gestor, Admin, Master |
| Reembolsos | Tecnico, Supervisor, Gestor, Financeiro, Admin, Master |
| Compras | Tecnico, Administrativo, Supervisor, Gestor, Comprador, Admin, Master |
| Clientes | Supervisor, Gestor, Admin, Master |
| Checklists | Gestor, Admin, Master |
| Administrador | Gestor, Admin, Master |
| Tenants | Master (is_platform = true) |

### 2.3 Dashboard

**KPIs disponíveis (dados reais do banco):**

| Widget | Técnico vê | Gestor/Admin vê |
|--------|-----------|----------------|
| Relatórios | Meus pendentes (pending_review) | Total de abertos (geral) |
| Reembolsos | Meus aprovados (valor R$) | Total pendente de aprovação (R$) |
| Produtividade | % da semana vs meta 10 relatórios | % da equipe vs mesma meta |
| Ticket médio | — | R$ médio por reembolso aprovado (30d) |
| Taxa de aprovação | % aprovados/processados (30d) | % aprovados/processados (30d) |

**Gráficos:**
- **Bar chart** (Recharts): relatórios criados vs concluídos por dia nos últimos 7 dias.
- **Pie chart** (Recharts): despesas por categoria (Transporte, Alimentação, Hospedagem, Outros) nos últimos 30 dias.

**Realtime:** canal `dashboard_realtime` ouve INSERT/UPDATE em `reimbursements` e refaz o fetch.

**Ações rápidas** (apenas técnicos): botões diretos para "Novo Relatório" e "Nova Nota de Reembolso".

### 2.4 Relatórios Técnicos

**Wizard de criação — 7 steps (todos com lazy loading):**

| Step | Conteúdo | Validação obrigatória |
|------|---------|----------------------|
| 1 — Identificação | Tipo de serviço, data, nº OS | `service_type`, `service_date` |
| 2 — Ativo e Contexto | Cliente, local, equipamento, geolocalização GPS | — |
| 3 — Checklist | Perguntas dinâmicas do template ativo | — |
| 4 — Diagnóstico | Problema relatado, diagnóstico preliminar e final | `reported_problem` |
| 5 — Execução | Serviços executados, peças, pendências, recomendação | `services_performed` |
| 6 — Evidências | Upload de fotos (Storage privado, signed URLs) | — |
| 7 — Assinatura e Envio | Canvas nativo HTML5 para técnico e cliente | — |

**Tipos de serviço:** `Preventiva`, `Corretiva`, `Instalação`, `Vistoria`, `Emergência`.

**Draft autosave:** `useReportDraft` persiste o rascunho no IndexedDB (`report-drafts-db`) a cada alteração, incluindo checklist.

**Submissão:** RPC atômica `submit_report` — uploads de Storage em paralelo antes da transação DB. 5 tabelas em 1 transaction com rollback automático.

**Assistente IA:** `AiDiagnosticAssistant` no Step 4 — envia texto para Edge Function `ai-proxy` e recebe diagnóstico técnico enriquecido (causas prováveis, recomendações).

**Fluxo de aprovação:**
```
draft → pending_review → approved
                       → returned   (técnico deve revisar)
                       → rejected
```

**Painel de aprovação** (Gestor/Admin/Supervisor): inline no `ReportDetail`, com campo de comentário e RPC `process_report_action` (SECURITY DEFINER).

**Fotos:** bucket privado `service_reports_media`. `useReportDetail` regenera signed URLs a cada 50 min via `setInterval`.

**Lista:** paginação de 20 por página, filtros por status, data e técnico (gestor), Realtime via canal `reports_list_realtime`.

**Checklist Templates (admin):**
- CRUD completo: criar, editar, ativar/desativar, excluir templates.
- Editor de itens: texto livre, booleano, número, opção múltipla, upload.
- Reordenação ↑↓ de itens.
- Vinculação por tipo de serviço e categoria de ativo.
- Roles: Gestor, Admin, Master.

### 2.5 Reembolsos

**Criação em 2 etapas:**
1. **Captura:** foto do comprovante via câmera ou upload → IA extrai automaticamente: valor, favorecido, chave Pix, categoria, data.
2. **Formulário:** revisão e complemento dos dados extraídos.

**Campos:** categoria, valor, data da despesa, favorecido, chave Pix, descrição, tipo de manutenção, cliente, filial, budget.

**Categorias:** Transporte, Alimentação, Hospedagem, Outros (+ Combustível e Estacionamento via IA).

**Modo edição:** técnico pode editar reembolsos em status `Revisão` (devolvidos pelo gestor).

**Fluxo de status:**
```
Pendente → Aprovado
         → Rejeitado (com razão)
         → Revisão   (devolvido, técnico corrige e resubmete)
```

**Aprovação em lote** (Gestor/Financeiro): checkboxes + ação em massa.

**Histórico de auditoria:** tabela `reimbursement_history` registra todas as transições com autor, status anterior/posterior e razão.

**Exportações disponíveis:**
- **PDF individual** (jsPDF) com dados do reembolso.
- **Excel** (XLSX) da lista filtrada.

**Extração por voz:** `extractReceiptFromVoice` — usuário dita o valor e dados, a IA preenche o formulário.

### 2.6 Compras (Materiais)

**Criação:** formulário com item, quantidade, urgência, razão, cidade, cliente, loja, tipo de manutenção, prazo, especificação técnica, foto do produto, link de referência, observações.

**Extração IA:** foto do material → `extractMaterialFromImages` preenche especificação e quantidade.

**Ciclo de status:**
```
Pendente → Em Análise → Comprado → Entregue
                      → Cancelado
```

**Processamento (Comprador/Gestor):** resposta com preço de compra, link, observações. Modal de detalhe com histórico de processamento.

**Realtime:** INSERT/UPDATE em `material_requests` atualiza a lista.

**Exportação:** XLSX da lista com filtros ativos.

**Filtragem:** tabs por status + busca por texto.

**Edição:** técnico pode editar solicitação em status `Pendente`.

### 2.7 Orçamentos

**Entidade própria** com fluxo completo de ciclo de vida:

**Criação (Formulário):**
- Seleção de cliente (obrigatório).
- Título, observações, validade, desconto (%).
- Itens dinâmicos: descrição, quantidade, unidade, valor unitário.
- Preview de totais em tempo real: subtotal, desconto, total.
- Gestão de itens via `useFieldArray` (adicionar/remover linhas).
- Modo edição: recarrega orçamento existente e permite alterações em `rascunho`.

**Fluxo de status:**
```
rascunho → [técnico envia] → enviado → [gestor aprova] → aprovado
                                      → [gestor rejeita + motivo] → rejeitado
```

**Geração de PDF (client-side, jsPDF):**
- Cabeçalho com número `ORC-XXXXXXXX`, data de emissão, validade.
- Dados do cliente e técnico responsável.
- Tabela de itens (jspdf-autotable): qtd, unidade, valor unitário, total por linha.
- Totais: subtotal, desconto, total em destaque.
- Observações e campo de assinatura do cliente.

**RLS:** técnico vê e edita apenas os seus; Gestor/Admin/Master veem tudo; Supervisor tem leitura total.

**Realtime:** lista e detalhe atualizam via canais Postgres Changes.

### 2.8 Clientes

- CRUD completo: criar, editar, excluir clientes.
- Campo obrigatório: `name` (razão social, mín. 3 caracteres).
- Acesso restrito: Supervisor, Gestor, Admin, Master.
- Cache em memória (módulo `useClients`) — evita N+1 queries nos selects de cliente em outros módulos.

### 2.9 Administração de Usuários

- Listagem de todos os usuários com avatar, nome, email e role.
- **Criação de usuário:** `full_name`, `email`, `role` — cria conta no Supabase Auth com convite.
- **Edição de role:** troca de perfil via dropdown.
- **Exclusão:** remove do Auth e da tabela `users`.
- Acesso: Gestor, Admin, Master.

**Nota:** Gerenciamento de tenants (criar/editar empresas na plataforma) é um módulo separado — ver §2.13. UserManagement gerencia usuários dentro de um tenant; TenantManagement gerencia os próprios tenants.

### 2.10 Assistente de IA

**Edge Function `ai-proxy`** (Supabase) — nenhuma chave no bundle JS:

| Tipo de extração | Input | Output |
|-----------------|-------|--------|
| `receipt_images` | Base64 de fotos de comprovante | Valor, favorecido, Pix, categoria, data |
| `receipt_voice` | Transcrição de voz | Idem |
| `material_images` | Fotos de produto/embalagem | Especificação técnica, quantidade, obs |
| `material_voice` | Transcrição de voz | Idem |
| `diagnostic` | Texto de diagnóstico + contexto | Diagnóstico enriquecido, causas, recomendação |

**Cascade de fallback server-side:** Gemini 1 → Gemini 2 → OpenAI (todos via secrets, não .env).

### 2.11 PWA

- `manifest.json`: nome "Portal Mopar", tema `#2563eb`, fundo `#020617`, ícone SVG base.
- `sw.js`: cache-first para assets estáticos; network-first para chamadas Supabase.
- Registrado no `main.tsx` após `window.load`.
- **Pendente:** `icon-192.png` e `icon-512.png` (necessários para instalação em produção).

### 2.12 Testes E2E (Playwright)

4 smoke tests em `tests/smoke.spec.ts`:

| Teste | Cobertura |
|-------|-----------|
| S1 | Técnico cria relatório (7 steps) → aparece na lista |
| S2 | Gestor aprova relatório → status muda para Aprovado |
| S3 | Reembolso criado tem status correto (enum sem duplicação) |
| S4 | RLS isolation: Técnico B não acessa relatório do Técnico A via URL direta |

**Status:** instalado, aguardando credenciais reais em `tests/.env.test`.

### 2.13 Multi-Tenancy / NextAI Platform

Infraestrutura SaaS white-label implementada nas Sessões 31–39. Permite que uma única instância Supabase sirva múltiplas empresas com isolamento completo de dados, branding dinâmico e provisionamento self-service.

**Tabela `tenants`:** `id`, `slug` (imutável, unique), `name`, `logo_url`, `primary_color`, `is_platform`.

**Flag `is_platform`:** distingue SuperMaster de plataforma (NextAI, `is_platform = true`) de Master de cliente (`is_platform = false`). Guard em `Dashboard.tsx` redireciona `is_platform = true` para `/admin/tenants` imediatamente — SuperMaster nunca vê o dashboard operacional vazio.

**`TenantContext` + `useTenant()`:** carrega o tenant do usuário logado via `team_id`; chama `applyTenantBrand()` após hydratação; chama `applyTenantBrand(null)` no logout para restaurar o tema padrão.

**`src/lib/color.ts`:** `hexToOklch()` (matrizes OKLab oficiais de Björn Ottosson) + `applyTenantBrand()` injeta `<style id="tenant-brand">` no `<head>` com variáveis CSS `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring` para light e dark. Preserva luminância do design system (0.52 light / 0.72 dark); chroma dark = 86% do light.

**Bucket `tenant-assets`:** público, limite 2 MB, tipos PNG/JPEG/WebP. 3 policies em `storage.objects`: SELECT aberto (qualquer usuário lê logos), INSERT e UPDATE restritos a `role = Master AND is_platform = true`.

**`TenantManagement.tsx`:** tabela de tenants com thumbnail 24×24 do logo; dialog de criação com campos slug, name, primary_color, logo (upload + preview 40×40); dialog de edição com name, primary_color, logo — slug desabilitado e imutável após criação; coluna Ações com botão Pencil por linha.

**Edge Function `admin-provision-tenant`:** recebe `tenant{slug, name, primary_color, logo_url?}` + `master{email, password, full_name}`; cria tenant e usuário Master em transação única server-side. Upload do logo (se fornecido) ocorre antes da chamada à Edge Function — URL pública passada no body.

**`get_caller_team_id()`:** RPC `STABLE SECURITY DEFINER` — helper usado pelas políticas RLS de isolamento; retorna `team_id` do usuário autenticado via `auth.uid()`.

**`notify_compradores` (R-02):** corrigida em Sessão 31 para filtrar por `team_id` do caller — antes notificava Compradores de **todos** os tenants indiscriminadamente.

**Acesso:** `TenantManagement` visível e acessível apenas para usuários com `role = Master` e `is_platform = true`.

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
| Animações | motion (Framer Motion v12) | 12.23 |
| Gráficos | Recharts | 3.8 |
| Notificações | Sonner | 2.0 |
| Fonte | Geist Variable (@fontsource-variable) | 5.2 |
| Temas | next-themes | 0.4 |

### 3.2 Backend (Supabase)

| Serviço | Uso |
|---------|-----|
| **PostgreSQL** | Banco principal (17 tabelas, enums, índices, triggers) |
| **Supabase Auth** | JWT, sessão, refresh token |
| **Row Level Security** | Isolamento por `auth.uid()` + `role` |
| **Realtime** | `postgres_changes` em 6+ tabelas |
| **Storage** | Bucket privado `service_reports_media` (fotos, assinaturas) |
| **Storage** | Bucket público `tenant-assets` (logos de tenants) |
| **Edge Functions** | `ai-proxy` — chamadas IA server-side |
| **Edge Functions** | `admin-provision-tenant` — provisioning de tenant + usuário Master |
| **RPCs** | `get_caller_team_id()` — helper RLS, retorna `team_id` do caller |

### 3.3 IA e Integrações

| Provedor | Uso | Fallback |
|---------|-----|---------|
| Google Gemini (key 1) | Extração primária de imagens/voz | → Gemini key 2 |
| Google Gemini (key 2) | Fallback de quota | → OpenAI |
| OpenAI GPT | Fallback final | — |

SDK no cliente: `@google/genai` 1.50 instalado mas **não usado diretamente** — todas as chamadas vão para a Edge Function.

### 3.4 PDF e Exportação

| Biblioteca | Uso |
|-----------|-----|
| jsPDF 4.2 + jspdf-autotable 5.0 | PDF de reembolsos e orçamentos (client-side) |
| XLSX 0.18 | Exportação Excel de reembolsos e materiais |

### 3.5 Offline e Persistência Local

| Biblioteca | Uso |
|-----------|-----|
| idb 8.0 | IndexedDB — drafts de relatórios (`report-drafts-db`) |
| Service Worker (`sw.js`) | Cache estático + network-first Supabase |

### 3.6 Utilitários

| Arquivo | Função |
|---------|--------|
| `src/lib/withTimeout.ts` | Race condition helper: rejeita Promise após N ms |
| `src/lib/supabase.ts` | Cliente Supabase singleton |
| `src/lib/color.ts` | `hexToOklch()` + `applyTenantBrand()` — branding dinâmico por OKLCH |
| `date-fns` 4.1 | Formatação de datas (locale pt-BR) |
| `clsx` + `tailwind-merge` | Composição segura de classes CSS |
| `class-variance-authority` | Variantes de componentes UI |

### 3.7 Qualidade e Testes

| Ferramenta | Uso |
|-----------|-----|
| TypeScript strict | `tsc --noEmit` como único linter (sem ESLint) |
| Playwright 1.59 | 4 smoke tests E2E (instalado, não configurado) |
| `dotenv` 17.2 | Carregamento de `.env.test` nos testes |

### 3.8 Deploy e Infra

| Aspecto | Configuração |
|---------|-------------|
| Dev server | `npm run dev` — porta 3001, host 0.0.0.0 |
| Build | `vite build` → `/dist` |
| Preview | `vite preview` |
| Supabase project ref | `sksursvmgvxqbbdsztcd` |

---

## 4. Dívidas Técnicas e Gargalos

Classificação: 🔴 Crítico · 🟡 Importante · 🟢 Melhoria

---

### 4.1 🔴 Inconsistência de enums de status entre módulos

**Problema:** `service_reports` usa enums em inglês (`draft`, `pending_review`, `approved`, `returned`, `rejected`). `reimbursements` e `material_requests` usam strings em português (`'Pendente'`, `'Aprovado'`, `'Rejeitado'`, `'Revisão'`, `'Comprado'`, `'Entregue'`). Essa inconsistência já causou o bug H-01 (`'Revisao'` vs `'Revisão'`) e aumenta risco de regressão futura.

**Onde:** `Dashboard.tsx` linhas 71 e 77 (queries com `'Pendente'`/`'Aprovado'`), `MaterialsList.tsx` (todos os status em PT), `reimbursements/*`.

**Impacto:** Queries com string errada retornam 0 linhas silenciosamente (sem erro HTTP). Diagnóstico difícil em produção.

**Recomendação:** Migrar `reimbursements.status` e `material_requests.status` para enums PostgreSQL em inglês (migration + busca/substituição no frontend).

---

### 4.2 🔴 Dashboard Realtime incompleto

**Problema:** O canal `dashboard_realtime` ouve apenas mudanças em `reimbursements`. O Bar Chart de relatórios (últimos 7 dias) **não é atualizado em tempo real** quando um relatório é criado ou aprovado — requer refresh manual da página.

**Onde:** `Dashboard.tsx` linhas 212–222.

**Recomendação:** Adicionar listener para INSERT/UPDATE em `service_reports` no mesmo canal ou criar canal dedicado.

---

### 4.3 🔴 `UserManagement.tsx` instancia segundo cliente Supabase

**Problema:** `UserManagement.tsx` importa `createClient` de `@supabase/supabase-js` além do cliente singleton. Se estiver usando `SUPABASE_SERVICE_ROLE_KEY` via variável de ambiente Vite, essa chave fica exposta no bundle JavaScript do cliente.

**Onde:** `src/pages/admin/UserManagement.tsx` linha 8.

**Recomendação:** Operações de criação/exclusão de usuários devem ser feitas via Supabase Edge Function com service role key nos secrets — nunca no frontend.

---

### 4.4 🟡 Meta de produtividade hardcoded

**Problema:** `targetWeekly = 10` em `Dashboard.tsx` linha 192 — a métrica de produtividade é calculada dividindo relatórios criados por um valor fixo sem configuração. Diferentes equipes têm metas distintas.

**Recomendação:** Mover para tabela de configuração por `team_id` ou `role`, com CRUD admin.

---

### 4.5 🟡 Criação de orçamento não é atômica

**Problema:** `criarOrcamento` em `orcamentoService.ts` faz 2 roundtrips separados (insert orçamento + insert itens). Se o segundo falhar, há tentativa de compensação manual (delete do orçamento), mas essa compensação também pode falhar, deixando orçamento órfão sem itens.

**Onde:** `src/services/orcamentoService.ts` linhas 35–72.

**Recomendação:** Criar RPC `criar_orcamento(p_orcamento JSONB, p_itens JSONB[])` como feito com `submit_report` — garantia de atomicidade real.

---

### 4.6 🟡 Service Worker muito básico para PWA de produção

**Problema:** O `sw.js` cacheia apenas 3 arquivos estáticos e não implementa:
- Sincronização de fila offline para requests POST (relatórios enviados offline ficam apenas no IndexedDB, sem reprocessamento pelo SW).
- Estratégia de atualização de cache (versioning manual).
- `notificationclick` para push notifications futuras.

**Onde:** `public/sw.js`.

**Recomendação:** Substituir por Workbox ou implementar `Background Sync` para a fila de relatórios offline.

---

### 4.7 🟡 `@google/genai` instalado mas não usado no cliente

**Problema:** `@google/genai` (versão 1.50, 6+ MB) está nas dependências do projeto, mas toda a lógica de IA foi corretamente movida para a Edge Function. O pacote infla o bundle desnecessariamente.

**Onde:** `package.json` linha 16.

**Recomendação:** `npm remove @google/genai`.

---

### 4.8 🟡 Sem ESLint — apenas `tsc --noEmit`

**Problema:** O projeto usa TypeScript como único mecanismo de lint (`"lint": "tsc --noEmit"` no `package.json`). Erros de estilo, unused imports, hooks dependencies e acessibilidade não são capturados.

**Recomendação:** Adicionar ESLint com `@typescript-eslint`, `eslint-plugin-react-hooks` e `eslint-plugin-jsx-a11y`.

---

### 4.9 🟡 Tipagem fraca em módulos legados

**Problema:** Vários componentes antigos (antes do hardening da Sprint 9) ainda usam `any`:
- `MaterialsList.tsx`: `useState<PurchaseRequest[]>` existe mas vários campos aninhados são `any`.
- `ReimbursementsList.tsx`: `useState<any[]>([])`.
- `AppLayout.tsx`: `useState<any[]>([])` para notificações.
- `Dashboard.tsx`: `useState<any[]>([])` para `barData` e `pieData`.

**Recomendação:** Criar interfaces para `Notification`, `ReimbursementListItem`, `MaterialRequest` nos arquivos de `src/types/`.

---

### 4.10 🟡 Sem Error Boundary global

**Problema:** Não há `React.ErrorBoundary` em nenhum ponto da árvore de componentes. Um erro não capturado em qualquer módulo desmonta toda a aplicação com tela branca, sem fallback.

**Recomendação:** Adicionar `ErrorBoundary` no `App.tsx` wrappando o `<Outlet>`.

---

### 4.11 🟡 `motion` instalado mas subutilizado

**Problema:** `motion` (Framer Motion v12, ~50 kB gzip) está nas dependências mas aparentemente não é usado ou é usado em poucos lugares, inflando o bundle.

**Recomendação:** Auditar uso real com `grep -r "from 'motion'"`. Se não utilizado, remover.

---

### 4.12 🟡 Playwright sem credenciais — CI impossível

**Problema:** Os 4 smoke tests existem mas `tests/.env.test` não está configurado, o que significa que nenhum teste roda em CI/CD. A cobertura funcional é zero em ambientes automatizados.

**Recomendação:** Criar usuários de teste no banco de staging, adicionar secrets no CI (GitHub Actions/etc.) e incluir `npx playwright test` na pipeline.

---

### 4.13 🟢 `next-themes` instalado mas dark mode não implementado

**Problema:** `next-themes` está nas dependências mas não há `ThemeProvider` no `App.tsx` nem toggle de tema na UI.

**Recomendação:** Implementar ou remover a dependência.

---

### 4.14 🟢 Clientes sem dados estruturados (apenas nome)

**Problema:** A tabela `clients` tem apenas `id`, `name`, `created_at`. Campos como CNPJ, endereço, telefone, contato e segmento são necessários para orçamentos e relatórios profissionais, mas não existem.

**Recomendação:** Migration adicionando colunas opcionais: `cnpj`, `address`, `phone`, `contact_name`, `segment`.

---

### 4.15 🟢 Sem fluxo de recuperação de senha / perfil do usuário

**Problema:** Não há tela de "Esqueci minha senha" (redirecionamento para email de reset do Supabase) nem página de edição do próprio perfil (nome, foto, telefone).

**Recomendação:** Sprints menores de UX — `supabase.auth.resetPasswordForEmail()` + tela `/perfil`.

---

### 4.16 🟢 PWA ícones de produção ausentes

**Problema:** `public/manifest.json` referencia `icon-192.png` e `icon-512.png`, mas apenas `icon.svg` existe. A instalação como PWA no Android/Chrome falha silenciosamente sem os PNGs.

**Pendência:** Gerar a partir de `public/icons/icon.svg` com qualquer conversor SVG→PNG.

---

### 4.17 🟢 Produtividade e ticket médio sem drill-down

**Problema:** Os KPIs do Dashboard exibem números sem possibilidade de ver quais relatórios ou reembolsos compõem o número. O usuário não consegue investigar picos ou quedas.

**Recomendação:** Tornar os KPI cards clicáveis, filtrando a lista correspondente com os mesmos parâmetros da query do dashboard.

---

## 5. Resumo executivo das dívidas

| Prioridade | Quantidade | Ação principal |
|-----------|-----------|----------------|
| 🔴 Crítico | 3 | Padronizar enums de status; corrigir Dashboard Realtime; isolar criação de usuário em Edge Function |
| 🟡 Importante | 9 | Atomicidade de orçamentos; ESLint; tipagem; Error Boundary; SW offline; remover pacotes mortos; CI Playwright |
| 🟢 Melhoria | 5 | Dark mode; campos de cliente; recuperação de senha; ícones PWA; drill-down KPIs |

---

## 6. Roadmap de sprints futuras

| Fase / Sprint | Foco | Status |
|---------------|------|--------|
| **Fase 10 — Fundação multi-tenant** | Tabela `tenants`, `team_id`, provisioning, branding OKLCH | ✅ Concluída (Sessões 31–32 + 37–39) |
| **Fase 10.1 — Isolamento de dados** | `team_id` em 8 tabelas + RLS RESTRICTIVE + RPCs | ✅ Concluída (Sessão 33) |
| **Fase 10.2 — Branding dinâmico** | `TenantContext` + IndexedDB slug + OKLCH vars | ✅ Concluída (Sessão 34) |
| **Fase 10.3 — Onboarding + storage** | `admin-provision-tenant` EF + storage isolation | ✅ Concluída (Sessão 35) |
| **Fase 10.4 — Storage backfill** | Backfill 43 objetos legados + drop policies legacy | ✅ Concluída (Sessão 36) |
| **Sprint 11** | Offline-first — Background Sync + indicador de conectividade | ⏳ Pendente |
| **Sprint 12** | Notificações email/WhatsApp (Resend + Evolution API) | ⏳ Pendente |
| **Sprint 13** | PDF server-side (Edge Function) para orçamentos e relatórios | ⏳ Pendente |
| **Sprint 14** | Auditoria / LGPD | ⏳ Pendente |

### Fase 10 — Estado atual (Sessões 31–39)

- [x] Tabela `tenants` criada + Mopar inserido como primeiro tenant (s31)
- [x] `users.team_id` backfillado + FK adicionada (s31)
- [x] `get_caller_team_id()` criada (s31)
- [x] `notify_compradores` corrigida (R-02 — vazamento cross-tenant) (s31)
- [x] `handle_new_user` trigger corrigido — propaga `team_id` para novos usuários (s32)
- [x] `admin-create-user` Edge Function v4 aceita e persiste `team_id` (s32)
- [x] `team_id` em `notifications` + backfill (s32)
- [x] ADD COLUMN `team_id` em 8 tabelas de domínio + backfill (s33)
- [x] Políticas RLS RESTRICTIVE com `team_id = get_caller_team_id()` em todas as tabelas (s33)
- [x] 5 RPCs SECURITY DEFINER atualizadas com `get_caller_team_id()` check (s33)
- [x] `TenantContext` + `useTenant()` wiring em AppLayout/Login/PDFs (s34)
- [x] IndexedDB `${tenant.slug}-reports` — namespacing por tenant (s34)
- [x] `is_platform` flag + tenant NextAI provisionado (slug: `nextai`, cor: `#6366F1`) (s37)
- [x] SuperMaster `nextai@gmail.com` criado (s37)
- [x] Redirect plataforma → `/admin/tenants` (guard em `Dashboard.tsx`) (s38)
- [x] Branding dinâmico OKLCH (`src/lib/color.ts` + `applyTenantBrand`) (s38)
- [x] Bucket `tenant-assets` + 3 policies RLS (s39)
- [x] Upload de logo no form de criação de tenant (s39)
- [x] Dialog de edição de tenant (name, cor, logo — slug imutável) (s39)
- [x] Edge Function `admin-provision-tenant` com suporte a `logo_url` (s39)
- [x] Storage `service_reports_media`: paths `{teamId}/` + backfill 43 objetos legados (s35–s36)

---

*Documento gerado por varredura automatizada do repositório em 2026-04-22. Atualizado em 2026-05-13 para refletir Sessões 31–39 (Multi-Tenancy / NextAI).*
