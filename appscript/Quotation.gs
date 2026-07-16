const QUOTATION_SAVE_LOCK_TIMEOUT_MS = 15000;
const QUOTATION_SAVE_IDEMPOTENCY_TTL_SECONDS = 600;
const QUOTATION_SAVE_IN_PROGRESS_TTL_SECONDS = 90;

function normalizeQuoteType(value) {
  const text = String(value || '').trim().toUpperCase();
  return text === 'GYPROC' ? 'GYPROC' : 'WEBER';
}

function isInvalidExplicitQuoteType(value) {
  const text = String(value || '').trim().toUpperCase();
  return Boolean(text && text !== 'GYPROC' && text !== 'WEBER');
}

function getQuotationProductBusinessUnit(product) {
  if (typeof getProductBusinessUnit === 'function') {
    return getProductBusinessUnit(product);
  }
  const item = product && typeof product === 'object' ? product : {};
  const text = String(item.businessUnit || item.quoteType || item.bu || item.brand || '').trim().toUpperCase();
  if (text.indexOf('GYPROC') >= 0) return 'GYPROC';
  if (text.indexOf('WEBER') >= 0) return 'WEBER';
  return '';
}

function validateProductForQuotationLine(product) {
  if (typeof filterActiveProductObject === 'function' && !filterActiveProductObject(product)) {
    return validationError('Product is inactive');
  }
  const productQuoteType = getQuotationProductBusinessUnit(product);
  if (!productQuoteType) {
    return validationError('productBusinessUnit is required');
  }
  return success({ productBusinessUnit: productQuoteType });
}

function validateProductMatchesQuoteType(product, quoteType) {
  return validateProductForQuotationLine(product);
}

