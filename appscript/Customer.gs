const CUSTOMER_UNASSIGNED_AREA = 'UNASSIGNED';

function getCustomers(payload) {
  const timer = startPerformanceTimer('customers');
  try {
    const data = payload && typeof payload === 'object' ? payload : {};
    if (data.force && typeof clearSheetDataCache === 'function') {
      clearSheetDataCache(CUSTOMERS_SHEET);
    }
    const result = getSheetData(CUSTOMERS_SHEET);
    if (!result.ok) {
      logWarning('getCustomers', 'Unable to read Customers sheet');
      endPerformanceTimer(timer, 'ok=false');
      return success([]);
    }
    const activeCustomers = normalizeActiveCustomerRowsForScope_(result.data, getCustomerScopeUser_(data));
    endPerformanceTimer(timer, 'count=' + activeCustomers.length);
    return success(activeCustomers);
  } catch (error) {
    endPerformanceTimer(timer, 'error=true');
    logError('getCustomers', error);
    return fail(error && error.message ? error.message : 'Failed to load customers');
  }
}

function getCustomer(customerId, payload) {
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
    if (!isActiveCustomer(customer)) {
      return notFound('Customer not found');
    }
    const access = canAccessCustomerRecord_(getCustomerScopeUser_(payload), customer);
    if (!access.ok) {
      return access;
    }
    return success(normalizeCustomerObject(customer));
  } catch (error) {
    logError('getCustomer', error);
    return fail(error && error.message ? error.message : 'Failed to load customer');
  }
}

