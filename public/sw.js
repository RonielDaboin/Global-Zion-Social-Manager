// Service worker: solo recibe las alertas push. No guarda nada en caché, así la web siempre carga la versión nueva.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data.json() } catch { /* aviso sin datos */ }
  e.waitUntil(self.registration.showNotification(d.title || 'Global Zion Social', {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag,
    renotify: !!d.tag,
    data: { url: d.url || '/#/posts' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.startsWith(self.location.origin))
    return open ? open.focus().then((c) => c.navigate(url).catch(() => {})) : self.clients.openWindow(url)
  }))
})
