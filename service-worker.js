const CACHE_NAME = 'pwa-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './map.js',
  './storageHandler.js',
  './spotifyfetch.js',
  './data.js',
  './cookies.js',
  './manifest.json',
  './privacy-policy.html',
  './icons/192_logo.png',
  './icons/512_logo.png',
  './icons/undo-circular-arrow.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached resource if available, else fetch from network
        return response || fetch(event.request);
      })
  );
});
