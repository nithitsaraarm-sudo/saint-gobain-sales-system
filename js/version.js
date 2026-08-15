(function (root) {
  'use strict';

  const APP_INFO = Object.freeze({
    version: '0.5.57',
    build: '2026.07.30',
    release: 'Production',
    cacheVersion: '20260730-03'
  });

  Object.defineProperty(root, 'APP_INFO', {
    value: APP_INFO,
    writable: false,
    configurable: false,
    enumerable: true
  });
})(typeof self !== 'undefined' ? self : globalThis);
