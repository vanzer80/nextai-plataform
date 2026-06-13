# Sessão 22 — 29/04/2026 — PERF-nav-01 Fase 1: fix remount de navegação + useOfflineSync duplicado
**Commit:** `f961f3c`

### Diagnóstico completo

Investigação de lentidão na navegação entre módulos. Cinco fontes verificadas:

1. **`UserProfileDropdown` e `NotificationsDropdown` dentro do corpo de `AppLayout`** → React unmount+remount completo a cada navegação (cada `location` change re-cria o tipo do componente). ← **Causa confirmada**
2. **`useOfflineSync()` instanciado duas vezes** (AppLayout persiste, ReportsList monta/desmonta) → segundo `processQueue()`, segundo par de listeners `online/offline`, race condition entre `syncInProgress` refs independentes. ← **Causa confirmada**
3. **Bundle monolítico sem lazy loading** — adiado para Fase 2. ← **Causa confirmada**
4. **Supabase free tier hibernation** — 2–5 s na primeira query após inatividade — não corrigível no frontend.
5. **DB e índices** — sem problema: EXPLAIN custo 14.44, 0 service_reports, 14 reimbursements, 7 users, todos os índices presentes (verificado via MCP execute_sql).

### Fix A — `src/components/layout/AppLayout.tsx`

`UserProfileDropdown` e `NotificationsDropdown` movidos de dentro do corpo da função para nível de módulo (module-level named functions) com props explícitas. React reconhece o mesmo tipo de componente entre re-renders → reconciliação normal, sem remount.

`AppLayout` exporta `AppLayoutOutletContext { isOnline, isSyncing, pendingCount }` e passa via `<Outlet context={outletCtx}>`.

### Fix B — `src/pages/reports/ReportsList.tsx`

`useOfflineSync()` removido. `isOnline`, `isSyncing`, `pendingCount` agora consumidos via `useOutletContext<AppLayoutOutletContext>()` — estado já computado pelo AppLayout, sem segunda instância do hook.

### Validação
- TypeScript: EXIT:0 ✅
- NAV_LINKS preservados sem alteração de roles ✅
- Nenhuma mudança em auth, permissões, banco, RLS, offline queue ✅
