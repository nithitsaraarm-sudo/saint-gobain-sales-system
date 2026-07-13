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
  const productId = getProductId(p);
  if (!productId) {
    toast('ไม่พบรหัสสินค้า');
    return;
  }
  addProduct(productId, 1);
  go('quote');
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
  let subtotal = CART.reduce((sum, it) => sum + (Number(it.listPrice) * (1 - Number(it.discount || 0) / 100) * Number(it.qty || 0)), 0);
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
  return String(product?.productId || product?.sku || product?.productCode || product?.id || '').trim();
}

function getProductById(productId) {
  const normalized = String(productId || '').trim().toLowerCase();
  return DB.products.find(p => String(p.productId || p.sku || p.productCode || p.id || '').trim().toLowerCase() === normalized) || null;
}

function createLineId() {
  return QUOTE_LINE_PREFIX + Date.now() + '_' + Math.floor(Math.random() * 10000);
}

function toPriceNumber(value) {
  const numericValue = Number(String(value || '').replace(/,/g, ''));
  return isNaN(numericValue) ? 0 : numericValue;
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
  const qty = Math.max(0, Number(item.qty || 0));
  const listPrice = roundValue(toPriceNumber(item.listPrice));
  const discountPercent = item.discountLoading ? 0 : roundValue(Number(item.discountPercent ?? item.discount ?? 0));
  const isFree = Boolean(item.isFree || item.freeItem);
  const unitPrice = isFree ? 0 : roundValue(listPrice * (1 - discountPercent / 100));
  const lineTotal = roundValue(unitPrice * qty);
  const vat = roundValue(lineTotal * 0.07);
  const grandTotal = roundValue(lineTotal + vat);

  item.qty = qty;
  item.isFree = isFree;
  item.freeItem = isFree;
  item.listPrice = listPrice;
  item.discountPercent = discountPercent;
  item.discount = discountPercent;
  item.unitPrice = unitPrice;
  item.netPrice = unitPrice;
  item.lineTotal = lineTotal;
  item.vat = vat;
  item.grandTotal = grandTotal;
  return item;
}

