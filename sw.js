// V60 Brew Guide — offline support
// Online: always fetch the newest app files from the network (and refresh the saved copy).
// Offline: fall back to the saved copy.
const CACHE = 'v60-v24';
const SHELL = ['./', 'index.html', 'manifest.webmanifest',
  'icons/icon-192-v2.png', 'icons/icon-512-v2.png', 'icons/apple-touch-icon-v2.png'];

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's HTTP cache so we never save a stale copy
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(SHELL.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => c.put(u, r)))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    // Network first, so updates show up on the next open
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res && res.ok) cache.put(req.mode === 'navigate' ? './' : req, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(req, { ignoreSearch: true }))
            || (req.mode === 'navigate' ? await cache.match('./') : undefined)
            || Response.error();
      }
    })());
    return;
  }

  // Fonts and other third-party files: saved copy first, refresh in the background
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  })());
});