function createQuotation(customerId) {
  try {
    const payload = customerId && typeof customerId === 'object' ? customerId : { customerId: customerId };
    const targetCustomerId = payload.customerId || payload.value;
    const auth = requireApiUser(payload);
    if (!auth.ok) {
      return auth;
    }
    const idCheck = requireValue(targetCustomerId, 'customerId');
    if (!idCheck.ok) {
      return idCheck;
    }
    const customerResult = getCustomer(targetCustomerId);
    if (!customerResult.ok) {
      return customerResult;
    }
    const quoteId = generateId('QUOTE');
    const now = new Date().toISOString();
    if (isInvalidExplicitQuoteType(payload.quoteType || payload.businessUnit)) {
      return validationError('businessUnit must be WEBER or GYPROC');
    }
    const quoteType = normalizeQuoteType(payload.quoteType || payload.businessUnit);
    const row = {
      quoteId: quoteId,
      quoteType: quoteType,
      businessUnit: quoteType,
      customerId: String(targetCustomerId).trim(),
      customerName: String(customerResult.data && customerResult.data.customerName || '').trim(),
      status: QUOTE_STATUSES.DRAFT,
      shipping: 0,
      specialDiscount: 0,
      subtotal: 0,
      vat: 0,
      grandTotal: 0,
      createdBy: String(auth.data.quoteDisplayName || auth.data.fullName || auth.data.displayName || auth.data.username || '').trim(),
      createdById: String(auth.data.userId || '').trim(),
      createdByUserId: String(auth.data.userId || '').trim(),
      createdByUsername: String(auth.data.username || '').trim(),
      quoteDisplayName: String(auth.data.quoteDisplayName || auth.data.fullName || auth.data.displayName || auth.data.username || '').trim(),
      updatedBy: String(auth.data.quoteDisplayName || auth.data.fullName || auth.data.displayName || auth.data.username || '').trim(),
      updatedById: String(auth.data.userId || '').trim(),
      updatedByUsername: String(auth.data.username || '').trim(),
      createdAt: now,
      updatedAt: now
    };
    ensureQuotationSheets();
    const insertResult = appendRow(QUOTE_HISTORY_SHEET, row);
    if (!insertResult.ok) {
      return insertResult;
    }
    clearQuotationCaches(quoteId, '');
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
    const lineProductCheck = validateProductForQuotationLine(product);
    if (!lineProductCheck.ok) {
      return lineProductCheck;
    }
    const discountResult = getDiscount(quote.customerId, getProductGroupCode(product));
    const listPrice = roundCurrency(parseNumericValue(product.listPrice || product.price || 0));
    const discountPercent = discountResult.ok ? roundCurrency(parseNumericValue(discountResult.data && discountResult.data.discountPercent)) : 0;
    const netPrice = roundCurrency(listPrice * (1 - discountPercent / 100));
    const lineTotal = roundCurrency(netPrice * quantity);
    const lineId = generateId('LINE');
    const now = new Date().toISOString();
    const existingLinesResult = getQuoteLines(quoteId);
    const existingLines = existingLinesResult.ok && Array.isArray(existingLinesResult.data) ? existingLinesResult.data : [];
    const lineOrder = existingLines.filter(function (item) {
      return normalizeString(item.status) !== normalizeString(LINE_STATUSES.REMOVED);
    }).length + 1;
    const row = {
      quoteId: quoteId,
      lineId: lineId,
      lineNo: lineOrder,
      lineOrder: lineOrder,
      sortOrder: lineOrder,
      productId: String(productId).trim(),
      productBusinessUnit: lineProductCheck.data && lineProductCheck.data.productBusinessUnit || '',
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
    clearQuotationCaches(quoteId, quote.quoteNo);
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
    const discountResult = getDiscount(quote.customerId, getProductGroupCode(product));
    const listPrice = roundCurrency(parseNumericValue(product.listPrice || product.price || line.listPrice || 0));
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
    clearQuotationCaches(quoteId, quote.quoteNo);
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
    const quoteResult = getQuotationRow(quoteId);
    if (!quoteResult.ok) {
      return quoteResult;
    }
    const quote = quoteResult.data || {};
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
    clearQuotationCaches(quoteId, quote.quoteNo);
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
      return saveQuotationPayload(payload);
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
    clearQuotationCaches(quoteId, quote.quoteNo);
    logInfo('saveQuotation', 'Saved quotation ' + quoteId);
    return success({ quoteId: quoteId, totals: totals }, 'Quotation saved');
  } catch (error) {
    logError('saveQuotation', error);
    return fail(error && error.message ? error.message : 'Failed to save quotation');
  }
}

function saveQuotationPayload(payload) {
  var lock = null;
  var lockAcquired = false;
  var progressCacheKey = '';
  var requestCacheKey = '';
  var progressCacheOwned = false;
  try {
    const data = payload || {};
    const requestId = getQuotationSaveRequestId_(data);
    const auth = requireApiUser(data);
    if (!auth.ok) {
      return auth;
    }
    const cacheScope = getQuotationSaveUserCacheScope_(auth.data);
    requestCacheKey = requestId ? getQuotationSaveResultCacheKey_(requestId, cacheScope) : '';
    progressCacheKey = requestId ? getQuotationSaveProgressCacheKey_(requestId, cacheScope) : '';
    if (requestCacheKey) {
      const cachedResult = getServerCache(requestCacheKey);
      if (cachedResult && cachedResult.ok) {
        return cachedResult;
      }
    }
    if (progressCacheKey && getServerCache(progressCacheKey)) {
      return fail('Quotation save is already in progress', 'DUPLICATE_SUBMIT', {
        retryable: true
      });
    }
    if (progressCacheKey) {
      setServerCache(progressCacheKey, { startedAt: new Date().toISOString() }, QUOTATION_SAVE_IN_PROGRESS_TTL_SECONDS);
      progressCacheOwned = true;
    }

    const customerId = String(data.customerId || '').trim();
    const customerName = String(data.customerName || '').trim();
    const items = Array.isArray(data.items) ? data.items : [];
    if (!customerId) {
      return validationError('customerId is required');
    }
    if (!items.length) {
      return validationError('items is required');
    }

    const now = new Date().toISOString();
    const requestedQuoteId = String(data.quoteId || '').trim();
    const subtotal = roundCurrency(data.subtotal !== undefined ? parseQuotationNumericValue(data.subtotal) : sumQuotationItems(items, 'lineTotal'));
    const vat = roundCurrency(data.vat !== undefined ? parseQuotationNumericValue(data.vat) : sumQuotationItems(items, 'vat'));
    const shipping = roundCurrency(parseQuotationNumericValue(data.shipping));
    const specialDiscount = roundCurrency(parseQuotationNumericValue(data.specialDiscount));
    const grandTotal = roundCurrency(data.grandTotal !== undefined ? parseQuotationNumericValue(data.grandTotal) : subtotal + vat + shipping - specialDiscount);
    const status = normalizeQuotationStatus(data.status, QUOTE_STATUSES.SAVED);
    if (isInvalidExplicitQuoteType(data.quoteType || data.businessUnit)) {
      return validationError('businessUnit must be WEBER or GYPROC');
    }
    const businessUnitCheck = validateQuotationPayloadProductsBusinessUnit(items, normalizeQuoteType(data.quoteType || data.businessUnit));
    if (!businessUnitCheck.ok) {
      return businessUnitCheck;
    }
    const productBusinessUnits = businessUnitCheck.data && businessUnitCheck.data.productBusinessUnits || {};
    const normalizedItems = items.map(function (rawItem, index) {
      const rawProductId = String(rawItem && rawItem.productId || '').trim();
      return normalizeQuotationPayloadItem(rawItem, index + 1, productBusinessUnits[normalizeString(rawProductId)]);
    });

    lock = LockService.getScriptLock();
    lockAcquired = lock.tryLock(QUOTATION_SAVE_LOCK_TIMEOUT_MS);
    if (!lockAcquired) {
      logWarning('saveQuotationPayload', 'Unable to acquire quotation save lock for user ' + String(auth.data && auth.data.userId || '').trim());
      return fail('Quotation save is busy. Please try again.', 'LOCK_TIMEOUT', {
        retryable: true,
        timeoutMs: QUOTATION_SAVE_LOCK_TIMEOUT_MS
      });
    }
    if (requestCacheKey) {
      const lockedCachedResult = getServerCache(requestCacheKey);
      if (lockedCachedResult && lockedCachedResult.ok) {
        return lockedCachedResult;
      }
    }

    const lockedExistingResult = requestedQuoteId
      ? getQuotationRow(requestedQuoteId)
      : (String(data.quoteNo || '').trim() ? getQuotationRow(String(data.quoteNo || '').trim()) : null);
    if (requestedQuoteId && lockedExistingResult && !lockedExistingResult.ok) {
      return notFound('Quotation not found');
    }
    const existingQuote = lockedExistingResult && lockedExistingResult.ok ? lockedExistingResult.data || {} : null;
    if (existingQuote) {
      const permissionResult = canAccessQuotationRecord(auth.data, existingQuote);
      if (!permissionResult.ok) {
        return permissionResult;
      }
    }
    const quoteType = normalizeQuoteType(data.quoteType || data.businessUnit || (existingQuote && (existingQuote.quoteType || existingQuote.businessUnit)));

    const quoteNo = resolveQuotationNumberForSave_(data, existingQuote);
    if (!quoteNo.ok) {
      return quoteNo;
    }
    const resolvedQuoteNo = quoteNo.data.quoteNo;
    const quoteId = String(existingQuote && existingQuote.quoteId || requestedQuoteId || resolvedQuoteNo).trim();
    const duplicateCheck = ensureUniqueQuoteNoForSave_(resolvedQuoteNo, quoteId);
    if (!duplicateCheck.ok) {
      return duplicateCheck;
    }

    const auditUser = auth.ok ? auth.data : {};
    const auditName = String(auditUser.quoteDisplayName || auditUser.fullName || auditUser.displayName || auditUser.username || data.createdBy || data.sales || '').trim();
    const auditId = String(auditUser.userId || data.createdById || '').trim();
    const auditUsername = String(auditUser.username || data.createdByUsername || '').trim();
    const createdBy = String(existingQuote && existingQuote.createdBy || data.createdBy || auditName).trim();
    const createdById = String(existingQuote && existingQuote.createdById || data.createdById || auditId).trim();
    const createdByUserId = String(existingQuote && (existingQuote.createdByUserId || existingQuote.createdById) || data.createdByUserId || data.createdById || auditId).trim();
    const createdByUsername = String(existingQuote && existingQuote.createdByUsername || data.createdByUsername || auditUsername).trim();
    const quoteDisplayName = String(existingQuote && existingQuote.quoteDisplayName || data.quoteDisplayName || createdBy || auditName).trim();
    const headerObject = {
      quoteId: quoteId,
      quoteNo: resolvedQuoteNo,
      quoteType: quoteType,
      businessUnit: quoteType,
      customerId: customerId,
      customerName: customerName,
      subtotal: subtotal,
      vat: vat,
      shipping: shipping,
      specialDiscount: specialDiscount,
      grandTotal: grandTotal,
      status: status,
      createdBy: createdBy,
      createdById: createdById,
      createdByUserId: createdByUserId,
      createdByUsername: createdByUsername,
      quoteDisplayName: quoteDisplayName,
      updatedBy: auditName,
      updatedById: auditId,
      updatedByUsername: auditUsername,
      createdAt: String(existingQuote && existingQuote.createdAt || data.createdAt || now).trim(),
      updatedAt: now
    };
    const lineObjects = normalizedItems.map(function (item) {
      return buildQuotationLineObject_(quoteId, item);
    });

    const writeResult = existingQuote
      ? updateQuotationWithLinesLocked_(quoteId, existingQuote, headerObject, lineObjects)
      : createQuotationWithLinesLocked_(quoteId, resolvedQuoteNo, headerObject, lineObjects);
    if (!writeResult.ok) {
      return writeResult;
    }

    clearQuotationCaches(quoteId, resolvedQuoteNo);
    logInfo('saveQuotation', 'Saved quotation ' + resolvedQuoteNo);
    const saveResult = success({
      quoteId: quoteId,
      quoteNo: resolvedQuoteNo,
      subtotal: subtotal,
      vat: vat,
      shipping: shipping,
      specialDiscount: specialDiscount,
      grandTotal: grandTotal,
      status: status,
      quoteType: quoteType,
      businessUnit: quoteType
    }, 'Quotation saved');
    if (requestCacheKey) {
      setServerCache(requestCacheKey, saveResult, QUOTATION_SAVE_IDEMPOTENCY_TTL_SECONDS);
    }
    return saveResult;
  } catch (error) {
    logError('saveQuotationPayload', error);
    return fail(error && error.message ? error.message : 'Failed to save quotation');
  } finally {
    if (progressCacheOwned && progressCacheKey) {
      clearServerCache(progressCacheKey);
    }
    if (lockAcquired && lock) {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        logWarning('saveQuotationPayload', 'Unable to release quotation save lock');
      }
    }
  }
}

function getQuotationSaveRequestId_(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const value = String(data.clientRequestId || data.clientSaveId || data.quoteSaveRequestId || '').trim();
  return value ? value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80) : '';
}

function getQuotationSaveUserCacheScope_(user) {
  const data = user && typeof user === 'object' ? user : {};
  const value = String(data.userId || data.username || 'anonymous').trim();
  return value ? value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) : 'anonymous';
}

function getQuotationSaveResultCacheKey_(requestId, cacheScope) {
  return ['quotationSave', 'result', cacheScope || 'anonymous', String(requestId || '').trim()].join(':');
}

