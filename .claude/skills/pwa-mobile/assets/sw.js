// Service Worker — basico + push + notificationclick
// Coloca este archivo en public/sw.js

const CACHE_NAME = 'praxis-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Limpiar caches viejas
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      ),
    ]),
  );
});

// Cache strategy: network first, cache fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Cache copia de la respuesta para fallback offline
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request)),
  );
});

// Push handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'TuApp', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'TuApp', {
      body: payload.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: payload.url ?? '/' },
      tag: payload.tag,
      requireInteraction: payload.requireInteraction ?? false,
    }),
  );
});

// Click en notificacion abre URL especifica
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si hay una ventana abierta con la URL, focus
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Sino, abrir nueva
        return self.clients.openWindow(targetUrl);
      }),
  );
});