function searchCustomers(keyword, payload) {
  try {
    const value = String(keyword || '').trim().toLowerCase();
    if (!value) {
      return getCustomers(payload);
    }
    const result = getSheetData(CUSTOMERS_SHEET);
    if (!result.ok) {
      logWarning('searchCustomers', 'Unable to read Customers sheet');
      return success([]);
    }
    const customers = normalizeActiveCustomerRowsForScope_(result.data, getCustomerScopeUser_(payload));
    const matches = customers.filter(function (item) {
      return [
        String(item.customerId || ''),
        String(item.customerName || ''),
        String(item.province || ''),
        String(item.district || ''),
        String(item.salesArea || ''),
        String(item.assignedSalesUsername || ''),
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
    const auth = requireApiUser(payload);
    if (!auth.ok) {
      return auth;
    }
    const check = validatePayload(payload, ['customerId', 'customerName']);
    if (!check.ok) {
      return check;
    }
    const data = payload || {};
    const existing = findCustomerAnyStatus_(data.customerId);
    if (existing) {
      return fail('Customer already exists');
    }
    const salesArea = getSubmittedCustomerSalesArea_(data, auth.data, null);
    const areaCheck = validateCustomerSalesAreaForActor_(auth.data, salesArea);
    if (!areaCheck.ok) {
      return areaCheck;
    }
    const brandCheck = validateSubmittedCustomerBrands_(data, null, true);
    if (!brandCheck.ok) {
      return brandCheck;
    }
    const assigned = normalizeCustomerAssignedSales_(data);
    const assignedCheck = validateAssignedSalesForCustomer_(assigned.assignedSalesUserId, salesArea, assigned.assignedSalesUsername);
    if (!assignedCheck.ok) {
      return assignedCheck;
    }
    const resolvedAssigned = assignedCheck.data || assigned;
    const now = new Date().toISOString();
    const row = {
      customerId: String(data.customerId || '').trim(),
      customerName: String(data.customerName || '').trim(),
      province: String(data.province || '').trim(),
      district: String(data.district || '').trim(),
      phone: typeof normalizePhone === 'function' ? normalizePhone(data.phone) : String(data.phone || '').trim(),
      notes: String(data.notes || '').trim(),
      address: String(data.address || '').trim(),
      group: String(data.group || '').trim(),
      salesArea: salesArea,
      assignedSalesUserId: resolvedAssigned.assignedSalesUserId,
      assignedSalesUsername: resolvedAssigned.assignedSalesUsername,
      sellsWeber: brandCheck.data.sellsWeber ? 'TRUE' : 'FALSE',
      sellsGyproc: brandCheck.data.sellsGyproc ? 'TRUE' : 'FALSE',
      active: 'TRUE',
      createdAt: now,
      updatedAt: now,
      updatedBy: String(auth.data.userId || auth.data.username || '').trim()
    };
    const insertResult = appendRow(CUSTOMERS_SHEET, row);
    if (!insertResult.ok) {
      return insertResult;
    }
    clearCustomerCaches_();
    logCustomerAreaChange_(auth.data, row.customerId, '', row.salesArea, 'CUSTOMER_AREA_ASSIGNED');
    logCustomerBrandChange_(auth.data, row.customerId, '', getCustomerBrandLogValue_(brandCheck.data));
    if (row.assignedSalesUserId) {
      logCustomerAssignedSalesChange_(auth.data, row.customerId, '', row.assignedSalesUserId);
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
    migrateCustomersSheet();
    const auth = requireApiUser(payload);
    if (!auth.ok) {
      return auth;
    }
    const idCheck = requireValue(customerId, 'customerId');
    if (!idCheck.ok) {
      return idCheck;
    }
    if (!payload || typeof payload !== 'object') {
      return validationError('payload is required');
    }
    const customerResult = getCustomer(customerId, { currentUser: auth.data });
    if (!customerResult.ok) {
      return customerResult;
    }
    const existingCustomer = customerResult.data || {};
    const salesArea = getSubmittedCustomerSalesArea_(payload, auth.data, existingCustomer);
    const areaCheck = validateCustomerSalesAreaForActor_(auth.data, salesArea);
    if (!areaCheck.ok) {
      return areaCheck;
    }
    const brandCheck = validateSubmittedCustomerBrands_(payload, existingCustomer, true);
    if (!brandCheck.ok) {
      return brandCheck;
    }
    const submittedAssigned = normalizeCustomerAssignedSales_(payload);
    const nextAssignedUserId = (payload.assignedSalesUserId !== undefined || payload.assignedSalesUsername !== undefined)
      ? submittedAssigned.assignedSalesUserId
      : String(existingCustomer.assignedSalesUserId || '').trim();
    const nextAssignedUsername = (payload.assignedSalesUserId !== undefined || payload.assignedSalesUsername !== undefined)
      ? submittedAssigned.assignedSalesUsername
      : String(existingCustomer.assignedSalesUsername || '').trim();
    const assignedCheck = validateAssignedSalesForCustomer_(nextAssignedUserId, salesArea, nextAssignedUsername);
    if (!assignedCheck.ok) {
      return assignedCheck;
    }
    const activeCheck = validateCustomerActiveInput_(payload);
    if (!activeCheck.ok) {
      return activeCheck;
    }
    const updateObject = {};
    ['customerName', 'province', 'district', 'phone', 'address', 'notes', 'group'].forEach(function (field) {
      if (payload[field] !== undefined) {
        updateObject[field] = field === 'phone' && typeof normalizePhone === 'function' ? normalizePhone(payload[field]) : String(payload[field]).trim();
      }
    });
    if (payload.active !== undefined) {
      updateObject.active = activeCheck.data ? 'TRUE' : 'FALSE';
    }
    if (payload.salesArea !== undefined || payload.area !== undefined || payload.branch !== undefined || !existingCustomer.salesArea) {
      updateObject.salesArea = salesArea;
    }
    if (payload.assignedSalesUserId !== undefined || payload.assignedSalesUsername !== undefined) {
      const assigned = assignedCheck.data || submittedAssigned;
      updateObject.assignedSalesUserId = assigned.assignedSalesUserId;
      updateObject.assignedSalesUsername = assigned.assignedSalesUsername;
    }
    if (payload.sellsWeber !== undefined || payload.sellsGyproc !== undefined || payload.customerType !== undefined || payload.brand !== undefined || payload.bu !== undefined || payload.businessUnit !== undefined) {
      updateObject.sellsWeber = brandCheck.data.sellsWeber ? 'TRUE' : 'FALSE';
      updateObject.sellsGyproc = brandCheck.data.sellsGyproc ? 'TRUE' : 'FALSE';
    }
    updateObject.updatedAt = new Date().toISOString();
    updateObject.updatedBy = String(auth.data.userId || auth.data.username || '').trim();
    const result = updateRowById(CUSTOMERS_SHEET, 'customerId', customerId, updateObject);
    if (!result.ok) {
      return result;
    }
    clearCustomerCaches_();
    const actor = auth.data || {};
    if (updateObject.salesArea !== undefined && normalizeString(existingCustomer.salesArea) !== normalizeString(updateObject.salesArea)) {
      logCustomerAreaChange_(actor, customerId, existingCustomer.salesArea, updateObject.salesArea, 'CUSTOMER_AREA_CHANGED');
    }
    if (updateObject.sellsWeber !== undefined || updateObject.sellsGyproc !== undefined) {
      const oldBrands = getCustomerBrandLogValue_(existingCustomer);
      const newBrands = getCustomerBrandLogValue_(brandCheck.data);
      if (oldBrands !== newBrands) {
        logCustomerBrandChange_(actor, customerId, oldBrands, newBrands);
      }
    }
    if (updateObject.assignedSalesUserId !== undefined && normalizeString(existingCustomer.assignedSalesUserId) !== normalizeString(updateObject.assignedSalesUserId)) {
      logCustomerAssignedSalesChange_(actor, customerId, existingCustomer.assignedSalesUserId, updateObject.assignedSalesUserId);
    }
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
  const migration = migrateCustomerAreaAndBrandColumns_(sheet, nextHeaders);
  return success({ headers: nextHeaders, migration: migration });
}

function deactivateCustomer(customerId, payload) {
  try {
    const idCheck = requireValue(customerId, 'customerId');
    if (!idCheck.ok) {
      return idCheck;
    }
    const customerResult = getCustomer(customerId, payload);
    if (!customerResult.ok) {
      return customerResult;
    }
    const result = updateRowById(CUSTOMERS_SHEET, 'customerId', customerId, {
      active: 'FALSE',
      updatedAt: new Date().toISOString(),
      updatedBy: String(getCustomerScopeUser_(payload) && (getCustomerScopeUser_(payload).userId || getCustomerScopeUser_(payload).username) || '').trim()
    });
    if (!result.ok) {
      return result;
    }
    clearCustomerCaches_();
    if (typeof removeCustomerFromAllFavorites_ === 'function') removeCustomerFromAllFavorites_(customerId);
    logInfo('deactivateCustomer', 'Customer deactivated ' + customerId);
    return success({ customerId: customerId }, 'Customer deactivated');
  } catch (error) {
    logError('deactivateCustomer', error);
    return fail(error && error.message ? error.message : 'Failed to deactivate customer');
  }
}

function getCustomersByProvince(province, payload) {
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
    const customers = normalizeActiveCustomerRowsForScope_(result.data, getCustomerScopeUser_(payload));
    const matches = customers.filter(function (item) {
      return String(item.province || '').toLowerCase() === value;
    });
    return success(matches);
  } catch (error) {
    logError('getCustomersByProvince', error);
    return fail(error && error.message ? error.message : 'Failed to load customers by province');
  }
}

function getCustomerFilters(payload) {
  try {
    const auth = requireApiUser(payload);
    if (!auth.ok) {
      return auth;
    }
    const customersResult = getCustomers({ currentUser: auth.data });
    if (!customersResult.ok) {
      return customersResult;
    }
    const areas = {};
    const brands = { weber: 0, gyproc: 0, both: 0, review: 0 };
    (Array.isArray(customersResult.data) ? customersResult.data : []).forEach(function (customer) {
      const area = String(customer.salesArea || CUSTOMER_UNASSIGNED_AREA).trim() || CUSTOMER_UNASSIGNED_AREA;
      areas[area] = true;
      if (customer.sellsWeber && customer.sellsGyproc) brands.both += 1;
      else if (customer.sellsWeber) brands.weber += 1;
      else if (customer.sellsGyproc) brands.gyproc += 1;
      else brands.review += 1;
    });
    const assignableUsersResult = getAssignableSalesUsers(payload);
    return success({
      areas: Object.keys(areas).sort(),
      brands: brands,
      assignableSalesUsers: assignableUsersResult.ok ? assignableUsersResult.data : []
    });
  } catch (error) {
    logError('getCustomerFilters', error);
    return fail(error && error.message ? error.message : 'Failed to load customer filters');
  }
}

function getAreas(payload) {
  const filters = getCustomerFilters(payload);
  if (!filters.ok) return filters;
  return success(filters.data && filters.data.areas || []);
}

function getAssignableSalesUsers(payload) {
  try {
    const auth = requireApiUser(payload);
    if (!auth.ok) {
      return auth;
    }
    const usersResult = listUserAccounts();
    if (!usersResult.ok) {
      return usersResult;
    }
    const actor = auth.data || {};
    const actorArea = getCustomerUserArea_(actor);
    const systemWide = isSystemWideCustomerUser_(actor);
    const users = (Array.isArray(usersResult.data) ? usersResult.data : []).map(normalizeUserAccount).filter(function (user) {
      if (!hasRole(user, [USER_ROLES.SALES])) return false;
      if (user.status && user.status !== USER_STATUSES.ACTIVE) return false;
      if (systemWide) return true;
      return actorArea && normalizeString(user.area || user.branch) === normalizeString(actorArea);
    }).map(function (user) {
      return {
        userId: String(user.userId || '').trim(),
        username: String(user.username || '').trim(),
        displayName: String(user.displayName || user.fullName || user.username || '').trim(),
        fullName: String(user.fullName || '').trim(),
        area: String(user.area || user.branch || '').trim(),
        branch: String(user.branch || user.area || '').trim(),
        role: String(user.role || '').trim()
      };
    });
    return success(users);
  } catch (error) {
    logError('getAssignableSalesUsers', error);
    return fail(error && error.message ? error.message : 'Failed to load assignable sales users');
  }
}

function getCustomerSummary(customerId, payload) {
  try {
    const idCheck = requireValue(customerId, 'customerId');
    if (!idCheck.ok) {
      return idCheck;
    }
    const customerResult = getCustomer(customerId, payload);
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

function getCustomerScopeUser_(payloadOrUser) {
  const source = payloadOrUser && typeof payloadOrUser === 'object' ? payloadOrUser : null;
  if (!source) {
    return null;
  }
  if (source.currentUser && typeof source.currentUser === 'object') {
    return source.currentUser;
  }
  if (source.userId || source.username || source.role) {
    return source;
  }
  return null;
}

function getCustomerUserArea_(user) {
  return String(user && (user.area || user.branch) || '').trim();
}

function isSystemWideCustomerUser_(user) {
  if (!user) {
    return true;
  }
  if (hasRole(user, [USER_ROLES.SUPER_ADMIN])) {
    return true;
  }
  if (hasRole(user, [USER_ROLES.SALES])) {
    return false;
  }
  const area = normalizeString(getCustomerUserArea_(user));
  return area === normalizeString('System');
}

function normalizeCustomerSalesArea_(source) {
  const item = source && typeof source === 'object' ? source : {};
  const value = String(item.salesArea || item.ownerArea || item.area || item.branch || '').trim();
  return value || CUSTOMER_UNASSIGNED_AREA;
}

function getSubmittedCustomerSalesArea_(payload, actor, existingCustomer) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const existing = existingCustomer && typeof existingCustomer === 'object' ? existingCustomer : {};
  const explicit = String(data.salesArea || data.area || data.branch || existing.salesArea || existing.area || existing.branch || '').trim();
  if (explicit) {
    return explicit;
  }
  const actorArea = getCustomerUserArea_(actor);
  if (actorArea && normalizeString(actorArea) !== normalizeString('System')) {
    return actorArea;
  }
  return '';
}

function validateCustomerSalesAreaForActor_(actor, salesArea) {
  const targetArea = String(salesArea || '').trim();
  if (!targetArea) {
    return validationError('salesArea is required');
  }
  if (!actor) {
    return success(true);
  }
  if (hasRole(actor, [USER_ROLES.SUPER_ADMIN])) {
    return success(true);
  }
  const actorArea = getCustomerUserArea_(actor);
  if (hasRole(actor, [USER_ROLES.SALES]) && !actorArea) {
    return fail('AREA_SCOPE_VIOLATION', 'AREA_SCOPE_VIOLATION');
  }
  if (!actorArea) {
    return fail('AREA_SCOPE_VIOLATION', 'AREA_SCOPE_VIOLATION');
  }
  if (actorArea && normalizeString(actorArea) !== normalizeString('System') && normalizeString(actorArea) !== normalizeString(targetArea)) {
    return fail('AREA_SCOPE_VIOLATION', 'AREA_SCOPE_VIOLATION');
  }
  return success(true);
}

function canAccessCustomerRecord_(user, customer, options) {
  if (!user) {
    return success(true);
  }
  if (isSystemWideCustomerUser_(user)) {
    return success(true);
  }
  const userArea = getCustomerUserArea_(user);
  if (!userArea) {
    return denyCustomerScopeAccess_(user, customer, 'CUSTOMER_OUTSIDE_ASSIGNED_AREA', options);
  }
  const customerArea = normalizeCustomerSalesArea_(customer);
  if (normalizeString(customerArea) !== normalizeString(userArea)) {
    return denyCustomerScopeAccess_(user, customer, 'CUSTOMER_OUTSIDE_ASSIGNED_AREA', options);
  }
  if (hasRole(user, [USER_ROLES.SALES])) {
    const assignedUserId = String(customer && customer.assignedSalesUserId || '').trim();
    if (assignedUserId && normalizeString(assignedUserId) !== normalizeString(user.userId)) {
      return denyCustomerScopeAccess_(user, customer, 'CUSTOMER_ACCESS_DENIED', options);
    }
  }
  return success(true);
}

function filterCustomersForScope_(customers, user) {
  const list = Array.isArray(customers) ? customers : [];
  if (!user) {
    return list;
  }
  return list.filter(function (customer) {
    return canAccessCustomerRecord_(user, customer, { silent: true }).ok;
  });
}

function parseCustomerBooleanFlag_(value) {
  if (value === true) return true;
  if (value === false) return false;
  const text = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
  if (!text) return null;
  if (text === 'true' || text === 'yes' || text === 'y' || text === '1' || text === 'active') return true;
  if (text === 'false' || text === 'no' || text === 'n' || text === '0' || text === 'inactive' || text === 'disabled') return false;
  return null;
}

function hasCustomerFieldValue_(source, field) {
  return source && Object.prototype.hasOwnProperty.call(source, field) && String(source[field] || '').trim() !== '';
}

function inferCustomerBrandFlags_(source) {
  const item = source && typeof source === 'object' ? source : {};
  var sellsWeber = null;
  var sellsGyproc = null;
  if (hasCustomerFieldValue_(item, 'sellsWeber')) {
    sellsWeber = parseCustomerBooleanFlag_(item.sellsWeber);
  }
  if (hasCustomerFieldValue_(item, 'sellsGyproc')) {
    sellsGyproc = parseCustomerBooleanFlag_(item.sellsGyproc);
  }
  const hints = [
    item.customerType,
    item.type,
    item.brand,
    item.bu,
    item.businessUnit,
    item.quoteType,
    item.group
  ].join(' ').toLowerCase();
  if (sellsWeber === null && hints.indexOf('weber') >= 0) sellsWeber = true;
  if (sellsGyproc === null && hints.indexOf('gyproc') >= 0) sellsGyproc = true;
  if (sellsWeber === null && String(item.defaultWeberDiscount || '').trim() !== '') sellsWeber = true;
  if (sellsGyproc === null && String(item.defaultGyprocDiscount || '').trim() !== '') sellsGyproc = true;
  return {
    sellsWeber: sellsWeber === true,
    sellsGyproc: sellsGyproc === true,
    brandReviewRequired: sellsWeber !== true && sellsGyproc !== true
  };
}

function validateCustomerBooleanInput_(payload, field) {
  const data = payload && typeof payload === 'object' ? payload : {};
  if (!Object.prototype.hasOwnProperty.call(data, field)) {
    return success(true);
  }
  const value = data[field];
  const text = String(value === null || value === undefined ? '' : value).trim();
  if (!text) {
    return success(true);
  }
  return parseCustomerBooleanFlag_(value) === null ? validationError(field + ' must be Boolean') : success(true);
}

function validateCustomerActiveInput_(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  if (!Object.prototype.hasOwnProperty.call(data, 'active')) {
    return success(true);
  }
  const active = parseCustomerActiveFlag_(data.active);
  return active === null ? validationError('active must be Boolean') : success(active);
}

function validateSubmittedCustomerBrands_(payload, existingCustomer, required) {
  const weberCheck = validateCustomerBooleanInput_(payload, 'sellsWeber');
  if (!weberCheck.ok) {
    return weberCheck;
  }
  const gyprocCheck = validateCustomerBooleanInput_(payload, 'sellsGyproc');
  if (!gyprocCheck.ok) {
    return gyprocCheck;
  }
  const merged = Object.assign({}, existingCustomer || {}, payload || {});
  const brands = inferCustomerBrandFlags_(merged);
  if (required && !brands.sellsWeber && !brands.sellsGyproc) {
    return validationError('กรุณาเลือกแบรนด์ที่ร้านค้าจำหน่ายอย่างน้อย 1 รายการ');
  }
  return success(brands);
}

function getCustomerBusinessTypeFromFlags_(sellsWeber, sellsGyproc) {
  if (sellsWeber && sellsGyproc) return 'Gyproc/Weber';
  if (sellsGyproc) return 'Gyproc';
  if (sellsWeber) return 'Weber';
  return '-';
}

function normalizeCustomerAssignedSales_(source) {
  const item = source && typeof source === 'object' ? source : {};
  return {
    assignedSalesUserId: String(item.assignedSalesUserId || item.salesUserId || item.ownerUserId || '').trim(),
    assignedSalesUsername: String(item.assignedSalesUsername || item.assignedSalesName || item.salesUsername || item.ownerUsername || '').trim()
  };
}

function findAssignedSalesUser_(assignedSalesUserId, assignedSalesUsername) {
  const assignedId = String(assignedSalesUserId || '').trim();
  const assignedUsername = String(assignedSalesUsername || '').trim();
  if (!assignedId && !assignedUsername) {
    return success(null);
  }
  if (assignedId && typeof getUserById === 'function') {
    const byId = getUserById(assignedId);
    if (byId.ok) {
      return success(normalizeUserAccount(byId.data));
    }
  }
  if (typeof listUserAccounts !== 'function') {
    return fail('INVALID_ASSIGNED_SALES', 'INVALID_ASSIGNED_SALES', { assignedSalesUserId: assignedId });
  }
  const usersResult = listUserAccounts();
  if (!usersResult.ok) {
    return fail('INVALID_ASSIGNED_SALES', 'INVALID_ASSIGNED_SALES', { assignedSalesUserId: assignedId });
  }
  const normalizedUsername = normalizeString(assignedUsername);
  const user = (Array.isArray(usersResult.data) ? usersResult.data : []).map(normalizeUserAccount).find(function (item) {
    if (assignedId && normalizeString(item.userId) === normalizeString(assignedId)) return true;
    return normalizedUsername && normalizeString(item.username) === normalizedUsername;
  });
  return user ? success(user) : fail('INVALID_ASSIGNED_SALES', 'INVALID_ASSIGNED_SALES', { assignedSalesUserId: assignedId });
}

function validateAssignedSalesForCustomer_(assignedSalesUserId, salesArea, assignedSalesUsername) {
  const userResult = findAssignedSalesUser_(assignedSalesUserId, assignedSalesUsername);
  if (!userResult.ok) {
    return userResult;
  }
  const user = userResult.data;
  if (!user) {
    return success({ assignedSalesUserId: '', assignedSalesUsername: '' });
  }
  const assignedId = String(user.userId || '').trim();
  if (user.status && user.status !== USER_STATUSES.ACTIVE) {
    return fail('ASSIGNED_USER_INACTIVE', 'ASSIGNED_USER_INACTIVE', { assignedSalesUserId: assignedId });
  }
  if (!hasRole(user, [USER_ROLES.SALES])) {
    return fail('INVALID_ASSIGNED_SALES', 'INVALID_ASSIGNED_SALES', { assignedSalesUserId: assignedId });
  }
  const targetArea = String(salesArea || '').trim();
  if (!targetArea) {
    return validationError('salesArea is required');
  }
  if (normalizeString(user.area || user.branch) !== normalizeString(targetArea)) {
    return fail('SALES_AREA_MISMATCH', 'SALES_AREA_MISMATCH', { assignedSalesUserId: assignedId, salesArea: targetArea });
  }
  return success({
    assignedSalesUserId: assignedId,
    assignedSalesUsername: String(user.username || '').trim()
  });
}

function sanitizeCustomerAuditValue_(value) {
  return String(value === null || value === undefined ? '' : value).replace(/[;\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function getCustomerBrandLogValue_(source) {
  const flags = inferCustomerBrandFlags_(source || {});
  if (flags.sellsWeber && flags.sellsGyproc) return 'WEBER+GYPROC';
  if (flags.sellsWeber) return 'WEBER';
  if (flags.sellsGyproc) return 'GYPROC';
  return 'NONE';
}

function buildCustomerAuditDetail_(actor, detail) {
  const data = detail && typeof detail === 'object' ? detail : {};
  const actorId = sanitizeCustomerAuditValue_(data.actorUserId || actor && (actor.userId || actor.username));
  const pairs = [
    ['customerId', data.customerId],
    ['oldArea', data.oldArea],
    ['newArea', data.newArea],
    ['oldBrands', data.oldBrands],
    ['newBrands', data.newBrands],
    ['oldAssignedSalesUserId', data.oldAssignedSalesUserId],
    ['newAssignedSalesUserId', data.newAssignedSalesUserId],
    ['actorUserId', actorId],
    ['timestamp', data.timestamp || new Date().toISOString()],
    ['result', data.result || 'ok']
  ];
  return pairs.map(function (pair) {
    return pair[0] + '=' + sanitizeCustomerAuditValue_(pair[1]);
  }).join(';');
}

function logCustomerAudit_(actor, action, detail) {
  const eventName = String(action || '').trim();
  if (!eventName) {
    return;
  }
  const actorId = String(actor && (actor.userId || actor.username) || '').trim();
  const detailText = buildCustomerAuditDetail_(actor, detail);
  if (typeof logActivity === 'function') {
    logActivity(actorId, eventName, detailText);
  } else {
    logInfo(eventName, detailText);
  }
}

function logCustomerAreaChange_(actor, customerId, oldArea, newArea, action) {
  logCustomerAudit_(actor, action || 'CUSTOMER_AREA_CHANGED', {
    customerId: customerId,
    oldArea: oldArea,
    newArea: newArea
  });
}

function logCustomerBrandChange_(actor, customerId, oldBrands, newBrands) {
  logCustomerAudit_(actor, 'CUSTOMER_BRANDS_CHANGED', {
    customerId: customerId,
    oldBrands: oldBrands,
    newBrands: newBrands
  });
}

function logCustomerAssignedSalesChange_(actor, customerId, oldAssignedSalesUserId, newAssignedSalesUserId) {
  logCustomerAudit_(actor, 'CUSTOMER_ASSIGNED_SALES_CHANGED', {
    customerId: customerId,
    oldAssignedSalesUserId: oldAssignedSalesUserId,
    newAssignedSalesUserId: newAssignedSalesUserId
  });
}

function denyCustomerScopeAccess_(user, customer, code, options) {
  if (!options || !options.silent) {
    logCustomerAudit_(user, 'CUSTOMER_SCOPE_ACCESS_DENIED', {
      customerId: customer && (customer.customerId || customer.customerCode || customer.id),
      newArea: normalizeCustomerSalesArea_(customer),
      result: code
    });
  }
  return fail(code, code);
}

function customerRowToObject_(headers, rowValues) {
  const record = {};
  headers.forEach(function (header, index) {
    if (header) {
      record[header] = rowValues[index] || '';
    }
  });
  return record;
}

function findCustomerAnyStatus_(customerId) {
  const id = String(customerId || '').trim();
  if (!id) {
    return null;
  }
  const result = getSheetData(CUSTOMERS_SHEET);
  if (!result.ok) {
    return null;
  }
  const rows = normalizeCustomerRows_(result.data);
  return rows.find(function (item) {
    return normalizeString(item.customerId || item.customerCode || item.id) === normalizeString(id);
  }) || null;
}

function migrateCustomerAreaAndBrandColumns_(sheet, headers) {
  const result = { updatedRows: 0, brandReviewRows: [] };
  try {
    if (!sheet || sheet.getLastRow() < 2) {
      return result;
    }
    const lastRow = sheet.getLastRow();
    const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
    const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
    const salesAreaIndex = headers.indexOf('salesArea');
    const sellsWeberIndex = headers.indexOf('sellsWeber');
    const sellsGyprocIndex = headers.indexOf('sellsGyproc');
    var changed = false;
    values.forEach(function (row, index) {
      const rowNumber = index + 2;
      const source = customerRowToObject_(headers, row);
      const customerId = String(source.customerId || source.customerCode || source.id || '').trim();
      var rowChanged = false;
      if (salesAreaIndex >= 0 && !String(row[salesAreaIndex] || '').trim()) {
        row[salesAreaIndex] = normalizeCustomerSalesArea_(source);
        rowChanged = true;
      }
      const hasWeber = sellsWeberIndex >= 0 && String(row[sellsWeberIndex] || '').trim() !== '';
      const hasGyproc = sellsGyprocIndex >= 0 && String(row[sellsGyprocIndex] || '').trim() !== '';
      if ((sellsWeberIndex >= 0 || sellsGyprocIndex >= 0) && (!hasWeber || !hasGyproc)) {
        const brands = inferCustomerBrandFlags_(source);
        if (sellsWeberIndex >= 0 && !hasWeber) {
          row[sellsWeberIndex] = brands.sellsWeber ? 'TRUE' : 'FALSE';
          rowChanged = true;
        }
        if (sellsGyprocIndex >= 0 && !hasGyproc) {
          row[sellsGyprocIndex] = brands.sellsGyproc ? 'TRUE' : 'FALSE';
          rowChanged = true;
        }
        if (brands.brandReviewRequired) {
          result.brandReviewRows.push(rowNumber);
          logMalformedCustomerRow_(customerId, rowNumber, 'brand_requires_review');
        }
      }
      if (rowChanged) {
        result.updatedRows += 1;
        changed = true;
      }
    });
    if (changed) {
      sheet.getRange(2, 1, values.length, lastColumn).setValues(values);
      clearCustomerCaches_();
    }
  } catch (error) {
    logError('migrateCustomerAreaAndBrandColumns_', error);
  }
  return result;
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

function normalizeActiveCustomerRowsForScope_(rows, user) {
  const list = Array.isArray(rows) ? rows : [];
  const customers = [];
  list.forEach(function (row, index) {
    const normalized = normalizeCustomerObject(row, index + 2);
    if (normalized && isActiveCustomer(normalized) && canAccessCustomerRecord_(user, normalized, { silent: true }).ok) {
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
    const district = String(source.district || source.amphoe || source.amphur || '').trim();
    const status = String(source.status || '').trim();
    const defaultGyprocDiscount = String(source.defaultGyprocDiscount || '').trim();
    const defaultWeberDiscount = String(source.defaultWeberDiscount || '').trim();
    const notes = String(source.notes || '').trim();
    const address = String(source.address || '').trim();
    const phone = String(source.phone || '-').trim() || '-';
    const brandFlags = inferCustomerBrandFlags_(source);
    const customerType = getCustomerBusinessType(source, brandFlags);
    const active = resolveCustomerActive_(source);
    const salesArea = normalizeCustomerSalesArea_(source);
    const assigned = normalizeCustomerAssignedSales_(source);
    const hasActive = Object.prototype.hasOwnProperty.call(source, 'active') && String(source.active || '').trim() !== '';
    const hasStatus = Object.prototype.hasOwnProperty.call(source, 'status') && String(source.status || '').trim() !== '';
    if (hasActive && parseCustomerActiveFlag_(source.active) === null) {
      logMalformedCustomerRow_(code, rowNumber, 'invalid_active');
    }
    if (!hasActive && hasStatus && parseCustomerActiveFlag_(source.status) === null) {
      logMalformedCustomerRow_(code, rowNumber, 'invalid_status');
    }

    if (hasCustomerFieldValue_(source, 'sellsWeber') && parseCustomerBooleanFlag_(source.sellsWeber) === null) {
      logMalformedCustomerRow_(code, rowNumber, 'invalid_sellsWeber');
    }
    if (hasCustomerFieldValue_(source, 'sellsGyproc') && parseCustomerBooleanFlag_(source.sellsGyproc) === null) {
      logMalformedCustomerRow_(code, rowNumber, 'invalid_sellsGyproc');
    }
    if (brandFlags.brandReviewRequired) {
      logMalformedCustomerRow_(code, rowNumber, 'brand_requires_review');
    }

    return Object.assign({}, source, {
      id: code,
      customerId: code,
      customerCode: code,
      customerName: customerName,
      status: status,
      customerType: customerType,
      salesArea: salesArea,
      area: salesArea,
      assignedSalesUserId: assigned.assignedSalesUserId,
      assignedSalesUsername: assigned.assignedSalesUsername,
      sellsWeber: brandFlags.sellsWeber,
      sellsGyproc: brandFlags.sellsGyproc,
      brandReviewRequired: brandFlags.brandReviewRequired,
      defaultGyprocDiscount: defaultGyprocDiscount,
      defaultWeberDiscount: defaultWeberDiscount,
      notes: notes,
      address: address,
      province: province,
      district: district,
      phone: phone,
      active: active
    });
  } catch (error) {
    const source = row && typeof row === 'object' ? row : {};
    logMalformedCustomerRow_(source.customerId || source.customerCode || source.id || '', rowNumber, 'normalize_error');
    return null;
  }
}

function getCustomerBusinessType(source, brandFlags) {
  const flags = brandFlags || inferCustomerBrandFlags_(source);
  return getCustomerBusinessTypeFromFlags_(flags.sellsWeber, flags.sellsGyproc);
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