function getQuotationSaveProgressCacheKey_(requestId, cacheScope) {
  return ['quotationSave', 'progress', cacheScope || 'anonymous', String(requestId || '').trim()].join(':');
}

function resolveQuotationNumberForSave_(data, existingQuote) {
  try {
    const quoteNo = String(existingQuote && existingQuote.quoteNo || data.quoteNo || '').trim();
    if (quoteNo) {
      return success({ quoteNo: quoteNo });
    }
    return success({ quoteNo: generateQuoteNoLocked_() });
  } catch (error) {
    logError('resolveQuotationNumberForSave_', error);
    return fail(error && error.message ? error.message : 'Failed to generate quotation number');
  }
}

function ensureUniqueQuoteNoForSave_(quoteNo, quoteId) {
  try {
    const targetQuoteNo = String(quoteNo || '').trim();
    const targetQuoteId = String(quoteId || '').trim();
    if (!targetQuoteNo) {
      return validationError('quoteNo is required');
    }
    const existing = getQuotationRow(targetQuoteNo);
    if (existing.ok) {
      const existingQuoteId = String(existing.data && existing.data.quoteId || '').trim();
      if (normalizeString(existingQuoteId) !== normalizeString(targetQuoteId)) {
        return validationError('Duplicate quoteNo detected', {
          quoteNo: targetQuoteNo
        });
      }
    }
    return success(true);
  } catch (error) {
    logError('ensureUniqueQuoteNoForSave_', error);
    return fail(error && error.message ? error.message : 'Failed to validate quotation number');
  }
}

function buildQuotationLineObject_(quoteId, item) {
  return {
    quoteId: quoteId,
    lineNo: item.lineNo,
    lineOrder: item.lineOrder,
    sortOrder: item.sortOrder,
    productId: item.productId,
    productBusinessUnit: item.productBusinessUnit,
    productName: item.productName,
    unit: item.unit,
    qty: item.qty,
    listPrice: item.listPrice,
    discountPercent: item.discountPercent,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
    vat: item.vat,
    grandTotal: item.grandTotal,
    status: item.status
  };
}

function createQuotationWithLinesLocked_(quoteId, quoteNo, headerObject, lineObjects) {
  try {
    const linesResult = appendQuotationObjects(QUOTE_LINES_SHEET, getQuoteLineHeaders(), lineObjects);
    if (!linesResult.ok) {
      const rollbackResult = deleteQuotationLines(quoteId);
      logError('saveQuotationPayload', new Error('Lines write failed for new quotation ' + quoteNo));
      return fail(linesResult.message || 'Lines write failed', 'LINES_WRITE_FAILED', {
        quoteNo: quoteNo,
        rollbackOk: rollbackResult.ok
      });
    }
    const headerResult = appendQuotationObject(QUOTE_HISTORY_SHEET, getQuoteHistoryHeaders(), headerObject);
    if (!headerResult.ok) {
      const rollbackResult = deleteQuotationLines(quoteId);
      logError('saveQuotationPayload', new Error('Header write failed for new quotation ' + quoteNo));
      return fail(headerResult.message || 'Header write failed', 'HEADER_WRITE_FAILED', {
        quoteNo: quoteNo,
        rollbackOk: rollbackResult.ok
      });
    }
    const verifyResult = verifyQuotationSaveResult_(quoteId, lineObjects.length);
    if (!verifyResult.ok) {
      const linesRollbackResult = deleteQuotationLines(quoteId);
      const headerRollbackResult = deleteQuotationHeaderLocked_(quoteId, quoteNo);
      logError('saveQuotationPayload', new Error('Verification failed for new quotation ' + quoteNo + '; linesRollback=' + (linesRollbackResult.ok ? 'ok' : 'failed') + '; headerRollback=' + (headerRollbackResult.ok ? 'ok' : 'failed')));
      return fail(verifyResult.message || 'Verification failed', 'PARTIAL_SAVE_DETECTED', {
        quoteId: quoteId,
        quoteNo: quoteNo,
        rollbackOk: linesRollbackResult.ok && headerRollbackResult.ok
      });
    }
    return verifyResult;
  } catch (error) {
    const linesRollbackResult = deleteQuotationLines(quoteId);
    const headerRollbackResult = deleteQuotationHeaderLocked_(quoteId, quoteNo);
    logError('createQuotationWithLinesLocked_', new Error((error && error.message ? error.message : 'Create failed') + '; linesRollback=' + (linesRollbackResult.ok ? 'ok' : 'failed') + '; headerRollback=' + (headerRollbackResult.ok ? 'ok' : 'failed')));
    return fail(error && error.message ? error.message : 'Failed to create quotation', 'PARTIAL_SAVE_DETECTED', {
      quoteId: quoteId,
      quoteNo: quoteNo,
      rollbackOk: linesRollbackResult.ok && headerRollbackResult.ok
    });
  }
}

function updateQuotationWithLinesLocked_(quoteId, previousHeaderObject, headerObject, lineObjects) {
  const previousLinesResult = getQuoteLines(quoteId);
  const previousLines = previousLinesResult.ok && Array.isArray(previousLinesResult.data) ? previousLinesResult.data : [];
  const previousHeader = previousHeaderObject && typeof previousHeaderObject === 'object' ? previousHeaderObject : {};
  try {
    const replaceResult = replaceQuotationLinesLocked_(quoteId, lineObjects);
    if (!replaceResult.ok) {
      const rollbackResult = replaceQuotationLinesLocked_(quoteId, previousLines);
      logError('saveQuotationPayload', new Error('Lines replace failed for quotation ' + quoteId + '; rollback=' + (rollbackResult.ok ? 'ok' : 'failed')));
      return fail(replaceResult.message || 'Lines write failed', 'LINES_WRITE_FAILED', {
        quoteId: quoteId,
        rollbackOk: rollbackResult.ok
      });
    }
    const headerResult = updateQuotationObject(QUOTE_HISTORY_SHEET, getQuoteHistoryHeaders(), 'quoteId', quoteId, headerObject);
    if (!headerResult.ok) {
      const rollbackResult = replaceQuotationLinesLocked_(quoteId, previousLines);
      logError('saveQuotationPayload', new Error('Header update failed for quotation ' + quoteId + '; rollback=' + (rollbackResult.ok ? 'ok' : 'failed')));
      return fail(headerResult.message || 'Header write failed', 'HEADER_WRITE_FAILED', {
        quoteId: quoteId,
        rollbackOk: rollbackResult.ok
      });
    }
    const verifyResult = verifyQuotationSaveResult_(quoteId, lineObjects.length);
    if (!verifyResult.ok) {
      const linesRollbackResult = replaceQuotationLinesLocked_(quoteId, previousLines);
      const headerRollbackResult = previousHeader.quoteId
        ? updateQuotationObject(QUOTE_HISTORY_SHEET, getQuoteHistoryHeaders(), 'quoteId', quoteId, previousHeader)
        : success({ skipped: true });
      logError('saveQuotationPayload', new Error('Verification failed for quotation ' + quoteId + '; linesRollback=' + (linesRollbackResult.ok ? 'ok' : 'failed') + '; headerRollback=' + (headerRollbackResult.ok ? 'ok' : 'failed')));
      return fail(verifyResult.message || 'Verification failed', 'PARTIAL_SAVE_DETECTED', {
        quoteId: quoteId,
        rollbackOk: linesRollbackResult.ok && headerRollbackResult.ok
      });
    }
    return verifyResult;
  } catch (error) {
    const linesRollbackResult = replaceQuotationLinesLocked_(quoteId, previousLines);
    const headerRollbackResult = previousHeader.quoteId
      ? updateQuotationObject(QUOTE_HISTORY_SHEET, getQuoteHistoryHeaders(), 'quoteId', quoteId, previousHeader)
      : success({ skipped: true });
    logError('updateQuotationWithLinesLocked_', new Error((error && error.message ? error.message : 'Update failed') + '; linesRollback=' + (linesRollbackResult.ok ? 'ok' : 'failed') + '; headerRollback=' + (headerRollbackResult.ok ? 'ok' : 'failed')));
    return fail(error && error.message ? error.message : 'Failed to update quotation', 'PARTIAL_SAVE_DETECTED', {
      quoteId: quoteId,
      rollbackOk: linesRollbackResult.ok && headerRollbackResult.ok
    });
  }
}