function createCartLine(product, qty, discountPercent) {
  const productBusinessUnit = getProductBusinessUnitClient(product);
  return recalcLineItem({
    lineId: createLineId(),
    productId: getProductId(product),
    productBusinessUnit: productBusinessUnit,
    businessUnit: productBusinessUnit,
    productName: String(product.productName || product.name || '').trim(),
    unit: String(product.unit || '').trim(),
    qty: Number(qty || 1),
    listPrice: roundValue(toPriceNumber(product.listPrice || product.price || 0)),
    discountPercent: Number(discountPercent || 0)
  });
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
    return;
  }
  const product = getProductById(productId);
  if (!product) {
    toast('ไม่พบสินค้า');
    return;
  }
  if (!isQuoteBusinessUnitSelected()) {
    const selectedType = await requestQuoteTypeSelection(true);
    if (!selectedType) {
      toast('กรุณาเลือก BU ก่อนเพิ่มสินค้า');
      return;
    }
  }
  if (!CURRENT_QUOTE.customerId) {
    const sel = document.getElementById('quoteCustomer');
    const customerId = sel?.value;
    if (customerId) {
      await newQuotation(customerId);
    } else {
      toast('กรุณาเลือกลูกค้าก่อนเพิ่มสินค้า');
      return;
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
    createdBy: USER?.username,
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
    return;
  }
  const product = getProductById(productId);
  if (!product) {
    toast('ไม่พบสินค้า');
    return;
  }
  if (!isQuoteBusinessUnitSelected()) {
    const selectedType = await requestQuoteTypeSelection(true);
    if (!selectedType) {
      toast('กรุณาเลือก BU ก่อนเพิ่มสินค้า');
      return;
    }
  }
  if (!CURRENT_QUOTE.customerId) {
    const customerId = getSelectedCustomerIdForPricing();
    if (customerId) {
      await newQuotation(customerId);
    } else {
      toast('กรุณาเลือกลูกค้าก่อนเพิ่มสินค้า');
      return;
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
  line.discountPercent = Number(newDiscount || 0);
  line.discount = line.discountPercent;
  recalcLineItem(line);
  renderCart();
}

function toggleFreeItem(lineId, checked) {
  const line = CART.find(item => item.lineId === lineId);
  if (!line) {
    return;
  }
  line.isFree = Boolean(checked);
  line.freeItem = line.isFree;
  recalcLineItem(line);
  renderCart();
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
    createdBy: USER?.username || USER?.displayName || ''
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
  const typeText = isQuoteBusinessUnitSelected() ? getQuoteTypeLabel(quoteType) + ' ▼' : 'เลือก BU ▼';
  meta.innerHTML = `<button type="button" class="quote-type-switch ${getQuoteTypeClass(quoteType)}" onclick="openQuoteTypeModal()">${typeText}</button><span>เลขที่ใบเสนอราคา: <b>${quoteNo}</b></span><span>สถานะ: <b>${status}</b></span>`;
}

function buildQuotationPayload(status) {
  const totals = calcCart();
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
        productId: item.productId,
        productBusinessUnit: getProductBusinessUnitClient(item) || item.productBusinessUnit || '',
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
    status: status || 'SAVED',
    createdBy: USER?.username || USER?.displayName || ''
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
    CART.push(recalcLineItem({
      lineId: String(line.lineId || line.lineNo || createLineId()),
      lineNo: String(line.lineNo || '').trim(),
      lineOrder: Number(String(line.lineOrder || line.sortOrder || line.lineNo || 0).replace(/,/g, '')) || 0,
      sortOrder: Number(String(line.sortOrder || line.lineOrder || line.lineNo || 0).replace(/,/g, '')) || 0,
      productId: String(line.productId || '').trim(),
      productBusinessUnit: getProductBusinessUnitClient(line) || String(line.productBusinessUnit || line.businessUnit || '').trim(),
      businessUnit: getProductBusinessUnitClient(line) || String(line.productBusinessUnit || line.businessUnit || '').trim(),
      productName: String(line.productName || '').trim(),
      unit: String(line.unit || '').trim(),
      qty: Number(String(line.qty || 0).replace(/,/g, '')),
      listPrice: roundValue(toPriceNumber(line.listPrice || 0)),
      discountPercent: Number(String(line.discountPercent || line.discount || 0).replace(/,/g, '')),
      unitPrice: roundValue(toPriceNumber(line.unitPrice || line.netPrice || 0)),
      lineTotal: roundValue(toPriceNumber(line.lineTotal || 0)),
      vat: roundValue(toPriceNumber(line.vat || 0)),
      grandTotal: roundValue(toPriceNumber(line.grandTotal || 0)),
      isFree: Boolean(line.isFree || line.freeItem || String(line.free || '').toUpperCase() === 'FREE' || (toPriceNumber(line.listPrice || 0) > 0 && toPriceNumber(line.lineTotal || 0) === 0)),
      status: String(line.status || 'ACTIVE')
    }));
  });
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
  const salesName = quotePrintText(quote.createdBy || user.quoteDisplayName || user.displayName || user.fullName || user.username, '-');
  const salesPosition = quotePrintText(user.jobTitle || user.position, '-');
  const companyName = quotePrintText((typeof DB !== 'undefined' && DB.settings && DB.settings.companyName) || user.companyName, 'SAINT-GOBAIN');
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
    const listPrice = quotePrintNumber(line.listPrice);
    const discount = quotePrintNumber(line.discountPercent || line.discount);
    const isFree = Boolean(line.isFree || line.freeItem || String(line.free || '').toUpperCase() === 'FREE' || (listPrice > 0 && quotePrintNumber(line.lineTotal || 0) === 0));
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
      <td class="num">${escapeQuotationPrintHtml(line.unit || '-')}</td>
      <td class="num">${quotePrintMoney(lineTotal)}</td>
    </tr>`;
  }).join('') : '<tr><td class="print-empty" colspan="8">ไม่มีรายการสินค้า</td></tr>';

  return `<article class="print-sheet-inner">
    <header class="print-doc-header">
      <div class="print-doc-title">
        <h1>ใบเสนอราคา</h1>
        <p class="quote-type-subtitle">${escapeQuotationPrintHtml(quoteTypeLabel)} ▼</p>
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
    salesName: quotePrintText(quote.createdBy || user.quoteDisplayName || user.displayName || user.fullName || user.username, '-'),
    salesPosition: quotePrintText(user.jobTitle || user.position, '-'),
    companyName: quotePrintText((typeof DB !== 'undefined' && DB.settings && DB.settings.companyName) || user.companyName, 'SAINT-GOBAIN'),
    remark: quotePrintText(quote.notes || quote.remark || quote.remarks, '-'),
    subtotal: quotePrintNumber(totals.subtotal !== undefined ? totals.subtotal : quote.subtotal),
    vat: quotePrintNumber(totals.vat !== undefined ? totals.vat : quote.vat),
    grandTotal: quotePrintNumber(totals.grandTotal !== undefined ? totals.grandTotal : quote.grandTotal)
  };
}

