const CACHE_NAME = 'aios-mc-sw-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(
        (cached) => cached || new Response(
          '<html><body style="background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui"><div style="text-align:center"><h2>Sin conexion</h2><p>Revisa tu internet y vuelve a intentar.</p></div></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        )
      )
    )
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'AIOS', body: event.data.text() }
  }
  const title = payload.title ?? 'AIOS'
  const options = {
    body: payload.body ?? '',
    icon: payload.icon ?? '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag ?? 'aios-notification',
    data: { url: payload.url ?? '/dashboard', notificationId: payload.notificationId },
    requireInteraction: false,
    silent: false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: event.oldSubscription && event.oldSubscription.options
          ? event.oldSubscription.options.applicationServerKey
          : undefined,
      })
      .then((subscription) =>
        fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription }),
        })
      )
  )
})
