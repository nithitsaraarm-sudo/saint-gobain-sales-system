function createQuotation(customerId) {
  try {
    const idCheck = requireValue(customerId, 'customerId');
    if (!idCheck.ok) {
      return idCheck;
    }
    const customerResult = getCustomer(customerId);
    if (!customerResult.ok) {
      return customerResult;
    }
    ensureQuotationSheets();
    const quoteId = generateId('QUOTE');
    const now = new Date().toISOString();
    const row = {
      quoteId: quoteId,
      customerId: String(customerId).trim(),
      status: QUOTE_STATUSES.DRAFT,
      shipping: 0,
      specialDiscount: 0,
      subtotal: 0,
      vat: 0,
      grandTotal: 0,
      createdAt: now,
      updatedAt: now
    };
    const insertResult = appendRow(QUOTE_HISTORY_SHEET, row);
    if (!insertResult.ok) {
      return insertResult;
    }
    logInfo('createQuotation', 'Quotation created ' + quoteId);
    return success(row, 'Quotation created');
  } catch (error) {
    logError('createQuotation', error);
    return fail(error && error.message ? error.message : 'Failed to create quotation');
  }
}

function addQuotationItem(quoteId, productId, qty) {
  try {
    const quoteCheck = requireValue(quoteId, 'quoteId');
    if (!quoteCheck.ok) {
      return quoteCheck;
    }
    const productCheck = requireValue(productId, 'productId');
    if (!productCheck.ok) {
      return productCheck;
    }
    const quantity = parseNumericValue(qty);
    if (quantity <= 0) {
      return validationError('qty must be greater than zero');
    }
    const quoteResult = getQuotationRow(quoteId);
    if (!quoteResult.ok) {
      return quoteResult;
    }
    const quote = quoteResult.data;
    if (quote.status === QUOTE_STATUSES.CANCELLED) {
      return fail('Cannot add item to cancelled quotation');
    }
    const productResult = getProduct(productId);
    if (!productResult.ok) {
      return productResult;
    }
    const product = productResult.data || {};
    const priceResult = calculateListPrice(productId);
    if (!priceResult.ok) {
      return priceResult;
    }
    const discountResult = getDiscount(quote.customerId, getProductGroupCode(product));
    const listPrice = roundCurrency(parseNumericValue(priceResult.data && priceResult.data.listPrice));
    const discountPercent = discountResult.ok ? roundCurrency(parseNumericValue(discountResult.data && discountResult.data.discountPercent)) : 0;
    const netPrice = roundCurrency(listPrice * (1 - discountPercent / 100));
    const lineTotal = roundCurrency(netPrice * quantity);
    ensureQuotationSheets();
    const lineId = generateId('LINE');
    const now = new Date().toISOString();
    const row = {
      quoteId: quoteId,
      lineId: lineId,
      productId: String(productId).trim(),
      productName: String(product.productName || product.name || product.product || '').trim(),
      qty: quantity,
      listPrice: listPrice,
      discountPercent: discountPercent,
      netPrice: netPrice,
      lineTotal: lineTotal,
      status: LINE_STATUSES.ACTIVE,
      createdAt: now,
      updatedAt: now
    };
    const insertResult = appendRow(QUOTE_LINES_SHEET, row);
    if (!insertResult.ok) {
      return insertResult;
    }
    logInfo('addQuotationItem', 'Added line ' + lineId + ' to quote ' + quoteId);
    return success(row, 'Quotation item added');
  } catch (error) {
    logError('addQuotationItem', error);
    return fail(error && error.message ? error.message : 'Failed to add quotation item');
  }
}