function buildQuotationPrintRowHtml(line, index) {
  const item = line || {};
  const qty = quotePrintNumber(item.qty);
  const listPrice = quotePrintNumber(item.listPrice);
  const discount = quotePrintNumber(item.discountPercent || item.discount);
  const isFree = Boolean(item.isFree || item.freeItem || String(item.free || '').toUpperCase() === 'FREE' || (listPrice > 0 && quotePrintNumber(item.lineTotal || 0) === 0));
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
    <td class="num">${escapeQuotationPrintHtml(item.unit || '-')}</td>
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
      <p class="quote-type-subtitle">${escapeQuotationPrintHtml(ctx.quoteTypeLabel || 'Weber')} ▼</p>
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
    const discountText = it.discountLoading
      ? '<span class="loading-text">กำลังโหลดส่วนลด...</span>'
      : `<input class="quote-discount-input" type="number" value="${it.discountPercent || 0}" onchange="changeDiscount('${it.lineId}', Number(this.value))"> %`;
    const freeBadge = it.isFree ? '<span class="pill yellow">FREE</span>' : '';
    const productUnit = getProductBusinessUnitClient(it);
    const productBuBadge = productUnit ? `<span class="quote-product-bu ${getQuoteTypeClass(productUnit)}">${getQuoteTypeLabel(productUnit)}</span>` : '';
    const crossBuNote = productUnit && productUnit !== getCurrentQuoteBusinessUnit() ? '<small class="quote-cross-bu-note">สินค้าร่วมข้าม BU</small>' : '';
    return `<div class="row item-card quote-line" data-line-id="${it.lineId}" role="listitem" tabindex="0" aria-label="กดค้างแล้วลากเพื่อเรียงสินค้า หรือกด Alt พร้อมลูกศรขึ้นลง" title="กดค้างแล้วลากเพื่อเรียงสินค้า">
      <div class="quote-line-main">
        <div class="quote-product-title">${productBuBadge}<b>${it.productName || '-'} ${freeBadge}</b>${crossBuNote}</div>
        <small>${it.productId || ''}${it.unit ? ' · ' + it.unit : ''}</small>
        <div class="quote-line-prices">
          <span>ราคาตั้ง ${money(it.listPrice)}</span>
          <span data-no-drag>ส่วนลด ${discountText}</span>
          <span>ราคาสุทธิ ${it.isFree ? 'FREE' : money(it.unitPrice)}</span>
          <span>รวม ${it.isFree ? 'FREE' : money(it.lineTotal)}</span>
          <label class="free-item-toggle" data-no-drag><input type="checkbox" ${it.isFree ? 'checked' : ''} onchange="toggleFreeItem('${it.lineId}', this.checked)"> สินค้าแถม</label>
        </div>
      </div>
      <div class="qty quote-qty-control" data-no-drag>
        <button onclick="changeQty('${it.lineId}', ${Number(it.qty) - 1})">−</button>
        <input type="number" min="1" value="${Number(it.qty) || 1}" onchange="changeQty('${it.lineId}', this.value)">
        <button onclick="changeQty('${it.lineId}', ${Number(it.qty) + 1})">+</button>
      </div>
      <button class="ghost" data-no-drag onclick="removeProduct('${it.lineId}')">ลบ</button>
    </div>`;
  }).join('') : '<p style="color:var(--muted)">ยังไม่มีสินค้า</p>';
  calcCart();
  setupCartReorder();
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
  const normalizedQty = Number(qty || 1);
  if (normalizedQty <= 0) {
    toast('จำนวนสินค้าต้องมากกว่า 0');
    return;
  }
  const product = getProductById(productId);
  if (!product) {
    toast('ไม่พบสินค้า');
    return;
  }
  if (!isQuoteBusinessUnitSelected()) {
    const selectedType = await requestQuoteTypeSelection(true);
    if (!selectedType) {
      toast('กรุณาเลือก BU ก่อนเพิ่มสินค้า');
      return;
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
      return;
    }
  }
  const existing = CART.find(item => getProductId(item) === getProductId(product));
  if (existing) {
    existing.qty = Number(existing.qty || 0) + normalizedQty;
    recalcLineItem(existing);
    renderCart();
    return;
  }
  const line = createCartLine(product, normalizedQty, 0);
  line.discountLoading = true;
  CART.push(line);
  renderCart();
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
  }).catch(error => {
    console.error(error);
    const target = CART.find(item => item.lineId === line.lineId);
    if (!target) return;
    target.discountLoading = false;
    recalcLineItem(target);
    renderCart();
  });
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
  toast('กำลังบันทึก...');
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
  window.removeProduct = removeProduct;
  window.changeQty = changeQty;
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
}
