# Sessão 52 cont. 2 — 23/05/2026 — Fix Tela Branca SPA + useOutletContext

**Commit:** `391b9e1`

### Contexto

Usuário reportou tela branca ao acessar a aplicação ou módulos específicos, com dois erros no console:
1. `TypeError: Cannot destructure property 'isOnline' of 'xe(...)' as it is undefined` — ReportsList
2. `The FetchEvent for '.../reports' resulted in a network error response` — Service Worker

### Bug 1 — Service Worker: rotas SPA tratadas como assets (causa raiz da tela branca)

**Root cause:** O SW anterior só reconhecia requisições de navegação via:
```javascript
const isHtml = url.pathname === '/' || url.pathname.endsWith('.html');
```
Rotas SPA como `/reports`, `/dashboard`, `/orcamentos` não terminam em `.html` e não são `/`. Portanto caíam no handler de assets (cache-first):
1. `caches.match('/reports')` → sem hit no cache
2. `fetch('/reports')` → falha de rede (offline, cold start do Supabase, instabilidade)
3. `event.respondWith()` rejeita → **browser exibe página em branco**

O reload manual "funcionava" porque o browser, ao detectar que o SW rejeitou, faz um fallback para requisição direta → Vercel serve `index.html` via rewrite rule.

**Fix aplicado (`public/sw.js`):**
```javascript
// Handler dedicado para TODAS as navegações SPA
if (request.mode === 'navigate') {
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
        }
        return response;
      })
      .catch(() => caches.match('/index.html'))  // fallback offline
  );
  return;
}
```

`CACHE_NAME` bumped de `nextai-v1` → `nextai-v2`: o evento `activate` evicta todos os caches antigos, limpando conteúdo corrompido em todos os browsers dos usuários.

**Estrutura final do SW (3 handlers em ordem):**
1. `request.mode === 'navigate'` → network-first + fallback index.html (SPA)
2. `url.pathname === '/manifest.json'` → network-first + cache
3. Demais assets (JS/CSS/imagens com hash Vite) → cache-first

### Bug 2 — ReportsList: `useOutletContext()` sem null-safety

**Root cause:** `useOutletContext<AppLayoutOutletContext>()` retorna `undefined` quando há mismatch de bundle (chunks antigos do cache SW + novo JS do servidor). O destructuring direto lança `TypeError`.

**Fix aplicado (`src/pages/reports/ReportsList.tsx`):**
```tsx
// Antes — crash se context for undefined
const { isOnline, isSyncing, pendingCount } = useOutletContext<AppLayoutOutletContext>();

// Depois — defensivo com defaults seguros
const outletCtx    = useOutletContext<AppLayoutOutletContext | undefined>();
const isOnline     = outletCtx?.isOnline    ?? true;
const isSyncing    = outletCtx?.isSyncing   ?? false;
const pendingCount = outletCtx?.pendingCount ?? 0;
```

### Validação
- `tsc --noEmit` → EXIT:0
- `npm run build` → EXIT:0 | chunk principal **95.99 kB gzip**
- Deploy automático via Vercel ao push no master

### Nota pós-deploy
Usuários com PWA instalada recebem o novo SW automaticamente na próxima visita. O evento `activate` deleta `nextai-v1` e assume com `nextai-v2`. Para teste imediato: DevTools → Application → Service Workers → Update.
