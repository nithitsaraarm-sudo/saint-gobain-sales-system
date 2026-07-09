window.APP_VERSION = window.APP_VERSION || '0.4.0';
const APP_ENV = String(window.APP_ENV || 'production').trim().toLowerCase();
const API_MOCK_MODE = APP_ENV === 'development';
const GAS_WEB_APP_URL =
'https://script.google.com/macros/s/AKfycbyuhRP2aIYI11vzMsIzGr2ncuhrflHb1u9flm_OwjpjZOJOTXvAg1HQu4iq62ZwjJn3RQ/exec';
let bootstrapApiPromise = null;
let bootstrapApiCache = null;
const pendingApiRequests = {};
const CACHE_KEYS = {
  customers: 'sg_customers_cache',
  products: 'sg_products_cache',
  bootstrap: 'sg_bootstrap_cache',
  discount: 'sg_discount_cache',
  quotation: 'sg_quotation_cache',
  quotationHistory: 'sg_quotation_history_cache'
};

function isApiDebugEnabled() {
  try {
    return APP_ENV === 'development'
      || window.DEBUG_API_TIMING === true
      || localStorage.getItem('sg_debug_api') === 'true';
  } catch (error) {
    return APP_ENV === 'development';
  }
}

function logApiDebug(action, state) {
  if (isApiDebugEnabled() && typeof console !== 'undefined' && typeof console.log === 'function') {
    console.log('[API]', action, state);
  }
}

function setCache(key, data, ttlMinutes) {
  try {
    const ttl = Math.max(1, Number(ttlMinutes || 1)) * 60 * 1000;
    localStorage.setItem(String(key), JSON.stringify({
      expiresAt: Date.now() + ttl,
      data: data
    }));
    return true;
  } catch (error) {
    return false;
  }
}

function getCache(key) {
  try {
    const raw = localStorage.getItem(String(key));
    if (!raw) {
      return null;
    }
    const cached = JSON.parse(raw);
    if (!cached || !cached.expiresAt || cached.expiresAt <= Date.now()) {
      clearCache(key);
      return null;
    }
    return cached.data;
  } catch (error) {
    clearCache(key);
    return null;
  }
}

function clearCache(key) {
  try {
    localStorage.removeItem(String(key));
  } catch (error) {
    // Cache is best-effort only.
  }
}

function getRequestKey(action, payload) {
  return String(action || '').trim() + JSON.stringify(payload || {});
}

function isApiTimingEnabled(action) {
  const timedActions = ['bootstrap', 'products', 'getProducts', 'customers', 'getCustomers', 'getQuotationHistory', 'loadQuotation', 'discount', 'quotation', 'saveQuotation', 'updateQuotation'];
  if (timedActions.indexOf(String(action || '').trim()) < 0) {
    return false;
  }
  try {
    return APP_ENV === 'development'
      || window.DEBUG_API_TIMING === true
      || localStorage.getItem('sg_debug_api') === 'true';
  } catch (error) {
    return APP_ENV === 'development';
  }
}

function withApiTiming(action, requestKey, requestPromise) {
  if (!isApiTimingEnabled(action) || typeof console === 'undefined' || typeof console.time !== 'function') {
    return requestPromise;
  }
  const label = 'api:' + action + ':' + requestKey;
  console.time(label);
  return requestPromise.finally(function () {
    if (typeof console !== 'undefined' && typeof console.timeEnd === 'function') {
      console.timeEnd(label);
    }
  });
}

function getQuoteIdFromPayload(payload) {
  if (payload && typeof payload === 'object') {
    return String(payload.quoteId || payload.quoteNo || '').trim();
  }
  return String(payload || '').trim();
}

function getCachedQuotation(quoteId) {
  const id = String(quoteId || '').trim();
  if (!id) {
    return null;
  }
  const cached = getCache(CACHE_KEYS.quotation) || {};
  return cached[id] || null;
}

function setCachedQuotation(quoteId, data) {
  const id = String(quoteId || '').trim();
  if (!id || !data) {
    return;
  }
  const cached = getCache(CACHE_KEYS.quotation) || {};
  cached[id] = data;
  const quoteNo = data.quote && data.quote.quoteNo ? String(data.quote.quoteNo).trim() : '';
  if (quoteNo) {
    cached[quoteNo] = data;
  }
  setCache(CACHE_KEYS.quotation, cached, 10);
}

