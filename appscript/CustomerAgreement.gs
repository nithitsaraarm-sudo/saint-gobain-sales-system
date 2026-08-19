/**
 * Customer Agreement & Store Benefit Tracking.
 * V1 is manual-input only: no automatic sales-data sync.
 */
const AGREEMENT_STATUSES = Object.freeze({ DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', CLOSED: 'CLOSED', ARCHIVED: 'ARCHIVED' });
const AGREEMENT_ENTRY_TYPES = Object.freeze({
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  HALF_YEAR: 'HALF_YEAR',
  ANNUAL: 'ANNUAL',
  MARKETING_FEE: 'MARKETING_FEE',
  TOP_UP: 'TOP_UP',
  OTHER: 'OTHER'
});
const AGREEMENT_BUSINESS_UNITS = Object.freeze({ WEBER: 'WEBER', GYPROC: 'GYPROC', MULTI: 'MULTI', ALL: 'ALL' });
const AGREEMENT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const AGREEMENT_ATTACHMENT_FOLDER_PROPERTY = 'AGREEMENT_ATTACHMENT_FOLDER_ID';
const AGREEMENT_ATTACHMENT_ROOT_FOLDER_NAME = 'Saint-Gobain Sales System - Customer Agreements';
const AGREEMENT_ALLOWED_ATTACHMENT_MIME = Object.freeze({
  pdf: 'application/pdf',
  png: 'image/png',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
});

function agreementSheetName_(kind) {
  if (kind === 'agreement') return typeof CUSTOMER_AGREEMENTS_SHEET !== 'undefined' ? CUSTOMER_AGREEMENTS_SHEET : 'CustomerAgreements';
  if (kind === 'entry') return typeof AGREEMENT_ENTRIES_SHEET !== 'undefined' ? AGREEMENT_ENTRIES_SHEET : 'AgreementEntries';
  if (kind === 'attachment') return typeof AGREEMENT_ATTACHMENTS_SHEET !== 'undefined' ? AGREEMENT_ATTACHMENTS_SHEET : 'AgreementAttachments';
  return '';
}

function agreementResult_(ok, data, message, code, eventId) {
  return {
    ok: Boolean(ok),
    success: Boolean(ok),
    data: data === undefined ? null : data,
    message: String(message || ''),
    code: String(code || (ok ? 'SUCCESS' : 'ERROR')),
    eventId: String(eventId || '')
  };
}

function agreementError_(code, message, eventId, detail) {
  const result = agreementResult_(false, null, message, code, eventId);
  if (detail !== undefined) result.detail = detail;
  return result;
}

function agreementEventId_(prefix) {
  try {
    return String(prefix || 'AGREEMENT') + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
  } catch (error) {
    return String(prefix || 'AGREEMENT') + '-' + new Date().getTime();
  }
}

function agreementNow_() {
  return new Date().toISOString();
}

function agreementSafeText_(value, maxLength) {
  const text = String(value === null || value === undefined ? '' : value).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  const safe = /^[=+\-@]/.test(text) ? "'" + text : text;
  const limit = maxLength || 250;
  return safe.length > limit ? safe.slice(0, limit) : safe;
}

function agreementActorId_(user) {
  return String(user && (user.userId || user.username) || '').trim();
}

function agreementActorName_(user) {
  return agreementSafeText_(user && (user.quoteDisplayName || user.fullName || user.displayName || user.username) || '', 150);
}

function agreementBool_(value, defaultValue) {
  if (value === true || value === false) return value;
  const text = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
  if (!text) return defaultValue === undefined ? false : Boolean(defaultValue);
  if (text === 'true' || text === 'yes' || text === '1' || text === 'y' || text === 'active') return true;
  if (text === 'false' || text === 'no' || text === '0' || text === 'n' || text === 'inactive') return false;
  return defaultValue === undefined ? false : Boolean(defaultValue);
}

function agreementRoundCurrency_(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function agreementParseNumber_(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const text = String(value === null || value === undefined ? '' : value).trim();
  if (!text) return 0;
  const normalized = text.replace(/\s+/g, '');
  const valid = /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(normalized);
  if (!valid) return NaN;
  const number = Number(normalized.replace(/,/g, ''));
  return Number.isFinite(number) ? number : NaN;
}

function agreementValidateMoney_(value, field, eventId) {
  const amount = agreementParseNumber_(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return agreementError_('VALIDATION_ERROR', String(field || 'amount') + ' must be a non-negative amount', eventId);
  }
  return agreementResult_(true, agreementRoundCurrency_(amount));
}

function agreementValidateRate_(value, field, eventId) {
  const rate = agreementParseNumber_(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return agreementError_('VALIDATION_ERROR', String(field || 'benefitRate') + ' must be between 0 and 100', eventId);
  }
  return agreementResult_(true, agreementRoundCurrency_(rate));
}

function agreementCalculateEntryValues_(entry) {
  const source = entry && typeof entry === 'object' ? entry : {};
  const targetAmount = agreementRoundCurrency_(agreementParseNumber_(source.targetAmount));
  const actualAmount = agreementRoundCurrency_(agreementParseNumber_(source.actualAmount));
  const eligibleAmount = agreementRoundCurrency_(agreementParseNumber_(source.eligibleAmount));
  const benefitRate = agreementRoundCurrency_(agreementParseNumber_(source.benefitRate));
  const hasValidAchievement = targetAmount > 0;
  const achievementPercent = hasValidAchievement ? agreementRoundCurrency_(actualAmount / targetAmount * 100) : '';
  const passed = hasValidAchievement && actualAmount >= targetAmount;
  const benefitAmount = passed ? agreementRoundCurrency_(eligibleAmount * benefitRate / 100) : 0;
  return {
    targetAmount: targetAmount,
    actualAmount: actualAmount,
    eligibleAmount: eligibleAmount,
    benefitRate: benefitRate,
    achievementPercent: achievementPercent,
    passed: passed,
    benefitAmount: benefitAmount
  };
}

function agreementNormalizeBusinessUnit_(value, customer) {
  const text = String(value || '').trim().toUpperCase();
  if (AGREEMENT_BUSINESS_UNITS[text]) return text;
  const item = customer && typeof customer === 'object' ? customer : {};
  const sellsWeber = agreementBool_(item.sellsWeber, false);
  const sellsGyproc = agreementBool_(item.sellsGyproc, false);
  if (sellsWeber && sellsGyproc) return AGREEMENT_BUSINESS_UNITS.MULTI;
  if (sellsWeber) return AGREEMENT_BUSINESS_UNITS.WEBER;
  if (sellsGyproc) return AGREEMENT_BUSINESS_UNITS.GYPROC;
  return AGREEMENT_BUSINESS_UNITS.ALL;
}

function agreementNormalizeStatus_(value, fallback) {
  const text = String(value || fallback || AGREEMENT_STATUSES.DRAFT).trim().toUpperCase();
  return AGREEMENT_STATUSES[text] ? text : '';
}

function agreementNormalizeEntryType_(value) {
  const text = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return AGREEMENT_ENTRY_TYPES[text] ? text : '';
}

function agreementValidateYear_(value, field, eventId, required) {
  const text = String(value === null || value === undefined ? '' : value).trim();
  if (!text && !required) return agreementResult_(true, '');
  const year = Number(text || 0);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return agreementError_('VALIDATION_ERROR', String(field || 'periodYear') + ' is invalid', eventId);
  }
  return agreementResult_(true, year);
}

function agreementValidatePeriod_(entryType, payload, eventId) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const type = agreementNormalizeEntryType_(entryType);
  if (!type) return agreementError_('VALIDATION_ERROR', 'entryType is invalid', eventId);
  const requiresYear = ['MONTHLY', 'QUARTERLY', 'HALF_YEAR', 'ANNUAL'].indexOf(type) >= 0;
  const yearResult = agreementValidateYear_(data.periodYear, 'periodYear', eventId, requiresYear);
  if (!yearResult.ok) return yearResult;
  const period = { periodYear: yearResult.data || '', periodMonth: '', periodQuarter: '', periodHalf: '' };
  if (type === AGREEMENT_ENTRY_TYPES.MONTHLY) {
    const month = Number(data.periodMonth);
    if (!Number.isInteger(month) || month < 1 || month > 12) return agreementError_('VALIDATION_ERROR', 'periodMonth must be 1-12', eventId);
    period.periodMonth = month;
  } else if (type === AGREEMENT_ENTRY_TYPES.QUARTERLY) {
    const quarter = Number(data.periodQuarter);
    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) return agreementError_('VALIDATION_ERROR', 'periodQuarter must be 1-4', eventId);
    period.periodQuarter = quarter;
  } else if (type === AGREEMENT_ENTRY_TYPES.HALF_YEAR) {
    const half = Number(data.periodHalf);
    if (!Number.isInteger(half) || half < 1 || half > 2) return agreementError_('VALIDATION_ERROR', 'periodHalf must be 1-2', eventId);
    period.periodHalf = half;
  } else if (['MARKETING_FEE', 'TOP_UP', 'OTHER'].indexOf(type) >= 0) {
    if (String(data.periodMonth || '').trim()) {
      const optionalMonth = Number(data.periodMonth);
      if (!Number.isInteger(optionalMonth) || optionalMonth < 1 || optionalMonth > 12) return agreementError_('VALIDATION_ERROR', 'periodMonth must be 1-12', eventId);
      period.periodMonth = optionalMonth;
    }
    if (String(data.periodQuarter || '').trim()) {
      const optionalQuarter = Number(data.periodQuarter);
      if (!Number.isInteger(optionalQuarter) || optionalQuarter < 1 || optionalQuarter > 4) return agreementError_('VALIDATION_ERROR', 'periodQuarter must be 1-4', eventId);
      period.periodQuarter = optionalQuarter;
    }
    if (String(data.periodHalf || '').trim()) {
      const optionalHalf = Number(data.periodHalf);
      if (!Number.isInteger(optionalHalf) || optionalHalf < 1 || optionalHalf > 2) return agreementError_('VALIDATION_ERROR', 'periodHalf must be 1-2', eventId);
      period.periodHalf = optionalHalf;
    }
  }
  return agreementResult_(true, period);
}

