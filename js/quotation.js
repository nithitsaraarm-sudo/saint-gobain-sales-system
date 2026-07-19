let CURRENT_QUOTE = { quoteId: '', customerId: '', customerName: '', shipping: 0, specialDiscount: 0, status: 'DRAFT', quoteType: 'WEBER' };
let CURRENT_QUOTE_TYPE = 'WEBER';
let QUOTE_TYPE_SELECTED = false;
let QUOTE_TYPE_RESOLVE = null;
const QUOTE_LINE_PREFIX = 'LINE_';
const DISCOUNT_CACHE = {};
const DISCOUNT_PROMISES = {};
const QUOTATION_LOAD_CACHE = {};
const QUOTATION_LOAD_PROMISES = {};
const QUOTATION_LOAD_TTL_MS = 10 * 60 * 1000;
const QUOTE_BRAND_LOGO_SOURCES = {
  WEBER: 'images/weber-logo.png?v=0.5.8',
  GYPROC: 'images/gyproc-logo.png?v=0.5.8'
};
let QUOTE_ITEM_SCROLL_SEQUENCE = 0;
let QUOTE_ITEM_HIGHLIGHT_TIMER = null;
let QUOTE_ITEM_PENDING_SCROLL_LINE_ID = '';
let QUOTE_PRODUCT_SEARCH_NAV_SEQUENCE = 0;
let QUOTE_PRODUCT_SEARCH_HIGHLIGHT_TIMER = null;
let QUOTE_SAVE_IN_PROGRESS = false;
let QUOTE_SAVE_REQUEST_ID = '';
let QUOTE_SAVE_REQUEST_SIGNATURE = '';

function normalizeQuoteType(value) {
  const text = String(value || '').trim().toUpperCase();
  return text === 'GYPROC' ? 'GYPROC' : 'WEBER';
}

function getQuoteTypeLabel(value) {
  return normalizeQuoteType(value) === 'GYPROC' ? 'Gyproc' : 'Weber';
}

function getQuoteTypeClass(value) {
  return normalizeQuoteType(value) === 'GYPROC' ? 'gyproc' : 'weber';
}

function getQuoteBrandLogoSource(value) {
  const type = normalizeQuoteType(value);
  const configuredLogos = window.QUOTE_BRAND_LOGOS && typeof window.QUOTE_BRAND_LOGOS === 'object'
    ? window.QUOTE_BRAND_LOGOS
    : {};
  return String(configuredLogos[type] || configuredLogos[type.toLowerCase()] || QUOTE_BRAND_LOGO_SOURCES[type] || '').trim();
}

function handleQuoteBrandLogoLoad(image) {
  const logoWrap = image && image.closest ? image.closest('.quote-brand-logo-wrap,.quote-print-brand') : null;
  if (logoWrap) {
    logoWrap.classList.add('is-loaded');
    logoWrap.classList.remove('is-fallback');
  }
}

function handleQuoteBrandLogoError(image) {
  const logoWrap = image && image.closest ? image.closest('.quote-brand-logo-wrap,.quote-print-brand') : null;
  if (logoWrap) {
    logoWrap.classList.add('is-fallback');
    logoWrap.classList.remove('is-loaded');
  }
}

function renderQuoteBrandSwitchContent(quoteType) {
  const selected = isQuoteBusinessUnitSelected();
  const label = selected ? getQuoteTypeLabel(quoteType) : 'เลือก BU';
  const escapedLabel = escapeQuotationPrintHtml(label);
  const caretHtml = '<span class="quote-type-caret" aria-hidden="true">▼</span>';
  if (!selected) {
    return `<span class="quote-brand-text">${escapedLabel}</span>${caretHtml}`;
  }
  const logoSrc = getQuoteBrandLogoSource(quoteType);
  if (!logoSrc) {
    return `<span class="quote-brand-text">${escapedLabel}</span>${caretHtml}`;
  }
  return `<span class="quote-brand-logo-wrap"><span class="quote-brand-fallback">${escapedLabel}</span><img class="quote-brand-logo" src="${escapeQuotationPrintHtml(logoSrc)}" alt="${escapedLabel}" loading="eager" decoding="async" onload="handleQuoteBrandLogoLoad(this)" onerror="handleQuoteBrandLogoError(this)"></span>${caretHtml}`;
}

function renderQuotationPrintBrandHtml(quoteType, fallbackLabel) {
  const type = normalizeQuoteType(quoteType);
  const label = fallbackLabel || getQuoteTypeLabel(type);
  const escapedLabel = escapeQuotationPrintHtml(label);
  const logoSrc = getQuoteBrandLogoSource(type);
  if (!logoSrc) {
    return `<p class="quote-type-subtitle">${escapedLabel} ▼</p>`;
  }
  return `<div class="quote-print-brand" aria-label="${escapedLabel}"><span class="quote-print-brand-fallback">${escapedLabel} ▼</span><img class="quote-print-brand-logo" src="${escapeQuotationPrintHtml(logoSrc)}" alt="${escapedLabel}" loading="eager" decoding="async" onload="handleQuoteBrandLogoLoad(this)" onerror="handleQuoteBrandLogoError(this)"></div>`;
}

function createQuotationSaveRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return 'quote-save-' + crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return 'quote-save-' + Date.now() + '-' + Array.from(values).map(value => value.toString(36)).join('-');
  }
  const randomPart = Math.random().toString(36).slice(2, 12) + '-' + Math.random().toString(36).slice(2, 12);
  return 'quote-save-' + Date.now() + '-' + randomPart;
}

function getQuotationSavePayloadSignature(payload) {
  try {
    const data = Object.assign({}, payload || {});
    delete data.clientRequestId;
    delete data.clientSaveId;
    delete data.quoteSaveRequestId;
    return JSON.stringify(data);
  } catch (error) {
    return '';
  }
}

function getQuotationSaveRequestIdForPayload(payload) {
  const signature = getQuotationSavePayloadSignature(payload);
  if (!QUOTE_SAVE_REQUEST_ID || QUOTE_SAVE_REQUEST_SIGNATURE !== signature) {
    QUOTE_SAVE_REQUEST_ID = createQuotationSaveRequestId();
    QUOTE_SAVE_REQUEST_SIGNATURE = signature;
  }
  return QUOTE_SAVE_REQUEST_ID;
}

function clearQuotationSaveRequestState() {
  QUOTE_SAVE_REQUEST_ID = '';
  QUOTE_SAVE_REQUEST_SIGNATURE = '';
}

function getQuotationSaveActionButtons() {
  if (typeof document === 'undefined') return [];
  return Array.from(document.querySelectorAll([
    'button[onclick="saveDraftQuotation()"]',
    'button[onclick="updateQuotation()"]',
    'button[onclick="saveQuotation()"]',
    'button[onclick="saveQuotationPdf()"]',
    'button[onclick="saveQuotationPng()"]',
    'button[onclick="shareQuote()"]'
  ].join(',')));
}

function setQuotationSaveBusy(isBusy) {
  getQuotationSaveActionButtons().forEach(button => {
    if (!button) return;
    if (isBusy) {
      if (button.dataset.quoteOriginalText === undefined) {
        button.dataset.quoteOriginalText = button.textContent || '';
      }
      if (button.dataset.quoteWasDisabled === undefined) {
        button.dataset.quoteWasDisabled = button.disabled ? 'true' : 'false';
      }
      const onclick = String(button.getAttribute('onclick') || '');
      if (onclick === 'saveDraftQuotation()' || onclick === 'updateQuotation()' || onclick === 'saveQuotation()') {
        button.textContent = 'กำลังบันทึก...';
      }
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    } else {
      if (button.dataset.quoteOriginalText !== undefined) {
        button.textContent = button.dataset.quoteOriginalText;
        delete button.dataset.quoteOriginalText;
      }
      button.disabled = button.dataset.quoteWasDisabled === 'true';
      delete button.dataset.quoteWasDisabled;
      button.removeAttribute('aria-busy');
    }
  });
}

function getProductBusinessUnitClient(product) {
  const source = product && typeof product === 'object' ? product : {};
  const text = String(source.productBusinessUnit || source.businessUnit || source.quoteType || source.bu || source.brand || '').trim().toUpperCase();
  if (text.indexOf('GYPROC') >= 0) return 'GYPROC';
  if (text.indexOf('WEBER') >= 0) return 'WEBER';
  return '';
}

function isProductForCurrentQuoteBusinessUnit(product) {
  const productUnit = getProductBusinessUnitClient(product);
  return productUnit && productUnit === normalizeQuoteType(CURRENT_QUOTE.quoteType || CURRENT_QUOTE_TYPE);
}

function getProductBusinessUnitLabel(productOrValue) {
  const unit = typeof productOrValue === 'string' ? normalizeQuoteType(productOrValue) : getProductBusinessUnitClient(productOrValue);
  return getQuoteTypeLabel(unit || 'WEBER');
}

function getCurrentQuoteBusinessUnit() {
  return normalizeQuoteType(CURRENT_QUOTE.quoteType || CURRENT_QUOTE.businessUnit || CURRENT_QUOTE_TYPE);
}

function isQuoteBusinessUnitSelected() {
  return QUOTE_TYPE_SELECTED || Boolean(CURRENT_QUOTE.quoteId && (CURRENT_QUOTE.quoteType || CURRENT_QUOTE.businessUnit));
}

function setCurrentQuoteType(value, explicit) {
  const previousType = normalizeQuoteType(CURRENT_QUOTE.quoteType || CURRENT_QUOTE_TYPE);
  CURRENT_QUOTE_TYPE = normalizeQuoteType(value);
  CURRENT_QUOTE.quoteType = CURRENT_QUOTE_TYPE;
  CURRENT_QUOTE.businessUnit = CURRENT_QUOTE_TYPE;
  if (explicit) QUOTE_TYPE_SELECTED = true;
  renderQuoteMeta();
  if (typeof renderProductPicker === 'function') {
    renderProductPicker();
  }
  return CURRENT_QUOTE_TYPE;
}

function openQuoteTypeModal() {
  const modal = document.getElementById('quoteTypeModal');
  if (modal) modal.classList.add('show');
  return new Promise(resolve => {
    QUOTE_TYPE_RESOLVE = resolve;
  });
}

function selectQuoteType(value) {
  const type = setCurrentQuoteType(value, true);
  const modal = document.getElementById('quoteTypeModal');
  if (modal) modal.classList.remove('show');
  if (QUOTE_TYPE_RESOLVE) {
    const resolve = QUOTE_TYPE_RESOLVE;
    QUOTE_TYPE_RESOLVE = null;
    resolve(type);
  }
  return type;
}

function closeQuoteTypeModal() {
  const modal = document.getElementById('quoteTypeModal');
  if (modal) modal.classList.remove('show');
  if (QUOTE_TYPE_RESOLVE) {
    const resolve = QUOTE_TYPE_RESOLVE;
    QUOTE_TYPE_RESOLVE = null;
    resolve('');
  }
}

async function requestQuoteTypeSelection(force) {
  if (!force && QUOTE_TYPE_SELECTED) return CURRENT_QUOTE_TYPE;
  const selected = await openQuoteTypeModal();
  return selected || '';
}

function getQuotationCacheId(quoteId) {
  return String(quoteId || '').trim();
}

function getLoadedQuotationCache(quoteId) {
  const id = getQuotationCacheId(quoteId);
  const cached = id ? QUOTATION_LOAD_CACHE[id] : null;
  if (!cached || cached.expiresAt <= Date.now()) {
    if (id) delete QUOTATION_LOAD_CACHE[id];
    return null;
  }
  console.log('[Quotation] cached', id);
  return cached.response;
}

function setLoadedQuotationCache(quoteId, response) {
  const id = getQuotationCacheId(quoteId);
  if (!id || !response || !response.ok) {
    return;
  }
  const expiresAt = Date.now() + QUOTATION_LOAD_TTL_MS;
  QUOTATION_LOAD_CACHE[id] = { expiresAt, response };
  const quote = response.data && response.data.quote ? response.data.quote : {};
  const quoteIdValue = getQuotationCacheId(quote.quoteId);
  const quoteNoValue = getQuotationCacheId(quote.quoteNo);
  if (quoteIdValue) QUOTATION_LOAD_CACHE[quoteIdValue] = { expiresAt, response };
  if (quoteNoValue) QUOTATION_LOAD_CACHE[quoteNoValue] = { expiresAt, response };
}

function clearLoadedQuotationCache(quoteId) {
  const id = getQuotationCacheId(quoteId);
  if (!id) {
    Object.keys(QUOTATION_LOAD_CACHE).forEach(key => delete QUOTATION_LOAD_CACHE[key]);
    return;
  }
  Object.keys(QUOTATION_LOAD_CACHE).forEach(key => {
    const quote = QUOTATION_LOAD_CACHE[key] && QUOTATION_LOAD_CACHE[key].response && QUOTATION_LOAD_CACHE[key].response.data
      ? QUOTATION_LOAD_CACHE[key].response.data.quote || {}
      : {};
    if (key === id || String(quote.quoteId || '').trim() === id || String(quote.quoteNo || '').trim() === id) {
      delete QUOTATION_LOAD_CACHE[key];
    }
  });
}

function renderQuote() {
  const customerSelect = document.getElementById('quoteCustomer');
  if (customerSelect) {
    customerSelect.innerHTML = DB.customers.map(c => `<option value="${c.customerId}">${c.customerName}</option>`).join('');
    if (CURRENT_QUOTE.customerId) {
      customerSelect.value = CURRENT_QUOTE.customerId;
    }
  }
  const vatLabel = document.getElementById('vatLabel');
  if (vatLabel) vatLabel.textContent = DB.settings?.vatRate || 7;
  renderProductPicker();
  renderCart();
}

function renderProductPicker() {
  const q = (document.getElementById('productSearch')?.value || '').toLowerCase();
  const picker = document.getElementById('productPicker');
  if (!picker) return;
  picker.innerHTML = DB.products.filter(p => JSON.stringify(p).toLowerCase().includes(q)).slice(0, 8).map(p => `<div class="row"><div class="product-img">${p.brand === 'Weber' ? '🟨' : '🟦'}</div><div><b>${p.productName}</b><br><small>${p.unit || ''} · ${money(p.listPrice)}</small></div><button class="tiny" style="margin-left:auto" onclick='addCart(${JSON.stringify(p)})'>+ เพิ่ม</button></div>`).join('');
}

function addCart(p) {
  return addProductToQuoteByReference(p, 'SEARCH', 1);
}

function renderCart() {
  const cartList = document.getElementById('cartList');
  if (!cartList) {
    calcCart();
    return;
  }
  cartList.innerHTML = CART.length ? CART.map(it => `<div class="row item-card"><div><b>${it.productName}</b><br><small>${money(it.listPrice)} · ส่วนลด <input style="width:60px;border:1px solid var(--line);border-radius:10px;padding:3px" type="number" value="${it.discount}" onchange="changeDiscount('${it.lineId}', Number(this.value))">%</small></div><div class="qty"><button onclick="changeQty('${it.lineId}', ${Number(it.qty) - 1})">−</button><b>${it.qty}</b><button onclick="changeQty('${it.lineId}', ${Number(it.qty) + 1})">+</button></div><button class="ghost" onclick="removeProduct('${it.lineId}')">ลบ</button></div>`).join('') : '<p style="color:var(--muted)">ยังไม่มีสินค้า</p>';
  calcCart();
}

function calcCart() {
  const shipping = Number(document.getElementById('shipping')?.value || 0);
  const specialDiscount = Number(document.getElementById('specialDiscount')?.value || 0);
  let subtotal = CART.reduce((sum, it) => {
    recalcLineItem(it);
    return sum + Number(it.lineTotal || 0);
  }, 0);
  subtotal = roundValue(subtotal);
  const vat = roundValue(subtotal * Number(DB.settings?.vatRate || 7) / 100);
  const total = roundValue(subtotal + vat + shipping - specialDiscount);
  const subtotalEl = document.getElementById('sumSubtotal');
  if (subtotalEl) subtotalEl.textContent = money(subtotal);
  const vatEl = document.getElementById('sumVat');
  if (vatEl) vatEl.textContent = money(vat);
  const totalEl = document.getElementById('sumTotal');
  if (totalEl) totalEl.textContent = money(total);
  return { subtotal, vat, shipping, specialDiscount, total };
}

