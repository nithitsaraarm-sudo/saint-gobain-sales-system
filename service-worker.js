const CACHE_NAME = 'sales-system-v5-0.5.35';
const ASSETS = [
  './',
  './index.html',
  './favicon.ico',
  './favicon.ico?v=0.5.35',
  './manifest.json',
  './manifest.json?v=0.5.35',
  './css/main.css',
  './css/main.css?v=0.5.35',
  './js/config.js',
  './js/config.js?v=0.5.35',
  './js/api.js',
  './js/api.js?v=0.5.35',
  './js/notifications.js',
  './js/notifications.js?v=0.5.35',
  './js/app.js',
  './js/app.js?v=0.5.35',
  './js/auth.js',
  './js/auth.js?v=0.5.35',
  './js/quotation.js',
  './js/quotation.js?v=0.5.35',
  './images/gyproc-logo.png',
  './images/gyproc-logo.png?v=0.5.35',
  './images/weber-logo.png',
  './images/weber-logo.png?v=0.5.35',
  './assets/icons/logout.svg',
  './assets/icons/logout.svg?v=0.5.35',
  './assets/icons/sidebar/home.png',
  './assets/icons/sidebar/dashboard.png',
  './assets/icons/sidebar/customer.png',
  './assets/icons/sidebar/product.png',
  './assets/icons/sidebar/promotion.png',
  './assets/icons/sidebar/calculator.png',
  './assets/icons/sidebar/quotation.png',
  './assets/icons/sidebar/quote-history.png',
  './assets/icons/sidebar/create-quotation.png',
  './assets/icons/sidebar/quotation-history.png',
  './assets/icons/sidebar/reports.png',
  './assets/icons/sidebar/users.png',
  './assets/icons/sidebar/settings.png',
  './assets/icons/sidebar/logout.png',
  './icons/favicon-16x16.png',
  './icons/favicon-16x16.png?v=0.5.35',
  './icons/favicon-32x32.png',
  './icons/favicon-32x32.png?v=0.5.35',
  './icons/apple-touch-icon.png',
  './icons/apple-touch-icon.png?v=0.5.35',
  './icons/icon-192.png',
  './icons/icon-192.png?v=0.5.35',
  './icons/icon-512.png',
  './icons/icon-512.png?v=0.5.35',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-192.png?v=0.5.35',
  './icons/icon-maskable-512.png',
  './icons/icon-maskable-512.png?v=0.5.35'
];

const STATIC_ASSET_URLS = new Set(ASSETS.map(asset => new URL(asset, self.location.href).href));
const SENSITIVE_QUERY_KEYS = ['sessionToken', 'sg_token', 'token', 'payload', 'callback', 'password'];
const API_HOST_PATTERNS = ['script.google.com', 'script.googleusercontent.com'];

function isSensitiveRequestUrl(url) {
  if (API_HOST_PATTERNS.indexOf(url.hostname) >= 0) {
    return true;
  }
  return SENSITIVE_QUERY_KEYS.some(key => url.searchParams.has(key));
}

function isApprovedStaticAsset(request) {
  try {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin || isSensitiveRequestUrl(url)) {
      return false;
    }
    return STATIC_ASSET_URLS.has(url.href);
  } catch (error) {
    return false;
  }
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

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
  if (isApprovedStaticAsset(event.request)) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }))
    );
    return;
  }
  if (isNavigationRequest(event.request)) {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
  }
});