function clearQuotationCache(quoteId) {
  const id = String(quoteId || '').trim();
  if (!id) {
    clearCache(CACHE_KEYS.quotation);
    return;
  }
  const cached = getCache(CACHE_KEYS.quotation) || {};
  if (cached[id]) {
    delete cached[id];
  }
  Object.keys(cached).forEach(function (key) {
    const quote = cached[key] && cached[key].quote ? cached[key].quote : {};
    if (String(quote.quoteId || '').trim() === id || String(quote.quoteNo || '').trim() === id) {
      delete cached[key];
    }
  });
  setCache(CACHE_KEYS.quotation, cached, 10);
}

function runApiRequest(action, payload) {
  return jsonpApi(action, payload);
}

function callApi(action, payload) {
  const normalizedAction = String(action || '').trim();
  let body = payload || {};
  if (normalizedAction === 'loadQuotation') {
    body = { quoteId: getQuoteIdFromPayload(body) };
  }
  const requestKey = getRequestKey(normalizedAction, body);

  if (API_MOCK_MODE) {
    logApiDebug(normalizedAction, 'cached');
    return Promise.resolve(mockApi(normalizedAction, body));
  }

  if (normalizedAction === 'bootstrap') {
    if (body.force) {
      bootstrapApiCache = null;
      bootstrapApiPromise = null;
      delete pendingApiRequests[requestKey];
    }
    const cachedBootstrap = !body.force ? getCache(CACHE_KEYS.bootstrap) : null;
    if (cachedBootstrap) {
      logApiDebug(normalizedAction, 'cached');
      return Promise.resolve({ ok: true, data: cachedBootstrap, cached: true });
    }
    if (bootstrapApiCache) {
      logApiDebug(normalizedAction, 'cached');
      return Promise.resolve(bootstrapApiCache);
    }
    if (bootstrapApiPromise) {
      logApiDebug(normalizedAction, 'pending');
      return bootstrapApiPromise;
    }
    logApiDebug(normalizedAction, 'network');
    bootstrapApiPromise = withApiTiming(normalizedAction, requestKey, runApiRequest(normalizedAction, body)).then(function (response) {
      if (response && response.ok) {
        bootstrapApiCache = response;
        setCache(CACHE_KEYS.bootstrap, response.data || {}, 15);
      }
      return response;
    }).finally(function () {
      bootstrapApiPromise = null;
    });
    return bootstrapApiPromise;
  }

  if (normalizedAction === 'loadQuotation') {
    const quoteId = getQuoteIdFromPayload(body);
    const cachedQuotation = getCachedQuotation(quoteId);
    if (cachedQuotation) {
      logApiDebug(normalizedAction, 'cached');
      return Promise.resolve({ ok: true, data: cachedQuotation, cached: true });
    }
  }

  if (pendingApiRequests[requestKey]) {
    logApiDebug(normalizedAction, 'pending');
    return pendingApiRequests[requestKey];
  }

  logApiDebug(normalizedAction, 'network');
  pendingApiRequests[requestKey] = withApiTiming(normalizedAction, requestKey, runApiRequest(normalizedAction, body)).then(function (response) {
    if (normalizedAction === 'loadQuotation' && response && response.ok && response.data) {
      setCachedQuotation(getQuoteIdFromPayload(body), response.data);
    }
    return response;
  }).finally(function () {
    delete pendingApiRequests[requestKey];
  });

  return pendingApiRequests[requestKey];
}

function gas(action, payload) {
  return callApi(action, payload);
}

