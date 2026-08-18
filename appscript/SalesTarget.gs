/**
 * Sales Target Management — dedicated Google Sheet entity and backend SSOT.
 * This file intentionally does not store targets in Users or Settings.
 */
const SALES_TARGETS_SHEET = 'SalesTargets';
const SALES_TARGET_TYPES = Object.freeze({ ANNUAL: 'ANNUAL', MONTHLY: 'MONTHLY' });
const SALES_TARGET_CONFIGURABLE_BUSINESS_UNITS = Object.freeze({ GYPROC: 'GYPROC', WEBER: 'WEBER' });
const SALES_TARGET_FILTER_BUSINESS_UNITS = Object.freeze({ ALL: 'ALL', GYPROC: 'GYPROC', WEBER: 'WEBER' });
const SALES_TARGET_STATUSES = Object.freeze({ DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', ARCHIVED: 'ARCHIVED' });
const SALES_TARGET_HEADERS = ['targetId','targetType','periodYear','periodMonth','periodStart','periodEnd','businessUnit','salesArea','salesUserId','salesUserNameSnapshot','targetAmount','currency','status','active','createdByUserId','createdByNameSnapshot','createdAt','updatedByUserId','updatedByNameSnapshot','updatedAt','version'];
const SALES_TARGET_CACHE_VERSION_PROPERTY = 'SALES_TARGET_CACHE_VERSION';

function salesTargetResult_(ok, data, message, code, eventId) {
  return { ok: Boolean(ok), success: Boolean(ok), data: data === undefined ? null : data, message: String(message || ''), code: String(code || (ok ? 'SUCCESS' : 'ERROR')), eventId: String(eventId || '') };
}
function salesTargetError_(code, message, eventId, detail) {
  const result = salesTargetResult_(false, null, message, code, eventId);
  if (detail !== undefined) result.detail = detail;
  return result;
}
function salesTargetEventId_(prefix) {
  return String(prefix || 'TARGET') + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
}
function salesTargetLog_(eventId, action, user, detail) {
  try {
    const actorId = String(user && (user.userId || user.username) || '');
    logActivity(actorId, action, 'eventId=' + eventId + ';' + String(detail || ''));
  } catch (error) {
    console.log('[SALES_TARGET][' + eventId + '] ' + action + ' ' + String(detail || ''));
  }
}
function getSalesTargetCacheVersion_() {
  try {
    return PropertiesService.getScriptProperties().getProperty(SALES_TARGET_CACHE_VERSION_PROPERTY) || '1';
  } catch (error) {
    return '1';
  }
}
function bumpSalesTargetCacheVersion_() {
  try {
    const value = String(new Date().getTime());
    PropertiesService.getScriptProperties().setProperty(SALES_TARGET_CACHE_VERSION_PROPERTY, value);
    return value;
  } catch (error) {
    logError('bumpSalesTargetCacheVersion_', error);
    return '';
  }
}
function salesTargetNormalizeRole_(user) { return String(user && user.role || '').trim().toUpperCase(); }
function salesTargetUserArea_(user) { return String(user && (user.area || user.branch || user.salesArea) || '').trim().toUpperCase(); }
function salesTargetDisplayName_(user) { return String(user && (user.fullName || user.displayName || user.quoteDisplayName || user.username) || '').trim(); }
function salesTargetCanManage_(user) { return ['SUPER_ADMIN','ADMIN'].indexOf(salesTargetNormalizeRole_(user)) >= 0; }
function salesTargetCanView_(user) { return salesTargetNormalizeRole_(user) !== 'PC'; }
function salesTargetIsSuperAdmin_(user) { return salesTargetNormalizeRole_(user) === 'SUPER_ADMIN'; }
function salesTargetIsSystemArea_(area) { return String(area || '').trim().toUpperCase() === 'SYSTEM'; }
function salesTargetNormalizeBusinessUnit_(value, fallback) {
  const text = String(value === null || value === undefined || value === '' ? (fallback || '') : value).trim().toUpperCase();
  return text;
}
function salesTargetConfigurableBusinessUnitValues_() {
  return [SALES_TARGET_CONFIGURABLE_BUSINESS_UNITS.GYPROC, SALES_TARGET_CONFIGURABLE_BUSINESS_UNITS.WEBER];
}
function salesTargetFilterBusinessUnitValues_() {
  return [SALES_TARGET_FILTER_BUSINESS_UNITS.ALL, SALES_TARGET_FILTER_BUSINESS_UNITS.GYPROC, SALES_TARGET_FILTER_BUSINESS_UNITS.WEBER];
}
function salesTargetIsConfigurableBusinessUnit_(value) {
  return Boolean(SALES_TARGET_CONFIGURABLE_BUSINESS_UNITS[salesTargetNormalizeBusinessUnit_(value)]);
}
function salesTargetIsFilterBusinessUnit_(value) {
  return Boolean(SALES_TARGET_FILTER_BUSINESS_UNITS[salesTargetNormalizeBusinessUnit_(value)]);
}
function salesTargetInvalidBusinessUnitError_(message, eventId) {
  return salesTargetError_('INVALID_TARGET_BUSINESS_UNIT', message || 'Sales Target must use GYPROC or WEBER.', eventId);
}
function salesTargetEffectiveRequestArea_(user, request) {
  const data = request && typeof request === 'object' ? request : {};
  const requestedArea = String(data.salesArea || data.requestedArea || data.actorArea || '').trim().toUpperCase();
  const actorArea = salesTargetUserArea_(user);
  if (requestedArea) {
    if (salesTargetIsSuperAdmin_(user)) return requestedArea;
    return actorArea && requestedArea === actorArea ? requestedArea : actorArea;
  }
  return actorArea && !salesTargetIsSystemArea_(actorArea) ? actorArea : '';
}
function salesTargetEffectiveRequestUserId_(user, request) {
  const data = request && typeof request === 'object' ? request : {};
  const requestedUserId = String(data.salesUserId || data.requestedSalesUserId || '').trim();
  return salesTargetNormalizeRole_(user) === 'SALES' ? String(user && user.userId || '').trim() : requestedUserId;
}
function getDashboardEffectiveSalesTargetRequest_(user, date) {
  const current = date instanceof Date ? date : new Date();
  const request = {
    targetType: SALES_TARGET_TYPES.MONTHLY,
    periodYear: current.getFullYear(),
    periodMonth: current.getMonth() + 1,
    businessUnit: 'ALL'
  };
  const area = salesTargetEffectiveRequestArea_(user, request);
  if (area) request.salesArea = area;
  return request;
}
function salesTargetParseNumber_(value) {
  const number = Number(String(value === null || value === undefined ? '' : value).replace(/,/g, '').trim());
  return Number.isFinite(number) ? number : NaN;
}
function salesTargetSafeText_(value) {
  const text = String(value === null || value === undefined ? '' : value).trim();
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}
function salesTargetDateKey_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd');
}
function salesTargetPeriod_(type, year, month) {
  const normalizedType = String(type || '').toUpperCase();
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return null;
  if (normalizedType === SALES_TARGET_TYPES.MONTHLY) {
    if (!Number.isInteger(m) || m < 1 || m > 12) return null;
    const start = new Date(y, m - 1, 1, 12, 0, 0);
    const end = new Date(y, m, 0, 12, 0, 0);
    return { periodStart: salesTargetDateKey_(start), periodEnd: salesTargetDateKey_(end), periodMonth: m };
  }
  if (normalizedType === SALES_TARGET_TYPES.ANNUAL) {
    return { periodStart: y + '-01-01', periodEnd: y + '-12-31', periodMonth: '' };
  }
  return null;
}
function salesTargetEnsureSheet_() {
  return ensureSheet(SALES_TARGETS_SHEET, SALES_TARGET_HEADERS);
}
function salesTargetRows_() {
  salesTargetEnsureSheet_();
  const result = getSheetData(SALES_TARGETS_SHEET);
  return result && result.ok && Array.isArray(result.data) ? result.data : [];
}
function salesTargetNormalizeRow_(row) {
  const item = row || {};
  return {
    targetId: String(item.targetId || '').trim(), targetType: String(item.targetType || '').trim().toUpperCase(),
    periodYear: Number(item.periodYear || 0), periodMonth: item.periodMonth === '' ? '' : Number(item.periodMonth || 0),
    periodStart: String(item.periodStart || '').trim(), periodEnd: String(item.periodEnd || '').trim(),
    businessUnit: String(item.businessUnit || 'ALL').trim().toUpperCase(), salesArea: String(item.salesArea || '').trim().toUpperCase(),
    salesUserId: String(item.salesUserId || '').trim(), salesUserNameSnapshot: String(item.salesUserNameSnapshot || '').trim(),
    targetAmount: Number(item.targetAmount || 0), currency: String(item.currency || 'THB').trim().toUpperCase(),
    status: String(item.status || 'DRAFT').trim().toUpperCase(), active: String(item.active).toLowerCase() === 'true' || item.active === true,
    createdByUserId: String(item.createdByUserId || '').trim(), createdByNameSnapshot: String(item.createdByNameSnapshot || '').trim(), createdAt: String(item.createdAt || '').trim(),
    updatedByUserId: String(item.updatedByUserId || '').trim(), updatedByNameSnapshot: String(item.updatedByNameSnapshot || '').trim(), updatedAt: String(item.updatedAt || '').trim(),
    version: Math.max(1, Number(item.version || 1)), _rowNumber: item._rowNumber, _rowValues: item._rowValues
  };
}
function salesTargetScopeAllowed_(user, row, write) {
  const role = salesTargetNormalizeRole_(user);
  if (role === 'PC') return false;
  if (role === 'SUPER_ADMIN') return true;
  const actorArea = salesTargetUserArea_(user);
  const targetArea = String(row && row.salesArea || '').trim().toUpperCase();
  if (write && ['ADMIN'].indexOf(role) < 0) return false;
  if (role === 'SALES') {
    const targetUserId = String(row && row.salesUserId || '').trim();
    const actorUserId = String(user && user.userId || '').trim();
    return Boolean(targetUserId && targetUserId === actorUserId) || Boolean(!targetUserId && actorArea && targetArea && actorArea === targetArea);
  }
  return Boolean(actorArea && targetArea && actorArea === targetArea);
}
function salesTargetLoadAssignableSalesUsers_(payload, user) {
  try {
    const result = listUserAccounts();
    const rows = result && result.ok && Array.isArray(result.data) ? result.data : [];
    const actorArea = salesTargetUserArea_(user);
    return rows.filter(function (row) {
      return String(row && row.role || '').trim().toUpperCase() === 'SALES'
        && (salesTargetIsSuperAdmin_(user) || salesTargetUserArea_(row) === actorArea);
    });
  } catch (error) {
    logError('salesTargetLoadAssignableSalesUsers_', error);
    return [];
  }
}
function salesTargetResolveSalesUser_(payload, user, salesArea, salesUserId) {
  const targetUserId = String(salesUserId || '').trim();
  if (!targetUserId) {
    return salesTargetResult_(true, { salesUserId: '', salesUserNameSnapshot: '' });
  }
  const users = salesTargetLoadAssignableSalesUsers_(payload, user);
  const target = users.find(function (row) {
    return String(row && row.userId || '').trim() === targetUserId;
  });
  if (!target) {
    return salesTargetError_('TARGET_SCOPE_VIOLATION', 'Sales user is outside your permitted scope');
  }
  const targetArea = salesTargetUserArea_(target);
  if (targetArea !== String(salesArea || '').trim().toUpperCase()) {
    return salesTargetError_('AREA_SCOPE_VIOLATION', 'Sales user does not belong to the selected Area');
  }
  return salesTargetResult_(true, {
    salesUserId: String(target.userId || '').trim(),
    salesUserNameSnapshot: salesTargetSafeText_(salesTargetDisplayName_(target))
  });
}
function salesTargetValidatePayload_(payload, user, existing) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const targetType = String(data.targetType || existing && existing.targetType || '').trim().toUpperCase();
  const periodYear = Number(data.periodYear || existing && existing.periodYear || 0);
  const periodMonthRaw = data.periodMonth !== undefined ? data.periodMonth : existing && existing.periodMonth;
  const period = salesTargetPeriod_(targetType, periodYear, periodMonthRaw);
  if (!period) return salesTargetError_('VALIDATION_ERROR', 'Invalid target period');
  const existingBusinessUnit = salesTargetNormalizeBusinessUnit_(existing && existing.businessUnit);
  const businessUnit = salesTargetNormalizeBusinessUnit_(data.businessUnit !== undefined ? data.businessUnit : existingBusinessUnit);
  const status = String(data.status || existing && existing.status || 'DRAFT').trim().toUpperCase();
  if (!SALES_TARGET_STATUSES[status]) return salesTargetError_('VALIDATION_ERROR', 'Invalid target status');
  if (!salesTargetIsFilterBusinessUnit_(businessUnit)) return salesTargetInvalidBusinessUnitError_();
  if (existingBusinessUnit === SALES_TARGET_FILTER_BUSINESS_UNITS.ALL && businessUnit !== SALES_TARGET_FILTER_BUSINESS_UNITS.ALL) {
    return salesTargetInvalidBusinessUnitError_('Legacy ALL Sales Target business unit is read-only.');
  }
  if (businessUnit === SALES_TARGET_FILTER_BUSINESS_UNITS.ALL) {
    if (existingBusinessUnit !== SALES_TARGET_FILTER_BUSINESS_UNITS.ALL) return salesTargetInvalidBusinessUnitError_();
    if (status === SALES_TARGET_STATUSES.ACTIVE) return salesTargetInvalidBusinessUnitError_('Legacy ALL Sales Target cannot be active or reactivated.');
  } else if (!salesTargetIsConfigurableBusinessUnit_(businessUnit)) {
    return salesTargetInvalidBusinessUnitError_();
  }
  const scopeType = String(data.scopeType || (data.salesUserId || existing && existing.salesUserId ? 'USER' : 'AREA')).trim().toUpperCase();
  const salesArea = String(data.salesArea || existing && existing.salesArea || '').trim().toUpperCase();
  var salesUserId = scopeType === 'USER' ? String(data.salesUserId || existing && existing.salesUserId || '').trim() : '';
  var salesUserNameSnapshot = '';
  if (!salesArea) return salesTargetError_('VALIDATION_ERROR', 'Sales Area is required');
  if (scopeType === 'USER' && !salesUserId) return salesTargetError_('VALIDATION_ERROR', 'Sales user is required');
  if (scopeType === 'USER') {
    const salesUserCheck = salesTargetResolveSalesUser_(data, user, salesArea, salesUserId);
    if (!salesUserCheck.ok) return salesUserCheck;
    salesUserId = salesUserCheck.data.salesUserId;
    salesUserNameSnapshot = salesUserCheck.data.salesUserNameSnapshot;
  }
  const amount = salesTargetParseNumber_(data.targetAmount !== undefined ? data.targetAmount : existing && existing.targetAmount);
  if (!Number.isFinite(amount) || amount < 0 || (amount === 0 && status === 'ACTIVE')) return salesTargetError_('VALIDATION_ERROR', 'Target amount must be greater than zero for an active target');
  const normalized = { targetType: targetType, periodYear: periodYear, periodMonth: period.periodMonth, periodStart: period.periodStart, periodEnd: period.periodEnd,
    businessUnit: businessUnit, salesArea: salesArea, salesUserId: salesUserId, salesUserNameSnapshot: salesTargetSafeText_(data.salesUserNameSnapshot || existing && existing.salesUserNameSnapshot || ''),
    targetAmount: amount, currency: 'THB', status: status, active: status === 'ACTIVE' };
  normalized.salesUserNameSnapshot = scopeType === 'USER' ? salesUserNameSnapshot : '';
  if (!salesTargetScopeAllowed_(user, normalized, true)) return salesTargetError_('AREA_SCOPE_VIOLATION', 'Target is outside your permitted Area');
  return salesTargetResult_(true, normalized);
}
function salesTargetLogicalKey_(row) {
  return [row.targetType, row.periodYear, row.periodMonth || '', row.businessUnit, row.salesArea, row.salesUserId || ''].join('|');
}
function salesTargetHasConflict_(rows, candidate, excludeId) {
  if (!candidate.active) return null;
  const key = salesTargetLogicalKey_(candidate);
  return rows.find(function (row) { const item = salesTargetNormalizeRow_(row); return item.active && item.targetId !== excludeId && salesTargetLogicalKey_(item) === key; }) || null;
}
function getSalesTargets(payload) {
  const eventId = salesTargetEventId_('TARGET-LIST');
  try {
    const auth = requireApiUser(payload || {}); if (!auth.ok) return auth;
    if (!salesTargetCanView_(auth.data)) return salesTargetError_('FORBIDDEN', 'Sales target access denied', eventId);
    const data = payload || {};
    let rows = salesTargetRows_().map(salesTargetNormalizeRow_).filter(function (row) { return salesTargetScopeAllowed_(auth.data, row, false); });
    const filters = ['targetType','salesArea','salesUserId','status'];
    filters.forEach(function (key) { if (data[key] !== undefined && String(data[key]).trim() !== '') rows = rows.filter(function (row) { return String(row[key]).toUpperCase() === String(data[key]).trim().toUpperCase(); }); });
    const requestedBusinessUnit = salesTargetNormalizeBusinessUnit_(data.businessUnit);
    if (requestedBusinessUnit && !salesTargetIsFilterBusinessUnit_(requestedBusinessUnit)) return salesTargetInvalidBusinessUnitError_('Invalid Sales Target Business Unit filter.', eventId);
    if (requestedBusinessUnit && requestedBusinessUnit !== SALES_TARGET_FILTER_BUSINESS_UNITS.ALL) rows = rows.filter(function (row) { return row.businessUnit === requestedBusinessUnit; });
    if (data.periodYear) rows = rows.filter(function (row) { return row.periodYear === Number(data.periodYear); });
    if (data.periodMonth !== undefined && String(data.periodMonth) !== '') rows = rows.filter(function (row) { return Number(row.periodMonth) === Number(data.periodMonth); });
    rows.sort(function (a,b) { return String(b.periodStart).localeCompare(String(a.periodStart)) || String(b.updatedAt).localeCompare(String(a.updatedAt)); });
    return salesTargetResult_(true, rows, 'Sales targets loaded', 'SUCCESS', eventId);
  } catch (error) { logError('getSalesTargets', error); return salesTargetError_('ERROR', error.message || 'Unable to load sales targets', eventId); }
}
function getSalesTarget(payload) {
  const eventId = salesTargetEventId_('TARGET-GET');
  try { const auth=requireApiUser(payload||{}); if(!auth.ok)return auth; const id=String(payload&&payload.targetId||'').trim(); if(!id)return salesTargetError_('VALIDATION_ERROR','targetId is required',eventId);
    const row=salesTargetRows_().map(salesTargetNormalizeRow_).find(function(item){return item.targetId===id;}); if(!row)return salesTargetError_('NOT_FOUND','Sales target not found',eventId);
    if(!salesTargetScopeAllowed_(auth.data,row,false))return salesTargetError_('TARGET_SCOPE_VIOLATION','Target is outside your permitted scope',eventId); return salesTargetResult_(true,row,'Sales target loaded','SUCCESS',eventId);
  } catch(error){logError('getSalesTarget',error);return salesTargetError_('ERROR',error.message||'Unable to load sales target',eventId);} }
