const CACHE_NAME = 'mansion-disabled-v15';

async function clearMansionCaches() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('mansion-')).map((key) => caches.delete(key)));
  } catch {}
}

self.addEventListener('install', (e) => {
  e.waitUntil(clearMansionCaches());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    clearMansionCaches()
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  );
});

self.addEventListener('fetch', (e) => {
  // Intentionally no-op: authenticated app requests must go straight to network.
});
