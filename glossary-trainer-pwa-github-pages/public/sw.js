const CACHE = 'glossary-cache-v1';
const scope = self.registration.scope; // e.g. https://user.github.io/repo_name/

const ASSETS = [
  scope,
  scope + 'index.html',
  scope + 'manifest.webmanifest',
  scope + 'icons/icon-192.png',
  scope + 'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE && caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Network-first для JSON
  if (request.headers.get('accept')?.includes('application/json')) {
    event.respondWith(
      fetch(request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
        return resp;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first для остального
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
      return resp;
    }).catch(() => caches.match(scope + 'index.html')))
  );
});
