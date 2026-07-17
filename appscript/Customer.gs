function getCustomers() {
  const timer = startPerformanceTimer('customers');
  try {
    if (typeof clearSheetDataCache === 'function') {
      clearSheetDataCache(CUSTOMERS_SHEET);
    }
    const result = getSheetData(CUSTOMERS_SHEET);
    if (!result.ok) {
      logWarning('getCustomers', 'Unable to read Customers sheet');
      endPerformanceTimer(timer, 'ok=false');
      return success([]);
    }
    const customers = normalizeCustomerRows_(result.data);
    const activeCustomers = customers.filter(isActiveCustomer);
    endPerformanceTimer(timer, 'count=' + activeCustomers.length);
    return success(activeCustomers);
  } catch (error) {
    endPerformanceTimer(timer, 'error=true');
    logError('getCustomers', error);
    return fail(error && error.message ? error.message : 'Failed to load customers');
  }
}

function getCustomer(customerId) {
  try {
    const idCheck = requireValue(customerId, 'customerId');
    if (!idCheck.ok) {
      return idCheck;
    }
    const result = getSheetData(CUSTOMERS_SHEET);
    if (!result.ok) {
      logWarning('getCustomer', 'Unable to read Customers sheet');
      return fail('Unable to load customer');
    }
    const customers = normalizeCustomerRows_(result.data);
    const customer = customers.find(function (item) {
      return String(item.customerId || '').trim() === String(customerId || '').trim();
    });
    if (!customer) {
      logWarning('getCustomer', 'Customer not found: ' + customerId);
      return notFound('Customer not found');
    }
    return success(normalizeCustomerObject(customer));
  } catch (error) {
    logError('getCustomer', error);
    return fail(error && error.message ? error.message : 'Failed to load customer');
  }
}

function searchCustomers(keyword) {
  try {
    const value = String(keyword || '').trim().toLowerCase();
    if (!value) {
      return getCustomers();
    }
    const result = getSheetData(CUSTOMERS_SHEET);
    if (!result.ok) {
      logWarning('searchCustomers', 'Unable to read Customers sheet');
      return success([]);
    }
    const customers = normalizeCustomerRows_(result.data).filter(isActiveCustomer);
    const matches = customers.filter(function (item) {
      return [
        String(item.customerId || ''),
        String(item.customerName || ''),
        String(item.province || ''),
        String(item.customerType || ''),
        String(item.notes || ''),
        String(item.address || '')
      ].some(function (field) {
        return String(field).toLowerCase().indexOf(value) >= 0;
      });
    });
    return success(matches);
  } catch (error) {
    logError('searchCustomers', error);
    return fail(error && error.message ? error.message : 'Customer search failed');
  }
}

function saveCustomer(payload) {
  try {
    migrateCustomersSheet();
    const check = validatePayload(payload, ['customerId', 'customerName']);
    if (!check.ok) {
      return check;
    }
    const data = payload || {};
    const existing = getCustomer(data.customerId);
    if (existing.ok) {
      return fail('Customer already exists');
    }
    const now = new Date().toISOString();
    const row = {
      customerId: String(data.customerId || '').trim(),
      customerName: String(data.customerName || '').trim(),
      province: String(data.province || '').trim(),
      phone: typeof normalizePhone === 'function' ? normalizePhone(data.phone) : String(data.phone || '').trim(),
      notes: String(data.notes || '').trim(),
      address: String(data.address || '').trim(),
      group: String(data.group || '').trim(),
      active: 'TRUE',
      createdAt: now,
      updatedAt: now
    };
    const insertResult = appendRow(CUSTOMERS_SHEET, row);
    if (!insertResult.ok) {
      return insertResult;
    }
    clearCustomerCaches_();
    logInfo('saveCustomer', 'Customer created ' + row.customerId);
    return success(row, 'Customer saved');
  } catch (error) {
    logError('saveCustomer', error);
    return fail(error && error.message ? error.message : 'Failed to save customer');
  }
}

