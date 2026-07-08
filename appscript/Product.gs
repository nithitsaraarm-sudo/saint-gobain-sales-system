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
        item.unit
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
      promoText: String(data.promoText || ''),
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

function normalizeProductObject(row) {
  const source = row && typeof row === 'object' ? row : {};
  const productId = String(source.productId || '').trim();
  const itemName = String(source.itemName || '').trim();
  const itemDesc = String(source.itemDesc || '').trim();
  const groupCode = String(source.groupCode || '').trim();
  const listPrice = parseProductListPrice(source.listPrice);

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
    listPrice: listPrice,
    imageUrl: String(source.imageUrl || '').trim(),
    active: String(source.active || source.status || '').trim(),
    notes: String(source.notes || '').trim(),
    promoText: String(source.promoText || '').trim()
  });
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
