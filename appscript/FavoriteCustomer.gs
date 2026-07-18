const MAX_FAVORITE_CUSTOMERS = 5;

function getFavoriteRows_(timing) {
  const startedAt = Date.now();
  const result = getSheetData(getUserFavoriteCustomersSheetName());
  const rows = result.ok && Array.isArray(result.data) ? result.data : [];
  if (timing && typeof timing === 'object') {
    timing.favoritesReadMs = Date.now() - startedAt;
    timing.favoriteRows = rows.length;
  }
  return rows;
}

function getFavoriteCustomers(payload) {
  const startedAt = Date.now();
  const data = payload && typeof payload === 'object' ? payload : {};
  const requestId = typeof getCustomerApiRequestId_ === 'function' ? getCustomerApiRequestId_(data) : '';
  var authMs = Number(data._authMs || 0);
  var favoritesReadMs = 0;
  try {
    const authStartedAt = Date.now();
    const auth = data.currentUser ? success(data.currentUser) : requireApiUser(data);
    if (!data.currentUser) {
      authMs = Date.now() - authStartedAt;
    }
    if (!auth.ok) {
      if (typeof logCustomerPerformance_ === 'function') {
        logCustomerPerformance_({
          requestId: requestId,
          action: 'getFavoriteCustomers',
          authMs: authMs,
          totalMs: Date.now() - startedAt,
          errorCode: auth.code || 'AUTH_FAILED'
        });
      }
      return auth;
    }
    const userId = String(auth.data.userId || '').trim();
    const favoriteTiming = {};
    const favoriteRows = getFavoriteRows_(favoriteTiming).filter(function (row) {
      return String(row.userId || '').trim() === userId;
    }).sort(function (a, b) {
      return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    });
    favoritesReadMs = favoriteTiming.favoritesReadMs || 0;
    if (!favoriteRows.length) {
      if (typeof logCustomerPerformance_ === 'function') {
        logCustomerPerformance_({
          requestId: requestId,
          action: 'getFavoriteCustomers',
          actor: auth.data,
          authMs: authMs,
          favoritesReadMs: favoritesReadMs,
          favoriteRows: 0,
          returnedRows: 0,
          customersReadMs: 0,
          transformMs: 0,
          scopeFilterMs: 0,
          totalMs: Date.now() - startedAt
        });
      }
      return success([]);
    }
    const favoriteCustomerIds = favoriteRows.map(function (row) {
      return String(row.customerId || '').trim();
    }).filter(Boolean);
    const customersResult = loadScopedActiveCustomers_(auth.data, { customerIds: favoriteCustomerIds });
    if (!customersResult.ok) {
      if (typeof logCustomerPerformance_ === 'function') {
        logCustomerPerformance_({
          requestId: requestId,
          action: 'getFavoriteCustomers',
          actor: auth.data,
          authMs: authMs,
          favoritesReadMs: favoritesReadMs,
          totalMs: Date.now() - startedAt,
          errorCode: customersResult.code || customersResult.message || 'CUSTOMERS_READ_FAILED'
        });
      }
      return customersResult;
    }
    const customerMetrics = customersResult.data || {};
    const customerMap = {};
    (Array.isArray(customerMetrics.customers) ? customerMetrics.customers : []).forEach(function (customer) {
      customerMap[String(customer.customerId || '').trim()] = customer;
    });
    var output;
    if (data && data.idsOnly) {
      output = favoriteRows.map(function (row) {
        return {
          favoriteId: String(row.favoriteId || '').trim(),
          customerId: String(row.customerId || '').trim(),
          sortOrder: Number(row.sortOrder || 0)
        };
      }).filter(function (row) {
        return row.customerId && customerMap[row.customerId];
      });
      if (typeof logCustomerPerformance_ === 'function') {
        logCustomerPerformance_({
          requestId: requestId,
          action: 'getFavoriteCustomers',
          actor: auth.data,
          authMs: authMs,
          customersReadMs: customerMetrics.customersReadMs,
          spreadsheetOpenMs: customerMetrics.spreadsheetOpenMs,
          favoritesReadMs: favoritesReadMs,
          scopeFilterMs: customerMetrics.scopeFilterMs,
          transformMs: customerMetrics.transformMs,
          cache: customerMetrics.cache,
          totalRows: customerMetrics.totalRows,
          candidateRows: customerMetrics.candidateRows,
          visibleRows: customerMetrics.visibleRows,
          favoriteRows: favoriteRows.length,
          returnedRows: output.length,
          totalMs: Date.now() - startedAt
        });
      }
      return success(output);
    }
    output = favoriteRows.filter(function (row) {
      return customerMap[String(row.customerId || '').trim()];
    }).map(function (row) {
      return Object.assign({}, customerMap[String(row.customerId || '').trim()], {
        favoriteId: String(row.favoriteId || '').trim(),
        sortOrder: Number(row.sortOrder || 0)
      });
    });
    if (typeof logCustomerPerformance_ === 'function') {
      logCustomerPerformance_({
        requestId: requestId,
        action: 'getFavoriteCustomers',
        actor: auth.data,
        authMs: authMs,
        customersReadMs: customerMetrics.customersReadMs,
        spreadsheetOpenMs: customerMetrics.spreadsheetOpenMs,
        favoritesReadMs: favoritesReadMs,
        scopeFilterMs: customerMetrics.scopeFilterMs,
        transformMs: customerMetrics.transformMs,
        cache: customerMetrics.cache,
        totalRows: customerMetrics.totalRows,
        candidateRows: customerMetrics.candidateRows,
        visibleRows: customerMetrics.visibleRows,
        favoriteRows: favoriteRows.length,
        returnedRows: output.length,
        totalMs: Date.now() - startedAt
      });
    }
    return success(output);
  } catch (error) {
    logError('getFavoriteCustomers', error);
    if (typeof logCustomerPerformance_ === 'function') {
      logCustomerPerformance_({
        requestId: requestId,
        action: 'getFavoriteCustomers',
        authMs: authMs,
        favoritesReadMs: favoritesReadMs,
        totalMs: Date.now() - startedAt,
        errorCode: error && error.message ? error.message : 'UNKNOWN_ERROR'
      });
    }
    return fail(error && error.message ? error.message : 'Failed to load favorite customers');
  }
}