function updateQuotationItem(quoteId, lineId, qty) {
  try {
    const quoteCheck = requireValue(quoteId, 'quoteId');
    if (!quoteCheck.ok) {
      return quoteCheck;
    }
    const lineCheck = requireValue(lineId, 'lineId');
    if (!lineCheck.ok) {
      return lineCheck;
    }
    const quantity = parseNumericValue(qty);
    if (quantity <= 0) {
      return validationError('qty must be greater than zero');
    }
    const quoteResult = getQuotationRow(quoteId);
    if (!quoteResult.ok) {
      return quoteResult;
    }
    const quote = quoteResult.data;
    const lineResult = findQuoteLine(quoteId, lineId);
    if (!lineResult.ok) {
      return lineResult;
    }
    const line = lineResult.data;
    if (line.status === LINE_STATUSES.REMOVED) {
      return fail('Cannot update removed quotation line');
    }
    const productResult = getProduct(line.productId);
    if (!productResult.ok) {
      return productResult;
    }
    const product = productResult.data || {};
    const priceResult = calculateListPrice(line.productId);
    if (!priceResult.ok) {
      return priceResult;
    }
    const discountResult = getDiscount(quote.customerId, getProductGroupCode(product));
    const listPrice = roundCurrency(parseNumericValue(priceResult.data && priceResult.data.listPrice));
    const discountPercent = discountResult.ok ? roundCurrency(parseNumericValue(discountResult.data && discountResult.data.discountPercent)) : 0;
    const netPrice = roundCurrency(listPrice * (1 - discountPercent / 100));
    const lineTotal = roundCurrency(netPrice * quantity);
    const updateObject = {
      qty: quantity,
      listPrice: listPrice,
      discountPercent: discountPercent,
      netPrice: netPrice,
      lineTotal: lineTotal,
      updatedAt: new Date().toISOString()
    };
    const result = updateRowById(QUOTE_LINES_SHEET, 'lineId', lineId, updateObject);
    if (!result.ok) {
      return result;
    }
    logInfo('updateQuotationItem', 'Updated line ' + lineId + ' for quote ' + quoteId);
    return success(updateObject, 'Quotation item updated');
  } catch (error) {
    logError('updateQuotationItem', error);
    return fail(error && error.message ? error.message : 'Failed to update quotation item');
  }
}

function removeQuotationItem(quoteId, lineId) {
  try {
    const quoteCheck = requireValue(quoteId, 'quoteId');
    if (!quoteCheck.ok) {
      return quoteCheck;
    }
    const lineCheck = requireValue(lineId, 'lineId');
    if (!lineCheck.ok) {
      return lineCheck;
    }
    const lineResult = findQuoteLine(quoteId, lineId);
    if (!lineResult.ok) {
      return lineResult;
    }
    const line = lineResult.data;
    if (line.status === LINE_STATUSES.REMOVED) {
      return fail('Quotation line already removed');
    }
    const updateObject = {
      status: LINE_STATUSES.REMOVED,
      updatedAt: new Date().toISOString()
    };
    const result = updateRowById(QUOTE_LINES_SHEET, 'lineId', lineId, updateObject);
    if (!result.ok) {
      return result;
    }
    logInfo('removeQuotationItem', 'Removed line ' + lineId + ' from quote ' + quoteId);
    return success({ quoteId: quoteId, lineId: lineId }, 'Quotation item removed');
  } catch (error) {
    logError('removeQuotationItem', error);
    return fail(error && error.message ? error.message : 'Failed to remove quotation item');
  }
}

function calculateQuotation(quoteId) {
  try {
    const quoteResult = getQuotationRow(quoteId);
    if (!quoteResult.ok) {
      return quoteResult;
    }
    const quote = quoteResult.data;
    const linesResult = getQuoteLines(quoteId);
    if (!linesResult.ok) {
      return linesResult;
    }
    const allLines = Array.isArray(linesResult.data) ? linesResult.data : [];
    const activeLines = allLines.filter(function (item) {
      return normalizeString(item.status) !== normalizeString(LINE_STATUSES.REMOVED);
    }).map(function (item) {
      return recalcQuotationLine(item, quote.customerId);
    });
    const subtotal = roundCurrency(activeLines.reduce(function (sum, line) {
      return sum + parseNumericValue(line.lineTotal);
    }, 0));
    const shipping = roundCurrency(parseNumericValue(quote.shipping || 0));
    const specialDiscount = roundCurrency(parseNumericValue(quote.specialDiscount || 0));
    const vat = roundCurrency(subtotal * 0.07);
    const grandTotal = roundCurrency(subtotal + vat + shipping - specialDiscount);
    return success({ quote: quote, lines: activeLines, totals: {
      subtotal: subtotal,
      vat: vat,
      shipping: shipping,
      specialDiscount: specialDiscount,
      grandTotal: grandTotal
    } });
  } catch (error) {
    logError('calculateQuotation', error);
    return fail(error && error.message ? error.message : 'Failed to calculate quotation');
  }
}

