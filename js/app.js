let DB=normalizeDb(), USER=null, CART=[], selectedCustomerId='';
let bootstrapLoaded=false, bootstrapPromise=null;
const LIST_RENDER_LIMIT=50, QUOTE_PICKER_LIMIT=30, SEARCH_DEBOUNCE_MS=300;
const $=id=>document.getElementById(id); const money=n=>Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
function parseClientNumber(value){const n=Number(String(value||'').replace(/,/g,'')); return Number.isFinite(n)?n:0}
function normalizeSearchText(value){return String(value??'').toLowerCase().trim().replace(/[\s\-_\/.,()]+/g,'')}
function smartMatch(record, keyword, fields){
  const raw=String(keyword||'').toLowerCase().trim();
  if(!raw)return true;
  const words=raw.split(/[\s\-_\/.,()]+/).map(normalizeSearchText).filter(Boolean);
  if(!words.length)return true;
  const values=fields.map(field=>normalizeSearchText(record&&record[field]));
  const combined=normalizeSearchText(fields.map(field=>record&&record[field]).join(' '));
  return words.every(word=>values.some(value=>value.includes(word))||combined.includes(word));
}

function debounce(fn, delay){
  let timer=null;
  return function(){
    const context=this,args=arguments;
    window.clearTimeout(timer);
    timer=window.setTimeout(function(){fn.apply(context,args)},delay||SEARCH_DEBOUNCE_MS);
  };
}

function limitList(items, limit){
  const list=Array.isArray(items)?items:[];
  return {items:list.slice(0,limit),limited:list.length>limit,total:list.length};
}

function renderLimitNotice(limited, limit){
  return limited?`<div class="list-limit">แสดง ${limit} รายการแรก กรุณาค้นหาเพิ่มเติม</div>`:'';
}

function setupDebouncedSearchInputs(){
  const bind=(id,fn)=>{
    const el=$(id);
    if(el)el.oninput=debounce(fn,SEARCH_DEBOUNCE_MS);
  };
  bind('searchProducts',renderProducts);
  bind('customerSearch',renderCustomers);
  bind('productSearch',function(){ if(typeof renderProductPicker==='function')renderProductPicker(); });
  bind('quoteCustomerSearch',function(){ renderQuoteCustomerPicker(true); });
}
window.addEventListener('load',()=>{
  setupQuoteSearchEnhancements();
  setupDebouncedSearchInputs();
  const u=localStorage.getItem('currentUser');
  if(u){
    try {
      USER=JSON.parse(u);
      showApp();
    } catch (e) {
      localStorage.removeItem('currentUser');
    }
  }
  loadData();
});

function normalizeDb(data){
  const source=data&&typeof data==='object'?data:{};
  return {
    ...source,
    settings:source.settings&&typeof source.settings==='object'?source.settings:{},
    customers:Array.isArray(source.customers)?source.customers.map(normalizeCustomer):[],
    products:Array.isArray(source.products)?source.products.map(normalizeProduct):[],
    promotions:Array.isArray(source.promotions)?source.promotions:[],
    quotes:Array.isArray(source.quotes)?source.quotes:[]
  };
}

function normalizeProduct(product){
  const p=product&&typeof product==='object'?product:{};
  const id=String(p.productId||p.id||p.sku||'').trim();
  const groupCode=String(p.groupCode||'').trim();
  const productName=String(p.productName||p.itemName||'').trim();
  const description=String(p.description||p.itemDesc||'').trim();
  return {
    ...p,
    id,
    productId:id,
    sku:id,
    productCode:id,
    productName,
    description,
    brand:String(p.brand||'').trim(),
    discountGroup:String(p.discountGroup||'').trim(),
    category:groupCode,
    groupCode,
    group:groupCode,
    unit:String(p.unit||'').trim(),
    listPrice:parseClientNumber(p.listPrice),
    imageUrl:String(p.imageUrl||'').trim(),
    active:String(p.active||p.status||'').trim(),
    notes:String(p.notes||'').trim(),
    promoText:String(p.promoText||'').trim()
  };
}

function normalizeCustomer(customer){
  const c=customer&&typeof customer==='object'?customer:{};
  const code=String(c.customerId||c.customerCode||c.id||'').trim();
  const status=String(c.status||'').trim();
  const defaultGyprocDiscount=String(c.defaultGyprocDiscount||'').trim();
  const defaultWeberDiscount=String(c.defaultWeberDiscount||'').trim();
  const hasGyproc=defaultGyprocDiscount!=='';
  const hasWeber=defaultWeberDiscount!=='';
  const customerType=hasGyproc&&hasWeber?'Gyproc/Weber':hasGyproc?'Gyproc':hasWeber?'Weber':'-';
  return {
    ...c,
    id:code,
    customerId:code,
    customerCode:code,
    customerName:String(c.customerName||'').trim(),
    status,
    customerType,
    defaultGyprocDiscount,
    defaultWeberDiscount,
    notes:String(c.notes||'').trim(),
    address:String(c.address||'').trim(),
    province:String(c.province||'').trim(),
    phone:String(c.phone||'-').trim()||'-',
    active:!status||['true','yes','1','active'].includes(status.toLowerCase())
  };
}

