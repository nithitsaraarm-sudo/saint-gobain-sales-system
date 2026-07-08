function getDiscount(customerId, groupCode) {
  const timer = startPerformanceTimer('discount');
  try {
    const normalizedCustomerId = String(customerId || '').trim();
    const normalizedGroupCode = String(groupCode || '').trim();

    if (!normalizedCustomerId || !normalizedGroupCode) {
      endPerformanceTimer(timer, 'validation=false');
      return validationError('customerId and groupCode are required');
    }

    const cacheKey = 'discount:' + normalizedCustomerId + ':' + normalizedGroupCode;
    const cached = getDiscountCache(cacheKey);
    if (cached) {
      endPerformanceTimer(timer, 'cache=hit');
      return success(cached, cached.source === 'discount_matrix' ? 'Discount found' : 'Discount not found');
    }

    const matrix = readDiscountMatrixValues();
    if (!matrix.ok) {
      endPerformanceTimer(timer, 'cache=miss matrix=false');
      return cacheDiscountResult(cacheKey, createDiscountResult(normalizedCustomerId, normalizedGroupCode, '', 0, 'not_found', matrix.message || 'DiscountMatrix unavailable'));
    }

    const values = matrix.data || [];
    if (values.length < 3) {
      endPerformanceTimer(timer, 'cache=miss rows=0');
      return cacheDiscountResult(cacheKey, createDiscountResult(normalizedCustomerId, normalizedGroupCode, '', 0, 'not_found', 'DiscountMatrix has no discount rows'));
    }

    const customerColumnIndex = findDiscountCustomerColumn(values[0], normalizedCustomerId);
    if (customerColumnIndex < 0) {
      endPerformanceTimer(timer, 'cache=miss customer=false');
      return cacheDiscountResult(cacheKey, createDiscountResult(normalizedCustomerId, normalizedGroupCode, '', 0, 'not_found', 'Discount customer not found'));
    }

    const rowIndex = findDiscountGroupRow(values, normalizedGroupCode);
    if (rowIndex < 0) {
      endPerformanceTimer(timer, 'cache=miss group=false');
      return cacheDiscountResult(cacheKey, createDiscountResult(normalizedCustomerId, normalizedGroupCode, '', 0, 'not_found', 'Discount group not found'));
    }

    const row = values[rowIndex] || [];
    const discountGroup = String(row[1] || '').trim();
    const rawDiscount = row[customerColumnIndex];
    const hasDiscountValue = String(rawDiscount || '').trim() !== '';
    const discountPercent = parseDiscountPercent(rawDiscount);
    const result = {
      customerId: normalizedCustomerId,
      groupCode: normalizedGroupCode,
      discountGroup: discountGroup,
      discountPercent: discountPercent,
      source: hasDiscountValue ? 'discount_matrix' : 'not_found'
    };
    setDiscountCache(cacheKey, result);
    endPerformanceTimer(timer, 'cache=miss source=' + result.source);
    return success(result, hasDiscountValue ? 'Discount found' : 'Discount not found');
  } catch (error) {
    endPerformanceTimer(timer, 'error=true');
    logError('getDiscount', error);
    return fail(error && error.message ? error.message : 'Discount lookup failed');
  }
}

function getDiscountCache(cacheKey) {
  return getServerCache(cacheKey);
}

function setDiscountCache(cacheKey, data) {
  setServerCache(cacheKey, data, 3600);
}

function cacheDiscountResult(cacheKey, result) {
  if (result && result.ok && result.data) {
    setDiscountCache(cacheKey, result.data);
  }
  return result;
}

function readDiscountMatrixValues() {
  try {
    const cacheKey = 'discountMatrix:values';
    const cached = getServerCache(cacheKey);
    if (cached) {
      return success(cached);
    }
    const sheet = getSheetByName(SHEET_NAMES.DISCOUNT_MATRIX);
    if (!sheet) {
      return fail('DiscountMatrix sheet not found');
    }
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 1 || lastColumn < 1) {
      return success([]);
    }
    const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
    setServerCache(cacheKey, values || [], 3600);
    return success(values || []);
  } catch (error) {
    logError('readDiscountMatrixValues', error);
    return fail(error && error.message ? error.message : 'Unable to read DiscountMatrix');
  }
}

function findDiscountCustomerColumn(headerRow, customerId) {
  const normalizedCustomerId = normalizeDiscountKey(customerId);
  const headers = Array.isArray(headerRow) ? headerRow : [];
  for (var i = 2; i < headers.length; i++) {
    if (normalizeDiscountKey(headers[i]) === normalizedCustomerId) {
      return i;
    }
  }
  return -1;
}

function findDiscountGroupRow(values, groupCode) {
  const normalizedGroupCode = normalizeDiscountKey(groupCode);
  for (var i = 2; i < values.length; i++) {
    const row = values[i] || [];
    if (normalizeDiscountKey(row[0]) === normalizedGroupCode) {
      return i;
    }
  }
  return -1;
}

