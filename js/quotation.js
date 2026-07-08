let CURRENT_QUOTE = { quoteId: '', customerId: '', customerName: '', shipping: 0, specialDiscount: 0, status: 'DRAFT' };
const QUOTE_LINE_PREFIX = 'LINE_';
const DISCOUNT_CACHE = {};

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
  try {
    const response = await callApi('discount', { customerId: customerId, groupCode: groupCode });
    const discountPercent = response && response.ok ? Number(response.data?.discountPercent || 0) : 0;
    DISCOUNT_CACHE[cacheKey] = discountPercent;
    return discountPercent;
  } catch (error) {
    console.error(error);
    return 0;
  }
}

function recalcLineItem(item) {
  const qty = Math.max(0, Number(item.qty || 0));
  const listPrice = roundValue(toPriceNumber(item.listPrice));
  const discountPercent = item.discountLoading ? 0 : roundValue(Number(item.discountPercent ?? item.discount ?? 0));
  const unitPrice = roundValue(listPrice * (1 - discountPercent / 100));
  const lineTotal = roundValue(unitPrice * qty);
  const vat = roundValue(lineTotal * 0.07);
  const grandTotal = roundValue(lineTotal + vat);

  item.qty = qty;
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
  if (normalizedQty <= 0) {
    await removeProduct(lineId);
    return;
  }
  line.qty = normalizedQty;
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

async function loadQuotation(quoteId) {
  const id = String(quoteId || '').trim();
  if (!id) {
    toast('ต้องระบุเลขที่ใบเสนอราคา');
    return;
  }
  const response = await callApi('loadQuotation', id);
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
  if (normalizedQty <= 0) {
    await removeProduct(lineId);
    return;
  }
  line.qty = normalizedQty;
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
  const response = await callApi('loadQuotation', { quoteId: id });
  if (!response.ok) {
    toast(response.message || 'โหลดใบเสนอราคาไม่สำเร็จ');
    return response;
  }
  const data = response.data || {};
  const quote = data.quote || {};
  const lines = Array.isArray(data.lines) ? data.lines : [];
  CURRENT_QUOTE = {
    quoteId: String(quote.quoteId || id).trim(),
    quoteNo: String(quote.quoteNo || quote.quoteId || id).trim(),
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
  return response;
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
    if (typeof refreshQuotationHistory === 'function') {
      await refreshQuotationHistory();
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
    const discountText = it.discountLoading ? 'กำลังโหลด...' : `<input style="width:60px;border:1px solid var(--line);border-radius:10px;padding:3px" type="number" value="${it.discountPercent||0}" onchange="changeDiscount('${it.lineId}', Number(this.value))">%`;
    return `<div class="row item-card quote-line"><div class="quote-line-main"><b>${it.productName||'-'}</b><br><small>${it.unit||'-'}</small><div class="quote-line-prices"><span>ราคาตั้ง ${money(it.listPrice)}</span><span>ส่วนลด ${discountText}</span><span>ราคาสุทธิ ${money(it.unitPrice)}</span><span>รวม ${money(it.lineTotal)}</span></div></div><div class="qty"><button onclick="changeQty('${it.lineId}', ${Number(it.qty) - 1})">−</button><b>${it.qty}</b><button onclick="changeQty('${it.lineId}', ${Number(it.qty) + 1})">+</button></div><button class="ghost" onclick="removeProduct('${it.lineId}')">ลบ</button></div>`;
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
    renderCart();
    return;
  }
  const line = createCartLine(product, normalizedQty, 0);
  line.discountLoading = true;
  CART.push(line);
  renderCart();
  const discountPercent = await getDiscountPercentForProduct(CURRENT_QUOTE.customerId, product);
  line.discountLoading = false;
  line.discountPercent = Number(discountPercent || 0);
  line.discount = line.discountPercent;
  recalcLineItem(line);
  renderCart();
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
  renderQuoteMeta();
  renderCart();
  toast((status === 'DRAFT' ? 'บันทึกแบบร่างแล้ว' : 'อัปเดตใบเสนอราคาแล้ว') + (CURRENT_QUOTE.quoteNo ? ': ' + CURRENT_QUOTE.quoteNo : ''));
  if (typeof refreshQuotationHistory === 'function') {
    await refreshQuotationHistory();
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
window.duplicateQuotation = duplicateQuotation;
window.cancelQuotation = cancelQuotation;
window.duplicateCurrentQuotation = duplicateCurrentQuotation;
window.cancelCurrentQuotation = cancelCurrentQuotation;
window.renderQuoteMeta = renderQuoteMeta;
window.changeDiscount = changeDiscount;
