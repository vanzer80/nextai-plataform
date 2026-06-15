# Sessão 75 — 15/06/2026 — Etapa 1 PWA: offline-first de verdade

## Commits Realizados
- `30feb67` feat(pwa): compressão JPEG de fotos de evidência (item 1)
- `ce39f2d` feat(pwa): timeout + allSettled + re-enfileiramento de uploads (item 2)
- `9c66c0d` feat(pwa): write-through cache + last_full_sync (item 3)
- `fccf496` feat(pwa): fila local de "marcar como lida" resiliente offline (item 4)
- `c5bd626` feat(pwa): precache de chunks de boot no SW via manifest custom (item 5)
- `a ser gerado` docs: registro da Sessão 75 + hash no HISTORY.md

## Contexto

Segunda etapa do roadmap mobile/PWA (após a Etapa 0 — destravamento, Sessão 74).
Objetivo: offline-first real para o técnico de campo, sem regredir a web do gestor.
Decisões de arquitetura aprovadas: precache via **manifest custom** (não Workbox);
upload parcial = **submeter OS + re-enfileirar a foto** (não bloquear).

## O que foi implementado (5 itens, commits atômicos)

### Item 1 — Compressão JPEG (`30feb67`)
- `src/lib/imageCompression.ts`: `compressImageFile` best-effort (canvas, ~1600px, q0.72,
  EXIF via `createImageBitmap`, nunca piora o tamanho, fallback = File original; ignora PDF/GIF).
- `Step6Evidence`: comprime antes de virar `EvidenceFile` → `pendingBlobs`/upload leves.
- Teste: `computeTargetSize` (puro) + guards + best-effort (7 testes).

### Item 2 — Timeout + allSettled + re-enfileiramento (`ce39f2d`)
- `withTimeout` (15s, reusado de `src/lib/withTimeout.ts`) em cada upload de mídia.
- `uploadAttachments` com `Promise.allSettled`: a OS é criada com as fotos que subiram.
- Fotos falhas → fila `uploadAttachment` (Blob no payload, structured clone do IndexedDB).
- `uploadAndLinkAttachment` (handler da fila): upload (upsert) + insert idempotente em
  `report_attachments` (`onConflict:id`, `uploaded_by = auth.uid()` p/ a RLS).
- Teste: caminho de re-enfileiramento (sucesso / falha de upload / falha de RLS) — 3 testes.

### Item 3 — Write-through cache + last_full_sync (`9c66c0d`)
- `useReports`: caminho de sucesso popula `cachedReports` (write-through) → a lista vista
  online fica disponível offline (o fallback + filtros client-side já existiam).
- `last_full_sync` por-tenant (localStorage com key via `dbName`, sem bump de schema).
- Fallback offline mostra "sincronizado há X" (date-fns ptBR). Teste round-trip (2 testes).
- **Débito conhecido:** `cachedReports` cresce sem TTL/limite — limpeza futura.

### Item 4 — Fila local de notificações (`fccf496`)
- `notificationService`: `markNotificationReadResilient` (enfileira em falha, nunca lança) +
  `flushNotificationReadQueue` (reenvia pendentes; remove sucessos, mantém falhas).
- `AppLayout`: `markAsRead` otimista (UI atualiza já) + flush no mount e no evento `online`.
- Teste: 6 (sucesso/erro/exceção/dedupe + flush parcial + no-op).

### Item 5 — Precache de chunks no SW (`c5bd626`)
- `scripts/generate-precache-manifest.mjs` (pós-build): extrai do `dist/index.html` os assets
  de boot (entry + CSS + vendors) → `dist/precache-manifest.json` (9 assets).
- `build` encadeia o gerador. `sw.js` install lê o manifest e precacheia (best-effort,
  `allSettled`); ausente em dev/offline não derruba o SW. `CACHE_NAME` v8 → **v9**.
- **Limitação conhecida:** o precache é buscado no install do SW → atrela ao bump de
  `CACHE_NAME`. Deploys entre bumps são pegos por cache-first online (não quebra; só não
  pré-cacheia os chunks novos até o próximo bump). Aceitável no MVP; Workbox resolveria com
  revision hashes (decisão foi manter custom).

## Gates (Definition of Done) — por item e consolidado
- `npx tsc --noEmit` → EXIT 0 (em todos os itens)
- `npx vitest run` → **187/187** (19 files): 169 base + 7+3+2+6 dos itens 1–4
- `npm run build` → chunk principal **45.95 kB gzip** (≤ 100) + `precache-manifest.json` gerado
- `security-scan` (pre-commit, por commit) → 0 BLOCK em todos
- Browser (preview dev): SW **v9** ativo, core + ícones precacheados, precache de chunks com
  skip correto em dev (sem manifest), **não-regressão web** (app boota, login renderiza, 0 erros).

## Validação pendente (pós-deploy)
- Precache de chunks em produção (DevTools → Application → Cache Storage `nextai-v9`).
- Write-through + leitura offline E2E (requer login de técnico com OS + simular offline).

## Pendências / próximos passos
- **Pós-commit:** preencher o hash desta sessão no `HISTORY.md`.
- **Etapa 2 (Hardening):** Sentry, Lighthouse PWA no CI, version handshake no SW, badge
  online/offline no AppLayout. (Não iniciar sem aprovação.)
- Débitos anotados: TTL do `cachedReports`; precache atrelado ao `CACHE_NAME`.