function replaceQuotationLinesLocked_(quoteId, lineObjects) {
  try {
    const deleteResult = deleteQuotationLines(quoteId);
    if (!deleteResult.ok) {
      return fail(deleteResult.message || 'Lines delete failed', 'LINES_WRITE_FAILED', {
        quoteId: quoteId
      });
    }
    const appendResult = appendQuotationObjects(QUOTE_LINES_SHEET, getQuoteLineHeaders(), lineObjects);
    if (!appendResult.ok) {
      return fail(appendResult.message || 'Lines write failed', 'LINES_WRITE_FAILED', {
        quoteId: quoteId
      });
    }
    return success({ quoteId: quoteId, replaced: lineObjects.length });
  } catch (error) {
    logError('replaceQuotationLinesLocked_', error);
    return fail(error && error.message ? error.message : 'Failed to replace quotation lines', 'LINES_WRITE_FAILED', {
      quoteId: quoteId
    });
  }
}

function deleteQuotationHeaderLocked_(quoteId, quoteNo) {
  try {
    const sheet = getSheet(QUOTE_HISTORY_SHEET);
    if (!sheet || sheet.getLastRow() < 2) {
      return success({ deleted: 0 });
    }
    const headers = getQuotationSheetHeaders(sheet);
    const quoteIdIndex = headers.indexOf('quoteId');
    const quoteNoIndex = headers.indexOf('quoteNo');
    if (quoteIdIndex < 0) {
      return fail('quoteId column not found');
    }
    const targetQuoteId = normalizeString(quoteId);
    const targetQuoteNo = normalizeString(quoteNo);
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), headers.length)).getDisplayValues();
    var deleted = 0;
    for (var i = values.length - 1; i >= 0; i--) {
      const rowQuoteId = normalizeString(values[i][quoteIdIndex]);
      const rowQuoteNo = quoteNoIndex >= 0 ? normalizeString(values[i][quoteNoIndex]) : '';
      const quoteNoMatches = !targetQuoteNo || quoteNoIndex < 0 || rowQuoteNo === targetQuoteNo;
      if (targetQuoteId && rowQuoteId === targetQuoteId && quoteNoMatches) {
        sheet.deleteRow(i + 2);
        deleted += 1;
      }
    }
    return success({ deleted: deleted });
  } catch (error) {
    logError('deleteQuotationHeaderLocked_', error);
    return fail(error && error.message ? error.message : 'Failed to delete quotation header');
  }
}

function appendQuotationObjects(sheetName, headers, objects) {
  try {
    const list = Array.isArray(objects) ? objects : [];
    if (!list.length) {
      return success({ sheetName: sheetName, appended: 0 });
    }
    const sheet = ensureSheet(sheetName, headers);
    if (!sheet) {
      return fail('Unable to access sheet: ' + sheetName);
    }
    const activeHeaders = ensureQuotationSheetColumns(sheet, headers);
    const rows = list.map(function (object) {
      return activeHeaders.map(function (header) {
        return object[header] !== undefined ? object[header] : '';
      });
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, activeHeaders.length).setValues(rows);
    return success({ sheetName: sheetName, appended: rows.length });
  } catch (error) {
    logError('appendQuotationObjects', error);
    return fail(error && error.message ? error.message : 'Failed to append quotation rows');
  }
}

function verifyQuotationSaveResult_(quoteId, expectedLineCount) {
  const quoteResult = getQuotationRow(quoteId);
  if (!quoteResult.ok) {
    return fail('Partial save detected: quotation header missing', 'PARTIAL_SAVE_DETECTED', {
      quoteId: quoteId
    });
  }
  const linesResult = getQuoteLines(quoteId);
  if (!linesResult.ok) {
    return fail('Partial save detected: quotation lines unreadable', 'PARTIAL_SAVE_DETECTED', {
      quoteId: quoteId
    });
  }
  const actualLineCount = Array.isArray(linesResult.data) ? linesResult.data.length : 0;
  if (actualLineCount !== expectedLineCount) {
    return fail('Partial save detected: quotation line count mismatch', 'PARTIAL_SAVE_DETECTED', {
      quoteId: quoteId,
      expectedLineCount: expectedLineCount,
      actualLineCount: actualLineCount
    });
  }
  return success({ quoteId: quoteId, lineCount: actualLineCount });
}

function normalizeQuotationPayloadItem(item, lineNo, productBusinessUnit) {
  const data = item || {};
  const qty = roundCurrency(parseQuotationNumericValue(data.qty || 1));
  const listPrice = roundCurrency(parseQuotationNumericValue(data.listPrice));
  const discountPercent = roundCurrency(parseQuotationNumericValue(data.discountPercent || data.discount));
  const unitPrice = roundCurrency(data.unitPrice !== undefined ? parseQuotationNumericValue(data.unitPrice) : listPrice * (1 - discountPercent / 100));
  const lineTotal = roundCurrency(data.lineTotal !== undefined ? parseQuotationNumericValue(data.lineTotal) : unitPrice * qty);
  const vat = roundCurrency(data.vat !== undefined ? parseQuotationNumericValue(data.vat) : lineTotal * 0.07);
  const grandTotal = roundCurrency(data.grandTotal !== undefined ? parseQuotationNumericValue(data.grandTotal) : lineTotal + vat);
  return {
    lineNo: lineNo,
    lineOrder: lineNo,
    sortOrder: lineNo,
    productId: String(data.productId || '').trim(),
    productBusinessUnit: getQuotationProductBusinessUnit({ businessUnit: productBusinessUnit || data.productBusinessUnit || data.businessUnit || data.quoteType || data.brand }),
    productName: String(data.productName || '').trim(),
    unit: String(data.unit || '').trim(),
    qty: qty,
    listPrice: listPrice,
    discountPercent: discountPercent,
    unitPrice: unitPrice,
    lineTotal: lineTotal,
    vat: vat,
    grandTotal: grandTotal,
    status: String(data.status || LINE_STATUSES.ACTIVE).trim() || LINE_STATUSES.ACTIVE
  };
}

function validateQuotationPayloadProductsBusinessUnit(items, quoteType) {
  try {
    const productsResult = getProducts();
    if (!productsResult.ok) {
      return productsResult;
    }
    const products = Array.isArray(productsResult.data) ? productsResult.data : [];
    const list = Array.isArray(items) ? items : [];
    const productBusinessUnits = {};
    for (var i = 0; i < list.length; i++) {
      const productId = String(list[i] && list[i].productId || '').trim();
      if (!productId) {
        return validationError('productId is required');
      }
      const product = typeof findProductById === 'function'
        ? findProductById(productId, products)
        : products.find(function (item) {
          return normalizeString(item.productId || item.id || item.sku || item.productCode) === normalizeString(productId);
        });
      if (!product) {
        return notFound('Product not found');
      }
      const match = validateProductForQuotationLine(product);
      if (!match.ok) {
        return match;
      }
      productBusinessUnits[normalizeString(productId)] = match.data && match.data.productBusinessUnit || '';
    }
    return success({ productBusinessUnits: productBusinessUnits });
  } catch (error) {
    logError('validateQuotationPayloadProductsBusinessUnit', error);
    return fail(error && error.message ? error.message : 'Failed to validate quotation products');
  }
}

function sumQuotationItems(items, field) {
  return roundCurrency((Array.isArray(items) ? items : []).reduce(function (sum, item) {
    return sum + parseQuotationNumericValue(item && item[field]);
  }, 0));
}

function parseQuotationNumericValue(value) {
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  const text = String(value || '').replace(/,/g, '').replace(/%/g, '').trim();
  const numericValue = Number(text);
  return isNaN(numericValue) ? 0 : numericValue;
}

function normalizeQuotationStatus(value, fallback) {
  const status = String(value || fallback || QUOTE_STATUSES.SAVED).trim().toUpperCase();
  if (status === QUOTE_STATUSES.DRAFT || status === QUOTE_STATUSES.SAVED || status === QUOTE_STATUSES.CANCELLED) {
    return status;
  }
  return fallback || QUOTE_STATUSES.SAVED;
}

function generateQuoteNo() {
  return generateQuoteNoLocked_();
}

function generateQuoteNoLocked_() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = ('0' + (now.getMonth() + 1)).slice(-2);
  const dd = ('0' + now.getDate()).slice(-2);
  const datePart = '' + yyyy + mm + dd;
  const prefix = 'QT-' + datePart + '-';
  ensureQuotationSheets();
  const sheet = getSheet(QUOTE_HISTORY_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    return prefix + '0001';
  }
  const headers = getQuotationSheetHeaders(sheet);
  const quoteNoIndex = headers.indexOf('quoteNo');
  const quoteIdIndex = headers.indexOf('quoteId');
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), headers.length)).getDisplayValues();
  var maxNo = 0;
  values.forEach(function (row) {
    const quoteNo = String((quoteNoIndex >= 0 ? row[quoteNoIndex] : '') || (quoteIdIndex >= 0 ? row[quoteIdIndex] : '') || '').trim();
    if (quoteNo.indexOf(prefix) === 0) {
      const running = parseInt(quoteNo.slice(prefix.length), 10);
      if (!isNaN(running) && running > maxNo) {
        maxNo = running;
      }
    }
  });
  return prefix + ('0000' + (maxNo + 1)).slice(-4);
}

