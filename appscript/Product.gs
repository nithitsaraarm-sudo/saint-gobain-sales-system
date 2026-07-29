function getProducts() {
  const timer = startPerformanceTimer('products');
  try {
    const result = getSheetData(PRODUCT_SHEET);
    if (!result.ok) {
      logWarning('getProducts', 'Unable to read Products sheet');
      endPerformanceTimer(timer, 'ok=false');
      return success([]);
    }
    const products = Array.isArray(result.data) ? result.data.map(normalizeProductObject) : [];
    const activeProducts = filterActiveProducts(products);
    endPerformanceTimer(timer, 'count=' + activeProducts.length);
    return success(activeProducts);
  } catch (error) {
    endPerformanceTimer(timer, 'error=true');
    logError('getProducts', error);
    return fail(error && error.message ? error.message : 'Failed to load products');
  }
}

function getProduct(productId) {
  try {
    const idCheck = requireValue(productId, 'productId');
    if (!idCheck.ok) {
      return idCheck;
    }
    const result = getSheetData(PRODUCT_SHEET);
    if (!result.ok) {
      logWarning('getProduct', 'Unable to read Products sheet');
      return fail('Unable to load product');
    }
    const products = Array.isArray(result.data) ? result.data.map(normalizeProductObject) : [];
    const normalizedProductId = normalizeString(productId);
    const product = products.find(function (item) {
      return normalizedProductId === normalizeString(item.productId || item.id || item.sku || item.productCode);
    });
    if (!product) {
      logWarning('getProduct', 'Product not found: ' + productId);
      return notFound('Product not found');
    }
    return success(product);
  } catch (error) {
    logError('getProduct', error);
    return fail(error && error.message ? error.message : 'Failed to load product');
  }
}

function searchProducts(keyword) {
  try {
    const query = normalizeString(keyword);
    if (!query) {
      return getProducts();
    }
    const productsResult = getProducts();
    if (!productsResult.ok) {
      return productsResult;
    }
    const products = Array.isArray(productsResult.data) ? productsResult.data : [];
    const matches = products.filter(function (item) {
      return [
        item.productId,
        item.productName,
        item.description,
        item.brand,
        item.discountGroup,
        item.groupCode,
        item.unit,
        item.promoText
      ].some(function (field) {
        return normalizeString(field).indexOf(query) >= 0;
      });
    });
    return success(matches);
  } catch (error) {
    logError('searchProducts', error);
    return fail(error && error.message ? error.message : 'Product search failed');
  }
}

function normalizeProductBusinessUnit(value) {
  const text = String(value || '').trim().toUpperCase();
  if (text.indexOf('GYPROC') >= 0) {
    return 'GYPROC';
  }
  if (text.indexOf('WEBER') >= 0) {
    return 'WEBER';
  }
  return '';
}

function getProductBusinessUnit(product) {
  const item = product && typeof product === 'object' ? product : {};
  return normalizeProductBusinessUnit(item.businessUnit || item.quoteType || item.bu || item.brand);
}

function isProductInBusinessUnit(product, businessUnit) {
  const target = normalizeProductBusinessUnit(businessUnit);
  const productUnit = getProductBusinessUnit(product);
  return Boolean(target && productUnit && target === productUnit);
}

function getQuoteProductSearchRank(product, query) {
  const q = normalizeString(query);
  if (!q) {
    return 1000;
  }
  const sku = normalizeString(product.productId || product.sku || product.productCode || product.id);
  const name = normalizeString(product.productName || product.name);
  const brand = normalizeString(product.brand);
  const description = normalizeString(product.description || product.itemDesc);
  if (sku === q) return 0;
  if (name === q) return 1;
  if (name.indexOf(q) === 0) return 2;
  if (name.indexOf(q) >= 0) return 3;
  if (brand.indexOf(q) >= 0 || description.indexOf(q) >= 0) return 4;
  return 9;
}

function getQuoteProductBusinessUnitPriority(product, primaryBusinessUnit) {
  const primary = normalizeProductBusinessUnit(primaryBusinessUnit);
  const productUnit = getProductBusinessUnit(product);
  if (!primary || !productUnit) {
    return 2;
  }
  return productUnit === primary ? 0 : 1;
}