function addFavoriteCustomer(payload) {
  var lock = null;
  try {
    const auth = requireApiUser(payload);
    if (!auth.ok) return auth;
    const userId = String(auth.data.userId || '').trim();
    const customerId = String(payload && payload.customerId || '').trim();
    if (!customerId) return validationError('customerId is required');
    const customer = getCustomer(customerId, { currentUser: auth.data });
    if (!customer.ok || !isActiveCustomer(customer.data)) return notFound('Customer not found');
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const mine = getFavoriteRows_().filter(function (row) { return String(row.userId || '').trim() === userId; });
    if (mine.some(function (row) { return String(row.customerId || '').trim() === customerId; })) return success(customer.data, 'Already favorite');
    const activeCustomers = getCustomers({ currentUser: auth.data });
    const activeIds = activeCustomers.ok ? activeCustomers.data.map(function (item) { return String(item.customerId || '').trim(); }) : [];
    const activeMine = mine.filter(function (row) { return activeIds.indexOf(String(row.customerId || '').trim()) >= 0; });
    if (activeMine.length >= MAX_FAVORITE_CUSTOMERS) return validationError('สามารถปักร้านค้าโปรดได้สูงสุด 5 ร้าน');
    const now = new Date().toISOString();
    const row = { favoriteId: Utilities.getUuid(), userId: userId, customerId: customerId, sortOrder: activeMine.length + 1, createdAt: now, updatedAt: now };
    const sheet = ensureSheet(getUserFavoriteCustomersSheetName(), getHeadersForSheet(getUserFavoriteCustomersSheetName()));
    if (!sheet) return fail('Unable to access favorites sheet');
    const headers = getHeaders(sheet);
    sheet.appendRow(headers.map(function (header) { return row[header] !== undefined ? row[header] : ''; }));
    logActivity(userId, 'FAVORITE_CUSTOMER_ADDED', 'customerId=' + customerId);
    return success(Object.assign({}, customer.data, row), 'เพิ่มร้านค้าโปรดเรียบร้อย');
  } catch (error) {
    logError('addFavoriteCustomer', error);
    return fail(error && error.message ? error.message : 'Failed to add favorite customer');
  } finally {
    if (lock) try { lock.releaseLock(); } catch (ignore) {}
  }
}