function showApp(){
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  renderAll();
}

async function loadData(options){
  const force=!!(options&&options.force);
  if(bootstrapLoaded&&!force){
    return {ok:true,data:DB,cached:true};
  }
  if(bootstrapPromise&&!force){
    return bootstrapPromise;
  }
  bootstrapPromise=(async()=>{
    try {
      toast('กำลังโหลด...');
      let r = await callApi('bootstrap', force ? { force: true } : {});
      if (!r.ok) {
        toast('โหลดข้อมูลไม่สำเร็จ: ' + r.message);
        return r;
      }
      DB = normalizeDb(r.data);
      bootstrapLoaded=true;
      renderAll();
      return r;
    } catch (e) {
      toast('โหลดข้อมูลไม่สำเร็จ: ' + (e && e.message ? e.message : e));
      return {ok:false,message:e&&e.message?e.message:String(e)};
    } finally {
      bootstrapPromise=null;
    }
  })();
  return bootstrapPromise;
}
function toggleMenu(open){document.getElementById('sidebar').classList.toggle('open',open); document.getElementById('overlay').classList.toggle('show',open)}
function go(page,btn){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); document.getElementById('page-'+page).classList.add('active'); document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active')); if(btn)btn.classList.add('active'); toggleMenu(false); window.scrollTo({top:0,behavior:'smooth'});}
function renderAll(){renderBrand();renderProfile();renderHome();renderCustomers();renderProducts();renderPromos();renderQuote();renderHistory();renderSettings();}
function renderBrand(){let s=DB.settings||{}; document.getElementById('brandCompany').textContent=s.companyName||'SAINT-GOBAIN'; document.getElementById('brandApp').textContent=s.appName||'SALES SYSTEM'; document.title=(s.companyName||'Saint-Gobain')+' Sales System';}
function greeting(){let h=new Date().getHours(),s=DB.settings||{}; if(h<12)return s.greetingMorning||'สวัสดีตอนเช้า'; if(h<17)return s.greetingAfternoon||'สวัสดีตอนบ่าย'; if(h<21)return s.greetingEvening||'สวัสดีตอนเย็น'; return s.greetingNight||'สวัสดีตอนดึก';}
function renderProfile(){if(!USER)return; document.getElementById('sideName').textContent=USER.displayName||USER.username; document.getElementById('sidePosition').textContent=USER.position||'Sales Executive'; document.getElementById('sideAvatar').innerHTML=USER.photoUrl?`<img src="${USER.photoUrl}">`:'👩🏻';}
function renderHome(){let name=(USER?.displayName||'ก้อย').split(' ')[0]; document.getElementById('greetingText').textContent=`${greeting()}, ${name} 👋`; document.getElementById('welcomeText').textContent=DB.settings?.welcomeText||'เริ่มต้นวันใหม่อย่างมีประสิทธิภาพนะคะ'; document.getElementById('statQuotes').textContent=DB.quotes.length; document.getElementById('statSales').textContent=Number(DB.quotes.reduce((s,q)=>s+Number(q.total||0),0)).toLocaleString('th-TH'); document.getElementById('statCustomers').textContent=DB.customers.length; document.getElementById('statPending').textContent=DB.quotes.filter(q=>q.status==='รออนุมัติ').length; document.getElementById('latestCustomers').innerHTML=DB.customers.slice(0,4).map(c=>`<div class="row">🏪 <b>${c.customerName||'-'}</b><span style="margin-left:auto;color:var(--muted)">${c.province||''}</span></div>`).join(''); document.getElementById('activePromos').innerHTML=DB.promotions.slice(0,4).map(p=>`<div class="row"><span class="pill ${p.brand==='Weber'?'yellow':'blue'}">${p.brand||'-'}</span><div><b>${p.productName||'-'}</b><br><small>${p.description||p.discountText||''}</small></div></div>`).join(''); document.getElementById('bestProducts').innerHTML=DB.products.slice(0,3).map((p,i)=>`<div><div class="product-img">${p.brand==='Weber'?'🟨':'🟦'}</div><span class="pill ${p.brand==='Weber'?'yellow':'blue'}">${i+1}</span><h3>${p.productName||'-'}</h3><p style="color:var(--muted)">${p.brand||''}</p></div>`).join(''); document.getElementById('rProducts').textContent=DB.products.length; document.getElementById('rCustomers').textContent=DB.customers.length; document.getElementById('rPromos').textContent=DB.promotions.length; document.getElementById('rQuotes').textContent=DB.quotes.length;}
function ensureCustomerCrmUi(){
  const page=document.getElementById('page-customers');
  const toolbar=page?.querySelector('.toolbar');
  const grid=$('customerGrid');
  if(toolbar&&!$('customerTypeFilter')){
    const filter=document.createElement('select');
    filter.id='customerTypeFilter';
    filter.className='search customer-filter';
    filter.innerHTML='<option value="">ทั้งหมด</option><option>Gyproc</option><option>Weber</option><option>Gyproc/Weber</option>';
    filter.onchange=renderCustomers;
    toolbar.appendChild(filter);
  }
  if(grid&&!$('customerSummary')){
    const summary=document.createElement('div');
    summary.id='customerSummary';
    summary.className='crm-summary';
    grid.parentNode.insertBefore(summary,grid);
  }
}
function customerSearchText(c){return [c.customerId,c.customerCode,c.customerName,c.province,c.customerType,c.phone,c.notes,c.address].join(' ').toLowerCase()}
function renderCustomerSummary(customers){let counts={all:customers.length,gyro:0,weber:0,both:0}; customers.forEach(c=>{if(c.customerType==='Gyproc')counts.gyro++; if(c.customerType==='Weber')counts.weber++; if(c.customerType==='Gyproc/Weber')counts.both++;}); let el=$('customerSummary'); if(el)el.innerHTML=`<div class="crm-stat"><small>ร้านค้าทั้งหมด</small><b>${counts.all}</b></div><div class="crm-stat"><small>Gyproc</small><b>${counts.gyro}</b></div><div class="crm-stat"><small>Weber</small><b>${counts.weber}</b></div><div class="crm-stat"><small>Gyproc/Weber</small><b>${counts.both}</b></div>`}
function renderCustomers(){ensureCustomerCrmUi();let q=$('customerSearch')?.value||'';let type=($('customerTypeFilter')?.value||'');let fields=['customerId','customerCode','customerName','province','customerType','phone','notes','address'];let customers=DB.customers.filter(c=>smartMatch(c,q,fields)&&(!type||c.customerType===type));let limited=limitList(customers,LIST_RENDER_LIMIT);renderCustomerSummary(DB.customers);let grid=$('customerGrid'); if(!grid)return; grid.innerHTML=renderLimitNotice(limited.limited,LIST_RENDER_LIMIT)+limited.items.map(c=>`<div class="card"><h3>${c.customerName||'-'}</h3><p>รหัสร้านค้า: ${c.customerCode||c.customerId||c.id||'-'}</p><p>ประเภท: ${c.customerType||'-'}</p><p>จังหวัด: ${c.province||'-'}</p><p>โทร: ${c.phone||'-'}</p><p>ที่อยู่: ${c.address||'-'}</p><p>หมายเหตุ: ${c.notes||'-'}</p><button class="ghost" onclick="selectCustomer('${c.customerId}')">ออกใบเสนอราคา</button></div>`).join('')}
function productSearchText(p){return [p.productId,p.sku,p.productName,p.description,p.brand,p.discountGroup,p.groupCode,p.unit,p.notes,p.promoText].join(' ').toLowerCase()}
function getProductDiscount(customerId, product){
  const groupCode=String(product&&product.groupCode||'').trim();
  return callApi('discount',{customerId:customerId,groupCode:groupCode});
}
function renderProducts(){let q=$('searchProducts')?.value||''; let grid=$('productGrid'); if(!grid)return; let fields=['productId','sku','productName','description','brand','discountGroup','groupCode','unit','notes','promoText']; let products=DB.products.filter(p=>smartMatch(p,q,fields));let limited=limitList(products,LIST_RENDER_LIMIT); grid.innerHTML=renderLimitNotice(limited.limited,LIST_RENDER_LIMIT)+limited.items.map(p=>`<div class="card"><span class="pill ${p.brand==='Weber'?'yellow':'blue'}">${p.brand||'-'}</span><h3>${p.productName||'-'}</h3><p>รหัสสินค้า: ${p.sku||p.productId||p.id||'-'}</p><p>${p.unit||'-'}</p><b>${money(p.listPrice)}</b><br><button class="ghost" onclick='addCart(${JSON.stringify(p)})'>เพิ่มลงใบเสนอราคา</button></div>`).join('')}
function setupQuoteSearchEnhancements(){
  const originalRenderQuote=window.renderQuote;
  const originalSelectCustomer=window.selectCustomer;
  const originalNewQuotation=window.newQuotation;
  if(!window.__quoteSearchClickBound){
    document.addEventListener('click',function(event){
      const field=document.querySelector('.quote-customer-field');
      if(field&&!field.contains(event.target)){
        const picker=$('quoteCustomerPicker');
        if(picker)picker.classList.remove('show');
      }
    });
    window.__quoteSearchClickBound=true;
  }
  window.renderQuote=function(){
    if(typeof originalRenderQuote==='function')originalRenderQuote();
    syncQuoteCustomerSearch();
    renderQuoteCustomerPicker(false);
    renderQuoteProductPicker();
  };
  window.renderProductPicker=renderQuoteProductPicker;
  window.selectCustomer=function(customerId){
    setSelectedQuoteCustomer(customerId,true);
    return typeof originalSelectCustomer==='function'?originalSelectCustomer(customerId):null;
  };
  window.newQuotation=async function(customerId){
    const id=String(customerId||getSelectedQuoteCustomerId()||'').trim();
    const result=typeof originalNewQuotation==='function'?await originalNewQuotation(id):null;
    setSelectedQuoteCustomer(id,true);
    return result;
  };
}
function getQuoteCustomerFields(){return ['customerId','customerCode','customerName','province','customerType'];}
function getQuoteProductFields(){return ['productId','sku','productName','description','brand','discountGroup','groupCode','unit','notes','promoText','listPrice'];}
function getSelectedQuoteCustomerId(){return String(selectedCustomerId||$('quoteCustomer')?.value||'').trim();}
function findCustomerById(customerId){const id=String(customerId||'').trim();return DB.customers.find(c=>String(c.customerId||c.customerCode||c.id||'').trim()===id)||null;}
function syncQuoteCustomerSearch(){const input=$('quoteCustomerSearch');if(!input)return;const customer=findCustomerById(getSelectedQuoteCustomerId());if(customer&&document.activeElement!==input)input.value=customer.customerName||customer.customerCode||customer.customerId||'';}
function setSelectedQuoteCustomer(customerId,updateInput){
  const id=String(customerId||'').trim();
  const hidden=$('quoteCustomer');
  if(hidden)hidden.value=id;
  selectedCustomerId=id;
  window.selectedCustomerId=id;
  if(updateInput){
    const customer=findCustomerById(id);
    const input=$('quoteCustomerSearch');
    if(input)input.value=customer?customer.customerName||customer.customerCode||id:id;
  }
}
function renderQuoteCustomerPicker(forceShow){
  const picker=$('quoteCustomerPicker'),input=$('quoteCustomerSearch');
  if(!picker||!input)return;
  const q=input.value||'';
  const shouldShow=forceShow||document.activeElement===input;
  if(!shouldShow){picker.classList.remove('show');picker.innerHTML='';return;}
  const matches=DB.customers.filter(c=>smartMatch(c,q,getQuoteCustomerFields())).slice(0,8);
  picker.classList.add('show');
  picker.innerHTML=matches.length?matches.map(c=>`<button type="button" class="quote-option" onclick="chooseQuoteCustomer('${c.customerId}')"><b>${c.customerName||'-'}</b><small>รหัสร้านค้า: ${c.customerCode||c.customerId||'-'} · ${c.province||'-'} · ${c.customerType||'-'}</small></button>`).join(''):'<div class="quote-empty">ไม่พบรายการที่ค้นหา</div>';
}
function chooseQuoteCustomer(customerId){
  setSelectedQuoteCustomer(customerId,true);
  const picker=$('quoteCustomerPicker');
  if(picker)picker.classList.remove('show');
}
function renderQuoteProductPicker(){
  const q=$('productSearch')?.value||'';
  const picker=$('productPicker');
  if(!picker)return;
  const matches=DB.products.filter(p=>smartMatch(p,q,getQuoteProductFields())).slice(0,8);
  picker.innerHTML=matches.length?matches.map(p=>`<div class="row"><div class="product-img">${p.brand==='Weber'?'🟨':'🟦'}</div><div><b>${p.productName||'-'}</b><br><small>${p.brand||'-'} · รหัสสินค้า: ${p.sku||p.productId||p.id||'-'} · ${p.unit||'-'} · ${money(p.listPrice)}</small></div><button class="tiny" style="margin-left:auto" onclick='addCart(${JSON.stringify(p)})'>+ เพิ่ม</button></div>`).join(''):'<div class="row quote-empty">ไม่พบรายการที่ค้นหา</div>';
}
function renderPromos(){let q=($('searchPromos')?.value||'').toLowerCase(); $('promoGrid').innerHTML=DB.promotions.filter(p=>JSON.stringify(p).toLowerCase().includes(q)).map(p=>`<div class="card"><span class="pill ${p.brand==='Weber'?'yellow':'blue'}">${p.brand}</span><h3>${p.productName}</h3><p>${p.description||''}</p><b>${p.discountText||''}</b><p style="color:var(--muted)">${p.startDate||''} - ${p.endDate||''}</p></div>`).join('')}
function normalizeQuoteRecord(quote){
  const q=quote&&typeof quote==='object'?quote:{};
  const quoteId=String(q.quoteId||q.quoteNo||'').trim();
  const quoteNo=String(q.quoteNo||q.quoteId||'').trim();
  return {
    ...q,
    quoteId,
    quoteNo,
    customerId:String(q.customerId||'').trim(),
    customerName:String(q.customerName||'').trim(),
    subtotal:parseClientNumber(q.subtotal),
    vat:parseClientNumber(q.vat),
    shipping:parseClientNumber(q.shipping),
    specialDiscount:parseClientNumber(q.specialDiscount),
    grandTotal:parseClientNumber(q.grandTotal||q.total),
    total:parseClientNumber(q.grandTotal||q.total),
    status:String(q.status||'').trim()||'-',
    createdAt:String(q.createdAt||'').trim(),
    updatedAt:String(q.updatedAt||'').trim()
  };
}
function getQuoteSearchFields(){return ['quoteNo','quoteId','customerName','customerId','status'];}
function formatDateTime(value){
  if(!value)return '-';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return String(value);
  return d.toLocaleString('th-TH',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function renderHistory(){
  const history=$('quoteHistory');
  if(!history)return;
  const keyword=$('quoteHistorySearch')?.value||'';
  const quotes=(Array.isArray(DB.quotes)?DB.quotes:[]).map(normalizeQuoteRecord).filter(q=>smartMatch(q,keyword,getQuoteSearchFields())).sort((a,b)=>new Date(b.createdAt||b.updatedAt||0)-new Date(a.createdAt||a.updatedAt||0));
  history.innerHTML=quotes.length?quotes.map(q=>`<div class="row quote-history-row"><div><b>${q.quoteNo||'-'}</b><br><small>${q.customerName||'-'} · ${q.customerId||'-'}</small></div><span class="pill ${q.status==='CANCELLED'?'yellow':'blue'}">${q.status||'-'}</span><span>${formatDateTime(q.createdAt)}</span><b style="margin-left:auto">${money(q.grandTotal||q.total)}</b><button class="tiny" onclick="openQuotationDetail('${q.quoteId}')">เปิดดู</button><button class="tiny" onclick="editQuotationFromHistory('${q.quoteId}')">แก้ไข</button></div>`).join(''):'<p style="color:var(--muted)">ยังไม่มีใบเสนอราคา</p>';
}
async function refreshQuotationHistory(){
  try{
    const response=await callApi('getQuotationHistory',{});
    if(!response.ok){
      toast(response.message||'โหลดประวัติใบเสนอราคาไม่สำเร็จ');
      return response;
    }
    DB.quotes=Array.isArray(response.data)?response.data.map(normalizeQuoteRecord):[];
    renderHistory();
    renderHome();
    return response;
  }catch(error){
    console.error(error);
    toast('โหลดประวัติใบเสนอราคาไม่สำเร็จ');
  }
}
function renderQuotationDetail(data){
  const box=$('quoteDetail');
  if(!box)return;
  if(!data){
    box.classList.add('hidden');
    box.innerHTML='';
    return;
  }
  const quote=normalizeQuoteRecord(data.quote||{});
  const lines=Array.isArray(data.lines)?data.lines:[];
  const totals=data.totals||{};
  box.classList.remove('hidden');
  box.innerHTML=`<div class="section-title"><div><h2>${quote.quoteNo||quote.quoteId||'-'}</h2><p style="color:var(--muted);margin:4px 0 0">${quote.customerName||'-'} · ${quote.customerId||'-'}</p></div><span class="pill ${quote.status==='CANCELLED'?'yellow':'blue'}">${quote.status||'-'}</span></div><div class="quote-detail-meta"><span>วันที่: ${formatDateTime(quote.createdAt)}</span><span>ยอดสุทธิ: ${money(totals.grandTotal||quote.grandTotal)}</span></div><div class="list quote-detail-lines">${lines.length?lines.map((line,index)=>`<div class="row"><div><b>${line.productName||'-'}</b><br><small>${line.productId||'-'} · ${line.unit||'-'}</small></div><span>จำนวน ${line.qty||0}</span><span>ราคา ${money(line.listPrice)}</span><span>ส่วนลด ${line.discountPercent||0}%</span><b style="margin-left:auto">${money(line.grandTotal||line.lineTotal)}</b></div>`).join(''):'<p style="color:var(--muted)">ไม่มีรายการสินค้า</p>'}</div><div class="quote-total-box"><p>Subtotal <b>${money(totals.subtotal||quote.subtotal)}</b></p><p>VAT <b>${money(totals.vat||quote.vat)}</b></p><p>Grand Total <b>${money(totals.grandTotal||quote.grandTotal)}</b></p></div><div class="actions no-print"><button class="ghost" onclick="editQuotationFromHistory('${quote.quoteId}')">แก้ไข</button><button class="ghost" onclick="duplicateQuotationFromHistory('${quote.quoteId}')">Duplicate</button><button class="yellow" onclick="cancelQuotationFromHistory('${quote.quoteId}')">Cancel</button><button class="primary" onclick="window.print()">Print</button></div>`;
}
async function openQuotationDetail(quoteId){
  try{
    const response=await callApi('loadQuotation',{quoteId});
    if(!response.ok){
      toast(response.message||'เปิดใบเสนอราคาไม่สำเร็จ');
      return response;
    }
    renderQuotationDetail(response.data);
    return response;
  }catch(error){
    console.error(error);
    toast('เปิดใบเสนอราคาไม่สำเร็จ');
  }
}
async function duplicateQuotationFromHistory(quoteId){
  try{
    const response=await callApi('duplicateQuotation',{quoteId});
    if(!response.ok){
      toast(response.message||'Duplicate ไม่สำเร็จ');
      return response;
    }
    toast('สร้างสำเนาใบเสนอราคาแล้ว');
    await refreshQuotationHistory();
    const newQuoteId=response.data?.newQuoteId||response.data?.quoteId;
    if(newQuoteId)await openQuotationDetail(newQuoteId);
    return response;
  }catch(error){
    console.error(error);
    toast('Duplicate ไม่สำเร็จ');
  }
}
async function editQuotationFromHistory(quoteId){
  if(typeof loadQuotation!=='function'){
    toast('ไม่พบฟังก์ชันโหลดใบเสนอราคา');
    return;
  }
  const response=await loadQuotation(quoteId);
  if(response&&response.ok){
    go('quote');
  }
  return response;
}
async function cancelQuotationFromHistory(quoteId){
  try{
    const response=await callApi('cancelQuotation',{quoteId});
    if(!response.ok){
      toast(response.message||'Cancel ไม่สำเร็จ');
      return response;
    }
    toast('ยกเลิกใบเสนอราคาแล้ว');
    await refreshQuotationHistory();
    await openQuotationDetail(quoteId);
    return response;
  }catch(error){
    console.error(error);
    toast('Cancel ไม่สำเร็จ');
  }
}
function renderSettings(){if(!USER)return;let s=DB.settings||{}; let set=(id,val)=>{let el=$(id); if(el)el.value=val||''}; set('setDisplay',USER.displayName); set('setPosition',USER.position); set('setPhone',USER.phone); set('setPhoto',USER.photoUrl); set('setCompany',s.companyName||'SAINT-GOBAIN'); set('setAppName',s.appName||'SALES SYSTEM'); set('setWelcome',s.welcomeText); set('setMorning',s.greetingMorning); set('setAfternoon',s.greetingAfternoon); set('setEvening',s.greetingEvening); set('setNight',s.greetingNight); updateProfilePreview(USER.photoUrl||'');}
function openSettingPage(name){document.querySelectorAll('#page-settings .setting-sub').forEach(x=>x.classList.remove('active')); let id=name==='home'?'settingsHome':'setting'+name.charAt(0).toUpperCase()+name.slice(1); let el=$(id); if(el)el.classList.add('active'); renderSettings(); window.scrollTo({top:0,behavior:'smooth'});}
function updateProfilePreview(src){let box=$('profilePreview'); if(!box)return; box.innerHTML=src?`<img src="${src}">`:'👩🏻';}
function handleProfileImage(ev){let file=ev.target.files&&ev.target.files[0]; if(!file)return; let reader=new FileReader(); reader.onload=e=>{let img=new Image(); img.onload=()=>{let canvas=document.createElement('canvas'); let max=320,scale=Math.min(max/img.width,max/img.height,1); canvas.width=Math.round(img.width*scale); canvas.height=Math.round(img.height*scale); let ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0,canvas.width,canvas.height); let data=canvas.toDataURL('image/jpeg',0.78); document.getElementById('setPhoto').value=data; updateProfilePreview(data); toast('อัพโหลดรูปแล้ว กดบันทึกโปรไฟล์เพื่อใช้งาน');}; img.src=e.target.result;}; reader.readAsDataURL(file);}
async function saveProfile(){
  let p = {
    userId: USER.userId,
    displayName: document.getElementById('setDisplay').value,
    position: document.getElementById('setPosition').value,
    phone: document.getElementById('setPhone').value,
    photoUrl: document.getElementById('setPhoto').value
  };
  let r = await gas('updateProfile', p);
  toast(r.message);
  if (r.ok) {
    USER = r.data;
    localStorage.setItem('currentUser', JSON.stringify(USER));
    renderProfile();
    renderHome();
  }
}
async function saveSettings(){
  let p = {
    companyName: document.getElementById('setCompany').value,
    appName: document.getElementById('setAppName').value,
    welcomeText: document.getElementById('setWelcome').value,
    greetingMorning: document.getElementById('setMorning').value,
    greetingAfternoon: document.getElementById('setAfternoon').value,
    greetingEvening: document.getElementById('setEvening').value,
    greetingNight: document.getElementById('setNight').value
  };
  let r = await gas('updateSettings', p);
  toast(r.message);
  if (r.ok) {
    DB.settings = r.data;
    renderBrand();
    renderHome();
  }
}
function openModal(type){let title={customer:'เพิ่มร้านค้า',product:'เพิ่มสินค้า',promo:'เพิ่มโปรโมชั่น'}[type]; document.getElementById('modalTitle').textContent=title; let html=''; if(type==='customer')html=`<div class="field"><label>ชื่อร้าน</label><input id="mName"></div><div class="field"><label>จังหวัด</label><input id="mProvince"></div><div class="field"><label>โทร</label><input id="mPhone"></div><button class="primary" onclick="saveModal('customer')">บันทึก</button>`; if(type==='product')html=`<div class="field"><label>ชื่อสินค้า</label><input id="mName"></div><div class="field"><label>แบรนด์</label><select id="mBrand"><option>Weber</option><option>Gyproc</option></select></div><div class="field"><label>หน่วย</label><input id="mUnit"></div><div class="field"><label>ราคา</label><input id="mPrice" type="number"></div><button class="primary" onclick="saveModal('product')">บันทึก</button>`; if(type==='promo')html=`<div class="field"><label>แบรนด์</label><select id="mBrand"><option>Weber</option><option>Gyproc</option></select></div><div class="field"><label>สินค้า</label><input id="mName"></div><div class="field"><label>รายละเอียด</label><textarea id="mDesc"></textarea></div><div class="field"><label>ส่วนลด/โปร</label><input id="mDiscount"></div><button class="primary" onclick="saveModal('promo')">บันทึก</button>`; document.getElementById('modalBody').innerHTML=html; document.getElementById('modal').classList.add('show')}
function closeModal(){document.getElementById('modal').classList.remove('show')}
async function saveModal(type){
  let r;
  if (type === 'customer') r = await gas('saveCustomer', {
    customerName: document.getElementById('mName').value,
    province: document.getElementById('mProvince').value,
    phone: document.getElementById('mPhone').value,
    sales: USER?.displayName
  });
  if (type === 'product') r = await gas('saveProduct', {
    productName: document.getElementById('mName').value,
    brand: document.getElementById('mBrand').value,
    unit: document.getElementById('mUnit').value,
    listPrice: document.getElementById('mPrice').value
  });
  if (type === 'promo') r = await gas('savePromotion', {
    productName: document.getElementById('mName').value,
    brand: document.getElementById('mBrand').value,
    description: document.getElementById('mDesc').value,
    discountText: document.getElementById('mDiscount').value
  });
  closeModal();
  toast('บันทึกแล้ว');
  await loadData({force:true});
}
function toast(msg){const el=document.getElementById('toast'); if(!el)return; el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2600)}