function searchQuoteProducts(payload) {
  try {
    const data = payload && typeof payload === 'object' ? payload : { query: payload };
    const primaryBusinessUnit = normalizeProductBusinessUnit(data.primaryBusinessUnit || data.businessUnit || data.quoteType || data.bu);
    if (!primaryBusinessUnit) {
      return validationError('primaryBusinessUnit must be WEBER or GYPROC');
    }
    const query = normalizeString(data.query || data.keyword || '');
    const searchScope = String(data.searchScope || 'ALL_BU').trim().toUpperCase();
    const limit = Math.max(1, Math.min(parseInt(data.limit || 30, 10) || 30, 30));
    const currentUser = data.currentUser || {};
    const preferenceState = currentUser && currentUser.userId && typeof getUserProductPreferenceState_ === 'function'
      ? getUserProductPreferenceState_(currentUser.userId)
      : null;
    const productsResult = getProducts();
    if (!productsResult.ok) {
      return productsResult;
    }
    const products = Array.isArray(productsResult.data) ? productsResult.data : [];
    const fields = ['productId', 'sku', 'productName', 'description', 'brand', 'discountGroup', 'groupCode', 'unit', 'promoText'];
    const matches = products.filter(function (item) {
      const productBusinessUnit = getProductBusinessUnit(item);
      if (!productBusinessUnit) {
        return false;
      }
      if (searchScope === 'PRIMARY_BU' && productBusinessUnit !== primaryBusinessUnit) {
        return false;
      }
      if (!query) {
        return true;
      }
      return fields.some(function (field) {
        return normalizeString(item[field]).indexOf(query) >= 0;
      });
    }).sort(function (a, b) {
      const aId = normalizeString(a.productId || a.id || a.sku || a.productCode);
      const bId = normalizeString(b.productId || b.id || b.sku || b.productCode);
      const aPinned = preferenceState && preferenceState.pinnedOrders ? Number(preferenceState.pinnedOrders[aId] || 0) : 0;
      const bPinned = preferenceState && preferenceState.pinnedOrders ? Number(preferenceState.pinnedOrders[bId] || 0) : 0;
      if (aPinned && bPinned && aPinned !== bPinned) return aPinned - bPinned;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      const aFavorite = preferenceState && preferenceState.favoriteIds && preferenceState.favoriteIds[aId] ? 1 : 0;
      const bFavorite = preferenceState && preferenceState.favoriteIds && preferenceState.favoriteIds[bId] ? 1 : 0;
      if (aFavorite !== bFavorite) return bFavorite - aFavorite;
      const unitDiff = getQuoteProductBusinessUnitPriority(a, primaryBusinessUnit) - getQuoteProductBusinessUnitPriority(b, primaryBusinessUnit);
      if (unitDiff !== 0) {
        return unitDiff;
      }
      const rankDiff = getQuoteProductSearchRank(a, query) - getQuoteProductSearchRank(b, query);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return String(a.productName || '').localeCompare(String(b.productName || ''));
    }).map(function (item) {
      const decorated = preferenceState && typeof decorateProductPreference_ === 'function'
        ? decorateProductPreference_(item, preferenceState)
        : Object.assign({}, item);
      return Object.assign({}, decorated, {
        productBusinessUnit: getProductBusinessUnit(item)
      });
    });
    return success({
      primaryBusinessUnit: primaryBusinessUnit,
      searchScope: searchScope,
      products: matches.slice(0, limit),
      total: matches.length,
      limited: matches.length > limit
    });
  } catch (error) {
    logError('searchQuoteProducts', error);
    return fail(error && error.message ? error.message : 'Quote product search failed');
  }
}

function getProductsByBrand(brand) {
  try {
    const brandValue = normalizeString(brand);
    if (!brandValue) {
      return success([]);
    }
    const productsResult = getProducts();
    if (!productsResult.ok) {
      return productsResult;
    }
    const products = Array.isArray(productsResult.data) ? productsResult.data : [];
    const matches = products.filter(function (item) {
      return normalizeString(item.brand) === brandValue;
    });
    return success(matches);
  } catch (error) {
    logError('getProductsByBrand', error);
    return fail(error && error.message ? error.message : 'Failed to load products by brand');
  }
}

function getProductsByGroup(groupCode) {
  try {
    const groupValue = normalizeString(groupCode);
    if (!groupValue) {
      return success([]);
    }
    const productsResult = getProducts();
    if (!productsResult.ok) {
      return productsResult;
    }
    const products = Array.isArray(productsResult.data) ? productsResult.data : [];
    const matches = products.filter(function (item) {
      return normalizeString(item.groupCode || item.group) === groupValue;
    });
    return success(matches);
  } catch (error) {
    logError('getProductsByGroup', error);
    return fail(error && error.message ? error.message : 'Failed to load products by group');
  }
}

