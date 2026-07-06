// Database helpers for Google Sheets.
function getSpreadsheet() {
  try {
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
    return values && values.length > 0 ? values[0] : [];
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
    const sheet = ensureSheet(sheetName, []);
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
  try {
    const lock = LockService.getScriptLock();
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
    lock.releaseLock();
    return success({ sheetName: sheetName, row: row });
  } catch (error) {
    logError('appendRow', error);
    return fail(error && error.message ? error.message : 'Failed to append row');
  }
}

function updateRowById(sheetName, idColumn, idValue, object) {
  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const sheet = ensureSheet(sheetName, getHeadersForSheet(sheetName));
    if (!sheet) {
      return fail('Unable to access spreadsheet');
    }
    const values = sheet.getDataRange().getDisplayValues();
    if (!values || values.length === 0) {
      lock.releaseLock();
      return fail('No data found');
    }
    const headers = values[0];
    const idIndex = headers.indexOf(idColumn);
    if (idIndex < 0) {
      lock.releaseLock();
      return fail('ID column not found');
    }
    const targetRowIndex = values.slice(1).findIndex(function (row) {
      return String(row[idIndex] || '') === String(idValue);
    });
    if (targetRowIndex < 0) {
      lock.releaseLock();
      return fail('Record not found');
    }
    const actualRowIndex = targetRowIndex + 2;
    headers.forEach(function (header, index) {
      if (object[header] !== undefined) {
        sheet.getRange(actualRowIndex, index + 1).setValue(object[header]);
      }
    });
    lock.releaseLock();
    return success({ sheetName: sheetName, idColumn: idColumn, idValue: idValue });
  } catch (error) {
    logError('updateRowById', error);
    return fail(error && error.message ? error.message : 'Failed to update row');
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
  return [];
}

function createDefaultSheetsCore() {
  try {
    const ss = getSpreadsheet();
    if (!ss) {
      return fail('Unable to access spreadsheet');
    }
    ensureSheet(SHEET_NAMES.USERS, getDefaultUserHeaders());
    ensureSheet(SHEET_NAMES.SYSTEM_LOGS, ['userId', 'action', 'detail', 'createdAt']);
    return success({ created: true, sheets: [SHEET_NAMES.USERS, SHEET_NAMES.SYSTEM_LOGS] });
  } catch (error) {
    logError('createDefaultSheetsCore', error);
    return fail(error && error.message ? error.message : 'Failed to create default sheets');
  }
}

function createDefaultSheets() {
  return createDefaultSheetsCore();
}