function saveSalesTarget(payload) { return salesTargetSaveOrUpdate_(payload, false); }
function updateSalesTarget(payload) { return salesTargetSaveOrUpdate_(payload, true); }
function salesTargetSaveOrUpdate_(payload, isUpdate) {
  const eventId = salesTargetEventId_(isUpdate ? 'TARGET-UPDATE' : 'TARGET-CREATE'); let lock=null;
  try { const auth=requireApiUser(payload||{}); if(!auth.ok)return auth; if(!salesTargetCanManage_(auth.data))return salesTargetError_('FORBIDDEN','You cannot manage sales targets',eventId);
    lock=LockService.getScriptLock(); if(!lock.tryLock(20000))return salesTargetError_('CONFLICT','Sales target is being updated by another user',eventId);
    const rows=salesTargetRows_(); const targetId=String(payload&&payload.targetId||'').trim(); let existing=null;
    if(isUpdate){ existing=rows.map(salesTargetNormalizeRow_).find(function(row){return row.targetId===targetId;}); if(!existing)return salesTargetError_('NOT_FOUND','Sales target not found',eventId);
      if(!salesTargetScopeAllowed_(auth.data,existing,true))return salesTargetError_('TARGET_SCOPE_VIOLATION','Target is outside your permitted scope',eventId);
      if(Number(payload.version)!==Number(existing.version))return salesTargetError_('CONFLICT','Target was updated by another user. Reload and try again.',eventId,{currentVersion:existing.version}); }
    const validated=salesTargetValidatePayload_(payload,auth.data,existing); if(!validated.ok){validated.eventId=eventId;return validated;} const candidate=validated.data;
    const conflict=salesTargetHasConflict_(rows,candidate,existing&&existing.targetId); if(conflict)return salesTargetError_('CONFLICT','An active target already exists for this period and scope',eventId);
    const sheet=salesTargetEnsureSheet_(); const now=new Date().toISOString(); const actorId=String(auth.data.userId||auth.data.username||''); const actorName=salesTargetSafeText_(salesTargetDisplayName_(auth.data));
    const row=Object.assign({},existing||{},candidate,{targetId:existing?existing.targetId:(Utilities.getUuid?Utilities.getUuid():'TARGET-'+Date.now()),createdByUserId:existing?existing.createdByUserId:actorId,createdByNameSnapshot:existing?existing.createdByNameSnapshot:actorName,createdAt:existing?existing.createdAt:now,updatedByUserId:actorId,updatedByNameSnapshot:actorName,updatedAt:now,version:existing?Number(existing.version)+1:1});
    const values=SALES_TARGET_HEADERS.map(function(header){return row[header]!==undefined?row[header]:'';});
    if(existing&&existing._rowNumber)sheet.getRange(existing._rowNumber,1,1,SALES_TARGET_HEADERS.length).setValues([values]); else sheet.getRange(sheet.getLastRow()+1,1,1,SALES_TARGET_HEADERS.length).setValues([values]);
    salesTargetInvalidateCaches_(); salesTargetLog_(eventId,isUpdate?'SALES_TARGET_UPDATED':'SALES_TARGET_CREATED',auth.data,'targetId='+row.targetId+';scope='+salesTargetLogicalKey_(row));
    return salesTargetResult_(true,salesTargetNormalizeRow_(row),isUpdate?'Sales target updated':'Sales target created','SUCCESS',eventId);
  } catch(error){logError('salesTargetSaveOrUpdate_',error);return salesTargetError_('ERROR',error.message||'Unable to save sales target',eventId);} finally{if(lock)try{lock.releaseLock();}catch(ignore){}} }