function renderCustomers(){ensureCustomerCrmUi();let q=$('customerSearch')?.value||'';let type=($('customerTypeFilter')?.value||'');let fields=['customerId','customerCode','customerName','province','customerType','phone','notes','address'];let customers=DB.customers.filter(c=>smartMatch(c,q,fields)&&(!type||c.customerType===type));let limited=limitList(customers,LIST_RENDER_LIMIT);renderCustomerSummary(DB.customers);let grid=$('customerGrid'); if(!grid)return; grid.innerHTML=renderLimitNotice(limited.limited,LIST_RENDER_LIMIT)+limited.items.map(c=>`<div class="card"><h3>${c.customerName||'-'}</h3><p>รหัสร้านค้า: ${c.customerCode||c.customerId||c.id||'-'}</p><p>ประเภท: ${c.customerType||'-'}</p><p>จังหวัด: ${c.province||'-'}</p><p>โทร: ${c.phone||'-'}</p><p>ที่อยู่: ${c.address||'-'}</p><p>หมายเหตุ: ${c.notes||'-'}</p><button class="ghost" onclick="selectCustomer('${c.customerId}')">ออกใบเสนอราคา</button></div>`).join('')}

function renderProducts(){let q=$('searchProducts')?.value||''; let grid=$('productGrid'); if(!grid)return; let fields=['productId','sku','productName','description','brand','discountGroup','groupCode','unit','notes','promoText']; let products=DB.products.filter(p=>smartMatch(p,q,fields));let limited=limitList(products,LIST_RENDER_LIMIT); grid.innerHTML=renderLimitNotice(limited.limited,LIST_RENDER_LIMIT)+limited.items.map(p=>`<div class="card"><span class="pill ${p.brand==='Weber'?'yellow':'blue'}">${p.brand||'-'}</span><h3>${p.productName||'-'}</h3><p>รหัสสินค้า: ${p.sku||p.productId||p.id||'-'}</p><p>${p.unit||'-'}</p><b>${money(p.listPrice)}</b><br><button class="ghost" onclick='addCart(${JSON.stringify(p)})'>เพิ่มลงใบเสนอราคา</button></div>`).join('')}

