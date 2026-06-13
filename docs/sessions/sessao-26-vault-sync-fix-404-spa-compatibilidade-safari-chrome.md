# Sessão 26 — 02/05/2026 — Vault Sync + Fix 404 SPA + Compatibilidade Safari/Chrome
**Commits:** `d7725ed` (vault sync hook), `2186c2c` (gitignore marker), `7f35d62` (vercel.json), `a09c558` (SW + uuid polyfill)
**Deploy:** ✅ https://portal-mopar.vercel.app/ — funcionando em todos os browsers

### O que foi executado

**1. Vault sync automation**

Problema: commits eram feitos sem atualizar o Obsidian (ex: `69911de` estava faltando no histórico).

Solução implementada:
- `.claude/settings.json`: hook `Stop` que executa `check-vault-sync.ps1` após cada resposta do Claude
- `.claude/scripts/check-vault-sync.ps1`: compara HEAD com `.claude/last-vault-sync`; exibe aviso prominente quando vault está desatualizado
- `.claude/last-vault-sync`: arquivo local (gitignored) com hash do último commit documentado
- `fechar-sessao` skill atualizado: Passo 4 escreve HEAD em `last-vault-sync` após o push

Fluxo: commit/push → hook detecta HEAD ≠ last-vault-sync → aviso "execute /fechar-sessao" → ao rodar /fechar-sessao → vault atualizado + last-vault-sync = HEAD → hook silencioso.

**2. Fix 404 no refresh da SPA — `7f35d62`**

Problema: recarregar ou acessar diretamente qualquer rota (ex: `/admin/checklist-templates`) retornava 404.
Causa: Vercel trata SPA como servidor de arquivos estáticos — sem regra de rewrite, qualquer path diferente de `/` retorna 404.
Correção: criado `vercel.json` com `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]`.
Impacto: resolve 404 em TODAS as rotas ao recarregar ou acessar via link direto.

**3. Tela branca em Safari e Chrome — `a09c558`**

Duas causas raiz identificadas e corrigidas:

| # | Causa | Browsers afetados | Fix |
|---|-------|-------------------|-----|
| 1 | Service Worker `cache-first` para `index.html` → após deploy, SW servia HTML antigo com chunks renomeados → JS 404 → tela branca | Chrome, Safari, qualquer browser com SW em cache | `sw.js` reescrito: `index.html`/`manifest.json` → network-first; JS/CSS hashed → cache-first; cache bumpeado para `v2` |
| 2 | `crypto.randomUUID()` não existe em Safari < 15.4 → `TypeError` → React crasha | Safari < mar/2022, iOS antigo | `src/lib/uuid.ts`: `generateUUID()` usa nativa quando disponível, fallback via `crypto.getRandomValues()` |

Arquivos com `crypto.randomUUID()` migrados para `generateUUID()`:
`useReportDraft.ts`, `TemplateEditor.tsx`, `Step6Evidence.tsx`, `checklistService.ts`, `offlineQueue.ts`, `reportService.ts`

### Pendências para próxima sessão
- Sprint 13: Notificações externas (Resend email + Evolution API WhatsApp)
- Sprint 14: PDF server-side via Edge Function
- Sprint 15: Auditoria / LGPD
- Considerar upgrade Supabase Pro ($25/mês) para eliminar hibernação