function appendQuotationObject(sheetName, headers, object) {
  try {
    const sheet = ensureSheet(sheetName, headers);
    if (!sheet) {
      return fail('Unable to access sheet: ' + sheetName);
    }
    const existingHeaders = ensureQuotationSheetColumns(sheet, headers);
    const activeHeaders = existingHeaders.length ? existingHeaders : headers;
    const row = activeHeaders.map(function (header) {
      return object[header] !== undefined ? object[header] : '';
    });
    sheet.appendRow(row);
    return success({ sheetName: sheetName, row: row });
  } catch (error) {
    logError('appendQuotationObject', error);
    return fail(error && error.message ? error.message : 'Failed to append quotation row');
  }
}

function updateQuotationObject(sheetName, headers, idColumn, idValue, object) {
  try {
    const sheet = ensureSheet(sheetName, headers);
    if (!sheet) {
      return fail('Unable to access sheet: ' + sheetName);
    }
    const activeHeaders = ensureQuotationSheetColumns(sheet, headers);
    const idIndex = activeHeaders.indexOf(idColumn);
    if (idIndex < 0) {
      return fail('ID column not found');
    }
    const lastRow = sheet.getLastRow();
    const lastColumn = Math.max(sheet.getLastColumn(), activeHeaders.length);
    const values = lastRow > 0 ? sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues() : [];
    const targetRowIndex = values.slice(1).findIndex(function (row) {
      return normalizeString(row[idIndex]) === normalizeString(idValue);
    });
    if (targetRowIndex < 0) {
      return fail('Record not found');
    }
    const actualRowIndex = targetRowIndex + 2;
    activeHeaders.forEach(function (header, index) {
      if (object[header] !== undefined) {
        sheet.getRange(actualRowIndex, index + 1).setValue(object[header]);
      }
    });
    return success({ sheetName: sheetName, idColumn: idColumn, idValue: idValue });
  } catch (error) {
    logError('updateQuotationObject', error);
    return fail(error && error.message ? error.message : 'Failed to update quotation row');
  }
}

function deleteQuotationLines(quoteId) {
  try {
    const sheet = ensureSheet(QUOTE_LINES_SHEET, getQuoteLineHeaders());
    if (!sheet) {
      return fail('Unable to access sheet: ' + QUOTE_LINES_SHEET);
    }
    const headers = ensureQuotationSheetColumns(sheet, getQuoteLineHeaders());
    const quoteIdIndex = headers.indexOf('quoteId');
    if (quoteIdIndex < 0) {
      return fail('quoteId column not found');
    }
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return success({ deleted: 0 });
    }
    const values = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), headers.length)).getDisplayValues();
    var deleted = 0;
    for (var i = values.length - 1; i >= 0; i--) {
      if (normalizeString(values[i][quoteIdIndex]) === normalizeString(quoteId)) {
        sheet.deleteRow(i + 2);
        deleted += 1;
      }
    }
    return success({ deleted: deleted });
  } catch (error) {
    logError('deleteQuotationLines', error);
    return fail(error && error.message ? error.message : 'Failed to replace quotation lines');
  }
}

function ensureQuotationSheetColumns(sheet, requiredHeaders) {
  try {
    var headers = getQuotationSheetHeaders(sheet);
    if (!headers.length) {
      sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
      return requiredHeaders.slice();
    }
    var changed = false;
    requiredHeaders.forEach(function (header) {
      if (headers.indexOf(header) < 0) {
        headers.push(header);
        changed = true;
      }
    });
    if (changed) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    return headers;
  } catch (error) {
    logError('ensureQuotationSheetColumns', error);
    return requiredHeaders || [];
  }
}

function getQuotationSheetHeaders(sheet) {
  try {
    if (!sheet || sheet.getLastRow() < 1) {
      return [];
    }
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
    return headers.filter(function (header) {
      return String(header || '').trim() !== '';
    }).map(function (header) {
      return String(header || '').trim();
    });
  } catch (error) {
    logError('getQuotationSheetHeaders', error);
    return [];
  }
}

function getQuoteHistoryHeaders() {
  return ['quoteId', 'quoteNo', 'quoteType', 'businessUnit', 'customerId', 'customerName', 'subtotal', 'vat', 'shipping', 'specialDiscount', 'grandTotal', 'status', 'createdBy', 'createdById', 'createdByUserId', 'createdByUsername', 'quoteDisplayName', 'updatedBy', 'updatedById', 'updatedByUsername', 'createdAt', 'updatedAt'];
}

function getQuoteLineHeaders() {
  return ['quoteId', 'lineNo', 'lineOrder', 'sortOrder', 'productId', 'productBusinessUnit', 'productName', 'unit', 'qty', 'listPrice', 'discountPercent', 'unitPrice', 'lineTotal', 'vat', 'grandTotal', 'status'];
}

function extractQuoteId(payload) {
  if (payload && typeof payload === 'object') {
    return String(payload.quoteId || payload.quoteNo || '').trim();
  }
  return String(payload || '').trim();
}

