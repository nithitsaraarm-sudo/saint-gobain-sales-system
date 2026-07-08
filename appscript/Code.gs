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
  const timer = startPerformanceTimer('bootstrap');
  try {
    const cacheKey = 'bootstrap:lightweight';
    const cached = getServerCache(cacheKey);
    if (cached) {
      endPerformanceTimer(timer, 'cache=hit');
      return success(cached);
    }
    const env = getCurrentEnvironment();

    const data = {
      environment: env,
      sheetInitialized: true,
      settings: {
        companyName: 'SAINT-GOBAIN',
        appName: 'SALES SYSTEM',
        welcomeText: 'เริ่มต้นวันใหม่อย่างมีประสิทธิภาพนะคะ',
        vatRate: 7
      },
      counts: {
        customers: countSheetDataRows(CUSTOMERS_SHEET),
        products: countSheetDataRows(SHEET_NAMES.PRODUCTS)
      }
    };
    setServerCache(cacheKey, data, 300);
    endPerformanceTimer(timer, 'cache=miss');
    return success(data);
  } catch (error) {
    endPerformanceTimer(timer, 'error=true');
    logError('getBootstrapData', error);
    return fail(error && error.message ? error.message : 'Bootstrap failed');
  }
}

function countSheetDataRows(sheetName) {
  try {
    const sheet = getSheet(sheetName);
    if (!sheet) {
      return 0;
    }
    return Math.max(0, sheet.getLastRow() - 1);
  } catch (error) {
    logError('countSheetDataRows', error);
    return 0;
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