function updateCustomer(customerId, payload) {
  try {
    migrateCustomersSheet();
    const idCheck = requireValue(customerId, 'customerId');
    if (!idCheck.ok) {
      return idCheck;
    }
    if (!payload || typeof payload !== 'object') {
      return validationError('payload is required');
    }
    const customerResult = getCustomer(customerId);
    if (!customerResult.ok) {
      return customerResult;
    }
    const updateObject = {};
    ['customerName', 'province', 'phone', 'address', 'notes', 'group', 'active'].forEach(function (field) {
      if (payload[field] !== undefined) {
        updateObject[field] = field === 'phone' && typeof normalizePhone === 'function' ? normalizePhone(payload[field]) : String(payload[field]).trim();
      }
    });
    updateObject.updatedAt = new Date().toISOString();
    const result = updateRowById(CUSTOMERS_SHEET, 'customerId', customerId, updateObject);
    if (!result.ok) {
      return result;
    }
    clearCustomerCaches_();
    const actor = payload && payload.currentUser ? payload.currentUser : {};
    logActivity(actor.userId || '', 'CUSTOMER_UPDATED', 'Customer updated ' + customerId);
    return success(updateObject, 'Customer updated');
  } catch (error) {
    logError('updateCustomer', error);
    return fail(error && error.message ? error.message : 'Failed to update customer');
  }
}

