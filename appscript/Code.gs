// Main Apps Script entry point for Saint-Gobain Sales System.
function doGet() {
  try {
    return HtmlService.createHtmlOutputFromFile('index');
  } catch (error) {
    logError('doGet', error);
    return HtmlService.createHtmlOutput('<p>Failed to load application</p>');
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

    const customers = customersResult.ok && Array.isArray(customersResult.data) ? customersResult.data : [];
    const products = productsResult.ok && Array.isArray(productsResult.data) ? productsResult.data : [];
    const quotes = quotesData.map(function (row) {
      const customer = customers.find(function (c) {
        return String(c.customerId || '').trim() === String(row.customerId || '').trim();
      }) || {};
      return Object.assign({}, row, {
        total: parseNumericValue(row.grandTotal || row.total || row.subtotal),
        customerName: String(customer.customerName || '').trim()
      });
    });

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

function loginUser(username, password) {
  return loginUserCore(username, password);
}

function demoLogin() {
  return demoLoginCore();
}

function registerUser(payload) {
  return registerUserCore(payload);
}

function resetPassword(phone, username, newPassword) {
  return resetPasswordCore(phone, username, newPassword);
}

function updateProfile(payload) {
  return updateProfileCore(payload);
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

function getCurrentEnvironment() {
  return getCurrentEnvironmentCore();
}

function createDefaultSheets() {
  return createDefaultSheetsCore();
}

function doPost(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = String(params.action || params.mode || 'getBootstrapData');
    const payload = params.payload ? JSON.parse(params.payload) : {};
    let result;

    switch (action) {
      case 'getBootstrapData':
        result = getBootstrapData();
        break;
      case 'loginUser':
        result = loginUser(params.username, params.password);
        break;
      case 'demoLogin':
        result = demoLogin();
        break;
      case 'registerUser':
        result = registerUser(payload);
        break;
      case 'resetPassword':
        result = resetPassword(params.phone, params.username, params.newPassword);
        break;
      case 'updateProfile':
        result = updateProfile(payload);
        break;
      default:
        result = fail('Unsupported action');
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    logError('doPost', error);
    return ContentService.createTextOutput(JSON.stringify(fail(error && error.message ? error.message : 'Request processing failed'))).setMimeType(ContentService.MimeType.JSON);
  }
}