function jsonpApi(action, payload) {
  return new Promise(function (resolve) {
    const callbackName = '__sgApiCallback_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    const script = document.createElement('script');
    let settled = false;
    let timedOut = false;

    const timeout = window.setTimeout(function () {
      timedOut = true;
      settled = true;
      removeScript();
      scheduleCallbackDelete();
      resolve({ ok: false, message: 'API request timeout' });
    }, 30000);

    function removeScript() {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    function scheduleCallbackDelete() {
      window.setTimeout(function () {
        try {
          delete window[callbackName];
        } catch (error) {
          window[callbackName] = undefined;
        }
      }, 30000);
    }

    function finish(response) {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      removeScript();
      scheduleCallbackDelete();
      resolve(response);
    }

    window[callbackName] = function (response) {
      if (timedOut) {
        return;
      }
      finish(response || { ok: false, message: 'Empty API response' });
    };

    script.onerror = function () {
      finish({ ok: false, message: 'API request failed' });
    };

    script.src = GAS_WEB_APP_URL
      + '?action=' + encodeURIComponent(action)
      + '&payload=' + encodeURIComponent(JSON.stringify(payload || {}))
      + '&callback=' + encodeURIComponent(callbackName);

    document.head.appendChild(script);
  });
}

function mockApi(action, payload) {
  const data = payload || {};
  switch (action) {
    case 'login':
      return { ok: true, data: { username: data.username || 'demo', displayName: 'ก้อย Sales', position: 'Sales Executive', phone: '0800000000' } };
    case 'demoLogin':
      return { ok: true, data: { username: 'demo', displayName: 'ก้อย Sales', position: 'Sales Executive', phone: '0800000000' } };
    case 'bootstrap':
      return { ok: true, data: { settings: { companyName: 'SAINT-GOBAIN', appName: 'SALES SYSTEM', welcomeText: 'เริ่มต้นวันใหม่อย่างมีประสิทธิภาพนะคะ', vatRate: 7 }, counts: { customers: 0, products: 0 }, sheetInitialized: true } };
    case 'customers':
      return { ok: true, data: [] };
    case 'products':
      return { ok: true, data: [] };
    case 'discount':
      return { ok: true, data: { customerId: data.customerId || '', groupCode: data.groupCode || '', discountGroup: '', discountPercent: 0, source: 'mock' }, message: 'Mock discount' };
    case 'quotation':
      return { ok: true, message: 'Mock quotation saved', data: { quoteNo: 'QT-MOCK-' + Date.now() } };
    case 'register':
      return { ok: true, data: { username: data.username || 'demo', displayName: data.displayName || 'ก้อย Sales', position: data.position || 'Sales Executive', phone: data.phone || '0800000000' } };
    case 'resetPassword':
      return { ok: true, message: 'Mock password reset successful' };
    case 'updateProfile':
      return { ok: true, data: data, message: 'Mock profile saved' };
    case 'updateSettings':
      return { ok: true, data: data, message: 'Mock settings saved' };
    case 'saveCustomer':
      return { ok: true, data: data, message: 'Mock customer saved' };
    case 'saveProduct':
      return { ok: true, data: data, message: 'Mock product saved' };
    case 'savePromotion':
      return { ok: true, data: data, message: 'Mock promotion saved' };
    case 'createQuotation':
      return { ok: true, data: { quoteId: 'QT-MOCK-' + Date.now() }, message: 'Mock quotation created' };
    case 'loadQuotation':
      return { ok: true, data: { quote: { quoteId: typeof data === 'object' && data.quoteId ? data.quoteId : String(data || 'QT-MOCK-1'), customerId: 'DEMO', customerName: 'Demo Customer', shipping: 0, specialDiscount: 0, status: 'DRAFT' }, lines: [], totals: { subtotal: 0, vat: 0, shipping: 0, specialDiscount: 0, grandTotal: 0 } } };
    case 'duplicateQuotation':
      return { ok: true, data: { originalQuoteId: typeof data === 'object' && data.quoteId ? data.quoteId : String(data || ''), newQuoteId: 'QT-MOCK-' + Date.now() }, message: 'Mock duplicated quotation' };
    case 'cancelQuotation':
      return { ok: true, data: { quoteId: typeof data === 'object' && data.quoteId ? data.quoteId : String(data || ''), status: 'CANCELLED' }, message: 'Mock quotation cancelled' };
    case 'getQuotationHistory':
      return { ok: true, data: [] };
    default:
      return { ok: false, message: 'Mock action unsupported: ' + action };
  }
}

window.callApi = callApi;
window.gas = gas;
window.setCache = setCache;
window.getCache = getCache;
window.clearCache = clearCache;
window.CACHE_KEYS = CACHE_KEYS;
window.clearQuotationCache = clearQuotationCache;