function agreementCanView_(user) {
  return !hasRole(user, [USER_ROLES.PC || 'PC']);
}

function agreementCanManage_(user) {
  return hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.SALES]);
}

function agreementRequireAuth_(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  return data.currentUser ? success(data.currentUser) : requireApiUser(data);
}

function agreementEnsureSheet_(sheetName) {
  const required = getHeadersForSheet(sheetName);
  if (!required.length) return agreementError_('AGREEMENT_SCHEMA_MISMATCH', 'Agreement sheet headers are not configured');
  const sheet = ensureSheet(sheetName, required);
  if (!sheet) return agreementError_('ERROR', 'Unable to access agreement sheet');
  const existing = getHeaders(sheet);
  const seen = {};
  for (var i = 0; i < existing.length; i++) {
    const header = String(existing[i] || '').trim();
    if (!header) continue;
    if (seen[header]) return agreementError_('AGREEMENT_SCHEMA_MISMATCH', 'Duplicate header in ' + sheetName + ': ' + header);
    seen[header] = true;
  }
  const nextHeaders = existing.length ? existing.slice() : required.slice();
  var changed = false;
  required.forEach(function (header) {
    if (nextHeaders.indexOf(header) < 0) {
      nextHeaders.push(header);
      changed = true;
    }
  });
  if (changed || !existing.length) {
    sheet.getRange(1, 1, 1, nextHeaders.length).setValues([nextHeaders]);
  }
  return agreementResult_(true, { sheet: sheet, headers: nextHeaders });
}

function ensureAgreementSheets_() {
  const sheets = [agreementSheetName_('agreement'), agreementSheetName_('entry'), agreementSheetName_('attachment')];
  for (var i = 0; i < sheets.length; i++) {
    const checked = agreementEnsureSheet_(sheets[i]);
    if (!checked.ok) return checked;
  }
  return agreementResult_(true, true);
}

function agreementSheetRecords_(sheetName) {
  const sheetResult = agreementEnsureSheet_(sheetName);
  if (!sheetResult.ok) return sheetResult;
  const sheet = sheetResult.data.sheet;
  const headers = getHeaders(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return agreementResult_(true, []);
  const values = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), headers.length)).getDisplayValues();
  const records = values.map(function (row, index) {
    const record = {};
    headers.forEach(function (header, column) {
      if (header) record[header] = row[column] || '';
    });
    record._rowNumber = index + 2;
    return record;
  }).filter(function (record) {
    return Object.keys(record).some(function (key) {
      return key.charAt(0) !== '_' && String(record[key] || '').trim() !== '';
    });
  });
  return agreementResult_(true, records);
}

function agreementWriteRow_(sheet, headers, rowNumber, rowObject) {
  const values = headers.map(function (header) {
    return rowObject[header] !== undefined ? rowObject[header] : '';
  });
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([values]);
  return agreementResult_(true, true);
}

function agreementAppendRow_(sheetName, rowObject) {
  const sheetResult = agreementEnsureSheet_(sheetName);
  if (!sheetResult.ok) return sheetResult;
  const sheet = sheetResult.data.sheet;
  const headers = getHeaders(sheet);
  const targetRow = Math.max(sheet.getLastRow() + 1, 2);
  return agreementWriteRow_(sheet, headers, targetRow, rowObject);
}

function agreementUpdateRow_(sheetName, idColumn, idValue, updateObject) {
  const sheetResult = agreementEnsureSheet_(sheetName);
  if (!sheetResult.ok) return sheetResult;
  const sheet = sheetResult.data.sheet;
  const headers = getHeaders(sheet);
  const rows = agreementSheetRecords_(sheetName);
  if (!rows.ok) return rows;
  const existing = rows.data.find(function (row) {
    return String(row[idColumn] || '').trim() === String(idValue || '').trim();
  });
  if (!existing) return agreementError_('NOT_FOUND', 'Agreement record not found');
  return agreementWriteRow_(sheet, headers, existing._rowNumber, Object.assign({}, existing, updateObject));
}

