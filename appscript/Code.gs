// Main Apps Script entry point for Saint-Gobain Sales System.
function isPublicGetApiAction_(action) {
  return ['getPublicSystemSettings'].indexOf(String(action || '').trim()) >= 0;
}

function hasSensitiveApiCredentialField_(key) {
  return /^(password|currentPassword|newPassword|confirmPassword|sessionToken|sg_token|token|authorization)$/i.test(String(key || '').trim());
}

function containsSensitiveApiCredential_(value, depth) {
  const level = Number(depth || 0);
  if (!value || level > 6) return false;
  if (typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    return value.some(function (item) {
      return containsSensitiveApiCredential_(item, level + 1);
    });
  }
  return Object.keys(value).some(function (key) {
    return hasSensitiveApiCredentialField_(key) || containsSensitiveApiCredential_(value[key], level + 1);
  });
}

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
      'updateQuotation', 'quotation', 'saveQuotation',
      'saveSalesTarget', 'updateSalesTarget', 'setSalesTargetStatus'
    ];

    if (action) {
      if (params.callback && !isPublicGetApiAction_(action)) {
        return createApiOutput(forbidden('JSONP is only available for public API actions'), '');
      }
      const payload = params.payload ? JSON.parse(params.payload) : {};
      if (containsSensitiveApiCredential_(params) || containsSensitiveApiCredential_(payload)) {
        return createApiOutput(validationError('Credentials must not be sent via GET'), '');
      }
      if (getBlockedWriteActions.indexOf(action) >= 0) {
        return createApiOutput(validationError('Write action requires POST'), '');
      }
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
  const auth = requireApiUser(payload);
  if (!auth.ok) {
    return auth;
  }
  return getBootstrapDataCore_(payload, auth.data);
}

function getBootstrapDataForAuthenticatedUser_(payload, currentUser) {
  if (!currentUser || !String(currentUser.userId || currentUser.username || '').trim()) {
    return getBootstrapData(payload);
  }
  return getBootstrapDataCore_(payload, currentUser);
}

