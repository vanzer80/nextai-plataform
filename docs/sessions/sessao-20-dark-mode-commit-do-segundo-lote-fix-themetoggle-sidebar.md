# Sessão 20 — 26/04/2026 — Dark Mode: commit do segundo lote + fix ThemeToggle sidebar

### O que foi executado

**Commit do segundo lote de dark mode (retomada de sessão)**
- Sessão anterior foi interrompida por limite de contexto com 26 arquivos modificados não commitados
- `tsc --noEmit` → zero erros
- Commit `3a8dbdb` — 26 files, 906 insertions, 724 deletions — push para `origin/master`
- Arquivos incluídos: `index.html`, `main.tsx`, `index.css`, `ThemeProvider.tsx` (novo), `ThemeToggle.tsx` (novo), `AppLayout.tsx`, `AuthContext.tsx`, `ProtectedRoute.tsx`, `CaptureStep.tsx`, `Login.tsx`, `UserManagement.tsx`, `ClientsList.tsx`, `Dashboard.tsx`, `OrcamentosList.tsx`, `NewReport.tsx`, `ReportDetail.tsx`, `ReportsList.tsx`, Steps 1–7 do wizard de relatório

**Fix: ThemeToggle não aparecia na sidebar**
- Problema: o botão existia mas estava invisível — `bg-background` (branco) se misturava com o fundo claro da sidebar
- Diagnóstico: injetado `<span style={{background:'red'}}>TEMA</span>` ao lado do componente para confirmar renderização → elemento renderizava, apenas invisível por falta de contraste
- Correção em `AppLayout.tsx`:
  - Removido botão flutuante `fixed right-4 bottom-[84px]` que existia antes
  - `ThemeToggle compact` adicionado ao rodapé da sidebar (ao lado do sino de notificações)
  - Classe sobrescrita: `className="border-sidebar-border bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80"` — usa tokens da sidebar em vez de `bg-background`/`border-border`

### Arquitetura do tema
- `next-themes` v0.4.6 com `attribute="class"`, `defaultTheme="system"`, `storageKey="portal-theme"`
- `ThemeProvider` wrappa o `<App />` em `main.tsx`
- Flash prevention: script inline em `index.html` aplica `.dark` antes do React carregar
- `ThemeToggle`: dropdown (Claro / Escuro / Sistema); `compact=true` → ícone 36×36px; `compact=false` → botão com label "Tema"
- Desktop: `ThemeToggle compact` no rodapé da sidebar (entre avatar e sino)
- Mobile: `ThemeToggle compact` no header superior (à esquerda do sino)

### Problemas / Armadilhas

- **ThemeToggle invisível na sidebar**: `bg-background` e `border-border` são tokens do conteúdo principal, não da sidebar. Para componentes dentro da sidebar sempre usar `bg-sidebar-*` / `text-sidebar-*` / `border-sidebar-*`
- **HMR pode estar desabilitado**: `vite.config.ts` tem `hmr: process.env.DISABLE_HMR !== 'true'` — se HMR inativo, mudanças exigem restart do servidor (`npm run dev` na porta 3001)
- **Debug visual rápido**: para confirmar se um componente renderiza sem erros visíveis, injetar `<span style={{background:'red'}}>DEBUG</span>` adjacente

### Próximos passos

- **P-03**: Redesign da fila offline — branch `feature/offline-queue-redesign`
- **Sprint 12**: Notificações externas (Resend email + Evolution API WhatsApp)
