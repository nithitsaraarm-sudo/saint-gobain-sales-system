// Database helpers for Google Sheets.
var SG_SPREADSHEET_CACHE = null;
var SG_SHEET_CACHE = {};

function startPerformanceTimer(label) {
  return {
    label: String(label || 'operation').trim(),
    startedAt: Date.now()
  };
}

function endPerformanceTimer(timer, detail) {
  try {
    if (!timer || !timer.label) {
      return;
    }
    const elapsed = Date.now() - timer.startedAt;
    Logger.log('[PERF] ' + timer.label + ' ' + elapsed + 'ms' + (detail ? ' ' + detail : ''));
  } catch (error) {
    // Timing logs are diagnostic only.
  }
}

function createBackendPerformanceTrace_(action) {
  const now = Date.now();
  return {
    action: String(action || 'operation').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 80) || 'operation',
    eventId: 'PERF-' + now + '-' + Math.floor(Math.random() * 10000),
    startedAt: now,
    lastAt: now
  };
}

function formatBackendPerformanceDetail_(detail) {
  try {
    if (detail === undefined || detail === null || detail === '') {
      return '';
    }
    if (typeof detail !== 'object') {
      return String(detail).replace(/[\r\n\t]+/g, ' ').slice(0, 240);
    }
    const blockedKeys = /password|currentPassword|newPassword|confirmPassword|sessionToken|sg_token|token|authorization|secret/i;
    return Object.keys(detail).filter(function (key) {
      return !blockedKeys.test(String(key || ''));
    }).slice(0, 14).map(function (key) {
      const value = detail[key];
      if (value === undefined || value === null) {
        return key + '=';
      }
      if (typeof value === 'object') {
        return key + '=object';
      }
      return key + '=' + String(value).replace(/[\r\n\t]+/g, ' ').slice(0, 80);
    }).join(' ');
  } catch (error) {
    return '';
  }
}

function markBackendPerformanceStep_(trace, step, detail) {
  try {
    if (!trace || !trace.action || !trace.startedAt) {
      return;
    }
    const now = Date.now();
    const stepMs = now - (trace.lastAt || trace.startedAt);
    const totalMs = now - trace.startedAt;
    trace.lastAt = now;
    const formattedDetail = formatBackendPerformanceDetail_(detail);
    Logger.log('[PERF_STEP] action=' + trace.action + ' eventId=' + trace.eventId + ' step=' + String(step || 'step').replace(/\s+/g, '_') + ' stepMs=' + stepMs + ' totalMs=' + totalMs + (formattedDetail ? ' ' + formattedDetail : ''));
  } catch (error) {
    // Diagnostic logging must never affect runtime behavior.
  }
}

function endBackendPerformanceTrace_(trace, status, detail) {
  try {
    if (!trace || !trace.action || !trace.startedAt) {
      return;
    }
    const totalMs = Date.now() - trace.startedAt;
    const formattedDetail = formatBackendPerformanceDetail_(detail);
    Logger.log('[PERF_DONE] action=' + trace.action + ' eventId=' + trace.eventId + ' status=' + String(status || 'done').replace(/\s+/g, '_') + ' totalMs=' + totalMs + (formattedDetail ? ' ' + formattedDetail : ''));
  } catch (error) {
    // Diagnostic logging must never affect runtime behavior.
  }
}

function getSpreadsheet() {
  try {
    if (SG_SPREADSHEET_CACHE) {
      return SG_SPREADSHEET_CACHE;
    }
    const spreadsheetId = getSpreadsheetId();
    if (spreadsheetId) {
      SG_SPREADSHEET_CACHE = SpreadsheetApp.openById(spreadsheetId);
      return SG_SPREADSHEET_CACHE;
    }
    SG_SPREADSHEET_CACHE = SpreadsheetApp.getActiveSpreadsheet();
    return SG_SPREADSHEET_CACHE;
  } catch (error) {
    logError('getSpreadsheet', error);
    return null;
  }
}

