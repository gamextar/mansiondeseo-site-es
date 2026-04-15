const CACHE_NAME = 'mansion-v6';

self.addEventListener('install', (e) => {
  e.waitUntil(Promise.resolve());
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

  // Do not cache app shell HTML or hashed assets in the service worker.
  // Frequent deploys plus Pages SPA fallbacks can otherwise turn missing
  // JS/CSS asset URLs into cached HTML responses, which leads to black screens.
  e.respondWith(fetch(request));
});
