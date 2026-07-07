let DB=normalizeDb(), USER=null, CART=[];
const $=id=>document.getElementById(id); const money=n=>Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
function parseClientNumber(value){const n=Number(String(value||'').replace(/,/g,'')); return Number.isFinite(n)?n:0}
window.addEventListener('load',()=>{
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

async function loadData(){
  try {
    let r = await callApi('bootstrap', {});
    if (!r.ok) {
      toast('โหลดข้อมูลไม่สำเร็จ: ' + r.message);
      return;
    }
    DB = normalizeDb(r.data);
    renderAll();
  } catch (e) {
    toast('โหลดข้อมูลไม่สำเร็จ: ' + (e && e.message ? e.message : e));
  }
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
function customerSearchText(c){return [c.customerId,c.customerName,c.province,c.customerType,c.notes,c.address].join(' ').toLowerCase()}
function renderCustomerSummary(customers){let counts={all:customers.length,gyro:0,weber:0,both:0}; customers.forEach(c=>{if(c.customerType==='Gyproc')counts.gyro++; if(c.customerType==='Weber')counts.weber++; if(c.customerType==='Gyproc/Weber')counts.both++;}); let el=$('customerSummary'); if(el)el.innerHTML=`<div class="crm-stat"><small>ร้านค้าทั้งหมด</small><b>${counts.all}</b></div><div class="crm-stat"><small>Gyproc</small><b>${counts.gyro}</b></div><div class="crm-stat"><small>Weber</small><b>${counts.weber}</b></div><div class="crm-stat"><small>Gyproc/Weber</small><b>${counts.both}</b></div>`}
function renderCustomers(){ensureCustomerCrmUi();let q=($('customerSearch')?.value||'').toLowerCase();let type=($('customerTypeFilter')?.value||'');let customers=DB.customers.filter(c=>(!q||customerSearchText(c).includes(q))&&(!type||c.customerType===type));renderCustomerSummary(DB.customers);let grid=$('customerGrid'); if(!grid)return; grid.innerHTML=customers.map(c=>`<div class="card"><h3>${c.customerName||'-'}</h3><p>รหัสร้านค้า: ${c.customerCode||c.customerId||c.id||'-'}</p><p>ประเภท: ${c.customerType||'-'}</p><p>จังหวัด: ${c.province||'-'}</p><p>โทร: ${c.phone||'-'}</p><p>ที่อยู่: ${c.address||'-'}</p><p>หมายเหตุ: ${c.notes||'-'}</p><button class="ghost" onclick="selectCustomer('${c.customerId}')">ออกใบเสนอราคา</button></div>`).join('')}
function productSearchText(p){return [p.productId,p.sku,p.productName,p.itemDesc,p.description,p.brand,p.discountGroup,p.groupCode].join(' ').toLowerCase()}
function renderProducts(){let q=($('searchProducts')?.value||'').toLowerCase(); let grid=$('productGrid'); if(!grid)return; grid.innerHTML=DB.products.filter(p=>!q||productSearchText(p).includes(q)).map(p=>`<div class="card"><span class="pill ${p.brand==='Weber'?'yellow':'blue'}">${p.brand||'-'}</span><h3>${p.productName||'-'}</h3><p>รหัสสินค้า: ${p.sku||p.productId||p.id||'-'}</p><p>${p.unit||'-'}</p><b>${money(p.listPrice)}</b><br><button class="ghost" onclick='addCart(${JSON.stringify(p)})'>เพิ่มลงใบเสนอราคา</button></div>`).join('')}
function renderPromos(){let q=($('searchPromos')?.value||'').toLowerCase(); $('promoGrid').innerHTML=DB.promotions.filter(p=>JSON.stringify(p).toLowerCase().includes(q)).map(p=>`<div class="card"><span class="pill ${p.brand==='Weber'?'yellow':'blue'}">${p.brand}</span><h3>${p.productName}</h3><p>${p.description||''}</p><b>${p.discountText||''}</b><p style="color:var(--muted)">${p.startDate||''} - ${p.endDate||''}</p></div>`).join('')}
function renderHistory(){document.getElementById('quoteHistory').innerHTML=DB.quotes.length?DB.quotes.map(q=>`<div class="row"><b>${q.quoteId}</b><span>${q.customerName}</span><span style="margin-left:auto">${money(q.total)}</span></div>`).join(''):'ยังไม่มีใบเสนอราคา'}
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
  await loadData();
}
function toast(msg){const el=document.getElementById('toast'); if(!el)return; el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2600)}
window.toggleMenu=toggleMenu; window.go=go; window.normalizeDb=normalizeDb; window.normalizeProduct=normalizeProduct; window.normalizeCustomer=normalizeCustomer; window.showApp=showApp; window.loadData=loadData; window.renderAll=renderAll; window.renderBrand=renderBrand; window.greeting=greeting; window.renderProfile=renderProfile; window.renderHome=renderHome; window.renderCustomers=renderCustomers; window.renderProducts=renderProducts; window.renderPromos=renderPromos; window.renderHistory=renderHistory; window.renderSettings=renderSettings; window.openSettingPage=openSettingPage; window.updateProfilePreview=updateProfilePreview; window.handleProfileImage=handleProfileImage; window.saveProfile=saveProfile; window.saveSettings=saveSettings; window.openModal=openModal; window.closeModal=closeModal; window.saveModal=saveModal; window.toast=toast;
