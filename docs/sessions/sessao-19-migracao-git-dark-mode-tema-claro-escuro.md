# Sessão 19 — 26/04/2026 — Migração Git + Dark Mode (Tema Claro/Escuro)

### O que foi executado

**Migração do repositório git**
- Projeto movido de `C:\Users\vanze\OneDrive\Área de Trabalho\portal-mopar` para `C:\dev\portal-mopar` (fora do OneDrive — OneDrive desumidicava os objetos `.git` imediatamente)
- Repositório GitHub criado como privado: `https://github.com/vanzer80/portal-mopar`
- `git init && git add . && git commit` + `git remote add origin` + `git push -u origin master`
- `npm install` executado para sincronizar `node_modules` com o `package.json` atualizado (remove `@google/genai`)
- Git agora disponível — bloqueador P-03 resolvido

**Análise e correção do tema escuro (dark mode)**

O usuário implementou o sistema de tema (claro/escuro/sistema) usando `next-themes` + CSS variables `oklch` em `index.css` com classes `.dark`. A análise identificou que 14 componentes tinham cores hardcoded (`bg-white`, `border-slate-*`, `text-slate-*`, `focus-visible:ring-blue-600`) que não respondiam ao tema.

**Arquivos corrigidos (14 componentes):**

| Arquivo | Principais mudanças |
|---|---|
| `OrcamentoCard.tsx` | `bg-white` → `bg-card`, `border-slate-200` → `border-border`, hover azul → `hover:border-primary/50` |
| `ReportFilters.tsx` | Container, labels, inputs convertidos |
| `ChecklistRenderer.tsx` | Cards de item, inputs, zona de foto |
| `ReimbursementTable.tsx` | Wrapper, header, linha selecionada, avatar, colunas de texto |
| `SignatureCanvas.tsx` | Background e placeholder do canvas |
| `ApprovalPanel.tsx` | Textarea de comentário |
| `ReimbursementsList.tsx` | Barra de filtros |
| `MaterialsList.tsx` | Tabs e campo de busca |
| `PurchaseDetailModal.tsx` | Header, InfoRow, painéis de detalhe e ação, formulários |
| `ReimbursementDetailModal.tsx` | Modal inteiro: cards de info, timeline, rodapé, textareas |
| `NewMaterialRequest.tsx` | Formulário completo: cards, inputs, upload, botões |
| `NewReimbursement.tsx` | Formulário completo: cards, inputs, upload, botões |
| `ChecklistTemplates.tsx` | Header, filtro, cards de template |
| `TemplateEditor.tsx` | Header, cards, lista de itens, botões |

**Padrão de substituição aplicado:**

| Classe antiga | Classe nova |
|---|---|
| `bg-white` (cards/modais) | `bg-card` |
| `bg-white` (inputs) | `bg-background` |
| `bg-slate-50` | `bg-muted/40` |
| `border-slate-200` | `border-border` |
| `border-slate-300` | `border-input` |
| `text-slate-900` / `text-slate-800` | `text-foreground` |
| `text-slate-600` / `text-slate-500` / `text-slate-400` | `text-muted-foreground` |
| `hover:bg-slate-50` | `hover:bg-muted/50` |
| `hover:bg-slate-200` | `hover:bg-muted` |
| `focus-visible:ring-blue-600` | `focus-visible:ring-ring` |
| `bg-blue-600 hover:bg-blue-700` (botões primários) | `bg-primary hover:bg-primary/90` |
| `text-blue-600` (loaders/ícones neutros) | `text-primary` |
| `hover:border-blue-300` | `hover:border-primary/50` |

**Infraestrutura do tema:**
- `next-themes` com `attribute="class"`, `defaultTheme="system"`, `storageKey="portal-theme"`
- Flash prevention: script inline em `index.html` aplica `.dark` antes do React carregar
- CSS variables `oklch` definidas em `index.css` para `.dark` — todas as variáveis `--background`, `--foreground`, `--card`, `--muted`, `--border`, `--input`, `--ring`, `--primary`
- Componente `src/components/theme/` criado pelo usuário

### Verificação

- `tsc --noEmit` → sem erros após todas as correções
- Commit `b58438e` — 14 files changed, 246 insertions, 246 deletions
- Push para `origin/master` ✓

### Problemas / Armadilhas

- **OneDrive + git**: OneDrive desumidicava os objetos `.git` imediatamente. Solução: manter projeto em `C:\dev\` (fora do OneDrive)
- **robocopy exit code 1**: significa "arquivos copiados com sucesso" (não erro) — códigos 0-7 são sucesso
- **PowerShell heredoc**: usar `@'...'@` (não `$(cat <<'EOF')` que é sintaxe bash)
- **Dark mode**: `bg-white` em formulários deve virar `bg-background` (não `bg-card`) para distinção visual correta

### Próximos passos

- **P-03**: Redesign da fila offline — git agora disponível em `C:\dev\portal-mopar`, pode ser executado em branch `feature/offline-queue-redesign`
- **Sprint 12**: Notificações externas (Resend email + Evolution API WhatsApp)