function agreementNormalizeAgreementRow_(row) {
  const item = row && typeof row === 'object' ? row : {};
  return {
    agreementId: String(item.agreementId || '').trim(),
    customerId: String(item.customerId || '').trim(),
    customerCodeSnapshot: String(item.customerCodeSnapshot || '').trim(),
    customerNameSnapshot: String(item.customerNameSnapshot || '').trim(),
    salesAreaSnapshot: String(item.salesAreaSnapshot || '').trim(),
    businessUnit: agreementNormalizeBusinessUnit_(item.businessUnit),
    agreementName: String(item.agreementName || '').trim(),
    agreementYear: Number(item.agreementYear || 0) || '',
    startDate: String(item.startDate || '').trim(),
    endDate: String(item.endDate || '').trim(),
    status: agreementNormalizeStatus_(item.status, AGREEMENT_STATUSES.DRAFT),
    note: String(item.note || '').trim(),
    active: agreementBool_(item.active, true),
    createdByUserId: String(item.createdByUserId || '').trim(),
    createdByNameSnapshot: String(item.createdByNameSnapshot || '').trim(),
    createdAt: String(item.createdAt || '').trim(),
    updatedByUserId: String(item.updatedByUserId || '').trim(),
    updatedByNameSnapshot: String(item.updatedByNameSnapshot || '').trim(),
    updatedAt: String(item.updatedAt || '').trim(),
    version: Math.max(1, Number(item.version || 1)),
    _rowNumber: item._rowNumber
  };
}

function agreementNormalizeEntryRow_(row) {
  const item = row && typeof row === 'object' ? row : {};
  const calculated = agreementCalculateEntryValues_(item);
  return {
    entryId: String(item.entryId || '').trim(),
    agreementId: String(item.agreementId || '').trim(),
    entryType: agreementNormalizeEntryType_(item.entryType),
    entryLabel: String(item.entryLabel || '').trim(),
    periodYear: item.periodYear === '' ? '' : Number(item.periodYear || 0),
    periodMonth: item.periodMonth === '' ? '' : Number(item.periodMonth || 0),
    periodQuarter: item.periodQuarter === '' ? '' : Number(item.periodQuarter || 0),
    periodHalf: item.periodHalf === '' ? '' : Number(item.periodHalf || 0),
    targetAmount: calculated.targetAmount,
    actualAmount: calculated.actualAmount,
    eligibleAmount: calculated.eligibleAmount,
    benefitRate: calculated.benefitRate,
    achievementPercent: calculated.achievementPercent,
    passed: calculated.passed,
    benefitAmount: calculated.benefitAmount,
    note: String(item.note || '').trim(),
    sortOrder: Number(item.sortOrder || 0),
    active: agreementBool_(item.active, true),
    createdByUserId: String(item.createdByUserId || '').trim(),
    createdByNameSnapshot: String(item.createdByNameSnapshot || '').trim(),
    createdAt: String(item.createdAt || '').trim(),
    updatedByUserId: String(item.updatedByUserId || '').trim(),
    updatedByNameSnapshot: String(item.updatedByNameSnapshot || '').trim(),
    updatedAt: String(item.updatedAt || '').trim(),
    deletedByUserId: String(item.deletedByUserId || '').trim(),
    deletedAt: String(item.deletedAt || '').trim(),
    version: Math.max(1, Number(item.version || 1)),
    _rowNumber: item._rowNumber
  };
}

function agreementNormalizeAttachmentRow_(row) {
  const item = row && typeof row === 'object' ? row : {};
  return {
    attachmentId: String(item.attachmentId || '').trim(),
    agreementId: String(item.agreementId || '').trim(),
    fileName: String(item.fileName || '').trim(),
    fileExtension: String(item.fileExtension || '').trim().toLowerCase(),
    mimeType: String(item.mimeType || '').trim(),
    fileSize: Number(item.fileSize || 0),
    driveFileId: String(item.driveFileId || '').trim(),
    driveUrl: String(item.driveUrl || '').trim(),
    active: agreementBool_(item.active, true),
    uploadedByUserId: String(item.uploadedByUserId || '').trim(),
    uploadedByNameSnapshot: String(item.uploadedByNameSnapshot || '').trim(),
    uploadedAt: String(item.uploadedAt || '').trim(),
    deletedByUserId: String(item.deletedByUserId || '').trim(),
    deletedAt: String(item.deletedAt || '').trim(),
    version: Math.max(1, Number(item.version || 1)),
    _rowNumber: item._rowNumber
  };
}

function agreementSanitizeAttachmentForClient_(attachment) {
  const item = agreementNormalizeAttachmentRow_(attachment);
  delete item.driveFileId;
  delete item._rowNumber;
  return item;
}

function agreementSanitizeRecordForClient_(record) {
  const item = Object.assign({}, record);
  delete item._rowNumber;
  return item;
}

function agreementFindById_(agreementId) {
  const rows = agreementSheetRecords_(agreementSheetName_('agreement'));
  if (!rows.ok) return rows;
  const id = String(agreementId || '').trim();
  const found = rows.data.map(agreementNormalizeAgreementRow_).find(function (row) {
    return row.agreementId === id;
  });
  return found ? agreementResult_(true, found) : agreementError_('NOT_FOUND', 'Agreement not found');
}

function agreementFindEntryById_(entryId) {
  const rows = agreementSheetRecords_(agreementSheetName_('entry'));
  if (!rows.ok) return rows;
  const id = String(entryId || '').trim();
  const found = rows.data.map(agreementNormalizeEntryRow_).find(function (row) {
    return row.entryId === id;
  });
  return found ? agreementResult_(true, found) : agreementError_('NOT_FOUND', 'Agreement entry not found');
}

function agreementFindAttachmentById_(attachmentId) {
  const rows = agreementSheetRecords_(agreementSheetName_('attachment'));
  if (!rows.ok) return rows;
  const id = String(attachmentId || '').trim();
  const found = rows.data.map(agreementNormalizeAttachmentRow_).find(function (row) {
    return row.attachmentId === id;
  });
  return found ? agreementResult_(true, found) : agreementError_('NOT_FOUND', 'Agreement attachment not found');
}

function agreementActiveEntries_(agreementId) {
  const rows = agreementSheetRecords_(agreementSheetName_('entry'));
  if (!rows.ok) return rows;
  const id = String(agreementId || '').trim();
  return agreementResult_(true, rows.data.map(agreementNormalizeEntryRow_).filter(function (entry) {
    return entry.agreementId === id && entry.active;
  }).sort(function (a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
      || String(a.periodYear || '').localeCompare(String(b.periodYear || ''))
      || String(a.periodMonth || a.periodQuarter || a.periodHalf || '').localeCompare(String(b.periodMonth || b.periodQuarter || b.periodHalf || ''));
  }));
}

function agreementActiveAttachments_(agreementId) {
  const rows = agreementSheetRecords_(agreementSheetName_('attachment'));
  if (!rows.ok) return rows;
  const id = String(agreementId || '').trim();
  return agreementResult_(true, rows.data.map(agreementNormalizeAttachmentRow_).filter(function (attachment) {
    return attachment.agreementId === id && attachment.active;
  }).map(agreementSanitizeAttachmentForClient_));
}