function roundValue(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function getProductId(product) {
  return getProductPrimaryKey(product);
}

function getProductById(productId) {
  const resolved = resolveProductByReference(productId);
  return resolved.ok ? resolved.product : null;
}

const PRODUCT_REFERENCE_FIELDS = ['productId', 'sku', 'productCode', 'id', 'itemCode'];
const PRODUCT_ADD_IN_PROGRESS_KEYS = new Set();
let QUOTE_PRODUCT_DECISION_MODAL = null;

const QUOTE_PRODUCT_ADD_SOURCE = {
  SEARCH: 'SEARCH',
  FAVORITE: 'FAVORITE',
  PINNED: 'PINNED'
};

const QUOTE_PRODUCT_ADD_MESSAGES = {
  DUPLICATE_PAID_PRODUCT_LINE: 'สินค้านี้มีรายการซื้ออยู่แล้ว กรุณาปรับจำนวนจากรายการเดิม',
  DUPLICATE_FREE_PRODUCT_LINE: 'สินค้านี้มีรายการสินค้าแถมอยู่แล้ว กรุณาปรับจำนวนจากรายการเดิม',
  DUPLICATE_BOTH_PRODUCT_LINES: 'สินค้านี้มีทั้งรายการซื้อและสินค้าแถมอยู่แล้ว',
  FREE_PRODUCT_ADDED: 'เพิ่มสินค้าแถมเรียบร้อยแล้ว',
  PRODUCT_TYPE_CHANGE_DENIED: 'ไม่สามารถเปลี่ยนประเภทสินค้าได้ เพราะมีรายการประเภทเดียวกันอยู่แล้ว',
  PRICE_REQUIRED: 'กรุณากรอกราคาตั้งมากกว่า 0',
  PRICE_SAVED: 'บันทึกราคาตั้งเรียบร้อยแล้ว',
  UNIT_SAVED: 'บันทึกหน่วยสินค้าเรียบร้อยแล้ว',
  PRICE_SAVE_FAILED: 'ไม่สามารถบันทึกราคาได้ กรุณาลองใหม่อีกครั้ง',
  UNIT_SAVE_FAILED: 'ไม่สามารถบันทึกหน่วยสินค้าได้ กรุณาลองใหม่อีกครั้ง'
};

const QUOTE_PRICE_MAX = 999999999;
const QUOTE_PRICE_DECIMAL_LIMIT = 4;
const QUOTE_UNIT_OPTIONS = ['แผ่น', 'ถุง', 'ม้วน', 'เส้น', 'ชิ้น', 'กล่อง', 'ลัง', 'ชุด', 'กิโลกรัม', 'ตารางเมตร', 'เมตร', 'อื่น ๆ'];

function normalizeProductReference(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeProductReferenceForCompare(value) {
  return normalizeProductReference(value).toLowerCase();
}

function cloneQuoteProductRecord(product) {
  return Object.assign({}, product && typeof product === 'object' ? product : {});
}

function normalizeQuoteProductIdentityPart(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeQuoteProductIdentityPrice(value) {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (!text) return 'empty';
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return normalizeQuoteProductIdentityPart(value);
  return String(Math.round(numeric * 1000000) / 1000000);
}

function getQuoteProductIdentityFirstValue(product, fields) {
  const item = product && typeof product === 'object' ? product : {};
  for (var i = 0; i < fields.length; i++) {
    const value = item[fields[i]];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function createFallbackQuoteProductIdentityKey(product) {
  const item = product && typeof product === 'object' ? product : {};
  return [
    normalizeQuoteProductIdentityPart(getQuoteProductIdentityFirstValue(item, ['brand', 'businessUnit', 'productBusinessUnit', 'quoteType', 'bu'])),
    normalizeQuoteProductIdentityPart(getQuoteProductIdentityFirstValue(item, ['productCode', 'sku', 'productId', 'id', 'itemCode'])),
    normalizeQuoteProductIdentityPart(getQuoteProductIdentityFirstValue(item, ['productName', 'itemName', 'name'])),
    normalizeQuoteProductIdentityPart(getQuoteProductIdentityFirstValue(item, ['originalSelectedUnit', 'masterUnit', 'unit', 'uom', 'unitName', 'salesUnit', 'quotedUnit'])),
    normalizeQuoteProductIdentityPrice(getQuoteProductIdentityFirstValue(item, ['originalSelectedPrice', 'rawListPrice', 'rawPrice', 'masterListPrice', 'listPrice', 'price', 'unitListPrice', 'quotedListPrice'])),
    normalizeQuoteProductIdentityPart(getQuoteProductIdentityFirstValue(item, ['priceType', 'priceListType'])),
    normalizeQuoteProductIdentityPart(getQuoteProductIdentityFirstValue(item, ['priceList', 'priceListId', 'priceListName'])),
    normalizeQuoteProductIdentityPart(getQuoteProductIdentityFirstValue(item, ['promotionId', 'promoId', 'promotionCode'])),
    normalizeQuoteProductIdentityPart(getQuoteProductIdentityFirstValue(item, ['priceSource', 'priceListSource', 'promotionSource'])),
    normalizeQuoteProductIdentityPart(getQuoteProductIdentityFirstValue(item, ['discountGroup', 'groupCode', 'group', 'category']))
  ].join('|');
}

function getQuoteProductIdentityKey(product) {
  const item = product && typeof product === 'object' ? product : {};
  const explicitKey = normalizeProductReference(item.sourceProductIdentityKey || item.productIdentityKey);
  if (explicitKey) return explicitKey;
  const isQuoteLineSnapshot = Boolean(item.lineId || item.originalSelectedPrice !== undefined || item.sourceProductRecordKey || item.masterListPrice !== undefined);
  if (!isQuoteLineSnapshot && typeof window !== 'undefined' && typeof window.createProductIdentityKey === 'function') {
    return window.createProductIdentityKey(item);
  }
  return createFallbackQuoteProductIdentityKey(item);
}

function getQuoteProductRecordKeyFromReference(reference) {
  if (reference && reference.currentTarget) {
    const button = reference.currentTarget.closest ? reference.currentTarget.closest('[data-product-record-key],[data-product-id]') : reference.currentTarget;
    return normalizeProductReference(button && button.dataset && (button.dataset.productRecordKey || button.dataset.sourceProductRecordKey));
  }
  if (reference && reference.target && reference.target.closest) {
    const button = reference.target.closest('[data-product-record-key],[data-product-id]');
    return normalizeProductReference(button && button.dataset && (button.dataset.productRecordKey || button.dataset.sourceProductRecordKey));
  }
  if (reference && typeof reference === 'object') {
    const datasetKey = reference.dataset ? normalizeProductReference(reference.dataset.productRecordKey || reference.dataset.sourceProductRecordKey) : '';
    return datasetKey || normalizeProductReference(reference.sourceProductRecordKey || reference.productRecordKey || reference.recordKey);
  }
  const text = normalizeProductReference(reference);
  return text.indexOf('product-record:') === 0 ? text : '';
}

function resolveQuoteProductRecordSelection(recordKey) {
  const key = normalizeProductReference(recordKey);
  if (!key || typeof window === 'undefined' || typeof window.resolveProductRecordSelection !== 'function') return null;
  const product = window.resolveProductRecordSelection(key);
  return product ? cloneQuoteProductRecord(product) : null;
}

function buildResolvedProductRecord(product, matchedField, reference, recordKey) {
  const item = cloneQuoteProductRecord(product);
  const productIdentityKey = getQuoteProductIdentityKey(item);
  if (recordKey) item.sourceProductRecordKey = recordKey;
  if (productIdentityKey) item.sourceProductIdentityKey = productIdentityKey;
  return {
    ok: true,
    product: item,
    productId: getProductPrimaryKey(item),
    matchedField: matchedField || '',
    reference: reference || '',
    recordKey: recordKey || '',
    productIdentityKey: productIdentityKey
  };
}

function isDirectProductObjectReference(reference) {
  if (!reference || typeof reference !== 'object' || reference.currentTarget || reference.target || reference.dataset) return false;
  const item = reference;
  return ['productName', 'name', 'itemName', 'description', 'listPrice', 'price', 'rawListPrice', 'unit', 'uom', 'brand', 'businessUnit', 'productBusinessUnit', 'groupCode', 'discountGroup'].some(function (field) {
    const value = item[field];
    return value !== undefined && value !== null && String(value).trim() !== '';
  });
}

function getProductPrimaryKey(product) {
  const item = product && typeof product === 'object' ? product : {};
  for (var i = 0; i < PRODUCT_REFERENCE_FIELDS.length; i++) {
    const value = normalizeProductReference(item[PRODUCT_REFERENCE_FIELDS[i]]);
    if (value) return value;
  }
  return normalizeProductReference(product);
}

function collectProductReferences(reference) {
  const values = [];
  const add = value => {
    const text = normalizeProductReference(value);
    if (text && values.indexOf(text) < 0) values.push(text);
  };
  if (reference && reference.currentTarget) {
    const button = reference.currentTarget.closest ? reference.currentTarget.closest('[data-product-record-key],[data-product-id]') : reference.currentTarget;
    if (button && button.dataset) {
      add(button.dataset.productRecordKey);
      add(button.dataset.sourceProductRecordKey);
      add(button.dataset.productId);
    }
  } else if (reference && reference.target && reference.target.closest) {
    const button = reference.target.closest('[data-product-record-key],[data-product-id]');
    if (button && button.dataset) {
      add(button.dataset.productRecordKey);
      add(button.dataset.sourceProductRecordKey);
      add(button.dataset.productId);
    }
  } else if (reference && typeof reference === 'object') {
    add(reference.sourceProductRecordKey);
    add(reference.productRecordKey);
    add(reference.recordKey);
    PRODUCT_REFERENCE_FIELDS.forEach(field => add(reference[field]));
    if (reference.dataset) {
      add(reference.dataset.productRecordKey);
      add(reference.dataset.sourceProductRecordKey);
      add(reference.dataset.productId);
    }
  } else {
    add(reference);
  }
  return values;
}

function isProductActiveForQuote(product) {
  const status = normalizeProductReferenceForCompare(product && (product.active || product.status));
  return !status || status === 'true' || status === 'yes' || status === '1' || status === 'active';
}

function resolveProductByReference(reference) {
  const recordKey = getQuoteProductRecordKeyFromReference(reference);
  if (recordKey) {
    const registeredProduct = resolveQuoteProductRecordSelection(recordKey);
    if (registeredProduct) {
      return buildResolvedProductRecord(registeredProduct, 'recordKey', recordKey, recordKey);
    }
  }
  if (isDirectProductObjectReference(reference)) {
    return buildResolvedProductRecord(reference, 'object', getProductPrimaryKey(reference), recordKey);
  }
  const products = Array.isArray(DB && DB.products) ? DB.products : [];
  if (!products.length) {
    return { ok: false, code: 'PRODUCT_DATA_NOT_READY', references: collectProductReferences(reference) };
  }
  const references = collectProductReferences(reference);
  if (!references.length) {
    return { ok: false, code: 'PRODUCT_REFERENCE_INVALID', references: references };
  }
  for (var fieldIndex = 0; fieldIndex < PRODUCT_REFERENCE_FIELDS.length; fieldIndex++) {
    const field = PRODUCT_REFERENCE_FIELDS[fieldIndex];
    for (var refIndex = 0; refIndex < references.length; refIndex++) {
      const normalizedRef = normalizeProductReferenceForCompare(references[refIndex]);
      const product = products.find(item => normalizeProductReferenceForCompare(item && item[field]) === normalizedRef);
      if (product) {
        return buildResolvedProductRecord(product, field, references[refIndex], '');
      }
    }
  }
  return { ok: false, code: 'PRODUCT_NOT_FOUND', references: references };
}

function normalizeQuoteProductKey(value) {
  return normalizeProductReferenceForCompare(value);
}

function getQuoteProductKey(productOrLine) {
  const item = productOrLine && typeof productOrLine === 'object' ? productOrLine : {};
  if (productOrLine && typeof productOrLine === 'object') {
    const identityKey = getQuoteProductIdentityKey(item);
    if (identityKey && identityKey.replace(/\|/g, '').trim()) {
      return normalizeQuoteProductKey(identityKey);
    }
  }
  return normalizeQuoteProductKey(getProductPrimaryKey(item) || item.productId || item.productCode || item.sku || productOrLine);
}

function getQuoteLineFreeState(line) {
  return Boolean(line && (line.isFreeItem || line.isFree || line.freeItem || line.isGift));
}

function setQuoteLineFreeState(line, isFreeItem) {
  const free = Boolean(isFreeItem);
  line.isFree = free;
  line.freeItem = free;
  line.isFreeItem = free;
  if (free) {
    line.discountPercent = 0;
    line.discount = 0;
  }
  return line;
}

function findQuoteLine(productReference, isFreeItem, excludeLineId) {
  const targetKey = getQuoteProductKey(productReference);
  const targetFreeState = Boolean(isFreeItem);
  const excluded = String(excludeLineId || '').trim();
  if (!targetKey) return null;
  return CART.find(item => {
    const sameLine = excluded && String(item.lineId || '').trim() === excluded;
    return !sameLine && getQuoteProductKey(item) === targetKey && getQuoteLineFreeState(item) === targetFreeState;
  }) || null;
}

function hasPaidLine(productReference, excludeLineId) {
  return Boolean(findQuoteLine(productReference, false, excludeLineId));
}

function hasFreeLine(productReference, excludeLineId) {
  return Boolean(findQuoteLine(productReference, true, excludeLineId));
}

function getQuoteProductLineState(productReference) {
  return {
    paidLine: findQuoteLine(productReference, false),
    freeLine: findQuoteLine(productReference, true)
  };
}

function ensureCartLineIdentityAndOrder() {
  const seenLineIds = {};
  CART.forEach((item, index) => {
    const currentLineId = String(item.lineId || '').trim();
    if (!currentLineId || seenLineIds[currentLineId]) {
      item.lineId = createLineId();
    }
    seenLineIds[String(item.lineId)] = true;
    item.lineNo = index + 1;
    item.lineOrder = index + 1;
    item.sortOrder = index + 1;
    item.productId = normalizeProductReference(item.productId || item.productCode || item.sku || item.id);
    item.productCode = normalizeProductReference(item.productCode || item.productId);
    item.sku = normalizeProductReference(item.sku || item.productId);
    setQuoteLineFreeState(item, getQuoteLineFreeState(item));
  });
}

function createPaidQuoteLine(product, qty, discountPercent) {
  const line = createCartLine(product, qty || 1, discountPercent || 0, { isFreeItem: false });
  return setQuoteLineFreeState(line, false);
}

function createFreeQuoteLine(product, qty) {
  const line = createCartLine(product, qty || 1, 0, { isFreeItem: true });
  setQuoteLineFreeState(line, true);
  return recalcLineItem(line);
}

function renderQuoteProductDecisionModal(title, html, actions) {
  return new Promise(resolve => {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) {
      resolve('');
      return;
    }
    if (QUOTE_PRODUCT_DECISION_MODAL && typeof QUOTE_PRODUCT_DECISION_MODAL.close === 'function') {
      QUOTE_PRODUCT_DECISION_MODAL.close('');
    }
    const closeButton = modal.querySelector('.section-title .ghost');
    const previousCloseOnclick = closeButton ? closeButton.getAttribute('onclick') : null;
    const actionList = Array.isArray(actions) ? actions : [];
    var settled = false;
    const actionHtml = actionList.map((action, index) => {
      const className = action.primary ? 'primary' : 'ghost';
      return `<button type="button" class="${className}" data-quote-product-action="${index}">${action.label}</button>`;
    }).join('');
    function cleanup(result) {
      if (settled) return;
      settled = true;
      modal.classList.remove('show');
      modal.removeEventListener('click', overlayHandler);
      document.removeEventListener('keydown', keyHandler);
      if (closeButton) {
        closeButton.removeEventListener('click', closeHandler);
        if (previousCloseOnclick !== null) {
          closeButton.setAttribute('onclick', previousCloseOnclick);
        } else {
          closeButton.removeAttribute('onclick');
        }
      }
      QUOTE_PRODUCT_DECISION_MODAL = null;
      resolve(result || '');
    }
    function overlayHandler(event) {
      if (event.target === modal) cleanup('');
    }
    function keyHandler(event) {
      if (event.key === 'Escape') cleanup('');
    }
    function closeHandler(event) {
      event.preventDefault();
      cleanup('');
    }
    titleEl.textContent = title;
    bodyEl.innerHTML = `${html}<div class="actions quote-product-modal-actions">${actionHtml}</div>`;
    bodyEl.querySelectorAll('[data-quote-product-action]').forEach(button => {
      button.addEventListener('click', event => {
        const selected = actionList[Number(event.currentTarget.dataset.quoteProductAction || 0)] || {};
        bodyEl.querySelectorAll('button').forEach(item => { item.disabled = true; });
        cleanup(selected.value || '');
      });
    });
    if (closeButton) {
      closeButton.removeAttribute('onclick');
      closeButton.addEventListener('click', closeHandler);
    }
    modal.addEventListener('click', overlayHandler);
    document.addEventListener('keydown', keyHandler);
    modal.classList.add('show');
    const focusTarget = bodyEl.querySelector('[data-quote-product-action]');
    if (focusTarget && typeof focusTarget.focus === 'function') {
      setTimeout(() => focusTarget.focus(), 0);
    }
    QUOTE_PRODUCT_DECISION_MODAL = { close: cleanup };
  });
}

function showAddFreeItemConfirmation(product) {
  const productName = product && (product.productName || product.name || product.productId) || '';
  return renderQuoteProductDecisionModal(
    'สินค้านี้มีอยู่แล้ว',
    `<p>สินค้านี้มีอยู่ในรายการสินค้าซื้อแล้ว<br>ต้องการเพิ่มสินค้าเดียวกันเป็นสินค้าแถมหรือไม่?</p><p><b>${escapeQuotationPrintHtml(productName)}</b></p>`,
    [
      { label: 'ยกเลิก', value: '' },
      { label: 'เพิ่มเป็นสินค้าแถม', value: 'FREE', primary: true }
    ]
  );
}

function showProductAlreadyHasBothModal(product) {
  const productName = product && (product.productName || product.name || product.productId) || '';
  return renderQuoteProductDecisionModal(
    'สินค้านี้มีทั้งรายการซื้อและสินค้าแถมอยู่แล้ว',
    `<p>สินค้านี้มีทั้งรายการซื้อและสินค้าแถมอยู่แล้ว<br>กรุณาปรับจำนวนจากรายการสินค้าในใบเสนอราคา</p><p><b>${escapeQuotationPrintHtml(productName)}</b></p>`,
    [
      { label: 'ปิด', value: '' },
      { label: 'ไปยังรายการสินค้า', value: 'GO_TO_CART', primary: true }
    ]
  );
}

function showQuotePriceInputModal(options) {
  const opts = options || {};
  return new Promise(resolve => {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) {
      resolve(null);
      return;
    }
    if (QUOTE_PRODUCT_DECISION_MODAL && typeof QUOTE_PRODUCT_DECISION_MODAL.close === 'function') {
      QUOTE_PRODUCT_DECISION_MODAL.close('');
    }
    const closeButton = modal.querySelector('.section-title .ghost');
    const previousCloseOnclick = closeButton ? closeButton.getAttribute('onclick') : null;
    var settled = false;
    function cleanup(value) {
      if (settled) return;
      settled = true;
      modal.classList.remove('show');
      document.removeEventListener('keydown', keyHandler);
      if (closeButton) {
        closeButton.removeEventListener('click', cancelHandler);
        if (previousCloseOnclick !== null) closeButton.setAttribute('onclick', previousCloseOnclick);
        else closeButton.removeAttribute('onclick');
      }
      QUOTE_PRODUCT_DECISION_MODAL = null;
      resolve(value);
    }
    function keyHandler(event) {
      if (event.key === 'Escape') cleanup(null);
    }
    function cancelHandler(event) {
      if (event) event.preventDefault();
      cleanup(null);
    }
    titleEl.textContent = opts.title || 'กรุณาระบุราคาตั้ง';
    bodyEl.innerHTML = `<div class="quote-price-modal-form">
      <p>${escapeQuotationPrintHtml(opts.message || 'สินค้านี้ยังไม่มีราคาตั้ง กรุณาระบุราคาก่อนเพิ่มสินค้าเข้าใบเสนอราคา')}</p>
      ${opts.productName ? `<p><b>${escapeQuotationPrintHtml(opts.productName)}</b></p>` : ''}
      <label class="field"><span>ราคาตั้ง (บาท)</span><input id="quotePriceModalInput" type="text" inputmode="decimal" autocomplete="off" value="${escapeQuotationPrintHtml(opts.value || '')}"></label>
      <div id="quotePriceModalError" class="quote-modal-error" role="alert"></div>
      <div class="actions quote-product-modal-actions"><button type="button" class="ghost" id="quotePriceModalCancel">ยกเลิก</button><button type="button" class="primary" id="quotePriceModalSave">${escapeQuotationPrintHtml(opts.saveLabel || 'บันทึกและเพิ่มสินค้า')}</button></div>
    </div>`;
    const input = document.getElementById('quotePriceModalInput');
    const error = document.getElementById('quotePriceModalError');
    const cancel = document.getElementById('quotePriceModalCancel');
    const save = document.getElementById('quotePriceModalSave');
    function saveHandler() {
      const parsed = parseQuotePriceInput(input && input.value);
      if (!parsed.ok) {
        if (error) error.textContent = parsed.message || QUOTE_PRODUCT_ADD_MESSAGES.PRICE_REQUIRED;
        if (input) input.focus();
        return;
      }
      if (save) save.disabled = true;
      if (cancel) cancel.disabled = true;
      cleanup(parsed.value);
    }
    if (cancel) cancel.addEventListener('click', cancelHandler);
    if (save) save.addEventListener('click', saveHandler);
    if (input) {
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveHandler();
        }
      });
    }
    if (closeButton) {
      closeButton.removeAttribute('onclick');
      closeButton.addEventListener('click', cancelHandler);
    }
    document.addEventListener('keydown', keyHandler);
    modal.classList.add('show');
    setTimeout(() => {
      if (input && typeof input.focus === 'function') {
        input.focus();
        try {
          const length = String(input.value || '').length;
          input.setSelectionRange(length, length);
        } catch (error) {}
      }
    }, 0);
    QUOTE_PRODUCT_DECISION_MODAL = { close: cleanup };
  });
}

function showQuoteCustomUnitModal(currentUnit) {
  const initialUnit = sanitizeQuoteUnit(currentUnit);
  return new Promise(resolve => {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) {
      resolve('');
      return;
    }
    if (QUOTE_PRODUCT_DECISION_MODAL && typeof QUOTE_PRODUCT_DECISION_MODAL.close === 'function') {
      QUOTE_PRODUCT_DECISION_MODAL.close('');
    }
    const closeButton = modal.querySelector('.section-title .ghost');
    const previousCloseOnclick = closeButton ? closeButton.getAttribute('onclick') : null;
    var settled = false;
    function cleanup(value) {
      if (settled) return;
      settled = true;
      modal.classList.remove('show');
      document.removeEventListener('keydown', keyHandler);
      if (closeButton) {
        closeButton.removeEventListener('click', cancelHandler);
        if (previousCloseOnclick !== null) closeButton.setAttribute('onclick', previousCloseOnclick);
        else closeButton.removeAttribute('onclick');
      }
      QUOTE_PRODUCT_DECISION_MODAL = null;
      resolve(value || '');
    }
    function keyHandler(event) {
      if (event.key === 'Escape') cleanup('');
    }
    function cancelHandler(event) {
      if (event) event.preventDefault();
      cleanup('');
    }
    titleEl.textContent = 'ระบุหน่วยสินค้า';
    bodyEl.innerHTML = `<div class="quote-price-modal-form">
      <label class="field"><span>หน่วยสินค้า</span><input id="quoteUnitModalInput" type="text" maxlength="50" autocomplete="off" value="${escapeQuotationPrintHtml(initialUnit)}"></label>
      <div id="quoteUnitModalError" class="quote-modal-error" role="alert"></div>
      <div class="actions quote-product-modal-actions"><button type="button" class="ghost" id="quoteUnitModalCancel">ยกเลิก</button><button type="button" class="primary" id="quoteUnitModalSave">บันทึกหน่วยสินค้า</button></div>
    </div>`;
    const input = document.getElementById('quoteUnitModalInput');
    const error = document.getElementById('quoteUnitModalError');
    const cancel = document.getElementById('quoteUnitModalCancel');
    const save = document.getElementById('quoteUnitModalSave');
    function saveHandler() {
      const unit = sanitizeQuoteUnit(input && input.value);
      if (!unit) {
        if (error) error.textContent = 'กรุณาระบุหน่วยสินค้า';
        if (input) input.focus();
        return;
      }
      if (save) save.disabled = true;
      if (cancel) cancel.disabled = true;
      cleanup(unit);
    }
    if (cancel) cancel.addEventListener('click', cancelHandler);
    if (save) save.addEventListener('click', saveHandler);
    if (input) input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveHandler();
      }
    });
    if (closeButton) {
      closeButton.removeAttribute('onclick');
      closeButton.addEventListener('click', cancelHandler);
    }
    document.addEventListener('keydown', keyHandler);
    modal.classList.add('show');
    setTimeout(() => input && input.focus && input.focus(), 0);
    QUOTE_PRODUCT_DECISION_MODAL = { close: cleanup };
  });
}

function quoteProductAddMessage(code) {
  const messages = {
    PRODUCT_NOT_FOUND: 'ไม่พบข้อมูลสินค้านี้ กรุณารีเฟรชหรือลบออกจากรายการโปรด',
    PRODUCT_INACTIVE: 'สินค้านี้ถูกปิดการใช้งานและไม่สามารถเพิ่มได้',
    PRODUCT_REFERENCE_INVALID: 'รหัสสินค้าไม่ถูกต้อง',
    PRODUCT_DATA_NOT_READY: 'กำลังโหลดข้อมูลสินค้า กรุณาลองอีกครั้ง',
    PRODUCT_ADD_FAILED: 'เพิ่มสินค้าไม่สำเร็จ',
    DUPLICATE_PAID_PRODUCT_LINE: QUOTE_PRODUCT_ADD_MESSAGES.DUPLICATE_PAID_PRODUCT_LINE,
    DUPLICATE_FREE_PRODUCT_LINE: QUOTE_PRODUCT_ADD_MESSAGES.DUPLICATE_FREE_PRODUCT_LINE,
    DUPLICATE_BOTH_PRODUCT_LINES: QUOTE_PRODUCT_ADD_MESSAGES.DUPLICATE_BOTH_PRODUCT_LINES,
    PRODUCT_TYPE_CHANGE_DENIED: QUOTE_PRODUCT_ADD_MESSAGES.PRODUCT_TYPE_CHANGE_DENIED
  };
  return messages[code] || messages.PRODUCT_ADD_FAILED;
}

function toastProductAddError(result) {
  toast(quoteProductAddMessage(result && result.code));
}

function logQuoteProductAddEvent(eventName, detail) {
  try {
    console.info('[QuoteProductAdd]', eventName, {
      userId: USER && USER.userId || '',
      source: detail && detail.source || '',
      reference: detail && detail.reference || '',
      quoteId: CURRENT_QUOTE && (CURRENT_QUOTE.quoteId || CURRENT_QUOTE.quoteNo) || '',
      lineId: detail && detail.lineId || '',
      productId: detail && detail.productId || '',
      productCode: detail && detail.productCode || detail && detail.productId || '',
      productBusinessUnit: detail && detail.productBusinessUnit || '',
      productRecordKey: detail && detail.productRecordKey || '',
      productIdentityKey: detail && detail.productIdentityKey || '',
      selectedPrice: detail && detail.selectedPrice !== undefined ? detail.selectedPrice : '',
      selectedUnit: detail && detail.selectedUnit || '',
      matchedField: detail && detail.matchedField || '',
      duplicateDecision: detail && detail.duplicateDecision || '',
      isFreeItem: Boolean(detail && detail.isFreeItem),
      result: detail && detail.result || ''
    });
  } catch (ignore) {}
}

