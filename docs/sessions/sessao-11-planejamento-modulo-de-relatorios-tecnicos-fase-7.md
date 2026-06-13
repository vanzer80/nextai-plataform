# Sessão 11 — 20/04/2026 — Planejamento: Módulo de Relatórios Técnicos (Fase 7)

### O que foi feito

**FASE 1 — Diagnóstico e Planejamento completo do módulo de Relatórios Técnicos.**

Nenhum código foi escrito nesta sessão — apenas arquitetura, modelagem e planejamento documentados.

### Diagnóstico do que já existia

| Recurso | Estado | Aproveitamento |
|---|---|---|
| `src/pages/reports/NewReport.tsx` | Básico, incompleto | Refatorado como orquestrador |
| `src/types/models.ts` → `ServiceReport` | Interface parcial | Expandida em `types/reports.ts` |
| `src/components/capture/CaptureStep.tsx` | Completo | Reutilizado para evidências (Step 6) |
| `src/services/aiService.ts` | Completo | Extendido com `enhanceDiagnostic()` |
| Tabela `equipments` | Existe, sem UI | Referenciada como ativo |
| Tabela `clients` + `useClients()` | Completo | Reutilizado no Step 2 |
| Supabase Realtime, notifications | Funcional | Novas tabelas adicionadas |

### Gaps mapeados

- Não havia fluxo multi-etapas (form steps / wizard)
- Não havia offline-first / IndexedDB em nenhum módulo
- Não havia assinatura digital (canvas)
- Não havia captura de geolocalização estruturada
- Não havia checklist dinâmico
- Não havia workflow de aprovação em relatórios

### Decisões de arquitetura

| Decisão | Motivação |
|---|---|
| 7 passos (wizard) em vez de formulário único | UX mobile — cada passo cabe na tela |
| IndexedDB via biblioteca `idb` | API nativa verbosa; `idb` adiciona tipagem e simplifica |
| `react-signature-canvas` para assinatura | Não reinventar canvas — biblioteca testada em mobile |
| Offline-first: fila FIFO + servidor vence conflitos | Simples e seguro; conflito raro no uso real |
| IA nunca sobrescreve sem confirmação | Evitar perda de dados do técnico |
| EXISTS() direto no RLS (sem funções auxiliares) | Lição do Bug 8 — PostgREST não executa funções em policies |

### Novos arquivos planejados

```
src/types/reports.ts
src/lib/reportIndexedDB.ts
src/services/reportService.ts
src/services/offlineQueue.ts
src/hooks/useReports.ts
src/hooks/useReportDraft.ts
src/hooks/useOfflineSync.ts
src/hooks/useGeolocation.ts
src/hooks/useChecklistTemplate.ts
src/pages/reports/ReportsList.tsx
src/pages/reports/NewReport.tsx          (refatorado)
src/pages/reports/ReportDetail.tsx
src/pages/reports/components/steps/     (Step1 a Step7)
src/pages/reports/components/AiDiagnosticAssistant.tsx
src/pages/reports/components/SignatureCanvas.tsx
src/pages/reports/components/ChecklistRenderer.tsx
src/pages/reports/components/AttachmentGrid.tsx
src/pages/reports/components/GeolocationCapture.tsx
src/pages/reports/components/SyncStatusIndicator.tsx
src/pages/reports/admin/ChecklistTemplates.tsx
src/pages/reports/admin/TemplateEditor.tsx
```

### Documentação criada/atualizada

- `10 - Módulo de Relatórios Técnicos.md` — **criado** (documento completo do módulo)
- `05 - Roadmap de Implementação.md` — Fase 7 adicionada com sprint breakdown
- `01 - Arquitetura e Banco de Dados.md` — novas tabelas, enums e estrutura de pastas
- `09 - Visão de Produto e Roadmap NextIA.md` — Fase 7 marcada como em andamento

### Próximo passo

Executar **Sprint 1** — migration SQL completa, types TypeScript e RLS policies.
