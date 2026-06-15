# Sessão 76 — 15/06/2026 — Etapa 2 PWA: Hardening

## Commits Realizados
- `1eba31a` feat(pwa): badge flutuante online/offline/sincronizando
- `6161150` feat(pwa): version handshake do Service Worker
- `00abd32` feat(pwa): observabilidade Sentry inerte e lazy
- `651151e` ci(pwa): workflow PWA & Quality — gates + Lighthouse
- `d2fdc75` docs: registro da Sessão 76 + hash no HISTORY.md

## Contexto

Terceira etapa do roadmap mobile/PWA (após Etapa 0 destravamento s74, Etapa 1 offline-first s75).
Hardening: observabilidade, CI, atualização controlada e feedback de conectividade. Invariante:
não regredir a web do gestor.

## O que foi implementado (4 itens, commits atômicos)

### Item 1 — Badge online/offline (`1eba31a`)
- `ConnectionStatus.tsx`: pílula flutuante. Some quando online e sem fila; amber offline (+N na
  fila); spinner sincronizando; contagem de pendentes. `role=status` + `aria-live=polite`.
- `AppLayout` renderiza global (usa `isOnline/isSyncing/pendingCount` do `useOfflineSync`, já existente).
  Mobile acima da bottom nav; desktop bottom-right. 5 testes RTL (todos os estados).

### Item 2 — Version handshake do SW (`6161150`)
- `sw.js`: removido `skipWaiting` automático → novo SW fica em "waiting"; listener `message`
  `SKIP_WAITING` → `self.skipWaiting()`. `CACHE_NAME` v9 → **v10**.
- `main.tsx`: `updatefound`/`statechange` (installed + controller) → toast "Atualizar" (sonner)
  → `postMessage SKIP_WAITING`; `controllerchange` → reload único (guard `refreshing`).
- **Validado E2E no browser:** v10 ficou em waiting, o toast "Nova versão disponível" apareceu,
  console sem erros. O usuário decide quando atualizar (não interrompe o trabalho em campo).

### Item 3 — Observabilidade Sentry (`00abd32`)
- `src/lib/monitoring.ts`: `initMonitoring` carrega `@sentry/browser` via dynamic import SOMENTE
  se `VITE_SENTRY_DSN` existir (consentimento/LGPD); `Sentry.init({ sendDefaultPii:false })`;
  `captureException` no-op seguro.
- **Sem DSN no build → o import vira dead-code e é tree-shaken (ZERO bytes no bundle)** —
  confirmado por grep no dist. Com DSN, o Sentry init instala handlers globais
  (window.onerror/unhandledrejection), capturando inclusive erros de render re-lançados.
- `main.tsx` chama `initMonitoring()`. Chunk principal: 46.86 kB gzip. 2 testes (inerte sem DSN).
- **Sem ErrorBoundary com fallback UI:** error boundary exige class component, que **não tipifica
  sem `@types/react`** (ausente — ver armadilha abaixo). Sentry cobre a observabilidade via
  handlers globais. Fallback UI fica como débito (depende de adicionar `@types/react`).

### Item 4 — Lighthouse/PWA no CI (`651151e`)
- `.github/workflows/pwa-ci.yml`: job **gates** (npm ci + tsc + vitest + build) — preenche a
  lacuna (nenhum workflow rodava os testes) e **gateia a instalabilidade da PWA** via
  `src/__tests__/pwa-assets.test.ts`. Job **lighthouse** (treosh/lighthouse-ci-action@v12 contra
  `/login`, assertions em modo **warn**). `lighthouserc.json` (performance/a11y/best-practices/seo
  + audits installable-manifest/service-worker/maskable-icon).
- A categoria "PWA" do Lighthouse foi descontinuada (LH12) → instalabilidade travada no vitest.
- `npm ci --dry-run` → OK (lock consistente; o job gates passará).

## Descoberta (armadilha) — `@types/react` ausente
O projeto **não tem `@types/react`** e roda **sem `strict`** (modo permissivo). Por isso é 100%
function components — **class components não tipificam** (`this.props/state` "não existem" no tsc).
Adicionar `@types/react@19` revela **erros pré-existentes mascarados** (ex.: `ClientLocationSelect`
usa prop `textValue` inexistente em `SelectItemProps`, 2 ocorrências) → corrigir é fora de escopo.
Registrado na armadilha do CLAUDE.md.

## Gates (Definition of Done) — consolidado
- `npx tsc --noEmit` → EXIT 0
- `npx vitest run` → **194/194** (21 files): 187 (Etapa 1) + 5 badge + 2 monitoring
- `npm run build` → chunk principal **46.86 kB gzip** (≤ 100), sem empty chunk
- `npm ci --dry-run` → OK · `security-scan` (pre-commit) → 0 BLOCK em todos
- Browser: SW v10 em waiting + toast de atualização (handshake E2E ✅), não-regressão web, console limpo

## Pendências / próximos passos
- **Pós-commit:** preencher o hash desta sessão no `HISTORY.md`.
- **Operacional (você):** para ativar o Sentry, setar `VITE_SENTRY_DSN` no build da Vercel.
- **Débitos:** adicionar `@types/react` + corrigir erros revelados (`ClientLocationSelect.textValue`)
  → habilitaria ErrorBoundary com fallback UI; validar os jobs do `pwa-ci.yml` na 1ª execução real.
- Roadmap restante (NÃO iniciar sem aprovação): Etapa 3 (TWA/Play Store) e Etapa 4 (Capacitor) —
  decisão de negócio.