function agreementBuildSummary_(entries) {
  const rows = (Array.isArray(entries) ? entries : []).map(agreementNormalizeEntryRow_).filter(function (entry) {
    return entry.active;
  });
  const totalTarget = agreementRoundCurrency_(rows.reduce(function (sum, entry) { return sum + Number(entry.targetAmount || 0); }, 0));
  const totalActual = agreementRoundCurrency_(rows.reduce(function (sum, entry) { return sum + Number(entry.actualAmount || 0); }, 0));
  const totalEligible = agreementRoundCurrency_(rows.reduce(function (sum, entry) { return sum + Number(entry.eligibleAmount || 0); }, 0));
  const totalBenefit = agreementRoundCurrency_(rows.reduce(function (sum, entry) { return sum + Number(entry.benefitAmount || 0); }, 0));
  const achievementPercent = totalTarget > 0 ? agreementRoundCurrency_(totalActual / totalTarget * 100) : '';
  return {
    entryCount: rows.length,
    passedCount: rows.filter(function (entry) { return entry.passed; }).length,
    failedCount: rows.filter(function (entry) { return !entry.passed; }).length,
    totalTarget: totalTarget,
    totalActual: totalActual,
    totalEligible: totalEligible,
    totalBenefit: totalBenefit,
    achievementPercent: achievementPercent
  };
}

function agreementCheckVersion_(record, payload, eventId) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const submitted = data.expectedVersion !== undefined ? data.expectedVersion : data.version;
  if (submitted === undefined || submitted === '') {
    return agreementError_('CONFLICT', 'expectedVersion is required', eventId, { currentVersion: Number(record && record.version || 1) });
  }
  if (Number(submitted) !== Number(record && record.version || 1)) {
    return agreementError_('CONFLICT', 'Agreement was updated by another user. Reload and try again.', eventId, { currentVersion: Number(record && record.version || 1) });
  }
  return agreementResult_(true, true);
}

function agreementEditableCheck_(agreement, eventId) {
  const status = String(agreement && agreement.status || '').trim().toUpperCase();
  if (status === AGREEMENT_STATUSES.CLOSED || status === AGREEMENT_STATUSES.ARCHIVED || !agreementBool_(agreement && agreement.active, true)) {
    return agreementError_('AGREEMENT_CLOSED', 'Closed or archived agreements are read-only', eventId);
  }
  return agreementResult_(true, true);
}

function agreementAuthorizeCustomer_(payload, user, write, eventId) {
  if (!agreementCanView_(user)) return agreementError_('FORBIDDEN', 'Agreement access denied', eventId);
  if (write && !agreementCanManage_(user)) return agreementError_('FORBIDDEN', 'Agreement write access denied', eventId);
  const customerId = String(payload && (payload.customerId || payload.value) || '').trim();
  if (!customerId) return agreementError_('VALIDATION_ERROR', 'customerId is required', eventId);
  const customerResult = getCustomer(customerId, { currentUser: user });
  if (!customerResult.ok) return customerResult;
  return agreementResult_(true, customerResult.data);
}

function agreementAuthorizeAgreement_(payload, user, write, eventId) {
  if (!agreementCanView_(user)) return agreementError_('FORBIDDEN', 'Agreement access denied', eventId);
  if (write && !agreementCanManage_(user)) return agreementError_('FORBIDDEN', 'Agreement write access denied', eventId);
  const agreementId = String(payload && payload.agreementId || '').trim();
  if (!agreementId) return agreementError_('VALIDATION_ERROR', 'agreementId is required', eventId);
  const agreementResult = agreementFindById_(agreementId);
  if (!agreementResult.ok) return agreementResult;
  const customerResult = getCustomer(agreementResult.data.customerId, { currentUser: user });
  if (!customerResult.ok) return customerResult;
  return agreementResult_(true, { agreement: agreementResult.data, customer: customerResult.data });
}

function agreementValidateDateText_(value, field, eventId, required) {
  const text = String(value || '').trim();
  if (!text && !required) return agreementResult_(true, '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return agreementError_('VALIDATION_ERROR', String(field || 'date') + ' must use YYYY-MM-DD', eventId);
  const date = new Date(text + 'T00:00:00Z');
  if (isNaN(date.getTime())) return agreementError_('VALIDATION_ERROR', String(field || 'date') + ' is invalid', eventId);
  return agreementResult_(true, text);
}

function agreementValidatePayload_(payload, customer, existing, eventId) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const agreementName = agreementSafeText_(data.agreementName !== undefined ? data.agreementName : existing && existing.agreementName, 180);
  if (!agreementName) return agreementError_('VALIDATION_ERROR', 'agreementName is required', eventId);
  const yearResult = agreementValidateYear_(data.agreementYear !== undefined ? data.agreementYear : existing && existing.agreementYear, 'agreementYear', eventId, true);
  if (!yearResult.ok) return yearResult;
  const startDate = agreementValidateDateText_(data.startDate !== undefined ? data.startDate : existing && existing.startDate, 'startDate', eventId, false);
  if (!startDate.ok) return startDate;
  const endDate = agreementValidateDateText_(data.endDate !== undefined ? data.endDate : existing && existing.endDate, 'endDate', eventId, false);
  if (!endDate.ok) return endDate;
  if (startDate.data && endDate.data && startDate.data > endDate.data) return agreementError_('VALIDATION_ERROR', 'endDate must be after startDate', eventId);
  const status = agreementNormalizeStatus_(data.status !== undefined ? data.status : existing && existing.status, existing ? existing.status : AGREEMENT_STATUSES.DRAFT);
  if (!status || [AGREEMENT_STATUSES.CLOSED, AGREEMENT_STATUSES.ARCHIVED].indexOf(status) >= 0) return agreementError_('VALIDATION_ERROR', 'status is invalid for save', eventId);
  const customerId = String(customer && customer.customerId || customer && customer.customerCode || data.customerId || '').trim();
  return agreementResult_(true, {
    customerId: customerId,
    customerCodeSnapshot: agreementSafeText_(customer && (customer.customerCode || customer.customerId) || customerId, 80),
    customerNameSnapshot: agreementSafeText_(customer && customer.customerName || '', 180),
    salesAreaSnapshot: agreementSafeText_(customer && customer.salesArea || '', 80),
    businessUnit: agreementNormalizeBusinessUnit_(data.businessUnit !== undefined ? data.businessUnit : existing && existing.businessUnit, customer),
    agreementName: agreementName,
    agreementYear: yearResult.data,
    startDate: startDate.data,
    endDate: endDate.data,
    status: status,
    note: agreementSafeText_(data.note !== undefined ? data.note : existing && existing.note, 800),
    active: 'TRUE'
  });
}

