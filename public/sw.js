const CACHE_NAME = 'nextai-v8';

// ── Push Notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = { title: 'NextAI', body: '', data: {} };
  try { data = event.data?.json() ?? data; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:     data.body,
      icon:     '/icons/icon-192.png',
      badge:    '/icons/badge-72.png',
      data:     data.data,
      tag:      'nextai-notification',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const reportId = event.notification.data?.report_id;
  const url = reportId
    ? `${self.location.origin}/reports/${reportId}`
    : `${self.location.origin}/dashboard`;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) { w.navigate(url); return w.focus(); }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Shell core: atômico — se falhar, não faz sentido instalar pela metade.
      await cache.addAll(['/', '/index.html', '/manifest.json']);
      // Ícones do push/instalação: best-effort — um 404 aqui NÃO pode derrubar o
      // install do SW (addAll é atômico; cache.add individual + allSettled tolera falha).
      await Promise.allSettled(
        [
          '/icons/icon-192.png',
          '/icons/icon-512.png',
          '/icons/badge-72.png',
          '/icons/apple-touch-icon-180.png',
        ].map((u) => cache.add(u))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // ── 1. Navigation requests (browser navigating to any SPA route) ──────────
  // Network-first: fetch fresh page and cache it; fall back to cached index.html
  // when offline. Without this handler, SPA routes like /reports or /dashboard
  // are treated as static assets — they have no cache entry and a network failure
  // causes event.respondWith() to reject, producing a blank page.
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
        .catch(async () => {
          // caches.match can return undefined if cache was cleared (e.g. after SW version bump).
          // Never pass undefined to respondWith — it causes a 503 network error in the browser.
          const cached = await caches.match('/index.html');
          if (cached) return cached;
          // Last resort: a minimal shell that auto-retries — avoids a blank/error page.
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Carregando…</title></head>' +
            '<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">' +
            '<div style="text-align:center"><p style="color:#6b7280">Sem conexão. Tentando novamente…</p>' +
            '<script>setTimeout(()=>location.reload(),4000)</script></div></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // ── 2. manifest.json — network-first (keep fresh for PWA install) ─────────
  if (url.pathname === '/manifest.json') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // ── 3. Hashed JS/CSS/images (Vite content hashes → immutable) ────────────
  // Cache-first: these never change between deploys at the same URL.
  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      } catch {
        return new Response('', { status: 503, statusText: 'Offline' });
      }
    })
  );
});
