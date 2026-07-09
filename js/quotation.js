let CURRENT_QUOTE = { quoteId: '', customerId: '', customerName: '', shipping: 0, specialDiscount: 0, status: 'DRAFT' };
const QUOTE_LINE_PREFIX = 'LINE_';
const DISCOUNT_CACHE = {};
const DISCOUNT_PROMISES = {};
const QUOTATION_LOAD_CACHE = {};
const QUOTATION_LOAD_PROMISES = {};
const QUOTATION_LOAD_TTL_MS = 10 * 60 * 1000;

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
  if (!customerId || !groupCode) {
    return 0;
  }
  const cacheKey = customerId + '|' + groupCode;
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
    DISCOUNT_PROMISES[cacheKey] = callApi('discount', { customerId: customerId, groupCode: groupCode }).then(response => {
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
  return recalcLineItem({
    lineId: createLineId(),
    productId: getProductId(product),
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
  const customer = DB.customers.find(c => String(c.customerId || '').trim() === selectedCustomerId) || {};
  const response = await callApi('createQuotation', selectedCustomerId);
  if (response.ok && response.data) {
    CURRENT_QUOTE = {
      quoteId: response.data.quoteId || CURRENT_QUOTE.quoteId,
      customerId: selectedCustomerId,
      customerName: customer.customerName || '',
      shipping: 0,
      specialDiscount: 0,
      status: 'DRAFT'
    };
  } else {
    CURRENT_QUOTE = {
      quoteId: CURRENT_QUOTE.quoteId || '',
      customerId: selectedCustomerId,
      customerName: customer.customerName || '',
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
  meta.innerHTML = `<span>เลขที่ใบเสนอราคา: <b>${quoteNo}</b></span><span>สถานะ: <b>${status}</b></span>`;
}

function buildQuotationPayload(status) {
  const totals = calcCart();
  return {
    quoteId: CURRENT_QUOTE.quoteId || '',
    quoteNo: CURRENT_QUOTE.quoteNo || '',
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
  CURRENT_QUOTE.status = response.data?.status || status || CURRENT_QUOTE.status;
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
  const lines = Array.isArray(data.lines) ? data.lines : [];
  CURRENT_QUOTE = {
    quoteId: String(quote.quoteId || fallbackQuoteId).trim(),
    quoteNo: String(quote.quoteNo || quote.quoteId || fallbackQuoteId).trim(),
    customerId: String(quote.customerId || '').trim(),
    customerName: String(quote.customerName || '').trim(),
    shipping: Number(String(quote.shipping || 0).replace(/,/g, '')),
    specialDiscount: Number(String(quote.specialDiscount || 0).replace(/,/g, '')),
    status: String(quote.status || 'DRAFT').trim() || 'DRAFT'
  };
  CART.length = 0;
  lines.forEach(line => {
    CART.push(recalcLineItem({
      lineId: String(line.lineId || line.lineNo || createLineId()),
      productId: String(line.productId || '').trim(),
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
  const salesName = quotePrintText(quote.createdBy || user.displayName || user.username, '-');
  const salesPosition = quotePrintText(user.position, '-');
  const companyName = 'SAINT-GOBAIN';
  const remark = quotePrintText(quote.notes || quote.remark || quote.remarks, '-');
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
      <td class="print-product-cell"><b class="product-name">${escapeQuotationPrintHtml(line.productName)}</b>${freeText}<span class="print-product-code">${escapeQuotationPrintHtml(sku)}</span></td>
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
        <p>Quotation</p>
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
    <section class="print-summary">
      <div class="print-note"><b>หมายเหตุ</b><div>${escapeQuotationPrintHtml(remark)}</div></div>
      <div class="print-totals">
        <div class="print-total-row"><span>รวมก่อน VAT</span><b>${quotePrintMoney(subtotal)}</b></div>
        <div class="print-total-row"><span>VAT 7%</span><b>${quotePrintMoney(vat)}</b></div>
        <div class="print-total-row"><span>ยอดรวมสุทธิ</span><b>${quotePrintMoney(grandTotal)}</b></div>
      </div>
    </section>
    <section class="print-signature"></section>
  </article>`;
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
  documentNode.innerHTML = buildQuotationPrintHtml(printData || {});
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
  const previousTransformPriority = documentNode.style.getPropertyPriority('transform');
  const previousTransformOriginPriority = documentNode.style.getPropertyPriority('transform-origin');
  documentNode.style.setProperty('transform', 'none', 'important');
  documentNode.style.setProperty('transform-origin', 'top left', 'important');
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
  cartList.innerHTML = CART.length ? CART.map(it => {
    const discountText = it.discountLoading
      ? '<span class="loading-text">กำลังโหลดส่วนลด...</span>'
      : `<input class="quote-discount-input" type="number" value="${it.discountPercent || 0}" onchange="changeDiscount('${it.lineId}', Number(this.value))"> %`;
    const freeBadge = it.isFree ? '<span class="pill yellow">FREE</span>' : '';
    return `<div class="row item-card quote-line">
      <div class="quote-line-main">
        <b>${it.productName || '-'} ${freeBadge}</b><br>
        <small>${it.productId || ''}${it.unit ? ' · ' + it.unit : ''}</small>
        <div class="quote-line-prices">
          <span>ราคาตั้ง ${money(it.listPrice)}</span>
          <span>ส่วนลด ${discountText}</span>
          <span>ราคาสุทธิ ${it.isFree ? 'FREE' : money(it.unitPrice)}</span>
          <span>รวม ${it.isFree ? 'FREE' : money(it.lineTotal)}</span>
          <label class="free-item-toggle"><input type="checkbox" ${it.isFree ? 'checked' : ''} onchange="toggleFreeItem('${it.lineId}', this.checked)"> สินค้าแถม</label>
        </div>
      </div>
      <div class="qty quote-qty-control">
        <button onclick="changeQty('${it.lineId}', ${Number(it.qty) - 1})">−</button>
        <input type="number" min="1" value="${Number(it.qty) || 1}" onchange="changeQty('${it.lineId}', this.value)">
        <button onclick="changeQty('${it.lineId}', ${Number(it.qty) + 1})">+</button>
      </div>
      <button class="ghost" onclick="removeProduct('${it.lineId}')">ลบ</button>
    </div>`;
  }).join('') : '<p style="color:var(--muted)">ยังไม่มีสินค้า</p>';
  calcCart();
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
  if (!CURRENT_QUOTE.customerId) {
    const customerId = getSelectedCustomerIdForPricing();
    if (customerId) {
      const customer = DB.customers.find(c => String(c.customerId || '').trim() === String(customerId).trim()) || {};
      CURRENT_QUOTE = {
        quoteId: CURRENT_QUOTE.quoteId || '',
        quoteNo: CURRENT_QUOTE.quoteNo || '',
        customerId: String(customerId).trim(),
        customerName: String(customer.customerName || '').trim(),
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
  toast('กำลังโหลดส่วนลด...');
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
  CURRENT_QUOTE.status = response.data?.status || status || CURRENT_QUOTE.status;
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
window.changeDiscount = changeDiscount;
window.toggleFreeItem = toggleFreeItem;
