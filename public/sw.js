const CACHE_NAME = 'ia-sports-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/manifest.json'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    }).catch(() => {})
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', event => {
  if (event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const cache = caches.open(CACHE_NAME);
            cache.then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(response => {
            return response || new Response('Offline - Cache não disponível', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
        })
    );
  }
});

// Background sync para alertas
self.addEventListener('sync', event => {
  if (event.tag === 'sync-oportunidades') {
    event.waitUntil(
      fetch('/scanner-global')
        .then(res => res.json())
        .then(data => {
          if (data.jogos && data.jogos.length > 0) {
            self.registration.showNotification('🎯 Novas oportunidades!', {
              body: `${data.jogos.length} jogos com potencial`,
              icon: '/icon-192x192.png',
              badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect fill="%2300c2ff" width="96" height="96"/><text x="48" y="70" font-size="64" fill="white" text-anchor="middle">⚽</text></svg>',
              tag: 'oportunidades',
              requireInteraction: false
            });
          }
        })
        .catch(() => {})
    );
  }
});
