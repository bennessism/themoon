/* Moon PWA: app shell only; NASA annual datasets and live weather always use network. */
const CACHE_NAME = 'themoon-shell-v1';
const SHELL = ['./', './index.html', './style.css', './app.js',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon-32x32.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('themoon-shell-') && k !== CACHE_NAME).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/data/') || url.pathname.endsWith('.json') || url.pathname.endsWith('.webmanifest')) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy)).catch(() => {});
      }
      return response;
    }).catch(async () => (await caches.match('./index.html')) || Response.error()));
    return;
  }
  event.respondWith(fetch(req).then(response => {
    if (response.ok && SHELL.some(path => url.pathname.endsWith(path.replace(/^\.\//, '')))) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
    }
    return response;
  }).catch(() => caches.match(req)));
});