function getSheet(sheetName) {
  try {
    const name = String(sheetName || '').trim();
    if (!name) {
      return null;
    }
    if (SG_SHEET_CACHE[name]) {
      return SG_SHEET_CACHE[name];
    }
    const ss = getSpreadsheet();
    if (!ss) {
      return null;
    }
    SG_SHEET_CACHE[name] = ss.getSheetByName(name) || null;
    return SG_SHEET_CACHE[name];
  } catch (error) {
    logError('getSheet', error);
    return null;
  }
}

function getServerCache(key) {
  try {
    const cacheKey = String(key || '').trim();
    if (!cacheKey) {
      return null;
    }
    const cached = CacheService.getScriptCache().get(cacheKey);
    if (!cached) {
      return null;
    }
    const parsed = JSON.parse(cached);
    if (parsed && parsed.__cacheChunks) {
      var combined = '';
      for (var i = 0; i < parsed.__cacheChunks; i++) {
        const chunk = CacheService.getScriptCache().get(cacheKey + ':chunk:' + i);
        if (!chunk) {
          return null;
        }
        combined += chunk;
      }
      return JSON.parse(combined);
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function setServerCache(key, data, seconds) {
  try {
    const cacheKey = String(key || '').trim();
    if (!cacheKey) {
      return false;
    }
    const ttl = Math.max(1, Math.min(parseInt(seconds || 300, 10) || 300, 21600));
    const json = JSON.stringify(data);
    const chunkSize = 90000;
    if (json.length <= chunkSize) {
      CacheService.getScriptCache().put(cacheKey, json, ttl);
      return true;
    }
    const chunks = [];
    for (var i = 0; i < json.length; i += chunkSize) {
      chunks.push(json.slice(i, i + chunkSize));
    }
    chunks.forEach(function (chunk, index) {
      CacheService.getScriptCache().put(cacheKey + ':chunk:' + index, chunk, ttl);
    });
    CacheService.getScriptCache().put(cacheKey, JSON.stringify({ __cacheChunks: chunks.length }), ttl);
    return true;
  } catch (error) {
    return false;
  }
}

function clearServerCache(key) {
  try {
    const cacheKey = String(key || '').trim();
    if (cacheKey) {
      const cache = CacheService.getScriptCache();
      const cached = cache.get(cacheKey);
      const keys = [cacheKey];
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.__cacheChunks) {
          for (var i = 0; i < parsed.__cacheChunks; i++) {
            keys.push(cacheKey + ':chunk:' + i);
          }
        }
      }
      cache.removeAll(keys);
    }
  } catch (error) {
    // Cache is optional; ignore cache clear failures.
  }
}

function getSheetDataCacheKey(sheetName) {
  const name = String(sheetName || '').trim();
  if (name === String(SHEET_NAMES.CUSTOMERS || '') || name === String(typeof CUSTOMERS_SHEET !== 'undefined' ? CUSTOMERS_SHEET : '')) {
    return 'sheetData:customers';
  }
  if (name === String(SHEET_NAMES.PRODUCTS || '') || name === String(typeof PRODUCT_SHEET !== 'undefined' ? PRODUCT_SHEET : '')) {
    return 'sheetData:products';
  }
  if (typeof getUsersSheetName === 'function' && name === String(getUsersSheetName() || '')) {
    return 'sheetData:users';
  }
  if (name === String(SHEET_NAMES.PROMOTIONS || '') || name === String(typeof PROMOTIONS_SHEET !== 'undefined' ? PROMOTIONS_SHEET : '')) {
    return 'sheetData:promotions';
  }
  if (name === String(typeof SALES_TARGETS_SHEET !== 'undefined' ? SALES_TARGETS_SHEET : 'SalesTargets')) {
    return 'sheetData:salesTargets';
  }
  if (name === String(typeof CUSTOMER_AGREEMENTS_SHEET !== 'undefined' ? CUSTOMER_AGREEMENTS_SHEET : 'CustomerAgreements')) {
    return 'sheetData:customerAgreements';
  }
  if (name === String(typeof AGREEMENT_ENTRIES_SHEET !== 'undefined' ? AGREEMENT_ENTRIES_SHEET : 'AgreementEntries')) {
    return 'sheetData:agreementEntries';
  }
  if (name === String(typeof AGREEMENT_ATTACHMENTS_SHEET !== 'undefined' ? AGREEMENT_ATTACHMENTS_SHEET : 'AgreementAttachments')) {
    return 'sheetData:agreementAttachments';
  }
  return '';
}

function clearSheetDataCache(sheetName) {
  const cacheKey = getSheetDataCacheKey(sheetName);
  if (cacheKey) {
    clearServerCache(cacheKey);
    clearServerCache('bootstrap:lightweight');
  }
}

function getHeaders(sheet) {
  try {
    if (!sheet) {
      return [];
    }
    const lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) {
      return [];
    }
    const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0] || [];
    return headers.some(function (header) { return String(header || '').trim() !== ''; }) ? headers : [];
  } catch (error) {
    logError('getHeaders', error);
    return [];
  }
}