function saveQuotation(payload) {
  try {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const quoteId = String(payload.quoteId || '').trim();
      const customerId = String(payload.customerId || '').trim();
      if (!customerId) {
        return validationError('customerId is required');
      }
      const shipping = parseNumericValue(payload.shipping);
      const specialDiscount = parseNumericValue(payload.specialDiscount);
      const items = Array.isArray(payload.items) ? payload.items : [];
      let workingQuote = null;
      if (quoteId) {
        const quoteResult = getQuotationRow(quoteId);
        if (!quoteResult.ok) {
          return quoteResult;
        }
        workingQuote = quoteResult.data;
      } else {
        const createResult = createQuotation(customerId);
        if (!createResult.ok) {
          return createResult;
        }
        workingQuote = createResult.data;
      }
      const id = String(workingQuote.quoteId || quoteId).trim();
      if (!id) {
        return fail('Quote ID missing');
      }
      ensureQuotationSheets();
      const existingLinesResult = getQuoteLines(id);
      if (!existingLinesResult.ok) {
        return existingLinesResult;
      }
      const existingLines = Array.isArray(existingLinesResult.data) ? existingLinesResult.data : [];
      existingLines.forEach(function (line) {
        if (normalizeString(line.status) !== normalizeString(LINE_STATUSES.REMOVED)) {
          updateRowById(QUOTE_LINES_SHEET, 'lineId', line.lineId, {
            status: LINE_STATUSES.REMOVED,
            updatedAt: new Date().toISOString()
          });
        }
      });
      items.forEach(function (item) {
        addQuotationItem(id, item.productId, item.qty);
      });
      updateRowById(QUOTE_HISTORY_SHEET, 'quoteId', id, {
        customerId: customerId,
        shipping: shipping,
        specialDiscount: specialDiscount,
        updatedAt: new Date().toISOString()
      });
      const calculateResult = calculateQuotation(id);
      if (!calculateResult.ok) {
        return calculateResult;
      }
      const totals = calculateResult.data.totals || {};
      const updateTotals = {
        subtotal: totals.subtotal,
        vat: totals.vat,
        shipping: totals.shipping,
        specialDiscount: totals.specialDiscount,
        grandTotal: totals.grandTotal,
        status: QUOTE_STATUSES.SAVED,
        updatedAt: new Date().toISOString()
      };
      const result = updateRowById(QUOTE_HISTORY_SHEET, 'quoteId', id, updateTotals);
      if (!result.ok) {
        return result;
      }
      logInfo('saveQuotation', 'Saved quotation ' + id);
      return success({ quoteId: id, totals: totals }, 'Quotation saved');
    }
    const quoteId = String(payload || '').trim();
    const calculateResult = calculateQuotation(quoteId);
    if (!calculateResult.ok) {
      return calculateResult;
    }
    const quote = calculateResult.data.quote || {};
    const totals = calculateResult.data.totals || {};
    const updateObject = {
      subtotal: totals.subtotal,
      vat: totals.vat,
      shipping: totals.shipping,
      specialDiscount: totals.specialDiscount,
      grandTotal: totals.grandTotal,
      status: QUOTE_STATUSES.SAVED,
      updatedAt: new Date().toISOString()
    };
    const result = updateRowById(QUOTE_HISTORY_SHEET, 'quoteId', quoteId, updateObject);
    if (!result.ok) {
      return result;
    }
    logInfo('saveQuotation', 'Saved quotation ' + quoteId);
    return success({ quoteId: quoteId, totals: totals }, 'Quotation saved');
  } catch (error) {
    logError('saveQuotation', error);
    return fail(error && error.message ? error.message : 'Failed to save quotation');
  }
}

