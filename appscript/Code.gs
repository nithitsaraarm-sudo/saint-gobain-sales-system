// Main Apps Script entry point for Saint-Gobain Sales System.
function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = String(params.action || '').trim();

    if (action) {
      const payload = params.payload ? JSON.parse(params.payload) : {};
      const result = api(action, payload);
      return createApiOutput(result, params.callback);
    }

    return createApiOutput(success({
      service: 'Saint-Gobain Sales System API',
      status: 'API Running',
      version: APP_VERSION
    }, 'API Running'), params.callback);
  } catch (error) {
    logError('doGet', error);
    return createApiOutput(fail(error && error.message ? error.message : 'API health check failed'), e && e.parameter ? e.parameter.callback : '');
  }
}

function getBootstrapData() {
  try {
    const initResult = createDefaultSheets();
    const env = getCurrentEnvironment();
    const usersResult = getSheetData(getUsersSheetName());
    const customersResult = getSheetData(CUSTOMERS_SHEET);
    const productsResult = getSheetData(SHEET_NAMES.PRODUCTS);
    ensureQuotationSheets();
    const quotesResult = getSheetData(QUOTE_HISTORY_SHEET);
    const quotesData = quotesResult.ok && Array.isArray(quotesResult.data) ? quotesResult.data : [];

    const customers = customersResult.ok && Array.isArray(customersResult.data) ? customersResult.data.map(normalizeCustomerObject).filter(isActiveCustomer) : [];
    const products = productsResult.ok && Array.isArray(productsResult.data) ? productsResult.data.map(normalizeProductObject).filter(filterActiveProductObject) : [];
    const quotes = quotesData.map(function (row) {
      const customer = customers.find(function (c) {
        return String(c.customerId || '').trim() === String(row.customerId || '').trim();
      }) || {};
      return Object.assign({}, row, {
        quoteNo: String(row.quoteNo || row.quoteId || '').trim(),
        total: parseNumericValue(row.grandTotal || row.total || row.subtotal),
        customerName: String(row.customerName || customer.customerName || '').trim()
      });
    }).sort(function (a, b) {
      return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    }).slice(0, 50);

    return success({
      environment: env,
      users: usersResult.ok && Array.isArray(usersResult.data) ? usersResult.data : [],
      sheetInitialized: initResult.ok,
      settings: {
        companyName: 'SAINT-GOBAIN',
        appName: 'SALES SYSTEM',
        welcomeText: 'เริ่มต้นวันใหม่อย่างมีประสิทธิภาพนะคะ',
        vatRate: 7
      },
      customers: customers,
      products: products,
      promotions: [],
      quotes: quotes
    });
  } catch (error) {
    logError('getBootstrapData', error);
    return fail(error && error.message ? error.message : 'Bootstrap failed');
  }
}

function updateSettings(payload) {
  try {
    return success(payload || {}, 'Settings saved');
  } catch (error) {
    logError('updateSettings', error);
    return fail(error && error.message ? error.message : 'Failed to update settings');
  }
}

function savePromotion(payload) {
  try {
    return success(payload || {}, 'Promotion saved');
  } catch (error) {
    logError('savePromotion', error);
    return fail(error && error.message ? error.message : 'Failed to save promotion');
  }
}

function doPost(e) {
  try {
    const rawBody = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const body = JSON.parse(rawBody);
    const action = String(body.action || '').trim();
    const payload = body.payload || {};
    const result = api(action, payload);

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    logError('doPost', error);
    return ContentService.createTextOutput(JSON.stringify(fail(error && error.message ? error.message : 'Request processing failed'))).setMimeType(ContentService.MimeType.JSON);
  }
}

function createApiOutput(result, callback) {
  const json = JSON.stringify(result);
  const callbackName = String(callback || '').trim();

  if (callbackName && /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callbackName)) {
    return ContentService
      .createTextOutput(callbackName + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