function normalizeLoadedQuotationLine(line) {
  const item = line || {};
  const qty = roundCurrency(parseQuotationNumericValue(item.qty || 0));
  const listPrice = roundCurrency(parseQuotationNumericValue(item.listPrice || 0));
  const discountPercent = roundCurrency(parseQuotationNumericValue(item.discountPercent || item.discount || 0));
  const unitPrice = roundCurrency(parseQuotationNumericValue(item.unitPrice || item.netPrice || (listPrice * (1 - discountPercent / 100))));
  const lineTotal = roundCurrency(parseQuotationNumericValue(item.lineTotal || unitPrice * qty));
  const vat = roundCurrency(parseQuotationNumericValue(item.vat || lineTotal * 0.07));
  const grandTotal = roundCurrency(parseQuotationNumericValue(item.grandTotal || lineTotal + vat));
  var productBusinessUnit = getQuotationProductBusinessUnit(item);
  if (!productBusinessUnit && item.productId) {
    const productResult = getProduct(item.productId);
    if (productResult.ok) {
      productBusinessUnit = getQuotationProductBusinessUnit(productResult.data);
    }
  }
  return Object.assign({}, item, {
    lineNo: String(item.lineNo || item.lineOrder || item.sortOrder || '').trim(),
    lineOrder: String(item.lineOrder || item.sortOrder || item.lineNo || '').trim(),
    sortOrder: String(item.sortOrder || item.lineOrder || item.lineNo || '').trim(),
    productId: String(item.productId || '').trim(),
    productBusinessUnit: productBusinessUnit,
    productName: String(item.productName || '').trim(),
    unit: String(item.unit || '').trim(),
    qty: qty,
    listPrice: listPrice,
    discountPercent: discountPercent,
    unitPrice: unitPrice,
    netPrice: unitPrice,
    lineTotal: lineTotal,
    vat: vat,
    grandTotal: grandTotal,
    status: String(item.status || LINE_STATUSES.ACTIVE).trim() || LINE_STATUSES.ACTIVE
  });
}

function getQuotationLineOrderValue(line, fallbackIndex) {
  const item = line || {};
  const value = parseInt(String(item.lineOrder || item.sortOrder || item.lineNo || '').replace(/,/g, ''), 10);
  return !isNaN(value) && value > 0 ? value : (fallbackIndex + 1);
}

function sortQuotationLinesByOrder(lines) {
  return (Array.isArray(lines) ? lines : []).map(function (line, index) {
    return { line: line, index: index, order: getQuotationLineOrderValue(line, index) };
  }).sort(function (a, b) {
    return a.order - b.order || a.index - b.index;
  }).map(function (entry) {
    return entry.line;
  });
}

function parseQuotationDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function getQuotationHistoryCacheKey(filter, limit) {
  const data = filter || {};
  const user = data.currentUser || {};
  const normalizedLimit = limit || 50;
  if (isDefaultQuotationHistoryRequest(data, normalizedLimit)) {
    return 'quotationHistory:default:50';
  }
  return [
    'quotationHistory',
    normalizedLimit,
    normalizeString(data.customerId || '').slice(0, 40),
    normalizeString(data.keyword || '').slice(0, 40),
    normalizeString(data.status || '').slice(0, 20),
    String(data.dateFrom || '').slice(0, 24),
    String(data.dateTo || '').slice(0, 24),
    normalizeString(user.userId || user.username || '').slice(0, 40)
  ].join(':');
}

function isDefaultQuotationHistoryRequest(filter, limit) {
  const data = filter || {};
  return limit === 50
    && !data.currentUser
    && !String(data.customerId || '').trim()
    && !String(data.keyword || '').trim()
    && !String(data.status || '').trim()
    && !String(data.dateFrom || '').trim()
    && !String(data.dateTo || '').trim();
}

function getLoadQuotationCacheKey(quoteId) {
  return 'loadQuotation:' + normalizeString(quoteId);
}

function clearQuotationCaches(quoteId, quoteNo) {
  clearServerCache(getQuotationHistoryCacheKey(null, 50));
  if (quoteId) {
    clearServerCache(getLoadQuotationCacheKey(quoteId));
  }
  if (quoteNo) {
    clearServerCache(getLoadQuotationCacheKey(quoteNo));
  }
}

function loadQuotation(payload) {
  const timer = startPerformanceTimer('quotation.load');
  try {
    const quoteId = extractQuoteId(payload);
    const cacheKey = getLoadQuotationCacheKey(quoteId);
    const cached = getServerCache(cacheKey);
    if (cached) {
      endPerformanceTimer(timer, 'cache=hit');
      return success(cached);
    }
    const quoteResult = getQuotationRow(quoteId);
    if (!quoteResult.ok) {
      endPerformanceTimer(timer, 'quote=false');
      return quoteResult;
    }
    const quote = Object.assign({}, quoteResult.data || {});
    quote.quoteType = normalizeQuoteType(quote.quoteType || quote.businessUnit);
    quote.businessUnit = quote.quoteType;
    const permissionResult = canAccessQuotationRecord(payload && payload.currentUser, quote);
    if (!permissionResult.ok) {
      endPerformanceTimer(timer, 'permission=false');
      return permissionResult;
    }
    const targetQuoteId = String(quote.quoteId || quoteId).trim();
    const linesResult = getQuoteLines(targetQuoteId);
    if (!linesResult.ok) {
      endPerformanceTimer(timer, 'lines=false');
      return linesResult;
    }
    const lines = Array.isArray(linesResult.data) ? linesResult.data.map(normalizeLoadedQuotationLine) : [];
    const activeLines = sortQuotationLinesByOrder(lines.filter(function (item) {
      return normalizeString(item.status) !== normalizeString(LINE_STATUSES.REMOVED);
    }));
    const subtotal = roundCurrency(parseQuotationNumericValue(quote.subtotal || sumQuotationItems(activeLines, 'lineTotal')));
    const vat = roundCurrency(parseQuotationNumericValue(quote.vat || sumQuotationItems(activeLines, 'vat')));
    const shipping = roundCurrency(parseQuotationNumericValue(quote.shipping || 0));
    const specialDiscount = roundCurrency(parseQuotationNumericValue(quote.specialDiscount || 0));
    const grandTotal = roundCurrency(parseQuotationNumericValue(quote.grandTotal || subtotal + vat + shipping - specialDiscount));
    const data = { quote: quote, lines: activeLines, totals: {
      subtotal: subtotal,
      vat: vat,
      shipping: shipping,
      specialDiscount: specialDiscount,
      grandTotal: grandTotal
    } };
    setServerCache(cacheKey, data, 600);
    if (targetQuoteId && normalizeString(targetQuoteId) !== normalizeString(quoteId)) {
      setServerCache(getLoadQuotationCacheKey(targetQuoteId), data, 600);
    }
    if (quote.quoteNo && normalizeString(quote.quoteNo) !== normalizeString(quoteId)) {
      setServerCache(getLoadQuotationCacheKey(quote.quoteNo), data, 600);
    }
    endPerformanceTimer(timer, 'cache=miss lines=' + activeLines.length);
    return success(data);
  } catch (error) {
    endPerformanceTimer(timer, 'error=true');
    logError('loadQuotation', error);
    return fail(error && error.message ? error.message : 'Failed to load quotation');
  }
}

function duplicateQuotation(payload) {
  try {
    const quoteId = extractQuoteId(payload);
    const originalResult = loadQuotation(payload);
    if (!originalResult.ok) {
      return originalResult;
    }
    const original = originalResult.data;
    const quote = original.quote || {};
    const totals = original.totals || {};
    const duplicatePayload = {
      customerId: String(quote.customerId || '').trim(),
      customerName: String(quote.customerName || '').trim(),
      quoteType: normalizeQuoteType(quote.quoteType || quote.businessUnit),
      businessUnit: normalizeQuoteType(quote.quoteType || quote.businessUnit),
      items: Array.isArray(original.lines) ? original.lines.map(function (line) {
        return {
          productId: line.productId,
          lineOrder: line.lineOrder || line.sortOrder || line.lineNo,
          sortOrder: line.sortOrder || line.lineOrder || line.lineNo,
          productBusinessUnit: getQuotationProductBusinessUnit(line),
          productName: line.productName,
          unit: line.unit,
          qty: line.qty,
          listPrice: line.listPrice,
          discountPercent: line.discountPercent,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          vat: line.vat,
          grandTotal: line.grandTotal,
          status: LINE_STATUSES.ACTIVE
        };
      }) : [],
      subtotal: totals.subtotal,
      vat: totals.vat,
      shipping: totals.shipping,
      specialDiscount: totals.specialDiscount,
      grandTotal: totals.grandTotal,
      status: QUOTE_STATUSES.DRAFT,
      createdBy: String(quote.createdBy || '').trim()
    };
    const saveResult = saveQuotationPayload(duplicatePayload);
    if (!saveResult.ok) {
      return saveResult;
    }
    logInfo('duplicateQuotation', 'Duplicated quote ' + quoteId + ' to ' + saveResult.data.quoteId);
    return success(Object.assign({ originalQuoteId: quoteId, newQuoteId: saveResult.data.quoteId }, saveResult.data), 'Quotation duplicated');
  } catch (error) {
    logError('duplicateQuotation', error);
    return fail(error && error.message ? error.message : 'Failed to duplicate quotation');
  }
}

