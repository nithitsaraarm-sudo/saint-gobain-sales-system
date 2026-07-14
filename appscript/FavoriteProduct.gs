const MAX_FAVORITE_PRODUCTS = 20;
const MAX_PINNED_PRODUCTS = 5;

function getFavoriteProductRows_() {
  const result = getSheetData(getUserFavoriteProductsSheetName());
  return result.ok && Array.isArray(result.data) ? result.data : [];
}

function getPinnedProductRows_() {
  const result = getSheetData(getUserPinnedProductsSheetName());
  return result.ok && Array.isArray(result.data) ? result.data : [];
}

function getProductPreferenceProductMap_() {
  const productsResult = getProducts();
  if (!productsResult.ok) return {};
  const map = {};
  (Array.isArray(productsResult.data) ? productsResult.data : []).forEach(function (product) {
    const id = String(product.productId || product.id || product.sku || product.productCode || '').trim();
    if (id) map[normalizeString(id)] = product;
  });
  return map;
}

function getUserProductPreferenceState_(userId) {
  const targetUserId = String(userId || '').trim();
  const favoriteRows = getFavoriteProductRows_().filter(function (row) {
    return String(row.userId || '').trim() === targetUserId;
  });
  const pinnedRows = getPinnedProductRows_().filter(function (row) {
    return String(row.userId || '').trim() === targetUserId;
  }).sort(function (a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
  const favoriteIds = {};
  const pinnedOrders = {};
  favoriteRows.forEach(function (row) {
    favoriteIds[normalizeString(row.productId)] = true;
  });
  pinnedRows.forEach(function (row, index) {
    pinnedOrders[normalizeString(row.productId)] = Number(row.sortOrder || index + 1);
  });
  return {
    favoriteRows: favoriteRows,
    pinnedRows: pinnedRows,
    favoriteIds: favoriteIds,
    pinnedOrders: pinnedOrders
  };
}

function decorateProductPreference_(product, state) {
  const id = normalizeString(product && (product.productId || product.id || product.sku || product.productCode));
  const pinnedOrder = state && state.pinnedOrders ? state.pinnedOrders[id] : 0;
  const isFavorite = Boolean(state && state.favoriteIds && state.favoriteIds[id]);
  return Object.assign({}, product, {
    isFavoriteProduct: isFavorite,
    isPinnedProduct: Boolean(pinnedOrder),
    pinnedSortOrder: pinnedOrder || ''
  });
}

function productPreferenceRowsToProducts_(rows, state, productMap) {
  return rows.map(function (row) {
    const product = productMap[normalizeString(row.productId)];
    if (!product) return null;
    return decorateProductPreference_(Object.assign({}, product, {
      productBusinessUnit: product.productBusinessUnit || row.productBusinessUnit || getProductBusinessUnit(product),
      businessUnit: product.businessUnit || row.productBusinessUnit || getProductBusinessUnit(product)
    }), state);
  }).filter(function (item) {
    return item;
  });
}

function getProductPreferences(payload) {
  try {
    const auth = requireApiUser(payload);
    if (!auth.ok) return auth;
    const userId = String(auth.data.userId || '').trim();
    const state = getUserProductPreferenceState_(userId);
    const productMap = getProductPreferenceProductMap_();
    return success({
      favorites: productPreferenceRowsToProducts_(state.favoriteRows, state, productMap),
      pinned: productPreferenceRowsToProducts_(state.pinnedRows, state, productMap),
      favoriteProductIds: Object.keys(state.favoriteIds),
      pinnedProductIds: Object.keys(state.pinnedOrders)
    });
  } catch (error) {
    logError('getProductPreferences', error);
    return fail(error && error.message ? error.message : 'Failed to load product preferences');
  }
}

function addFavoriteProduct(payload) {
  var lock = null;
  try {
    const auth = requireApiUser(payload);
    if (!auth.ok) return auth;
    const userId = String(auth.data.userId || '').trim();
    const productId = String(payload && payload.productId || '').trim();
    if (!productId) return validationError('productId is required');
    const productResult = getProduct(productId);
    if (!productResult.ok) return productResult;
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const state = getUserProductPreferenceState_(userId);
    if (state.favoriteIds[normalizeString(productId)]) {
      return success(decorateProductPreference_(productResult.data, state), 'Already favorite');
    }
    if (state.favoriteRows.length >= MAX_FAVORITE_PRODUCTS) {
      return validationError('สามารถเพิ่มสินค้ารายการโปรดได้สูงสุด ' + MAX_FAVORITE_PRODUCTS + ' รายการ');
    }
    const now = new Date().toISOString();
    const row = {
      favoriteId: Utilities.getUuid(),
      userId: userId,
      productId: String(productResult.data.productId || productId).trim(),
      productBusinessUnit: getProductBusinessUnit(productResult.data),
      createdAt: now,
      updatedAt: now
    };
    const sheet = ensureSheet(getUserFavoriteProductsSheetName(), getHeadersForSheet(getUserFavoriteProductsSheetName()));
    if (!sheet) return fail('Unable to access favorite products sheet');
    const headers = getHeaders(sheet);
    sheet.appendRow(headers.map(function (header) { return row[header] !== undefined ? row[header] : ''; }));
    logActivity(userId, 'FAVORITE_PRODUCT_ADDED', 'productId=' + row.productId);
    return success(decorateProductPreference_(productResult.data, getUserProductPreferenceState_(userId)), 'เพิ่มสินค้ารายการโปรดแล้ว');
  } catch (error) {
    logError('addFavoriteProduct', error);
    return fail(error && error.message ? error.message : 'Failed to add favorite product');
  } finally {
    if (lock) try { lock.releaseLock(); } catch (ignore) {}
  }
}

function removeFavoriteProduct(payload) {
  try {
    const auth = requireApiUser(payload);
    if (!auth.ok) return auth;
    const userId = String(auth.data.userId || '').trim();
    const productId = String(payload && payload.productId || '').trim();
    const sheet = ensureSheet(getUserFavoriteProductsSheetName(), getHeadersForSheet(getUserFavoriteProductsSheetName()));
    if (!sheet || sheet.getLastRow() < 2) return success({ productId: productId });
    const rows = sheet.getDataRange().getDisplayValues();
    const headers = rows[0] || [];
    const userIndex = headers.indexOf('userId');
    const productIndex = headers.indexOf('productId');
    for (var i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][userIndex] || '').trim() === userId && normalizeString(rows[i][productIndex]) === normalizeString(productId)) {
        sheet.deleteRow(i + 1);
      }
    }
    logActivity(userId, 'FAVORITE_PRODUCT_REMOVED', 'productId=' + productId);
    return success({ productId: productId }, 'นำสินค้าออกจากรายการโปรดแล้ว');
  } catch (error) {
    logError('removeFavoriteProduct', error);
    return fail(error && error.message ? error.message : 'Failed to remove favorite product');
  }
}