function agreementValidateEntryPayload_(payload, existing, eventId) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const merged = Object.assign({}, existing || {}, data);
  const entryType = agreementNormalizeEntryType_(merged.entryType);
  if (!entryType) return agreementError_('VALIDATION_ERROR', 'entryType is required', eventId);
  const period = agreementValidatePeriod_(entryType, merged, eventId);
  if (!period.ok) return period;
  const target = agreementValidateMoney_(merged.targetAmount, 'targetAmount', eventId);
  if (!target.ok) return target;
  const actual = agreementValidateMoney_(merged.actualAmount, 'actualAmount', eventId);
  if (!actual.ok) return actual;
  const eligible = agreementValidateMoney_(merged.eligibleAmount, 'eligibleAmount', eventId);
  if (!eligible.ok) return eligible;
  const rate = agreementValidateRate_(merged.benefitRate, 'benefitRate', eventId);
  if (!rate.ok) return rate;
  const calculated = agreementCalculateEntryValues_(Object.assign({}, merged, {
    targetAmount: target.data,
    actualAmount: actual.data,
    eligibleAmount: eligible.data,
    benefitRate: rate.data
  }));
  const sortOrder = Number(merged.sortOrder || existing && existing.sortOrder || 0);
  return agreementResult_(true, Object.assign({}, period.data, calculated, {
    entryType: entryType,
    entryLabel: agreementSafeText_(merged.entryLabel || '', 160),
    note: agreementSafeText_(merged.note || '', 800),
    sortOrder: Number.isFinite(sortOrder) ? Math.max(0, sortOrder) : 0,
    active: 'TRUE'
  }));
}

