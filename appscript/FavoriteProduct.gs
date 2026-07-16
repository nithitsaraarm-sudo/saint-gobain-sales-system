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
    getProductPreferenceProductReferences_(product).forEach(function (id) {
      map[normalizeString(id)] = product;
    });
  });
  return map;
}

function getProductPreferenceProductReferences_(product) {
  const item = product && typeof product === 'object' ? product : {};
  const values = [item.productId, item.sku, item.productCode, item.id, item.itemCode];
  const seen = {};
  return values.map(function (value) {
    return String(value || '').trim();
  }).filter(function (value) {
    const key = normalizeString(value);
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function resolveProductPreferenceProduct_(productReference) {
  const reference = String(productReference || '').trim();
  if (!reference) return validationError('productId is required');
  const productResult = getProduct(reference);
  if (!productResult.ok) {
    logWarning('resolveProductPreferenceProduct_', 'PRODUCT_REFERENCE_NOT_FOUND reference=' + reference);
    return productResult;
  }
  const product = productResult.data || {};
  const canonicalProductId = String(product.productId || product.sku || product.productCode || product.id || reference).trim();
  return success({
    product: product,
    productId: canonicalProductId,
    productBusinessUnit: getProductBusinessUnit(product),
    reference: reference
  });
}

function getProductPreferenceCanonicalId_(productReference, productMap) {
  const reference = String(productReference || '').trim();
  if (!reference) return '';
  const product = productMap && productMap[normalizeString(reference)];
  if (!product) return reference;
  return String(product.productId || product.sku || product.productCode || product.id || product.itemCode || reference).trim();
}

function productPreferenceReferenceMatches_(rowProductId, productReference, productMap) {
  const rowReference = String(rowProductId || '').trim();
  const targetReference = String(productReference || '').trim();
  if (!rowReference || !targetReference) return false;
  if (normalizeString(rowReference) === normalizeString(targetReference)) return true;
  return normalizeString(getProductPreferenceCanonicalId_(rowReference, productMap)) === normalizeString(getProductPreferenceCanonicalId_(targetReference, productMap));
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
  const id = normalizeString(product && (product.productId || product.id || product.sku || product.productCode || product.itemCode));
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

function repairUserProductPreferenceRows_(userId, state, productMap) {
  const result = { repaired: 0, unresolved: [] };
  const now = new Date().toISOString();
  function repairRows(sheetName, rowIdColumn, rows) {
    rows.forEach(function (row) {
      const reference = String(row.productId || '').trim();
      if (!reference) return;
      const product = productMap[normalizeString(reference)];
      if (!product) {
        result.unresolved.push(reference);
        return;
      }
      const canonicalProductId = String(product.productId || product.sku || product.productCode || product.id || reference).trim();
      const productBusinessUnit = getProductBusinessUnit(product);
      if (!canonicalProductId || normalizeString(canonicalProductId) === normalizeString(reference)) return;
      const rowId = String(row[rowIdColumn] || '').trim();
      if (!rowId) return;
      const updateResult = updateRowById(sheetName, rowIdColumn, rowId, {
        productId: canonicalProductId,
        productBusinessUnit: productBusinessUnit,
        updatedAt: now
      });
      if (updateResult.ok) {
        row.productId = canonicalProductId;
        row.productBusinessUnit = productBusinessUnit;
        result.repaired += 1;
      }
    });
  }
  repairRows(getUserFavoriteProductsSheetName(), 'favoriteId', state.favoriteRows || []);
  repairRows(getUserPinnedProductsSheetName(), 'pinnedId', state.pinnedRows || []);
  if (result.repaired || result.unresolved.length) {
    logInfo('repairUserProductPreferenceRows_', 'userId=' + String(userId || '').trim() + ';repaired=' + result.repaired + ';unresolved=' + result.unresolved.length);
  }
  return result;
}

function getProductPreferences(payload) {
  try {
    const auth = requireApiUser(payload);
    if (!auth.ok) return auth;
    const userId = String(auth.data.userId || '').trim();
    var state = getUserProductPreferenceState_(userId);
    const productMap = getProductPreferenceProductMap_();
    const repair = repairUserProductPreferenceRows_(userId, state, productMap);
    if (repair.repaired) {
      state = getUserProductPreferenceState_(userId);
    }
    return success({
      favorites: productPreferenceRowsToProducts_(state.favoriteRows, state, productMap),
      pinned: productPreferenceRowsToProducts_(state.pinnedRows, state, productMap),
      favoriteProductIds: Object.keys(state.favoriteIds),
      pinnedProductIds: Object.keys(state.pinnedOrders),
      repair: repair
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
    const productReference = String(payload && payload.productId || '').trim();
    const resolvedProduct = resolveProductPreferenceProduct_(productReference);
    if (!resolvedProduct.ok) return resolvedProduct;
    const productResult = { ok: true, data: resolvedProduct.data.product };
    const productId = resolvedProduct.data.productId;
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const state = getUserProductPreferenceState_(userId);
    if (state.favoriteIds[normalizeString(productId)] || state.favoriteIds[normalizeString(productReference)]) {
      return success(decorateProductPreference_(productResult.data, state), 'Already favorite');
    }
    if (state.favoriteRows.length >= MAX_FAVORITE_PRODUCTS) {
      return validationError('สามารถเพิ่มสินค้ารายการโปรดได้สูงสุด ' + MAX_FAVORITE_PRODUCTS + ' รายการ');
    }
    const now = new Date().toISOString();
    const row = {
      favoriteId: Utilities.getUuid(),
      userId: userId,
      productId: productId,
      productBusinessUnit: resolvedProduct.data.productBusinessUnit,
      createdAt: now,
      updatedAt: now
    };
    const sheet = ensureSheet(getUserFavoriteProductsSheetName(), getHeadersForSheet(getUserFavoriteProductsSheetName()));
    if (!sheet) return fail('Unable to access favorite products sheet');
    const headers = getHeaders(sheet);
    sheet.appendRow(headers.map(function (header) { return row[header] !== undefined ? row[header] : ''; }));
    logActivity(userId, 'FAVORITE_PRODUCT_ADDED', 'productId=' + row.productId + ';reference=' + resolvedProduct.data.reference);
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
    const productMap = getProductPreferenceProductMap_();
    const sheet = ensureSheet(getUserFavoriteProductsSheetName(), getHeadersForSheet(getUserFavoriteProductsSheetName()));
    if (!sheet || sheet.getLastRow() < 2) return success({ productId: productId });
    const rows = sheet.getDataRange().getDisplayValues();
    const headers = rows[0] || [];
    const userIndex = headers.indexOf('userId');
    const productIndex = headers.indexOf('productId');
    for (var i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][userIndex] || '').trim() === userId && productPreferenceReferenceMatches_(rows[i][productIndex], productId, productMap)) {
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
    const productReference = String(payload && payload.productId || '').trim();
    const resolvedProduct = resolveProductPreferenceProduct_(productReference);
    if (!resolvedProduct.ok) return resolvedProduct;
    const productResult = { ok: true, data: resolvedProduct.data.product };
    const productId = resolvedProduct.data.productId;
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const state = getUserProductPreferenceState_(userId);
    if (state.pinnedOrders[normalizeString(productId)] || state.pinnedOrders[normalizeString(productReference)]) {
      return success(decorateProductPreference_(productResult.data, state), 'Already pinned');
    }
    if (state.pinnedRows.length >= MAX_PINNED_PRODUCTS) {
      return validationError('สามารถปักหมุดสินค้าได้สูงสุด ' + MAX_PINNED_PRODUCTS + ' รายการ');
    }
    const now = new Date().toISOString();
    const row = {
      pinnedId: Utilities.getUuid(),
      userId: userId,
      productId: productId,
      productBusinessUnit: resolvedProduct.data.productBusinessUnit,
      sortOrder: state.pinnedRows.length + 1,
      createdAt: now,
      updatedAt: now
    };
    const sheet = ensureSheet(getUserPinnedProductsSheetName(), getHeadersForSheet(getUserPinnedProductsSheetName()));
    if (!sheet) return fail('Unable to access pinned products sheet');
    const headers = getHeaders(sheet);
    sheet.appendRow(headers.map(function (header) { return row[header] !== undefined ? row[header] : ''; }));
    logActivity(userId, 'PINNED_PRODUCT_ADDED', 'productId=' + row.productId + ';reference=' + resolvedProduct.data.reference);
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
    const productMap = getProductPreferenceProductMap_();
    const sheet = ensureSheet(getUserPinnedProductsSheetName(), getHeadersForSheet(getUserPinnedProductsSheetName()));
    if (!sheet || sheet.getLastRow() < 2) return success({ productId: productId });
    const rows = sheet.getDataRange().getDisplayValues();
    const headers = rows[0] || [];
    const userIndex = headers.indexOf('userId');
    const productIndex = headers.indexOf('productId');
    for (var i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][userIndex] || '').trim() === userId && productPreferenceReferenceMatches_(rows[i][productIndex], productId, productMap)) {
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
    const productMap = getProductPreferenceProductMap_();
    const canonicalProductIds = productIds.map(function (productId) {
      return getProductPreferenceCanonicalId_(productId, productMap);
    });
    if (productIds.length > MAX_PINNED_PRODUCTS || new Set(canonicalProductIds.map(normalizeString)).size !== productIds.length) {
      return validationError('Invalid pinned product order');
    }
    const mine = getPinnedProductRows_().filter(function (row) { return String(row.userId || '').trim() === userId; });
    const canonicalOrderSet = canonicalProductIds.map(normalizeString);
    if (mine.length !== productIds.length || mine.some(function (row) { return canonicalOrderSet.indexOf(normalizeString(getProductPreferenceCanonicalId_(row.productId, productMap))) < 0; })) {
      return validationError('Pinned list changed; reload and try again');
    }
    const now = new Date().toISOString();
    productIds.forEach(function (productId, index) {
      const row = mine.find(function (item) { return productPreferenceReferenceMatches_(item.productId, productId, productMap); });
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
  const productMap = getProductPreferenceProductMap_();
  [getUserFavoriteProductsSheetName(), getUserPinnedProductsSheetName()].forEach(function (sheetName) {
    const sheet = getSheet(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;
    const rows = sheet.getDataRange().getDisplayValues();
    const productIndex = (rows[0] || []).indexOf('productId');
    for (var i = rows.length - 1; i >= 1; i--) {
      if (productPreferenceReferenceMatches_(rows[i][productIndex], productId, productMap)) sheet.deleteRow(i + 1);
    }
  });
}
