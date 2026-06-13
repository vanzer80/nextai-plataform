# NextAI — Roadmap B2B Enterprise 2026
*Status: **Sprints A–F concluídas ✅** | Última atualização: 2026-06-04 (Sessão 68)*

---

## Contexto Estratégico

O NextAI Portal possui os módulos core funcionando (OS, Reembolsos, Compras, Orçamentos, Equipamentos). O gap analysis comparativo com **ServiceNow, SAP Concur, Coupa, Salesforce CPQ, Jira Service Management e Limble CMMS** identificou 15 gaps distribuídos em 3 tiers de impacto comercial.

Este roadmap cobre os **6 sprints de implementação** necessários para atingir paridade competitiva com esses líderes de mercado no segmento de field service, manutenção e procurement B2B.

---

## Mapa de Sprints

| Sprint | Foco | Features | Status |
|--------|------|----------|--------|
| [[Sprint A — SLA + Fornecedores + Inventário]] | Fundação operacional | SLA, Supplier DB, Parts Inventory | ✅ `fba1437` |
| [[Sprint B — PO + Expense Reports + QR Code]] | Core B2B | Purchase Order, Batch Expenses, QR→OS | ✅ `fb55035` |
| [[Sprint C — Portal Cliente + CSAT + Agenda]] | Client-facing | Customer Portal, CSAT, Dispatch Calendar | ✅ `0b6fdeb` |
| [[Sprint D — CPQ: Assinatura + Versionamento]] | Quote-to-Cash | E-Signature, Quote Versioning | ✅ `730d20a` |
| [[Sprint E — OCR + Budget + Knowledge Base + Lifecycle]] | Maturidade | OCR, Budget Control, KB, Asset Cost | ✅ `8a7ddad` |
| Sprint F — RH + DP + CP Enterprise | HCM & Financeiro | Colaboradores CLT, Folha INSS/IRRF, Ponto, Férias, Contas a Pagar | ✅ `9bbb649` 2026-05-26 |

**Todas as 6 sprints concluídas — 2026-05-26**

---

## Gap → Sprint Matrix

| Gap | Tier | Sprint | Referência de mercado |
|-----|------|--------|-----------------------|
| SLA tracking + escalonamento | 1 | A | ServiceNow / Jira SM |
| Gestão de fornecedores | 2 | A | Coupa |
| Inventário de peças | 2 | A | Limble CMMS |
| Ordem de Compra (PO) formal | 1 | B | Coupa |
| Relatório de despesas (batch) | 1 | B | SAP Concur |
| QR code → abrir OS | 2 | B | Limble CMMS |
| Agenda / Dispatch calendar | 2 | C | ServiceNow FSM |
| Portal do cliente | 2 | C | ServiceNow / Jira SM |
| CSAT pós-OS | 3 | C | Jira SM |
| Assinatura eletrônica no orçamento | 1 | D | Salesforce CPQ |
| Versionamento de orçamento | 3 | D | Salesforce CPQ |
| OCR em comprovantes | 3 | E | SAP Concur |
| Controle de orçamento por categoria | 3 | E | Coupa |
| Knowledge base / procedimentos | 3 | E | Jira SM |
| Ciclo de vida financeiro do ativo | 3 | E | Limble CMMS |
| Colaboradores CLT + Folha | 1 | F | TOTVS / SAP HCM |
| Ponto eletrônico + Férias | 2 | F | TOTVS / SAP HCM |
| Contas a Pagar multinível | 1 | F | SAP AP / Coupa |

---

## Pós-Sprint F — Entregas Sessões 62–68 (2026-05-30 a 2026-06-04)

| Sessão | Data | Entregável |
|--------|------|-----------|
| s62 | 2026-05-30 | **OS↔Orçamento SAP SD/PM** — vinculação bidirecional, auto-fill de itens, chips "• OS", 33 testes E2E, 16 correções CPQ |
| s63 | 2026-05-31 | **Landing NextAI redesign** (AI-first, AiOrb 3D, 3 rodadas) · **Logo do tenant em todos os PDFs** (OS, Orçamento, Holerite, Reembolso) |
| s64 | 2026-05-31 | **Fix race condition CPQ** (`handleSelectOS` com useRef) · seção "OS Vinculada" no PDF · fix logo (`measureImage`/`fitInBox`) |
| s65 | 2026-06-03 | **22 testes E2E** para módulos RH, DP e CP (7+7+8, todos passando — commit `78ef868`) |
| s66 | 2026-06-03 | **Cadastro Comercial de Tenants** — CNPJ, endereço, dados fiscais, perfil da empresa (migration + RPC + UI) |
| s67 | 2026-06-03 | **Onboarding 25 tours 85+ steps** — cobertura SAP-level 100% dos módulos (commit `e7889c9`) |
| s68 | 2026-06-04 | **SuperMaster edita Perfil Comercial** de qualquer tenant · 6 testes E2E Platform (commit `5aa547e`) |

---

## Estado Atual (baseline pós-Sprint F + s62–68)

### Implementado ✅

