'use strict';

try {
  importScripts('./js/version.js');
} catch (error) {
  console.warn('[SERVICE WORKER] APP_INFO unavailable; using safe fallback.', error);
}

const APP_INFO = self.APP_INFO && typeof self.APP_INFO === 'object'
  ? self.APP_INFO
  : Object.freeze({ version: 'Unknown', build: 'Unknown', release: 'Unknown', cacheVersion: 'Unknown' });

const CACHE_PREFIX = 'saint-gobain-sales-';
const CACHE_NAME = `${CACHE_PREFIX}${APP_INFO.cacheVersion}`;
const LEGACY_CACHE_PREFIXES = ['sales-system-v5-', CACHE_PREFIX];

// Sales Target UI is bundled into existing app.js/main.css, so no additional offline asset is required.
const BASE_ASSETS = [
  './',
  './index.html',
  './favicon.ico',
  './manifest.json',
  './css/main.css',
  './js/version.js',
  './js/config.js',
  './js/api.js',
  './js/notifications.js',
  './js/app.js',
  './js/auth.js',
  './js/quotation.js',
  './images/gyproc-logo.png',
  './images/weber-logo.png',
  './assets/icons/logout.svg',
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
  './icons/favicon-32x32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

function withAppVersion(asset) {
  if (asset === './' || asset === './index.html' || asset === './js/version.js') return asset;
  const separator = asset.includes('?') ? '&' : '?';
  return `${asset}${separator}v=${encodeURIComponent(APP_INFO.version)}`;
}

const ASSETS = Array.from(new Set(BASE_ASSETS.flatMap(asset => {
  const versioned = withAppVersion(asset);
  return versioned === asset ? [asset] : [asset, versioned];
})));

const STATIC_ASSET_URLS = new Set(ASSETS.map(asset => new URL(asset, self.location.href).href));
const SENSITIVE_QUERY_KEYS = ['sessionToken', 'sg_token', 'token', 'payload', 'callback', 'password'];
const API_HOST_PATTERNS = ['script.google.com', 'script.googleusercontent.com'];

function isSensitiveRequestUrl(url) {
  if (API_HOST_PATTERNS.includes(url.hostname)) return true;
  return SENSITIVE_QUERY_KEYS.some(key => url.searchParams.has(key));
}

function isApprovedStaticAsset(request) {
  try {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin || isSensitiveRequestUrl(url)) return false;
    return STATIC_ASSET_URLS.has(url.href);
  } catch (error) {
    return false;
  }
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function isVersionSourceRequest(request) {
  try {
    return new URL(request.url).pathname.endsWith('/js/version.js');
  } catch (error) {
    return false;
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key !== CACHE_NAME && LEGACY_CACHE_PREFIXES.some(prefix => key.startsWith(prefix)))
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (isVersionSourceRequest(event.request)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

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