function removeFavoriteCustomer(payload) {
  try {
    const auth = requireApiUser(payload);
    if (!auth.ok) return auth;
    const userId = String(auth.data.userId || '').trim();
    const customerId = String(payload && payload.customerId || '').trim();
    const scopeCheck = getCustomer(customerId, { currentUser: auth.data });
    if (!scopeCheck.ok && (scopeCheck.code === 'CUSTOMER_OUTSIDE_ASSIGNED_AREA' || scopeCheck.code === 'CUSTOMER_ACCESS_DENIED')) return scopeCheck;
    const sheet = ensureSheet(getUserFavoriteCustomersSheetName(), getHeadersForSheet(getUserFavoriteCustomersSheetName()));
    if (!sheet || sheet.getLastRow() < 1) return success({ customerId: customerId }, 'นำร้านค้าออกจากรายการโปรดแล้ว');
    const rows = sheet.getDataRange().getDisplayValues();
    const headers = rows[0] || [];
    const userIndex = headers.indexOf('userId');
    const customerIndex = headers.indexOf('customerId');
    for (var i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][userIndex] || '').trim() === userId && String(rows[i][customerIndex] || '').trim() === customerId) sheet.deleteRow(i + 1);
    }
    logActivity(userId, 'FAVORITE_CUSTOMER_REMOVED', 'customerId=' + customerId);
    return success({ customerId: customerId }, 'นำร้านค้าออกจากรายการโปรดแล้ว');
  } catch (error) {
    logError('removeFavoriteCustomer', error);
    return fail(error && error.message ? error.message : 'Failed to remove favorite customer');
  }
}

function reorderFavoriteCustomers(payload) {
  try {
    const auth = requireApiUser(payload);
    if (!auth.ok) return auth;
    const userId = String(auth.data.userId || '').trim();
    const customerIds = Array.isArray(payload && payload.customerIds) ? payload.customerIds.map(function (id) { return String(id || '').trim(); }).filter(Boolean) : [];
    if (customerIds.length > MAX_FAVORITE_CUSTOMERS || new Set(customerIds).size !== customerIds.length) return validationError('Invalid favorite order');
    const scopedCustomers = getCustomers({ currentUser: auth.data });
    if (!scopedCustomers.ok) return scopedCustomers;
    const scopedIds = scopedCustomers.data.map(function (customer) {
      return String(customer.customerId || '').trim();
    });
    if (customerIds.some(function (customerId) { return scopedIds.indexOf(customerId) < 0; })) return fail('CUSTOMER_OUTSIDE_ASSIGNED_AREA', 'CUSTOMER_OUTSIDE_ASSIGNED_AREA');
    const mine = getFavoriteRows_().filter(function (row) { return String(row.userId || '').trim() === userId; });
    const scopedMine = mine.filter(function (row) { return scopedIds.indexOf(String(row.customerId || '').trim()) >= 0; });
    if (scopedMine.length !== customerIds.length || scopedMine.some(function (row) { return customerIds.indexOf(String(row.customerId || '').trim()) < 0; })) return validationError('Favorite list changed; reload and try again');
    const now = new Date().toISOString();
    customerIds.forEach(function (customerId, index) {
      const row = scopedMine.find(function (item) { return String(item.customerId || '').trim() === customerId; });
      updateRowById(getUserFavoriteCustomersSheetName(), 'favoriteId', row.favoriteId, { sortOrder: index + 1, updatedAt: now });
    });
    logActivity(userId, 'FAVORITE_CUSTOMER_REORDERED', 'customerIds=' + customerIds.join(','));
    return success({ customerIds: customerIds }, 'จัดลำดับร้านค้าโปรดแล้ว');
  } catch (error) {
    logError('reorderFavoriteCustomers', error);
    return fail(error && error.message ? error.message : 'Failed to reorder favorite customers');
  }
}

function removeCustomerFromAllFavorites_(customerId) {
  const sheet = getSheet(getUserFavoriteCustomersSheetName());
  if (!sheet || sheet.getLastRow() < 2) return;
  const rows = sheet.getDataRange().getDisplayValues();
  const customerIndex = (rows[0] || []).indexOf('customerId');
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][customerIndex] || '').trim() === String(customerId || '').trim()) sheet.deleteRow(i + 1);
  }
}