function setSalesTargetStatus(payload) {
  const current=getSalesTarget(payload); if(!current.ok)return current; const next=Object.assign({},current.data,{status:String(payload&&payload.status||'').toUpperCase(),version:current.data.version}); return updateSalesTarget(Object.assign({},payload,next));
}
function salesTargetPrecedence_(row, context, businessUnit) {
  const exactBu=row.businessUnit===businessUnit; const isUser=Boolean(row.salesUserId)&&row.salesUserId===String(context&&context.salesUserId||''); const isArea=!row.salesUserId&&row.salesArea===String(context&&context.salesArea||'');
  if(isUser&&exactBu)return 1; if(isArea&&exactBu)return 3; return 99;
}
function resolveEffectiveSalesTarget_(rows, user, request) {
  const data = request && typeof request === 'object' ? request : {};
  const type=String(data.targetType||'ANNUAL').toUpperCase(); const year=Number(data.periodYear||new Date().getFullYear()); const month=type==='MONTHLY'?Number(data.periodMonth||new Date().getMonth()+1):''; const bu=salesTargetNormalizeBusinessUnit_(data.businessUnit, SALES_TARGET_FILTER_BUSINESS_UNITS.ALL);
  const period=salesTargetPeriod_(type,year,month);
  if(!period || !salesTargetIsFilterBusinessUnit_(bu))return null;
  const candidates=rows.map(salesTargetNormalizeRow_).filter(function(row){return row.active&&row.status==='ACTIVE'&&row.targetType===type&&row.periodYear===year&&String(row.periodMonth||'')===String(month||'')&&salesTargetScopeAllowed_(user,row,false);});
  const context = {
    salesArea: salesTargetEffectiveRequestArea_(user, data),
    salesUserId: salesTargetEffectiveRequestUserId_(user, data)
  };
  if (!context.salesArea && salesTargetIsSuperAdmin_(user)) {
    const matchingAreas = Array.from(new Set(candidates.filter(function(row){
      return !row.salesUserId && row.salesArea && (row.businessUnit === bu || (bu === SALES_TARGET_FILTER_BUSINESS_UNITS.ALL && salesTargetIsConfigurableBusinessUnit_(row.businessUnit)));
    }).map(function(row){ return row.salesArea; })));
    if (matchingAreas.length === 1) context.salesArea = matchingAreas[0];
  }
  function pick(unit){return candidates.filter(function(row){return salesTargetPrecedence_(row,context,unit)<99;}).sort(function(a,b){return salesTargetPrecedence_(a,context,unit)-salesTargetPrecedence_(b,context,unit);})[0]||null;}
  let selected=[]; if(bu===SALES_TARGET_FILTER_BUSINESS_UNITS.ALL){const g=pick(SALES_TARGET_CONFIGURABLE_BUSINESS_UNITS.GYPROC),w=pick(SALES_TARGET_CONFIGURABLE_BUSINESS_UNITS.WEBER); if(g)selected.push(g); if(w&&(!g||w.targetId!==g.targetId))selected.push(w);} else {const one=pick(bu);if(one)selected=[one];}
  const legacyAllTargets = candidates.filter(function(row){return row.businessUnit===SALES_TARGET_FILTER_BUSINESS_UNITS.ALL && salesTargetPrecedence_(row,context,SALES_TARGET_FILTER_BUSINESS_UNITS.ALL)<99;});
  const total=selected.reduce(function(sum,row){return sum+Number(row.targetAmount||0);},0);
  return {targetAmount:selected.length?total:null,totalTarget:selected.length?total:null,gyprocTarget:selected.filter(function(r){return r.businessUnit==='GYPROC';}).reduce(function(s,r){return s+Number(r.targetAmount||0);},0),weberTarget:selected.filter(function(r){return r.businessUnit==='WEBER';}).reduce(function(s,r){return s+Number(r.targetAmount||0);},0),targetType:type,periodYear:year,periodMonth:month,periodStart:period.periodStart,periodEnd:period.periodEnd,businessUnit:bu,salesArea:context.salesArea,salesUserId:context.salesUserId,sourceScope:selected.length?(selected[0].salesUserId?'USER':'AREA'):'NONE',sourceTargetIds:selected.map(function(r){return r.targetId;}),targets:selected,legacyAllTargetIds:legacyAllTargets.map(function(r){return r.targetId;}),legacyAllActiveCount:legacyAllTargets.length,legacyAllRequiresManualReview:legacyAllTargets.length>0};
}
function getEffectiveSalesTarget(payload) {
  const eventId=salesTargetEventId_('TARGET-EFFECTIVE'); try{const auth=requireApiUser(payload||{});if(!auth.ok)return auth;if(!salesTargetCanView_(auth.data))return salesTargetError_('FORBIDDEN','Sales KPI access denied',eventId);const requestedBusinessUnit=salesTargetNormalizeBusinessUnit_(payload&&payload.businessUnit);if(requestedBusinessUnit&&!salesTargetIsFilterBusinessUnit_(requestedBusinessUnit))return salesTargetInvalidBusinessUnitError_('Invalid Sales Target Business Unit filter.',eventId);const target=resolveEffectiveSalesTarget_(salesTargetRows_(),auth.data,payload||{});if(!target)return salesTargetError_('VALIDATION_ERROR','Invalid target period',eventId);return salesTargetResult_(true,target,'Effective sales target loaded','SUCCESS',eventId);}catch(error){logError('getEffectiveSalesTarget',error);return salesTargetError_('ERROR',error.message||'Unable to resolve sales target',eventId);} }