function saveProduct(payload) {
  try {
    const data = payload || {};
    const check = validatePayload(data, ['productName', 'listPrice']);
    if (!check.ok) {
      return check;
    }
    const productId = String(data.productId || data.sku || data.productCode || generateId('PROD')).trim();
    const now = new Date().toISOString();
    const row = {
      productId: productId,
      sku: productId,
      productCode: productId,
      itemName: String(data.productName || data.itemName || '').trim(),
      itemDesc: String(data.description || data.itemDesc || '').trim(),
      brand: String(data.brand || '').trim(),
      discountGroup: String(data.discountGroup || '').trim(),
      unit: String(data.unit || '').trim(),
      groupCode: String(data.groupCode || data.group || '').trim(),
      listPrice: String(data.listPrice || 0),
      imageUrl: String(data.imageUrl || ''),
      notes: String(data.notes || ''),
      promoText: normalizeProductPromoText_(getProductPromoTextValue_(data)),
      active: 'TRUE',
      createdAt: now,
      updatedAt: now
    };
    const result = appendRow(PRODUCT_SHEET, row);
    if (!result.ok) {
      return result;
    }
    logInfo('saveProduct', 'Product saved ' + productId);
    return success(row, 'Product saved');
  } catch (error) {
    logError('saveProduct', error);
    return fail(error && error.message ? error.message : 'Failed to save product');
  }
}

function getFavoriteProducts(customerId) {
  try {
    const idCheck = requireValue(customerId, 'customerId');
    if (!idCheck.ok) {
      return idCheck;
    }
    const productsResult = getProducts();
    if (!productsResult.ok) {
      return productsResult;
    }
    const products = Array.isArray(productsResult.data) ? productsResult.data : [];
    const frequentResult = getSheetData(CUSTOMER_FREQUENT_PRODUCTS_SHEET);
    if (!frequentResult.ok) {
      logWarning('getFavoriteProducts', 'Unable to read CustomerFrequentProducts sheet');
      return success([]);
    }
    const rows = Array.isArray(frequentResult.data) ? frequentResult.data : [];
    const favoriteIds = uniqueStrings(rows.filter(function (item) {
      const sameCustomer = normalizeString(item.customerId) === normalizeString(customerId);
      const favoriteFlag = normalizeString(item.favorite || item.isFavorite || item.type) === 'true' || normalizeString(item.type) === 'favorite';
      return sameCustomer && (favoriteFlag || !item.type);
    }).map(function (item) {
      return extractProductId(item);
    }));
    const favorites = favoriteIds.map(function (productId) {
      return findProductById(productId, products);
    }).filter(function (item) {
      return item;
    });
    return success(favorites);
  } catch (error) {
    logError('getFavoriteProducts', error);
    return fail(error && error.message ? error.message : 'Failed to load favorite products');
  }
}

function getRecentProducts(customerId) {
  try {
    const idCheck = requireValue(customerId, 'customerId');
    if (!idCheck.ok) {
      return idCheck;
    }
    const productsResult = getProducts();
    if (!productsResult.ok) {
      return productsResult;
    }
    const products = Array.isArray(productsResult.data) ? productsResult.data : [];
    const frequentResult = getSheetData(CUSTOMER_FREQUENT_PRODUCTS_SHEET);
    if (!frequentResult.ok) {
      logWarning('getRecentProducts', 'Unable to read CustomerFrequentProducts sheet');
      return success([]);
    }
    const rows = Array.isArray(frequentResult.data) ? frequentResult.data : [];
    const recentRecords = rows.filter(function (item) {
      return normalizeString(item.customerId) === normalizeString(customerId);
    }).map(function (item) {
      return {
        productId: extractProductId(item),
        timestamp: extractTimestamp(item)
      };
    }).filter(function (item) {
      return item.productId;
    }).sort(function (a, b) {
      return b.timestamp - a.timestamp;
    });
    const uniqueRecentIds = uniqueStrings(recentRecords.map(function (item) {
      return item.productId;
    }));
    const recentProducts = uniqueRecentIds.map(function (productId) {
      return findProductById(productId, products);
    }).filter(function (item) {
      return item;
    });
    return success(recentProducts);
  } catch (error) {
    logError('getRecentProducts', error);
    return fail(error && error.message ? error.message : 'Failed to load recent products');
  }
}

function validateProduct(productId) {
  try {
    const productResult = getProduct(productId);
    if (!productResult.ok) {
      return success({ valid: false, warning: true, message: productResult.message || 'Product validation failed' });
    }
    return success({ valid: true, warning: false, message: 'Product is valid', product: productResult.data });
  } catch (error) {
    logError('validateProduct', error);
    return fail(error && error.message ? error.message : 'Product validation failed');
  }
}

function calculateListPrice(productId) {
  try {
    const productResult = getProduct(productId);
    if (!productResult.ok) {
      return productResult;
    }
    const product = productResult.data || {};
    const listPrice = roundCurrency(parseProductListPrice(product.listPrice || product.price || 0));
    return success({ productId: String(productId || '').trim(), listPrice: listPrice });
  } catch (error) {
    logError('calculateListPrice', error);
    return fail(error && error.message ? error.message : 'List price calculation failed');
  }
}

