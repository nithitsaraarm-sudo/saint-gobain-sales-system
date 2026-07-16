// Main Apps Script entry point for Saint-Gobain Sales System.
function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = String(params.action || '').trim();
    const getBlockedWriteActions = [
      'login', 'demoLogin', 'logout', 'changePassword',
      'createUser', 'updateUser', 'register', 'resetPassword',
      'updateProfile', 'uploadProfileImage',
      'saveCustomer', 'updateCustomer',
      'addFavoriteCustomer', 'removeFavoriteCustomer', 'reorderFavoriteCustomers',
      'addFavoriteProduct', 'removeFavoriteProduct',
      'addPinnedProduct', 'removePinnedProduct', 'reorderPinnedProducts',
      'saveProduct', 'savePromotion',
      'updateSettings', 'updateSystemIdentitySettings',
      'createQuotation', 'duplicateQuotation', 'cancelQuotation',
      'updateQuotation', 'quotation', 'saveQuotation'
    ];

    if (action) {
      if (getBlockedWriteActions.indexOf(action) >= 0) {
        return createApiOutput(validationError('Write action requires POST'), params.callback);
      }
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
    const settings = getSystemSettings();
    const cacheKey = 'bootstrap:dashboard:v3:' + String(currentUser.userId || currentUser.username || 'anon') + ':' + String(settings.cacheVersion || settings.identityUpdatedAt || '');
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
      settings: filterSettingsForUser_(settings, currentUser),
      publicSettings: getPublicSystemSettingsData_(),
      defaultSettings: {
        companyName: getDefaultSystemSettings().companyName,
        appName: getDefaultSystemSettings().appName,
        systemName: getDefaultSystemSettings().systemName,
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

function getSuperAdminOnlySystemIdentityError_() {
  return fail('คุณไม่มีสิทธิ์แก้ไขชื่อบริษัทและชื่อระบบ', 'SUPER_ADMIN_ONLY');
}

function requireSuperAdminForSystemIdentity_(payload) {
  const auth = requireApiUser(payload);
  if (!auth.ok) return auth;
  if (!hasRole(auth.data, [USER_ROLES.SUPER_ADMIN])) {
    logActivity(String(auth.data.userId || ''), 'SYSTEM_IDENTITY_UPDATE_DENIED', 'role=' + String(auth.data.role || '') + ';oldValue=;newValue=;result=SUPER_ADMIN_ONLY');
    return getSuperAdminOnlySystemIdentityError_();
  }
  return auth;
}

function getPublicSystemSettingsData_() {
  const settings = getSystemSettings();
  const defaults = getDefaultSystemSettings();
  const companyName = String(settings.companyName || defaults.companyName).trim();
  const systemName = String(settings.systemName || settings.appName || defaults.systemName).trim();
  return {
    companyName: companyName || defaults.companyName,
    systemName: systemName || defaults.systemName,
    appName: systemName || defaults.appName
  };
}

function getPublicSystemSettings() {
  try {
    return success(getPublicSystemSettingsData_(), 'Public system settings loaded');
  } catch (error) {
    logError('getPublicSystemSettings', error);
    const defaults = getDefaultSystemSettings();
    return success({
      companyName: defaults.companyName,
      systemName: defaults.systemName,
      appName: defaults.appName
    }, 'Public system settings fallback');
  }
}

function getSystemIdentitySettings(payload) {
  try {
    const auth = requireSuperAdminForSystemIdentity_(payload);
    if (!auth.ok) return auth;
    return success(getPublicSystemSettingsData_(), 'System identity loaded');
  } catch (error) {
    logError('getSystemIdentitySettings', error);
    return fail(error && error.message ? error.message : 'Failed to load system identity settings');
  }
}

function updateSystemIdentitySettings(payload) {
  try {
    const auth = requireSuperAdminForSystemIdentity_(payload);
    if (!auth.ok) return auth;
    const saved = saveSystemIdentitySettings_(payload || {}, auth.data);
    if (!saved.ok) return saved;
    invalidateSystemSettingsCache();
    return success(saved.data, 'บันทึกชื่อบริษัทและชื่อระบบเรียบร้อยแล้ว');
  } catch (error) {
    logError('updateSystemIdentitySettings', error);
    return fail('ไม่สามารถบันทึกชื่อบริษัทและชื่อระบบได้ กรุณาลองใหม่อีกครั้ง');
  }
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
    invalidateSystemSettingsCache();
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
    systemName: 'SALES SYSTEM',
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
        if (!key) return;
        settings[key] = row.value;
        const updatedAt = String(row.updatedAt || '').trim();
        if (updatedAt && (!settings.cacheVersion || updatedAt > settings.cacheVersion)) {
          settings.cacheVersion = updatedAt;
        }
      });
    }
    settings.companyName = String(settings.COMPANY_NAME_EN || settings.companyName || getDefaultSystemSettings().companyName).trim() || getDefaultSystemSettings().companyName;
    settings.systemName = String(settings.SYSTEM_NAME || settings.systemName || settings.appName || getDefaultSystemSettings().systemName).trim() || getDefaultSystemSettings().systemName;
    settings.appName = settings.systemName;
    settings.identityUpdatedAt = settings.cacheVersion || '';
    settings.vatRate = parseNumericValue(settings.vatRate || 7) || 7;
    return settings;
  } catch (error) {
    logError('getSystemSettings', error);
    return getDefaultSystemSettings();
  }
}

