const APP_ENV = String(window.APP_ENV || 'production').trim().toLowerCase();
const API_MOCK_MODE = APP_ENV === 'development';
const API_ACTIONS = ['login','demoLogin','bootstrap','customers','products','discount','quotation','createQuotation','loadQuotation','duplicateQuotation','cancelQuotation','getQuotationHistory'];

function callApi(action, payload) {
  return new Promise(function (resolve, reject) {
    const normalizedAction = String(action || '').trim();
    const body = payload || {};

    if (API_MOCK_MODE || typeof google === 'undefined' || !google || !google.script || typeof google.script.run === 'undefined') {
      return resolve(mockApi(normalizedAction, body));
    }

    try {
      if (API_ACTIONS.indexOf(normalizedAction) >= 0) {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(function (error) {
            reject({ ok: false, message: String(error && error.message ? error.message : error || 'API error') });
          })
          .api(normalizedAction, body);
      } else {
        const runner = google.script.run.withSuccessHandler(resolve).withFailureHandler(function (error) {
          reject({ ok: false, message: String(error && error.message ? error.message : error || 'API error') });
        });
        if (typeof runner[normalizedAction] === 'function') {
          runner[normalizedAction](body);
        } else {
          runner.api(normalizedAction, body);
        }
      }
    } catch (error) {
      reject({ ok: false, message: String(error && error.message ? error.message : 'API invocation failed') });
    }
  });
}

function gas(action, payload) {
  return callApi(action, payload);
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
