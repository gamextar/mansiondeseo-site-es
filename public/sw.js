const CACHE_NAME = 'mansion-v3';
const PRECACHE = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET and API calls
  if (request.method !== 'GET' || url.pathname.startsWith('/api')) return;

  // Skip hashed Vite assets (/assets/*) — they are content-addressed so the
  // browser's native HTTP cache handles them correctly. If the SW intercepts
  // them, Cloudflare Pages' "/* → /index.html 200" SPA redirect can cause an
  // HTML response to be cached under a .js URL, producing a MIME-type error
  // when React.lazy() tries to execute the cached HTML as JavaScript.
  if (url.pathname.startsWith('/assets/')) return;

  e.respondWith(
    fetch(request)
      .then((res) => {
        // Only cache same-origin HTML responses (navigation / index.html).
        // Never cache non-HTML responses here — wrong content-type entries
        // would break lazy-loaded JS chunks after a deploy.
        if (res.ok && url.origin === self.location.origin) {
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('text/html')) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
        }
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});