async function addProductToQuoteByReference(reference, source, qty) {
  const event = reference && (reference.currentTarget || reference.target) ? reference : null;
  const button = event && event.target && event.target.closest ? event.target.closest('[data-product-record-key],[data-product-id]') : null;
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  const productSource = normalizeProductReference((source || (button && button.dataset && button.dataset.productSource) || 'SEARCH')).toUpperCase();
  const productReference = button && button.dataset ? {
    productRecordKey: button.dataset.productRecordKey,
    sourceProductRecordKey: button.dataset.productRecordKey,
    productId: button.dataset.productId
  } : reference;
  const recordKey = button && button.dataset ? normalizeProductReference(button.dataset.productRecordKey) : getQuoteProductRecordKeyFromReference(productReference);
  const references = collectProductReferences(productReference);
  const lockKey = productSource + ':' + (recordKey || references[0] || '');
  if (lockKey !== ':' && PRODUCT_ADD_IN_PROGRESS_KEYS.has(lockKey)) {
    return { ok: false, code: 'PRODUCT_ADD_IN_PROGRESS' };
  }
  if (lockKey !== ':') PRODUCT_ADD_IN_PROGRESS_KEYS.add(lockKey);
  if (button) button.disabled = true;
  logQuoteProductAddEvent(productSource + '_PRODUCT_ADD_REQUESTED', { source: productSource, reference: references[0] || '', productRecordKey: recordKey, result: 'requested' });
  try {
    const result = await requestAddProductToQuote(productReference, productSource, qty || 1);
    if (document.getElementById('page-quote') && !document.getElementById('page-quote').classList.contains('active') && typeof go === 'function') {
      go('quote');
    }
    logQuoteProductAddEvent('PRODUCT_ADD_FLOW_COMPLETED', Object.assign({ source: productSource, reference: references[0] || '', productRecordKey: recordKey }, result || {}, { result: result && result.ok === false ? 'failed' : 'ok' }));
    return result || { ok: true };
  } catch (error) {
    const failed = { ok: false, code: 'PRODUCT_ADD_FAILED', message: error && error.message ? error.message : String(error || '') };
    toastProductAddError(failed);
    logQuoteProductAddEvent('PRODUCT_ADD_FAILED', { source: productSource, reference: references[0] || '', productRecordKey: recordKey, result: failed.code });
    return failed;
  } finally {
    if (button) button.disabled = false;
    if (lockKey !== ':') PRODUCT_ADD_IN_PROGRESS_KEYS.delete(lockKey);
  }
}

function createLineId() {
  return QUOTE_LINE_PREFIX + Date.now() + '_' + Math.floor(Math.random() * 10000);
}

function normalizeQuoteDecimalText(value) {
  return String(value === undefined || value === null ? '' : value).trim().replace(/,/g, '');
}

function toPriceNumber(value) {
  const numericValue = Number(normalizeQuoteDecimalText(value));
  return isNaN(numericValue) ? 0 : numericValue;
}

function parseQuotePriceInput(value) {
  const text = normalizeQuoteDecimalText(value);
  if (!text || !/^\d+(?:\.\d{1,4})?$/.test(text)) {
    return { ok: false, message: QUOTE_PRODUCT_ADD_MESSAGES.PRICE_REQUIRED };
  }
  const price = Number(text);
  if (!Number.isFinite(price) || price <= 0 || price > QUOTE_PRICE_MAX) {
    return { ok: false, message: QUOTE_PRODUCT_ADD_MESSAGES.PRICE_REQUIRED };
  }
  return { ok: true, value: roundValue(price) };
}

