// न्याय साथी - Never Stop Service Worker
const CACHE_NAME = 'nyay-sathi-v1';
const RUNTIME_CACHE = 'nyay-sathi-runtime-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Install - cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.log('Install cache fail:', err))
  );
});

// Activate - old caches clean
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Fetch - cache first, network fallback, never fail
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Skip non-GET
  if (req.method !== 'GET') return;

  // Skip Supabase API - always network
  if (req.url.includes('supabase.co')) {
    event.respondWith(
      fetch(req).catch(() => new Response(JSON.stringify({ offline: true }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Everything else - cache first, then network, then cache fallback
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        // Background refresh
        fetch(req).then(res => {
          if (res && res.status === 200) {
            caches.open(RUNTIME_CACHE).then(c => c.put(req, res.clone()));
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(req).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(req, clone));
        return res;
      }).catch(() => {
        // Ultimate fallback - offline page for navigation
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Background sync (optional)
self.addEventListener('sync', (event) => {
  if (event.tag === 'nyay-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'SYNC_NOW' }));
      })
    );
  }
});

// Message from app
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

console.log('⚖️ न्याय साथी SW loaded');
