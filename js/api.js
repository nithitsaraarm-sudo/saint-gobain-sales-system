window.APP_VERSION = window.APP_VERSION || '0.5.17';
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
  publicSettings: 'sg_public_settings_cache',
  discount: 'sg_discount_cache',
  quotation: 'sg_quotation_cache',
  quotationHistory: 'sg_quotation_history_cache'
};
const API_TIMEOUT_MS = 30000;
const API_RESPONSE_PREVIEW_LIMIT = 500;
const QUOTATION_SAVE_RECONCILE_ACTIONS = ['saveQuotation', 'updateQuotation', 'quotation'];
const API_POST_RECONCILE_CODES = ['NETWORK_ERROR', 'TIMEOUT', 'HTTP_ERROR', 'EMPTY_RESPONSE', 'INVALID_JSON', 'API_RESPONSE_INVALID'];
const READ_ACTIONS = [
  'bootstrap',
  'getPublicSystemSettings',
  'getSystemIdentitySettings',
  'customers',
  'getCustomers',
  'customer',
  'searchCustomers',
  'getCustomerFilters',
  'getAreas',
  'getAssignableSalesUsers',
  'getCustomerFormOptions',
  'products',
  'getProducts',
  'searchQuoteProducts',
  'product',
  'discount',
  'loadQuotation',
  'getQuotationHistory',
  'loadUsers',
  'getFavoriteCustomers',
  'getProductPreferences'
];
const WRITE_ACTIONS = [
  'login',
  'demoLogin',
  'logout',
  'changePassword',
  'createUser',
  'updateUser',
  'register',
  'resetPassword',
  'updateProfile',
  'uploadProfileImage',
  'saveCustomer',
  'updateCustomer',
  'addFavoriteCustomer',
  'removeFavoriteCustomer',
  'reorderFavoriteCustomers',
  'addFavoriteProduct',
  'removeFavoriteProduct',
  'addPinnedProduct',
  'removePinnedProduct',
  'reorderPinnedProducts',
  'saveProduct',
  'savePromotion',
  'updateSettings',
  'updateSystemIdentitySettings',
  'createQuotation',
  'duplicateQuotation',
  'cancelQuotation',
  'updateQuotation',
  'quotation',
  'saveQuotation'
];

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

function normalizeApiBoolean(value) {
  if (value === true || value === false) return value;
  const text = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
  if (text === 'true' || text === 'yes' || text === '1' || text === 'success' || text === 'ok') return true;
  if (text === 'false' || text === 'no' || text === '0' || text === 'error' || text === 'failed') return false;
  return null;
}

function getApiResponsePreview(text) {
  return String(text === undefined || text === null ? '' : text).slice(0, API_RESPONSE_PREVIEW_LIMIT);
}

function normalizeApiResponse(response, fallback) {
  const context = fallback || {};
  if (!response || typeof response !== 'object') {
    return {
      ok: false,
      success: false,
      code: context.code || 'EMPTY_RESPONSE',
      message: context.message || 'Empty API response',
      detail: context.detail || null
    };
  }
  const okValue = Object.prototype.hasOwnProperty.call(response, 'ok') ? normalizeApiBoolean(response.ok) : null;
  const successValue = Object.prototype.hasOwnProperty.call(response, 'success') ? normalizeApiBoolean(response.success) : null;
  const ok = okValue !== null ? okValue : (successValue !== null ? successValue : false);
  const errorObject = response.error && typeof response.error === 'object' ? response.error : null;
  const message = String(
    response.message ||
    (errorObject && errorObject.message) ||
    (typeof response.error === 'string' ? response.error : '') ||
    context.message ||
    (ok ? '' : 'API request failed')
  );
  const code = String(
    response.code ||
    (errorObject && errorObject.code) ||
    context.code ||
    (ok ? 'SUCCESS' : 'ERROR')
  );
  const data = response.data !== undefined
    ? response.data
    : (response.result !== undefined
      ? response.result
      : (ok && !Object.prototype.hasOwnProperty.call(response, 'data') ? null : response.data));
  return Object.assign({}, response, {
    ok: ok,
    success: ok,
    code: code,
    data: data === undefined ? null : data,
    message: message,
    detail: response.detail || (errorObject && errorObject.detail) || context.detail || null
  });
}