function migrateCustomersSheet() {
  const requiredHeaders = getHeadersForSheet(CUSTOMERS_SHEET);
  const sheet = ensureSheet(CUSTOMERS_SHEET, requiredHeaders);
  if (!sheet) return fail('Unable to access Customers sheet');
  const headers = getHeaders(sheet);
  var nextHeaders = headers.slice();
  requiredHeaders.forEach(function (header) { if (nextHeaders.indexOf(header) < 0) nextHeaders.push(header); });
  if (nextHeaders.length !== headers.length) sheet.getRange(1, 1, 1, nextHeaders.length).setValues([nextHeaders]);
  const phoneIndex = nextHeaders.indexOf('phone');
  if (phoneIndex >= 0) sheet.getRange(2, phoneIndex + 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  return success({ headers: nextHeaders });
}

function deactivateCustomer(customerId) {
  try {
    const idCheck = requireValue(customerId, 'customerId');
    if (!idCheck.ok) {
      return idCheck;
    }
    const customerResult = getCustomer(customerId);
    if (!customerResult.ok) {
      return customerResult;
    }
    const result = updateRowById(CUSTOMERS_SHEET, 'customerId', customerId, {
      active: 'FALSE',
      updatedAt: new Date().toISOString()
    });
    if (!result.ok) {
      return result;
    }
    if (typeof removeCustomerFromAllFavorites_ === 'function') removeCustomerFromAllFavorites_(customerId);
    logInfo('deactivateCustomer', 'Customer deactivated ' + customerId);
    return success({ customerId: customerId }, 'Customer deactivated');
  } catch (error) {
    logError('deactivateCustomer', error);
    return fail(error && error.message ? error.message : 'Failed to deactivate customer');
  }
}

function getCustomersByProvince(province) {
  try {
    const value = String(province || '').trim().toLowerCase();
    if (!value) {
      return success([]);
    }
    const result = getSheetData(CUSTOMERS_SHEET);
    if (!result.ok) {
      logWarning('getCustomersByProvince', 'Unable to read Customers sheet');
      return success([]);
    }
    const customers = normalizeCustomerRows_(result.data).filter(isActiveCustomer);
    const matches = customers.filter(function (item) {
      return String(item.province || '').toLowerCase() === value;
    });
    return success(matches);
  } catch (error) {
    logError('getCustomersByProvince', error);
    return fail(error && error.message ? error.message : 'Failed to load customers by province');
  }
}

function getCustomerSummary(customerId) {
  try {
    const idCheck = requireValue(customerId, 'customerId');
    if (!idCheck.ok) {
      return idCheck;
    }
    const customerResult = getCustomer(customerId);
    if (!customerResult.ok) {
      return customerResult;
    }
    const customer = customerResult.data;
    const historyResult = getSheetData(QUOTE_HISTORY_SHEET);
    const frequentResult = getSheetData(CUSTOMER_FREQUENT_PRODUCTS_SHEET);
    var quotationCount = 0;
    var lastVisit = null;
    if (historyResult.ok && Array.isArray(historyResult.data)) {
      historyResult.data.forEach(function (item) {
        if (String(item.customerId || '').trim() === String(customerId || '').trim()) {
          quotationCount += 1;
          var timestamp = parseDate(String(item.updatedAt || item.createdAt || ''));
          if (timestamp && (!lastVisit || timestamp > lastVisit)) {
            lastVisit = timestamp;
          }
        }
      });
    }
    var favoriteProductsCount = 0;
    if (frequentResult.ok && Array.isArray(frequentResult.data)) {
      favoriteProductsCount = frequentResult.data.filter(function (item) {
        return String(item.customerId || '').trim() === String(customerId || '').trim();
      }).length;
    }
    return success({
      customer: customer,
      quotationCount: quotationCount,
      lastVisit: lastVisit ? lastVisit.toISOString() : '',
      favoriteProductsCount: favoriteProductsCount
    });
  } catch (error) {
    logError('getCustomerSummary', error);
    return fail(error && error.message ? error.message : 'Failed to load customer summary');
  }
}

function parseDate(value) {
  var date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function normalizeCustomerRows_(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const customers = [];
  list.forEach(function (row, index) {
    const normalized = normalizeCustomerObject(row, index + 2);
    if (normalized) {
      customers.push(normalized);
    }
  });
  return customers;
}

function logMalformedCustomerRow_(customerId, rowNumber, reason) {
  logWarning('normalizeCustomerObject', 'customerId=' + String(customerId || '').trim() + '; rowNumber=' + String(rowNumber || '').trim() + '; reason=' + String(reason || '').trim());
}

function parseCustomerActiveFlag_(value) {
  if (value === true) return true;
  if (value === false) return false;
  const text = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
  if (!text) return null;
  if (text === 'true' || text === 'yes' || text === '1' || text === 'active' || text === 'ใช้งาน') return true;
  if (text === 'false' || text === 'no' || text === '0' || text === 'inactive' || text === 'disabled' || text === 'ไม่ใช้งาน') return false;
  return null;
}

function resolveCustomerActive_(source) {
  const activeValue = source && Object.prototype.hasOwnProperty.call(source, 'active') ? parseCustomerActiveFlag_(source.active) : null;
  if (activeValue !== null) {
    return activeValue;
  }
  const statusValue = source && Object.prototype.hasOwnProperty.call(source, 'status') ? parseCustomerActiveFlag_(source.status) : null;
  if (statusValue !== null) {
    return statusValue;
  }
  return isActiveStatus(source && source.status);
}

function clearCustomerCaches_() {
  if (typeof clearSheetDataCache === 'function') {
    clearSheetDataCache(CUSTOMERS_SHEET);
  }
}

function normalizeCustomerObject(row, rowNumber) {
  try {
    const source = row && typeof row === 'object' ? row : {};
    const code = String(source.customerId || source.customerCode || source.id || '').trim();
    if (!code) {
      logMalformedCustomerRow_('', rowNumber, 'missing_customerId');
      return null;
    }
    const customerName = String(source.customerName || '').trim();
    const province = String(source.province || '').trim();
    const status = String(source.status || '').trim();
    const defaultGyprocDiscount = String(source.defaultGyprocDiscount || '').trim();
    const defaultWeberDiscount = String(source.defaultWeberDiscount || '').trim();
    const notes = String(source.notes || '').trim();
    const address = String(source.address || '').trim();
    const phone = String(source.phone || '-').trim() || '-';
    const customerType = getCustomerBusinessType(source);
    const active = resolveCustomerActive_(source);
    const hasActive = Object.prototype.hasOwnProperty.call(source, 'active') && String(source.active || '').trim() !== '';
    const hasStatus = Object.prototype.hasOwnProperty.call(source, 'status') && String(source.status || '').trim() !== '';
    if (hasActive && parseCustomerActiveFlag_(source.active) === null) {
      logMalformedCustomerRow_(code, rowNumber, 'invalid_active');
    }
    if (!hasActive && hasStatus && parseCustomerActiveFlag_(source.status) === null) {
      logMalformedCustomerRow_(code, rowNumber, 'invalid_status');
    }

    return Object.assign({}, source, {
      id: code,
      customerId: code,
      customerCode: code,
      customerName: customerName,
      status: status,
      customerType: customerType,
      defaultGyprocDiscount: defaultGyprocDiscount,
      defaultWeberDiscount: defaultWeberDiscount,
      notes: notes,
      address: address,
      province: province,
      phone: phone,
      active: active
    });
  } catch (error) {
    const source = row && typeof row === 'object' ? row : {};
    logMalformedCustomerRow_(source.customerId || source.customerCode || source.id || '', rowNumber, 'normalize_error');
    return null;
  }
}

function getCustomerBusinessType(source) {
  const hasGyproc = String(source.defaultGyprocDiscount || '').trim() !== '';
  const hasWeber = String(source.defaultWeberDiscount || '').trim() !== '';

  if (hasGyproc && hasWeber) {
    return 'Gyproc/Weber';
  }
  if (hasGyproc) {
    return 'Gyproc';
  }
  if (hasWeber) {
    return 'Weber';
  }
  return '-';
}

function isActiveCustomer(customer) {
  const value = customer && typeof customer.active === 'boolean' ? customer.active : resolveCustomerActive_(customer || {});
  return value !== false;
}
function isActiveStatus(status) {
  const parsed = parseCustomerActiveFlag_(status);
  if (parsed === null && !String(status || '').trim()) {
    return true;
  }
  return parsed === true;
}
