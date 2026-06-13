# Sessão 25 — 02/05/2026 — Auditoria de Performance + Deploy em Produção + Fix Modal Reembolso
**Commits:** `6daf345` (fixes de performance), `416aee8` (retrigger deploy), `69911de` (fix modal reembolso mobile/desktop)
**Deploy:** ✅ https://portal-mopar.vercel.app/ — funcionando

### O que foi executado

Auditoria completa de performance no frontend e backend após falha na apresentação ao cliente (login lento + páginas lentas + navegação travando). Todos os 7 fixes aplicados e deploy em produção concluído.

**7 causas raiz identificadas e corrigidas:**

| # | Severidade | Causa | Fix aplicado |
|---|-----------|-------|---------|
| 1 | 🔴 | Supabase free tier hibernado + timeout 30s no `withTimeout` | Timeout → 8s (`AuthContext.tsx:148`) |
| 2 | 🔴 | `Dashboard` + 9 rotas importadas estaticamente (Recharts no bundle inicial) | Todas 15 rotas → `React.lazy()` (`App.tsx`) |
| 3 | 🔴 | `useOfflineSync` dispara `processQueue()` na montagem — 7 requests simultâneos | Debounce 5s no sync inicial (`useOfflineSync.ts`) |
| 4 | 🔴 | `motion` (~50kb) instalado, nunca importado | `npm remove motion` |
| 5 | 🔴 | Sem `manualChunks` no `vite.config.ts` | 6 chunks vendor configurados (`vite.config.ts`) |
| 6 | 🟠 | Rodando `npm run dev` na apresentação | Deploy Vercel — CDN global com gzip |
| 7 | 🟡 | Queries do Dashboard sem `.limit()` | `.limit(500)` em `barQry` e `pieQry` |

**Resultado de bundle antes vs. depois:**
- Antes: 1 chunk monolítico ~516 kB gzip
- Depois: bundle inicial ~84 kB gzip (−84%), restante carregado on-demand via lazy

**Deploy Vercel — causa raiz do problema inicial:**
- Variável `VITE_SUPABASE_URL` salva como `url` (nome errado) → Vite não injeta no bundle → app quebrado
- Corrigido via Vercel REST API: deletada var `url`, criada `VITE_SUPABASE_URL` para todos os ambientes
- Supabase Auth configurado: Site URL + Redirect URL para `https://portal-mopar.vercel.app/**`
- Deploy `dpl_47eziscHD2qh2ivSPjmZ9EgVUg44` → bundle `index-ANeatdLP.js` confirmado com URL do Supabase embutida

### Fix pós-deploy — `69911de` (12:48)

**`src/pages/reimbursements/components/ReimbursementDetailModal.tsx`** — reorganização do layout para mobile e desktop:
- Seção "Informações Auxiliares" trocada de `grid-cols-2` fixo para `divide-y` — Colaborador, Tipo de Manutenção e Cliente passam a ter linha completa (sem truncamento no mobile)
- Padding reduzido `p-6` → `px-5 py-4` para mais espaço vertical
- Seção Pagamento unificada com mesmo padrão `divide-y`
- Altura da foto no mobile aumentada `h-44` → `h-52`
- Formatação de data com locale `pt-BR`

### Pendências para próxima sessão
- Considerar upgrade Supabase Pro ($25/mês) para eliminar hibernação na primeira conexão
- Sprint 13: Notificações externas (Resend email + Evolution API WhatsApp)
- Sprint 14: PDF server-side via Edge Function
- Sprint 15: Auditoria / LGPD