function loadQuotation(quoteId) {
  try {
    const quoteResult = getQuotationRow(quoteId);
    if (!quoteResult.ok) {
      return quoteResult;
    }
    const quote = quoteResult.data;
    const linesResult = getQuoteLines(quoteId);
    if (!linesResult.ok) {
      return linesResult;
    }
    const lines = Array.isArray(linesResult.data) ? linesResult.data : [];
    const activeLines = lines.filter(function (item) {
      return normalizeString(item.status) !== normalizeString(LINE_STATUSES.REMOVED);
    });
    const totalsResult = calculateQuotation(quoteId);
    if (!totalsResult.ok) {
      return totalsResult;
    }
    return success({ quote: quote, lines: activeLines, totals: totalsResult.data.totals });
  } catch (error) {
    logError('loadQuotation', error);
    return fail(error && error.message ? error.message : 'Failed to load quotation');
  }
}

function duplicateQuotation(quoteId) {
  try {
    const originalResult = loadQuotation(quoteId);
    if (!originalResult.ok) {
      return originalResult;
    }
    const original = originalResult.data;
    const quote = original.quote || {};
    const newQuoteId = generateId('QUOTE');
    const now = new Date().toISOString();
    const newQuoteRow = {
      quoteId: newQuoteId,
      customerId: String(quote.customerId || '').trim(),
      status: QUOTE_STATUSES.DRAFT,
      shipping: parseNumericValue(quote.shipping || 0),
      specialDiscount: parseNumericValue(quote.specialDiscount || 0),
      subtotal: 0,
      vat: 0,
      grandTotal: 0,
      createdAt: now,
      updatedAt: now
    };
    ensureQuotationSheets();
    const insertResult = appendRow(QUOTE_HISTORY_SHEET, newQuoteRow);
    if (!insertResult.ok) {
      return insertResult;
    }
    const addLines = Array.isArray(original.lines) ? original.lines : [];
    addLines.forEach(function (line) {
      addQuotationItem(newQuoteId, line.productId, line.qty);
    });
    const saveResult = saveQuotation(newQuoteId);
    if (!saveResult.ok) {
      return saveResult;
    }
    logInfo('duplicateQuotation', 'Duplicated quote ' + quoteId + ' to ' + newQuoteId);
    return success({ originalQuoteId: quoteId, newQuoteId: newQuoteId }, 'Quotation duplicated');
  } catch (error) {
    logError('duplicateQuotation', error);
    return fail(error && error.message ? error.message : 'Failed to duplicate quotation');
  }
}

function cancelQuotation(quoteId) {
  try {
    const quoteResult = getQuotationRow(quoteId);
    if (!quoteResult.ok) {
      return quoteResult;
    }
    const updateObject = {
      status: QUOTE_STATUSES.CANCELLED,
      updatedAt: new Date().toISOString()
    };
    const result = updateRowById(QUOTE_HISTORY_SHEET, 'quoteId', quoteId, updateObject);
    if (!result.ok) {
      return result;
    }
    logInfo('cancelQuotation', 'Cancelled quotation ' + quoteId);
    return success({ quoteId: quoteId, status: QUOTE_STATUSES.CANCELLED }, 'Quotation cancelled');
  } catch (error) {
    logError('cancelQuotation', error);
    return fail(error && error.message ? error.message : 'Failed to cancel quotation');
  }
}

function getQuotationHistory(customerId) {
  try {
    const idCheck = requireValue(customerId, 'customerId');
    if (!idCheck.ok) {
      return idCheck;
    }
    ensureQuotationSheets();
    const result = getSheetData(QUOTE_HISTORY_SHEET);
    if (!result.ok) {
      return result;
    }
    const quotes = Array.isArray(result.data) ? result.data : [];
    const matches = quotes.filter(function (item) {
      return normalizeString(item.customerId) === normalizeString(customerId);
    }).sort(function (a, b) {
      return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    });
    return success(matches);
  } catch (error) {
    logError('getQuotationHistory', error);
    return fail(error && error.message ? error.message : 'Failed to load quotation history');
  }
}

function getQuotationRow(quoteId) {
  try {
    const idCheck = requireValue(quoteId, 'quoteId');
    if (!idCheck.ok) {
      return idCheck;
    }
    ensureQuotationSheets();
    const historyResult = getSheetData(QUOTE_HISTORY_SHEET);
    if (!historyResult.ok) {
      return historyResult;
    }
    const quotes = Array.isArray(historyResult.data) ? historyResult.data : [];
    const match = quotes.find(function (item) {
      return normalizeString(item.quoteId) === normalizeString(quoteId);
    });
    if (!match) {
      return notFound('Quotation not found');
    }
    return success(match);
  } catch (error) {
    logError('getQuotationRow', error);
    return fail(error && error.message ? error.message : 'Failed to load quotation');
  }
}