function sanitizeQuoteUnit(value) {
  return String(value || '').replace(/[<>]/g, '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
}

function getQuoteMasterListPrice(source) {
  const item = source && typeof source === 'object' ? source : {};
  return roundValue(toPriceNumber(item.masterListPrice ?? item.masterPrice ?? item.productListPrice ?? item.listPrice ?? item.price ?? 0));
}

function getQuoteLineListPrice(source) {
  const item = source && typeof source === 'object' ? source : {};
  const value = item.quotedListPrice ?? item.listPrice ?? item.unitListPrice ?? item.price ?? item.masterListPrice ?? 0;
  return roundValue(toPriceNumber(value));
}

function getQuoteMasterUnit(source) {
  const item = source && typeof source === 'object' ? source : {};
  return sanitizeQuoteUnit(item.masterUnit ?? item.productUnit ?? item.unit ?? item.uom ?? item.unitName ?? item.salesUnit ?? '');
}

function getQuoteLineUnit(source) {
  const item = source && typeof source === 'object' ? source : {};
  return sanitizeQuoteUnit(item.quotedUnit ?? item.unit ?? item.masterUnit ?? item.uom ?? item.unitName ?? item.salesUnit ?? '');
}

function getCurrentQuoteAuditName() {
  return String(USER?.quoteDisplayName || USER?.fullName || USER?.displayName || USER?.username || '').trim();
}

function syncQuoteLineSnapshot(item) {
  if (!item || typeof item !== 'object') return item;
  const masterListPrice = roundValue(toPriceNumber(item.masterListPrice !== undefined ? item.masterListPrice : item.listPrice));
  const quotedListPrice = roundValue(toPriceNumber(item.quotedListPrice !== undefined ? item.quotedListPrice : item.listPrice));
  const masterUnit = sanitizeQuoteUnit(item.masterUnit || item.unit || item.quotedUnit);
  const quotedUnit = sanitizeQuoteUnit(item.quotedUnit || item.unit || masterUnit);
  item.masterListPrice = masterListPrice;
  item.quotedListPrice = quotedListPrice;
  item.listPrice = quotedListPrice;
  item.masterUnit = masterUnit;
  item.quotedUnit = quotedUnit;
  item.unit = quotedUnit;
  if (item.originalSelectedPrice === undefined || item.originalSelectedPrice === null || String(item.originalSelectedPrice).trim() === '') {
    item.originalSelectedPrice = masterListPrice;
  }
  if (item.originalSelectedUnit === undefined || item.originalSelectedUnit === null || String(item.originalSelectedUnit).trim() === '') {
    item.originalSelectedUnit = masterUnit;
  }
  if (!normalizeProductReference(item.sourceProductIdentityKey)) {
    const identitySource = Object.assign({}, item, { sourceProductIdentityKey: '' });
    item.sourceProductIdentityKey = getQuoteProductIdentityKey(identitySource);
  }
  item.priceOverridden = Boolean(item.priceOverridden) || (masterListPrice > 0 && quotedListPrice > 0 && roundValue(masterListPrice) !== roundValue(quotedListPrice)) || (masterListPrice <= 0 && quotedListPrice > 0);
  item.unitOverridden = Boolean(item.unitOverridden) || (masterUnit && quotedUnit && normalizeProductReferenceForCompare(masterUnit) !== normalizeProductReferenceForCompare(quotedUnit));
  return item;
}

function canEditQuoteLineSnapshots() {
  const status = String(CURRENT_QUOTE && CURRENT_QUOTE.status || 'DRAFT').trim().toUpperCase();
  const role = String(USER && USER.role || '').trim().toUpperCase();
  if (status === 'CANCELLED' || role === 'VIEWER') {
    return false;
  }
  return true;
}

function getSelectedCustomerIdForPricing() {
  return String(window.selectedCustomerId || document.getElementById('quoteCustomer')?.value || CURRENT_QUOTE.customerId || '').trim();
}

async function getDiscountPercentForProduct(customerId, product) {
  const groupCode = String(product && product.groupCode || '').trim();
  const productBusinessUnit = getProductBusinessUnitClient(product);
  if (!customerId || !groupCode) {
    return 0;
  }
  const cacheKey = customerId + '|' + (productBusinessUnit || '-') + '|' + groupCode;
  if (DISCOUNT_CACHE[cacheKey] !== undefined) {
    return Number(DISCOUNT_CACHE[cacheKey] || 0);
  }
  if (typeof getCache === 'function') {
    const cachedDiscounts = getCache('sg_discount_cache') || {};
    if (cachedDiscounts[cacheKey] !== undefined) {
      DISCOUNT_CACHE[cacheKey] = Number(cachedDiscounts[cacheKey] || 0);
      return Number(DISCOUNT_CACHE[cacheKey] || 0);
    }
  }
  if (DISCOUNT_PROMISES[cacheKey]) {
    return DISCOUNT_PROMISES[cacheKey];
  }
  try {
    DISCOUNT_PROMISES[cacheKey] = callApi('discount', { customerId: customerId, groupCode: groupCode, productBusinessUnit: productBusinessUnit }).then(response => {
    const discountPercent = response && response.ok ? Number(response.data?.discountPercent || 0) : 0;
    DISCOUNT_CACHE[cacheKey] = discountPercent;
      if (typeof getCache === 'function' && typeof setCache === 'function') {
        const cachedDiscounts = getCache('sg_discount_cache') || {};
        cachedDiscounts[cacheKey] = discountPercent;
        setCache('sg_discount_cache', cachedDiscounts, 60);
      }
    return discountPercent;
    }).finally(() => {
      delete DISCOUNT_PROMISES[cacheKey];
    });
    return DISCOUNT_PROMISES[cacheKey];
  } catch (error) {
    console.error(error);
    delete DISCOUNT_PROMISES[cacheKey];
    return 0;
  }
}

function recalcLineItem(item) {
  syncQuoteLineSnapshot(item);
  const qty = Math.max(0, Number(item.qty || 0));
  const listPrice = getQuoteLineListPrice(item);
  const isFree = getQuoteLineFreeState(item);
  const discountPercent = isFree || item.discountLoading ? 0 : roundValue(Number(item.discountPercent ?? item.discount ?? 0));
  const unitPrice = isFree ? 0 : roundValue(listPrice * (1 - discountPercent / 100));
  const lineTotal = roundValue(unitPrice * qty);
  const vat = roundValue(lineTotal * 0.07);
  const grandTotal = roundValue(lineTotal + vat);

  item.qty = qty;
  setQuoteLineFreeState(item, isFree);
  item.quotedListPrice = listPrice;
  item.listPrice = listPrice;
  item.quotedUnit = getQuoteLineUnit(item);
  item.unit = item.quotedUnit;
  item.discountPercent = discountPercent;
  item.discount = discountPercent;
  item.unitPrice = unitPrice;
  item.netPrice = unitPrice;
  item.lineTotal = lineTotal;
  item.vat = vat;
  item.grandTotal = grandTotal;
  return item;
}

function createCartLine(product, qty, discountPercent, options) {
  const opts = options || {};
  const productBusinessUnit = getProductBusinessUnitClient(product);
  const masterListPrice = getQuoteMasterListPrice(product);
  const quotedListPrice = opts.quotedListPrice !== undefined ? roundValue(toPriceNumber(opts.quotedListPrice)) : masterListPrice;
  const masterUnit = getQuoteMasterUnit(product);
  const quotedUnit = sanitizeQuoteUnit(opts.quotedUnit || masterUnit);
  const sourceProductRecordKey = normalizeProductReference(opts.sourceProductRecordKey || product.sourceProductRecordKey || product.productRecordKey || product.recordKey);
  const sourceProductIdentityKey = normalizeProductReference(opts.sourceProductIdentityKey || getQuoteProductIdentityKey(product));
  return recalcLineItem({
    lineId: createLineId(),
    productId: getProductId(product),
    productCode: normalizeProductReference(product.productCode || product.productId || product.sku || product.id || getProductId(product)),
    sku: normalizeProductReference(product.sku || product.productId || product.productCode || product.id || getProductId(product)),
    productBusinessUnit: productBusinessUnit,
    businessUnit: productBusinessUnit,
    productName: String(product.productName || product.name || '').trim(),
    unit: quotedUnit,
    masterUnit: masterUnit,
    quotedUnit: quotedUnit,
    qty: Number(qty || 1),
    sourceProductRecordKey: sourceProductRecordKey,
    sourceProductIdentityKey: sourceProductIdentityKey,
    originalSelectedPrice: masterListPrice,
    originalSelectedUnit: masterUnit,
    priceType: String(product.priceType || product.priceListType || '').trim(),
    priceList: String(product.priceList || product.priceListId || product.priceListName || '').trim(),
    promotionId: String(product.promotionId || product.promoId || product.promotionCode || '').trim(),
    priceSource: String(product.priceSource || product.priceListSource || product.promotionSource || '').trim(),
    masterListPrice: masterListPrice,
    quotedListPrice: quotedListPrice,
    listPrice: quotedListPrice,
    priceOverridden: Boolean(opts.priceOverridden) || (masterListPrice <= 0 && quotedListPrice > 0) || (masterListPrice > 0 && roundValue(masterListPrice) !== roundValue(quotedListPrice)),
    unitOverridden: Boolean(opts.unitOverridden) || (masterUnit && quotedUnit && normalizeProductReferenceForCompare(masterUnit) !== normalizeProductReferenceForCompare(quotedUnit)),
    overrideReason: String(opts.overrideReason || '').trim(),
    updatedAt: opts.updatedAt || new Date().toISOString(),
    updatedBy: opts.updatedBy || getCurrentQuoteAuditName(),
    discountPercent: opts.isFreeItem ? 0 : Number(discountPercent || 0),
    isFree: Boolean(opts.isFreeItem),
    freeItem: Boolean(opts.isFreeItem),
    isFreeItem: Boolean(opts.isFreeItem)
  });
}

async function ensureQuoteReadyForProductAdd() {
  if (!isQuoteBusinessUnitSelected()) {
    const selectedType = await requestQuoteTypeSelection(true);
    if (!selectedType) {
      toast('กรุณาเลือก BU ก่อนเพิ่มสินค้า');
      return false;
    }
  }
  if (!CURRENT_QUOTE.customerId) {
    const customerId = getSelectedCustomerIdForPricing();
    if (customerId) {
      const customer = DB.customers.find(c => String(c.customerId || '').trim() === String(customerId).trim()) || {};
      CURRENT_QUOTE = {
        quoteId: CURRENT_QUOTE.quoteId || '',
        quoteNo: CURRENT_QUOTE.quoteNo || '',
        customerId: String(customerId).trim(),
        customerName: String(customer.customerName || '').trim(),
        quoteType: getCurrentQuoteBusinessUnit(),
        businessUnit: getCurrentQuoteBusinessUnit(),
        shipping: Number(document.getElementById('shipping')?.value || 0),
        specialDiscount: Number(document.getElementById('specialDiscount')?.value || 0),
        status: 'DRAFT'
      };
      renderQuoteMeta();
    } else {
      toast('กรุณาเลือกลูกค้าก่อนเพิ่มสินค้า');
      return false;
    }
  }
  return true;
}

async function getPaidProductAddPriceOptions(product) {
  const masterListPrice = getQuoteMasterListPrice(product);
  if (masterListPrice > 0) {
    return { ok: true, quotedListPrice: masterListPrice, priceOverridden: false };
  }
  const enteredPrice = await showQuotePriceInputModal({
    title: 'กรุณาระบุราคาตั้ง',
    message: 'สินค้านี้ยังไม่มีราคาตั้ง กรุณาระบุราคาก่อนเพิ่มสินค้าเข้าใบเสนอราคา',
    productName: product && (product.productName || product.name || product.productId) || '',
    saveLabel: 'บันทึกและเพิ่มสินค้า'
  });
  if (!enteredPrice) {
    return { ok: false, code: 'QUOTE_LINE_PRICE_REQUIRED', cancelled: true };
  }
  return {
    ok: true,
    quotedListPrice: enteredPrice,
    priceOverridden: true,
    overrideReason: 'MISSING_MASTER_PRICE'
  };
}

async function appendPaidQuoteLine(product, qty, source, options) {
  const opts = options || {};
  const line = createCartLine(product, qty || 1, 0, {
    isFreeItem: false,
    quotedListPrice: opts.quotedListPrice,
    priceOverridden: opts.priceOverridden,
    overrideReason: opts.overrideReason,
    updatedBy: getCurrentQuoteAuditName()
  });
  setQuoteLineFreeState(line, false);
  line.discountLoading = true;
  CART.push(line);
  ensureCartLineIdentityAndOrder();
  renderCart();
  scheduleScrollToAddedItem(line.lineId);
  const addedProductUnit = getProductBusinessUnitClient(product);
  if (addedProductUnit && addedProductUnit !== getCurrentQuoteBusinessUnit()) {
    toast(`เพิ่มสินค้า ${getQuoteTypeLabel(addedProductUnit)} ในใบเสนอราคา ${getQuoteTypeLabel(getCurrentQuoteBusinessUnit())} แล้ว`);
  } else {
    toast('กำลังโหลดส่วนลด...');
  }
  getDiscountPercentForProduct(CURRENT_QUOTE.customerId, product).then(discountPercent => {
    const target = CART.find(item => item.lineId === line.lineId);
    if (!target) return;
    target.discountLoading = false;
    target.discountPercent = Number(discountPercent || 0);
    target.discount = target.discountPercent;
    recalcLineItem(target);
    renderCart();
    if (QUOTE_ITEM_PENDING_SCROLL_LINE_ID === line.lineId) {
      scheduleScrollToAddedItem(line.lineId);
    }
  }).catch(error => {
    console.error(error);
    const target = CART.find(item => item.lineId === line.lineId);
    if (!target) return;
    target.discountLoading = false;
    recalcLineItem(target);
    renderCart();
    if (QUOTE_ITEM_PENDING_SCROLL_LINE_ID === line.lineId) {
      scheduleScrollToAddedItem(line.lineId);
    }
  });
  logQuoteProductAddEvent('QUOTE_PAID_PRODUCT_ADDED', {
    source: source,
    lineId: line.lineId,
    productId: line.productId,
    productCode: line.productCode,
    productBusinessUnit: line.productBusinessUnit,
    productRecordKey: line.sourceProductRecordKey,
    productIdentityKey: line.sourceProductIdentityKey,
    selectedPrice: line.originalSelectedPrice,
    selectedUnit: line.masterUnit,
    isFreeItem: false,
    result: 'created'
  });
  return { ok: true, code: 'QUOTE_PAID_PRODUCT_ADDED', productId: line.productId, productCode: line.productCode, lineId: line.lineId, productRecordKey: line.sourceProductRecordKey, productIdentityKey: line.sourceProductIdentityKey, isFreeItem: false, updatedExisting: false };
}

function appendFreeQuoteLine(product, qty, source) {
  const line = createFreeQuoteLine(product, qty || 1);
  CART.push(line);
  ensureCartLineIdentityAndOrder();
  renderCart();
  scheduleScrollToAddedItem(line.lineId);
  toast(QUOTE_PRODUCT_ADD_MESSAGES.FREE_PRODUCT_ADDED);
  logQuoteProductAddEvent('QUOTE_FREE_PRODUCT_ADDED', {
    source: source,
    lineId: line.lineId,
    productId: line.productId,
    productCode: line.productCode,
    productBusinessUnit: line.productBusinessUnit,
    productRecordKey: line.sourceProductRecordKey,
    productIdentityKey: line.sourceProductIdentityKey,
    selectedPrice: line.originalSelectedPrice,
    selectedUnit: line.masterUnit,
    isFreeItem: true,
    result: 'created'
  });
  return { ok: true, code: 'QUOTE_FREE_PRODUCT_ADDED', productId: line.productId, productCode: line.productCode, lineId: line.lineId, productRecordKey: line.sourceProductRecordKey, productIdentityKey: line.sourceProductIdentityKey, isFreeItem: true, updatedExisting: false };
}

async function requestAddProductToQuote(productReference, source, qty) {
  const productSource = normalizeProductReference(source || QUOTE_PRODUCT_ADD_SOURCE.SEARCH).toUpperCase() || QUOTE_PRODUCT_ADD_SOURCE.SEARCH;
  const requestedQty = Number(qty || 1);
  const normalizedQty = Math.max(1, requestedQty || 1);
  if ((!DB.products || !DB.products.length) && typeof loadProducts === 'function') {
    await loadProducts();
  }
  if (requestedQty <= 0) {
    toast('จำนวนสินค้าต้องมากกว่า 0');
    return { ok: false, code: 'PRODUCT_REFERENCE_INVALID' };
  }
  const resolved = resolveProductByReference(productReference);
  if (!resolved.ok) {
    toastProductAddError(resolved);
    logQuoteProductAddEvent('PRODUCT_REFERENCE_NOT_FOUND', { source: productSource, reference: collectProductReferences(productReference)[0] || '', productRecordKey: getQuoteProductRecordKeyFromReference(productReference), result: resolved.code });
    return resolved;
  }
  const product = resolved.product;
  const productIdentityKey = resolved.productIdentityKey || getQuoteProductIdentityKey(product);
  const productRecordKey = resolved.recordKey || getQuoteProductRecordKeyFromReference(productReference);
  if (!isProductActiveForQuote(product)) {
    const inactive = { ok: false, code: 'PRODUCT_INACTIVE', product: product, productId: resolved.productId };
    toastProductAddError(inactive);
    logQuoteProductAddEvent('PRODUCT_ADD_FAILED', { source: productSource, reference: resolved.reference, productId: resolved.productId, productRecordKey: productRecordKey, productIdentityKey: productIdentityKey, productBusinessUnit: getProductBusinessUnitClient(product), selectedPrice: getQuoteMasterListPrice(product), selectedUnit: getQuoteMasterUnit(product), matchedField: resolved.matchedField, result: inactive.code });
    return inactive;
  }
  if (!(await ensureQuoteReadyForProductAdd())) {
    return { ok: false, code: 'PRODUCT_ADD_FAILED' };
  }
  logQuoteProductAddEvent('PRODUCT_REFERENCE_RESOLVED', { source: productSource, reference: resolved.reference, productId: resolved.productId, productCode: product.productCode || product.sku || product.productId || '', productRecordKey: productRecordKey, productIdentityKey: productIdentityKey, productBusinessUnit: getProductBusinessUnitClient(product), selectedPrice: getQuoteMasterListPrice(product), selectedUnit: getQuoteMasterUnit(product), matchedField: resolved.matchedField, result: 'resolved' });
  ensureCartLineIdentityAndOrder();
  const state = getQuoteProductLineState(product);
  if (!state.paidLine && !state.freeLine) {
    const priceOptions = await getPaidProductAddPriceOptions(product);
    if (!priceOptions.ok) return priceOptions;
    return appendPaidQuoteLine(product, 1, productSource, priceOptions);
  }
  if (!state.paidLine && state.freeLine) {
    const priceOptions = await getPaidProductAddPriceOptions(product);
    if (!priceOptions.ok) return priceOptions;
    return appendPaidQuoteLine(product, 1, productSource, priceOptions);
  }
  if (state.paidLine && !state.freeLine) {
    logQuoteProductAddEvent('QUOTE_DUPLICATE_PRODUCT_DETECTED', { source: productSource, productId: resolved.productId, productRecordKey: productRecordKey, productIdentityKey: productIdentityKey, selectedPrice: getQuoteMasterListPrice(product), selectedUnit: getQuoteMasterUnit(product), duplicateDecision: 'paid_exists', isFreeItem: false, lineId: state.paidLine.lineId, result: 'paid_exists' });
    const decision = await showAddFreeItemConfirmation(product);
    if (decision !== 'FREE') {
      logQuoteProductAddEvent('QUOTE_DUPLICATE_PRODUCT_ADD_CANCELLED', { source: productSource, productId: resolved.productId, productRecordKey: productRecordKey, productIdentityKey: productIdentityKey, duplicateDecision: 'free_item_cancelled', isFreeItem: true, result: 'cancelled' });
      return { ok: false, code: 'DUPLICATE_PAID_PRODUCT_LINE', productId: resolved.productId, productRecordKey: productRecordKey, productIdentityKey: productIdentityKey, lineId: state.paidLine.lineId, cancelled: true };
    }
    if (hasFreeLine(product)) {
      toast(QUOTE_PRODUCT_ADD_MESSAGES.DUPLICATE_FREE_PRODUCT_LINE);
      return { ok: false, code: 'DUPLICATE_FREE_PRODUCT_LINE', productId: resolved.productId, productRecordKey: productRecordKey, productIdentityKey: productIdentityKey };
    }
    return appendFreeQuoteLine(product, 1, productSource);
  }
  logQuoteProductAddEvent('QUOTE_DUPLICATE_PRODUCT_DETECTED', { source: productSource, productId: resolved.productId, productRecordKey: productRecordKey, productIdentityKey: productIdentityKey, selectedPrice: getQuoteMasterListPrice(product), selectedUnit: getQuoteMasterUnit(product), duplicateDecision: 'both_exist', isFreeItem: true, lineId: state.freeLine && state.freeLine.lineId, result: 'both_exist' });
  const choice = await showProductAlreadyHasBothModal(product);
  if (choice === 'GO_TO_CART') {
    scheduleScrollToAddedItem((state.paidLine || state.freeLine).lineId);
  }
  toast(QUOTE_PRODUCT_ADD_MESSAGES.DUPLICATE_BOTH_PRODUCT_LINES);
  return { ok: false, code: 'DUPLICATE_BOTH_PRODUCT_LINES', productId: resolved.productId, productRecordKey: productRecordKey, productIdentityKey: productIdentityKey, lineId: (state.paidLine || state.freeLine).lineId };
}

async function saveQuote() {
  return saveQuotation();
}

async function shareQuote() {
  const customer = DB.customers.find(c => String(c.customerId || '').trim() === String(document.getElementById('quoteCustomer')?.value || '').trim()) || {};
  const totalText = document.getElementById('sumTotal')?.textContent || '0.00';
  const text = `ใบเสนอราคา ${customer.customerName || ''}\nยอดสุทธิ ${totalText} บาท`;
  try {
    if (navigator.share) {
      await navigator.share({ text: text });
      return;
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      toast('คัดลอกข้อความแล้ว');
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    toast('คัดลอกข้อความแล้ว');
  } catch (error) {
    toast('แชร์หรือคัดลอกข้อความไม่สำเร็จ');
  }
}

function selectCustomer(customerId) {
  const select = document.getElementById('quoteCustomer');
  if (select && customerId) {
    select.value = customerId;
  }
  return newQuotation(customerId);
}

async function newQuotation(customerId) {
  const selectedCustomerId = String(customerId || document.getElementById('quoteCustomer')?.value || '').trim();
  if (!selectedCustomerId) {
    toast('กรุณาเลือกลูกค้าก่อนสร้างใบเสนอราคา');
    return;
  }
  const selectedQuoteType = await requestQuoteTypeSelection(true);
  if (!selectedQuoteType) {
    toast('กรุณาเลือกประเภทใบเสนอราคา');
    return;
  }
  const customer = DB.customers.find(c => String(c.customerId || '').trim() === selectedCustomerId) || {};
  const response = await callApi('createQuotation', { customerId: selectedCustomerId, quoteType: selectedQuoteType, businessUnit: selectedQuoteType });
  if (response.ok && response.data) {
    CURRENT_QUOTE = {
      quoteId: response.data.quoteId || CURRENT_QUOTE.quoteId,
      quoteNo: response.data.quoteNo || CURRENT_QUOTE.quoteNo || '',
      customerId: selectedCustomerId,
      customerName: customer.customerName || '',
      quoteType: normalizeQuoteType(response.data.quoteType || selectedQuoteType),
      businessUnit: normalizeQuoteType(response.data.quoteType || selectedQuoteType),
      shipping: 0,
      specialDiscount: 0,
      status: 'DRAFT'
    };
  } else {
    CURRENT_QUOTE = {
      quoteId: CURRENT_QUOTE.quoteId || '',
      customerId: selectedCustomerId,
      customerName: customer.customerName || '',
      quoteType: selectedQuoteType,
      businessUnit: selectedQuoteType,
      shipping: 0,
      specialDiscount: 0,
      status: 'DRAFT'
    };
  }
  CART.length = 0;
  const select = document.getElementById('quoteCustomer');
  if (select) select.value = selectedCustomerId;
  document.getElementById('shipping').value = 0;
  document.getElementById('specialDiscount').value = 0;
  await refreshQuotation();
  toast('เริ่มต้นใบเสนอราคาใหม่');
}

async function addProduct(productId, qty) {
  const normalizedQty = Number(qty || 1);
  if (normalizedQty <= 0) {
    toast('จำนวนสินค้าต้องมากกว่า 0');
    return { ok: false, code: 'PRODUCT_REFERENCE_INVALID' };
  }
  const resolved = resolveProductByReference(productId);
  if (!resolved.ok) {
    toastProductAddError(resolved);
    return resolved;
  }
  const product = resolved.product;
  if (!isProductActiveForQuote(product)) {
    const inactive = { ok: false, code: 'PRODUCT_INACTIVE', productId: resolved.productId };
    toastProductAddError(inactive);
    return inactive;
  }
  if (!isQuoteBusinessUnitSelected()) {
    const selectedType = await requestQuoteTypeSelection(true);
    if (!selectedType) {
      toast('กรุณาเลือก BU ก่อนเพิ่มสินค้า');
      return { ok: false, code: 'PRODUCT_ADD_FAILED' };
    }
  }
  if (!CURRENT_QUOTE.customerId) {
    const sel = document.getElementById('quoteCustomer');
    const customerId = sel?.value;
    if (customerId) {
      await newQuotation(customerId);
    } else {
      toast('กรุณาเลือกลูกค้าก่อนเพิ่มสินค้า');
      return { ok: false, code: 'PRODUCT_ADD_FAILED' };
    }
  }
  const existing = CART.find(item => getProductId(item) === getProductId(product));
  if (existing) {
    existing.qty = Number(existing.qty || 0) + normalizedQty;
  } else {
    CART.push({
      lineId: createLineId(),
      productId: getProductId(product),
      productName: String(product.productName || product.name || '').trim(),
      listPrice: roundValue(Number(product.listPrice || product.price || 0)),
      qty: normalizedQty,
      discount: 0,
      netPrice: roundValue(Number(product.listPrice || product.price || 0)),
      lineTotal: roundValue(Number(product.listPrice || product.price || 0) * normalizedQty)
    });
  }
  await refreshQuotation();
}

async function removeProduct(lineId) {
  const index = CART.findIndex(item => item.lineId === lineId);
  if (index < 0) {
    toast('ไม่พบรายการสินค้า');
    return;
  }
  CART.splice(index, 1);
  await refreshQuotation();
}

async function changeQty(lineId, qty) {
  const normalizedQty = Number(qty);
  const line = CART.find(item => item.lineId === lineId);
  if (!line) {
    toast('ไม่พบรายการสินค้า');
    return;
  }
  line.qty = Math.max(1, normalizedQty || 1);
  await refreshQuotation();
}

async function changeDiscount(lineId, newDiscount) {
  const line = CART.find(item => item.lineId === lineId);
  if (!line) {
    return;
  }
  line.discount = Number(newDiscount || 0);
  await refreshQuotation();
}

async function refreshQuotation() {
  if (!CURRENT_QUOTE.customerId) {
    renderCart();
    return;
  }
  const discountTasks = CART.map(async item => {
    const product = getProductById(item.productId) || {};
    const groupCode = String(product.groupCode || product.group || '').trim();
    const response = await callApi('discount', {
      customerId: CURRENT_QUOTE.customerId,
      groupCode: groupCode
    });
    const discountPercent = response.ok ? Number(response.data?.discountPercent || 0) : 0;
    item.discount = discountPercent;
    const listPrice = Number(item.listPrice || 0);
    item.netPrice = roundValue(listPrice * (1 - discountPercent / 100));
    item.lineTotal = roundValue(item.netPrice * Number(item.qty || 0));
    return item;
  });
  await Promise.all(discountTasks);
  const totals = calcCart();
  CURRENT_QUOTE.shipping = Number(document.getElementById('shipping')?.value || 0);
  CURRENT_QUOTE.specialDiscount = Number(document.getElementById('specialDiscount')?.value || 0);
  renderCart();
  return totals;
}

async function saveQuotation() {
  if (!CURRENT_QUOTE.customerId) {
    toast('กรุณาเลือกลูกค้าก่อนบันทึกใบเสนอราคา');
    return;
  }
  if (!CART.length) {
    toast('กรุณาเพิ่มสินค้าในใบเสนอราคาก่อนบันทึก');
    return;
  }
  await refreshQuotation();
  const payload = {
    quoteId: CURRENT_QUOTE.quoteId || '',
    customerId: CURRENT_QUOTE.customerId,
    customerName: CURRENT_QUOTE.customerName,
    sales: USER?.displayName,
    createdBy: USER?.quoteDisplayName || USER?.fullName || USER?.displayName || USER?.username,
    createdByUserId: USER?.userId || '',
    createdByUsername: USER?.username || '',
    quoteDisplayName: USER?.quoteDisplayName || USER?.fullName || USER?.displayName || USER?.username,
    items: CART.map(item => ({
      productId: item.productId,
      productName: item.productName,
      unit: item.unit,
      qty: item.qty,
      listPrice: item.listPrice,
      discountPercent: item.discountPercent,
      unitPrice: item.unitPrice,
      netPrice: item.netPrice,
      lineTotal: item.lineTotal,
      vat: item.vat,
      grandTotal: item.grandTotal
    })),
    shipping: Number(document.getElementById('shipping')?.value || 0),
    specialDiscount: Number(document.getElementById('specialDiscount')?.value || 0)
  };
  const response = await callApi('quotation', payload);
  toast(response.message || (response.ok ? 'บันทึกใบเสนอราคาเรียบร้อยแล้ว' : 'บันทึกไม่สำเร็จ'));
  if (response.ok) {
    CURRENT_QUOTE.quoteId = response.data?.quoteId || CURRENT_QUOTE.quoteId;
    CART.length = 0;
    await loadData();
    renderCart();
  }
  return response;
}

async function loadQuotationLegacy(quoteId) {
  const id = String(quoteId || '').trim();
  if (!id) {
    toast('ต้องระบุเลขที่ใบเสนอราคา');
    return;
  }
  const response = await openQuotation(id);
  if (!response.ok) {
    toast(response.message || 'โหลดใบเสนอราคาไม่สำเร็จ');
    return response;
  }
  const data = response.data || {};
  const quote = data.quote || {};
  const lines = Array.isArray(data.lines) ? data.lines : [];
  CURRENT_QUOTE = {
    quoteId: String(quote.quoteId || id),
    customerId: String(quote.customerId || '').trim(),
    customerName: String(quote.customerName || '').trim(),
    shipping: Number(quote.shipping || 0),
    specialDiscount: Number(quote.specialDiscount || 0),
    status: String(quote.status || 'DRAFT')
  };
  CART.length = 0;
  lines.forEach(line => {
    CART.push({
      lineId: String(line.lineId || createLineId()),
      productId: String(line.productId || '').trim(),
      productBusinessUnit: getProductBusinessUnitClient(line) || String(line.productBusinessUnit || line.businessUnit || '').trim(),
      businessUnit: getProductBusinessUnitClient(line) || String(line.productBusinessUnit || line.businessUnit || '').trim(),
      productName: String(line.productName || '').trim(),
      unit: String(line.unit || '').trim(),
      qty: Number(line.qty || 0),
      listPrice: roundValue(Number(line.listPrice || 0)),
      discount: Number(line.discountPercent || line.discount || 0),
      discountPercent: Number(line.discountPercent || line.discount || 0),
      unitPrice: roundValue(Number(line.unitPrice || line.netPrice || 0)),
      netPrice: roundValue(Number(line.netPrice || line.unitPrice || 0)),
      lineTotal: roundValue(Number(line.lineTotal || 0)),
      vat: roundValue(Number(line.vat || 0)),
      grandTotal: roundValue(Number(line.grandTotal || 0))
    });
  });
  const select = document.getElementById('quoteCustomer');
  if (select) select.value = CURRENT_QUOTE.customerId;
  document.getElementById('shipping').value = CURRENT_QUOTE.shipping;
  document.getElementById('specialDiscount').value = CURRENT_QUOTE.specialDiscount;
  renderCart();
  return response;
}

async function duplicateQuotation(quoteId) {
  const id = String(quoteId || '').trim();
  if (!id) {
    toast('ต้องระบุเลขที่ใบเสนอราคา');
    return;
  }
  const response = await callApi('duplicateQuotation', id);
  if (!response.ok) {
    toast(response.message || 'สร้างสำเนาใบเสนอราคาไม่สำเร็จ');
    return response;
  }
  if (response.data?.newQuoteId) {
    await loadQuotation(response.data.newQuoteId);
  }
  return response;
}

async function cancelQuotation(quoteId) {
  const id = String(quoteId || CURRENT_QUOTE.quoteId || '').trim();
  if (!id) {
    toast('ต้องระบุเลขที่ใบเสนอราคา');
    return;
  }
  const response = await callApi('cancelQuotation', id);
  toast(response.message || (response.ok ? 'ยกเลิกใบเสนอราคาแล้ว' : 'ยกเลิกไม่สำเร็จ'));
  if (response.ok) {
    if (CURRENT_QUOTE.quoteId === id) {
      CURRENT_QUOTE.status = 'CANCELLED';
    }
    await loadData();
  }
  return response;
}

function renderCart() {
  const cartList = document.getElementById('cartList');
  if (!cartList) {
    calcCart();
    return;
  }
  ensureCartLineIdentityAndOrder();
  CART.forEach(recalcLineItem);
  cartList.innerHTML = CART.length ? CART.map(it => `<div class="row item-card quote-line"><div class="quote-line-main"><b>${it.productName||'-'}</b><br><small>${it.unit||'-'}</small><div class="quote-line-prices"><span>ราคาตั้ง ${money(it.listPrice)}</span><span>ส่วนลด <input style="width:60px;border:1px solid var(--line);border-radius:10px;padding:3px" type="number" value="${it.discountPercent||0}" onchange="changeDiscount('${it.lineId}', Number(this.value))">%</span><span>ราคาสุทธิ ${money(it.unitPrice)}</span><span>รวม ${money(it.lineTotal)}</span></div></div><div class="qty"><button onclick="changeQty('${it.lineId}', ${Number(it.qty) - 1})">−</button><b>${it.qty}</b><button onclick="changeQty('${it.lineId}', ${Number(it.qty) + 1})">+</button></div><button class="ghost" onclick="removeProduct('${it.lineId}')">ลบ</button></div>`).join('') : '<p style="color:var(--muted)">ยังไม่มีสินค้า</p>';
  calcCart();
}

function calcCart() {
  const shipping = Number(document.getElementById('shipping')?.value || 0);
  const specialDiscount = Number(document.getElementById('specialDiscount')?.value || 0);
  CART.forEach(recalcLineItem);
  let subtotal = CART.reduce((sum, it) => sum + Number(it.lineTotal || 0), 0);
  subtotal = roundValue(subtotal);
  const vat = roundValue(CART.reduce((sum, it) => sum + Number(it.vat || 0), 0));
  const total = roundValue(subtotal + vat + shipping - specialDiscount);
  const subtotalEl = document.getElementById('sumSubtotal');
  if (subtotalEl) subtotalEl.textContent = money(subtotal);
  const vatEl = document.getElementById('sumVat');
  if (vatEl) vatEl.textContent = money(vat);
  const totalEl = document.getElementById('sumTotal');
  if (totalEl) totalEl.textContent = money(total);
  return { subtotal, vat, shipping, specialDiscount, total, grandTotal: total };
}

async function addProduct(productId, qty) {
  const normalizedQty = Number(qty || 1);
  if (normalizedQty <= 0) {
    toast('จำนวนสินค้าต้องมากกว่า 0');
    return { ok: false, code: 'PRODUCT_REFERENCE_INVALID' };
  }
  const resolved = resolveProductByReference(productId);
  if (!resolved.ok) {
    toastProductAddError(resolved);
    return resolved;
  }
  const product = resolved.product;
  if (!isProductActiveForQuote(product)) {
    const inactive = { ok: false, code: 'PRODUCT_INACTIVE', productId: resolved.productId };
    toastProductAddError(inactive);
    return inactive;
  }
  if (!isQuoteBusinessUnitSelected()) {
    const selectedType = await requestQuoteTypeSelection(true);
    if (!selectedType) {
      toast('กรุณาเลือก BU ก่อนเพิ่มสินค้า');
      return { ok: false, code: 'PRODUCT_ADD_FAILED' };
    }
  }
  if (!CURRENT_QUOTE.customerId) {
    const customerId = getSelectedCustomerIdForPricing();
    if (customerId) {
      await newQuotation(customerId);
    } else {
      toast('กรุณาเลือกลูกค้าก่อนเพิ่มสินค้า');
      return { ok: false, code: 'PRODUCT_ADD_FAILED' };
    }
  }
  const existing = CART.find(item => getProductId(item) === getProductId(product));
  if (existing) {
    existing.qty = Number(existing.qty || 0) + normalizedQty;
    recalcLineItem(existing);
  } else {
    const discountPercent = await getDiscountPercentForProduct(CURRENT_QUOTE.customerId, product);
    CART.push(createCartLine(product, normalizedQty, discountPercent));
  }
  renderCart();
}

async function changeQty(lineId, qty) {
  const normalizedQty = Number(qty);
  const line = CART.find(item => item.lineId === lineId);
  if (!line) {
    toast('ไม่พบรายการสินค้า');
    return;
  }
  line.qty = Math.max(1, normalizedQty || 1);
  recalcLineItem(line);
  renderCart();
}
async function changeDiscount(lineId, newDiscount) {
  const line = CART.find(item => item.lineId === lineId);
  if (!line) {
    return;
  }
  if (getQuoteLineFreeState(line)) {
    line.discountPercent = 0;
    line.discount = 0;
    recalcLineItem(line);
    renderCart();
    return;
  }
  line.discountPercent = Number(newDiscount || 0);
  line.discount = line.discountPercent;
  recalcLineItem(line);
  renderCart();
}

async function openQuoteLinePriceEditor(lineId) {
  const line = CART.find(item => item.lineId === lineId);
  if (!line) {
    toast('ไม่พบรายการสินค้า');
    return { ok: false, code: 'QUOTE_LINE_NOT_FOUND' };
  }
  if (!canEditQuoteLineSnapshots()) {
    toast('คุณไม่มีสิทธิ์แก้ไขราคาหรือใบเสนอราคานี้ถูกล็อก');
    return { ok: false, code: 'PRICE_EDIT_FORBIDDEN' };
  }
  const enteredPrice = await showQuotePriceInputModal({
    title: 'แก้ไขราคาตั้ง',
    message: 'แก้ไขราคาตั้งเฉพาะใบเสนอราคานี้ โดยไม่กระทบ Product Master',
    productName: line.productName || line.productId || '',
    value: getQuoteLineListPrice(line) > 0 ? getQuoteLineListPrice(line) : '',
    saveLabel: 'บันทึกราคา'
  });
  if (!enteredPrice) {
    return { ok: false, code: 'QUOTE_LINE_PRICE_REQUIRED', cancelled: true };
  }
  const oldPrice = getQuoteLineListPrice(line);
  line.quotedListPrice = enteredPrice;
  line.listPrice = enteredPrice;
  line.priceOverridden = roundValue(getQuoteMasterListPrice(line)) !== roundValue(enteredPrice);
  line.overrideReason = line.priceOverridden ? (line.overrideReason || 'USER_PRICE_OVERRIDE') : '';
  line.updatedAt = new Date().toISOString();
  line.updatedBy = getCurrentQuoteAuditName();
  recalcLineItem(line);
  renderCart();
  scheduleScrollToAddedItem(line.lineId);
  logQuoteProductAddEvent('QUOTE_LINE_PRICE_CHANGED', {
    lineId: line.lineId,
    productId: line.productId,
    productCode: line.productCode,
    result: oldPrice + '->' + enteredPrice
  });
  toast(QUOTE_PRODUCT_ADD_MESSAGES.PRICE_SAVED);
  return { ok: true, lineId: line.lineId, oldPrice: oldPrice, newPrice: enteredPrice };
}

function getQuoteUnitOptionsForLine(line) {
  const current = sanitizeQuoteUnit(line && (line.quotedUnit || line.unit || line.masterUnit));
  const options = QUOTE_UNIT_OPTIONS.slice();
  if (current && options.indexOf(current) < 0) {
    options.unshift(current);
  }
  return options;
}

async function changeQuoteLineUnit(lineId, value) {
  const line = CART.find(item => item.lineId === lineId);
  if (!line) {
    toast('ไม่พบรายการสินค้า');
    return { ok: false, code: 'QUOTE_LINE_NOT_FOUND' };
  }
  if (!canEditQuoteLineSnapshots()) {
    toast('คุณไม่มีสิทธิ์แก้ไขหน่วยหรือใบเสนอราคานี้ถูกล็อก');
    renderCart();
    return { ok: false, code: 'UNIT_EDIT_FORBIDDEN' };
  }
  var nextUnit = sanitizeQuoteUnit(value);
  if (nextUnit === 'อื่น ๆ') {
    nextUnit = await showQuoteCustomUnitModal(line.quotedUnit || line.unit || line.masterUnit);
  }
  if (!nextUnit) {
    toast('กรุณาระบุหน่วยสินค้า');
    renderCart();
    return { ok: false, code: 'QUOTE_LINE_UNIT_REQUIRED' };
  }
  const oldUnit = line.quotedUnit || line.unit || '';
  line.quotedUnit = nextUnit;
  line.unit = nextUnit;
  line.unitOverridden = Boolean(line.masterUnit) && normalizeProductReferenceForCompare(line.masterUnit) !== normalizeProductReferenceForCompare(nextUnit);
  line.updatedAt = new Date().toISOString();
  line.updatedBy = getCurrentQuoteAuditName();
  recalcLineItem(line);
  renderCart();
  logQuoteProductAddEvent('QUOTE_LINE_UNIT_CHANGED', {
    lineId: line.lineId,
    productId: line.productId,
    productCode: line.productCode,
    result: oldUnit + '->' + nextUnit
  });
  toast(QUOTE_PRODUCT_ADD_MESSAGES.UNIT_SAVED);
  return { ok: true, lineId: line.lineId, oldUnit: oldUnit, newUnit: nextUnit };
}

async function toggleFreeItem(lineId, checked) {
  const line = CART.find(item => item.lineId === lineId);
  if (!line) {
    return;
  }
  const nextFreeState = Boolean(checked);
  const duplicate = findQuoteLine(line, nextFreeState, lineId);
  if (duplicate) {
    toast(nextFreeState ? QUOTE_PRODUCT_ADD_MESSAGES.DUPLICATE_FREE_PRODUCT_LINE : QUOTE_PRODUCT_ADD_MESSAGES.DUPLICATE_PAID_PRODUCT_LINE);
    logQuoteProductAddEvent('QUOTE_PRODUCT_TYPE_CHANGE_DENIED', {
      lineId: line.lineId,
      productId: line.productId,
      productCode: line.productCode || line.productId,
      isFreeItem: nextFreeState,
      result: 'duplicate_' + (nextFreeState ? 'free' : 'paid')
    });
    renderCart();
    scheduleScrollToAddedItem(duplicate.lineId);
    return { ok: false, code: 'PRODUCT_TYPE_CHANGE_DENIED' };
  }
  if (!nextFreeState && getQuoteLineListPrice(line) <= 0) {
    const enteredPrice = await showQuotePriceInputModal({
      title: 'กรุณาระบุราคาตั้ง',
      message: 'สินค้าซื้อต้องมีราคาตั้งมากกว่า 0 กรุณาระบุราคาก่อนเปลี่ยนเป็นสินค้าซื้อ',
      productName: line.productName || line.productId || '',
      saveLabel: 'บันทึกราคา'
    });
    if (!enteredPrice) {
      renderCart();
      return { ok: false, code: 'QUOTE_LINE_PRICE_REQUIRED', cancelled: true };
    }
    line.quotedListPrice = enteredPrice;
    line.listPrice = enteredPrice;
    line.priceOverridden = true;
    line.overrideReason = line.overrideReason || 'REQUIRED_FOR_PAID_LINE';
  }
  setQuoteLineFreeState(line, nextFreeState);
  line.updatedAt = new Date().toISOString();
  line.updatedBy = getCurrentQuoteAuditName();
  recalcLineItem(line);
  renderCart();
  scheduleScrollToAddedItem(line.lineId);
  return { ok: true, isFreeItem: nextFreeState };
}

async function refreshQuotation() {
  const totals = calcCart();
  CURRENT_QUOTE.shipping = Number(document.getElementById('shipping')?.value || 0);
  CURRENT_QUOTE.specialDiscount = Number(document.getElementById('specialDiscount')?.value || 0);
  renderCart();
  return totals;
}

async function saveQuotation() {
  if (!CURRENT_QUOTE.customerId) {
    toast('กรุณาเลือกลูกค้าก่อนบันทึกใบเสนอราคา');
    return;
  }
  if (!CART.length) {
    toast('กรุณาเพิ่มสินค้าในใบเสนอราคาก่อนบันทึก');
    return;
  }
  const totals = calcCart();
  const payload = {
    customerId: CURRENT_QUOTE.customerId,
    customerName: CURRENT_QUOTE.customerName,
    items: CART.map(item => {
      recalcLineItem(item);
      return {
        productId: item.productId,
        productName: item.productName,
        unit: item.unit,
        qty: item.qty,
        listPrice: item.listPrice,
        discountPercent: item.discountPercent,
        unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      vat: item.vat,
      grandTotal: item.grandTotal,
      isFree: Boolean(item.isFree),
      freeItem: Boolean(item.isFree),
      status: item.status || 'ACTIVE'
      };
    }),
    subtotal: totals.subtotal,
    vat: totals.vat,
    grandTotal: totals.grandTotal,
    specialDiscount: totals.specialDiscount,
    shipping: totals.shipping,
    status: 'SAVED',
    createdBy: USER?.quoteDisplayName || USER?.fullName || USER?.displayName || USER?.username || '',
    createdByUserId: USER?.userId || '',
    createdByUsername: USER?.username || '',
    quoteDisplayName: USER?.quoteDisplayName || USER?.fullName || USER?.displayName || USER?.username || ''
  };
  const response = await callApi('saveQuotation', payload);
  if (!response.ok) {
    toast(response.message || 'บันทึกใบเสนอราคาไม่สำเร็จ');
    return response;
  }
  const quoteNo = response.data?.quoteNo || response.data?.quoteId || '';
  CURRENT_QUOTE.quoteId = response.data?.quoteId || CURRENT_QUOTE.quoteId;
  CURRENT_QUOTE.quoteNo = quoteNo;
  toast('บันทึกใบเสนอราคาแล้ว' + (quoteNo ? ': ' + quoteNo : ''));
  CART.length = 0;
  renderCart();
  await loadData();
  return response;
}

function renderQuoteMeta() {
  const meta = document.getElementById('quoteMeta');
  if (!meta) return;
  const quoteNo = CURRENT_QUOTE.quoteNo || CURRENT_QUOTE.quoteId || 'ยังไม่บันทึก';
  const status = CURRENT_QUOTE.status || 'DRAFT';
  const quoteType = normalizeQuoteType(CURRENT_QUOTE.quoteType || CURRENT_QUOTE.businessUnit || CURRENT_QUOTE_TYPE);
  const typeContent = renderQuoteBrandSwitchContent(quoteType);
  meta.innerHTML = `<button type="button" class="quote-type-switch ${getQuoteTypeClass(quoteType)}" onclick="openQuoteTypeModal()" aria-label="เลือกแบรนด์ ${escapeQuotationPrintHtml(getQuoteTypeLabel(quoteType))}">${typeContent}</button><span>เลขที่ใบเสนอราคา: <b>${quoteNo}</b></span><span>สถานะ: <b>${status}</b></span>`;
}

function buildQuotationPayload(status) {
  const totals = calcCart();
  ensureCartLineIdentityAndOrder();
  return {
    quoteId: CURRENT_QUOTE.quoteId || '',
    quoteNo: CURRENT_QUOTE.quoteNo || '',
    quoteType: normalizeQuoteType(CURRENT_QUOTE.quoteType || CURRENT_QUOTE_TYPE),
    businessUnit: normalizeQuoteType(CURRENT_QUOTE.quoteType || CURRENT_QUOTE_TYPE),
    customerId: CURRENT_QUOTE.customerId,
    customerName: CURRENT_QUOTE.customerName,
    items: CART.map((item, index) => {
      recalcLineItem(item);
      return {
        lineNo: index + 1,
        lineOrder: index + 1,
        sortOrder: index + 1,
        lineId: item.lineId,
        productId: item.productId,
        productCode: item.productCode || item.productId,
        sku: item.sku || item.productId,
        productBusinessUnit: getProductBusinessUnitClient(item) || item.productBusinessUnit || '',
        productName: item.productName,
        unit: item.quotedUnit || item.unit,
        masterUnit: item.masterUnit || '',
        quotedUnit: item.quotedUnit || item.unit || '',
        qty: item.qty,
        listPrice: item.quotedListPrice || item.listPrice,
        masterListPrice: item.masterListPrice || 0,
        quotedListPrice: item.quotedListPrice || item.listPrice,
        priceOverridden: Boolean(item.priceOverridden),
        unitOverridden: Boolean(item.unitOverridden),
        overrideReason: item.overrideReason || '',
        priceType: item.priceType || '',
        priceList: item.priceList || '',
        promotionId: item.promotionId || '',
        priceSource: item.priceSource || '',
        updatedAt: item.updatedAt || '',
        updatedBy: item.updatedBy || '',
        discountPercent: item.discountPercent,
        unitPrice: item.unitPrice,
        netPrice: item.netPrice,
        lineTotal: item.lineTotal,
        vat: item.vat,
        grandTotal: item.grandTotal,
        isFreeItem: getQuoteLineFreeState(item),
        isFree: getQuoteLineFreeState(item),
        freeItem: getQuoteLineFreeState(item),
        status: item.status || 'ACTIVE'
      };
    }),
    subtotal: totals.subtotal,
    vat: totals.vat,
    grandTotal: totals.grandTotal,
    specialDiscount: totals.specialDiscount,
    shipping: totals.shipping,
    status: status || 'SAVED',
    createdBy: USER?.quoteDisplayName || USER?.fullName || USER?.displayName || USER?.username || '',
    createdByUserId: USER?.userId || '',
    createdByUsername: USER?.username || '',
    quoteDisplayName: USER?.quoteDisplayName || USER?.fullName || USER?.displayName || USER?.username || ''
  };
}

async function saveQuotationWithStatus(status) {
  if (!CURRENT_QUOTE.customerId) {
    toast('กรุณาเลือกลูกค้าก่อนบันทึกใบเสนอราคา');
    return;
  }
  if (!CART.length) {
    toast('กรุณาเพิ่มสินค้าในใบเสนอราคาก่อนบันทึก');
    return;
  }
  const payload = buildQuotationPayload(status);
  const response = await callApi(payload.quoteId ? 'updateQuotation' : 'saveQuotation', payload);
  if (!response.ok) {
    toast(response.message || 'บันทึกใบเสนอราคาไม่สำเร็จ');
    return response;
  }
  CURRENT_QUOTE.quoteId = response.data?.quoteId || CURRENT_QUOTE.quoteId;
  CURRENT_QUOTE.quoteNo = response.data?.quoteNo || CURRENT_QUOTE.quoteNo || CURRENT_QUOTE.quoteId;
  CURRENT_QUOTE.quoteType = normalizeQuoteType(response.data?.quoteType || CURRENT_QUOTE.quoteType || CURRENT_QUOTE_TYPE);
  CURRENT_QUOTE.businessUnit = CURRENT_QUOTE.quoteType;
  CURRENT_QUOTE.status = response.data?.status || status || CURRENT_QUOTE.status;
  setCurrentQuoteType(CURRENT_QUOTE.quoteType, true);
  renderQuoteMeta();
  renderCart();
  toast((status === 'DRAFT' ? 'บันทึกแบบร่างแล้ว' : 'อัปเดตใบเสนอราคาแล้ว') + (CURRENT_QUOTE.quoteNo ? ': ' + CURRENT_QUOTE.quoteNo : ''));
  await loadData();
  return response;
}

async function saveDraftQuotation() {
  return saveQuotationWithStatus('DRAFT');
}

async function updateQuotation() {
  return saveQuotationWithStatus('SAVED');
}

async function saveQuotation() {
  return saveQuotationWithStatus('SAVED');
}

async function loadQuotation(quoteId) {
  const id = String(quoteId || '').trim();
  if (!id) {
    toast('ต้องระบุเลขที่ใบเสนอราคา');
    return;
  }
  const cached = getLoadedQuotationCache(id);
  if (cached) {
    applyLoadedQuotationResponse(cached, id);
    return cached;
  }
  if (QUOTATION_LOAD_PROMISES[id]) {
    return QUOTATION_LOAD_PROMISES[id];
  }
  toast('กำลังโหลดข้อมูล...');
  console.log('[Quotation] load', id);
  QUOTATION_LOAD_PROMISES[id] = callApi('loadQuotation', { quoteId: id }).then(response => {
  if (!response.ok) {
    toast(response.message || 'โหลดใบเสนอราคาไม่สำเร็จ');
    return response;
  }
    setLoadedQuotationCache(id, response);
    applyLoadedQuotationResponse(response, id);
    return response;
  }).finally(() => {
    delete QUOTATION_LOAD_PROMISES[id];
  });
  return QUOTATION_LOAD_PROMISES[id];
}

function applyLoadedQuotationResponse(response, fallbackQuoteId) {
  const data = response.data || {};
  const quote = data.quote || {};
  const lines = (Array.isArray(data.lines) ? data.lines : []).slice().sort((a, b) => {
    const aNo = Number(String(a.lineOrder || a.sortOrder || a.lineNo || '').replace(/,/g, ''));
    const bNo = Number(String(b.lineOrder || b.sortOrder || b.lineNo || '').replace(/,/g, ''));
    if (aNo && bNo && aNo !== bNo) return aNo - bNo;
    if (aNo && !bNo) return -1;
    if (!aNo && bNo) return 1;
    return 0;
  });
  CURRENT_QUOTE = {
    quoteId: String(quote.quoteId || fallbackQuoteId).trim(),
    quoteNo: String(quote.quoteNo || quote.quoteId || fallbackQuoteId).trim(),
    customerId: String(quote.customerId || '').trim(),
    customerName: String(quote.customerName || '').trim(),
    quoteType: normalizeQuoteType(quote.quoteType || quote.businessUnit),
    businessUnit: normalizeQuoteType(quote.quoteType || quote.businessUnit),
    shipping: Number(String(quote.shipping || 0).replace(/,/g, '')),
    specialDiscount: Number(String(quote.specialDiscount || 0).replace(/,/g, '')),
    status: String(quote.status || 'DRAFT').trim() || 'DRAFT'
  };
  setCurrentQuoteType(CURRENT_QUOTE.quoteType, true);
  CART.length = 0;
  lines.forEach(line => {
    const masterProduct = getProductById(line.productId || line.productCode || line.sku) || {};
    const masterListPrice = roundValue(toPriceNumber(line.masterListPrice !== undefined ? line.masterListPrice : (masterProduct.listPrice !== undefined ? masterProduct.listPrice : line.listPrice || 0)));
    const quotedListPrice = roundValue(toPriceNumber(line.quotedListPrice !== undefined ? line.quotedListPrice : (line.listPrice !== undefined ? line.listPrice : masterListPrice)));
    const masterUnit = sanitizeQuoteUnit(line.masterUnit || masterProduct.unit || line.unit || '');
    const quotedUnit = sanitizeQuoteUnit(line.quotedUnit || line.unit || masterUnit);
    CART.push(recalcLineItem({
      lineId: String(line.lineId || createLineId()),
      lineNo: String(line.lineNo || '').trim(),
      lineOrder: Number(String(line.lineOrder || line.sortOrder || line.lineNo || 0).replace(/,/g, '')) || 0,
      sortOrder: Number(String(line.sortOrder || line.lineOrder || line.lineNo || 0).replace(/,/g, '')) || 0,
      productId: String(line.productId || '').trim(),
      productCode: String(line.productCode || line.sku || line.productId || '').trim(),
      sku: String(line.sku || line.productCode || line.productId || '').trim(),
      productBusinessUnit: getProductBusinessUnitClient(line) || String(line.productBusinessUnit || line.businessUnit || '').trim(),
      businessUnit: getProductBusinessUnitClient(line) || String(line.productBusinessUnit || line.businessUnit || '').trim(),
      productName: String(line.productName || '').trim(),
      unit: quotedUnit,
      masterUnit: masterUnit,
      quotedUnit: quotedUnit,
      qty: Number(String(line.qty || 0).replace(/,/g, '')),
      sourceProductRecordKey: String(line.sourceProductRecordKey || line.productRecordKey || '').trim(),
      sourceProductIdentityKey: String(line.sourceProductIdentityKey || line.productIdentityKey || '').trim(),
      originalSelectedPrice: roundValue(toPriceNumber(line.originalSelectedPrice !== undefined ? line.originalSelectedPrice : masterListPrice)),
      originalSelectedUnit: sanitizeQuoteUnit(line.originalSelectedUnit || masterUnit),
      priceType: String(line.priceType || line.priceListType || '').trim(),
      priceList: String(line.priceList || line.priceListId || line.priceListName || '').trim(),
      promotionId: String(line.promotionId || line.promoId || line.promotionCode || '').trim(),
      priceSource: String(line.priceSource || line.priceListSource || line.promotionSource || '').trim(),
      masterListPrice: masterListPrice,
      quotedListPrice: quotedListPrice,
      listPrice: quotedListPrice,
      priceOverridden: Boolean(line.priceOverridden) || (masterListPrice > 0 && quotedListPrice > 0 && roundValue(masterListPrice) !== roundValue(quotedListPrice)) || (masterListPrice <= 0 && quotedListPrice > 0),
      unitOverridden: Boolean(line.unitOverridden) || (masterUnit && quotedUnit && normalizeProductReferenceForCompare(masterUnit) !== normalizeProductReferenceForCompare(quotedUnit)),
      overrideReason: String(line.overrideReason || '').trim(),
      updatedAt: String(line.updatedAt || '').trim(),
      updatedBy: String(line.updatedBy || '').trim(),
      discountPercent: Number(String(line.discountPercent || line.discount || 0).replace(/,/g, '')),
      unitPrice: roundValue(toPriceNumber(line.unitPrice || line.netPrice || 0)),
      lineTotal: roundValue(toPriceNumber(line.lineTotal || 0)),
      vat: roundValue(toPriceNumber(line.vat || 0)),
      grandTotal: roundValue(toPriceNumber(line.grandTotal || 0)),
      isFree: Boolean(line.isFreeItem || line.isFree || line.freeItem || String(line.free || '').toUpperCase() === 'FREE' || (toPriceNumber(line.listPrice || 0) > 0 && toPriceNumber(line.lineTotal || 0) === 0)),
      isFreeItem: Boolean(line.isFreeItem || line.isFree || line.freeItem || String(line.free || '').toUpperCase() === 'FREE' || (toPriceNumber(line.listPrice || 0) > 0 && toPriceNumber(line.lineTotal || 0) === 0)),
      status: String(line.status || 'ACTIVE')
    }));
  });
  ensureCartLineIdentityAndOrder();
  const hidden = document.getElementById('quoteCustomer');
  if (hidden) hidden.value = CURRENT_QUOTE.customerId;
  if (window.selectedCustomerId !== undefined) window.selectedCustomerId = CURRENT_QUOTE.customerId;
  const input = document.getElementById('quoteCustomerSearch');
  if (input) input.value = CURRENT_QUOTE.customerName || CURRENT_QUOTE.customerId;
  const shipping = document.getElementById('shipping');
  if (shipping) shipping.value = CURRENT_QUOTE.shipping;
  const specialDiscount = document.getElementById('specialDiscount');
  if (specialDiscount) specialDiscount.value = CURRENT_QUOTE.specialDiscount;
  renderQuoteMeta();
  renderCart();
}

function openQuotation(quoteId) {
  return loadQuotation(quoteId);
}

function quotePrintText(value, fallback) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  return text || fallback || '-';
}

function getQuotationPrintCompanyName(user) {
  if (typeof getSystemIdentitySettingsForUi === 'function') {
    const identity = getSystemIdentitySettingsForUi();
    if (identity && identity.companyName) return identity.companyName;
  }
  const settingsCompany = typeof DB !== 'undefined' && DB.settings ? DB.settings.companyName : '';
  return quotePrintText(settingsCompany, 'SAINT-GOBAIN');
}

function quotePrintNumber(value) {
  const numeric = Number(String(value === undefined || value === null ? 0 : value).replace(/,/g, ''));
  return isNaN(numeric) ? 0 : numeric;
}

function quotePrintMoney(value) {
  if (typeof money === 'function') {
    return money(quotePrintNumber(value));
  }
  return quotePrintNumber(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function quotePrintDate(value) {
  const date = value ? new Date(value) : new Date();
  if (isNaN(date.getTime())) {
    return quotePrintDate(new Date());
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function escapeQuotationPrintHtml(value) {
  return quotePrintText(value, '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function getQuotationPrintId(data) {
  const quote = data && data.quote ? data.quote : {};
  return quotePrintText(quote.quoteNo || quote.quoteId || CURRENT_QUOTE.quoteNo || CURRENT_QUOTE.quoteId, 'QT-PREVIEW');
}

function getCurrentQuotationPrintData() {
  const quote = Object.assign({}, CURRENT_QUOTE || {});
  const customer = typeof DB !== 'undefined' && DB.customers
    ? DB.customers.find(c => String(c.customerId || c.customerCode || '').trim() === String(quote.customerId || '').trim()) || {}
    : {};
  const lines = Array.isArray(CART) ? CART.map(item => recalcLineItem(Object.assign({}, item))) : [];
  const totals = calcCart();
  return {
    quote: Object.assign({}, quote, {
      quoteNo: quote.quoteNo || quote.quoteId || 'QT-PREVIEW',
      quoteType: normalizeQuoteType(quote.quoteType || quote.businessUnit || CURRENT_QUOTE_TYPE),
      businessUnit: normalizeQuoteType(quote.quoteType || quote.businessUnit || CURRENT_QUOTE_TYPE),
      customerId: quote.customerId || customer.customerId || customer.customerCode || '',
      customerName: quote.customerName || customer.customerName || '',
      createdAt: quote.createdAt || new Date().toISOString(),
      notes: quote.notes || quote.remark || ''
    }),
    lines: lines,
    totals: {
      subtotal: totals.subtotal,
      vat: totals.vat,
      shipping: totals.shipping,
      specialDiscount: totals.specialDiscount,
      grandTotal: totals.total
    }
  };
}

function buildQuotationPrintHtml(data) {
  const quote = data && data.quote ? data.quote : {};
  const lines = Array.isArray(data && data.lines) ? data.lines : [];
  const totals = data && data.totals ? data.totals : {};
  const subtotal = quotePrintNumber(totals.subtotal !== undefined ? totals.subtotal : quote.subtotal);
  const vat = quotePrintNumber(totals.vat !== undefined ? totals.vat : quote.vat);
  const grandTotal = quotePrintNumber(totals.grandTotal !== undefined ? totals.grandTotal : quote.grandTotal);
  const user = typeof USER !== 'undefined' && USER ? USER : {};
  const salesName = quotePrintText(quote.quoteDisplayName || quote.createdBy || user.quoteDisplayName || user.displayName || user.fullName || user.username, '-');
  const salesPosition = quotePrintText(user.jobTitle || user.position, '-');
  const companyName = getQuotationPrintCompanyName(user);
  const remark = quotePrintText(quote.notes || quote.remark || quote.remarks, '-');
  const quoteTypeLabel = getQuoteTypeLabel(quote.quoteType || quote.businessUnit || CURRENT_QUOTE.quoteType || CURRENT_QUOTE_TYPE);
  const lineBusinessUnits = [];
  lines.forEach(line => {
    const unit = getProductBusinessUnitClient(line);
    if (unit && lineBusinessUnits.indexOf(unit) < 0) lineBusinessUnits.push(unit);
  });
  const businessUnitsHtml = lineBusinessUnits.length > 1 ? `<p class="quote-business-units">Business Units: ${escapeQuotationPrintHtml(lineBusinessUnits.map(getQuoteTypeLabel).join(' / '))}</p>` : '';
  const rows = lines.length ? lines.map((line, index) => {
    const qty = quotePrintNumber(line.qty);
    const listPrice = quotePrintNumber(line.quotedListPrice !== undefined ? line.quotedListPrice : line.listPrice);
    const unitLabel = quotePrintText(line.quotedUnit || line.unit, '-');
    const discount = quotePrintNumber(line.discountPercent || line.discount);
    const isFree = Boolean(line.isFreeItem || line.isFree || line.freeItem || String(line.free || '').toUpperCase() === 'FREE' || (listPrice > 0 && quotePrintNumber(line.lineTotal || 0) === 0));
    const netPrice = isFree ? 0 : quotePrintNumber(line.unitPrice || line.netPrice || (listPrice * (1 - discount / 100)));
    const lineTotal = isFree ? 0 : quotePrintNumber(line.lineTotal || netPrice * qty);
    const freeText = isFree ? '<span class="print-free-badge">สินค้าโปรโมชั่นแถม</span>' : '';
    const sku = quotePrintText(line.sku || line.productId || line.productCode, '-');
    return `<tr class="print-page-break">
      <td class="num">${index + 1}</td>
      <td class="print-product-cell"><b class="product-name">${escapeQuotationPrintHtml(line.productName)}</b><span class="print-product-code">${escapeQuotationPrintHtml(sku)}</span>${freeText}</td>
      <td class="num">${quotePrintMoney(listPrice)}</td>
      <td class="num print-discount">${isFree ? 'แถม' : discount.toLocaleString('th-TH') + '%'}</td>
      <td class="num">${quotePrintMoney(netPrice)}</td>
      <td class="num">${qty.toLocaleString('th-TH')}</td>
      <td class="num">${escapeQuotationPrintHtml(unitLabel)}</td>
      <td class="num">${quotePrintMoney(lineTotal)}</td>
    </tr>`;
  }).join('') : '<tr><td class="print-empty" colspan="8">ไม่มีรายการสินค้า</td></tr>';

  return `<article class="print-sheet-inner">
    <header class="print-doc-header">
      <div class="print-doc-title">
        <h1>ใบเสนอราคา</h1>
        ${renderQuotationPrintBrandHtml(quote.quoteType || quote.businessUnit || CURRENT_QUOTE.quoteType || CURRENT_QUOTE_TYPE, quoteTypeLabel)}
        ${businessUnitsHtml}
      </div>
      <div class="print-doc-meta">
        <div><span>เลขที่ใบเสนอราคา</span><b>${escapeQuotationPrintHtml(getQuotationPrintId(data))}</b></div>
        <div><span>วันที่</span><b>${escapeQuotationPrintHtml(quotePrintDate(quote.createdAt || quote.updatedAt))}</b></div>
      </div>
    </header>
    <div class="print-divider"></div>
    <section class="print-party-grid">
      <div class="print-party-box">
        <span>เรียน</span>
        <b>${escapeQuotationPrintHtml(quote.customerName || CURRENT_QUOTE.customerName)}</b>
        <p>รหัสลูกค้า: ${escapeQuotationPrintHtml(quote.customerId || CURRENT_QUOTE.customerId)}</p>
      </div>
      <div class="print-party-box print-party-right">
        <span>ผู้เสนอราคา</span>
        <b>${escapeQuotationPrintHtml(salesName)}</b>
        <p>ตำแหน่ง: ${escapeQuotationPrintHtml(salesPosition)}</p>
        <p>บริษัท: ${escapeQuotationPrintHtml(companyName)}</p>
      </div>
    </section>
    <table class="print-table">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>สินค้า</th>
          <th class="num">ราคาตั้ง</th>
          <th class="num">ส่วนลด</th>
          <th class="num">ราคาสุทธิ</th>
          <th class="num">จำนวน</th>
          <th class="num">หน่วย</th>
          <th class="num">รวม</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <section class="quotation-lower-section print-summary">
      <div class="quotation-summary print-totals">
        <div class="print-total-row"><span>รวมก่อน VAT</span><b>${quotePrintMoney(subtotal)}</b></div>
        <div class="print-total-row"><span>VAT 7%</span><b>${quotePrintMoney(vat)}</b></div>
        <div class="print-total-row"><span>ยอดรวมสุทธิ</span><b>${quotePrintMoney(grandTotal)}</b></div>
      </div>
      <div class="quotation-remarks print-note"><b>หมายเหตุ</b><div>${escapeQuotationPrintHtml(remark)}</div></div>
    </section>
    <section class="print-signature"></section>
  </article>`;
}
function getQuotationPrintContext(data) {
  const quote = data && data.quote ? data.quote : {};
  const lines = Array.isArray(data && data.lines) ? data.lines : [];
  const totals = data && data.totals ? data.totals : {};
  const user = typeof USER !== 'undefined' && USER ? USER : {};
  const lineBusinessUnits = [];
  lines.forEach(line => {
    const unit = getProductBusinessUnitClient(line);
    if (unit && lineBusinessUnits.indexOf(unit) < 0) lineBusinessUnits.push(unit);
  });
  return {
    data: data || {},
    quote: quote,
    lines: lines,
    quoteNo: getQuotationPrintId(data || {}),
    quoteDate: quotePrintDate(quote.createdAt || quote.updatedAt),
    quoteType: normalizeQuoteType(quote.quoteType || quote.businessUnit || CURRENT_QUOTE.quoteType || CURRENT_QUOTE_TYPE),
    quoteTypeLabel: getQuoteTypeLabel(quote.quoteType || quote.businessUnit || CURRENT_QUOTE.quoteType || CURRENT_QUOTE_TYPE),
    lineBusinessUnits: lineBusinessUnits,
    businessUnitsLabel: lineBusinessUnits.length > 1 ? lineBusinessUnits.map(getQuoteTypeLabel).join(' / ') : '',
    customerName: quotePrintText(quote.customerName || CURRENT_QUOTE.customerName, '-'),
    customerId: quotePrintText(quote.customerId || CURRENT_QUOTE.customerId, '-'),
    salesName: quotePrintText(quote.quoteDisplayName || quote.createdBy || user.quoteDisplayName || user.displayName || user.fullName || user.username, '-'),
    salesPosition: quotePrintText(user.jobTitle || user.position, '-'),
    companyName: getQuotationPrintCompanyName(user),
    remark: quotePrintText(quote.notes || quote.remark || quote.remarks, '-'),
    subtotal: quotePrintNumber(totals.subtotal !== undefined ? totals.subtotal : quote.subtotal),
    vat: quotePrintNumber(totals.vat !== undefined ? totals.vat : quote.vat),
    grandTotal: quotePrintNumber(totals.grandTotal !== undefined ? totals.grandTotal : quote.grandTotal)
  };
}

function buildQuotationPrintRowHtml(line, index) {
  const item = line || {};
  const qty = quotePrintNumber(item.qty);
  const listPrice = quotePrintNumber(item.quotedListPrice !== undefined ? item.quotedListPrice : item.listPrice);
  const unitLabel = quotePrintText(item.quotedUnit || item.unit, '-');
  const discount = quotePrintNumber(item.discountPercent || item.discount);
  const isFree = Boolean(item.isFreeItem || item.isFree || item.freeItem || String(item.free || '').toUpperCase() === 'FREE' || (listPrice > 0 && quotePrintNumber(item.lineTotal || 0) === 0));
  const netPrice = isFree ? 0 : quotePrintNumber(item.unitPrice || item.netPrice || (listPrice * (1 - discount / 100)));
  const lineTotal = isFree ? 0 : quotePrintNumber(item.lineTotal || netPrice * qty);
  const freeText = isFree ? '<span class="print-free-badge">สินค้าโปรโมชั่นแถม</span>' : '';
  const sku = quotePrintText(item.sku || item.productId || item.productCode, '-');
  return `<tr class="quotation-item-row print-page-break">
    <td class="num">${index + 1}</td>
    <td class="print-product-cell"><b class="product-name">${escapeQuotationPrintHtml(item.productName || '-')}</b><span class="print-product-code">${escapeQuotationPrintHtml(sku)}</span>${freeText}</td>
    <td class="num">${quotePrintMoney(listPrice)}</td>
    <td class="num print-discount">${isFree ? 'แถม' : discount.toLocaleString('th-TH') + '%'}</td>
    <td class="num">${quotePrintMoney(netPrice)}</td>
    <td class="num">${qty.toLocaleString('th-TH')}</td>
    <td class="num">${escapeQuotationPrintHtml(unitLabel)}</td>
    <td class="num">${quotePrintMoney(lineTotal)}</td>
  </tr>`;
}

function buildQuotationEmptyRowHtml() {
  return '<tr class="quotation-item-row print-page-break"><td class="print-empty" colspan="8">ไม่มีรายการสินค้า</td></tr>';
}

function buildQuotationPrintTableHtml(rowsHtml) {
  return `<table class="print-table">
    <thead>
      <tr>
        <th class="num">#</th>
        <th>สินค้า</th>
        <th class="num">ราคาตั้ง</th>
        <th class="num">ส่วนลด</th>
        <th class="num">ราคาสุทธิ</th>
        <th class="num">จำนวน</th>
        <th class="num">หน่วย</th>
        <th class="num">รวม</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || ''}</tbody>
  </table>`;
}

function buildQuotationFullHeaderHtml(ctx) {
  const businessUnitsHtml = ctx.businessUnitsLabel ? `<p class="quote-business-units">Business Units: ${escapeQuotationPrintHtml(ctx.businessUnitsLabel)}</p>` : '';
  return `<header class="print-doc-header">
    <div class="print-doc-title">
      <h1>ใบเสนอราคา</h1>
      ${renderQuotationPrintBrandHtml(ctx.quoteType, ctx.quoteTypeLabel || 'Weber')}
      ${businessUnitsHtml}
    </div>
    <div class="print-doc-meta">
      <div><span>เลขที่ใบเสนอราคา</span><b>${escapeQuotationPrintHtml(ctx.quoteNo)}</b></div>
      <div><span>วันที่</span><b>${escapeQuotationPrintHtml(ctx.quoteDate)}</b></div>
    </div>
  </header>
  <div class="print-divider"></div>
  <section class="print-party-grid">
    <div class="print-party-box">
      <span>เรียน</span>
      <b>${escapeQuotationPrintHtml(ctx.customerName)}</b>
      <p>รหัสลูกค้า: ${escapeQuotationPrintHtml(ctx.customerId)}</p>
    </div>
    <div class="print-party-box print-party-right">
      <span>ผู้เสนอราคา</span>
      <b>${escapeQuotationPrintHtml(ctx.salesName)}</b>
      <p>ตำแหน่ง: ${escapeQuotationPrintHtml(ctx.salesPosition)}</p>
      <p>บริษัท: ${escapeQuotationPrintHtml(ctx.companyName)}</p>
    </div>
  </section>`;
}

function buildQuotationContinuedHeaderHtml(ctx) {
  return `<header class="print-doc-header print-doc-header--continued">
    <div class="print-doc-title">
      <h2>ใบเสนอราคา</h2>
      <p>ต่อหน้า</p>
    </div>
    <div class="print-doc-meta">
      <div><span>เลขที่ใบเสนอราคา</span><b>${escapeQuotationPrintHtml(ctx.quoteNo)}</b></div>
      <div><span>วันที่</span><b>${escapeQuotationPrintHtml(ctx.quoteDate)}</b></div>
    </div>
  </header>
  <div class="print-divider print-divider--continued"></div>`;
}

function buildQuotationLowerSectionHtml(ctx) {
  return `<section class="quotation-lower-section print-summary">
    <div class="quotation-summary print-totals">
      <div class="print-total-row"><span>รวมก่อน VAT</span><b>${quotePrintMoney(ctx.subtotal)}</b></div>
      <div class="print-total-row"><span>VAT 7%</span><b>${quotePrintMoney(ctx.vat)}</b></div>
      <div class="print-total-row"><span>ยอดรวมสุทธิ</span><b>${quotePrintMoney(ctx.grandTotal)}</b></div>
    </div>
    <div class="quotation-remarks print-note"><b>หมายเหตุ</b><div>${escapeQuotationPrintHtml(ctx.remark)}</div></div>
  </section>
  <section class="print-signature"></section>`;
}

function buildQuotationPageHtml(ctx, rowsHtml, pageIndex, totalPages, options) {
  const opts = options || {};
  const classes = ['quotation-page'];
  if (opts.first) classes.push('quotation-page--first');
  if (!opts.first) classes.push('quotation-page--continued');
  if (opts.last) classes.push('quotation-page--last');
  return `<article class="${classes.join(' ')}">
    <div class="quotation-page-content">
      ${opts.first ? buildQuotationFullHeaderHtml(ctx) : buildQuotationContinuedHeaderHtml(ctx)}
      ${buildQuotationPrintTableHtml(rowsHtml)}
      ${opts.last ? buildQuotationLowerSectionHtml(ctx) : ''}
    </div>
    <div class="quotation-page-number">หน้า ${pageIndex + 1} / ${totalPages}</div>
  </article>`;
}

function measureQuotationPrintLayout(ctx, rowHtmlList) {
  if (!document || !document.body) {
    return null;
  }
  const measurement = document.createElement('div');
  measurement.className = 'quotation-measurement';
  measurement.innerHTML = `
    <div class="quotation-page quotation-page--first quotation-page--measure">
      <div class="quotation-page-content quotation-measure-first">
        ${buildQuotationFullHeaderHtml(ctx)}
        ${buildQuotationPrintTableHtml(rowHtmlList.join(''))}
      </div>
    </div>
    <div class="quotation-page quotation-page--continued quotation-page--measure">
      <div class="quotation-page-content quotation-measure-continued">
        ${buildQuotationContinuedHeaderHtml(ctx)}
        ${buildQuotationPrintTableHtml('')}
      </div>
    </div>
    <div class="quotation-page quotation-page--last quotation-page--measure">
      <div class="quotation-page-content quotation-measure-lower">
        ${buildQuotationLowerSectionHtml(ctx)}
      </div>
    </div>`;
  document.body.appendChild(measurement);
  try {
    const firstContent = measurement.querySelector('.quotation-measure-first');
    const continuedContent = measurement.querySelector('.quotation-measure-continued');
    const lowerSection = measurement.querySelector('.quotation-measure-lower .quotation-lower-section');
    const firstTable = firstContent ? firstContent.querySelector('.print-table') : null;
    const continuedTable = continuedContent ? continuedContent.querySelector('.print-table') : null;
    const firstThead = firstTable ? firstTable.querySelector('thead') : null;
    const continuedThead = continuedTable ? continuedTable.querySelector('thead') : null;
    const rowNodes = Array.prototype.slice.call(measurement.querySelectorAll('.quotation-measure-first tbody tr'));
    const pageContentHeight = firstContent ? firstContent.clientHeight : 980;
    const firstHeaderHeight = firstTable && firstContent && firstThead
      ? (firstTable.getBoundingClientRect().top - firstContent.getBoundingClientRect().top) + firstThead.getBoundingClientRect().height
      : 360;
    const continuedHeaderHeight = continuedTable && continuedContent && continuedThead
      ? (continuedTable.getBoundingClientRect().top - continuedContent.getBoundingClientRect().top) + continuedThead.getBoundingClientRect().height
      : 105;
    const lowerHeight = lowerSection ? lowerSection.getBoundingClientRect().height + 20 : 230;
    return {
      pageContentHeight: pageContentHeight,
      firstHeaderHeight: firstHeaderHeight,
      continuedHeaderHeight: continuedHeaderHeight,
      lowerHeight: lowerHeight,
      rowHeights: rowNodes.map(node => Math.ceil(node.getBoundingClientRect().height || node.offsetHeight || 44))
    };
  } finally {
    measurement.remove();
  }
}

function paginateQuotationPrintRows(ctx) {
  const rows = ctx.lines.length
    ? ctx.lines.map((line, index) => ({ html: buildQuotationPrintRowHtml(line, index), index: index }))
    : [{ html: buildQuotationEmptyRowHtml(), index: 0 }];
  const layout = measureQuotationPrintLayout(ctx, rows.map(row => row.html)) || {};
  const rowHeights = layout.rowHeights && layout.rowHeights.length === rows.length
    ? layout.rowHeights
    : rows.map(() => 46);
  const pageContentHeight = layout.pageContentHeight || 980;
  const firstHeaderHeight = layout.firstHeaderHeight || 360;
  const continuedHeaderHeight = layout.continuedHeaderHeight || 105;
  const lowerHeight = layout.lowerHeight || 230;
  const pageNumberReserve = 26;
  const pages = [];
  let cursor = 0;

  while (cursor < rows.length) {
    const isFirstPage = pages.length === 0;
    const headerHeight = isFirstPage ? firstHeaderHeight : continuedHeaderHeight;
    const availableWithoutLower = Math.max(80, pageContentHeight - headerHeight - pageNumberReserve);
    let remainingHeight = 0;
    for (let i = cursor; i < rows.length; i += 1) {
      remainingHeight += rowHeights[i] || 46;
    }

    if (remainingHeight + lowerHeight <= availableWithoutLower) {
      pages.push({ rows: rows.slice(cursor), first: isFirstPage, last: true });
      cursor = rows.length;
      break;
    }

    const pageRows = [];
    let usedHeight = 0;
    while (cursor < rows.length) {
      const rowHeight = rowHeights[cursor] || 46;
      if (pageRows.length && usedHeight + rowHeight > availableWithoutLower) {
        break;
      }
      pageRows.push(rows[cursor]);
      usedHeight += rowHeight;
      cursor += 1;
      if (usedHeight >= availableWithoutLower) {
        break;
      }
    }
    if (!pageRows.length && cursor < rows.length) {
      pageRows.push(rows[cursor]);
      cursor += 1;
    }
    pages.push({ rows: pageRows, first: isFirstPage, last: false });
  }

  if (!pages.length) {
    pages.push({ rows: rows, first: true, last: true });
  }
  pages[pages.length - 1].last = true;
  return pages;
}

function buildQuotationPrintHtmlPaginated(data) {
  const ctx = getQuotationPrintContext(data);
  const pages = paginateQuotationPrintRows(ctx);
  const totalPages = pages.length;
  return pages.map((page, index) => {
    const rowsHtml = page.rows.map(row => row.html).join('');
    return buildQuotationPageHtml(ctx, rowsHtml, index, totalPages, {
      first: index === 0,
      last: index === totalPages - 1
    });
  }).join('');
}

function waitForQuotationPrintImages(documentNode) {
  const root = documentNode && typeof documentNode.querySelectorAll === 'function' ? documentNode : null;
  if (!root) {
    return Promise.resolve();
  }
  const images = Array.prototype.slice.call(root.querySelectorAll('img.quote-print-brand-logo'));
  if (!images.length) {
    return Promise.resolve();
  }
  return Promise.all(images.map(image => new Promise(resolve => {
    if (image.complete) {
      if (image.naturalWidth > 0) {
        handleQuoteBrandLogoLoad(image);
      } else {
        handleQuoteBrandLogoError(image);
      }
      resolve();
      return;
    }
    const done = function () {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      resolve();
    };
    const onLoad = function () {
      handleQuoteBrandLogoLoad(image);
      done();
    };
    const onError = function () {
      handleQuoteBrandLogoError(image);
      done();
    };
    image.addEventListener('load', onLoad, { once: true });
    image.addEventListener('error', onError, { once: true });
    setTimeout(done, 1500);
  }))).then(() => undefined);
}

async function prepareQuotationPrintPreview(quoteId, showPreview) {
  const id = String(quoteId || '').trim();
  let response = null;
  let printData = getCurrentQuotationPrintData();
  if (id && id !== 'QT-PREVIEW') {
    response = await loadQuotation(id);
    if (response && response.ok) {
      printData = response.data || printData;
    } else if (!CART.length) {
      toast(response && response.message ? response.message : 'โหลดใบเสนอราคาไม่สำเร็จ');
      return null;
    }
  }
  const preview = document.getElementById('quotationPrintPreview');
  const documentNode = document.getElementById('printQuotationSheet');
  if (!preview || !documentNode) {
    toast('ไม่พบพื้นที่ Print Preview');
    return null;
  }
  toast('กำลังจัดหน้าเอกสาร...');
  documentNode.innerHTML = buildQuotationPrintHtmlPaginated(printData || {});
  documentNode.dataset.quoteNo = getQuotationPrintId(printData || {});
  await waitForQuotationPrintImages(documentNode);
  preview.classList.toggle('hidden', !showPreview);
  preview.classList.toggle('is-open', Boolean(showPreview));
  document.body.classList.toggle('print-preview-open', Boolean(showPreview));
  return { response: response || { ok: true, data: printData, message: '' }, preview, documentNode };
}

async function printQuotation(quoteId) {
  const prepared = await prepareQuotationPrintPreview(quoteId, true);
  return prepared ? prepared.response : null;
}

async function printQuotationSheet(quoteId) {
  const preview = document.getElementById('quotationPrintPreview');
  const currentDocument = document.getElementById('printQuotationSheet');
  const hasOpenPreview = preview && preview.classList.contains('is-open') && currentDocument && currentDocument.innerHTML.trim();
  const prepared = quoteId || !hasOpenPreview ? await prepareQuotationPrintPreview(quoteId, true) : { response: { ok: true }, preview, documentNode: currentDocument };
  if (!prepared) return null;
  setTimeout(() => window.print(), 50);
  return prepared.response;
}

function closeQuotationPrintPreview() {
  const preview = document.getElementById('quotationPrintPreview');
  if (preview) {
    preview.classList.add('hidden');
    preview.classList.remove('is-open');
  }
  document.body.classList.remove('print-preview-open');
}

async function exportQuotationPNG(quoteId) {
  const preview = document.getElementById('quotationPrintPreview');
  const currentDocument = document.getElementById('printQuotationSheet');
  const hasPreview = currentDocument && currentDocument.innerHTML.trim();
  const previewOpen = preview && preview.classList.contains('is-open');
  const prepared = quoteId || !hasPreview || !previewOpen ? await prepareQuotationPrintPreview(quoteId, true) : { preview, documentNode: currentDocument };
  if (!prepared || !prepared.documentNode) {
    return null;
  }
  if (typeof html2canvas !== 'function') {
    toast('ไม่พบ html2canvas สำหรับ Save PNG');
    return null;
  }
  toast('กำลังสร้าง PNG...');
  const canvas = await captureQuotationSheet(prepared.documentNode);
  const link = document.createElement('a');
  const rawName = prepared.documentNode.dataset.quoteNo || 'QT-PREVIEW';
  const safeName = rawName.replace(/[^A-Za-z0-9_-]/g, '-');
  link.download = (safeName.indexOf('QT-') === 0 ? safeName : 'QT-' + safeName) + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  toast('บันทึก PNG แล้ว');
  return canvas;
}

async function captureQuotationSheet(documentNode) {
  const previousTransform = documentNode.style.transform;
  const previousTransformOrigin = documentNode.style.transformOrigin;
  const previousWidth = documentNode.style.width;
  const previousHeight = documentNode.style.height;
  const previousMinHeight = documentNode.style.minHeight;
  const previousTransformPriority = documentNode.style.getPropertyPriority('transform');
  const previousTransformOriginPriority = documentNode.style.getPropertyPriority('transform-origin');
  const previousWidthPriority = documentNode.style.getPropertyPriority('width');
  const previousHeightPriority = documentNode.style.getPropertyPriority('height');
  const previousMinHeightPriority = documentNode.style.getPropertyPriority('min-height');
  documentNode.style.setProperty('transform', 'none', 'important');
  documentNode.style.setProperty('transform-origin', 'top left', 'important');
  documentNode.style.setProperty('width', '210mm', 'important');
  documentNode.style.setProperty('height', '297mm', 'important');
  documentNode.style.setProperty('min-height', '297mm', 'important');
  try {
    await waitForQuotationPrintImages(documentNode);
    return await html2canvas(documentNode, {
      scale: 3,
      backgroundColor: '#ffffff',
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: documentNode.scrollWidth,
      windowHeight: documentNode.scrollHeight
    });
  } finally {
    documentNode.style.setProperty('transform', previousTransform, previousTransformPriority);
    documentNode.style.setProperty('transform-origin', previousTransformOrigin, previousTransformOriginPriority);
    documentNode.style.setProperty('width', previousWidth, previousWidthPriority);
    documentNode.style.setProperty('height', previousHeight, previousHeightPriority);
    documentNode.style.setProperty('min-height', previousMinHeight, previousMinHeightPriority);
  }
}

async function saveQuotationPng(quoteId) {
  return exportQuotationPNG(quoteId);
}

async function saveQuotationPdf(quoteId) {
  const preview = document.getElementById('quotationPrintPreview');
  const currentDocument = document.getElementById('printQuotationSheet');
  const hasPreview = currentDocument && currentDocument.innerHTML.trim();
  const previewOpen = preview && preview.classList.contains('is-open');
  const prepared = quoteId || !hasPreview || !previewOpen ? await prepareQuotationPrintPreview(quoteId, true) : { preview, documentNode: currentDocument };
  if (!prepared || !prepared.documentNode) {
    return null;
  }
  if (typeof html2canvas !== 'function') {
    toast('ไม่พบ html2canvas สำหรับ Save PDF');
    return null;
  }
  const jsPdfFactory = window.jspdf && window.jspdf.jsPDF;
  if (typeof jsPdfFactory !== 'function') {
    toast('ไม่พบ jsPDF สำหรับ Save PDF');
    return null;
  }
  toast('กำลังสร้าง PDF...');
  const canvas = await captureQuotationSheet(prepared.documentNode);
  const pdf = new jsPdfFactory({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
  const rawName = prepared.documentNode.dataset.quoteNo || 'QT-PREVIEW';
  const safeName = rawName.replace(/[^A-Za-z0-9_-]/g, '-');
  pdf.save((safeName.indexOf('QT-') === 0 ? safeName : 'QT-' + safeName) + '.pdf');
  toast('บันทึก PDF แล้ว');
  return pdf;
}

function getQuotationExportFileName(documentNode) {
  const rawName = documentNode && documentNode.dataset ? documentNode.dataset.quoteNo || 'QT-PREVIEW' : 'QT-PREVIEW';
  const safeName = String(rawName || 'QT-PREVIEW').replace(/[^A-Za-z0-9_-]/g, '-');
  return (safeName.indexOf('QT-') === 0 ? safeName : 'QT-' + safeName) + '.png';
}

function downloadQuotationCanvas(canvas, fileName) {
  const link = document.createElement('a');
  link.download = fileName || 'QT-PREVIEW.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function quotationCanvasToBlob(canvas) {
  return new Promise(resolve => {
    if (!canvas || typeof canvas.toBlob !== 'function') {
      resolve(null);
      return;
    }
    canvas.toBlob(blob => resolve(blob), 'image/png');
  });
}

function getQuotationShareText(printData, documentNode) {
  const data = printData || {};
  const quote = data.quote || {};
  const totals = data.totals || {};
  const quoteNo = (documentNode && documentNode.dataset && documentNode.dataset.quoteNo) || quote.quoteNo || quote.quoteId || CURRENT_QUOTE.quoteNo || CURRENT_QUOTE.quoteId || 'QT-PREVIEW';
  const customerName = quote.customerName || CURRENT_QUOTE.customerName || '-';
  const grandTotal = totals.grandTotal ?? quote.grandTotal ?? quote.total ?? calcCart().total ?? 0;
  return `ใบเสนอราคา: ${quoteNo}
ร้านค้า: ${customerName || '-'}
ยอดรวมสุทธิ: ${money(grandTotal)} บาท

สร้างโดย Saint-Gobain Sales System`;
}

async function copyQuotationShareText(text) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.warn('Clipboard API failed, using fallback', error);
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch (error) {
    console.warn('Clipboard fallback failed', error);
    return false;
  }
}

async function shareQuote(quoteId) {
  const preview = document.getElementById('quotationPrintPreview');
  const currentDocument = document.getElementById('printQuotationSheet');
  const hasPreview = currentDocument && currentDocument.innerHTML.trim();
  const previewOpen = preview && preview.classList.contains('is-open');
  const prepared = quoteId || !hasPreview || !previewOpen
    ? await prepareQuotationPrintPreview(quoteId, true)
    : { preview, documentNode: currentDocument, response: { ok: true, data: getCurrentQuotationPrintData() } };
  if (!prepared || !prepared.documentNode) {
    return null;
  }
  if (typeof html2canvas !== 'function') {
    toast('ไม่พบ html2canvas สำหรับ Share');
    return null;
  }

  toast('กำลังสร้างรูปสำหรับแชร์...');
  const canvas = await captureQuotationSheet(prepared.documentNode);
  const fileName = getQuotationExportFileName(prepared.documentNode);
  const printData = prepared.response && prepared.response.data ? prepared.response.data : getCurrentQuotationPrintData();
  const shareText = getQuotationShareText(printData, prepared.documentNode);
  const blob = await quotationCanvasToBlob(canvas);

  if (blob && typeof File === 'function' && navigator.share && navigator.canShare) {
    const file = new File([blob], fileName, { type: 'image/png' });
    const shareData = {
      title: fileName.replace(/\.png$/i, ''),
      text: shareText,
      files: [file]
    };
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share(shareData);
        toast('เปิด Share Sheet แล้ว');
        return { ok: true, shared: true };
      }
    } catch (error) {
      console.warn('Native file share failed, using fallback', error);
    }
  }

  downloadQuotationCanvas(canvas, fileName);
  await copyQuotationShareText(shareText);
  toast('บันทึกรูปแล้ว กรุณาเลือกส่งผ่าน LINE');
  return { ok: true, shared: false };
}

function getQuotationPrintPages(documentNode) {
  if (!documentNode) {
    return [];
  }
  const pages = Array.prototype.slice.call(documentNode.querySelectorAll('.quotation-page'));
  return pages.length ? pages : [documentNode];
}

function getQuotationExportBaseName(documentNode) {
  const rawName = documentNode && documentNode.dataset ? documentNode.dataset.quoteNo || 'QT-PREVIEW' : 'QT-PREVIEW';
  const safeName = String(rawName || 'QT-PREVIEW').replace(/[^A-Za-z0-9_-]/g, '-');
  return safeName.indexOf('QT-') === 0 ? safeName : 'QT-' + safeName;
}

function getQuotationExportFileName(documentNode, pageIndex, pageCount) {
  const baseName = getQuotationExportBaseName(documentNode);
  return pageCount && pageCount > 1 ? `${baseName}-page${(pageIndex || 0) + 1}.png` : `${baseName}.png`;
}

async function exportQuotationPNG(quoteId) {
  const preview = document.getElementById('quotationPrintPreview');
  const currentDocument = document.getElementById('printQuotationSheet');
  const hasPreview = currentDocument && currentDocument.innerHTML.trim();
  const previewOpen = preview && preview.classList.contains('is-open');
  const prepared = quoteId || !hasPreview || !previewOpen ? await prepareQuotationPrintPreview(quoteId, true) : { preview, documentNode: currentDocument };
  if (!prepared || !prepared.documentNode) {
    return null;
  }
  if (typeof html2canvas !== 'function') {
    toast('ไม่พบ html2canvas สำหรับ Save PNG');
    return null;
  }
  const pages = getQuotationPrintPages(prepared.documentNode);
  const canvases = [];
  for (let i = 0; i < pages.length; i += 1) {
    toast(`กำลังสร้างรูปหน้า ${i + 1}/${pages.length}...`);
    const canvas = await captureQuotationSheet(pages[i]);
    canvases.push(canvas);
    downloadQuotationCanvas(canvas, getQuotationExportFileName(prepared.documentNode, i, pages.length));
  }
  toast(pages.length > 1 ? 'บันทึกรูปใบเสนอราคาครบทุกหน้าแล้ว' : 'บันทึก PNG แล้ว');
  return canvases.length === 1 ? canvases[0] : canvases;
}

async function saveQuotationPdf(quoteId) {
  const preview = document.getElementById('quotationPrintPreview');
  const currentDocument = document.getElementById('printQuotationSheet');
  const hasPreview = currentDocument && currentDocument.innerHTML.trim();
  const previewOpen = preview && preview.classList.contains('is-open');
  const prepared = quoteId || !hasPreview || !previewOpen ? await prepareQuotationPrintPreview(quoteId, true) : { preview, documentNode: currentDocument };
  if (!prepared || !prepared.documentNode) {
    return null;
  }
  if (typeof html2canvas !== 'function') {
    toast('ไม่พบ html2canvas สำหรับ Save PDF');
    return null;
  }
  const jsPdfFactory = window.jspdf && window.jspdf.jsPDF;
  if (typeof jsPdfFactory !== 'function') {
    toast('ไม่พบ jsPDF สำหรับ Save PDF');
    return null;
  }
  const pages = getQuotationPrintPages(prepared.documentNode);
  const pdf = new jsPdfFactory({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  for (let i = 0; i < pages.length; i += 1) {
    toast(`กำลังสร้างรูปหน้า ${i + 1}/${pages.length}...`);
    const canvas = await captureQuotationSheet(pages[i]);
    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
  }
  pdf.save(`${getQuotationExportBaseName(prepared.documentNode)}.pdf`);
  toast('บันทึก PDF แล้ว');
  return pdf;
}

async function shareQuote(quoteId) {
  const preview = document.getElementById('quotationPrintPreview');
  const currentDocument = document.getElementById('printQuotationSheet');
  const hasPreview = currentDocument && currentDocument.innerHTML.trim();
  const previewOpen = preview && preview.classList.contains('is-open');
  const prepared = quoteId || !hasPreview || !previewOpen
    ? await prepareQuotationPrintPreview(quoteId, true)
    : { preview, documentNode: currentDocument, response: { ok: true, data: getCurrentQuotationPrintData() } };
  if (!prepared || !prepared.documentNode) {
    return null;
  }
  if (typeof html2canvas !== 'function') {
    toast('ไม่พบ html2canvas สำหรับ Share');
    return null;
  }

  const pages = getQuotationPrintPages(prepared.documentNode);
  const printData = prepared.response && prepared.response.data ? prepared.response.data : getCurrentQuotationPrintData();
  const shareText = getQuotationShareText(printData, prepared.documentNode);
  const files = [];
  const canvases = [];

  for (let i = 0; i < pages.length; i += 1) {
    toast(`กำลังสร้างรูปหน้า ${i + 1}/${pages.length}...`);
    const canvas = await captureQuotationSheet(pages[i]);
    canvases.push(canvas);
    const blob = await quotationCanvasToBlob(canvas);
    if (blob && typeof File === 'function') {
      files.push(new File([blob], getQuotationExportFileName(prepared.documentNode, i, pages.length), { type: 'image/png' }));
    }
  }

  if (files.length && navigator.share && navigator.canShare) {
    const shareData = {
      title: getQuotationExportBaseName(prepared.documentNode),
      text: shareText,
      files: files
    };
    try {
      if (navigator.canShare({ files: files })) {
        await navigator.share(shareData);
        toast('เปิด Share Sheet แล้ว');
        return { ok: true, shared: true, files: files.length };
      }
    } catch (error) {
      console.warn('Native file share failed, using fallback', error);
    }
  }

  canvases.forEach((canvas, index) => {
    downloadQuotationCanvas(canvas, getQuotationExportFileName(prepared.documentNode, index, canvases.length));
  });
  await copyQuotationShareText(shareText);
  toast(canvases.length > 1 ? 'บันทึกรูปใบเสนอราคาครบทุกหน้าแล้ว กรุณาเลือกส่งผ่าน LINE' : 'บันทึกรูปแล้ว กรุณาเลือกส่งผ่าน LINE');
  return { ok: true, shared: false, files: canvases.length };
}

function getQuotationShareText(printData, documentNode) {
  const data = printData || {};
  const quote = data.quote || {};
  const totals = data.totals || {};
  const quoteNo = (documentNode && documentNode.dataset && documentNode.dataset.quoteNo) || quote.quoteNo || quote.quoteId || CURRENT_QUOTE.quoteNo || CURRENT_QUOTE.quoteId || 'QT-PREVIEW';
  const customerName = quote.customerName || CURRENT_QUOTE.customerName || '-';
  const grandTotal = totals.grandTotal ?? quote.grandTotal ?? quote.total ?? calcCart().total ?? 0;
  return `ใบเสนอราคา: ${quoteNo}
ร้านค้า: ${customerName || '-'}
ยอดรวมสุทธิ: ${money(grandTotal)} บาท

สร้างโดย Saint-Gobain Sales System`;
}

async function duplicateCurrentQuotation() {
  const id = String(CURRENT_QUOTE.quoteId || '').trim();
  if (!id) {
    toast('ต้องเปิดใบเสนอราคาก่อน Duplicate');
    return;
  }
  const response = await duplicateQuotation(id);
  if (response && response.ok) {
    toast('สร้างสำเนาใบเสนอราคาแล้ว');
  }
  return response;
}

async function cancelCurrentQuotation() {
  const id = String(CURRENT_QUOTE.quoteId || '').trim();
  if (!id) {
    toast('ต้องเปิดใบเสนอราคาก่อน Cancel');
    return;
  }
  const response = await cancelQuotation(id);
  if (response && response.ok) {
    CURRENT_QUOTE.status = 'CANCELLED';
    renderQuoteMeta();
  }
  return response;
}

async function cancelQuotation(quoteId) {
  const id = String(quoteId || CURRENT_QUOTE.quoteId || '').trim();
  if (!id) {
    toast('ต้องระบุเลขที่ใบเสนอราคา');
    return;
  }
  toast('กำลังบันทึก...');
  const response = await callApi('cancelQuotation', { quoteId: id });
  toast(response.message || (response.ok ? 'ยกเลิกใบเสนอราคาแล้ว' : 'ยกเลิกไม่สำเร็จ'));
  if (response.ok) {
    if (CURRENT_QUOTE.quoteId === id) {
      CURRENT_QUOTE.status = 'CANCELLED';
      renderQuoteMeta();
    }
    if (typeof clearQuotationCache === 'function') {
      clearQuotationCache(id);
    }
    clearLoadedQuotationCache(id);
    if (typeof clearCache === 'function') {
      clearCache('sg_quote_history_cache');
    }
    if (typeof refreshQuotationHistory === 'function') {
      await refreshQuotationHistory({force:true});
    }
  }
  return response;
}

const baseRenderQuote = renderQuote;
renderQuote = function () {
  baseRenderQuote();
  renderQuoteMeta();
};

function renderCart() {
  const cartList = document.getElementById('cartList');
  if (!cartList) {
    calcCart();
    return;
  }
  CART.forEach(recalcLineItem);
  const showReorderHint = CART.length > 1 && (() => {
    try { return localStorage.getItem('sg_quote_reorder_hint_seen') !== 'true'; } catch (error) { return true; }
  })();
  const reorderHint = showReorderHint ? '<div class="quote-reorder-hint">กดค้างที่การ์ดแล้วลากเพื่อเรียงสินค้า</div>' : '';
  cartList.innerHTML = CART.length ? reorderHint + CART.map(it => {
    syncQuoteLineSnapshot(it);
    const canEditSnapshots = canEditQuoteLineSnapshots();
    const editDisabledAttr = canEditSnapshots ? '' : ' disabled aria-disabled="true"';
    const discountText = it.discountLoading
      ? '<span class="loading-text">กำลังโหลดส่วนลด...</span>'
      : it.isFree
        ? '<span>แถม</span>'
      : `<input class="quote-discount-input" type="number" value="${it.discountPercent || 0}"${editDisabledAttr} onchange="changeDiscount('${it.lineId}', Number(this.value))"> %`;
    const freeBadge = it.isFree ? '<span class="pill yellow">FREE</span>' : '';
    const priceOverrideBadge = it.priceOverridden ? '<span class="quote-line-override-badge" title="ราคานี้ใช้เฉพาะใบเสนอราคานี้">แก้ไขแล้ว</span>' : '';
    const unitOverrideBadge = it.unitOverridden ? '<span class="quote-line-override-badge" title="หน่วยนี้ใช้เฉพาะใบเสนอราคานี้">แก้ไขแล้ว</span>' : '';
    const unitOptions = getQuoteUnitOptionsForLine(it).map(unit => `<option value="${escapeQuotationPrintHtml(unit)}" ${sanitizeQuoteUnit(it.quotedUnit || it.unit) === unit ? 'selected' : ''}>${escapeQuotationPrintHtml(unit)}</option>`).join('');
    const productUnit = getProductBusinessUnitClient(it);
    const productBuBadge = productUnit ? `<span class="quote-product-bu ${getQuoteTypeClass(productUnit)}">${getQuoteTypeLabel(productUnit)}</span>` : '';
    const crossBuNote = productUnit && productUnit !== getCurrentQuoteBusinessUnit() ? '<small class="quote-cross-bu-note">สินค้าร่วมข้าม BU</small>' : '';
    return `<div class="row item-card quote-line quote-item-card" data-line-id="${it.lineId}" role="listitem" tabindex="0" aria-label="กดค้างแล้วลากเพื่อเรียงสินค้า หรือกด Alt พร้อมลูกศรขึ้นลง" title="กดค้างแล้วลากเพื่อเรียงสินค้า">
      <div class="quote-line-main">
        <div class="quote-product-title">${productBuBadge}<b>${it.productName || '-'} ${freeBadge}</b>${crossBuNote}</div>
        <small>${it.productId || ''}${it.unit ? ' · ' + it.unit : ''}</small>
        <div class="quote-line-prices">
          <span data-no-drag>ราคาตั้ง ${money(it.listPrice)} ${priceOverrideBadge}<button type="button" class="quote-line-mini-action" onclick="openQuoteLinePriceEditor('${it.lineId}')" title="แก้ไขราคาตั้ง"${editDisabledAttr}>แก้ไข</button></span>
          <span data-no-drag>ส่วนลด ${discountText}</span>
          <span>ราคาสุทธิ ${it.isFree ? 'FREE' : money(it.unitPrice)}</span>
          <span>รวม ${it.isFree ? 'FREE' : money(it.lineTotal)}</span>
          <label class="quote-line-unit-editor" data-no-drag>หน่วย <select${editDisabledAttr} onchange="changeQuoteLineUnit('${it.lineId}', this.value)">${unitOptions}</select>${unitOverrideBadge}</label>
          <label class="free-item-toggle" data-no-drag><input type="checkbox" ${it.isFree ? 'checked' : ''}${editDisabledAttr} onchange="toggleFreeItem('${it.lineId}', this.checked)"> สินค้าแถม</label>
        </div>
      </div>
      <div class="qty quote-qty-control" data-no-drag>
        <button onclick="changeQty('${it.lineId}', ${Number(it.qty) - 1})">−</button>
        <input type="number" min="1" value="${Number(it.qty) || 1}" onchange="changeQty('${it.lineId}', this.value)">
        <button onclick="changeQty('${it.lineId}', ${Number(it.qty) + 1})">+</button>
      </div>
      <button class="ghost quote-item-delete" data-no-drag onclick="removeProduct('${it.lineId}')">ลบ</button>
    </div>`;
  }).join('') : '<p style="color:var(--muted)">ยังไม่มีสินค้า</p>';
  calcCart();
  setupCartReorder();
}

function quoteNextAnimationFrame() {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise(resolve => requestAnimationFrame(resolve));
  }
  return Promise.resolve();
}

function getProductSearchInput() {
  return document.querySelector('[data-role="quotation-product-search"]') || document.getElementById('productSearch');
}

function getProductSearchSection(input) {
  const source = input || getProductSearchInput();
  return document.querySelector('[data-role="quotation-product-search-section"]')
    || document.getElementById('quotationProductSearchSection')
    || (source && source.closest ? source.closest('.card') : null)
    || source;
}

function getProductSearchScrollTarget(input) {
  const source = input || getProductSearchInput();
  return source && source.closest ? source.closest('.quote-product-search-field') || source : source;
}

function isDevelopmentHost() {
  const host = String(window.location && window.location.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '';
}

function showProductSearchNavigationToast(message) {
  if (typeof toast === 'function') {
    toast(message);
    return;
  }
  const element = document.getElementById('toast');
  if (element) {
    element.textContent = message;
    element.classList.add('show');
  }
}

async function waitForProductSearchInput(maxAttempts) {
  const attempts = Math.max(1, Math.min(Number(maxAttempts || 3), 3));
  for (let index = 0; index < attempts; index += 1) {
    const input = getProductSearchInput();
    if (input) {
      return input;
    }
    await quoteNextAnimationFrame();
  }
  return getProductSearchInput();
}

async function ensureProductSearchVisible() {
  const section = getProductSearchSection();
  if (section && section.classList) {
    section.classList.remove('hidden', 'is-hidden', 'is-collapsed', 'collapsed');
    section.removeAttribute('hidden');
    if (section.getAttribute('aria-hidden') === 'true') {
      section.setAttribute('aria-hidden', 'false');
    }
  }
  await quoteNextAnimationFrame();
  await quoteNextAnimationFrame();
  return section;
}

function getTopScrollOffset() {
  const candidates = Array.from(document.querySelectorAll('.topbar,.mobile-header,.app-header,[data-fixed-header]'));
  const height = candidates.reduce((maxHeight, element) => {
    if (!element || !element.getBoundingClientRect) return maxHeight;
    const style = window.getComputedStyle ? window.getComputedStyle(element) : {};
    const position = String(style.position || '');
    if (position !== 'fixed' && position !== 'sticky') return maxHeight;
    const rect = element.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top > 12) return maxHeight;
    return Math.max(maxHeight, rect.height || 0);
  }, 0);
  return height + 18;
}

function getScrollContainerForElement(element) {
  var current = element && element.parentElement;
  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle ? window.getComputedStyle(current) : {};
    const overflowY = String(style.overflowY || style.overflow || '').toLowerCase();
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight + 1) {
      return current;
    }
    current = current.parentElement;
  }
  return window;
}

function scrollToProductSearch(input) {
  const target = getProductSearchScrollTarget(input);
  if (!target || !target.getBoundingClientRect) {
    return false;
  }
  const behavior = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const offset = getTopScrollOffset();
  const container = getScrollContainerForElement(target);
  if (container && container !== window) {
    const targetRect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const top = targetRect.top - containerRect.top + container.scrollTop - offset;
    try {
      container.scrollTo({ top: Math.max(0, top), behavior: behavior });
    } catch (error) {
      container.scrollTop = Math.max(0, top);
    }
    return true;
  }
  const rect = target.getBoundingClientRect();
  const pageTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  const top = pageTop + rect.top - offset;
  try {
    window.scrollTo({ top: Math.max(0, top), behavior: behavior });
  } catch (error) {
    window.scrollTo(0, Math.max(0, top));
  }
  return true;
}

function focusProductSearch(input) {
  if (!input || typeof input.focus !== 'function') {
    return false;
  }
  try {
    input.focus({ preventScroll: true });
  } catch (error) {
    input.focus();
  }
  try {
    if (typeof input.setSelectionRange === 'function') {
      const length = String(input.value || '').length;
      input.setSelectionRange(length, length);
    }
  } catch (error) {}
  return document.activeElement === input;
}

function highlightProductSearch(input) {
  const target = getProductSearchScrollTarget(input) || input;
  if (!target || !target.classList) {
    return false;
  }
  if (QUOTE_PRODUCT_SEARCH_HIGHLIGHT_TIMER) {
    clearTimeout(QUOTE_PRODUCT_SEARCH_HIGHLIGHT_TIMER);
    QUOTE_PRODUCT_SEARCH_HIGHLIGHT_TIMER = null;
  }
  document.querySelectorAll('.product-search--navigation-highlight').forEach(element => {
    element.classList.remove('product-search--navigation-highlight');
  });
  const cleanup = function () {
    target.classList.remove('product-search--navigation-highlight');
    target.removeEventListener('animationend', cleanup);
    if (QUOTE_PRODUCT_SEARCH_HIGHLIGHT_TIMER) {
      clearTimeout(QUOTE_PRODUCT_SEARCH_HIGHLIGHT_TIMER);
      QUOTE_PRODUCT_SEARCH_HIGHLIGHT_TIMER = null;
    }
  };
  target.addEventListener('animationend', cleanup, { once: true });
  void target.offsetWidth;
  target.classList.add('product-search--navigation-highlight');
  QUOTE_PRODUCT_SEARCH_HIGHLIGHT_TIMER = setTimeout(cleanup, 1600);
  return true;
}

function cancelPendingQuoteItemScroll() {
  QUOTE_ITEM_SCROLL_SEQUENCE += 1;
  QUOTE_ITEM_PENDING_SCROLL_LINE_ID = '';
}

async function navigateToProductSearch(event) {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  const sequence = ++QUOTE_PRODUCT_SEARCH_NAV_SEQUENCE;
  cancelPendingQuoteItemScroll();
  await ensureProductSearchVisible();
  if (sequence !== QUOTE_PRODUCT_SEARCH_NAV_SEQUENCE) {
    return false;
  }
  const input = await waitForProductSearchInput(3);
  if (!input) {
    if (isDevelopmentHost() && typeof console !== 'undefined' && console.warn) {
      console.warn('[quotation] Product search input not found');
    }
    showProductSearchNavigationToast('ไม่พบช่องค้นหาสินค้า กรุณาลองใหม่อีกครั้ง');
    return false;
  }
  scrollToProductSearch(input);
  await quoteNextAnimationFrame();
  await quoteNextAnimationFrame();
  if (sequence !== QUOTE_PRODUCT_SEARCH_NAV_SEQUENCE) {
    return false;
  }
  focusProductSearch(input);
  highlightProductSearch(input);
  return true;
}

function getQuoteItemElement(lineId) {
  const id = String(lineId || '').trim();
  const cartList = document.getElementById('cartList');
  if (!id || !cartList) {
    return null;
  }
  return Array.prototype.slice.call(cartList.querySelectorAll('.quote-line[data-line-id]')).find(element => {
    return String(element.dataset.lineId || '').trim() === id;
  }) || null;
}

function highlightQuoteItem(lineId) {
  const element = getQuoteItemElement(lineId);
  if (!element) {
    return false;
  }
  if (QUOTE_ITEM_HIGHLIGHT_TIMER) {
    clearTimeout(QUOTE_ITEM_HIGHLIGHT_TIMER);
    QUOTE_ITEM_HIGHLIGHT_TIMER = null;
  }
  document.querySelectorAll('.quote-line.is-newly-added').forEach(item => item.classList.remove('is-newly-added'));
  element.classList.add('is-newly-added');
  QUOTE_ITEM_HIGHLIGHT_TIMER = setTimeout(() => {
    element.classList.remove('is-newly-added');
    QUOTE_ITEM_HIGHLIGHT_TIMER = null;
  }, 1800);
  return true;
}

function scrollToQuoteItem(lineId, options) {
  const element = getQuoteItemElement(lineId);
  if (!element) {
    return false;
  }
  try {
    element.scrollIntoView({
      behavior: options && options.instant ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest'
    });
  } catch (error) {
    element.scrollIntoView();
  }
  highlightQuoteItem(lineId);
  return true;
}

function scheduleScrollToAddedItem(lineId) {
  const id = String(lineId || '').trim();
  if (!id) {
    return;
  }
  const sequence = ++QUOTE_ITEM_SCROLL_SEQUENCE;
  QUOTE_ITEM_PENDING_SCROLL_LINE_ID = id;
  var attempts = 0;
  function tryScroll() {
    if (sequence !== QUOTE_ITEM_SCROLL_SEQUENCE) {
      return;
    }
    attempts += 1;
    if (scrollToQuoteItem(id)) {
      return;
    }
    if (attempts < 4) {
      setTimeout(() => {
        requestAnimationFrame(tryScroll);
      }, 40);
    }
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(tryScroll);
  });
}

function setupCartReorder() {
  const cartList = document.getElementById('cartList');
  if (!cartList || cartList.dataset.reorderBound === 'true') {
    return;
  }
  cartList.dataset.reorderBound = 'true';
  let dragged = null;
  let placeholder = null;
  let pointerId = null;
  let startY = 0;
  let startX = 0;
  let dragStartTop = 0;
  let pressTimer = null;
  let pendingLine = null;
  let isDragging = false;
  const touchDelayMs = 380;
  const moveTolerance = 8;
  const noDragSelector = 'button,input,select,textarea,a,label,[data-no-drag]';

  function isNoDragTarget(target) {
    return Boolean(target && target.closest && target.closest(noDragSelector));
  }
  function getLineElement(target) {
    if (!target || !target.closest || isNoDragTarget(target)) return null;
    return target.closest('.quote-line');
  }
  function getAfterElement(container, y) {
    const elements = Array.from(container.querySelectorAll('.quote-line:not(.is-dragging)'));
    return elements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  }
  function syncCartOrderFromDom() {
    const ids = Array.from(cartList.querySelectorAll('.quote-line')).map(el => el.dataset.lineId);
    if (!ids.length) return;
    const byId = {};
    CART.forEach(item => { byId[String(item.lineId)] = item; });
    const next = ids.map(id => byId[String(id)]).filter(Boolean);
    CART.forEach(item => {
      if (next.indexOf(item) < 0) next.push(item);
    });
    CART.length = 0;
    next.forEach((item, index) => {
      item.lineNo = index + 1;
      item.lineOrder = index + 1;
      item.sortOrder = index + 1;
      CART.push(item);
    });
  }
  function renumberCartItems() {
    CART.forEach((item, index) => {
      item.lineNo = index + 1;
      item.lineOrder = index + 1;
      item.sortOrder = index + 1;
    });
  }
  function moveCartLineByKeyboard(line, direction) {
    const id = line && line.dataset ? String(line.dataset.lineId || '') : '';
    if (!id) return;
    const index = CART.findIndex(item => String(item.lineId) === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= CART.length) return;
    const item = CART.splice(index, 1)[0];
    CART.splice(nextIndex, 0, item);
    renumberCartItems();
    renderCart();
    const nextLine = cartList.querySelector(`.quote-line[data-line-id="${id}"]`);
    if (nextLine && typeof nextLine.focus === 'function') nextLine.focus();
  }
  function clearPressTimer() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }
  function setReorderHintSeen() {
    try { localStorage.setItem('sg_quote_reorder_hint_seen', 'true'); } catch (error) {}
  }
  function autoScroll(clientY) {
    const margin = 72;
    const maxSpeed = 18;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (clientY < margin) {
      window.scrollBy(0, -Math.max(4, Math.round((margin - clientY) / margin * maxSpeed)));
    } else if (viewportHeight && clientY > viewportHeight - margin) {
      window.scrollBy(0, Math.max(4, Math.round((clientY - (viewportHeight - margin)) / margin * maxSpeed)));
    }
  }
  function beginDrag(line, event) {
    if (!line || dragged) return;
    clearPressTimer();
    dragged = line;
    isDragging = true;
    pointerId = event.pointerId;
    startY = event.clientY;
    startX = event.clientX;
    const rect = dragged.getBoundingClientRect();
    dragStartTop = rect.top;
    placeholder = document.createElement('div');
    placeholder.className = 'quote-drop-placeholder card--ghost';
    placeholder.style.height = dragged.offsetHeight + 'px';
    dragged.parentNode.insertBefore(placeholder, dragged.nextSibling);
    dragged.classList.add('is-dragging', 'card--dragging', 'card--chosen');
    dragged.style.width = dragged.offsetWidth + 'px';
    dragged.style.position = 'fixed';
    dragged.style.left = rect.left + 'px';
    dragged.style.top = rect.top + 'px';
    dragged.style.zIndex = '220';
    dragged.style.pointerEvents = 'none';
    document.body.classList.add('quote-reordering');
    setReorderHintSeen();
    try { line.setPointerCapture(pointerId); } catch (error) {}
  }
  function cleanup() {
    clearPressTimer();
    if (dragged) {
      dragged.classList.remove('is-dragging', 'card--dragging', 'card--chosen', 'card--drag-ready');
      dragged.style.width = '';
      dragged.style.position = '';
      dragged.style.left = '';
      dragged.style.top = '';
      dragged.style.zIndex = '';
      dragged.style.pointerEvents = '';
      dragged.style.transform = '';
    }
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }
    dragged = null;
    placeholder = null;
    pendingLine = null;
    pointerId = null;
    isDragging = false;
    document.body.classList.remove('quote-reordering');
    cartList.querySelectorAll('.card--drag-ready').forEach(el => el.classList.remove('card--drag-ready'));
  }
  cartList.addEventListener('pointerdown', event => {
    const line = getLineElement(event.target);
    if (!line || event.button > 0) return;
    pendingLine = line;
    pointerId = event.pointerId;
    startY = event.clientY;
    startX = event.clientX;
    line.classList.add('card--drag-ready');
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      clearPressTimer();
      pressTimer = setTimeout(() => {
        if (pendingLine === line) beginDrag(line, event);
      }, touchDelayMs);
      return;
    }
    beginDrag(line, event);
    event.preventDefault();
  });
  cartList.addEventListener('pointermove', event => {
    if (event.pointerId !== pointerId) return;
    if (!isDragging) {
      if (pendingLine && (Math.abs(event.clientY - startY) > moveTolerance || Math.abs(event.clientX - startX) > moveTolerance)) {
        pendingLine.classList.remove('card--drag-ready');
        pendingLine = null;
        clearPressTimer();
      }
      return;
    }
    if (!dragged) return;
    const dy = event.clientY - startY;
    dragged.style.transform = `translateY(${dy}px)`;
    const afterElement = getAfterElement(cartList, event.clientY);
    if (afterElement == null) {
      cartList.appendChild(placeholder);
    } else {
      cartList.insertBefore(placeholder, afterElement);
    }
    autoScroll(event.clientY);
    event.preventDefault();
  });
  function finish(event) {
    if (event && event.pointerId !== pointerId) return;
    if (!isDragging || !dragged) {
      cleanup();
      return;
    }
    const target = dragged;
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.insertBefore(target, placeholder);
    }
    cleanup();
    syncCartOrderFromDom();
    renderCart();
  }
  cartList.addEventListener('pointerup', finish);
  cartList.addEventListener('pointercancel', finish);
  cartList.addEventListener('keydown', event => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    const line = event.target && event.target.closest ? event.target.closest('.quote-line') : null;
    if (!line || isNoDragTarget(event.target)) return;
    moveCartLineByKeyboard(line, event.key === 'ArrowUp' ? -1 : 1);
    event.preventDefault();
  });
}
async function addProduct(productId, qty) {
  return requestAddProductToQuote(productId, QUOTE_PRODUCT_ADD_SOURCE.SEARCH, qty || 1);
}