function ensureSheet(sheetName, headers) {
  try {
    const ss = getSpreadsheet();
    if (!ss) {
      return null;
    }
    const name = String(sheetName || '').trim();
    let sheet = getSheet(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      SG_SHEET_CACHE[name] = sheet;
    }
    if (headers && headers.length > 0) {
      const existingHeaders = getHeaders(sheet);
      if (!existingHeaders || existingHeaders.length === 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
    }
    return sheet;
  } catch (error) {
    logError('ensureSheet', error);
    return null;
  }
}

function getSheetData(sheetName) {
  const startedAt = Date.now();
  var spreadsheetOpenMs = 0;
  try {
    const cacheKey = getSheetDataCacheKey(sheetName);
    if (cacheKey) {
      const cached = getServerCache(cacheKey);
      if (cached) {
        const cachedResult = success(cached);
        cachedResult.cacheHit = true;
        cachedResult.spreadsheetOpenMs = 0;
        cachedResult.totalMs = Date.now() - startedAt;
        return cachedResult;
      }
    }
    const openStartedAt = Date.now();
    const sheet = getSheet(sheetName);
    spreadsheetOpenMs = Date.now() - openStartedAt;
    if (!sheet) {
      const emptyResult = success([]);
      emptyResult.cacheHit = false;
      emptyResult.spreadsheetOpenMs = spreadsheetOpenMs;
      emptyResult.totalMs = Date.now() - startedAt;
      return emptyResult;
    }
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 1 || lastColumn < 1) {
      const emptySheetResult = success([]);
      emptySheetResult.cacheHit = false;
      emptySheetResult.spreadsheetOpenMs = spreadsheetOpenMs;
      emptySheetResult.totalMs = Date.now() - startedAt;
      return emptySheetResult;
    }
    const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
    if (!values || values.length === 0) {
      const noValuesResult = success([]);
      noValuesResult.cacheHit = false;
      noValuesResult.spreadsheetOpenMs = spreadsheetOpenMs;
      noValuesResult.totalMs = Date.now() - startedAt;
      return noValuesResult;
    }
    const rows = sheetToObjects(values);
    if (cacheKey) {
      setServerCache(cacheKey, rows, 300);
    }
    const response = success(rows);
    response.cacheHit = false;
    response.spreadsheetOpenMs = spreadsheetOpenMs;
    response.totalMs = Date.now() - startedAt;
    return response;
  } catch (error) {
    logError('getSheetData', error);
    return fail(error && error.message ? error.message : 'Failed to read sheet data');
  }
}

function appendRow(sheetName, object) {
  var lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const sheet = ensureSheet(sheetName, getHeadersForSheet(sheetName));
    if (!sheet) {
      return fail('Unable to access spreadsheet');
    }
    const headers = getHeaders(sheet);
    const row = headers.map(function (header) {
      return object[header] !== undefined ? object[header] : '';
    });
    sheet.appendRow(row);
    clearSheetDataCache(sheetName);
    return success({ sheetName: sheetName, row: row });
  } catch (error) {
    logError('appendRow', error);
    return fail(error && error.message ? error.message : 'Failed to append row');
  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        console.log('[LOCK] appendRow release skipped: ' + releaseError);
      }
    }
  }
}