function renderQuoteCustomerPicker(forceShow){
  const picker=$('quoteCustomerPicker'),input=$('quoteCustomerSearch');
  if(!picker||!input)return;
  const q=input.value||'';
  const shouldShow=forceShow||document.activeElement===input;
  if(!shouldShow){picker.classList.remove('show');picker.innerHTML='';return;}
  const matchesAll=DB.customers.filter(c=>smartMatch(c,q,getQuoteCustomerFields()));
  const limited=limitList(matchesAll,QUOTE_PICKER_LIMIT);
  picker.classList.add('show');
  picker.innerHTML=limited.items.length?renderLimitNotice(limited.limited,QUOTE_PICKER_LIMIT)+limited.items.map(c=>`<button type="button" class="quote-option" onclick="chooseQuoteCustomer('${c.customerId}')"><b>${c.customerName||'-'}</b><small>รหัสร้านค้า: ${c.customerCode||c.customerId||'-'} · ${c.province||'-'} · ${c.customerType||'-'}</small></button>`).join(''):'<div class="quote-empty">ไม่พบรายการที่ค้นหา</div>';
}

function renderQuoteProductPicker(){
  const q=$('productSearch')?.value||'';
  const picker=$('productPicker');
  if(!picker)return;
  const matchesAll=DB.products.filter(p=>smartMatch(p,q,getQuoteProductFields()));
  const limited=limitList(matchesAll,QUOTE_PICKER_LIMIT);
  picker.innerHTML=limited.items.length?renderLimitNotice(limited.limited,QUOTE_PICKER_LIMIT)+limited.items.map(p=>`<div class="row"><div class="product-img">${p.brand==='Weber'?'🟨':'🟦'}</div><div><b>${p.productName||'-'}</b><br><small>${p.brand||'-'} · รหัสสินค้า: ${p.sku||p.productId||p.id||'-'} · ${p.unit||'-'} · ${money(p.listPrice)}</small></div><button class="tiny" style="margin-left:auto" onclick='addCart(${JSON.stringify(p)})'>+ เพิ่ม</button></div>`).join(''):'<div class="row quote-empty">ไม่พบรายการที่ค้นหา</div>';
}