function parseApiResponseText(text, context) {
  const body = String(text === undefined || text === null ? '' : text);
  if (!body.trim()) {
    return normalizeApiResponse(null, {
      code: 'EMPTY_RESPONSE',
      message: 'Empty API response'
    });
  }
  try {
    return normalizeApiResponse(JSON.parse(body), context);
  } catch (error) {
    return {
      ok: false,
      success: false,
      code: 'API_RESPONSE_INVALID',
      message: 'API response is not JSON',
      detail: getApiResponsePreview(body)
    };
  }
}

function logApiTechnicalIssue(action, issue) {
  if (typeof console === 'undefined' || typeof console.warn !== 'function') return;
  const data = issue || {};
  console.warn('[API] technical issue', {
    action: String(action || '').trim(),
    code: data.code || '',
    status: data.status || '',
    redirected: Boolean(data.redirected),
    url: data.url ? String(data.url).slice(0, 160) : '',
    message: data.message || '',
    detail: data.detail ? String(data.detail).slice(0, API_RESPONSE_PREVIEW_LIMIT) : ''
  });
}

function shouldReconcileQuotationSave(action, payload, response) {
  const normalizedAction = String(action || '').trim();
  const data = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const code = String(response && response.code || '').trim();
  return QUOTATION_SAVE_RECONCILE_ACTIONS.indexOf(normalizedAction) >= 0
    && String(data.clientRequestId || data.clientSaveId || data.quoteSaveRequestId || '').trim()
    && response
    && response.ok !== true
    && API_POST_RECONCILE_CODES.indexOf(code) >= 0;
}

function getPendingQuotationSaveMessage() {
  return 'การบันทึกใช้เวลานานกว่าปกติ ระบบกำลังตรวจสอบผลการบันทึก กรุณาอย่ากดบันทึกซ้ำ';
}