function cancelQuotation(payload) {
  try {
    const quoteId = extractQuoteId(payload);
    const quoteResult = getQuotationRow(quoteId);
    if (!quoteResult.ok) {
      return quoteResult;
    }
    const permissionResult = canAccessQuotationRecord(payload && payload.currentUser, quoteResult.data);
    if (!permissionResult.ok) {
      return permissionResult;
    }
    const targetQuoteId = String(quoteResult.data && quoteResult.data.quoteId || quoteId).trim();
    const updateObject = {
      status: QUOTE_STATUSES.CANCELLED,
      updatedAt: new Date().toISOString()
    };
    const result = updateRowById(QUOTE_HISTORY_SHEET, 'quoteId', targetQuoteId, updateObject);
    if (!result.ok) {
      return result;
    }
    clearQuotationCaches(targetQuoteId, quoteResult.data && quoteResult.data.quoteNo);
    logInfo('cancelQuotation', 'Cancelled quotation ' + targetQuoteId);
    return success({ quoteId: targetQuoteId, quoteNo: quoteResult.data.quoteNo || targetQuoteId, status: QUOTE_STATUSES.CANCELLED }, 'Quotation cancelled');
  } catch (error) {
    logError('cancelQuotation', error);
    return fail(error && error.message ? error.message : 'Failed to cancel quotation');
  }
}

function getQuotationHistory(payload) {
  const timer = startPerformanceTimer('quotation.history');
  try {
    const filter = payload && typeof payload === 'object' ? payload : { customerId: payload };
    const customerId = String(filter.customerId || '').trim();
    const keyword = normalizeString(filter.keyword || '');
    const status = normalizeString(filter.status || '');
    const dateFrom = parseQuotationDate(filter.dateFrom);
    const dateTo = parseQuotationDate(filter.dateTo);
    const limit = Math.max(1, Math.min(parseInt(filter.limit || 50, 10) || 50, 200));
    const historyCacheKey = getQuotationHistoryCacheKey(filter, limit);
    const cached = getServerCache(historyCacheKey);
    if (cached) {
      endPerformanceTimer(timer, 'cache=hit count=' + (Array.isArray(cached) ? cached.length : 0));
      return success(cached);
    }
    ensureQuotationSheets();
    const sheet = getSheet(QUOTE_HISTORY_SHEET);
    if (!sheet || sheet.getLastRow() < 2) {
      endPerformanceTimer(timer, 'count=0');
      return success([]);
    }
    const headers = getQuotationSheetHeaders(sheet);
    const lastRow = sheet.getLastRow();
    const values = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), headers.length)).getDisplayValues();
    const quoteIdIndex = headers.indexOf('quoteId');
    const quoteNoIndex = headers.indexOf('quoteNo');
    const quoteTypeIndex = headers.indexOf('quoteType');
    const businessUnitIndex = headers.indexOf('businessUnit');
    const customerIdIndex = headers.indexOf('customerId');
    const customerNameIndex = headers.indexOf('customerName');
    const statusIndex = headers.indexOf('status');
    const createdAtIndex = headers.indexOf('createdAt');
    const updatedAtIndex = headers.indexOf('updatedAt');
    const subtotalIndex = headers.indexOf('subtotal');
    const vatIndex = headers.indexOf('vat');
    const shippingIndex = headers.indexOf('shipping');
    const specialDiscountIndex = headers.indexOf('specialDiscount');
    const grandTotalIndex = headers.indexOf('grandTotal');
    const createdByIndex = headers.indexOf('createdBy');
    const createdByIdIndex = headers.indexOf('createdById');
    const createdByUserIdIndex = headers.indexOf('createdByUserId');
    const createdByUsernameIndex = headers.indexOf('createdByUsername');
    const quoteDisplayNameIndex = headers.indexOf('quoteDisplayName');
    const updatedByIndex = headers.indexOf('updatedBy');
    const updatedByIdIndex = headers.indexOf('updatedById');
    const updatedByUsernameIndex = headers.indexOf('updatedByUsername');
    const currentUser = filter.currentUser || null;

    const matches = values.filter(function (row) {
      const rowQuote = {
        createdBy: createdByIndex >= 0 ? row[createdByIndex] : '',
        createdById: createdByIdIndex >= 0 ? row[createdByIdIndex] : '',
        createdByUserId: createdByUserIdIndex >= 0 ? row[createdByUserIdIndex] : '',
        createdByUsername: createdByUsernameIndex >= 0 ? row[createdByUsernameIndex] : '',
        updatedBy: updatedByIndex >= 0 ? row[updatedByIndex] : '',
        updatedById: updatedByIdIndex >= 0 ? row[updatedByIdIndex] : '',
        updatedByUsername: updatedByUsernameIndex >= 0 ? row[updatedByUsernameIndex] : ''
      };
      if (!canAccessQuotationRecord(currentUser, rowQuote).ok) {
        return false;
      }
      const quoteDate = parseQuotationDate((createdAtIndex >= 0 ? row[createdAtIndex] : '') || (updatedAtIndex >= 0 ? row[updatedAtIndex] : ''));
      const haystack = normalizeString([
        quoteNoIndex >= 0 ? row[quoteNoIndex] : '',
        quoteIdIndex >= 0 ? row[quoteIdIndex] : '',
        customerNameIndex >= 0 ? row[customerNameIndex] : '',
        customerIdIndex >= 0 ? row[customerIdIndex] : '',
        statusIndex >= 0 ? row[statusIndex] : '',
        quoteTypeIndex >= 0 ? row[quoteTypeIndex] : '',
        businessUnitIndex >= 0 ? row[businessUnitIndex] : ''
      ].join(' '));
      if (customerId && normalizeString(customerIdIndex >= 0 ? row[customerIdIndex] : '') !== normalizeString(customerId)) {
        return false;
      }
      if (status && normalizeString(statusIndex >= 0 ? row[statusIndex] : '') !== status) {
        return false;
      }
      if (keyword && haystack.indexOf(keyword) < 0) {
        return false;
      }
      if (dateFrom && (!quoteDate || quoteDate < dateFrom)) {
        return false;
      }
      if (dateTo && (!quoteDate || quoteDate > dateTo)) {
        return false;
      }
      return true;
    }).sort(function (a, b) {
      const bDate = new Date((updatedAtIndex >= 0 ? b[updatedAtIndex] : '') || (createdAtIndex >= 0 ? b[createdAtIndex] : '') || 0);
      const aDate = new Date((updatedAtIndex >= 0 ? a[updatedAtIndex] : '') || (createdAtIndex >= 0 ? a[createdAtIndex] : '') || 0);
      return bDate - aDate;
    }).slice(0, limit).map(function (row) {
      const quoteIdValue = quoteIdIndex >= 0 ? row[quoteIdIndex] : '';
      const quoteNoValue = quoteNoIndex >= 0 ? row[quoteNoIndex] : quoteIdValue;
      const grandTotal = roundCurrency(parseQuotationNumericValue(grandTotalIndex >= 0 ? row[grandTotalIndex] : 0));
      return {
        quoteId: String(quoteIdValue || '').trim(),
        quoteNo: String(quoteNoValue || quoteIdValue || '').trim(),
        quoteType: normalizeQuoteType((quoteTypeIndex >= 0 ? row[quoteTypeIndex] : '') || (businessUnitIndex >= 0 ? row[businessUnitIndex] : '')),
        businessUnit: normalizeQuoteType((quoteTypeIndex >= 0 ? row[quoteTypeIndex] : '') || (businessUnitIndex >= 0 ? row[businessUnitIndex] : '')),
        customerId: String(customerIdIndex >= 0 ? row[customerIdIndex] || '' : '').trim(),
        customerName: String(customerNameIndex >= 0 ? row[customerNameIndex] || '' : '').trim(),
        subtotal: roundCurrency(parseQuotationNumericValue(subtotalIndex >= 0 ? row[subtotalIndex] : 0)),
        vat: roundCurrency(parseQuotationNumericValue(vatIndex >= 0 ? row[vatIndex] : 0)),
        shipping: roundCurrency(parseQuotationNumericValue(shippingIndex >= 0 ? row[shippingIndex] : 0)),
        specialDiscount: roundCurrency(parseQuotationNumericValue(specialDiscountIndex >= 0 ? row[specialDiscountIndex] : 0)),
        grandTotal: grandTotal,
        total: grandTotal,
        status: String(statusIndex >= 0 ? row[statusIndex] || '' : '').trim(),
        createdBy: String(createdByIndex >= 0 ? row[createdByIndex] || '' : '').trim(),
        createdById: String(createdByIdIndex >= 0 ? row[createdByIdIndex] || '' : '').trim(),
        createdByUserId: String(createdByUserIdIndex >= 0 ? row[createdByUserIdIndex] || '' : '').trim(),
        createdByUsername: String(createdByUsernameIndex >= 0 ? row[createdByUsernameIndex] || '' : '').trim(),
        quoteDisplayName: String(quoteDisplayNameIndex >= 0 ? row[quoteDisplayNameIndex] || '' : '').trim(),
        updatedBy: String(updatedByIndex >= 0 ? row[updatedByIndex] || '' : '').trim(),
        updatedById: String(updatedByIdIndex >= 0 ? row[updatedByIdIndex] || '' : '').trim(),
        updatedByUsername: String(updatedByUsernameIndex >= 0 ? row[updatedByUsernameIndex] || '' : '').trim(),
        createdAt: String(createdAtIndex >= 0 ? row[createdAtIndex] || '' : '').trim(),
        updatedAt: String(updatedAtIndex >= 0 ? row[updatedAtIndex] || '' : '').trim()
      };
    });
    setServerCache(historyCacheKey, matches, 120);
    endPerformanceTimer(timer, 'cache=miss count=' + matches.length);
    return success(matches);
  } catch (error) {
    endPerformanceTimer(timer, 'error=true');
    logError('getQuotationHistory', error);
    return fail(error && error.message ? error.message : 'Failed to load quotation history');
  }
}

