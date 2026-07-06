function getDiscount(customerId, groupCode) {
  try {
    const normalizedCustomerId = String(customerId || '').trim();
    const normalizedGroupCode = String(groupCode || '').trim();

    if (!normalizedCustomerId || !normalizedGroupCode) {
      return validationError('customerId and groupCode are required');
    }

    const matrixResult = getSheetData(SHEET_NAMES.DISCOUNT_MATRIX);
    if (!matrixResult.ok) {
      logWarning('getDiscount', 'Unable to read DiscountMatrix');
      return success({
        discountPercent: 0,
        discountGroup: '',
        groupCode: normalizedGroupCode,
        customerId: normalizedCustomerId,
        warning: true,
        message: 'DiscountMatrix unavailable'
      });
    }

    const rows = Array.isArray(matrixResult.data) ? matrixResult.data : [];
    if (!rows.length) {
      logWarning('getDiscount', 'DiscountMatrix has no data');
      return success({
        discountPercent: 0,
        discountGroup: '',
        groupCode: normalizedGroupCode,
        customerId: normalizedCustomerId,
        warning: true,
        message: 'DiscountMatrix has no data'
      });
    }

    const rowKeyField = findDiscountRowKeyField(rows);
    if (!rowKeyField) {
      logWarning('getDiscount', 'Unable to determine DiscountMatrix row key');
      return success({
        discountPercent: 0,
        discountGroup: '',
        groupCode: normalizedGroupCode,
        customerId: normalizedCustomerId,
        warning: true,
        message: 'Unable to determine DiscountMatrix row key'
      });
    }

    const rowRecord = rows.find(function (record) {
      return String(record[rowKeyField] || '').trim().toLowerCase() === normalizedGroupCode.toLowerCase();
    });

    if (!rowRecord) {
      logWarning('getDiscount', 'No matching discount row for groupCode ' + normalizedGroupCode);
      return success({
        discountPercent: 0,
        discountGroup: '',
        groupCode: normalizedGroupCode,
        customerId: normalizedCustomerId,
        warning: true,
        message: 'No discount row found'
      });
    }

    const columnKey = findDiscountColumnKey(rowRecord, normalizedCustomerId);
    if (!columnKey) {
      logWarning('getDiscount', 'No matching discount column for customerId ' + normalizedCustomerId);
      return success({
        discountPercent: 0,
        discountGroup: normalizedGroupCode,
        groupCode: normalizedGroupCode,
        customerId: normalizedCustomerId,
        warning: true,
        message: 'No discount column found'
      });
    }

    const discountPercent = roundCurrency(parseNumericValue(rowRecord[columnKey]));
    return success({
      discountPercent: discountPercent,
      discountGroup: normalizedGroupCode,
      groupCode: normalizedGroupCode,
      customerId: normalizedCustomerId
    });
  } catch (error) {
    logError('getDiscount', error);
    return fail(error && error.message ? error.message : 'Discount lookup failed');
  }
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
