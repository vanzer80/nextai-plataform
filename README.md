# Portal Mopar

## Sobre o Projeto

O **Portal Mopar** é um sistema operacional web para equipes de manutenção, campo e backoffice da Mopar Engenharia — e a base da plataforma SaaS white-label **NextAI**, que permite provisionar múltiplas empresas com branding, dados e usuários completamente isolados por tenant.

O sistema centraliza processos que antes dependiam de WhatsApp, planilhas e PDF manual: relatórios técnicos com checklist e assinatura digital, reembolsos com extração IA de comprovantes, solicitações de compra, orçamentos, dashboard de KPIs em tempo real e notificações via Supabase Realtime. O app é instalável como PWA com suporte a operação offline parcial via IndexedDB.

**Perfis de acesso (RBAC):** Tecnico · Supervisor · Gestor · Comprador · Financeiro · Admin · Master · Administrativo

---

## Stack Tecnológico

### Frontend

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
| Notificações toast | Sonner | 2.0 |
| Fonte | Geist Variable (@fontsource-variable) | 5.2 |
| Temas | next-themes | 0.4 |

### Backend (Supabase)

| Serviço | Uso |
|---------|-----|
| PostgreSQL | Banco principal (18+ tabelas, enums, índices, triggers) |
| Supabase Auth | JWT, sessão, refresh token |
| Row Level Security | Isolamento por `auth.uid()` + `role` + `team_id` |
| Realtime | `postgres_changes` em 6+ tabelas |
| Storage | `service_reports_media` (fotos, assinaturas) · `tenant-assets` (logos de tenants) |
| Edge Functions | `ai-proxy` (chamadas IA) · `admin-provision-tenant` (onboarding de tenants) |
| RPCs | `submit_report`, `process_report_action`, `get_caller_team_id()`, entre outras |

### IA e Integrações

| Provedor | Uso | Fallback |
|---------|-----|---------|
| Google Gemini (key 1) | Extração primária de imagens/voz | → Gemini key 2 |
| Google Gemini (key 2) | Fallback de quota | → OpenAI |
| OpenAI GPT | Fallback final | — |

Todas as chamadas IA passam pela Edge Function `ai-proxy` — nenhuma chave exposta no bundle JS.

### PDF, Exportação e Offline

| Biblioteca | Uso |
|-----------|-----|
| jsPDF 4.2 + jspdf-autotable 5.0 | PDF de reembolsos e orçamentos (client-side) |
| XLSX 0.18 | Exportação Excel de reembolsos e materiais |
| idb 8.0 | IndexedDB — drafts de relatórios offline (`report-drafts-db`) |
| Service Worker (`sw.js`) | Cache estático + network-first para chamadas Supabase |

---

## Módulos do Sistema

- **Dashboard** — KPIs em tempo real por perfil (relatórios pendentes, reembolsos, produtividade semanal, ticket médio, taxa de aprovação), bar chart e pie chart via Recharts, ações rápidas para técnicos.
- **Relatórios Técnicos** — Wizard de 7 etapas com checklist dinâmico, geolocalização GPS, upload de fotos para Storage, assinatura digital em canvas HTML5, draft autosave no IndexedDB e submissão atômica via RPC `submit_report`.
- **Reembolsos** — Criação em 2 etapas (foto do comprovante → IA extrai valor/Pix/categoria), fluxo de aprovação/rejeição/revisão, aprovação em lote, exportação PDF e Excel, histórico de auditoria em `reimbursement_history`.
- **Compras (Materiais)** — Solicitação com extração IA de foto do produto, ciclo Pendente → Em Análise → Comprado → Entregue, processamento e resposta pelo Comprador/Gestor.
- **Orçamentos** — CRUD de itens dinâmicos via `useFieldArray`, fluxo rascunho → enviado → aprovado/rejeitado, geração de PDF profissional client-side com jsPDF.
- **Clientes** — CRUD com cache em memória (`useClients`) para evitar N+1 queries nos seletores de outros módulos.
- **Checklist Templates** — CRUD de templates com editor de itens (texto livre, booleano, número, múltipla escolha, upload), reordenação ↑↓ e vinculação por tipo de serviço. Roles: Gestor, Admin, Master.
- **Administração de Usuários** — Listagem, criação com convite via Supabase Auth, edição de role, exclusão. Roles: Gestor, Admin, Master.
- **Gerenciamento de Tenants** — Exclusivo para SuperMaster (`is_platform = true`): tabela de tenants com thumbnails de logo, dialog de criação (slug, name, cor primária, logo) e dialog de edição. Ver seção Arquitetura Multi-Tenant abaixo.
- **Notificações Realtime** — Sino com badge animado, dropdown com histórico de 10 notificações, marcação como lida ao clicar, atualização via canal `postgres_changes`.
- **Assistente IA** — Edge Function `ai-proxy` com 5 tipos de extração (comprovante por imagem/voz, material por imagem/voz, diagnóstico técnico) e cascade de fallback server-side Gemini → OpenAI.