**OS / Field Service:**
- OS wizard 7 steps (offline draft, GPS, AI diagnóstico, assinatura canvas)
- Numeração automática `OS-YYYY-NNNN`, busca full-text GIN, filtros URL (deep link)
- Edição devolvida inline, reabrir rejeitada, duplicar, exportação Excel
- SLA tracking + escalonamento, manutenção preventiva
- QR Code de equipamento → abrir OS
- Baixa automática de estoque na aprovação (trigger)
- Push notifications nativas (Web Push API)
- Vinculação OS↔Orçamento (SAP SD/PM) com auto-fill

**Financeiro & Procurement:**
- Reembolsos: AI OCR, SHA-256 antifraude, CNPJ validation, status "Pago" (`paid_at`/`paid_by`), anomalia de valor
- Expense Reports batch por período/técnico
- Compras + Purchase Orders (PO formal, upload NF)
- Orçamentos/CPQ: assinatura eletrônica, versionamento, vinculação OS
- Contas a Pagar (CP) com workflow multinível submit/approve/pay/reject

**HR & Ops:**
- RH: CRUD colaboradores CLT, departamentos, certificações, eventos timeline
- DP: folha INSS 2024 progressivo + IRRF + FGTS + VT, holerite PDF, ponto eletrônico, férias
- Agenda/Dispatch calendar
- Base de Conhecimento com FTS português
- Asset Lifecycle com depreciação linear

**Plataforma & UX:**
- Multi-tenant RLS isolation (team_id, 25+ tabelas)
- OKLCH dynamic branding por tenant
- SuperMaster: 5 páginas Platform, Intelligence cross-tenant 15 abas, Cadastro Comercial
- Portal do Cliente (read-only OS), CSAT pós-OS público
- Dashboard 15 widgets personalizáveis (preferências no banco)
- Onboarding 25 tours 85+ steps (driver.js) — cobertura 100% dos módulos
- PWA (manifest, SW `nextai-v7`, IndexedDB offline)
- 117 testes Vitest (8 arquivos), 23 specs Playwright E2E (~166 testes)
- Logo do tenant em todos os documentos PDF (OS, Orçamento, Holerite, Reembolso)

---

## Próximo Roadmap (pós-paridade B2B)

| Feature | Prioridade | Esforço |
|---------|-----------|---------|
| Notificações email (Resend) + WhatsApp (Evolution API) | 🔴 Alta | 1–2 dias |
| IA de Escrita de Relatórios (texto → linguagem técnica) | 🔴 Alta | 1–2 dias |
| Background Sync offline (Service Worker) | 🟡 Média | 1 dia |
| PWA icons PNG 192×512 | 🟢 Baixa | horas |
| RAG Analytics (pgvector + linguagem natural) | 🟡 Estratégico | 5–8 dias |
| GPS Dispatching Map em tempo real | 🟡 Estratégico | 5–8 dias |
| ERP Integration (TOTVS / SAP / Omie) via webhook | 🟡 Estratégico | 3–5 dias/ERP |
| Fase 6 SaaS: subdomain routing + billing (Stripe) | 🟡 Estratégico | 2–3 semanas |

---

## Princípios de Engenharia (não negociáveis)

1. **Migrations são contratos** — nome descritivo, idempotente (`IF NOT EXISTS`), não quebra dados existentes
2. **RLS em toda tabela nova** — policy `team_isolation` RESTRICTIVE no mesmo migration da tabela
3. **SECURITY INVOKER por padrão** — SECURITY DEFINER apenas quando necessário (cross-tenant); sempre seguido de `REVOKE FROM PUBLIC; REVOKE FROM anon; GRANT TO authenticated`
4. **TypeScript strict** — `npx tsc --noEmit` deve retornar EXIT:0 após cada feature
5. **Playwright coverage** — ao menos 1 spec de caminho feliz por feature nova
6. **Bundle discipline** — páginas novas entram como `lazy()` em App.tsx; chunk inicial ≤ 100 kB gzip
7. **Sem breaking changes** — novas colunas nullable ou com DEFAULT; enum values adicionados com `ADD VALUE IF NOT EXISTS`
8. **ADR para decisões arquiteturais** — documentado em `docs/adr/`
9. **get_advisors após cada migration** — zero novos alertas de segurança introduzidos
10. **INSERTs: injetar `team_id` manualmente** — RLS não injeta em writes; apenas filtra reads

---

## Arquivos Relacionados

- [[00 - Visão Geral do Projeto]] — visão do produto e stack completa
- [[09 - Visão de Produto e Roadmap NextIA]] — gaps atuais e norte estratégico
- [[Roadmap Técnico]] — log técnico detalhado por sessão
- [[06 - Histórico de Sessões]] — log de execução por sessão (até s65)
- [[Sprints/Sprint A — SLA + Fornecedores + Inventário]]
- [[Sprints/Sprint B — PO + Expense Reports + QR Code]]
- [[Sprints/Sprint C — Portal Cliente + CSAT + Agenda]]
- [[Sprints/Sprint D — CPQ Assinatura + Versionamento]]
- [[Sprints/Sprint E — OCR + Budget + Knowledge Base + Lifecycle]]