async function saveQuotationWithStatus(status) {
  if (!CURRENT_QUOTE.customerId) {
    toast('กรุณาเลือกลูกค้าก่อนบันทึกใบเสนอราคา');
    return;
  }
  if (!CART.length) {
    toast('กรุณาเพิ่มสินค้าในใบเสนอราคาก่อนบันทึก');
    return;
  }
  if (QUOTE_SAVE_IN_PROGRESS) {
    toast('กำลังบันทึกใบเสนอราคาอยู่ กรุณารอสักครู่');
    return { ok: false, code: 'DUPLICATE_SUBMIT', message: 'Quotation save is already in progress' };
  }
  const payload = buildQuotationPayload(status);
  const requestId = getQuotationSaveRequestIdForPayload(payload);
  QUOTE_SAVE_IN_PROGRESS = true;
  setQuotationSaveBusy(true);
  try {
    toast('กำลังบันทึก...');
    payload.clientRequestId = requestId;
    const response = await callApi(payload.quoteId ? 'updateQuotation' : 'saveQuotation', payload);
    if (!response.ok) {
      toast(response.message || 'บันทึกใบเสนอราคาไม่สำเร็จ');
      return response;
    }
    clearQuotationSaveRequestState();
    CURRENT_QUOTE.quoteId = response.data?.quoteId || CURRENT_QUOTE.quoteId;
    CURRENT_QUOTE.quoteNo = response.data?.quoteNo || CURRENT_QUOTE.quoteNo || CURRENT_QUOTE.quoteId;
    CURRENT_QUOTE.quoteType = normalizeQuoteType(response.data?.quoteType || CURRENT_QUOTE.quoteType || CURRENT_QUOTE_TYPE);
    CURRENT_QUOTE.businessUnit = CURRENT_QUOTE.quoteType;
    CURRENT_QUOTE.status = response.data?.status || status || CURRENT_QUOTE.status;
    setCurrentQuoteType(CURRENT_QUOTE.quoteType, true);
    if (typeof clearQuotationCache === 'function') {
      clearQuotationCache(CURRENT_QUOTE.quoteId);
    }
    clearLoadedQuotationCache(CURRENT_QUOTE.quoteId);
    if (typeof clearCache === 'function') {
      clearCache('sg_quote_history_cache');
    }
    renderQuoteMeta();
    renderCart();
    toast((status === 'DRAFT' ? 'บันทึกแบบร่างแล้ว' : 'อัปเดตใบเสนอราคาแล้ว') + (CURRENT_QUOTE.quoteNo ? ': ' + CURRENT_QUOTE.quoteNo : ''));
    if (typeof refreshQuotationHistory === 'function' && (typeof isQuotationHistoryLoaded !== 'function' || isQuotationHistoryLoaded())) {
      await refreshQuotationHistory({force:true});
    }
    return response;
  } finally {
    QUOTE_SAVE_IN_PROGRESS = false;
    setQuotationSaveBusy(false);
  }
}