function addPinnedProduct(payload) {
  var lock = null;
  try {
    const auth = requireApiUser(payload);
    if (!auth.ok) return auth;
    const userId = String(auth.data.userId || '').trim();
    const productId = String(payload && payload.productId || '').trim();
    if (!productId) return validationError('productId is required');
    const productResult = getProduct(productId);
    if (!productResult.ok) return productResult;
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const state = getUserProductPreferenceState_(userId);
    if (state.pinnedOrders[normalizeString(productId)]) {
      return success(decorateProductPreference_(productResult.data, state), 'Already pinned');
    }
    if (state.pinnedRows.length >= MAX_PINNED_PRODUCTS) {
      return validationError('สามารถปักหมุดสินค้าได้สูงสุด ' + MAX_PINNED_PRODUCTS + ' รายการ');
    }
    const now = new Date().toISOString();
    const row = {
      pinnedId: Utilities.getUuid(),
      userId: userId,
      productId: String(productResult.data.productId || productId).trim(),
      productBusinessUnit: getProductBusinessUnit(productResult.data),
      sortOrder: state.pinnedRows.length + 1,
      createdAt: now,
      updatedAt: now
    };
    const sheet = ensureSheet(getUserPinnedProductsSheetName(), getHeadersForSheet(getUserPinnedProductsSheetName()));
    if (!sheet) return fail('Unable to access pinned products sheet');
    const headers = getHeaders(sheet);
    sheet.appendRow(headers.map(function (header) { return row[header] !== undefined ? row[header] : ''; }));
    logActivity(userId, 'PINNED_PRODUCT_ADDED', 'productId=' + row.productId);
    return success(decorateProductPreference_(productResult.data, getUserProductPreferenceState_(userId)), 'ปักหมุดสินค้าแล้ว');
  } catch (error) {
    logError('addPinnedProduct', error);
    return fail(error && error.message ? error.message : 'Failed to pin product');
  } finally {
    if (lock) try { lock.releaseLock(); } catch (ignore) {}
  }
}

