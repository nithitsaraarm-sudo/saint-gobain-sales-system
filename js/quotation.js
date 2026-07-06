let CURRENT_QUOTE = { quoteId: '', customerId: '', customerName: '', shipping: 0, specialDiscount: 0, status: 'DRAFT' };
const QUOTE_LINE_PREFIX = 'LINE_';

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
      qty: item.qty,
      listPrice: item.listPrice,
      discountPercent: item.discount,
      netPrice: item.netPrice,
      lineTotal: item.lineTotal
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
      qty: Number(line.qty || 0),
      listPrice: roundValue(Number(line.listPrice || 0)),
      discount: Number(line.discountPercent || line.discount || 0),
      netPrice: roundValue(Number(line.netPrice || 0)),
      lineTotal: roundValue(Number(line.lineTotal || 0))
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

window.renderQuote = renderQuote;
window.renderProductPicker = renderProductPicker;
window.addCart = addCart;
window.renderCart = renderCart;
window.calcCart = calcCart;
window.saveQuote = saveQuote;
window.saveQuotation = saveQuotation;
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
window.changeDiscount = changeDiscount;
