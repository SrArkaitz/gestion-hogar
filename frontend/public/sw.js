// Service worker: hace instalable la app y muestra los avisos push.
// No guarda nada en caché: la app necesita conexión y así nunca se queda una versión vieja.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Aviso que llega del servidor (PushPayload en @hogar/shared).
self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Hogar', {
      body: data.body || '',
      tag: data.tag,
      // Con la misma etiqueta sustituye al anterior, pero vuelve a sonar.
      renotify: !!data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      lang: 'es',
      data: { url: data.url || '/' },
    }),
  );
});

// Al tocar el aviso: si la app ya está abierta, se va a la página dentro de ella; si no, se abre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        open.postMessage({ type: 'abrir', url });
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