function filterActiveProducts(products) {
  return Array.isArray(products) ? products.filter(filterActiveProductObject) : [];
}

function filterActiveProductObject(item) {
  var active = normalizeString(item && (item.active || item.status));
  if (!active) {
    return true;
  }
  return active === 'true' || active === 'yes' || active === '1' || active === 'active';
}

function normalizeProductPromoText_(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const lowered = text.toLowerCase();
  if (!text || lowered === 'null' || lowered === 'undefined') return '';
  return text;
}

function getProductPromoTextValue_(source) {
  const item = source && typeof source === 'object' ? source : {};
  const fields = ['promoText', 'promotext', 'PromoText', 'Promo Text', 'promo_text', 'promotionText'];
  for (var i = 0; i < fields.length; i++) {
    if (Object.prototype.hasOwnProperty.call(item, fields[i]) && String(item[fields[i]] || '').trim() !== '') {
      return item[fields[i]];
    }
  }
  return item.promoText || '';
}

function normalizeProductObject(row) {
  const source = row && typeof row === 'object' ? row : {};
  const productId = String(source.productId || '').trim();
  const itemName = String(source.itemName || '').trim();
  const itemDesc = String(source.itemDesc || '').trim();
  const groupCode = String(source.groupCode || '').trim();
  const listPrice = parseProductListPrice(source.listPrice);
  const rawListPrice = source.rawListPrice !== undefined ? source.rawListPrice : (source.listPrice !== undefined ? source.listPrice : source.price);

  return Object.assign({}, source, {
    id: productId,
    sku: productId,
    productId: productId,
    productCode: productId,
    productName: itemName,
    description: itemDesc,
    brand: String(source.brand || '').trim(),
    discountGroup: String(source.discountGroup || '').trim(),
    groupCode: groupCode,
    group: groupCode,
    category: groupCode,
    unit: String(source.unit || '').trim(),
    rawListPrice: String(rawListPrice === null || rawListPrice === undefined ? '' : rawListPrice).trim(),
    listPrice: listPrice,
    productBusinessUnit: getProductBusinessUnit(source),
    businessUnit: getProductBusinessUnit(source),
    imageUrl: String(source.imageUrl || '').trim(),
    active: String(source.active || source.status || '').trim(),
    notes: String(source.notes || '').trim(),
    promoText: normalizeProductPromoText_(getProductPromoTextValue_(source))
  });
}

