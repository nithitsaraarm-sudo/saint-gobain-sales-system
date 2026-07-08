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
  try {
    const cacheKey = getSheetDataCacheKey(sheetName);
    if (cacheKey) {
      const cached = getServerCache(cacheKey);
      if (cached) {
        return success(cached);
      }
    }
    const sheet = getSheet(sheetName);
    if (!sheet) {
      return success([]);
    }
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 1 || lastColumn < 1) {
      return success([]);
    }
    const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
    if (!values || values.length === 0) {
      return success([]);
    }
    const rows = sheetToObjects(values);
    if (cacheKey) {
      setServerCache(cacheKey, rows, 300);
    }
    return success(rows);
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
    headers.forEach(function (header, index) {
      if (object[header] !== undefined) {
        sheet.getRange(actualRowIndex, index + 1).setValue(object[header]);
      }
    });
    clearSheetDataCache(sheetName);
    return success({ sheetName: sheetName, idColumn: idColumn, idValue: idValue });
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
    return ['customerId', 'customerName', 'province', 'status', 'defaultGyprocDiscount', 'defaultWeberDiscount', 'notes', 'address'];
  }
  if (sheetName === SHEET_NAMES.PRODUCTS) {
    return ['productId', 'brand', 'discountGroup', 'groupCode', 'itemName', 'itemDesc', 'unit', 'listPrice', 'imageUrl', 'status', 'active', 'notes', 'promoText'];
  }
  if (sheetName === SHEET_NAMES.QUOTE_HISTORY) {
    return ['quoteId', 'customerId', 'status', 'shipping', 'specialDiscount', 'subtotal', 'vat', 'grandTotal', 'createdAt', 'updatedAt'];
  }
  if (sheetName === SHEET_NAMES.QUOTE_LINES) {
    return ['quoteId', 'lineId', 'productId', 'productName', 'qty', 'listPrice', 'discountPercent', 'netPrice', 'lineTotal', 'status', 'createdAt', 'updatedAt'];
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
    return ['key', 'value', 'updatedAt'];
  }
  if (sheetName === SHEET_NAMES.PROMOTIONS) {
    return ['promotionId', 'brand', 'productName', 'description', 'discountText', 'active', 'createdAt', 'updatedAt'];
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
