function getCustomers() {
  try {
    const result = getSheetData(CUSTOMERS_SHEET);
    if (!result.ok) {
      logWarning('getCustomers', 'Unable to read Customers sheet');
      return success([]);
    }
    const customers = Array.isArray(result.data) ? result.data : [];
    const activeCustomers = customers.filter(function (item) {
      const activeValue = String(item.active || '').trim().toLowerCase();
      return activeValue === 'true' || activeValue === 'yes' || activeValue === '1';
    });
    return success(activeCustomers);
  } catch (error) {
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
    const customers = Array.isArray(result.data) ? result.data : [];
    const customer = customers.find(function (item) {
      return String(item.customerId || '').trim() === String(customerId || '').trim();
    });
    if (!customer) {
      logWarning('getCustomer', 'Customer not found: ' + customerId);
      return notFound('Customer not found');
    }
    return success(customer);
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
    const customers = Array.isArray(result.data) ? result.data : [];
    const matches = customers.filter(function (item) {
      return [
        String(item.customerId || ''),
        String(item.customerName || ''),
        String(item.province || '')
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
      phone: String(data.phone || '').trim(),
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
    logInfo('saveCustomer', 'Customer created ' + row.customerId);
    return success(row, 'Customer saved');
  } catch (error) {
    logError('saveCustomer', error);
    return fail(error && error.message ? error.message : 'Failed to save customer');
  }
}

function updateCustomer(customerId, payload) {
  try {
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
    ['customerName', 'province', 'phone', 'address', 'group', 'active'].forEach(function (field) {
      if (payload[field] !== undefined) {
        updateObject[field] = String(payload[field]).trim();
      }
    });
    updateObject.updatedAt = new Date().toISOString();
    const result = updateRowById(CUSTOMERS_SHEET, 'customerId', customerId, updateObject);
    if (!result.ok) {
      return result;
    }
    logInfo('updateCustomer', 'Customer updated ' + customerId);
    return success(updateObject, 'Customer updated');
  } catch (error) {
    logError('updateCustomer', error);
    return fail(error && error.message ? error.message : 'Failed to update customer');
  }
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
    const customers = Array.isArray(result.data) ? result.data : [];
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