function canAccessQuotationRecord(user, quote) {
  if (!user) {
    return success(true);
  }
  if (hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.VIEWER])) {
    return success(true);
  }
  if (hasRole(user, [USER_ROLES.SALES])) {
    const userId = normalizeString(user.userId);
    const username = normalizeString(user.username);
    const createdById = normalizeString(quote && (quote.createdByUserId || quote.createdById || quote.updatedById));
    const createdByUsername = normalizeString(quote && (quote.createdByUsername || quote.updatedByUsername));
    const createdBy = normalizeString(quote && (quote.createdBy || quote.updatedBy));
    if ((userId && createdById === userId) || (username && (createdByUsername === username || createdBy === username))) {
      return success(true);
    }
  }
  return forbidden('Cannot access this quotation');
}

function getQuotationRow(quoteId) {
  try {
    const idCheck = requireValue(quoteId, 'quoteId');
    if (!idCheck.ok) {
      return idCheck;
    }
    ensureQuotationSheets();
    const sheet = getSheet(QUOTE_HISTORY_SHEET);
    if (!sheet || sheet.getLastRow() < 2) {
      return notFound('Quotation not found');
    }
    const headers = getQuotationSheetHeaders(sheet);
    const quoteIdIndex = headers.indexOf('quoteId');
    const quoteNoIndex = headers.indexOf('quoteNo');
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), headers.length)).getDisplayValues();
    const match = findQuotationRecordInValues(values, headers, quoteIdIndex, quoteId)
      || findQuotationRecordInValues(values, headers, quoteNoIndex, quoteId);
    if (!match) {
      return notFound('Quotation not found');
    }
    return success(match);
  } catch (error) {
    logError('getQuotationRow', error);
    return fail(error && error.message ? error.message : 'Failed to load quotation');
  }
}

function findQuotationRecordInValues(values, headers, columnIndex, value) {
  if (columnIndex < 0) {
    return null;
  }
  const normalizedValue = normalizeString(value);
  const rows = Array.isArray(values) ? values : [];
  for (var i = 0; i < rows.length; i++) {
    if (normalizeString(rows[i][columnIndex]) === normalizedValue) {
      const record = {};
      headers.forEach(function (header, index) {
        if (header) {
          record[header] = rows[i][index] || '';
        }
      });
      return record;
    }
  }
  return null;
}

function quotationRowToObject(headers, rowValues) {
  const record = {};
  headers.forEach(function (header, index) {
    if (header) {
      record[header] = rowValues[index] || '';
    }
  });
  return record;
}

function findQuotationRecordInSheet(sheet, headers, columnIndex, value) {
  if (columnIndex < 0) {
    return null;
  }
  const finder = sheet.getRange(2, columnIndex + 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(value))
    .matchEntireCell(true);
  const range = finder.findNext();
  if (!range) {
    return null;
  }
  const rowValues = sheet.getRange(range.getRow(), 1, 1, headers.length).getDisplayValues()[0] || [];
  const record = {};
  headers.forEach(function (header, index) {
    if (header) {
      record[header] = rowValues[index] || '';
    }
  });
  return record;
}

function getQuoteLines(quoteId) {
  try {
    const idCheck = requireValue(quoteId, 'quoteId');
    if (!idCheck.ok) {
      return idCheck;
    }
    const sheet = getSheet(QUOTE_LINES_SHEET);
    if (!sheet || sheet.getLastRow() < 2) {
      return success([]);
    }
    const headers = getQuotationSheetHeaders(sheet);
    const quoteIdIndex = headers.indexOf('quoteId');
    if (quoteIdIndex < 0) {
      return fail('quoteId column not found');
    }
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), headers.length)).getDisplayValues();
    const normalizedQuoteId = normalizeString(quoteId);
    const matches = values.filter(function (row) {
      return normalizeString(row[quoteIdIndex]) === normalizedQuoteId;
    }).map(function (rowValues) {
      return quotationRowToObject(headers, rowValues);
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
    const productResult = getProduct(productId);
    var product = {};
    if (productResult.ok) {
      product = productResult.data || {};
    }
    const listPrice = roundCurrency(parseNumericValue(product.listPrice || product.price || line.listPrice || 0));
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
    const historySheet = ensureSheet(QUOTE_HISTORY_SHEET, getQuoteHistoryHeaders());
    const linesSheet = ensureSheet(QUOTE_LINES_SHEET, getQuoteLineHeaders());
    if (historySheet) {
      ensureQuotationSheetColumns(historySheet, getQuoteHistoryHeaders());
    }
    if (linesSheet) {
      ensureQuotationSheetColumns(linesSheet, getQuoteLineHeaders());
    }
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