function sheetToObjects(values) {
  if (!values || values.length === 0) {
    return [];
  }
  const headers = values[0].map(function (header) {
    return String(header || '').trim();
  });
  const rows = values.slice(1).filter(function (row) {
    return row.some(function (cell) { return String(cell).trim() !== ''; });
  });
  return rows.map(function (row) {
    const record = {};
    headers.forEach(function (header, index) {
      if (header) {
        record[header] = row[index] || '';
      }
    });
    return record;
  });
}

function parseNumericValue(value) {
  const numericValue = Number(value);
  return isNaN(numericValue) ? 0 : numericValue;
}

function getSheetByName(name) {
  return getSheet(name);
}

function getRowUpdateRuns_(headers, object) {
  const source = object && typeof object === 'object' ? object : {};
  const runs = [];
  var currentRun = null;
  headers.forEach(function (header, index) {
    if (!header || source[header] === undefined) {
      if (currentRun) {
        runs.push(currentRun);
        currentRun = null;
      }
      return;
    }
    if (!currentRun) {
      currentRun = { startColumn: index + 1, values: [] };
    }
    currentRun.values.push(source[header]);
  });
  if (currentRun) {
    runs.push(currentRun);
  }
  return runs;
}

function applyRowObjectUpdate_(sheet, rowNumber, headers, object) {
  const runs = getRowUpdateRuns_(headers || [], object || {});
  runs.forEach(function (run) {
    sheet.getRange(rowNumber, run.startColumn, 1, run.values.length).setValues([run.values]);
  });
  return success({ rowNumber: rowNumber, updatedRuns: runs.length });
}

function deleteSheetRowsByRowNumbers_(sheet, rowNumbers) {
  try {
    const rows = (Array.isArray(rowNumbers) ? rowNumbers : []).map(function (rowNumber) {
      return parseInt(rowNumber, 10);
    }).filter(function (rowNumber, index, list) {
      return !isNaN(rowNumber) && rowNumber > 0 && list.indexOf(rowNumber) === index;
    }).sort(function (a, b) {
      return a - b;
    });
    if (!rows.length) {
      return success({ deleted: 0, groups: 0 });
    }
    const groups = [];
    var start = rows[0];
    var end = rows[0];
    for (var i = 1; i < rows.length; i++) {
      if (rows[i] === end + 1) {
        end = rows[i];
      } else {
        groups.push({ start: start, count: end - start + 1 });
        start = rows[i];
        end = rows[i];
      }
    }
    groups.push({ start: start, count: end - start + 1 });
    for (var j = groups.length - 1; j >= 0; j--) {
      sheet.deleteRows(groups[j].start, groups[j].count);
    }
    return success({ deleted: rows.length, groups: groups.length });
  } catch (error) {
    logError('deleteSheetRowsByRowNumbers_', error);
    return fail(error && error.message ? error.message : 'Failed to delete rows');
  }
}

function updateRowById(sheetName, idColumn, idValue, object) {
  var lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const sheet = ensureSheet(sheetName, getHeadersForSheet(sheetName));
    if (!sheet) {
      return fail('Unable to access spreadsheet');
    }
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 1 || lastColumn < 1) {
      return fail('No data found');
    }
    const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
    if (!values || values.length === 0) {
      return fail('No data found');
    }
    const headers = values[0];
    const idIndex = headers.indexOf(idColumn);
    if (idIndex < 0) {
      return fail('ID column not found');
    }
    const targetRowIndex = values.slice(1).findIndex(function (row) {
      return String(row[idIndex] || '') === String(idValue);
    });
    if (targetRowIndex < 0) {
      return fail('Record not found');
    }
    const actualRowIndex = targetRowIndex + 2;
    const updateResult = applyRowObjectUpdate_(sheet, actualRowIndex, headers, object);
    if (!updateResult.ok) {
      return updateResult;
    }
    clearSheetDataCache(sheetName);
    return success({ sheetName: sheetName, idColumn: idColumn, idValue: idValue, updatedRuns: updateResult.data && updateResult.data.updatedRuns || 0 });
  } catch (error) {
    logError('updateRowById', error);
    return fail(error && error.message ? error.message : 'Failed to update row');
  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        console.log('[LOCK] updateRowById release skipped: ' + releaseError);
      }
    }
  }
}