function saveSystemSettings(payload, user) {
  try {
    const allowedKeys = ['welcomeText', 'greetingMorning', 'greetingAfternoon', 'greetingEvening', 'greetingNight', 'vatRate'];
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
      upsertSystemSettingRow_(sheet, existingKeys, key, value, {
        type: key === 'vatRate' ? 'NUMBER' : 'STRING',
        category: key === 'vatRate' ? 'SYSTEM' : 'SYSTEM_GREETING',
        isPublic: 'FALSE',
        updatedAt: now,
        updatedBy: user.userId || user.username || ''
      });
    });
    return success(getSystemSettings(), 'Settings saved');
  } catch (error) {
    logError('saveSystemSettings', error);
    return fail(error && error.message ? error.message : 'Failed to save settings');
  }
}

function validateSystemIdentityText_(value, label) {
  const fieldLabel = label || 'value';
  const text = String(value || '').trim();
  if (!text) {
    return validationError(fieldLabel + ' is required');
  }
  if (text.length > 100) {
    return validationError(fieldLabel + ' must be 100 characters or less');
  }
  if (/^[=+\-@]/.test(text)) {
    return validationError(fieldLabel + ' is not allowed');
  }
  if (/[<>]/.test(text) || /<\/?[a-z][\s\S]*>/i.test(text) || /script/i.test(text)) {
    return validationError(fieldLabel + ' must not contain HTML or script');
  }
  return success(text);
}

function getSystemSettingRowMap_(rows) {
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    const key = String(row.key || '').trim();
    if (key) map[key] = row;
  });
  return map;
}

function upsertSystemSettingRow_(sheet, existingKeys, key, value, meta) {
  const data = meta || {};
  const row = {
    key: key,
    value: value,
    type: data.type || 'STRING',
    category: data.category || 'SYSTEM',
    isPublic: data.isPublic || 'FALSE',
    updatedAt: data.updatedAt || new Date().toISOString(),
    updatedBy: data.updatedBy || ''
  };
  if (existingKeys[key]) {
    return updateRowById(SETTINGS_SHEET, 'key', key, row);
  }
  const headers = getHeaders(sheet);
  sheet.appendRow(headers.map(function (header) {
    return row[header] !== undefined ? row[header] : '';
  }));
  existingKeys[key] = true;
  clearSheetDataCache(SETTINGS_SHEET);
  return success(row, 'Setting appended');
}

