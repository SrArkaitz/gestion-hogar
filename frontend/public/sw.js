// Service worker: hace instalable la app, muestra los avisos push y deja usar la compra sin conexión.
//
// Sin conexión: se guarda la app (para abrirla) y las últimas respuestas de lo que necesita la
// lista de la compra. Con conexión siempre se pide todo a la red primero, así nunca se queda una
// versión vieja: lo guardado solo se usa cuando la red no responde.

const APP_CACHE = 'hogar-app-v1';
const DATA_CACHE = 'hogar-datos-v1';
/** Archivos de la app (llevan un hash en el nombre: no cambian nunca), iconos y fuentes. */
const ASSET_RE = /\/(?:(?:main|polyfills|styles|chunk)-[A-Z0-9]+\.(?:js|css)|icons\/[^/]+|fiestas\/[^/]+|favicon\.svg|manifest\.webmanifest)$/;
const FONT_HOSTS = ['fonts.gstatic.com'];
/** Lo que se guarda de la API para la compra sin conexión: sesión, casa y lista. */
const DATA_RE = /^\/api\/(?:auth\/me|auth\/providers|households\/[^/]+|households\/[^/]+\/shopping\/(?:items|products))$/;
/** Archivos de la app que se guardan como mucho (los de versiones viejas se van quitando). */
const ASSET_MAX = 120;
/** Si la red tarda más que esto (cobertura mala), se usa lo guardado. */
const NETWORK_TIMEOUT_MS = 5000;

self.addEventListener('install', (event) => {
  // Guarda ya la portada y lo que carga, para que la app abra sin conexión desde la primera visita.
  event.waitUntil(precacheShell().catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = [APP_CACHE, DATA_CACHE];
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function precacheShell() {
  const res = await fetch('/', { cache: 'no-store' });
  if (!res.ok) return;
  const html = await res.clone().text();
  const cache = await caches.open(APP_CACHE);
  await cache.put('/', res);
  const urls = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => new URL(m[1], self.location.origin).href);
  await Promise.all(urls.map((u) => cache.add(u).catch(() => undefined)));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Al cerrar sesión se borra lo guardado de la API (era de esa cuenta).
  if (req.method === 'POST' && url.origin === self.location.origin && url.pathname === '/api/auth/logout') {
    event.waitUntil(caches.delete(DATA_CACHE));
    return;
  }
  if (req.method !== 'GET') return;

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') return event.respondWith(networkFirst(req, APP_CACHE, '/'));
    if (DATA_RE.test(url.pathname) && !url.search) return event.respondWith(networkFirst(req, DATA_CACHE, url.pathname, true));
    if (ASSET_RE.test(url.pathname)) return event.respondWith(cacheFirst(req));
    return;
  }
  if (FONT_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(req));
});

/** Red primero; si no hay red (o tarda demasiado), lo último guardado. */
async function networkFirst(req, cacheName, key, markOffline = false) {
  const cache = await caches.open(cacheName);
  try {
    const res = await withTimeout(fetch(req), NETWORK_TIMEOUT_MS);
    if (res.ok) await cache.put(key, res.clone());
    else if (res.status === 401 || res.status === 403) await cache.delete(key);
    return res;
  } catch (err) {
    const saved = await cache.match(key);
    if (!saved) throw err;
    if (!markOffline) return saved;
    // Avisa a la app de que es una copia guardada y de cuándo es.
    const headers = new Headers(saved.headers);
    headers.set('X-Hogar-Offline', saved.headers.get('date') || '1');
    return new Response(await saved.blob(), { status: saved.status, statusText: saved.statusText, headers });
  }
}

/** Archivos que no cambian nunca: lo guardado primero; si no está, se pide y se guarda. */
async function cacheFirst(req) {
  const cache = await caches.open(APP_CACHE);
  const saved = await cache.match(req);
  if (saved) return saved;
  const res = await fetch(req);
  if (res.ok) {
    await cache.put(req, res.clone());
    void trim(cache);
  }
  return res;
}

/** Quita los archivos más antiguos si hay demasiados (de versiones anteriores de la app). */
async function trim(cache) {
  const keys = await cache.keys();
  const extra = keys.length - ASSET_MAX;
  for (const k of keys.filter((k) => new URL(k.url).pathname !== '/').slice(0, Math.max(0, extra))) await cache.delete(k);
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => (clearTimeout(t), resolve(v)), (e) => (clearTimeout(t), reject(e)));
  });
}

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
