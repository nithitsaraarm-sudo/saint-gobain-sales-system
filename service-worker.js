const CACHE_NAME = 'sales-system-v5-0.5.11';
const ASSETS = [
  './',
  './index.html',
  './favicon.ico',
  './favicon.ico?v=0.5.7',
  './manifest.json',
  './manifest.json?v=0.5.7',
  './css/main.css',
  './css/main.css?v=0.5.8',
  './js/config.js',
  './js/config.js?v=0.5.7',
  './js/api.js',
  './js/api.js?v=0.5.7',
  './js/app.js',
  './js/app.js?v=0.5.11',
  './js/auth.js',
  './js/auth.js?v=0.5.3',
  './js/quotation.js',
  './js/quotation.js?v=0.5.11',
  './images/gyproc-logo.png',
  './images/gyproc-logo.png?v=0.5.8',
  './images/weber-logo.png',
  './images/weber-logo.png?v=0.5.8',
  './icons/favicon-16x16.png',
  './icons/favicon-16x16.png?v=0.5.7',
  './icons/favicon-32x32.png',
  './icons/favicon-32x32.png?v=0.5.7',
  './icons/apple-touch-icon.png',
  './icons/apple-touch-icon.png?v=0.5.7',
  './icons/icon-192.png',
  './icons/icon-192.png?v=0.5.7',
  './icons/icon-512.png',
  './icons/icon-512.png?v=0.5.7',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-192.png?v=0.5.7',
  './icons/icon-maskable-512.png',
  './icons/icon-maskable-512.png?v=0.5.7'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