function removePinnedProduct(payload) {
  try {
    const auth = requireApiUser(payload);
    if (!auth.ok) return auth;
    const userId = String(auth.data.userId || '').trim();
    const productId = String(payload && payload.productId || '').trim();
    const sheet = ensureSheet(getUserPinnedProductsSheetName(), getHeadersForSheet(getUserPinnedProductsSheetName()));
    if (!sheet || sheet.getLastRow() < 2) return success({ productId: productId });
    const rows = sheet.getDataRange().getDisplayValues();
    const headers = rows[0] || [];
    const userIndex = headers.indexOf('userId');
    const productIndex = headers.indexOf('productId');
    for (var i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][userIndex] || '').trim() === userId && normalizeString(rows[i][productIndex]) === normalizeString(productId)) {
        sheet.deleteRow(i + 1);
      }
    }
    normalizePinnedProductOrder_(userId);
    logActivity(userId, 'PINNED_PRODUCT_REMOVED', 'productId=' + productId);
    return success({ productId: productId }, 'ยกเลิกปักหมุดสินค้าแล้ว');
  } catch (error) {
    logError('removePinnedProduct', error);
    return fail(error && error.message ? error.message : 'Failed to unpin product');
  }
}

function reorderPinnedProducts(payload) {
  try {
    const auth = requireApiUser(payload);
    if (!auth.ok) return auth;
    const userId = String(auth.data.userId || '').trim();
    const productIds = Array.isArray(payload && payload.productIds) ? payload.productIds.map(function (id) {
      return String(id || '').trim();
    }).filter(Boolean) : [];
    if (productIds.length > MAX_PINNED_PRODUCTS || new Set(productIds.map(normalizeString)).size !== productIds.length) {
      return validationError('Invalid pinned product order');
    }
    const mine = getPinnedProductRows_().filter(function (row) { return String(row.userId || '').trim() === userId; });
    if (mine.length !== productIds.length || mine.some(function (row) { return productIds.map(normalizeString).indexOf(normalizeString(row.productId)) < 0; })) {
      return validationError('Pinned list changed; reload and try again');
    }
    const now = new Date().toISOString();
    productIds.forEach(function (productId, index) {
      const row = mine.find(function (item) { return normalizeString(item.productId) === normalizeString(productId); });
      updateRowById(getUserPinnedProductsSheetName(), 'pinnedId', row.pinnedId, { sortOrder: index + 1, updatedAt: now });
    });
    logActivity(userId, 'PINNED_PRODUCT_REORDERED', 'count=' + productIds.length);
    return success({ productIds: productIds }, 'จัดลำดับสินค้าปักหมุดแล้ว');
  } catch (error) {
    logError('reorderPinnedProducts', error);
    return fail(error && error.message ? error.message : 'Failed to reorder pinned products');
  }
}

function normalizePinnedProductOrder_(userId) {
  const rows = getPinnedProductRows_().filter(function (row) {
    return String(row.userId || '').trim() === String(userId || '').trim();
  }).sort(function (a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
  rows.forEach(function (row, index) {
    updateRowById(getUserPinnedProductsSheetName(), 'pinnedId', row.pinnedId, { sortOrder: index + 1, updatedAt: new Date().toISOString() });
  });
}

function removeProductFromAllPreferences_(productId) {
  [getUserFavoriteProductsSheetName(), getUserPinnedProductsSheetName()].forEach(function (sheetName) {
    const sheet = getSheet(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;
    const rows = sheet.getDataRange().getDisplayValues();
    const productIndex = (rows[0] || []).indexOf('productId');
    for (var i = rows.length - 1; i >= 1; i--) {
      if (normalizeString(rows[i][productIndex]) === normalizeString(productId)) sheet.deleteRow(i + 1);
    }
  });
}
