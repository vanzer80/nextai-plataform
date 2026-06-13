# Sessão 27 — 02/05/2026 — Modo Claro Padrão + Sheet de Perfil + Bottom Nav Personalizável
**Commits:** `23fe5c2` (light mode padrão), `75a8d15` (auth loop fix + Sheet perfil), `53d7b3a` (bottom nav personalizável + remove quick actions)
**Deploy:** ✅ https://portal-mopar.vercel.app/

### O que foi executado

**1. Modo claro como padrão — `23fe5c2`**

Problema: app abria no tema do sistema (escuro à noite), confundindo usuários.
Correção:
- `ThemeProvider.tsx`: `defaultTheme="system"` → `defaultTheme="light"`
- `index.html`: script de flash-prevention atualizado — fallback de `'system'` → `'light'` quando não há preferência salva
Comportamento: app sempre abre em modo claro; só muda se o usuário explicitamente escolher Escuro ou Sistema.

**2. Fix tela branca ao clicar no nome do usuário (Base UI error #31) — `75a8d15`**

Causa raiz: Supabase disparava evento `SIGNED_IN` múltiplas vezes (tab-focus, storage events), causando chamadas concorrentes a `fetchUserData`. O `DropdownMenu` (Base UI) tentava abrir um portal durante re-render causado por `setState` concorrente → error #31 → tela branca.

Fixes em `AuthContext.tsx`:
- `isFetchingRef`: mutex que bloqueia chamadas concorrentes a `fetchUserData`
- `fetchedUserIdRef`: guarda o `user.id` já carregado; re-fires de `SIGNED_IN` para o mesmo usuário são ignorados
- Reset de `fetchedUserIdRef` no sign-out

Fix de UI em `AppLayout.tsx`:
- `UserProfileDropdown` migrado de `DropdownMenu` (Base UI / portal) para `Sheet` (side="right")
- Sheet "Minha Conta" com: avatar grande, nome, role badge, email, seletor de tema (3 botões), botão Sair

**3. Bottom Nav personalizável + remoção de Quick Actions — `53d7b3a`**

- `Dashboard.tsx`: bloco Quick Actions (`{!isManager && (...)}`) removido; `PlusCircle` removido dos imports
- `AppLayout.tsx`:
  - `ALL_BOTTOM_NAV_OPTIONS` (8 opções: Início, Relatórios, Orçamentos, Reembolsos, Compras, Clientes, Checklists, Admin)
  - Estado `activeBottomLinks` com persistência em `localStorage` por `user.id` (`portal-bnav-{uid}`)
  - Bottom nav mobile renderiza dinamicamente a partir das preferências salvas (padrão: Início, Relatórios, Compras)
  - Seção "Rodapé Rápido" no Sheet Minha Conta: toggles com máx 3 / mín 1 atalhos, só mostra opções autorizadas pela role
  - Sheet content com `overflow-y-auto`; Sair da Conta como footer fixo

### Pendências para próxima sessão
- Sprint 13: Notificações externas (Resend email + Evolution API WhatsApp)
- Sprint 14: PDF server-side via Edge Function
- Sprint 15: Auditoria / LGPD