if (typeof window !== 'undefined') {
  window.renderQuote = renderQuote;
  window.renderProductPicker = renderProductPicker;
  window.addCart = addCart;
  window.renderCart = renderCart;
  window.calcCart = calcCart;
  window.saveQuote = saveQuote;
  window.saveQuotation = saveQuotation;
  window.saveDraftQuotation = saveDraftQuotation;
  window.updateQuotation = updateQuotation;
  window.shareQuote = shareQuote;
  window.selectCustomer = selectCustomer;
  window.newQuotation = newQuotation;
  window.addProduct = addProduct;
  window.requestAddProductToQuote = requestAddProductToQuote;
  window.addProductToQuoteByReference = addProductToQuoteByReference;
  window.normalizeProductReference = normalizeProductReference;
  window.resolveProductByReference = resolveProductByReference;
  window.getProductPrimaryKey = getProductPrimaryKey;
  window.removeProduct = removeProduct;
  window.changeQty = changeQty;
  window.toggleFreeItem = toggleFreeItem;
  window.refreshQuotation = refreshQuotation;
  window.loadQuotation = loadQuotation;
  window.openQuotation = openQuotation;
  window.printQuotation = printQuotation;
  window.printQuotationSheet = printQuotationSheet;
  window.exportQuotationPNG = exportQuotationPNG;
  window.saveQuotationPng = saveQuotationPng;
  window.saveQuotationPdf = saveQuotationPdf;
  window.closeQuotationPrintPreview = closeQuotationPrintPreview;
  window.duplicateQuotation = duplicateQuotation;
  window.cancelQuotation = cancelQuotation;
  window.duplicateCurrentQuotation = duplicateCurrentQuotation;
  window.cancelCurrentQuotation = cancelCurrentQuotation;
  window.renderQuoteMeta = renderQuoteMeta;
  window.openQuoteTypeModal = openQuoteTypeModal;
  window.closeQuoteTypeModal = closeQuoteTypeModal;
  window.selectQuoteType = selectQuoteType;
  window.getCurrentQuoteBusinessUnit = getCurrentQuoteBusinessUnit;
  window.isQuoteBusinessUnitSelected = isQuoteBusinessUnitSelected;
  window.getProductBusinessUnitClient = getProductBusinessUnitClient;
  window.isProductForCurrentQuoteBusinessUnit = isProductForCurrentQuoteBusinessUnit;
  window.changeDiscount = changeDiscount;
  window.toggleFreeItem = toggleFreeItem;
  window.openQuoteLinePriceEditor = openQuoteLinePriceEditor;
  window.changeQuoteLineUnit = changeQuoteLineUnit;
  window.navigateToProductSearch = navigateToProductSearch;
  window.getProductSearchInput = getProductSearchInput;
  window.cancelPendingQuoteItemScroll = cancelPendingQuoteItemScroll;
  if (typeof window.renderQuoteProductPicker === 'function') {
    window.renderProductPicker = window.renderQuoteProductPicker;
  }
}