function getCustomerAgreements(payload) {
  const eventId = agreementEventId_('AGREEMENT-LIST');
  try {
    const data = payload && typeof payload === 'object' ? payload : {};
    const auth = agreementRequireAuth_(data);
    if (!auth.ok) return auth;
    const customerCheck = agreementAuthorizeCustomer_(data, auth.data, false, eventId);
    if (!customerCheck.ok) return customerCheck;
    const sheetCheck = ensureAgreementSheets_();
    if (!sheetCheck.ok) return sheetCheck;
    const rows = agreementSheetRecords_(agreementSheetName_('agreement'));
    if (!rows.ok) return rows;
    const entryRows = agreementSheetRecords_(agreementSheetName_('entry'));
    if (!entryRows.ok) return entryRows;
    const includeArchived = agreementBool_(data.includeArchived, false);
    const customerId = String(customerCheck.data.customerId || data.customerId || '').trim();
    const entries = entryRows.data.map(agreementNormalizeEntryRow_);
    const agreements = rows.data.map(agreementNormalizeAgreementRow_).filter(function (agreement) {
      return agreement.customerId === customerId && (includeArchived || (agreement.active && agreement.status !== AGREEMENT_STATUSES.ARCHIVED));
    }).map(function (agreement) {
      const activeEntries = entries.filter(function (entry) { return entry.agreementId === agreement.agreementId && entry.active; });
      return Object.assign(agreementSanitizeRecordForClient_(agreement), { summary: agreementBuildSummary_(activeEntries) });
    }).sort(function (a, b) {
      return Number(b.agreementYear || 0) - Number(a.agreementYear || 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
    return agreementResult_(true, { customer: customerCheck.data, agreements: agreements, summary: agreementBuildSummary_(entries.filter(function (entry) {
      return agreements.some(function (agreement) { return agreement.agreementId === entry.agreementId; });
    })) }, 'Agreements loaded', 'SUCCESS', eventId);
  } catch (error) {
    logError('getCustomerAgreements', error);
    return agreementError_('ERROR', error && error.message ? error.message : 'Failed to load agreements', eventId);
  }
}

function getAgreementDetail(payload) {
  const eventId = agreementEventId_('AGREEMENT-GET');
  try {
    const data = payload && typeof payload === 'object' ? payload : {};
    const auth = agreementRequireAuth_(data);
    if (!auth.ok) return auth;
    const authorized = agreementAuthorizeAgreement_(data, auth.data, false, eventId);
    if (!authorized.ok) return authorized;
    const entries = agreementActiveEntries_(authorized.data.agreement.agreementId);
    if (!entries.ok) return entries;
    const attachments = agreementActiveAttachments_(authorized.data.agreement.agreementId);
    if (!attachments.ok) return attachments;
    return agreementResult_(true, {
      customer: authorized.data.customer,
      agreement: agreementSanitizeRecordForClient_(authorized.data.agreement),
      entries: entries.data.map(agreementSanitizeRecordForClient_),
      attachments: attachments.data,
      summary: agreementBuildSummary_(entries.data)
    }, 'Agreement loaded', 'SUCCESS', eventId);
  } catch (error) {
    logError('getAgreementDetail', error);
    return agreementError_('ERROR', error && error.message ? error.message : 'Failed to load agreement', eventId);
  }
}

function agreementSaveOrUpdate_(payload, isUpdate) {
  const eventId = agreementEventId_(isUpdate ? 'AGREEMENT-UPDATE' : 'AGREEMENT-CREATE');
  var lock = null;
  try {
    const data = payload && typeof payload === 'object' ? payload : {};
    const auth = agreementRequireAuth_(data);
    if (!auth.ok) return auth;
    const authorized = isUpdate
      ? agreementAuthorizeAgreement_(data, auth.data, true, eventId)
      : agreementAuthorizeCustomer_(data, auth.data, true, eventId);
    if (!authorized.ok) return authorized;
    const existing = isUpdate ? authorized.data.agreement : null;
    if (existing) {
      const editable = agreementEditableCheck_(existing, eventId);
      if (!editable.ok) return editable;
      const version = agreementCheckVersion_(existing, data, eventId);
      if (!version.ok) return version;
    }
    const customer = isUpdate ? authorized.data.customer : authorized.data;
    const validated = agreementValidatePayload_(data, customer, existing, eventId);
    if (!validated.ok) return validated;
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return agreementError_('CONFLICT', 'Agreement is being updated by another user', eventId);
    var lockedExisting = existing;
    var lockedCustomer = customer;
    var lockedValidated = validated;
    if (isUpdate) {
      const lockedAuthorized = agreementAuthorizeAgreement_(data, auth.data, true, eventId);
      if (!lockedAuthorized.ok) return lockedAuthorized;
      lockedExisting = lockedAuthorized.data.agreement;
      lockedCustomer = lockedAuthorized.data.customer;
      const lockedEditable = agreementEditableCheck_(lockedExisting, eventId);
      if (!lockedEditable.ok) return lockedEditable;
      const lockedVersion = agreementCheckVersion_(lockedExisting, data, eventId);
      if (!lockedVersion.ok) return lockedVersion;
      lockedValidated = agreementValidatePayload_(data, lockedCustomer, lockedExisting, eventId);
      if (!lockedValidated.ok) return lockedValidated;
    } else {
      const lockedCustomerResult = agreementAuthorizeCustomer_(data, auth.data, true, eventId);
      if (!lockedCustomerResult.ok) return lockedCustomerResult;
      lockedCustomer = lockedCustomerResult.data;
      lockedValidated = agreementValidatePayload_(data, lockedCustomer, null, eventId);
      if (!lockedValidated.ok) return lockedValidated;
    }
    const now = agreementNow_();
    const actorId = agreementActorId_(auth.data);
    const actorName = agreementActorName_(auth.data);
    const row = Object.assign({}, lockedExisting || {}, lockedValidated.data, {
      agreementId: lockedExisting ? lockedExisting.agreementId : 'AGR-' + Utilities.getUuid(),
      createdByUserId: lockedExisting ? lockedExisting.createdByUserId : actorId,
      createdByNameSnapshot: lockedExisting ? lockedExisting.createdByNameSnapshot : actorName,
      createdAt: lockedExisting ? lockedExisting.createdAt : now,
      updatedByUserId: actorId,
      updatedByNameSnapshot: actorName,
      updatedAt: now,
      version: lockedExisting ? Number(lockedExisting.version || 1) + 1 : 1
    });
    const result = lockedExisting
      ? agreementUpdateRow_(agreementSheetName_('agreement'), 'agreementId', lockedExisting.agreementId, row)
      : agreementAppendRow_(agreementSheetName_('agreement'), row);
    if (!result.ok) return result;
    clearSheetDataCache(agreementSheetName_('agreement'));
    logActivity(actorId, lockedExisting ? 'CUSTOMER_AGREEMENT_UPDATED' : 'CUSTOMER_AGREEMENT_CREATED', 'eventId=' + eventId + ';agreementId=' + row.agreementId + ';customerId=' + row.customerId);
    return agreementResult_(true, agreementSanitizeRecordForClient_(agreementNormalizeAgreementRow_(row)), lockedExisting ? 'Agreement updated' : 'Agreement created', 'SUCCESS', eventId);
  } catch (error) {
    logError('agreementSaveOrUpdate_', error);
    return agreementError_('ERROR', error && error.message ? error.message : 'Failed to save agreement', eventId);
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (ignore) {}
    }
  }
}

function createCustomerAgreement(payload) {
  return agreementSaveOrUpdate_(payload, false);
}

function updateCustomerAgreement(payload) {
  return agreementSaveOrUpdate_(payload, true);
}

function closeCustomerAgreement(payload) {
  return agreementSetAgreementStatus_(payload, AGREEMENT_STATUSES.CLOSED, true, 'CUSTOMER_AGREEMENT_CLOSED');
}

function archiveCustomerAgreement(payload) {
  return agreementSetAgreementStatus_(payload, AGREEMENT_STATUSES.ARCHIVED, false, 'CUSTOMER_AGREEMENT_ARCHIVED');
}

function agreementSetAgreementStatus_(payload, status, active, activity) {
  const eventId = agreementEventId_(status === AGREEMENT_STATUSES.CLOSED ? 'AGREEMENT-CLOSE' : 'AGREEMENT-ARCHIVE');
  var lock = null;
  try {
    const data = payload && typeof payload === 'object' ? payload : {};
    const auth = agreementRequireAuth_(data);
    if (!auth.ok) return auth;
    const authorized = agreementAuthorizeAgreement_(data, auth.data, true, eventId);
    if (!authorized.ok) return authorized;
    const version = agreementCheckVersion_(authorized.data.agreement, data, eventId);
    if (!version.ok) return version;
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return agreementError_('CONFLICT', 'Agreement is being updated by another user', eventId);
    const lockedAuthorized = agreementAuthorizeAgreement_(data, auth.data, true, eventId);
    if (!lockedAuthorized.ok) return lockedAuthorized;
    const editable = agreementEditableCheck_(lockedAuthorized.data.agreement, eventId);
    if (!editable.ok) return editable;
    const lockedVersion = agreementCheckVersion_(lockedAuthorized.data.agreement, data, eventId);
    if (!lockedVersion.ok) return lockedVersion;
    const update = {
      status: status,
      active: active ? 'TRUE' : 'FALSE',
      updatedByUserId: agreementActorId_(auth.data),
      updatedByNameSnapshot: agreementActorName_(auth.data),
      updatedAt: agreementNow_(),
      version: Number(lockedAuthorized.data.agreement.version || 1) + 1
    };
    const result = agreementUpdateRow_(agreementSheetName_('agreement'), 'agreementId', lockedAuthorized.data.agreement.agreementId, Object.assign({}, lockedAuthorized.data.agreement, update));
    if (!result.ok) return result;
    clearSheetDataCache(agreementSheetName_('agreement'));
    logActivity(agreementActorId_(auth.data), activity, 'eventId=' + eventId + ';agreementId=' + lockedAuthorized.data.agreement.agreementId);
    return agreementResult_(true, agreementSanitizeRecordForClient_(agreementNormalizeAgreementRow_(Object.assign({}, lockedAuthorized.data.agreement, update))), 'Agreement status updated', 'SUCCESS', eventId);
  } catch (error) {
    logError('agreementSetAgreementStatus_', error);
    return agreementError_('ERROR', error && error.message ? error.message : 'Failed to update agreement status', eventId);
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (ignore) {}
    }
  }
}

function getAgreementEntries(payload) {
  const detail = getAgreementDetail(payload);
  if (!detail.ok) return detail;
  return agreementResult_(true, detail.data.entries, 'Agreement entries loaded', 'SUCCESS', detail.eventId);
}

function createAgreementEntry(payload) {
  return agreementSaveOrUpdateEntry_(payload, false);
}

function updateAgreementEntry(payload) {
  return agreementSaveOrUpdateEntry_(payload, true);
}

function agreementSaveOrUpdateEntry_(payload, isUpdate) {
  const eventId = agreementEventId_(isUpdate ? 'AGREEMENT-ENTRY-UPDATE' : 'AGREEMENT-ENTRY-CREATE');
  var lock = null;
  try {
    const data = payload && typeof payload === 'object' ? payload : {};
    const auth = agreementRequireAuth_(data);
    if (!auth.ok) return auth;
    var existingEntry = null;
    var agreementId = String(data.agreementId || '').trim();
    if (isUpdate) {
      const entryResult = agreementFindEntryById_(data.entryId);
      if (!entryResult.ok) return entryResult;
      existingEntry = entryResult.data;
      agreementId = existingEntry.agreementId;
    }
    const authorized = agreementAuthorizeAgreement_(Object.assign({}, data, { agreementId: agreementId }), auth.data, true, eventId);
    if (!authorized.ok) return authorized;
    const editable = agreementEditableCheck_(authorized.data.agreement, eventId);
    if (!editable.ok) return editable;
    if (existingEntry) {
      const version = agreementCheckVersion_(existingEntry, data, eventId);
      if (!version.ok) return version;
    }
    const validated = agreementValidateEntryPayload_(Object.assign({}, data, { agreementId: agreementId }), existingEntry, eventId);
    if (!validated.ok) return validated;
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return agreementError_('CONFLICT', 'Agreement entry is being updated by another user', eventId);
    var lockedEntry = existingEntry;
    var lockedAgreementId = agreementId;
    var lockedValidated = validated;
    if (isUpdate) {
      const lockedEntryResult = agreementFindEntryById_(data.entryId);
      if (!lockedEntryResult.ok) return lockedEntryResult;
      lockedEntry = lockedEntryResult.data;
      lockedAgreementId = lockedEntry.agreementId;
      const lockedAuthorized = agreementAuthorizeAgreement_(Object.assign({}, data, { agreementId: lockedAgreementId }), auth.data, true, eventId);
      if (!lockedAuthorized.ok) return lockedAuthorized;
      const lockedEditable = agreementEditableCheck_(lockedAuthorized.data.agreement, eventId);
      if (!lockedEditable.ok) return lockedEditable;
      const lockedVersion = agreementCheckVersion_(lockedEntry, data, eventId);
      if (!lockedVersion.ok) return lockedVersion;
      lockedValidated = agreementValidateEntryPayload_(Object.assign({}, data, { agreementId: lockedAgreementId }), lockedEntry, eventId);
      if (!lockedValidated.ok) return lockedValidated;
    } else {
      const lockedAuthorized = agreementAuthorizeAgreement_(Object.assign({}, data, { agreementId: lockedAgreementId }), auth.data, true, eventId);
      if (!lockedAuthorized.ok) return lockedAuthorized;
      const lockedEditable = agreementEditableCheck_(lockedAuthorized.data.agreement, eventId);
      if (!lockedEditable.ok) return lockedEditable;
      lockedValidated = agreementValidateEntryPayload_(Object.assign({}, data, { agreementId: lockedAgreementId }), null, eventId);
      if (!lockedValidated.ok) return lockedValidated;
    }
    const now = agreementNow_();
    const actorId = agreementActorId_(auth.data);
    const actorName = agreementActorName_(auth.data);
    const row = Object.assign({}, lockedEntry || {}, lockedValidated.data, {
      entryId: lockedEntry ? lockedEntry.entryId : 'AGRE-' + Utilities.getUuid(),
      agreementId: lockedAgreementId,
      createdByUserId: lockedEntry ? lockedEntry.createdByUserId : actorId,
      createdByNameSnapshot: lockedEntry ? lockedEntry.createdByNameSnapshot : actorName,
      createdAt: lockedEntry ? lockedEntry.createdAt : now,
      updatedByUserId: actorId,
      updatedByNameSnapshot: actorName,
      updatedAt: now,
      deletedByUserId: '',
      deletedAt: '',
      version: lockedEntry ? Number(lockedEntry.version || 1) + 1 : 1
    });
    const result = lockedEntry
      ? agreementUpdateRow_(agreementSheetName_('entry'), 'entryId', lockedEntry.entryId, row)
      : agreementAppendRow_(agreementSheetName_('entry'), row);
    if (!result.ok) return result;
    clearSheetDataCache(agreementSheetName_('entry'));
    logActivity(actorId, lockedEntry ? 'AGREEMENT_ENTRY_UPDATED' : 'AGREEMENT_ENTRY_CREATED', 'eventId=' + eventId + ';agreementId=' + lockedAgreementId + ';entryId=' + row.entryId);
    return agreementResult_(true, agreementSanitizeRecordForClient_(agreementNormalizeEntryRow_(row)), lockedEntry ? 'Agreement entry updated' : 'Agreement entry created', 'SUCCESS', eventId);
  } catch (error) {
    logError('agreementSaveOrUpdateEntry_', error);
    return agreementError_('ERROR', error && error.message ? error.message : 'Failed to save agreement entry', eventId);
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (ignore) {}
    }
  }
}

