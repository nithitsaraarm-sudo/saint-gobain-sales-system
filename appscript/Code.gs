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

function getBootstrapData(payload) {
  const timer = startPerformanceTimer('bootstrap');
  try {
    const auth = requireApiUser(payload);
    if (!auth.ok) {
      return auth;
    }
    const currentUser = auth.data;
    const permissions = getUserPermissions(currentUser);
    const cacheKey = 'bootstrap:dashboard:v2:' + String(currentUser.userId || currentUser.username || 'anon');
    const cached = getServerCache(cacheKey);
    if (cached) {
      endPerformanceTimer(timer, 'cache=hit');
      return success(cached);
    }
    const env = getCurrentEnvironment();

    const allQuotes = getBootstrapQuoteHistoryRows(200);
    const quotes = filterQuotesForUser(allQuotes, currentUser);
    const quoteLines = getBootstrapQuoteLineRows(quotes);
    const data = {
      environment: env,
      sheetInitialized: true,
      user: currentUser,
      permissions: permissions,
      settings: getSystemSettings(),
      defaultSettings: {
        companyName: 'SAINT-GOBAIN',
        appName: 'SALES SYSTEM',
        welcomeText: 'เริ่มต้นวันใหม่อย่างมีประสิทธิภาพนะคะ',
        vatRate: 7
      },
      counts: {
        customers: countSheetDataRows(CUSTOMERS_SHEET),
        products: countSheetDataRows(SHEET_NAMES.PRODUCTS)
      },
      quotes: quotes.slice(0, 50),
      quoteLines: quoteLines
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

function filterQuotesForUser(quotes, user) {
  const list = Array.isArray(quotes) ? quotes : [];
  if (hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.VIEWER])) {
    return list;
  }
  if (hasRole(user, [USER_ROLES.SALES])) {
    const userId = String(user && user.userId || '').trim().toLowerCase();
    const username = String(user && user.username || '').trim().toLowerCase();
    return list.filter(function (quote) {
      const createdById = String(quote.createdById || quote.updatedById || '').trim().toLowerCase();
      const createdBy = String(quote.createdBy || quote.updatedBy || '').trim().toLowerCase();
      return (userId && createdById === userId) || (username && createdBy === username);
    });
  }
  return [];
}

function getBootstrapQuoteHistoryRows(limit) {
  try {
    const result = getSheetData(QUOTE_HISTORY_SHEET);
    if (!result.ok || !Array.isArray(result.data)) {
      return [];
    }
    const maxRows = Math.max(1, Number(limit || 50));
    return result.data.slice().sort(function (a, b) {
      return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    }).slice(0, maxRows);
  } catch (error) {
    logError('getBootstrapQuoteHistoryRows', error);
    return [];
  }
}

function getBootstrapQuoteLineRows(quotes) {
  try {
    const quoteList = Array.isArray(quotes) ? quotes : [];
    if (!quoteList.length) {
      return [];
    }
    const quoteMap = {};
    quoteList.forEach(function (quote) {
      const quoteId = String((quote && quote.quoteId) || '').trim();
      const quoteNo = String((quote && quote.quoteNo) || '').trim();
      if (quoteId) quoteMap[quoteId.toLowerCase()] = true;
      if (quoteNo) quoteMap[quoteNo.toLowerCase()] = true;
    });
    const result = getSheetData(QUOTE_LINES_SHEET);
    if (!result.ok || !Array.isArray(result.data)) {
      return [];
    }
    return result.data.filter(function (line) {
      const quoteId = String((line && line.quoteId) || '').trim().toLowerCase();
      return quoteMap[quoteId];
    }).slice(0, 1000);
  } catch (error) {
    logError('getBootstrapQuoteLineRows', error);
    return [];
  }
}

function updateSettings(payload) {
  try {
    const auth = requireApiUser(payload);
    if (!auth.ok) return auth;
    if (!hasRole(auth.data, [USER_ROLES.SUPER_ADMIN])) {
      return forbidden('Insufficient permission');
    }
    const saved = saveSystemSettings(payload || {}, auth.data);
    if (!saved.ok) return saved;
    clearServerCache('bootstrap:dashboard:v2:' + String(auth.data.userId || auth.data.username || 'anon'));
    return success(saved.data, 'Settings saved');
  } catch (error) {
    logError('updateSettings', error);
    return fail(error && error.message ? error.message : 'Failed to update settings');
  }
}

function getDefaultSystemSettings() {
  return {
    companyName: 'SAINT-GOBAIN',
    appName: 'SALES SYSTEM',
    welcomeText: '',
    greetingMorning: '',
    greetingAfternoon: '',
    greetingEvening: '',
    greetingNight: '',
    vatRate: 7
  };
}

function getSystemSettings() {
  try {
    ensureSheet(SETTINGS_SHEET, getHeadersForSheet(SETTINGS_SHEET));
    const result = getSheetData(SETTINGS_SHEET);
    const settings = getDefaultSystemSettings();
    if (result.ok && Array.isArray(result.data)) {
      result.data.forEach(function (row) {
        const key = String(row.key || '').trim();
        if (key) settings[key] = row.value;
      });
    }
    settings.vatRate = parseNumericValue(settings.vatRate || 7) || 7;
    return settings;
  } catch (error) {
    logError('getSystemSettings', error);
    return getDefaultSystemSettings();
  }
}

function saveSystemSettings(payload, user) {
  try {
    const allowedKeys = ['companyName', 'appName', 'welcomeText', 'greetingMorning', 'greetingAfternoon', 'greetingEvening', 'greetingNight', 'vatRate'];
    const sheet = ensureSheet(SETTINGS_SHEET, getHeadersForSheet(SETTINGS_SHEET));
    if (!sheet) return fail('Unable to access Settings sheet');
    ensureSettingsSheetColumns_(sheet);
    const existing = getSheetData(SETTINGS_SHEET);
    const rows = existing.ok && Array.isArray(existing.data) ? existing.data : [];
    const existingKeys = {};
    rows.forEach(function (row) {
      const key = String(row.key || '').trim();
      if (key) existingKeys[key] = true;
    });
    const now = new Date().toISOString();
    allowedKeys.forEach(function (key) {
      if (payload[key] === undefined) return;
      const value = key === 'vatRate' ? String(parseNumericValue(payload[key] || 7) || 7) : String(payload[key] || '').trim();
      const row = { key: key, value: value, updatedAt: now, updatedBy: user.userId || user.username || '' };
      if (existingKeys[key]) {
        updateRowById(SETTINGS_SHEET, 'key', key, row);
      } else {
        appendRow(SETTINGS_SHEET, row);
      }
    });
    return success(getSystemSettings(), 'Settings saved');
  } catch (error) {
    logError('saveSystemSettings', error);
    return fail(error && error.message ? error.message : 'Failed to save settings');
  }
}

function ensureSettingsSheetColumns_(sheet) {
  try {
    const requiredHeaders = getHeadersForSheet(SETTINGS_SHEET);
    var headers = getHeaders(sheet);
    if (!headers.length) {
      sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
      return requiredHeaders;
    }
    var changed = false;
    requiredHeaders.forEach(function (header) {
      if (headers.indexOf(header) < 0) {
        headers.push(header);
        changed = true;
      }
    });
    if (changed) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    return headers;
  } catch (error) {
    logError('ensureSettingsSheetColumns_', error);
    return [];
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
    const rawBody = e && e.postData && e.postData.contents ? e.postData.contents : '';
    if (!rawBody) {
      return ContentService.createTextOutput(JSON.stringify(validationError('Request body is required'))).setMimeType(ContentService.MimeType.JSON);
    }
    var body = {};
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      return ContentService.createTextOutput(JSON.stringify(validationError('Invalid JSON request body'))).setMimeType(ContentService.MimeType.JSON);
    }
    const action = String(body.action || '').trim();
    if (!action) {
      return ContentService.createTextOutput(JSON.stringify(validationError('action is required'))).setMimeType(ContentService.MimeType.JSON);
    }
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
