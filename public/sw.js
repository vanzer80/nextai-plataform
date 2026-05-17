const CACHE_NAME = 'nextai-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/', '/index.html', '/manifest.json'])
    )
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

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-first for Supabase
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Network-first for index.html and manifest — CRITICAL: index.html must always
  // be fresh so it references the correct hashed chunk filenames from the latest deploy.
  // Cache-first here is the root cause of "white screen after deploy" bugs.
  const isHtml = url.pathname === '/' || url.pathname.endsWith('.html');
  const isManifest = url.pathname === '/manifest.json';
  if (isHtml || isManifest) {
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

  // Cache-first for JS/CSS/images (Vite adds content hashes — immutable)
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
    )
  );
});