function deactivateAgreementEntry(payload) {
  const eventId = agreementEventId_('AGREEMENT-ENTRY-DEACTIVATE');
  var lock = null;
  try {
    const data = payload && typeof payload === 'object' ? payload : {};
    const auth = agreementRequireAuth_(data);
    if (!auth.ok) return auth;
    const entryResult = agreementFindEntryById_(data.entryId);
    if (!entryResult.ok) return entryResult;
    const authorized = agreementAuthorizeAgreement_({ agreementId: entryResult.data.agreementId }, auth.data, true, eventId);
    if (!authorized.ok) return authorized;
    const editable = agreementEditableCheck_(authorized.data.agreement, eventId);
    if (!editable.ok) return editable;
    const version = agreementCheckVersion_(entryResult.data, data, eventId);
    if (!version.ok) return version;
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return agreementError_('CONFLICT', 'Agreement entry is being updated by another user', eventId);
    const lockedEntryResult = agreementFindEntryById_(data.entryId);
    if (!lockedEntryResult.ok) return lockedEntryResult;
    const lockedAuthorized = agreementAuthorizeAgreement_({ agreementId: lockedEntryResult.data.agreementId }, auth.data, true, eventId);
    if (!lockedAuthorized.ok) return lockedAuthorized;
    const lockedEditable = agreementEditableCheck_(lockedAuthorized.data.agreement, eventId);
    if (!lockedEditable.ok) return lockedEditable;
    const lockedVersion = agreementCheckVersion_(lockedEntryResult.data, data, eventId);
    if (!lockedVersion.ok) return lockedVersion;
    const now = agreementNow_();
    const update = {
      active: 'FALSE',
      deletedByUserId: agreementActorId_(auth.data),
      deletedAt: now,
      updatedByUserId: agreementActorId_(auth.data),
      updatedByNameSnapshot: agreementActorName_(auth.data),
      updatedAt: now,
      version: Number(lockedEntryResult.data.version || 1) + 1
    };
    const result = agreementUpdateRow_(agreementSheetName_('entry'), 'entryId', lockedEntryResult.data.entryId, Object.assign({}, lockedEntryResult.data, update));
    if (!result.ok) return result;
    clearSheetDataCache(agreementSheetName_('entry'));
    return agreementResult_(true, { entryId: lockedEntryResult.data.entryId, agreementId: lockedEntryResult.data.agreementId, active: false, version: update.version }, 'Agreement entry deactivated', 'SUCCESS', eventId);
  } catch (error) {
    logError('deactivateAgreementEntry', error);
    return agreementError_('ERROR', error && error.message ? error.message : 'Failed to deactivate agreement entry', eventId);
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (ignore) {}
    }
  }
}

function agreementAttachmentExtension_(fileName, explicitExtension) {
  const explicit = String(explicitExtension || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (explicit) return explicit;
  const match = String(fileName || '').trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

function agreementAttachmentBase64_(fileData, mimeType) {
  const text = String(fileData || '').trim();
  const dataUrl = text.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrl) {
    return { mimeType: dataUrl[1], base64: dataUrl[2] };
  }
  return { mimeType: mimeType, base64: text };
}

function agreementValidateAttachmentPayload_(payload, eventId) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const fileName = agreementSafeText_(data.fileName || '', 180);
  if (!fileName) return agreementError_('VALIDATION_ERROR', 'fileName is required', eventId);
  const extracted = agreementAttachmentBase64_(data.fileData || data.base64Data || data.dataUrl || '', data.mimeType);
  const extension = agreementAttachmentExtension_(fileName, data.fileExtension);
  const expectedMime = AGREEMENT_ALLOWED_ATTACHMENT_MIME[extension];
  const mimeType = String(extracted.mimeType || data.mimeType || '').trim();
  if (!expectedMime || mimeType !== expectedMime) return agreementError_('VALIDATION_ERROR', 'Attachment must be PDF, PNG, or XLSX', eventId);
  const declaredSize = Number(data.fileSize || 0);
  const approxSize = extracted.base64 ? Math.floor(extracted.base64.replace(/\s+/g, '').length * 3 / 4) : declaredSize;
  const fileSize = declaredSize || approxSize;
  if (!fileSize || fileSize > AGREEMENT_ATTACHMENT_MAX_BYTES) return agreementError_('VALIDATION_ERROR', 'Attachment size must be 10 MB or less', eventId);
  if (!extracted.base64) return agreementError_('VALIDATION_ERROR', 'fileData is required', eventId);
  return agreementResult_(true, {
    fileName: fileName,
    fileExtension: extension,
    mimeType: mimeType,
    fileSize: fileSize,
    base64: extracted.base64.replace(/\s+/g, '')
  });
}