function getQuoteLines(quoteId) {
  try {
    const idCheck = requireValue(quoteId, 'quoteId');
    if (!idCheck.ok) {
      return idCheck;
    }
    ensureQuotationSheets();
    const result = getSheetData(QUOTE_LINES_SHEET);
    if (!result.ok) {
      return result;
    }
    const lines = Array.isArray(result.data) ? result.data : [];
    const matches = lines.filter(function (item) {
      return normalizeString(item.quoteId) === normalizeString(quoteId);
    });
    return success(matches);
  } catch (error) {
    logError('getQuoteLines', error);
    return fail(error && error.message ? error.message : 'Failed to load quotation lines');
  }
}

function findQuoteLine(quoteId, lineId) {
  try {
    const linesResult = getQuoteLines(quoteId);
    if (!linesResult.ok) {
      return linesResult;
    }
    const lines = Array.isArray(linesResult.data) ? linesResult.data : [];
    const line = lines.find(function (item) {
      return normalizeString(item.lineId) === normalizeString(lineId);
    });
    if (!line) {
      return notFound('Quotation line not found');
    }
    return success(line);
  } catch (error) {
    logError('findQuoteLine', error);
    return fail(error && error.message ? error.message : 'Failed to load quotation line');
  }
}

function recalcQuotationLine(line, customerId) {
  try {
    const productId = String(line.productId || '').trim();
    const quantity = roundCurrency(parseNumericValue(line.qty || 0));
    if (!productId || quantity <= 0) {
      return Object.assign({}, line, { qty: quantity, netPrice: 0, lineTotal: 0 });
    }
    const priceResult = calculateListPrice(productId);
    const productResult = getProduct(productId);
    var product = {};
    if (productResult.ok) {
      product = productResult.data || {};
    }
    const listPrice = priceResult.ok ? roundCurrency(parseNumericValue(priceResult.data && priceResult.data.listPrice)) : roundCurrency(parseNumericValue(line.listPrice || 0));
    const discountResult = getDiscount(customerId, getProductGroupCode(product));
    const discountPercent = discountResult.ok ? roundCurrency(parseNumericValue(discountResult.data && discountResult.data.discountPercent)) : roundCurrency(parseNumericValue(line.discountPercent || 0));
    const netPrice = roundCurrency(listPrice * (1 - discountPercent / 100));
    const lineTotal = roundCurrency(netPrice * quantity);
    return Object.assign({}, line, {
      qty: quantity,
      listPrice: listPrice,
      discountPercent: discountPercent,
      netPrice: netPrice,
      lineTotal: lineTotal
    });
  } catch (error) {
    logError('recalcQuotationLine', error);
    return Object.assign({}, line, { netPrice: 0, lineTotal: 0 });
  }
}

function getProductGroupCode(product) {
  if (!product || typeof product !== 'object') {
    return '';
  }
  return String(product.groupCode || product.group || product.category || '').trim();
}

function ensureQuotationSheets() {
  try {
    ensureSheet(QUOTE_HISTORY_SHEET, ['quoteId', 'customerId', 'status', 'shipping', 'specialDiscount', 'subtotal', 'vat', 'grandTotal', 'createdAt', 'updatedAt']);
    ensureSheet(QUOTE_LINES_SHEET, ['quoteId', 'lineId', 'productId', 'productName', 'qty', 'listPrice', 'discountPercent', 'netPrice', 'lineTotal', 'status', 'createdAt', 'updatedAt']);
    return success(true);
  } catch (error) {
    logError('ensureQuotationSheets', error);
    return fail(error && error.message ? error.message : 'Failed to ensure quotation sheets');
  }
}

function generateId(prefix) {
  var now = new Date();
  return String(prefix || 'ID').toUpperCase() + '_' + now.getTime() + '_' + Math.floor(Math.random() * 10000);
}