function saveSystemIdentitySettings_(payload, user) {
  try {
    const companyResult = validateSystemIdentityText_(payload && payload.companyName, 'companyName');
    if (!companyResult.ok) return companyResult;
    const systemResult = validateSystemIdentityText_(payload && (payload.systemName || payload.appName), 'systemName');
    if (!systemResult.ok) return systemResult;

    const companyName = companyResult.data;
    const systemName = systemResult.data;
    const previous = getPublicSystemSettingsData_();
    const sheet = ensureSheet(SETTINGS_SHEET, getHeadersForSheet(SETTINGS_SHEET));
    if (!sheet) return fail('Unable to access Settings sheet');
    ensureSettingsSheetColumns_(sheet);
    const existing = getSheetData(SETTINGS_SHEET);
    const rows = existing.ok && Array.isArray(existing.data) ? existing.data : [];
    const rowMap = getSystemSettingRowMap_(rows);
    const existingKeys = {};
    Object.keys(rowMap).forEach(function (key) {
      existingKeys[key] = true;
    });
    const now = new Date().toISOString();
    const updatedBy = String(user && (user.userId || user.username) || '').trim();
    upsertSystemSettingRow_(sheet, existingKeys, 'COMPANY_NAME_EN', companyName, {
      type: 'STRING',
      category: 'SYSTEM_IDENTITY',
      isPublic: 'TRUE',
      updatedAt: now,
      updatedBy: updatedBy
    });
    upsertSystemSettingRow_(sheet, existingKeys, 'SYSTEM_NAME', systemName, {
      type: 'STRING',
      category: 'SYSTEM_IDENTITY',
      isPublic: 'TRUE',
      updatedAt: now,
      updatedBy: updatedBy
    });
    const role = String(user && user.role || '').trim();
    logActivity(updatedBy, 'SYSTEM_IDENTITY_UPDATED', 'role=' + role + ';oldValue=' + previous.companyName + '|' + previous.systemName + ';newValue=' + companyName + '|' + systemName + ';result=SUCCESS');
    if (normalizeString(previous.companyName) !== normalizeString(companyName)) {
      logActivity(updatedBy, 'COMPANY_NAME_UPDATED', 'role=' + role + ';oldValue=' + previous.companyName + ';newValue=' + companyName + ';result=SUCCESS');
    }
    if (normalizeString(previous.systemName) !== normalizeString(systemName)) {
      logActivity(updatedBy, 'SYSTEM_NAME_UPDATED', 'role=' + role + ';oldValue=' + previous.systemName + ';newValue=' + systemName + ';result=SUCCESS');
    }
    return success({
      companyName: companyName,
      systemName: systemName,
      appName: systemName,
      updatedAt: now,
      updatedBy: updatedBy
    }, 'System identity saved');
  } catch (error) {
    logError('saveSystemIdentitySettings_', error);
    return fail(error && error.message ? error.message : 'Failed to save system identity settings');
  }
}

function filterSettingsForUser_(settings, user) {
  const source = settings && typeof settings === 'object' ? settings : getDefaultSystemSettings();
  const filtered = Object.assign({}, source);
  filtered.companyName = String(source.companyName || source.COMPANY_NAME_EN || getDefaultSystemSettings().companyName).trim() || getDefaultSystemSettings().companyName;
  filtered.systemName = String(source.systemName || source.SYSTEM_NAME || source.appName || getDefaultSystemSettings().systemName).trim() || getDefaultSystemSettings().systemName;
  filtered.appName = filtered.systemName;
  if (!hasRole(user, [USER_ROLES.SUPER_ADMIN])) {
    const allowedKeys = ['companyName', 'systemName', 'appName', 'welcomeText', 'greetingMorning', 'greetingAfternoon', 'greetingEvening', 'greetingNight', 'vatRate', 'salesTarget', 'target', 'monthlyTarget'];
    Object.keys(filtered).forEach(function (key) {
      if (allowedKeys.indexOf(key) < 0) {
        delete filtered[key];
      }
    });
  }
  return filtered;
}

function invalidateSystemSettingsCache() {
  try {
    clearServerCache('publicSystemSettings:v1');
    clearServerCache('bootstrap:lightweight');
    return success(true, 'System settings cache invalidated');
  } catch (error) {
    logWarning('invalidateSystemSettingsCache', error && error.message ? error.message : error);
    return fail(error && error.message ? error.message : 'Failed to invalidate system settings cache');
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
