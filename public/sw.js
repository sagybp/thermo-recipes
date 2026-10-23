// Offline support: pages are network-first (so updates show up), everything else cache-first.
const V = 'thermo-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r)
        .then((res) => { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)); return res; })
        .catch(() => caches.match(r).then((m) => m || caches.match(self.registration.scope)))
    );
    return;
  }
  e.respondWith(
    caches.match(r).then((m) => m || fetch(r).then((res) => {
      if (res.ok) { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)); }
      return res;
    }))
  );
});