function findRowByValue(sheetName, columnName, value) {
  try {
    const result = getSheetData(sheetName);
    if (!result.ok) {
      return result;
    }
    const rows = result.data || [];
    const row = rows.find(function (item) {
      return String(item[columnName] || '') === String(value);
    });
    return row ? success(row) : fail('Record not found');
  } catch (error) {
    logError('findRowByValue', error);
    return fail(error && error.message ? error.message : 'Lookup failed');
  }
}

function getHeadersForSheet(sheetName) {
  if (sheetName === SHEET_NAMES.USERS) {
    return getDefaultUserHeaders();
  }
  if (sheetName === SHEET_NAMES.SYSTEM_LOGS) {
    return ['userId', 'action', 'detail', 'createdAt'];
  }
  if (sheetName === SHEET_NAMES.CUSTOMERS) {
    return ['customerId', 'customerName', 'province', 'district', 'phone', 'status', 'active', 'salesArea', 'assignedSalesUserId', 'assignedSalesUsername', 'assignedSalesNameSnapshot', 'sellsWeber', 'sellsGyproc', 'defaultGyprocDiscount', 'defaultWeberDiscount', 'notes', 'address', 'group', 'createdAt', 'updatedAt', 'updatedBy'];
  }
  if (sheetName === SHEET_NAMES.PRODUCTS) {
    return ['productId', 'brand', 'discountGroup', 'groupCode', 'itemName', 'itemDesc', 'unit', 'listPrice', 'imageUrl', 'status', 'active', 'notes', 'promoCode', 'promoStartDate', 'promoEndDate', 'promoText'];
  }
  if (sheetName === SHEET_NAMES.QUOTE_HISTORY) {
    return ['quoteId', 'quoteNo', 'quoteType', 'businessUnit', 'customerId', 'customerName', 'status', 'shipping', 'specialDiscount', 'subtotal', 'vat', 'grandTotal', 'createdBy', 'createdById', 'createdByUserId', 'createdByUsername', 'quoteDisplayName', 'updatedBy', 'updatedById', 'updatedByUsername', 'createdAt', 'updatedAt'];
  }
  if (sheetName === SHEET_NAMES.USER_FAVORITE_CUSTOMERS) {
    return ['favoriteId', 'userId', 'customerId', 'sortOrder', 'createdAt', 'updatedAt'];
  }
  if (sheetName === SHEET_NAMES.USER_FAVORITE_PRODUCTS) {
    return ['favoriteId', 'userId', 'productId', 'productBusinessUnit', 'createdAt', 'updatedAt'];
  }
  if (sheetName === SHEET_NAMES.USER_PINNED_PRODUCTS) {
    return ['pinnedId', 'userId', 'productId', 'productBusinessUnit', 'sortOrder', 'createdAt', 'updatedAt'];
  }
  if (sheetName === SHEET_NAMES.QUOTE_LINES) {
    return ['quoteId', 'lineId', 'lineNo', 'lineOrder', 'sortOrder', 'productId', 'productCode', 'sku', 'productBusinessUnit', 'productName', 'unit', 'masterUnit', 'quotedUnit', 'qty', 'listPrice', 'masterListPrice', 'quotedListPrice', 'discountPercent', 'unitPrice', 'netPrice', 'lineTotal', 'vat', 'grandTotal', 'priceOverridden', 'unitOverridden', 'overrideReason', 'isFreeItem', 'freeItem', 'isFree', 'status', 'createdAt', 'updatedAt', 'updatedBy'];
  }
  if (sheetName === SHEET_NAMES.CUSTOMER_FREQUENT_PRODUCTS) {
    return ['customerId', 'productId', 'favorite', 'type', 'createdAt', 'updatedAt'];
  }
  if (sheetName === SHEET_NAMES.DISCOUNT_MATRIX) {
    return ['groupCode'];
  }
  if (sheetName === SHEET_NAMES.DISCOUNT_GROUPS) {
    return ['groupCode', 'groupName', 'description', 'active', 'createdAt', 'updatedAt'];
  }
  if (sheetName === SHEET_NAMES.CUSTOMER_PRODUCT_DISCOUNTS) {
    return ['customerId', 'productId', 'discountPercent', 'active', 'createdAt', 'updatedAt'];
  }
  if (sheetName === SHEET_NAMES.DISCOUNT_CHANGE_LOG) {
    return ['customerId', 'productId', 'oldDiscount', 'newDiscount', 'changedBy', 'createdAt'];
  }
  if (sheetName === SHEET_NAMES.SETTINGS) {
    return ['key', 'value', 'type', 'category', 'isPublic', 'updatedAt', 'updatedBy'];
  }
  if (sheetName === SHEET_NAMES.PROMOTIONS) {
    return ['promotionId', 'brand', 'productName', 'description', 'discountText', 'active', 'createdAt', 'updatedAt'];
  }
  if (String(sheetName || '') === 'SalesTargets') {
    return ['targetId', 'targetType', 'periodYear', 'periodMonth', 'periodStart', 'periodEnd', 'businessUnit', 'salesArea', 'salesUserId', 'salesUserNameSnapshot', 'targetAmount', 'currency', 'status', 'active', 'createdByUserId', 'createdByNameSnapshot', 'createdAt', 'updatedByUserId', 'updatedByNameSnapshot', 'updatedAt', 'version'];
  }
  if (sheetName === SHEET_NAMES.CUSTOMER_AGREEMENTS || String(sheetName || '') === 'CustomerAgreements') {
    return ['agreementId', 'customerId', 'customerCodeSnapshot', 'customerNameSnapshot', 'salesAreaSnapshot', 'businessUnit', 'agreementName', 'agreementYear', 'startDate', 'endDate', 'status', 'note', 'active', 'createdByUserId', 'createdByNameSnapshot', 'createdAt', 'updatedByUserId', 'updatedByNameSnapshot', 'updatedAt', 'version'];
  }
  if (sheetName === SHEET_NAMES.AGREEMENT_ENTRIES || String(sheetName || '') === 'AgreementEntries') {
    return ['entryId', 'agreementId', 'entryType', 'entryLabel', 'periodYear', 'periodMonth', 'periodQuarter', 'periodHalf', 'targetAmount', 'actualAmount', 'eligibleAmount', 'benefitRate', 'achievementPercent', 'passed', 'benefitAmount', 'note', 'sortOrder', 'active', 'createdByUserId', 'createdByNameSnapshot', 'createdAt', 'updatedByUserId', 'updatedByNameSnapshot', 'updatedAt', 'deletedByUserId', 'deletedAt', 'version'];
  }
  if (sheetName === SHEET_NAMES.AGREEMENT_ATTACHMENTS || String(sheetName || '') === 'AgreementAttachments') {
    return ['attachmentId', 'agreementId', 'fileName', 'fileExtension', 'mimeType', 'fileSize', 'driveFileId', 'driveUrl', 'active', 'uploadedByUserId', 'uploadedByNameSnapshot', 'uploadedAt', 'deletedByUserId', 'deletedAt', 'version'];
  }
  return [];
}

function createDefaultSheetsCore() {
  try {
    const ss = getSpreadsheet();
    if (!ss) {
      return fail('Unable to access spreadsheet');
    }
    const sheetNames = Object.keys(SHEET_NAMES).map(function (key) {
      return SHEET_NAMES[key];
    });
    sheetNames.forEach(function (sheetName) {
      ensureSheet(sheetName, getHeadersForSheet(sheetName));
    });
    return success({ created: true, sheets: sheetNames });
  } catch (error) {
    logError('createDefaultSheetsCore', error);
    return fail(error && error.message ? error.message : 'Failed to create default sheets');
  }
}

function createDefaultSheets() {
  return createDefaultSheetsCore();
}