function parseDiscountPercent(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return 0;
  }
  const numericValue = Number(raw.replace(/%/g, '').replace(/,/g, '').trim());
  if (isNaN(numericValue)) {
    return 0;
  }
  if (raw.indexOf('%') >= 0) {
    return roundCurrency(numericValue);
  }
  if (numericValue > 0 && numericValue < 1) {
    return roundCurrency(numericValue * 100);
  }
  return roundCurrency(numericValue);
}

function createDiscountResult(customerId, groupCode, discountGroup, discountPercent, source, message) {
  return success({
    customerId: customerId,
    groupCode: groupCode,
    discountGroup: discountGroup || '',
    discountPercent: discountPercent || 0,
    source: source || 'not_found'
  }, message || 'Discount not found');
}

function normalizeDiscountKey(value) {
  return String(value || '').trim().toLowerCase();
}

function calculateNetPrice(listPrice, discountPercent) {
  try {
    const normalizedListPrice = parseNumericValue(listPrice);
    const normalizedDiscountPercent = parseNumericValue(discountPercent);
    const netPrice = normalizedListPrice * (1 - normalizedDiscountPercent / 100);
    return success({
      listPrice: roundCurrency(normalizedListPrice),
      discountPercent: roundCurrency(normalizedDiscountPercent),
      netPrice: roundCurrency(netPrice)
    });
  } catch (error) {
    logError('calculateNetPrice', error);
    return fail(error && error.message ? error.message : 'Net price calculation failed');
  }
}

function calculateLineTotal(qty, netPrice) {
  try {
    const normalizedQty = parseNumericValue(qty);
    const normalizedNetPrice = parseNumericValue(netPrice);
    return success({
      amount: roundCurrency(normalizedQty * normalizedNetPrice)
    });
  } catch (error) {
    logError('calculateLineTotal', error);
    return fail(error && error.message ? error.message : 'Line total calculation failed');
  }
}

function calculateQuotationSummary(lines, shipping, specialDiscount) {
  try {
    const lineItems = Array.isArray(lines) ? lines : [];
    let subtotal = 0;

    lineItems.forEach(function (line) {
      const qty = parseNumericValue(line && line.qty);
      const netPrice = parseNumericValue(line && line.netPrice);
      const lineTotalResult = calculateLineTotal(qty, netPrice);
      if (lineTotalResult.ok && lineTotalResult.data) {
        subtotal += parseNumericValue(lineTotalResult.data.amount);
      }
    });

    const normalizedShipping = parseNumericValue(shipping);
    const normalizedSpecialDiscount = parseNumericValue(specialDiscount);
    const vat = subtotal * 0.07;
    const grandTotal = subtotal + vat + normalizedShipping - normalizedSpecialDiscount;

    return success({
      subtotal: roundCurrency(subtotal),
      vat: roundCurrency(vat),
      grandTotal: roundCurrency(grandTotal)
    });
  } catch (error) {
    logError('calculateQuotationSummary', error);
    return fail(error && error.message ? error.message : 'Quotation summary calculation failed');
  }
}

function validateDiscount(customerId, groupCode) {
  try {
    const discountResult = getDiscount(customerId, groupCode);
    if (!discountResult.ok) {
      return success({
        valid: false,
        warning: true,
        message: discountResult.message || 'Discount validation failed'
      });
    }

    const discountPercent = parseNumericValue(discountResult.data && discountResult.data.discountPercent);
    const isValid = discountPercent > 0;
    return success({
      valid: isValid,
      warning: !isValid,
      message: isValid ? 'Discount found' : 'Discount not found',
      discountPercent: roundCurrency(discountPercent)
    });
  } catch (error) {
    logError('validateDiscount', error);
    return fail(error && error.message ? error.message : 'Discount validation failed');
  }
}

function findDiscountRowKeyField(records) {
  if (!Array.isArray(records) || !records.length) {
    return '';
  }

  const headers = Object.keys(records[0] || {});
  const normalizedHeaders = headers.map(function (header) {
    return normalizeHeaderName(header);
  });

  const matchedIndex = normalizedHeaders.findIndex(function (header) {
    return header === 'groupcode' || header === 'group';
  });

  return matchedIndex >= 0 ? headers[matchedIndex] : headers[0] || '';
}

function findDiscountColumnKey(record, customerId) {
  if (!record) {
    return '';
  }

  const headers = Object.keys(record || {});
  const normalizedCustomerId = normalizeHeaderName(customerId);
  const matchedIndex = headers.findIndex(function (header) {
    return normalizeHeaderName(header) === normalizedCustomerId;
  });

  if (matchedIndex >= 0) {
    return headers[matchedIndex];
  }

  const rowKeyField = findDiscountRowKeyField([record]);
  const candidateHeaders = headers.filter(function (header) {
    return header !== rowKeyField;
  });

  return candidateHeaders[0] || '';
}

function parseNumericValue(value) {
  const numericValue = Number(value);
  return isNaN(numericValue) ? 0 : numericValue;
}

function roundCurrency(value) {
  return Math.round(parseNumericValue(value) * 100) / 100;
}

function normalizeHeaderName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}