function reconcileQuotationSaveResponse(action, payload, postFailure) {
  logApiTechnicalIssue(action, {
    code: postFailure && postFailure.code || 'POST_SAVE_RESPONSE_FAILED',
    message: 'Trying save reconciliation with same clientRequestId',
    detail: postFailure && postFailure.detail || ''
  });
  return apiJsonpGet(action, payload, { timeoutMs: API_TIMEOUT_MS }).then(function (reconcileResponse) {
    const normalized = normalizeApiResponse(reconcileResponse, {
      code: reconcileResponse && reconcileResponse.code || 'SAVE_RECONCILE_FAILED',
      message: reconcileResponse && reconcileResponse.message || ''
    });
    if (normalized.ok) {
      normalized.reconciled = true;
      normalized.originalPostCode = postFailure && postFailure.code || '';
      return normalized;
    }
    if (normalized.code === 'DUPLICATE_SUBMIT') {
      return Object.assign({}, normalized, {
        code: 'SAVE_RESULT_PENDING',
        retryable: true,
        message: getPendingQuotationSaveMessage(),
        originalPostCode: postFailure && postFailure.code || ''
      });
    }
    return Object.assign({}, postFailure, {
      reconcileCode: normalized.code,
      reconcileMessage: normalized.message,
      message: postFailure && postFailure.message || normalized.message || 'API request failed'
    });
  }, function (error) {
    logApiTechnicalIssue(action, {
      code: 'SAVE_RECONCILE_EXCEPTION',
      message: error && error.message ? error.message : String(error || '')
    });
    return postFailure;
  });
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

function invalidateBootstrapApiCache() {
  bootstrapApiCache = null;
  bootstrapApiPromise = null;
  clearCache(CACHE_KEYS.bootstrap);
}

function isUsableBootstrapCache(data) {
  return data
    && typeof data === 'object'
    && Array.isArray(data.quotes)
    && Array.isArray(data.quoteLines);
}

function getRequestKey(action, payload) {
  if (payload && typeof payload === 'object' && payload.profileImageData) {
    return String(action || '').trim() + ':profileImage:' + String(payload.profileImageData || '').length;
  }
  const keyPayload = payload && typeof payload === 'object' && !Array.isArray(payload) ? Object.assign({}, payload) : payload;
  if (keyPayload && typeof keyPayload === 'object' && !Array.isArray(keyPayload)) {
    delete keyPayload.requestId;
    delete keyPayload.clientRequestId;
  }
  return String(action || '').trim() + JSON.stringify(keyPayload || {});
}

function isApiTimingEnabled(action) {
  const timedActions = ['bootstrap', 'products', 'getProducts', 'customers', 'getCustomers', 'getCustomerFormOptions', 'getAssignableSalesUsers', 'getCustomerFilters', 'getAreas', 'getQuotationHistory', 'loadQuotation', 'discount', 'quotation', 'saveQuotation', 'updateQuotation'];
  const normalizedAction = String(action || '').trim();
  if (['getCustomerFormOptions', 'getAssignableSalesUsers', 'getCustomerFilters', 'getAreas'].indexOf(normalizedAction) >= 0) {
    return true;
  }
  if (timedActions.indexOf(normalizedAction) < 0) {
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

function createApiRequestId(action) {
  return String(action || 'api').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30) + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 100000).toString(36);
}

function withApiTiming(action, requestKey, requestPromise, requestId) {
  if (!isApiTimingEnabled(action) || typeof console === 'undefined') {
    return requestPromise;
  }
  const label = 'api:' + action + ':' + requestKey;
  const startedAt = Date.now();
  if (typeof console.time === 'function') console.time(label);
  if (typeof console.info === 'function') console.info('[API] start', { action: action, requestId: requestId, startTime: startedAt });
  return requestPromise.then(function (response) {
    if (typeof console.info === 'function') {
      console.info('[API] end', {
        action: action,
        requestId: requestId,
        elapsedMs: Date.now() - startedAt,
        ok: !!(response && response.ok),
        code: response && response.code || ''
      });
    }
    return response;
  }, function (error) {
    if (typeof console.warn === 'function') {
      console.warn('[API] error', {
        action: action,
        requestId: requestId,
        elapsedMs: Date.now() - startedAt,
        errorType: error && error.name || 'ERROR'
      });
    }
    throw error;
  }).finally(function () {
    if (typeof console !== 'undefined' && typeof console.timeEnd === 'function') {
      console.timeEnd(label);
    }
  });
}

function getQuoteIdFromPayload(payload) {
  if (payload && typeof payload === 'object') {
    return String(payload.quoteId || payload.quoteNo || payload.value || '').trim();
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

function isWriteAction(action) {
  return WRITE_ACTIONS.indexOf(String(action || '').trim()) >= 0;
}

function isReadAction(action) {
  return READ_ACTIONS.indexOf(String(action || '').trim()) >= 0;
}

function runApiRequest(action, payload) {
  return apiRequest(action, payload);
}

function apiRequest(action, payload, options) {
  const normalizedAction = String(action || '').trim();
  if (isWriteAction(normalizedAction)) {
    return apiPost(normalizedAction, payload, options);
  }
  if (isReadAction(normalizedAction)) {
    return apiJsonpGet(normalizedAction, payload, options);
  }
  return apiJsonpGet(normalizedAction, payload, options);
}

function callApi(action, payload) {
  const normalizedAction = String(action || '').trim();
  let body = payload || {};
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    body = Object.assign({}, body);
  } else {
    body = { value: body };
  }
  try {
    const token = localStorage.getItem('sg_token') || localStorage.getItem('sessionToken') || '';
    const userId = localStorage.getItem('sg_userId') || '';
    if (token && !body.sessionToken) body.sessionToken = token;
    if (userId && !body.currentUserId) body.currentUserId = userId;
  } catch (error) {
    // Auth context is optional for public calls.
  }
  if (normalizedAction === 'loadQuotation') {
    body = { quoteId: getQuoteIdFromPayload(body) };
    try {
      const token = localStorage.getItem('sg_token') || localStorage.getItem('sessionToken') || '';
      if (token) body.sessionToken = token;
    } catch (error) {}
  }
  if (!body.requestId) body.requestId = createApiRequestId(normalizedAction);
  const requestId = body.requestId;
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
    if (cachedBootstrap && !isUsableBootstrapCache(cachedBootstrap)) {
      clearCache(CACHE_KEYS.bootstrap);
    } else if (cachedBootstrap) {
      logApiDebug(normalizedAction, 'cached');
      return Promise.resolve({ ok: true, data: cachedBootstrap, cached: true });
    }
    if (bootstrapApiCache && !isUsableBootstrapCache(bootstrapApiCache.data)) {
      bootstrapApiCache = null;
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
    bootstrapApiPromise = withApiTiming(normalizedAction, requestKey, runApiRequest(normalizedAction, body), requestId).then(function (response) {
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

  if (normalizedAction === 'getPublicSystemSettings') {
    if (body.force) {
      clearCache(CACHE_KEYS.publicSettings);
      delete pendingApiRequests[requestKey];
    }
    const cachedPublicSettings = !body.force ? getCache(CACHE_KEYS.publicSettings) : null;
    if (cachedPublicSettings) {
      logApiDebug(normalizedAction, 'cached');
      return Promise.resolve({ ok: true, data: cachedPublicSettings, cached: true });
    }
    if (pendingApiRequests[requestKey]) {
      logApiDebug(normalizedAction, 'pending');
      return pendingApiRequests[requestKey];
    }
    logApiDebug(normalizedAction, 'network');
    pendingApiRequests[requestKey] = runApiRequest(normalizedAction, body).then(function (response) {
      if (response && response.ok && response.data) {
        setCache(CACHE_KEYS.publicSettings, response.data, 15);
      }
      return response;
    }).finally(function () {
      delete pendingApiRequests[requestKey];
    });
    return pendingApiRequests[requestKey];
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
  pendingApiRequests[requestKey] = withApiTiming(normalizedAction, requestKey, runApiRequest(normalizedAction, body), requestId).then(function (response) {
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

function apiJsonpGet(action, payload, options) {
  return new Promise(function (resolve) {
    const callbackName = '__sgApiCallback_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    const script = document.createElement('script');
    let settled = false;
    let timedOut = false;
    const timeoutMs = Number(options && options.timeoutMs || API_TIMEOUT_MS);

    const timeout = window.setTimeout(function () {
      timedOut = true;
      settled = true;
      removeScript();
      scheduleCallbackDelete();
      resolve({ ok: false, success: false, code: 'TIMEOUT', message: 'API request timeout' });
    }, timeoutMs);

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
      finish(normalizeApiResponse(response, { code: 'EMPTY_RESPONSE', message: 'Empty API response' }));
    };

    script.onerror = function () {
      finish({ ok: false, success: false, code: 'NETWORK_ERROR', message: 'API request failed' });
    };

    script.src = GAS_WEB_APP_URL
      + '?action=' + encodeURIComponent(action)
      + '&payload=' + encodeURIComponent(JSON.stringify(payload || {}))
      + '&callback=' + encodeURIComponent(callbackName);

    document.head.appendChild(script);
  });
}

function apiPost(action, payload, options) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutMs = Number(options && options.timeoutMs || API_TIMEOUT_MS);
  let timeoutId = null;
  if (controller) {
    timeoutId = window.setTimeout(function () {
      controller.abort();
    }, timeoutMs);
  }

  return fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: action,
      payload: payload || {}
    }),
    signal: controller ? controller.signal : undefined
  }).then(function (response) {
    return response.text().then(function (text) {
      if (!response.ok) {
        const httpResult = {
          ok: false,
          success: false,
          code: 'HTTP_ERROR',
          message: 'HTTP ' + response.status,
          detail: getApiResponsePreview(text),
          status: response.status,
          redirected: response.redirected,
          responseUrl: response.url || ''
        };
        logApiTechnicalIssue(action, httpResult);
        return httpResult;
      }
      const parsed = parseApiResponseText(text, {
        status: response.status,
        redirected: response.redirected,
        url: response.url || ''
      });
      if (!parsed.ok && API_POST_RECONCILE_CODES.indexOf(parsed.code) >= 0) {
        logApiTechnicalIssue(action, {
          code: parsed.code,
          status: response.status,
          redirected: response.redirected,
          url: response.url || '',
          message: parsed.message,
          detail: parsed.detail || ''
        });
      }
      return parsed;
    });
  }).then(function (result) {
    const normalized = normalizeApiResponse(result);
    if (shouldReconcileQuotationSave(action, payload, normalized)) {
      return reconcileQuotationSaveResponse(action, payload, normalized);
    }
    return normalized;
  }).catch(function (error) {
    let result;
    if (error && error.name === 'AbortError') {
      result = { ok: false, success: false, code: 'TIMEOUT', message: 'API request timeout' };
    } else {
      result = { ok: false, success: false, code: 'NETWORK_ERROR', message: error && error.message ? error.message : 'API request failed' };
    }
    logApiTechnicalIssue(action, result);
    if (shouldReconcileQuotationSave(action, payload, result)) {
      return reconcileQuotationSaveResponse(action, payload, result);
    }
    return result;
  }).finally(function () {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  });
}

function mockApi(action, payload) {
  const data = payload || {};
  const normalizeMockProductReference = value => String(value || '').trim().toLowerCase();
  const mockProductMatchesReference = (product, reference) => {
    const target = normalizeMockProductReference(reference);
    return Boolean(target && ['productId','sku','productCode','id','itemCode'].some(field => normalizeMockProductReference(product && product[field]) === target));
  };
  const findMockProductByReference = reference => (window.DB?.products || []).find(product => mockProductMatchesReference(product, reference));
  const mockPublicSettings = () => {
    window.__mockPublicSettings = window.__mockPublicSettings || { companyName: 'SAINT-GOBAIN', systemName: 'SALES SYSTEM', appName: 'SALES SYSTEM' };
    return window.__mockPublicSettings;
  };
  if (action === 'demoLogin') {
    return { ok: false, code: 'FORBIDDEN', message: 'Demo Login is disabled' };
  }
  if (action === 'login') {
    return { ok: true, data: { sessionToken: 'mock-token', user: { userId: 'LOCAL_USER', username: data.username || 'local', fullName: 'Local User', displayName: 'Local User', role: 'VIEWER', branch: '', phone: '' } } };
  }
  if (action === 'loadUsers') {
    return { ok: true, data: [{ userId: 'LOCAL_USER', username: 'local', fullName: 'Local User', role: 'VIEWER', branch: '', status: 'Active', lastLogin: '' }] };
  }
  if (['createUser', 'updateUser', 'changePassword', 'logout'].indexOf(action) >= 0) {
    return { ok: true, data: data, message: 'Mock success' };
  }
  switch (action) {
    case 'login':
      return { ok: true, data: { username: data.username || 'local', displayName: 'Local User', position: '', phone: '' } };
    case 'demoLogin':
      return { ok: false, code: 'FORBIDDEN', message: 'Demo Login is disabled' };
    case 'bootstrap':
      return { ok: true, data: { settings: Object.assign({}, mockPublicSettings(), { welcomeText: 'เริ่มต้นวันใหม่อย่างมีประสิทธิภาพนะคะ', vatRate: 7 }), publicSettings: mockPublicSettings(), counts: { customers: 0, products: 0 }, quotes: [], quoteLines: [], sheetInitialized: true } };
    case 'getPublicSystemSettings':
      return { ok: true, data: mockPublicSettings(), message: 'Mock public settings loaded' };
    case 'getSystemIdentitySettings':
      return { ok: true, data: mockPublicSettings(), message: 'Mock system identity loaded' };
    case 'customers':
      return { ok: true, data: [] };
    case 'getCustomerFormOptions':
      return { ok: true, data: { salesAreas: ['Bangkok'], areas: ['Bangkok'], salesUsers: [], assignableSalesUsers: [], brandOptions: [{ value: 'WEBER', label: 'Weber' }, { value: 'GYPROC', label: 'Gyproc' }], permissions: { canViewAllAreas: true, actorArea: 'Bangkok' } } };
    case 'getCustomerFilters':
      return { ok: true, data: { areas: ['Bangkok'], brands: { weber: 0, gyproc: 0, both: 0, review: 0 }, assignableSalesUsers: [] } };
    case 'getAreas':
      return { ok: true, data: ['Bangkok'] };
    case 'getAssignableSalesUsers':
      return { ok: true, data: [] };
    case 'products':
      return { ok: true, data: [] };
    case 'discount':
      return { ok: true, data: { customerId: data.customerId || '', groupCode: data.groupCode || '', discountGroup: '', discountPercent: 0, source: 'mock' }, message: 'Mock discount' };
    case 'quotation':
      return { ok: true, message: 'Mock quotation saved', data: { quoteNo: 'QT-MOCK-' + Date.now() } };
    case 'register':
      return { ok: false, code: 'FORBIDDEN', message: 'Self registration is disabled' };
    case 'resetPassword':
      return { ok: true, message: 'Mock password reset successful' };
    case 'updateProfile':
      return { ok: true, data: data, message: 'Mock profile saved' };
    case 'uploadProfileImage':
      return { ok: true, data: { profileImageUrl: data.profileImageData || '', photoUrl: data.profileImageData || '' }, message: 'Mock profile image uploaded' };
    case 'updateSettings':
      return { ok: true, data: data, message: 'Mock settings saved' };
    case 'updateSystemIdentitySettings':
      window.__mockPublicSettings = {
        companyName: String(data.companyName || 'SAINT-GOBAIN').trim() || 'SAINT-GOBAIN',
        systemName: String(data.systemName || data.appName || 'SALES SYSTEM').trim() || 'SALES SYSTEM',
        appName: String(data.systemName || data.appName || 'SALES SYSTEM').trim() || 'SALES SYSTEM'
      };
      clearCache(CACHE_KEYS.publicSettings);
      invalidateBootstrapApiCache();
      return { ok: true, data: window.__mockPublicSettings, message: 'บันทึกชื่อบริษัทและชื่อระบบเรียบร้อยแล้ว' };
    case 'saveCustomer':
    case 'updateCustomer':
      return { ok: true, data: data, message: 'Mock customer saved' };
    case 'getFavoriteCustomers':
      window.__mockFavoriteCustomers=window.__mockFavoriteCustomers||[];
      return {ok:true,data:window.__mockFavoriteCustomers};
    case 'addFavoriteCustomer':
      window.__mockFavoriteCustomers=window.__mockFavoriteCustomers||[];
      if(window.__mockFavoriteCustomers.length>=5)return {ok:false,message:'สามารถปักร้านค้าโปรดได้สูงสุด 5 ร้าน'};
      if(!window.__mockFavoriteCustomers.some(c=>c.customerId===data.customerId)){const customer=(window.DB?.customers||[]).find(c=>c.customerId===data.customerId);if(customer)window.__mockFavoriteCustomers.push(customer);}
      return {ok:true,data:data,message:'เพิ่มร้านค้าโปรดเรียบร้อย'};
    case 'removeFavoriteCustomer':
      window.__mockFavoriteCustomers=(window.__mockFavoriteCustomers||[]).filter(c=>c.customerId!==data.customerId);
      return {ok:true,data:data,message:'นำร้านค้าออกจากรายการโปรดแล้ว'};
    case 'reorderFavoriteCustomers':
      window.__mockFavoriteCustomers=(data.customerIds||[]).map(id=>(window.__mockFavoriteCustomers||[]).find(c=>c.customerId===id)).filter(Boolean);
      return {ok:true,data:data,message:'จัดลำดับร้านค้าโปรดแล้ว'};
    case 'getProductPreferences':
      window.__mockFavoriteProducts=window.__mockFavoriteProducts||[];
      window.__mockPinnedProducts=window.__mockPinnedProducts||[];
      return {ok:true,data:{favorites:window.__mockFavoriteProducts,pinned:window.__mockPinnedProducts}};
    case 'addFavoriteProduct':
      window.__mockFavoriteProducts=window.__mockFavoriteProducts||[];
      if(window.__mockFavoriteProducts.length>=20)return {ok:false,message:'Maximum favorite products reached'};
      if(!window.__mockFavoriteProducts.some(p=>mockProductMatchesReference(p,data.productId))){const product=findMockProductByReference(data.productId);if(product)window.__mockFavoriteProducts.push(Object.assign({},product,{isFavoriteProduct:true}));}
      return {ok:true,data:data,message:'Favorite product saved'};
    case 'removeFavoriteProduct':
      window.__mockFavoriteProducts=(window.__mockFavoriteProducts||[]).filter(p=>!mockProductMatchesReference(p,data.productId));
      return {ok:true,data:data,message:'Favorite product removed'};
    case 'addPinnedProduct':
      window.__mockPinnedProducts=window.__mockPinnedProducts||[];
      if(window.__mockPinnedProducts.length>=5)return {ok:false,message:'Maximum pinned products reached'};
      if(!window.__mockPinnedProducts.some(p=>mockProductMatchesReference(p,data.productId))){const product=findMockProductByReference(data.productId);if(product)window.__mockPinnedProducts.push(Object.assign({},product,{isPinnedProduct:true,pinnedSortOrder:window.__mockPinnedProducts.length+1}));}
      return {ok:true,data:data,message:'Pinned product saved'};
    case 'removePinnedProduct':
      window.__mockPinnedProducts=(window.__mockPinnedProducts||[]).filter(p=>!mockProductMatchesReference(p,data.productId)).map((p,i)=>Object.assign({},p,{pinnedSortOrder:i+1}));
      return {ok:true,data:data,message:'Pinned product removed'};
    case 'reorderPinnedProducts':
      window.__mockPinnedProducts=(data.productIds||[]).map((id,i)=>{const product=(window.__mockPinnedProducts||[]).find(p=>mockProductMatchesReference(p,id));return product?Object.assign({},product,{pinnedSortOrder:i+1}):null;}).filter(Boolean);
      return {ok:true,data:data,message:'Pinned products reordered'};
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
window.apiRequest = apiRequest;
window.apiPost = apiPost;
window.apiJsonpGet = apiJsonpGet;
window.jsonpApi = apiJsonpGet;
window.setCache = setCache;
window.getCache = getCache;
window.clearCache = clearCache;
window.invalidateBootstrapApiCache = invalidateBootstrapApiCache;
window.CACHE_KEYS = CACHE_KEYS;
window.clearQuotationCache = clearQuotationCache;