function normalizeProductIdentityText_(value) {
  return String(value === null || value === undefined ? '' : value).trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeProductIdentityPrice_(value) {
  const text = String(value === null || value === undefined ? '' : value).replace(/,/g, '').trim();
  if (!text) return 'empty';
  const numeric = Number(text);
  if (isNaN(numeric)) return normalizeProductIdentityText_(value);
  return String(Math.round(numeric * 1000000) / 1000000);
}

function getProductIdentityValue_(product, fields) {
  const item = product && typeof product === 'object' ? product : {};
  for (var i = 0; i < fields.length; i++) {
    const value = item[fields[i]];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}

function createProductIdentityKey(product) {
  const item = product && typeof product === 'object' ? product : {};
  return [
    normalizeProductIdentityText_(getProductIdentityValue_(item, ['brand', 'businessUnit', 'productBusinessUnit', 'quoteType', 'bu'])),
    normalizeProductIdentityText_(getProductIdentityValue_(item, ['productCode', 'sku', 'productId', 'id', 'itemCode'])),
    normalizeProductIdentityText_(getProductIdentityValue_(item, ['productName', 'itemName', 'name'])),
    normalizeProductIdentityText_(getProductIdentityValue_(item, ['unit', 'uom', 'unitName', 'salesUnit'])),
    normalizeProductIdentityPrice_(getProductIdentityValue_(item, ['rawListPrice', 'rawPrice', 'listPrice', 'price', 'unitListPrice', 'masterListPrice'])),
    normalizeProductIdentityText_(getProductIdentityValue_(item, ['priceType', 'priceListType'])),
    normalizeProductIdentityText_(getProductIdentityValue_(item, ['priceList', 'priceListId', 'priceListName'])),
    normalizeProductIdentityText_(getProductIdentityValue_(item, ['promotionId', 'promoId', 'promotionCode'])),
    normalizeProductIdentityText_(getProductIdentityValue_(item, ['priceSource', 'priceListSource', 'promotionSource'])),
    normalizeProductIdentityText_(getProductIdentityValue_(item, ['discountGroup', 'groupCode', 'group', 'category']))
  ].join('|');
}

function getProductCompletenessScore_(product, headers) {
  const item = product && typeof product === 'object' ? product : {};
  const list = Array.isArray(headers) && headers.length ? headers : Object.keys(item);
  return list.reduce(function (score, field) {
    return score + (item[field] !== undefined && item[field] !== null && String(item[field]).trim() !== '' ? 1 : 0);
  }, 0);
}

function dedupeExactProducts(products) {
  const list = Array.isArray(products) ? products : [];
  const result = [];
  const byKey = {};
  list.forEach(function (product) {
    const item = product && typeof product === 'object' ? product : {};
    const key = createProductIdentityKey(item);
    if (!key.replace(/\|/g, '')) {
      result.push(item);
      return;
    }
    if (!byKey[key]) {
      byKey[key] = { index: result.length, product: item };
      result.push(item);
      return;
    }
    if (getProductCompletenessScore_(item) > getProductCompletenessScore_(byKey[key].product)) {
      byKey[key].product = item;
      result[byKey[key].index] = item;
    }
  });
  return result;
}

function getProductPromotionCodeValue_(product) {
  const item = product && typeof product === 'object' ? product : {};
  const fields = ['promotionCode', 'promoCode', 'promotionId', 'promoId'];
  for (var i = 0; i < fields.length; i++) {
    const value = item[fields[i]];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function hashProductPromotionText_(value) {
  const text = String(value || '').trim();
  var hash = 0;
  for (var i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).toUpperCase();
}

function getProductPromotionFallbackCode_(promoText) {
  return 'PROMO-' + ('000000' + hashProductPromotionText_(promoText || 'promotion')).slice(-6);
}

function normalizeProductPromotionGroupText_(value) {
  return normalizeProductPromoText_(value).replace(/\s+/g, ' ').trim().toLowerCase();
}

function getProductPromotionGroupKey_(product, promoText) {
  const code = getProductPromotionCodeValue_(product);
  if (code) {
    return 'code:' + normalizeProductPromotionGroupText_(code);
  }
  return 'text:' + normalizeProductPromotionGroupText_(promoText);
}

function createProductPromotionDedupeKey_(product) {
  const item = product && typeof product === 'object' ? product : {};
  const productPart = createProductIdentityKey(item);
  const promoText = normalizeProductPromoText_(getProductPromoTextValue_(item));
  const promotionPart = getProductPromotionCodeValue_(item) || promoText;
  if (!productPart.replace(/\|/g, '').trim() && !String(promotionPart || '').trim()) return '';
  return productPart + '|promotion:' + normalizeProductPromotionGroupText_(promotionPart);
}

function dedupeExactPromotionProducts_(products) {
  const list = Array.isArray(products) ? products : [];
  const result = [];
  const byKey = {};
  list.forEach(function (product) {
    const item = product && typeof product === 'object' ? product : {};
    const key = createProductPromotionDedupeKey_(item);
    if (!key.replace(/[|:]/g, '')) {
      result.push(item);
      return;
    }
    if (!byKey[key]) {
      byKey[key] = { index: result.length, product: item };
      result.push(item);
      return;
    }
    if (getProductCompletenessScore_(item) > getProductCompletenessScore_(byKey[key].product)) {
      byKey[key].product = item;
      result[byKey[key].index] = item;
    }
  });
  return result;
}

function getProductPromotionBrandKey_(product) {
  const item = product && typeof product === 'object' ? product : {};
  const text = String(item.productBusinessUnit || item.businessUnit || item.quoteType || item.bu || item.brand || '').trim().toUpperCase();
  if (text.indexOf('GYPROC') >= 0) return 'GYPROC';
  if (text.indexOf('WEBER') >= 0) return 'WEBER';
  return 'UNKNOWN';
}

function getProductPromotionBrandLabel_(product) {
  const brandKey = getProductPromotionBrandKey_(product);
  if (brandKey === 'GYPROC') return 'Gyproc';
  if (brandKey === 'WEBER') return 'Weber';
  return String(product && product.brand || product && product.businessUnit || '-').trim() || '-';
}

function productPromotionBrandLabelFromKeys_(brandKeys) {
  const keys = Array.isArray(brandKeys) ? brandKeys : [];
  if (keys.indexOf('WEBER') >= 0 && keys.indexOf('GYPROC') >= 0) return 'Multi Brand';
  if (keys.indexOf('GYPROC') >= 0) return 'Gyproc';
  if (keys.indexOf('WEBER') >= 0) return 'Weber';
  return '-';
}

function summarizeProductPromotionText_(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '-';
  return clean.length > 150 ? clean.slice(0, 147).trim() + '...' : clean;
}

function buildProductPromotionSnapshot_(product) {
  const item = product && typeof product === 'object' ? product : {};
  const productCode = String(item.productCode || item.sku || item.productId || item.id || item.itemCode || '').trim();
  const identityKey = createProductIdentityKey(item);
  return {
    productIdentityKey: identityKey,
    sourceProductIdentityKey: identityKey,
    sourceProductRecordKey: 'product-record:promotion-dashboard:identity:' + identityKey,
    productId: String(item.productId || item.sku || item.id || productCode).trim(),
    productCode: productCode,
    sku: String(item.sku || productCode).trim(),
    productName: String(item.productName || item.itemName || item.name || '').trim(),
    brand: getProductPromotionBrandLabel_(item),
    productBusinessUnit: getProductPromotionBrandKey_(item),
    businessUnit: getProductPromotionBrandKey_(item),
    unit: String(item.unit || item.uom || item.unitName || '').trim(),
    rawListPrice: String(item.rawListPrice === undefined ? (item.listPrice === undefined ? item.price : item.listPrice) : item.rawListPrice).trim(),
    listPrice: parseProductListPrice(item.listPrice || item.price || 0),
    priceType: String(item.priceType || item.priceListType || '').trim(),
    priceList: String(item.priceList || item.priceListId || item.priceListName || '').trim(),
    promotionId: String(item.promotionId || item.promoId || '').trim(),
    promotionCode: getProductPromotionCodeValue_(item),
    priceSource: String(item.priceSource || item.priceListSource || item.promotionSource || '').trim(),
    discountGroup: String(item.discountGroup || '').trim(),
    groupCode: String(item.groupCode || item.group || item.category || '').trim(),
    imageUrl: String(item.imageUrl || '').trim(),
    promoText: normalizeProductPromoText_(getProductPromoTextValue_(item))
  };
}

function createProductPromotionDashboard_(products) {
  const sourceProducts = Array.isArray(products) ? products : [];
  const dedupedProducts = dedupeExactPromotionProducts_(sourceProducts);
  const groupsByKey = {};
  const groupOrder = [];
  dedupedProducts.forEach(function (product) {
    const promoText = normalizeProductPromoText_(getProductPromoTextValue_(product));
    if (!promoText) return;
    const groupKey = getProductPromotionGroupKey_(product, promoText);
    if (!groupKey.replace(/^(code|text):/, '')) return;
    if (!groupsByKey[groupKey]) {
      const promotionCode = getProductPromotionCodeValue_(product) || getProductPromotionFallbackCode_(promoText);
      groupsByKey[groupKey] = {
        promotionKey: groupKey,
        promotionCode: promotionCode,
        promotionText: promoText,
        promotionSummary: summarizeProductPromotionText_(promoText),
        fullPromotionText: promoText,
        brandKeysMap: {},
        products: []
      };
      groupOrder.push(groupKey);
    }
    const group = groupsByKey[groupKey];
    group.brandKeysMap[getProductPromotionBrandKey_(product)] = true;
    if (group.fullPromotionText.indexOf(promoText) < 0) {
      group.fullPromotionText += '\n\n' + promoText;
    }
    group.products.push(buildProductPromotionSnapshot_(product));
  });
  const groups = groupOrder.map(function (key) {
    const group = groupsByKey[key];
    const products = dedupeExactPromotionProducts_(group.products);
    const brandKeys = Object.keys(group.brandKeysMap).filter(function (brandKey) { return brandKey; });
    return {
      promotionKey: group.promotionKey,
      promotionCode: group.promotionCode,
      brand: productPromotionBrandLabelFromKeys_(brandKeys),
      brandKeys: brandKeys,
      promotionText: group.promotionText,
      promotionSummary: group.promotionSummary,
      fullPromotionText: group.fullPromotionText,
      productCount: products.length,
      products: products
    };
  }).sort(function (a, b) {
    return String(a.promotionCode || '').localeCompare(String(b.promotionCode || ''), 'th') || String(a.brand || '').localeCompare(String(b.brand || ''), 'th');
  });
  const summary = {
    totalPromotions: groups.length,
    productsInPromotion: groups.reduce(function (sum, group) { return sum + Number(group.productCount || 0); }, 0),
    weberPromotions: groups.filter(function (group) { return group.brandKeys.indexOf('WEBER') >= 0; }).length,
    gyprocPromotions: groups.filter(function (group) { return group.brandKeys.indexOf('GYPROC') >= 0; }).length,
    multiBrandPromotions: groups.filter(function (group) { return group.brandKeys.indexOf('WEBER') >= 0 && group.brandKeys.indexOf('GYPROC') >= 0; }).length,
    sourceCount: sourceProducts.length,
    deduplicatedSourceCount: dedupedProducts.length,
    deduplicatedCount: dedupedProducts.length,
    removedDuplicateCount: Math.max(0, sourceProducts.length - dedupedProducts.length)
  };
  return {
    groups: groups,
    summary: summary,
    products: groups.reduce(function (acc, group) { return acc.concat(group.products); }, [])
  };
}

function getProductPromotions(payload) {
  const timer = startPerformanceTimer('product.promotions');
  try {
    const data = payload && typeof payload === 'object' ? payload : {};
    const auth = data.currentUser ? success(data.currentUser) : requireApiUser(data);
    if (!auth.ok) {
      endPerformanceTimer(timer, 'auth=false');
      return auth;
    }
    const permissions = getUserPermissions(auth.data);
    if (!permissions.canViewPromotions || !permissions.canViewProducts) {
      endPerformanceTimer(timer, 'permission=false');
      return forbidden('Insufficient permission');
    }
    const productsResult = getProducts();
    if (!productsResult.ok) {
      endPerformanceTimer(timer, 'products=false');
      return productsResult;
    }
    const dashboard = createProductPromotionDashboard_(productsResult.data || []);
    endPerformanceTimer(timer, 'groups=' + dashboard.groups.length + ' products=' + dashboard.summary.productsInPromotion);
    return success(dashboard, 'Product promotions loaded');
  } catch (error) {
    endPerformanceTimer(timer, 'error=true');
    logError('getProductPromotions', error);
    return fail(error && error.message ? error.message : 'Failed to load product promotions');
  }
}

function getPromotionDashboard(payload) {
  return getProductPromotions(payload);
}

function productDuplicateRecordFromRow_(headers, rowValues, rowNumber) {
  const record = { sourceRow: rowNumber };
  headers.forEach(function (header, index) {
    if (header) record[header] = rowValues[index] || '';
  });
  return record;
}

function createProductSimilarityKey_(product) {
  const item = product && typeof product === 'object' ? product : {};
  return [
    normalizeProductIdentityText_(getProductIdentityValue_(item, ['brand', 'businessUnit', 'productBusinessUnit', 'quoteType', 'bu'])),
    normalizeProductIdentityText_(getProductIdentityValue_(item, ['productCode', 'sku', 'productId', 'id', 'itemCode'])),
    normalizeProductIdentityText_(getProductIdentityValue_(item, ['productName', 'itemName', 'name']))
  ].join('|');
}

function describeProductDuplicateGroup_(key, records, headers) {
  const sorted = records.slice().sort(function (a, b) {
    return getProductCompletenessScore_(b, headers) - getProductCompletenessScore_(a, headers) || Number(a.sourceRow || 0) - Number(b.sourceRow || 0);
  });
  const keep = sorted[0] || records[0] || {};
  const keepRow = Number(keep.sourceRow || 0);
  const rowNumbers = records.map(function (record) { return Number(record.sourceRow || 0); }).filter(function (rowNumber) { return rowNumber > 0; }).sort(function (a, b) { return a - b; });
  return {
    duplicateKey: key,
    productCode: String(getProductIdentityValue_(keep, ['productCode', 'sku', 'productId', 'id', 'itemCode']) || '').trim(),
    productName: String(getProductIdentityValue_(keep, ['productName', 'itemName', 'name']) || '').trim(),
    brand: String(getProductIdentityValue_(keep, ['brand', 'businessUnit', 'productBusinessUnit']) || '').trim(),
    unit: String(getProductIdentityValue_(keep, ['unit', 'uom', 'unitName', 'salesUnit']) || '').trim(),
    price: normalizeProductIdentityPrice_(getProductIdentityValue_(keep, ['rawListPrice', 'rawPrice', 'listPrice', 'price', 'unitListPrice', 'masterListPrice'])),
    rowNumbers: rowNumbers,
    duplicateCount: rowNumbers.length,
    keepRow: keepRow,
    proposedDeleteRows: rowNumbers.filter(function (rowNumber) { return rowNumber !== keepRow; })
  };
}

function auditProductSheetDuplicates() {
  try {
    const sheet = getSheet(PRODUCT_SHEET);
    if (!sheet) return fail('Unable to access Products sheet');
    const headers = getHeaders(sheet).map(function (header) { return String(header || '').trim(); }).filter(function (header) { return header; });
    const defaultHeaders = getHeadersForSheet(PRODUCT_SHEET);
    const lastRow = sheet.getLastRow();
    const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
    const values = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues() : [];
    const records = values.map(function (row, index) {
      return productDuplicateRecordFromRow_(headers, row, index + 2);
    });
    const byExactKey = {};
    const bySimilarityKey = {};
    records.forEach(function (record) {
      const exactKey = createProductIdentityKey(record);
      if (exactKey.replace(/\|/g, '')) {
        if (!byExactKey[exactKey]) byExactKey[exactKey] = [];
        byExactKey[exactKey].push(record);
      }
      const similarKey = createProductSimilarityKey_(record);
      if (similarKey.replace(/\|/g, '')) {
        if (!bySimilarityKey[similarKey]) bySimilarityKey[similarKey] = [];
        bySimilarityKey[similarKey].push(record);
      }
    });
    const duplicateGroups = Object.keys(byExactKey).filter(function (key) {
      return byExactKey[key].length > 1;
    }).map(function (key) {
      return describeProductDuplicateGroup_(key, byExactKey[key], headers);
    }).sort(function (a, b) {
      return a.keepRow - b.keepRow;
    });
    const similarButDistinctGroups = Object.keys(bySimilarityKey).map(function (key) {
      const group = bySimilarityKey[key] || [];
      const exactKeys = {};
      group.forEach(function (record) {
        exactKeys[createProductIdentityKey(record)] = true;
      });
      return { key: key, rows: group, distinctExactCount: Object.keys(exactKeys).length };
    }).filter(function (group) {
      return group.rows.length > 1 && group.distinctExactCount > 1;
    }).map(function (group) {
      const first = group.rows[0] || {};
      return {
        similarKey: group.key,
        productCode: String(getProductIdentityValue_(first, ['productCode', 'sku', 'productId', 'id', 'itemCode']) || '').trim(),
        productName: String(getProductIdentityValue_(first, ['productName', 'itemName', 'name']) || '').trim(),
        brand: String(getProductIdentityValue_(first, ['brand', 'businessUnit', 'productBusinessUnit']) || '').trim(),
        rowNumbers: group.rows.map(function (record) { return Number(record.sourceRow || 0); }).filter(function (rowNumber) { return rowNumber > 0; }).sort(function (a, b) { return a - b; }),
        distinctExactCount: group.distinctExactCount
      };
    });
    return success({
      schema: {
        actualHeaders: headers,
        defaultHeaders: defaultHeaders,
        fields: {
          brand: headers.indexOf('brand') >= 0,
          productCode: headers.indexOf('productCode') >= 0 || headers.indexOf('sku') >= 0 || headers.indexOf('productId') >= 0,
          productName: headers.indexOf('productName') >= 0 || headers.indexOf('itemName') >= 0,
          unit: headers.indexOf('unit') >= 0,
          price: headers.indexOf('listPrice') >= 0 || headers.indexOf('price') >= 0,
          priceType: headers.indexOf('priceType') >= 0,
          priceList: headers.indexOf('priceList') >= 0 || headers.indexOf('priceListId') >= 0 || headers.indexOf('priceListName') >= 0,
          promotionId: headers.indexOf('promotionId') >= 0 || headers.indexOf('promoId') >= 0,
          recordId: headers.indexOf('recordId') >= 0 || headers.indexOf('rowId') >= 0 || headers.indexOf('sourceRow') >= 0
        }
      },
      summary: {
        sourceRowCount: records.length,
        duplicateGroupCount: duplicateGroups.length,
        exactDuplicateRowCount: duplicateGroups.reduce(function (sum, group) { return sum + Math.max(0, group.duplicateCount - 1); }, 0),
        similarButDistinctGroupCount: similarButDistinctGroups.length
      },
      duplicateGroups: duplicateGroups,
      similarButDistinctGroups: similarButDistinctGroups
    }, 'Product duplicate audit completed');
  } catch (error) {
    logError('auditProductSheetDuplicates', error);
    return fail(error && error.message ? error.message : 'Product duplicate audit failed');
  }
}

function parseProductListPrice(value) {
  const numericValue = Number(String(value || '').replace(/,/g, ''));
  return isNaN(numericValue) ? 0 : numericValue;
}

function findProductById(productId, products) {
  if (!productId || !Array.isArray(products)) {
    return null;
  }
  const normalizedProductId = normalizeString(productId);
  return products.find(function (item) {
    return normalizedProductId === normalizeString(item.productId || item.id || item.sku || item.productCode);
  }) || null;
}

function extractProductId(row) {
  if (!row || typeof row !== 'object') {
    return '';
  }
  return normalizeString(row.productId || row.productCode || row.sku || row.product || row.item || row.itemId);
}

function extractTimestamp(row) {
  if (!row || typeof row !== 'object') {
    return 0;
  }
  var candidates = [row.updatedAt, row.lastSeen, row.timestamp, row.createdAt, row.date];
  for (var i = 0; i < candidates.length; i++) {
    var value = candidates[i];
    if (value) {
      var date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
  }
  return 0;
}

function normalizeString(value) {
  return String(value || '').trim().toLowerCase();
}

function uniqueStrings(values) {
  var seen = {};
  return Array.isArray(values) ? values.filter(function (item) {
    var normalized = normalizeString(item);
    if (!normalized || seen[normalized]) {
      return false;
    }
    seen[normalized] = true;
    return true;
  }) : [];
}