function agreementGetAttachmentRootFolder_() {
  const folderId = typeof getScriptProperty === 'function'
    ? getScriptProperty(AGREEMENT_ATTACHMENT_FOLDER_PROPERTY, '')
    : String(PropertiesService.getScriptProperties().getProperty(AGREEMENT_ATTACHMENT_FOLDER_PROPERTY) || '').trim();
  if (folderId) return DriveApp.getFolderById(folderId);
  const folder = DriveApp.createFolder(AGREEMENT_ATTACHMENT_ROOT_FOLDER_NAME);
  try {
    PropertiesService.getScriptProperties().setProperty(AGREEMENT_ATTACHMENT_FOLDER_PROPERTY, folder.getId());
  } catch (error) {
    logWarning('agreementGetAttachmentRootFolder_', 'Unable to persist attachment folder id');
  }
  return folder;
}

function agreementSaveAttachmentFile_(attachment, agreement) {
  const bytes = Utilities.base64Decode(attachment.base64);
  const folder = agreementGetAttachmentRootFolder_();
  const safeName = String(agreement.agreementId || 'agreement') + '-' + new Date().getTime() + '-' + attachment.fileName;
  const blob = Utilities.newBlob(bytes, attachment.mimeType, safeName);
  const file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (sharingError) {
    logWarning('agreementSaveAttachmentFile_', 'Unable to set sharing: ' + sharingError);
  }
  return {
    driveFileId: file.getId(),
    driveUrl: 'https://drive.google.com/uc?export=view&id=' + file.getId()
  };
}

function uploadAgreementAttachment(payload) {
  const eventId = agreementEventId_('AGREEMENT-ATTACHMENT-UPLOAD');
  var lock = null;
  try {
    const data = payload && typeof payload === 'object' ? payload : {};
    const auth = agreementRequireAuth_(data);
    if (!auth.ok) return auth;
    const authorized = agreementAuthorizeAgreement_(data, auth.data, true, eventId);
    if (!authorized.ok) return authorized;
    const editable = agreementEditableCheck_(authorized.data.agreement, eventId);
    if (!editable.ok) return editable;
    const validated = agreementValidateAttachmentPayload_(data, eventId);
    if (!validated.ok) return validated;
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return agreementError_('CONFLICT', 'Agreement attachment is being uploaded by another user', eventId);
    const lockedAuthorized = agreementAuthorizeAgreement_(data, auth.data, true, eventId);
    if (!lockedAuthorized.ok) return lockedAuthorized;
    const lockedEditable = agreementEditableCheck_(lockedAuthorized.data.agreement, eventId);
    if (!lockedEditable.ok) return lockedEditable;
    const stored = agreementSaveAttachmentFile_(validated.data, lockedAuthorized.data.agreement);
    const now = agreementNow_();
    const row = {
      attachmentId: 'AGRA-' + Utilities.getUuid(),
      agreementId: lockedAuthorized.data.agreement.agreementId,
      fileName: validated.data.fileName,
      fileExtension: validated.data.fileExtension,
      mimeType: validated.data.mimeType,
      fileSize: validated.data.fileSize,
      driveFileId: stored.driveFileId,
      driveUrl: stored.driveUrl,
      active: 'TRUE',
      uploadedByUserId: agreementActorId_(auth.data),
      uploadedByNameSnapshot: agreementActorName_(auth.data),
      uploadedAt: now,
      deletedByUserId: '',
      deletedAt: '',
      version: 1
    };
    const result = agreementAppendRow_(agreementSheetName_('attachment'), row);
    if (!result.ok) return result;
    clearSheetDataCache(agreementSheetName_('attachment'));
    return agreementResult_(true, agreementSanitizeAttachmentForClient_(row), 'Agreement attachment uploaded', 'SUCCESS', eventId);
  } catch (error) {
    logError('uploadAgreementAttachment', error);
    return agreementError_('ERROR', error && error.message ? error.message : 'Failed to upload agreement attachment', eventId);
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (ignore) {}
    }
  }
}

function deleteAgreementAttachment(payload) {
  const eventId = agreementEventId_('AGREEMENT-ATTACHMENT-DELETE');
  var lock = null;
  try {
    const data = payload && typeof payload === 'object' ? payload : {};
    const auth = agreementRequireAuth_(data);
    if (!auth.ok) return auth;
    const attachment = agreementFindAttachmentById_(data.attachmentId);
    if (!attachment.ok) return attachment;
    const authorized = agreementAuthorizeAgreement_({ agreementId: attachment.data.agreementId }, auth.data, true, eventId);
    if (!authorized.ok) return authorized;
    const editable = agreementEditableCheck_(authorized.data.agreement, eventId);
    if (!editable.ok) return editable;
    const version = agreementCheckVersion_(attachment.data, data, eventId);
    if (!version.ok) return version;
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return agreementError_('CONFLICT', 'Agreement attachment is being updated by another user', eventId);
    const lockedAttachment = agreementFindAttachmentById_(data.attachmentId);
    if (!lockedAttachment.ok) return lockedAttachment;
    const lockedAuthorized = agreementAuthorizeAgreement_({ agreementId: lockedAttachment.data.agreementId }, auth.data, true, eventId);
    if (!lockedAuthorized.ok) return lockedAuthorized;
    const lockedEditable = agreementEditableCheck_(lockedAuthorized.data.agreement, eventId);
    if (!lockedEditable.ok) return lockedEditable;
    const lockedVersion = agreementCheckVersion_(lockedAttachment.data, data, eventId);
    if (!lockedVersion.ok) return lockedVersion;
    const update = {
      active: 'FALSE',
      deletedByUserId: agreementActorId_(auth.data),
      deletedAt: agreementNow_(),
      version: Number(lockedAttachment.data.version || 1) + 1
    };
    const result = agreementUpdateRow_(agreementSheetName_('attachment'), 'attachmentId', lockedAttachment.data.attachmentId, Object.assign({}, lockedAttachment.data, update));
    if (!result.ok) return result;
    clearSheetDataCache(agreementSheetName_('attachment'));
    return agreementResult_(true, { attachmentId: lockedAttachment.data.attachmentId, agreementId: lockedAttachment.data.agreementId, active: false, version: update.version }, 'Agreement attachment deleted', 'SUCCESS', eventId);
  } catch (error) {
    logError('deleteAgreementAttachment', error);
    return agreementError_('ERROR', error && error.message ? error.message : 'Failed to delete agreement attachment', eventId);
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (ignore) {}
    }
  }
}