window.toggleMenu=toggleMenu; window.go=go; window.normalizeDb=normalizeDb; window.normalizeProduct=normalizeProduct; window.normalizeCustomer=normalizeCustomer; window.showApp=showApp; window.loadData=loadData; window.renderAll=renderAll; window.renderBrand=renderBrand; window.greeting=greeting; window.renderProfile=renderProfile; window.renderHome=renderHome; window.renderCustomers=renderCustomers; window.renderProducts=renderProducts; window.getProductDiscount=getProductDiscount; window.renderQuoteCustomerPicker=renderQuoteCustomerPicker; window.chooseQuoteCustomer=chooseQuoteCustomer; window.renderQuoteProductPicker=renderQuoteProductPicker; window.renderPromos=renderPromos; window.renderHistory=renderHistory; window.refreshQuotationHistory=refreshQuotationHistory; window.openQuotationDetail=openQuotationDetail; window.editQuotationFromHistory=editQuotationFromHistory; window.duplicateQuotationFromHistory=duplicateQuotationFromHistory; window.cancelQuotationFromHistory=cancelQuotationFromHistory; window.renderSettings=renderSettings; window.openSettingPage=openSettingPage; window.updateProfilePreview=updateProfilePreview; window.handleProfileImage=handleProfileImage; window.saveProfile=saveProfile; window.saveSettings=saveSettings; window.openModal=openModal; window.closeModal=closeModal; window.saveModal=saveModal; window.toast=toast;
