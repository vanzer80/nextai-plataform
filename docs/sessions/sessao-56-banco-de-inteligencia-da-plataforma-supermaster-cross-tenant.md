# Sessão 56 — 24/05/2026 — Banco de Inteligência da Plataforma (SuperMaster cross-tenant)

**Commit:** `21a21d0` | Push: `origin/master` atualizado | Deploy: Vercel BUILDING → prod

### Contexto

Implementação do **Banco de Inteligência NextAI**: acesso de leitura cross-tenant para o SuperMaster (`nextai@gmail.com`) aos dados operacionais de todos os tenants (OS aprovadas + base de conhecimento), com o objetivo de construir um corpus de treino para a IA do NextAI. Anteriormente o SuperMaster via apenas lista de tenants e usuários — os dados operacionais estavam bloqueados pelas policies RESTRICTIVE `team_isolation`.

### Decisões de design

| Decisão | Escolha |
|---------|---------|
| Escopo de dados | Foco em IA técnica: `service_reports` (textos de diagnóstico) + `kb_articles` |
| Privacidade | **Anonimizado**: sem PII (sem técnico/cliente, sem `internal_notes`, sem GPS, sem assinatura) |
| Função da tela | Análise + exportação (métricas + JSON/CSV download) |
| Governança | Auditoria completa via `platform_access_log` |

### DB aplicado

| Migration | Descrição |
|-----------|-----------|
| `platform_intelligence_audit` | Tabela `platform_access_log` + RLS (SELECT só SuperMaster) + índice |
| `platform_intelligence_rpcs` | 4 RPCs SECURITY DEFINER: `platform_get_intelligence_stats` (VOLATILE, registra visita), `platform_get_diagnostic_corpus` (STABLE, paginável), `platform_get_kb_corpus` (STABLE, paginável), `platform_log_export` (VOLATILE, registra export) |

**Padrão de segurança:** todas as RPCs abrem com `IF NOT is_platform_master() THEN RAISE EXCEPTION 'Acesso negado'`. O Supabase re-concede EXECUTE a `anon`/`authenticated` por padrão após migrations (comportamento conhecido), mas o guard interno impede qualquer acesso não autorizado (`auth.uid()=null` para anon → is_platform_master() retorna false → exceção).

### Arquivos criados/modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/types/platformIntelligence.ts` | Novo | Tipos `PlatformIntelligenceStats`, `PlatformDiagnosticRow`, `PlatformKbRow`, `CorpusFilters` |
| `src/services/platformIntelligenceService.ts` | Novo | 8 funções: stats, corpus diagnóstico/KB, paginação completa para export, logExport, helpers JSON/CSV/download |
| `src/pages/platform/PlatformIntelligence.tsx` | Novo | Página lazy `/platform/intelligence`: cards de métricas, tabs, filtros tenant/tipo, tabela paginada, export JSON+CSV com toast |
| `src/components/layout/PlatformLayout.tsx` | Editado | Link "Inteligência" (ícone Brain) adicionado ao `PLATFORM_NAV` entre Usuários e Configurações |
| `src/App.tsx` | Editado | Lazy import + rota `/platform/intelligence` dentro do bloco `PlatformGuard` |

### Bundle

- `PlatformIntelligence` → chunk lazy **4.38 kB gzip** (não infla o inicial)
- Chunk principal → **99.74 kB gzip** (< 100 kB ✅)
- `tsc --noEmit` → EXIT:0 ✅
