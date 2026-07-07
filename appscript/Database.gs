// Database helpers for Google Sheets.
function getSpreadsheet() {
  try {
    const spreadsheetId = getSpreadsheetId();
    if (spreadsheetId) {
      return SpreadsheetApp.openById(spreadsheetId);
    }
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (error) {
    logError('getSpreadsheet', error);
    return null;
  }
}

function getSheet(sheetName) {
  try {
    const ss = getSpreadsheet();
    if (!ss) {
      return null;
    }
    return ss.getSheetByName(sheetName) || null;
  } catch (error) {
    logError('getSheet', error);
    return null;
  }
}

function getHeaders(sheet) {
  try {
    if (!sheet) {
      return [];
    }
    const values = sheet.getDataRange().getDisplayValues();
    const headers = values && values.length > 0 ? values[0] : [];
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
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
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
    const sheet = ensureSheet(sheetName, getHeadersForSheet(sheetName));
    if (!sheet) {
      return fail('Unable to access spreadsheet');
    }
    const values = sheet.getDataRange().getDisplayValues();
    if (!values || values.length === 0) {
      return success([]);
    }
    const headers = values[0];
    const rows = values.slice(1).filter(function (row) {
      return row.some(function (cell) { return String(cell).trim() !== ''; });
    });
    const records = rows.map(function (row) {
      const record = {};
      headers.forEach(function (header, index) {
        record[header] = row[index] || '';
      });
      return record;
    });
    return success(records);
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

function updateRowById(sheetName, idColumn, idValue, object) {
  var lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const sheet = ensureSheet(sheetName, getHeadersForSheet(sheetName));
    if (!sheet) {
      return fail('Unable to access spreadsheet');
    }
    const values = sheet.getDataRange().getDisplayValues();
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
    return ['customerId', 'customerName', 'province', 'phone', 'address', 'group', 'active', 'createdAt', 'updatedAt'];
  }
  if (sheetName === SHEET_NAMES.PRODUCTS) {
    return ['productId', 'sku', 'productCode', 'productName', 'brand', 'unit', 'groupCode', 'listPrice', 'active', 'createdAt', 'updatedAt'];
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