function getBootstrapDataCore_(payload, currentUser) {
  const timer = startPerformanceTimer('bootstrap');
  const trace = typeof createBackendPerformanceTrace_ === 'function' ? createBackendPerformanceTrace_('bootstrap') : null;
  var outcome = 'ERROR';
  try {
    const force = payload && typeof payload === 'object' && payload.force === true;
    if (trace) markBackendPerformanceStep_(trace, 'auth_ready', {
      role: currentUser.role,
      userId: currentUser.userId ? 'present' : '',
      authMs: payload && typeof payload === 'object' ? payload._authMs : ''
    });
    const permissions = getUserPermissions(currentUser);
    if (trace) markBackendPerformanceStep_(trace, 'permissions_resolved', { canViewPromotions: permissions.canViewPromotions });
    const settings = getSystemSettings();
    if (trace) markBackendPerformanceStep_(trace, 'settings_loaded', { cacheVersion: settings.cacheVersion || settings.identityUpdatedAt || '' });
    const salesTargetCacheVersion = typeof getSalesTargetCacheVersion_ === 'function' ? getSalesTargetCacheVersion_() : '';
    if (trace) markBackendPerformanceStep_(trace, 'sales_target_cache_version_loaded', { version: salesTargetCacheVersion || '' });
    const cacheKey = 'bootstrap:dashboard:v4:' + String(currentUser.userId || currentUser.username || 'anon') + ':' + String(settings.cacheVersion || settings.identityUpdatedAt || '') + ':' + String(salesTargetCacheVersion || '');
    const cached = force ? null : getServerCache(cacheKey);
    if (trace) markBackendPerformanceStep_(trace, 'bootstrap_cache_checked', { cache: cached ? 'hit' : 'miss', force: force });
    if (cached) {
      endPerformanceTimer(timer, 'cache=hit');
      outcome = 'CACHE_HIT';
      return success(cached);
    }
    const env = getCurrentEnvironment();
    if (trace) markBackendPerformanceStep_(trace, 'environment_loaded');

    const allQuotes = getBootstrapQuoteHistoryRows(200);
    if (trace) markBackendPerformanceStep_(trace, 'quote_history_loaded', { rows: allQuotes.length });
    const quotes = filterQuotesForUser(allQuotes, currentUser);
    if (trace) markBackendPerformanceStep_(trace, 'quote_history_scoped', { rows: quotes.length });
    const quoteLines = getBootstrapQuoteLineRows(quotes);
    if (trace) markBackendPerformanceStep_(trace, 'quote_lines_loaded', { rows: quoteLines.length });
    const scopedCustomers = typeof getCustomers === 'function' ? getCustomers({ currentUser: currentUser }) : null;
    if (trace) markBackendPerformanceStep_(trace, 'customers_loaded', {
      ok: scopedCustomers && scopedCustomers.ok,
      rows: scopedCustomers && scopedCustomers.ok && Array.isArray(scopedCustomers.data) ? scopedCustomers.data.length : 0
    });
    const promotionsResult = permissions.canViewPromotions ? getPromotions({ currentUser: currentUser }) : success([]);
    if (trace) markBackendPerformanceStep_(trace, 'promotions_loaded', {
      ok: promotionsResult && promotionsResult.ok,
      rows: promotionsResult && promotionsResult.ok && Array.isArray(promotionsResult.data) ? promotionsResult.data.length : 0
    });
    const customerCount = scopedCustomers && scopedCustomers.ok && Array.isArray(scopedCustomers.data)
      ? scopedCustomers.data.length
      : countSheetDataRows(CUSTOMERS_SHEET);
    const productCount = countSheetDataRows(SHEET_NAMES.PRODUCTS);
    if (trace) markBackendPerformanceStep_(trace, 'counts_loaded', { customers: customerCount, products: productCount });
    const defaults = getDefaultSystemSettings();
    const salesTargetRows = typeof salesTargetRows_ === 'function' ? salesTargetRows_() : [];
    if (trace) markBackendPerformanceStep_(trace, 'sales_target_rows_loaded', { rows: salesTargetRows.length });
    const data = {
      environment: env,
      sheetInitialized: true,
      user: currentUser,
      permissions: permissions,
      settings: filterSettingsForUser_(settings, currentUser),
      publicSettings: getPublicSystemSettingsData_(settings, defaults),
      defaultSettings: {
        companyName: defaults.companyName,
        appName: defaults.appName,
        systemName: defaults.systemName,
        welcomeText: 'เริ่มต้นวันใหม่อย่างมีประสิทธิภาพนะคะ',
        announcementText: '',
        vatRate: 7
      },
      counts: {
        customers: customerCount,
        products: productCount
      },
      quotes: quotes.slice(0, 50),
      quoteLines: quoteLines,
      promotions: promotionsResult.ok && Array.isArray(promotionsResult.data) ? promotionsResult.data : [],
      effectiveSalesTarget: typeof resolveEffectiveSalesTarget_ === 'function'
        ? resolveEffectiveSalesTarget_(salesTargetRows, currentUser, typeof getDashboardEffectiveSalesTargetRequest_ === 'function' ? getDashboardEffectiveSalesTargetRequest_(currentUser) : { targetType: 'MONTHLY', periodYear: new Date().getFullYear(), periodMonth: new Date().getMonth() + 1, businessUnit: 'ALL' })
        : null
    };
    if (trace) markBackendPerformanceStep_(trace, 'response_built');
    setServerCache(cacheKey, data, 300);
    if (trace) markBackendPerformanceStep_(trace, 'bootstrap_cache_written');
    endPerformanceTimer(timer, 'cache=miss');
    outcome = 'CACHE_MISS';
    return success(data);
  } catch (error) {
    endPerformanceTimer(timer, 'error=true');
    logError('getBootstrapData', error);
    return fail(error && error.message ? error.message : 'Bootstrap failed');
  } finally {
    if (trace) endBackendPerformanceTrace_(trace, outcome);
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
  return list.filter(function (quote) {
    return canAccessQuotationRecord(user, quote).ok;
  });
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

function getPublicSystemSettingsData_(settingsOverride, defaultsOverride) {
  const settings = settingsOverride && typeof settingsOverride === 'object' ? settingsOverride : getSystemSettings();
  const defaults = defaultsOverride && typeof defaultsOverride === 'object' ? defaultsOverride : getDefaultSystemSettings();
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
    announcementText: '',
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

function validateAnnouncementText_(value) {
  const text = String(value === null || value === undefined ? '' : value).trim();
  if (text.length > 500) {
    return validationError('announcementText must be 500 characters or less');
  }
  if (/^[=+\-@]/.test(text)) {
    return validationError('announcementText must not begin with a spreadsheet formula character');
  }
  if (/[<>]/.test(text) || /<\/?[a-z][\s\S]*>/i.test(text) || /script/i.test(text)) {
    return validationError('announcementText must not contain HTML or script');
  }
  return success(text);
}

function saveSystemSettings(payload, user) {
  try {
    const data = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    if (data.announcementText !== undefined) {
      const announcementResult = validateAnnouncementText_(data.announcementText);
      if (!announcementResult.ok) return announcementResult;
      data.announcementText = announcementResult.data;
    }
    const allowedKeys = ['welcomeText', 'announcementText', 'greetingMorning', 'greetingAfternoon', 'greetingEvening', 'greetingNight', 'vatRate'];
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
      if (data[key] === undefined) return;
      const value = key === 'vatRate' ? String(parseNumericValue(data[key] || 7) || 7) : String(data[key] || '').trim();
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
    const allowedKeys = ['companyName', 'systemName', 'appName', 'welcomeText', 'announcementText', 'greetingMorning', 'greetingAfternoon', 'greetingEvening', 'greetingNight', 'vatRate', 'salesTarget', 'target', 'monthlyTarget'];
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

function sanitizePromotionText_(value, maxLength) {
  const text = String(value || '').replace(/[<>]/g, '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  const limit = maxLength || 200;
  return text.length > limit ? text.slice(0, limit) : text;
}

function normalizePromotionBrand_(value) {
  const text = String(value || '').trim().toUpperCase();
  if (text.indexOf('GYPROC') >= 0 || text === 'GYP') return 'Gyproc';
  if (text.indexOf('WEBER') >= 0 || text === 'WEB') return 'Weber';
  return '';
}

function parsePromotionActiveFlag_(value) {
  if (value === false) return false;
  const text = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
  if (!text) return true;
  if (text === 'false' || text === 'no' || text === '0' || text === 'inactive' || text === 'disabled') return false;
  return true;
}

function normalizePromotionObject_(row) {
  const source = row && typeof row === 'object' ? row : {};
  const promotionId = sanitizePromotionText_(source.promotionId || source.id || source.promoId, 80);
  const brand = normalizePromotionBrand_(source.brand || source.businessUnit || source.quoteType);
  const productName = sanitizePromotionText_(source.productName || source.itemName || source.name, 150);
  const description = sanitizePromotionText_(source.description || source.detail || source.notes, 300);
  const discountText = sanitizePromotionText_(source.discountText || source.promoText || source.promotionText, 150);
  const active = parsePromotionActiveFlag_(source.active !== undefined ? source.active : source.status);
  return Object.assign({}, source, {
    promotionId: promotionId,
    id: promotionId,
    brand: brand,
    productName: productName,
    description: description,
    discountText: discountText,
    active: active,
    status: active ? 'Active' : 'Inactive',
    createdAt: sanitizePromotionText_(source.createdAt, 80),
    updatedAt: sanitizePromotionText_(source.updatedAt, 80),
    updatedBy: sanitizePromotionText_(source.updatedBy, 80)
  });
}

function getPromotionIdentityKey_(promotion) {
  const item = normalizePromotionObject_(promotion);
  return [
    String(item.brand || '').trim().toLowerCase(),
    String(item.productName || '').trim().toLowerCase(),
    String(item.description || '').trim().toLowerCase(),
    String(item.discountText || '').trim().toLowerCase(),
    item.active === false ? 'inactive' : 'active'
  ].join('|');
}

function generatePromotionId_() {
  if (typeof generateId === 'function') {
    return generateId('PROMO');
  }
  return 'PROMO_' + new Date().getTime() + '_' + Math.floor(Math.random() * 10000);
}

function clearPromotionCaches_() {
  if (typeof clearSheetDataCache === 'function') {
    clearSheetDataCache(PROMOTIONS_SHEET);
  }
  clearServerCache('bootstrap:lightweight');
}

function getPromotions(payload) {
  try {
    const data = payload && typeof payload === 'object' ? payload : {};
    const auth = data.currentUser ? success(data.currentUser) : requireApiUser(data);
    if (!auth.ok) return auth;
    const permissions = getUserPermissions(auth.data);
    if (!permissions.canViewPromotions) {
      return forbidden('Insufficient permission');
    }
    const result = getSheetData(PROMOTIONS_SHEET);
    if (!result.ok) {
      return result;
    }
    const promotions = (Array.isArray(result.data) ? result.data : []).map(normalizePromotionObject_).filter(function (promotion) {
      return promotion.active !== false;
    });
    return success(promotions);
  } catch (error) {
    logError('getPromotions', error);
    return fail(error && error.message ? error.message : 'Failed to load promotions');
  }
}

function ensurePromotionSheetColumns_(sheet) {
  const requiredHeaders = getHeadersForSheet(PROMOTIONS_SHEET);
  var headers = getHeaders(sheet).map(function (header) {
    return String(header || '').trim();
  }).filter(function (header) {
    return header;
  });
  if (!headers.length) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return requiredHeaders.slice();
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
}

function getPromotionSheetRowsLocked_(sheet, headers) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), headers.length)).getDisplayValues();
  return values.map(function (rowValues, index) {
    const record = {};
    headers.forEach(function (header, columnIndex) {
      if (header) {
        record[header] = rowValues[columnIndex] || '';
      }
    });
    record._rowNumber = index + 2;
    record._rowValues = rowValues;
    return record;
  });
}

function savePromotion(payload) {
  var lock = null;
  try {
    const data = payload && typeof payload === 'object' ? payload : {};
    const auth = data.currentUser ? success(data.currentUser) : requireApiRole(data, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN]);
    if (!auth.ok) return auth;
    const permissions = getUserPermissions(auth.data);
    if (!permissions.canManagePromotions) {
      return forbidden('Insufficient permission');
    }
    const brand = normalizePromotionBrand_(data.brand || data.businessUnit);
    if (!brand) {
      return validationError('brand must be Weber or Gyproc');
    }
    const productName = sanitizePromotionText_(data.productName || data.itemName || data.name, 150);
    const discountText = sanitizePromotionText_(data.discountText || data.promoText || data.promotionText, 150);
    if (!productName) {
      return validationError('productName is required');
    }
    if (!discountText) {
      return validationError('discountText is required');
    }

    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const sheet = ensureSheet(PROMOTIONS_SHEET, getHeadersForSheet(PROMOTIONS_SHEET));
    if (!sheet) {
      return fail('Unable to access Promotions sheet');
    }
    const headers = ensurePromotionSheetColumns_(sheet);
    const existingRows = getPromotionSheetRowsLocked_(sheet, headers);
    const existingPromotions = existingRows.map(function (row) {
      return Object.assign(normalizePromotionObject_(row), {
        _rowNumber: row._rowNumber,
        _rowValues: row._rowValues
      });
    });
    const now = new Date().toISOString();
    const requestedId = sanitizePromotionText_(data.promotionId || data.id || data.promoId, 80);
    const active = parsePromotionActiveFlag_(data.active !== undefined ? data.active : data.status);
    const row = {
      promotionId: requestedId || generatePromotionId_(),
      brand: brand,
      productName: productName,
      description: sanitizePromotionText_(data.description || data.detail || data.notes, 300),
      discountText: discountText,
      active: active ? 'TRUE' : 'FALSE',
      createdAt: now,
      updatedAt: now,
      updatedBy: String(auth.data && (auth.data.userId || auth.data.username) || '').trim()
    };
    const duplicateKey = getPromotionIdentityKey_(row);
    const duplicate = existingPromotions.find(function (promotion) {
      return getPromotionIdentityKey_(promotion) === duplicateKey
        && normalizeString(promotion.promotionId) !== normalizeString(row.promotionId);
    });
    if (duplicate) {
      return validationError('Duplicate promotion detected', {
        promotionId: duplicate.promotionId
      });
    }
    const existing = existingPromotions.find(function (promotion) {
      return normalizeString(promotion.promotionId) === normalizeString(row.promotionId);
    });
    const writeObject = existing
      ? Object.assign({}, row, { createdAt: existing.createdAt || row.createdAt })
      : row;
    if (existing && existing._rowNumber) {
      const previousValues = Array.isArray(existing._rowValues) ? existing._rowValues : [];
      const updateValues = headers.map(function (header, index) {
        return writeObject[header] !== undefined ? writeObject[header] : (previousValues[index] || '');
      });
      sheet.getRange(existing._rowNumber, 1, 1, headers.length).setValues([updateValues]);
    } else {
      const appendValues = headers.map(function (header) {
        return writeObject[header] !== undefined ? writeObject[header] : '';
      });
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([appendValues]);
    }
    clearPromotionCaches_();
    logActivity(row.updatedBy, existing ? 'PROMOTION_UPDATED' : 'PROMOTION_CREATED', 'promotionId=' + row.promotionId);
    return success(row, existing ? 'Promotion updated' : 'Promotion saved');
  } catch (error) {
    logError('savePromotion', error);
    return fail(error && error.message ? error.message : 'Failed to save promotion');
  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        logWarning('savePromotion', 'Unable to release promotion save lock');
      }
    }
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