function getSalesTargetFormOptions(payload) {
  const eventId=salesTargetEventId_('TARGET-OPTIONS'); try{const auth=requireApiUser(payload||{});if(!auth.ok)return auth;if(!salesTargetCanManage_(auth.data))return salesTargetError_('FORBIDDEN','Sales target management denied',eventId);
    return salesTargetResult_(true,salesTargetBuildFormOptions_(payload||{},auth.data),'Sales target options loaded','SUCCESS',eventId);
  }catch(error){logError('getSalesTargetFormOptions',error);return salesTargetError_('ERROR',error.message||'Unable to load target options',eventId);} }
function salesTargetBuildFormOptions_(payload, user) {
  var users = salesTargetLoadAssignableSalesUsers_(payload || {}, user);
  const area = salesTargetUserArea_(user);
  users = users.map(function(u){return{userId:String(u.userId||''),name:salesTargetDisplayName_(u),salesArea:salesTargetUserArea_(u),status:String(u.status||'')};});
  const areas = salesTargetIsSuperAdmin_(user) ? Array.from(new Set(users.map(function(u){return u.salesArea;}).filter(Boolean))).sort() : [area].filter(Boolean);
  return {areas:areas,salesUsers:users,businessUnits:salesTargetConfigurableBusinessUnitValues_(),configurableBusinessUnits:salesTargetConfigurableBusinessUnitValues_(),filterBusinessUnits:salesTargetFilterBusinessUnitValues_(),targetTypes:['ANNUAL','MONTHLY'],statuses:['DRAFT','ACTIVE','INACTIVE','ARCHIVED'],canManage:true,actorArea:area};
}
function salesTargetApplyFilters_(rows, filters) {
  const data = filters || {};
  var scopedRows = Array.isArray(rows) ? rows.slice() : [];
  ['targetType','salesArea','salesUserId','status'].forEach(function (key) {
    if (data[key] !== undefined && String(data[key]).trim() !== '') {
      scopedRows = scopedRows.filter(function (row) {
        return String(row[key]).toUpperCase() === String(data[key]).trim().toUpperCase();
      });
    }
  });
  const requestedBusinessUnit = salesTargetNormalizeBusinessUnit_(data.businessUnit);
  if (requestedBusinessUnit && requestedBusinessUnit !== SALES_TARGET_FILTER_BUSINESS_UNITS.ALL) {
    scopedRows = scopedRows.filter(function (row) { return String(row.businessUnit).toUpperCase() === requestedBusinessUnit; });
  }
  if (data.periodYear) scopedRows = scopedRows.filter(function (row) { return row.periodYear === Number(data.periodYear); });
  if (data.periodMonth !== undefined && String(data.periodMonth) !== '') scopedRows = scopedRows.filter(function (row) { return Number(row.periodMonth) === Number(data.periodMonth); });
  return scopedRows.sort(function (a,b) { return String(b.periodStart).localeCompare(String(a.periodStart)) || String(b.updatedAt).localeCompare(String(a.updatedAt)); });
}
function salesTargetBuildSummary_(rows) {
  const active = (Array.isArray(rows) ? rows : []).filter(function (row) { return row.active || row.status === 'ACTIVE'; });
  const configurableActive = active.filter(function (row) { return salesTargetIsConfigurableBusinessUnit_(row.businessUnit); });
  const legacyAllActive = active.filter(function (row) { return row.businessUnit === SALES_TARGET_FILTER_BUSINESS_UNITS.ALL; });
  return {
    totalActive: configurableActive.reduce(function (sum, row) { return sum + Number(row.targetAmount || 0); }, 0),
    gyproc: configurableActive.filter(function (row) { return row.businessUnit === 'GYPROC'; }).reduce(function (sum, row) { return sum + Number(row.targetAmount || 0); }, 0),
    weber: configurableActive.filter(function (row) { return row.businessUnit === 'WEBER'; }).reduce(function (sum, row) { return sum + Number(row.targetAmount || 0); }, 0),
    assignedUsers: Array.from(new Set(configurableActive.map(function (row) { return row.salesUserId; }).filter(Boolean))).length,
    legacyAllActiveCount: legacyAllActive.length,
    legacyAllActiveAmount: legacyAllActive.reduce(function (sum, row) { return sum + Number(row.targetAmount || 0); }, 0),
    legacyAllRequiresManualReview: legacyAllActive.length > 0
  };
}
function getSalesTargetManagementData(payload) {
  const eventId = salesTargetEventId_('TARGET-MGMT');
  try {
    const auth = requireApiUser(payload || {});
    if (!auth.ok) return auth;
    if (!salesTargetCanManage_(auth.data)) return salesTargetError_('FORBIDDEN', 'Sales target management denied', eventId);
    const requestedBusinessUnit = salesTargetNormalizeBusinessUnit_(payload && payload.businessUnit);
    if (requestedBusinessUnit && !salesTargetIsFilterBusinessUnit_(requestedBusinessUnit)) return salesTargetInvalidBusinessUnitError_('Invalid Sales Target Business Unit filter.', eventId);
    const allRows = salesTargetRows_().map(salesTargetNormalizeRow_).filter(function (row) { return salesTargetScopeAllowed_(auth.data, row, false); });
    const targets = salesTargetApplyFilters_(allRows, payload || {});
    return salesTargetResult_(true, {
      targets: targets,
      summary: salesTargetBuildSummary_(targets),
      formOptions: salesTargetBuildFormOptions_(payload || {}, auth.data)
    }, 'Sales target management data loaded', 'SUCCESS', eventId);
  } catch (error) {
    logError('getSalesTargetManagementData', error);
    return salesTargetError_('ERROR', error.message || 'Unable to load sales target management data', eventId);
  }
}
function salesTargetInvalidateCaches_(){bumpSalesTargetCacheVersion_();if(typeof clearSheetDataCache==='function')clearSheetDataCache(SALES_TARGETS_SHEET);try{CacheService.getScriptCache().removeAll(['sales-targets:v1']);}catch(ignore){}}
function dispatchSalesTargetAction_(action,payload){switch(String(action||'')){case'getSalesTargets':return getSalesTargets(payload);case'getSalesTarget':return getSalesTarget(payload);case'getEffectiveSalesTarget':return getEffectiveSalesTarget(payload);case'getSalesTargetFormOptions':return getSalesTargetFormOptions(payload);case'getSalesTargetManagementData':return getSalesTargetManagementData(payload);case'saveSalesTarget':return saveSalesTarget(payload);case'updateSalesTarget':return updateSalesTarget(payload);case'setSalesTargetStatus':return setSalesTargetStatus(payload);default:return null;}}
function isSalesTargetAction_(action){return ['getSalesTargets','getSalesTarget','getEffectiveSalesTarget','getSalesTargetFormOptions','getSalesTargetManagementData','saveSalesTarget','updateSalesTarget','setSalesTargetStatus'].indexOf(String(action||''))>=0;}
