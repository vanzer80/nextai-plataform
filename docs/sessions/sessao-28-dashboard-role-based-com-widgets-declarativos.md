# Sessão 28 — 02/05/2026 — Dashboard Role-Based com Widgets Declarativos
**Commit:** `9a31c63`

### O que foi executado

**Arquitetura do Dashboard — `9a31c63`**

Dashboard monolítico (429 linhas, `isManager` único) substituído por arquitetura modular com segurança por papel.

Bugs de segurança corrigidos:
- `statsQuery` não tinha filtro por `user_id` — não-gestores viam dados agregados de todos os usuários
- `isManager` conflacionava 5 papéis distintos — Financeiro via dados de `service_reports`
- Realtime subscriptions sem `filter` — todos recebiam notificações de mudanças alheias
- AppLayout: `.includes()` no filtro de nav fazia `"administrativo".includes("admin") = true` — Administrativo via links de Admin

Arquivos criados:
- `dashboardConfig.ts` — mapa auditável `role → widget IDs[]`; Financeiro isolado (sem widgets de service_reports)
- `widgetRegistry.ts` — `TEAM_REPORTS_ROLES` / `TEAM_FINANCE_ROLES` + mapa `widgetId → QueryKey[]`
- `useDashboardData.ts` — hook central com `Promise.all`, queries condicionais por `widgetIds`, realtime com `filter` por papel
- `Dashboard.tsx` — shell declarativo ~70 linhas; `setup_pending` bloqueia antes das queries
- 7 widgets presentacionais em `widgets/`: `ReportsKpi`, `ReimbursementsKpi`, `Productivity`, `TicketMedio`, `ApprovalRate`, `ReportsBar`, `ReimbursementsPie`

Arquivos modificados:
- `AppLayout.tsx` — fix substring bug no filtro de nav (`allowedRole.includes(userRole)` → `allowedRole === userRole`)

### Pendências para próxima sessão
- Sprint 13: Notificações externas (Resend email + Evolution API WhatsApp)
- Sprint 14: PDF server-side via Edge Function
- Sprint 15: Auditoria / LGPD