---

## Arquitetura Multi-Tenant / NextAI

O Portal Mopar é a base da plataforma SaaS **NextAI**: cada empresa é um tenant isolado com branding próprio e dados completamente separados dentro da mesma instância Supabase.

**Modelo de tenancy:** shared database com row-level isolation por `team_id` — isolamento garantido por políticas RLS em todas as tabelas principais.

### Tabela `tenants`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | PK |
| `slug` | TEXT UNIQUE | Identificador imutável (ex: `mopar`, `acme-elevadores`) |
| `name` | TEXT | Nome exibido na interface |
| `logo_url` | TEXT | URL pública no bucket `tenant-assets` |
| `primary_color` | TEXT | Hex da cor primária do tenant |
| `is_platform` | BOOLEAN | `true` apenas para o tenant NextAI (SuperMaster de plataforma) |

### Dois níveis de Master

| Nível | Exemplo | `is_platform` | Pode criar tenants |
|-------|---------|--------------|-------------------|
| Master de cliente | master@gmail.com / Mopar Engenharia | `false` | Não |
| SuperMaster de plataforma | nextai@gmail.com / NextAI | `true` | Sim |

### Componentes principais

- **`TenantContext`** — carrega o tenant do usuário logado via `team_id`; expõe `useTenant()`; chama `applyTenantBrand()` após hydratação e `applyTenantBrand(null)` no logout.
- **`src/lib/color.ts`** — `hexToOklch()` (matrizes OKLab oficiais de Björn Ottosson) + `applyTenantBrand()` injeta `<style id="tenant-brand">` no `<head>` com variáveis CSS `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring` para light e dark, preservando a luminância do design system (0.52 light / 0.72 dark).
- **`get_caller_team_id()`** — RPC `STABLE SECURITY DEFINER` usada como helper em todas as políticas RLS de isolamento; retorna `team_id` do usuário autenticado.
- **Bucket `tenant-assets`** — público, limite 2 MB, tipos PNG/JPEG/WebP; 3 policies: SELECT aberto, INSERT/UPDATE restritos a Master com `is_platform = true`.
- **Edge Function `admin-provision-tenant`** — recebe `tenant{slug, name, primary_color, logo_url?}` + `master{email, password, full_name}`; cria tenant e usuário Master em transação única server-side.
- **Guard de plataforma** — em `Dashboard.tsx`: `if (tenant?.isPlatform) return <Navigate to="/admin/tenants" replace />` — SuperMaster nunca vê o dashboard operacional vazio.

---

## Configuração do Ambiente Local

### 1. Instalação das Dependências

Abra o terminal na raiz do projeto e execute:

```bash
npm install
```

### 2. Configurando o Backend (Banco e Auth)

Este projeto usa variáveis de ambiente para esconder as strings vitais de conexão do Supabase do client-side usando Vite config.
Crie um arquivo **`.env.local`** na raiz do projeto (mesmo nível do `package.json`) com as chaves do painel **Project Settings > API** do seu Supabase:

```env
# .env.local
VITE_SUPABASE_URL=https://SEU_PROJETO_AQUI.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...SUA_CHAVE_PUBLICA_ANON_AQUI...
```

### 3. Subindo o Servidor de Desenvolvimento

```bash
npm run dev
```

O servidor sobe na porta `http://localhost:3001`.
