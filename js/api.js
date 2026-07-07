const APP_ENV = String(window.APP_ENV || 'production').trim().toLowerCase();
const API_MOCK_MODE = APP_ENV === 'development';
const GAS_WEB_APP_URL =
'https://script.google.com/macros/s/AKfycbyuhRP2aIYI11vzMsIzGr2ncuhrflHb1u9flm_OwjpjZOJOTXvAg1HQu4iq62ZwjJn3RQ/exec';

function callApi(action, payload) {
  const normalizedAction = String(action || '').trim();
  const body = payload || {};

  if (API_MOCK_MODE) {
    return Promise.resolve(mockApi(normalizedAction, body));
  }

  return fetchApi(normalizedAction, body).catch(function () {
    return jsonpApi(normalizedAction, body);
  });
}

function gas(action, payload) {
  return callApi(action, payload);
}

function fetchApi(action, payload) {
  return fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: action,
      payload: payload || {}
    })
  }).then(function (response) {
    if (response.type === 'opaque') {
      return { ok: true, data: null, message: 'Request sent' };
    }
    return response.json();
  });
}

function jsonpApi(action, payload) {
  return new Promise(function (resolve, reject) {
    const callbackName = '__sgApiCallback_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    const script = document.createElement('script');
    const timeout = window.setTimeout(function () {
      cleanup();
      reject({ ok: false, message: 'API request timeout' });
    }, 30000);

    function cleanup() {
      window.clearTimeout(timeout);
      try {
        delete window[callbackName];
      } catch (error) {
        window[callbackName] = undefined;
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    window[callbackName] = function (response) {
      cleanup();
      resolve(response);
    };

    script.onerror = function () {
      cleanup();
      reject({ ok: false, message: 'API request failed' });
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
      return { ok: true, data: { settings: { companyName: 'SAINT-GOBAIN', appName: 'SALES SYSTEM', welcomeText: 'เริ่มต้นวันใหม่อย่างมีประสิทธิภาพนะคะ', vatRate: 7 }, customers: [], products: [], promotions: [], quotes: [] } };
    case 'customers':
      return { ok: true, data: [] };
    case 'products':
      return { ok: true, data: [] };
    case 'discount':
      return { ok: true, data: { discountPercent: 0, discountGroup: '', groupCode: data.groupCode || '', customerId: data.customerId || '' } };
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
