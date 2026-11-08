/* Offline app shell: deliberately never caches recipe data or third-party APIs. */
const CACHE_NAME = 'recipe-nest-shell-v1';
const APP_FILES = ['./', './index.html', './styles.css', './app.js', './recipe-parser.js', './recipe-store.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok && new URL(request.url).pathname.startsWith(new URL(self.registration.scope).pathname)) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request).then(cached => cached || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});