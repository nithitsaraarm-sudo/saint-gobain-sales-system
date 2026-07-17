const SYSTEM_IDENTITY_FALLBACK={companyName:'SAINT-GOBAIN',systemName:'SALES SYSTEM',appName:'SALES SYSTEM'};
const PUBLIC_SETTINGS_CACHE_KEY='sg_public_settings_cache';
window.appState=window.appState||{};
window.appState.publicSettings=normalizeSystemIdentitySettings(window.appState.publicSettings||SYSTEM_IDENTITY_FALLBACK);
let DB=normalizeDb(), USER=null, CART=[], selectedCustomerId='';
let PRODUCT_CALC_PRODUCT=null;
let PROFILE_IMAGE_DATA='';
let bootstrapLoaded=false, bootstrapPromise=null;
let quoteHistoryLoaded=false, quoteHistoryPromise=null;
let customersLoaded=false, productsLoaded=false, customersPromise=null, customerRefreshPromise=null, productsPromise=null;
let FAVORITE_CUSTOMERS=[];
let FAVORITE_PRODUCTS=[], PINNED_PRODUCTS=[], productPreferencesLoaded=false, productPreferencesPromise=null;
const openQuotationDetailPromises={};
const LIST_RENDER_LIMIT=Number(window.DEFAULT_PAGE_SIZE||50), QUOTE_PICKER_LIMIT=30, SEARCH_DEBOUNCE_MS=300;
const APP_VERSION_STORAGE_KEY='sg_app_version';
const SIDEBAR_MODE_STORAGE_KEY='sidebarMode';
const SIDEBAR_MINI_STORAGE_KEY='sg_sidebar_mini';
const SIDEBAR_MODE_EXPANDED='expanded';
const SIDEBAR_MODE_MINI='mini';
const PINNED_PRODUCTS_COLLAPSED_KEY='sg_pinned_products_collapsed';
const FAVORITE_PRODUCTS_COLLAPSED_KEY='sg_favorite_products_collapsed';
const $=id=>document.getElementById(id); const money=n=>Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
let sidebarDrawerFocusReturn=null, sidebarDrawerHistoryPushed=false, sidebarDrawerClosingFromHistory=false;

function notifyAppVersionUpdate(){
  if(typeof toast==='function'){
    toast('มีเวอร์ชันใหม่ กำลังอัปเดต...');
    return;
  }
  const el=document.getElementById('toast');
  if(el){
    el.textContent='มีเวอร์ชันใหม่ กำลังอัปเดต...';
    el.classList.add('show');
  }
}

function clearAppCaches(){
  const cacheKeys=Array.isArray(window.APP_CACHE_KEYS)?window.APP_CACHE_KEYS:[];
  cacheKeys.forEach(key=>{
    try{
      if(typeof clearCache==='function'){
        clearCache(key);
      }else{
        localStorage.removeItem(key);
      }
    }catch(error){
      try{localStorage.removeItem(key)}catch(e){}
    }
  });
  console.log('[CACHE CLEARED]');
}

function checkAppVersion(){
  try{
    const newVersion=String(window.APP_VERSION||'0.4.0').trim();
    console.log('[APP]',window.APP_NAME||'Saint-Gobain Sales System',newVersion);
    const oldVersion=localStorage.getItem(APP_VERSION_STORAGE_KEY);
    if(oldVersion===newVersion){
      return false;
    }
    console.log('[APP VERSION]',oldVersion,'→',newVersion);
    if(!oldVersion){
      localStorage.setItem(APP_VERSION_STORAGE_KEY,newVersion);
      return false;
    }
    clearAppCaches();
    localStorage.setItem(APP_VERSION_STORAGE_KEY,newVersion);
    notifyAppVersionUpdate();
    window.setTimeout(()=>window.location.reload(),1000);
    return true;
  }catch(error){
    console.warn('[APP VERSION] update check failed',error);
    return false;
  }
}

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

function normalizeSystemIdentitySettings(settings){
  const source=settings&&typeof settings==='object'?settings:{};
  const companyName=String(source.companyName||source.COMPANY_NAME_EN||SYSTEM_IDENTITY_FALLBACK.companyName).trim()||SYSTEM_IDENTITY_FALLBACK.companyName;
  const systemName=String(source.systemName||source.SYSTEM_NAME||source.appName||SYSTEM_IDENTITY_FALLBACK.systemName).trim()||SYSTEM_IDENTITY_FALLBACK.systemName;
  return {companyName,systemName,appName:systemName};
}

function getCachedPublicSystemSettings(){
  try{
    if(typeof getCache==='function'){
      return getCache(PUBLIC_SETTINGS_CACHE_KEY);
    }
    const raw=localStorage.getItem(PUBLIC_SETTINGS_CACHE_KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    return parsed&&parsed.data?parsed.data:parsed;
  }catch(error){
    return null;
  }
}

function cachePublicSystemSettings(settings){
  try{
    if(typeof setCache==='function'){
      setCache(PUBLIC_SETTINGS_CACHE_KEY,settings,15);
    }else{
      localStorage.setItem(PUBLIC_SETTINGS_CACHE_KEY,JSON.stringify({expiresAt:Date.now()+15*60*1000,data:settings}));
    }
  }catch(error){}
}

function getSystemIdentitySettingsForUi(){
  return normalizeSystemIdentitySettings(window.appState?.publicSettings||DB?.publicSettings||DB?.settings||SYSTEM_IDENTITY_FALLBACK);
}

function renderLoginBranding(settings){
  const s=normalizeSystemIdentitySettings(settings);
  const company=$('loginBrandCompany')||document.querySelector('#loginView .brand-title');
  const system=$('loginBrandSystem')||document.querySelector('#loginView .brand-sub');
  if(company)company.textContent=s.companyName;
  if(system)system.textContent=s.systemName;
}

function renderSidebarBranding(settings){
  const s=normalizeSystemIdentitySettings(settings);
  const company=$('brandCompany');
  const system=$('brandApp');
  if(company){
    company.textContent=s.companyName;
    company.title=s.companyName;
  }
  if(system){
    system.textContent=s.systemName;
    system.title=s.systemName;
  }
}

function applySystemIdentityToUI(settings){
  const s=normalizeSystemIdentitySettings(settings||window.appState?.publicSettings||DB?.publicSettings||DB?.settings||SYSTEM_IDENTITY_FALLBACK);
  renderLoginBranding(s);
  renderSidebarBranding(s);
  document.title=s.companyName+' '+s.systemName;
  return s;
}

function setPublicSystemSettings(settings,options){
  const s=normalizeSystemIdentitySettings(settings);
  window.appState.publicSettings=s;
  DB.publicSettings=s;
  DB.settings=Object.assign({},DB.settings||{},s);
  if(!(options&&options.skipCache)){
    cachePublicSystemSettings(s);
  }
  applySystemIdentityToUI(s);
  return s;
}

async function refreshPublicSystemSettings(options){
  const opts=options||{};
  const cached=getCachedPublicSystemSettings();
  if(cached&&!opts.force){
    setPublicSystemSettings(cached,{skipCache:true});
  }else{
    applySystemIdentityToUI(getSystemIdentitySettingsForUi());
  }
  try{
    const response=await callApi('getPublicSystemSettings',{force:true});
    if(response&&response.ok&&response.data){
      return setPublicSystemSettings(response.data);
    }
  }catch(error){
    if(!opts.silent&&typeof toast==='function')toast('โหลดชื่อบริษัทและชื่อระบบไม่สำเร็จ ใช้ค่าเริ่มต้นแทน');
  }
  return getSystemIdentitySettingsForUi();
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
  if(checkAppVersion())return;
  applySystemIdentityToUI(getSystemIdentitySettingsForUi());
  refreshPublicSystemSettings({silent:true});
  setupQuoteSearchEnhancements();
  setupDebouncedSearchInputs();
  const u=localStorage.getItem('sg_user')||localStorage.getItem('currentUser');
  if(u){
    try {
      USER=JSON.parse(u);
      hydrateBootstrapFromCache();
      showApp();
      loadData({silent:true});
    } catch (e) {
      localStorage.removeItem('currentUser');
    }
  }
});

function normalizeDb(data){
  const source=data&&typeof data==='object'?data:{};
  var existing={};
  try {
    existing=DB||{};
  } catch (error) {
    existing={};
  }
  const identity=normalizeSystemIdentitySettings(source.publicSettings||existing.publicSettings||window.appState?.publicSettings||source.settings||existing.settings||SYSTEM_IDENTITY_FALLBACK);
  const settings=Object.assign({},existing.settings||{},source.settings&&typeof source.settings==='object'?source.settings:{},identity);
  window.appState.publicSettings=identity;
  return {
    ...source,
    settings,
    publicSettings:identity,
    counts:source.counts&&typeof source.counts==='object'?source.counts:(existing.counts&&typeof existing.counts==='object'?existing.counts:{}),
    customers:Array.isArray(source.customers)?source.customers.map(normalizeCustomer):(Array.isArray(existing.customers)?existing.customers:[]),
    products:Array.isArray(source.products)?source.products.map(normalizeProduct):(Array.isArray(existing.products)?existing.products:[]),
    promotions:Array.isArray(source.promotions)?source.promotions:[],
    quotes:Array.isArray(source.quotes)?source.quotes:[],
    quoteLines:Array.isArray(source.quoteLines)?source.quoteLines:(Array.isArray(existing.quoteLines)?existing.quoteLines:[])
  };
}

function normalizeProduct(product){
  const p=product&&typeof product==='object'?product:{};
  const id=String(p.productId||p.id||p.sku||'').trim();
  const groupCode=String(p.groupCode||'').trim();
  const productName=String(p.productName||p.itemName||'').trim();
  const description=String(p.description||p.itemDesc||'').trim();
  const productBusinessUnit=normalizeProductBusinessUnitForUi(p);
  return {
    ...p,
    id,
    productId:id,
    sku:id,
    productCode:id,
    productName,
    description,
    brand:String(p.brand||'').trim(),
    productBusinessUnit,
    businessUnit:productBusinessUnit||String(p.businessUnit||'').trim(),
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

function isMobileSidebar(){
  return window.matchMedia&&window.matchMedia('(max-width:900px)').matches;
}

function isSidebarMini(){
  return document.getElementById('appView')?.classList.contains('sidebar-mini');
}

function getSidebarToggleButton(){
  return document.getElementById('sidebarToggle');
}

function getStoredSidebarMode(){
  try{
    const stored=localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY);
    if(stored===SIDEBAR_MODE_MINI||stored===SIDEBAR_MODE_EXPANDED)return stored;
    const legacyMini=localStorage.getItem(SIDEBAR_MINI_STORAGE_KEY);
    if(legacyMini==='true'||legacyMini==='false'){
      return legacyMini==='true'?SIDEBAR_MODE_MINI:SIDEBAR_MODE_EXPANDED;
    }
  }catch(error){}
  return SIDEBAR_MODE_EXPANDED;
}

function setStoredSidebarMode(mode){
  const normalized=mode===SIDEBAR_MODE_MINI?SIDEBAR_MODE_MINI:SIDEBAR_MODE_EXPANDED;
  try{
    localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY,normalized);
    localStorage.setItem(SIDEBAR_MINI_STORAGE_KEY,normalized===SIDEBAR_MODE_MINI?'true':'false');
  }catch(error){}
}

function placeSidebarToggleButton(){
  const button=getSidebarToggleButton();
  const desktopHost=document.getElementById('sidebarHeader');
  const mobileHost=document.getElementById('mobileSidebarToggleHost');
  if(!button||!desktopHost)return;
  const target=isMobileSidebar()?mobileHost:desktopHost;
  if(target&&button.parentNode!==target){
    target.appendChild(button);
  }
}

function setSidebarDrawer(open,options){
  const opts=options||{};
  const sidebar=document.getElementById('sidebar');
  const overlay=document.getElementById('overlay');
  const shouldOpen=!!open;
  if(!shouldOpen&&sidebarDrawerHistoryPushed&&!opts.fromHistory){
    sidebarDrawerClosingFromHistory=true;
    try{
      window.history.back();
      return;
    }catch(error){}
  }
  if(shouldOpen&&!sidebar?.classList.contains('open')){
    sidebarDrawerFocusReturn=document.activeElement instanceof HTMLElement?document.activeElement:null;
  }
  if(sidebar)sidebar.classList.toggle('open',shouldOpen);
  if(overlay)overlay.classList.toggle('show',shouldOpen);
  document.body.classList.toggle('sidebar-drawer-open',shouldOpen);
  if(shouldOpen&&!sidebarDrawerHistoryPushed&&!opts.skipHistory&&window.history&&window.history.pushState){
    try{
      window.history.pushState(Object.assign({},window.history.state||{},{sgSidebarDrawer:true}),'',window.location.href);
      sidebarDrawerHistoryPushed=true;
    }catch(error){}
  }
  if(!shouldOpen){
    sidebarDrawerHistoryPushed=false;
    sidebarDrawerClosingFromHistory=false;
    const focusTarget=sidebarDrawerFocusReturn;
    sidebarDrawerFocusReturn=null;
    if(focusTarget&&opts.restoreFocus!==false){
      window.setTimeout(function(){
        try{focusTarget.focus({preventScroll:true});}catch(error){try{focusTarget.focus();}catch(focusError){}}
      },0);
    }
  }
  updateSidebarToggleButton();
}

function setSidebarMini(mini){
  const app=document.getElementById('appView');
  const isMini=!!mini;
  if(app)app.classList.toggle('sidebar-mini',isMini);
  setStoredSidebarMode(isMini?SIDEBAR_MODE_MINI:SIDEBAR_MODE_EXPANDED);
  updateSidebarToggleButton();
}

function updateSidebarToggleButton(){
  placeSidebarToggleButton();
  const button=getSidebarToggleButton();
  if(!button)return;
  const mobile=isMobileSidebar();
  const open=document.getElementById('sidebar')?.classList.contains('open');
  const mini=isSidebarMini();
  const label=mobile?(open?'ปิด Sidebar':'เปิด Sidebar'):(mini?'ขยาย Sidebar':'ย่อ Sidebar');
  button.setAttribute('aria-label',label);
  button.setAttribute('aria-expanded',mobile?String(!!open):String(!mini));
  button.setAttribute('aria-controls','sidebar');
  button.dataset.sidebarMode=mobile?(open?'drawer-open':'drawer-closed'):(mini?SIDEBAR_MODE_MINI:SIDEBAR_MODE_EXPANDED);
  button.title=label;
}

function enhanceSidebarNavItems(){
  document.querySelectorAll('.nav button').forEach(button=>{
    if(button.dataset.sidebarReady==='true')return;
    const raw=String(button.textContent||'').trim();
    const parts=raw.split(/\s+/);
    const icon=parts.shift()||raw.slice(0,2)||'•';
    const label=parts.join(' ')||raw;
    button.innerHTML=`<span class="nav-icon" aria-hidden="true">${escapeHtml(icon)}</span><span class="nav-label">${escapeHtml(label)}</span>`;
    button.title=label;
    button.setAttribute('aria-label',label);
    button.dataset.sidebarReady='true';
  });
}

function setupSidebarToggle(){
  enhanceSidebarNavItems();
  placeSidebarToggleButton();
  if(isMobileSidebar()){
    setSidebarDrawer(false,{fromHistory:true,restoreFocus:false});
  }else{
    setSidebarDrawer(false,{fromHistory:true,restoreFocus:false});
    setSidebarMini(getStoredSidebarMode()===SIDEBAR_MODE_MINI);
  }
  if(!window.__sgSidebarResizeBound){
    window.__sgSidebarResizeBound=true;
    window.addEventListener('resize',debounce(function(){
      placeSidebarToggleButton();
      if(isMobileSidebar()){
        setSidebarDrawer(false,{fromHistory:true,restoreFocus:false});
      }else{
        setSidebarDrawer(false,{fromHistory:true,restoreFocus:false});
        setSidebarMini(getStoredSidebarMode()===SIDEBAR_MODE_MINI);
      }
    },150));
  }
  if(!window.__sgSidebarKeyBound){
    window.__sgSidebarKeyBound=true;
    window.addEventListener('keydown',function(event){
      if(event.key==='Escape'&&isMobileSidebar()&&document.getElementById('sidebar')?.classList.contains('open')){
        event.preventDefault();
        setSidebarDrawer(false);
      }
    });
    window.addEventListener('popstate',function(){
      if(document.getElementById('sidebar')?.classList.contains('open')){
        setSidebarDrawer(false,{fromHistory:true});
      }else if(sidebarDrawerClosingFromHistory){
        sidebarDrawerClosingFromHistory=false;
      }
    });
  }
}

function showApp(){
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  renderAll();
  setupSidebarToggle();
}

function hydrateBootstrapFromCache(){
  if(typeof getCache!=='function'){
    return false;
  }
  const cachedBootstrap=getCache('sg_bootstrap_cache');
  if(!cachedBootstrap){
    return false;
  }
  if(!Array.isArray(cachedBootstrap.quotes)||!Array.isArray(cachedBootstrap.quoteLines)){
    return false;
  }
  DB=normalizeDb(cachedBootstrap);
  bootstrapLoaded=true;
  return true;
}

async function loadData(options){
  const force=!!(options&&options.force);
  const silent=!!(options&&options.silent);
  if(bootstrapLoaded&&!force){
    return {ok:true,data:DB,cached:true};
  }
  if(bootstrapPromise&&!force){
    return bootstrapPromise;
  }
  if(!force&&typeof getCache==='function'){
    if(hydrateBootstrapFromCache()){
      renderAll();
      return {ok:true,data:DB,cached:true};
    }
  }
  bootstrapPromise=(async()=>{
    try {
      if(!silent)toast('กำลังโหลดข้อมูล...');
      let r = await callApi('bootstrap', force ? { force: true } : {});
      if (!r.ok) {
        if (/auth|session|permission/i.test(String(r.message||''))) {
          clearSession();
          document.getElementById('appView')?.classList.add('hidden');
          document.getElementById('loginView')?.classList.remove('hidden');
        }
        toast('โหลดข้อมูลไม่สำเร็จ: ' + r.message);
        return r;
      }
      DB = normalizeDb(r.data);
      if(typeof setCache==='function'){
        setCache('sg_bootstrap_cache', r.data || {}, 15);
      }
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
function toggleMenu(open){placeSidebarToggleButton();if(isMobileSidebar()){const sidebar=document.getElementById('sidebar');const next=typeof open==='boolean'?open:!sidebar?.classList.contains('open');setSidebarDrawer(next);return;}if(open===false)return;setSidebarMini(!isSidebarMini())}
function go(page,btn){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); document.getElementById('page-'+page).classList.add('active'); document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active')); if(btn)btn.classList.add('active'); if(isMobileSidebar())toggleMenu(false); window.scrollTo({top:0,behavior:'smooth'}); ensurePageData(page); if(page==='quotes')ensureQuotationHistoryLoaded();}
function renderAll(){renderBrand();renderProfile();renderHome();renderPromos();renderSettings();}
function renderBrand(){applySystemIdentityToUI(getSystemIdentitySettingsForUi());}
function greeting(){const personal=String(USER?.greetingText||'').trim(); if(personal)return personal; let h=new Date().getHours(),s=DB.settings||{}; if(h<12)return s.greetingMorning||'สวัสดีตอนเช้า'; if(h<17)return s.greetingAfternoon||'สวัสดีตอนบ่าย'; if(h<21)return s.greetingEvening||'สวัสดีตอนเย็น'; return s.greetingNight||'สวัสดีตอนดึก';}
function currentProfileImage(){return USER&&(USER.profileImageUrl||USER.photoUrl)||''}
function currentDisplayName(){return USER&&(USER.displayName||USER.fullName||USER.username)||'-'}
function currentJobTitle(){return USER&&(USER.jobTitle||USER.position||USER.area||USER.branch)||'-'}
function renderProfile(){if(!USER)return; const displayName=currentDisplayName(); const jobTitle=currentJobTitle(); const photo=currentProfileImage(); const setAvatar=el=>{if(!el)return; el.innerHTML=photo?`<img src="${photo}" onerror="this.parentNode.textContent='👤'">`:'👤';}; const sideName=$('sideName'),sidePosition=$('sidePosition'),sideAvatar=$('sideAvatar'),topName=$('topName'),topPosition=$('topPosition'),topAvatar=$('topAvatar'); if(sideName)sideName.textContent=displayName; if(sidePosition)sidePosition.textContent=jobTitle; if(topName)topName.textContent=displayName; if(topPosition)topPosition.textContent=jobTitle; setAvatar(sideAvatar); setAvatar(topAvatar);}
function renderHome(){let name=(currentDisplayName()||'-').split(' ')[0];const customerCount=DB.customers.length||parseClientNumber(DB.counts?.customers);const productCount=DB.products.length||parseClientNumber(DB.counts?.products); document.getElementById('greetingText').textContent=`${greeting()}, ${name} 👋`; document.getElementById('welcomeText').textContent=DB.settings?.welcomeText||'-'; document.getElementById('statQuotes').textContent=DB.quotes.length; document.getElementById('statSales').textContent=Number(DB.quotes.reduce((s,q)=>s+Number(q.total||0),0)).toLocaleString('th-TH'); document.getElementById('statCustomers').textContent=customerCount; document.getElementById('statPending').textContent=DB.quotes.filter(q=>q.status==='รออนุมัติ').length; document.getElementById('latestCustomers').innerHTML=DB.customers.slice(0,4).map(c=>`<div class="row">🏪 <b>${c.customerName||'-'}</b><span style="margin-left:auto;color:var(--muted)">${c.province||''}</span></div>`).join(''); document.getElementById('activePromos').innerHTML=DB.promotions.slice(0,4).map(p=>`<div class="row"><span class="pill ${p.brand==='Weber'?'yellow':'blue'}">${p.brand||'-'}</span><div><b>${p.productName||'-'}</b><br><small>${p.description||p.discountText||''}</small></div></div>`).join(''); document.getElementById('bestProducts').innerHTML=DB.products.slice(0,3).map((p,i)=>`<div><div class="product-img">${p.brand==='Weber'?'🟨':'🟦'}</div><span class="pill ${p.brand==='Weber'?'yellow':'blue'}">${i+1}</span><h3>${p.productName||'-'}</h3><p style="color:var(--muted)">${p.brand||''}</p></div>`).join(''); document.getElementById('rProducts').textContent=productCount; document.getElementById('rCustomers').textContent=customerCount; document.getElementById('rPromos').textContent=DB.promotions.length; document.getElementById('rQuotes').textContent=DB.quotes.length;}
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
  if(toolbar&&!$('refreshCustomersButton')){
    const button=document.createElement('button');
    button.type='button';
    button.id='refreshCustomersButton';
    button.className='ghost customer-refresh-button';
    button.setAttribute('aria-label','อัปเดตข้อมูลร้านค้า');
    button.textContent='🔄 อัปเดตข้อมูลร้านค้า';
    button.onclick=refreshCustomersFromServer;
    const filter=$('customerTypeFilter');
    if(filter)toolbar.insertBefore(button,filter);
    else toolbar.appendChild(button);
  }
  if(grid&&!$('customerSummary')){
    const summary=document.createElement('div');
    summary.id='customerSummary';
    summary.className='crm-summary';
    grid.parentNode.insertBefore(summary,grid);
  }
  const favorites=$('favoriteCustomers');
  if(favorites&&$('customerSummary')&&favorites.previousElementSibling!==$('customerSummary')) $('customerSummary').after(favorites);
}
function customerSearchText(c){return [c.customerId,c.customerCode,c.customerName,c.province,c.customerType,c.phone,c.notes,c.address].join(' ').toLowerCase()}
function renderCustomerSummary(customers){let counts={all:customers.length,gyro:0,weber:0,both:0}; customers.forEach(c=>{if(c.customerType==='Gyproc')counts.gyro++; if(c.customerType==='Weber')counts.weber++; if(c.customerType==='Gyproc/Weber')counts.both++;}); let el=$('customerSummary'); if(el)el.innerHTML=`<div class="crm-stat"><small>ร้านค้าทั้งหมด</small><b>${counts.all}</b></div><div class="crm-stat"><small>Gyproc</small><b>${counts.gyro}</b></div><div class="crm-stat"><small>Weber</small><b>${counts.weber}</b></div><div class="crm-stat"><small>Gyproc/Weber</small><b>${counts.both}</b></div>`}
function renderCustomers(){ensureCustomerCrmUi();let q=$('customerSearch')?.value||'';let type=($('customerTypeFilter')?.value||'');let fields=['customerId','customerCode','customerName','province','customerType','phone','notes','address'];let customers=DB.customers.filter(c=>smartMatch(c,q,fields)&&(!type||c.customerType===type));let limited=limitList(customers,LIST_RENDER_LIMIT);renderCustomerSummary(DB.customers);let grid=$('customerGrid'); if(!grid)return; grid.innerHTML=renderLimitNotice(limited.limited,LIST_RENDER_LIMIT)+limited.items.map(c=>`<div class="card"><h3>${c.customerName||'-'}</h3><p>รหัสร้านค้า: ${c.customerCode||c.customerId||c.id||'-'}</p><p>ประเภท: ${c.customerType||'-'}</p><p>จังหวัด: ${c.province||'-'}</p><p>โทร: ${c.phone||'-'}</p><p>ที่อยู่: ${c.address||'-'}</p><p>หมายเหตุ: ${c.notes||'-'}</p><button class="ghost" onclick="selectCustomer('${c.customerId}')">ออกใบเสนอราคา</button></div>`).join('')}
function productSearchText(p){return [p.productId,p.sku,p.productName,p.description,p.brand,p.discountGroup,p.groupCode,p.unit,p.notes,p.promoText].join(' ').toLowerCase()}
function htmlAttr(value){
  return String(value??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function findProductForCalculator(productId){
  const id=String(productId||'').trim().toLowerCase();
  return (Array.isArray(DB.products)?DB.products:[]).find(p=>String(p.productId||p.sku||p.id||'').trim().toLowerCase()===id)||null;
}
function openProductCalculator(productId){
  const product=findProductForCalculator(productId);
  if(!product){
    toast('ไม่พบสินค้า');
    return;
  }
  PRODUCT_CALC_PRODUCT=product;
  const modal=$('productPriceModal');
  if(!modal)return;
  const priceInput=$('productCalcListPrice');
  const discountInput=$('productCalcDiscount');
  const qtyInput=$('productCalcQty');
  if(priceInput)priceInput.value=parseClientNumber(product.listPrice).toFixed(2);
  if(discountInput)discountInput.value='0';
  if(qtyInput)qtyInput.value='1';
  renderProductCalculator();
  modal.classList.remove('hidden');
  modal.classList.add('show');
}
function closeProductCalculator(){
  const modal=$('productPriceModal');
  if(modal){
    modal.classList.add('hidden');
    modal.classList.remove('show');
  }
}
function resetProductCalculator(){
  if(!PRODUCT_CALC_PRODUCT)return;
  const priceInput=$('productCalcListPrice');
  const discountInput=$('productCalcDiscount');
  const qtyInput=$('productCalcQty');
  if(priceInput)priceInput.value=parseClientNumber(PRODUCT_CALC_PRODUCT.listPrice).toFixed(2);
  if(discountInput)discountInput.value='0';
  if(qtyInput)qtyInput.value='1';
  renderProductCalculator();
}
function renderProductCalculator(){
  const product=PRODUCT_CALC_PRODUCT||{};
  const capture=$('productPriceCapture');
  if(!capture)return;
  const listPrice=parseClientNumber($('productCalcListPrice')?.value||product.listPrice);
  const discountPercent=parseClientNumber($('productCalcDiscount')?.value);
  const qty=Math.max(0,parseClientNumber($('productCalcQty')?.value||1));
  const netPrice=listPrice*(1-discountPercent/100);
  const subtotal=netPrice*qty;
  const vat=subtotal*0.07;
  const grandTotal=subtotal+vat;
  const productId=product.productId||product.sku||product.id||'-';
  const imageUrl=String(product.imageUrl||'').trim();
  capture.innerHTML=`
    <div class="product-calc-head">
      <div class="product-calc-img">${imageUrl?`<img src="${htmlAttr(imageUrl)}" alt="">`:'📦'}</div>
      <div>
        <span class="pill ${product.brand==='Weber'?'yellow':'blue'}">${product.brand||'-'}</span>
        <h2>${product.productName||'-'}</h2>
        <p>รหัสสินค้า: ${productId}</p>
        <p>หน่วย: ${product.unit||'-'}</p>
        <p>ราคาตั้ง: ${money(product.listPrice)}</p>
      </div>
    </div>
    <div class="product-calc-input-summary">
      <span>ราคาตั้งต่อหน่วย: <b>${money(listPrice)}</b></span>
      <span>ส่วนลด: <b>${discountPercent}%</b></span>
      <span>จำนวน: <b>${qty}</b></span>
    </div>
    <div class="product-calc-results">
      <div><small>ราคาสุทธิต่อหน่วย</small><b>${money(netPrice)}</b></div>
      <div><small>VAT 7%</small><b>${money(vat)}</b></div>
      <div><small>ยอดก่อน VAT</small><b>${money(subtotal)}</b></div>
      <div class="grand"><small>ยอดลูกค้าชำระ</small><b>${money(grandTotal)}</b></div>
    </div>`;
}
async function saveProductCalculatorImage(){
  const product=PRODUCT_CALC_PRODUCT||{};
  const target=$('productPriceCapture');
  if(!target)return null;
  if(typeof html2canvas!=='function'){
    toast('ไม่พบ html2canvas สำหรับบันทึกรูปภาพ');
    return null;
  }
  toast('กำลังสร้างรูปภาพ...');
  const clone=target.cloneNode(true);
  clone.classList.add('product-price-export');
  clone.style.position='fixed';
  clone.style.left='-12000px';
  clone.style.top='0';
  clone.style.width='1100px';
  clone.style.maxWidth='1100px';
  clone.style.background='#ffffff';
  document.body.appendChild(clone);
  let canvas;
  try{
    canvas=await html2canvas(clone,{scale:3,backgroundColor:'#ffffff',useCORS:true,windowWidth:1200,windowHeight:clone.scrollHeight});
  }finally{
    document.body.removeChild(clone);
  }
  const productId=String(product.productId||product.sku||product.id||'product').replace(/[^A-Za-z0-9_-]/g,'-');
  const link=document.createElement('a');
  link.download=`product-price-${productId}.png`;
  link.href=canvas.toDataURL('image/png');
  link.click();
  toast('บันทึกรูปภาพแล้ว');
  return canvas;
}
function addProductCardToQuote(productId,event){
  if(event&&typeof event.stopPropagation==='function')event.stopPropagation();
  const product=findProductForCalculator(productId);
  if(product&&typeof addCart==='function'){
    addCart(product);
  }
}
function getProductDiscount(customerId, product){
  const groupCode=String(product&&product.groupCode||'').trim();
  const cacheKey=String(customerId||'').trim()+'|'+groupCode;
  if(typeof getCache==='function'&&cacheKey!=='|'){
    const cachedDiscounts=getCache('sg_discount_cache')||{};
    if(cachedDiscounts[cacheKey]!==undefined){
      return Promise.resolve({ok:true,data:{customerId:customerId,groupCode:groupCode,discountPercent:Number(cachedDiscounts[cacheKey]||0),source:'local_cache'}});
    }
  }
  return callApi('discount',{customerId:customerId,groupCode:groupCode}).then(function(response){
    if(response&&response.ok&&typeof getCache==='function'&&typeof setCache==='function'){
      const cachedDiscounts=getCache('sg_discount_cache')||{};
      cachedDiscounts[cacheKey]=Number(response.data&&response.data.discountPercent||0);
      setCache('sg_discount_cache',cachedDiscounts,60);
    }
    return response;
  });
}
function setCustomersData(items){
  DB.customers=Array.isArray(items)?items.map(normalizeCustomer):[];
  customersLoaded=true;
  if(typeof setCache==='function')setCache('sg_customers_cache',DB.customers,15);
}
function clearCustomersFrontendCache(){
  if(typeof clearCache==='function')clearCache('sg_customers_cache');
}
function invalidateBootstrapCustomerCacheIfNeeded(){
  if(typeof getCache!=='function'||typeof clearCache!=='function')return;
  try{
    const cachedBootstrap=getCache('sg_bootstrap_cache');
    if(cachedBootstrap&&Array.isArray(cachedBootstrap.customers)){
      clearCache('sg_bootstrap_cache');
      bootstrapLoaded=false;
    }
  }catch(error){
    console.warn('Customer bootstrap cache invalidation skipped');
  }
}
function setProductsData(items){
  DB.products=Array.isArray(items)?items.map(normalizeProduct):[];
  productsLoaded=true;
  if(typeof setCache==='function')setCache('sg_products_cache',DB.products,15);
}
function renderCustomerViews(){
  renderHome();
  renderCustomers();
  syncQuoteCustomerSearch();
  renderQuoteCustomerPicker(false);
}
function renderProductViews(){
  renderHome();
  renderProducts();
  renderQuoteProductPicker();
}
async function loadCustomers(options){
  const force=!!(options&&options.force);
  const background=!!(options&&options.background);
  if(customersLoaded&&!force)return {ok:true,data:DB.customers,cached:true};
  if(customersPromise)return customersPromise;
  if(!force&&typeof getCache==='function'){
    const cached=getCache('sg_customers_cache');
    if(Array.isArray(cached)){
      setCustomersData(cached);
      renderCustomerViews();
      return {ok:true,data:DB.customers,cached:true};
    }
  }
  customersPromise=(async()=>{
    try{
      if(!background)toast('กำลังโหลดข้อมูล...');
      const response=await callApi('customers',{});
      if(response&&response.ok){
        if(!Array.isArray(response.data)){
          const invalidResponse={ok:false,message:'Invalid customers response: expected an array'};
          if(!background)toast(invalidResponse.message);
          console.warn('Customer load rejected invalid response');
          return invalidResponse;
        }
        setCustomersData(response.data);
        renderCustomerViews();
        return {ok:true,data:DB.customers};
      }
      const failed=response||{ok:false,message:'โหลดข้อมูลร้านค้าไม่สำเร็จ'};
      if(!background)toast(failed.message||'โหลดข้อมูลร้านค้าไม่สำเร็จ');
      return failed;
    }catch(error){
      console.error(error);
      if(!background)toast('โหลดข้อมูลร้านค้าไม่สำเร็จ');
      return {ok:false,message:String(error&&error.message?error.message:error)};
    }finally{
      customersPromise=null;
    }
  })();
  return customersPromise;
}
function setCustomerRefreshButtonLoading(isLoading){
  const button=$('refreshCustomersButton');
  if(!button)return;
  if(button.dataset.originalText===undefined){
    button.dataset.originalText=button.textContent||'🔄 อัปเดตข้อมูลร้านค้า';
  }
  button.disabled=!!isLoading;
  button.setAttribute('aria-busy',String(!!isLoading));
  button.textContent=isLoading?'⏳ กำลังอัปเดต...':button.dataset.originalText;
}
function refreshCustomersFromServer(){
  if(customerRefreshPromise)return customerRefreshPromise;
  customerRefreshPromise=(async()=>{
    setCustomerRefreshButtonLoading(true);
    try{
      clearCustomersFrontendCache();
      customersLoaded=false;
      const response=await loadCustomers({force:true,background:true});
      if(!response||!response.ok){
        toast(response&&response.message?response.message:'อัปเดตข้อมูลร้านค้าไม่สำเร็จ');
        console.warn('Customer refresh failed');
        return response||{ok:false,message:'Customer refresh failed'};
      }
      renderCustomerViews();
      toast('อัปเดตข้อมูลร้านค้าแล้ว '+DB.customers.length+' รายการ');
      console.info('Customer refresh completed count='+DB.customers.length);
      return response;
    }catch(error){
      console.warn('Customer refresh failed');
      toast('อัปเดตข้อมูลร้านค้าไม่สำเร็จ');
      return {ok:false,message:String(error&&error.message?error.message:error)};
    }finally{
      setCustomerRefreshButtonLoading(false);
      customerRefreshPromise=null;
    }
  })();
  return customerRefreshPromise;
}
async function loadProducts(options){
  const force=!!(options&&options.force);
  const background=!!(options&&options.background);
  if(productsLoaded&&!force)return {ok:true,data:DB.products,cached:true};
  if(productsPromise&&!force)return productsPromise;
  if(!force&&typeof getCache==='function'){
    const cached=getCache('sg_products_cache');
    if(Array.isArray(cached)){
      setProductsData(cached);
      renderProductViews();
      return {ok:true,data:DB.products,cached:true};
    }
  }
  productsPromise=(async()=>{
    try{
      if(!background)toast('กำลังโหลดข้อมูล...');
      const response=await callApi('products',{});
      if(response&&response.ok){
        setProductsData(response.data||[]);
        renderProductViews();
      }
      return response;
    }catch(error){
      console.error(error);
      if(!background)toast('โหลดข้อมูลสินค้าไม่สำเร็จ');
      return {ok:false,message:String(error&&error.message?error.message:error)};
    }finally{
      productsPromise=null;
    }
  })();
  return productsPromise;
}
function ensurePageData(page){
  if(page==='customers'){renderCustomers();return loadCustomers();}
  if(page==='products'){renderProducts();return loadProducts();}
  if(page==='quote'){
    renderQuote();
    return Promise.resolve({ok:true});
  }
  return Promise.resolve({ok:true});
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
let quoteProductSearchSequence=0;
function normalizeProductBusinessUnitForUi(product){
  const p=product&&typeof product==='object'?product:{};
  const text=String(p.productBusinessUnit||p.businessUnit||p.quoteType||p.bu||p.brand||'').trim().toUpperCase();
  if(text.indexOf('GYPROC')>=0)return'GYPROC';
  if(text.indexOf('WEBER')>=0)return'WEBER';
  return'';
}
function quoteBusinessUnitLabel(value){return String(value||'').toUpperCase()==='GYPROC'?'Gyproc':'Weber'}
function getSelectedQuoteBusinessUnitForProducts(){return typeof window.getCurrentQuoteBusinessUnit==='function'?window.getCurrentQuoteBusinessUnit():'WEBER'}
function isQuoteBusinessUnitReadyForProducts(){return typeof window.isQuoteBusinessUnitSelected==='function'?window.isQuoteBusinessUnitSelected():true}
function isActiveProductForQuote(product){const status=String(product&&(product.active||product.status)||'').trim().toLowerCase();return !status||status==='true'||status==='yes'||status==='1'||status==='active'}
function productMatchesQuoteBusinessUnit(product,businessUnit){return normalizeProductBusinessUnitForUi(product)===String(businessUnit||'').toUpperCase()}
function quoteBusinessUnitClass(value){return String(value||'').toUpperCase()==='GYPROC'?'gyproc':'weber'}
function quoteProductBusinessUnitBadge(product,primaryBusinessUnit){const productUnit=normalizeProductBusinessUnitForUi(product);if(!productUnit)return'<span class="quote-product-bu">BU -</span>';const label=quoteBusinessUnitLabel(productUnit);const cross=productUnit&&String(productUnit).toUpperCase()!==String(primaryBusinessUnit||'').toUpperCase()?'<small class="quote-cross-bu-note">สินค้าร่วมข้าม BU</small>':'';return `<span class="quote-product-bu ${quoteBusinessUnitClass(productUnit)}">${label}</span>${cross}`}
function rankQuoteProduct(product,query){const q=String(query||'').trim().toLowerCase();if(!q)return 1000;const sku=String(product.productId||product.sku||product.id||product.productCode||'').trim().toLowerCase();const name=String(product.productName||product.name||'').trim().toLowerCase();const brand=String(product.brand||'').trim().toLowerCase();const description=String(product.description||product.itemDesc||'').trim().toLowerCase();if(sku===q)return 0;if(name===q)return 1;if(name.indexOf(q)===0)return 2;if(name.indexOf(q)>=0)return 3;if(brand.indexOf(q)>=0||description.indexOf(q)>=0)return 4;return 9}
function rankQuoteProductBusinessUnit(product,businessUnit){const unit=normalizeProductBusinessUnitForUi(product);const primary=String(businessUnit||'').toUpperCase();if(unit&&primary&&unit===primary)return 0;if(unit)return 1;return 2}
function filterQuoteProductsByBusinessUnit(query,businessUnit){const fields=getQuoteProductFields();const q=String(query||'').trim();return DB.products.filter(isActiveProductForQuote).filter(p=>!q||smartMatch(p,q,fields)).sort((a,b)=>rankQuoteProductBusinessUnit(a,businessUnit)-rankQuoteProductBusinessUnit(b,businessUnit)||rankQuoteProduct(a,q)-rankQuoteProduct(b,q)||String(a.productName||'').localeCompare(String(b.productName||''),'th'))}
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
function normalizeQuoteTypeForUi(value){
  const text=String(value||'').trim().toUpperCase();
  return text==='GYPROC'?'GYPROC':'WEBER';
}
function quoteTypeLabelForUi(value){
  return normalizeQuoteTypeForUi(value)==='GYPROC'?'Gyproc':'Weber';
}
function quoteTypeClassForUi(value){
  return normalizeQuoteTypeForUi(value)==='GYPROC'?'gyproc':'weber';
}
function normalizeQuoteRecord(quote){
  const q=quote&&typeof quote==='object'?quote:{};
  const quoteId=String(q.quoteId||q.quoteNo||'').trim();
  const quoteNo=String(q.quoteNo||q.quoteId||'').trim();
  const quoteType=normalizeQuoteTypeForUi(q.quoteType||q.businessUnit);
  return {
    ...q,
    quoteId,
    quoteNo,
    quoteType,
    businessUnit:quoteType,
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

function dashboardText(value, fallback){
  const text=String(value??'').trim();
  return text||fallback||'-';
}
function dashboardMoney(value){
  return money(parseClientNumber(value));
}
function normalizeDashboardLine(line){
  const item=line&&typeof line==='object'?line:{};
  const productId=String(item.productId||item.sku||item.id||'').trim();
  const qty=parseClientNumber(item.qty||item.quantity);
  const lineTotal=parseClientNumber(item.lineTotal||item.grandTotal||item.total);
  return {
    ...item,
    quoteId:String(item.quoteId||'').trim(),
    productId,
    productName:String(item.productName||item.itemName||'').trim(),
    qty,
    lineTotal,
    grandTotal:parseClientNumber(item.grandTotal||lineTotal)
  };
}
function findDashboardProduct(productId){
  const id=String(productId||'').trim().toLowerCase();
  return (Array.isArray(DB.products)?DB.products:[]).find(p=>String(p.productId||p.sku||p.id||'').trim().toLowerCase()===id)||{};
}
function normalizeDashboardStatus(status){
  return String(status||'').trim().toUpperCase();
}
function isCancelledQuote(quote){
  return normalizeDashboardStatus(quote.status)==='CANCELLED';
}
function ensureDashboardLayout(){
  const page=$('page-home');
  if(!page)return null;
  let root=$('dashboardContent');
  if(!root){
    root=document.createElement('div');
    root.id='dashboardContent';
    root.className='dashboard-content';
    const hero=page.querySelector('.hero');
    if(hero&&hero.parentNode){
      hero.parentNode.insertBefore(root,hero.nextSibling);
    }else{
      page.appendChild(root);
    }
  }
  Array.from(page.children).forEach(node=>{
    if(node!==root&&(node.classList.contains('grid4')||node.classList.contains('cols'))){
      node.classList.add('dashboard-legacy-hidden');
    }
  });
  const bestProducts=$('bestProducts');
  const bestCard=bestProducts&&bestProducts.closest('.card');
  if(bestCard)bestCard.classList.add('dashboard-legacy-hidden');
  return root;
}
function buildDashboardMetrics(){
  const quotes=(Array.isArray(DB.quotes)?DB.quotes:[]).map(normalizeQuoteRecord);
  const lines=(Array.isArray(DB.quoteLines)?DB.quoteLines:[]).map(normalizeDashboardLine);
  const activeQuotes=quotes.filter(q=>!isCancelledQuote(q));
  const actual=activeQuotes.reduce((sum,q)=>sum+parseClientNumber(q.grandTotal||q.total),0);
  const saved=quotes.filter(q=>normalizeDashboardStatus(q.status)==='SAVED');
  const draft=quotes.filter(q=>normalizeDashboardStatus(q.status)==='DRAFT');
  const cancelled=quotes.filter(isCancelledQuote);
  const target=parseClientNumber(DB.settings?.salesTarget||DB.settings?.target||DB.settings?.monthlyTarget);
  const forecast=actual;
  const achievement=target>0?(actual/target)*100:0;
  const gap=target>0?Math.max(target-actual,0):0;
  const quoteIds={};
  activeQuotes.forEach(q=>{if(q.quoteId)quoteIds[q.quoteId]=true; if(q.quoteNo)quoteIds[q.quoteNo]=true;});
  const activeLines=lines.filter(line=>(!line.quoteId||quoteIds[line.quoteId])&&normalizeDashboardStatus(line.status)!=='REMOVED');
  const bu={Gyproc:0,Weber:0};
  activeLines.forEach(line=>{
    const product=findDashboardProduct(line.productId);
    const brandText=String(product.brand||line.brand||line.discountGroup||'').toLowerCase();
    const value=parseClientNumber(line.lineTotal||line.grandTotal);
    if(brandText.indexOf('weber')>=0)bu.Weber+=value;
    if(brandText.indexOf('gyproc')>=0)bu.Gyproc+=value;
  });
  const now=Date.now();
  const recentMs=30*24*60*60*1000;
  const newCustomers=(Array.isArray(DB.customers)?DB.customers:[]).filter(c=>{
    const d=new Date(c.createdAt||c.updatedAt||'');
    return !Number.isNaN(d.getTime())&&now-d.getTime()<=recentMs;
  }).length;
  const topCustomerMap={};
  activeQuotes.forEach(q=>{
    const key=q.customerId||q.customerName||'-';
    if(!topCustomerMap[key])topCustomerMap[key]={name:q.customerName||q.customerId||'-',value:0,count:0};
    topCustomerMap[key].value+=parseClientNumber(q.grandTotal||q.total);
    topCustomerMap[key].count+=1;
  });
  const topCustomers=Object.values(topCustomerMap).sort((a,b)=>b.value-a.value).slice(0,5);
  const topProductMap={};
  activeLines.forEach(line=>{
    const key=line.productId||line.productName||'-';
    const product=findDashboardProduct(line.productId);
    if(!topProductMap[key])topProductMap[key]={name:line.productName||product.productName||line.productId||'-',qty:0,value:0};
    topProductMap[key].qty+=parseClientNumber(line.qty);
    topProductMap[key].value+=parseClientNumber(line.lineTotal||line.grandTotal);
  });
  const topProducts=Object.values(topProductMap).sort((a,b)=>b.value-a.value).slice(0,5);
  const openQuoteCustomers=Object.values(activeQuotes.filter(q=>normalizeDashboardStatus(q.status)!=='SAVED').reduce((acc,q)=>{
    const key=q.customerId||q.customerName||'-';
    if(!acc[key])acc[key]={name:q.customerName||q.customerId||'-',value:0,count:0};
    acc[key].value+=parseClientNumber(q.grandTotal||q.total);
    acc[key].count+=1;
    return acc;
  },{})).sort((a,b)=>b.value-a.value).slice(0,5);
  const recentQuoteCustomerIds={};
  activeQuotes.forEach(q=>{
    const d=new Date(q.createdAt||q.updatedAt||'');
    if(!Number.isNaN(d.getTime())&&now-d.getTime()<=recentMs&&q.customerId){
      recentQuoteCustomerIds[String(q.customerId).trim()]=true;
    }
  });
  const noRecentCustomers=(Array.isArray(DB.customers)?DB.customers:[]).filter(c=>!recentQuoteCustomerIds[String(c.customerId||c.customerCode||'').trim()]).slice(0,5);
  return {quotes,lines,target,actual,forecast,achievement,gap,bu,newCustomers,draft,saved,cancelled,topCustomers,topProducts,openQuoteCustomers,noRecentCustomers};
}
function renderDashboardList(items, renderer, emptyText){
  const list=Array.isArray(items)?items:[];
  if(!list.length){
    return `<div class="dashboard-empty">${dashboardText(emptyText,'-')}</div>`;
  }
  return list.map(renderer).join('');
}
function renderHome(){
  const name=(currentDisplayName()||'-').split(' ')[0];
  const customerCount=DB.customers.length||parseClientNumber(DB.counts?.customers);
  const productCount=DB.products.length||parseClientNumber(DB.counts?.products);
  const greetingEl=$('greetingText');
  const welcomeEl=$('welcomeText');
  if(greetingEl)greetingEl.textContent=`${greeting()}, ${name} 👋`;
  if(welcomeEl)welcomeEl.textContent=DB.settings?.welcomeText||'เริ่มต้นวันใหม่อย่างมีประสิทธิภาพนะคะ';
  const root=ensureDashboardLayout();
  const metrics=buildDashboardMetrics();
  if(root){
    root.innerHTML=`
      <div class="dashboard-kpi-grid">
        <div class="stat dashboard-kpi"><div class="ico">🎯</div><h3>Target</h3><b>${dashboardMoney(metrics.target)}</b><small>เป้าหมายยอดขาย</small></div>
        <div class="stat dashboard-kpi"><div class="ico">💰</div><h3>Actual</h3><b>${dashboardMoney(metrics.actual)}</b><small>จาก QuoteHistory</small></div>
        <div class="stat dashboard-kpi"><div class="ico">📈</div><h3>Forecast</h3><b>${dashboardMoney(metrics.forecast)}</b><small>ประเมินจากใบเสนอราคา</small></div>
        <div class="stat dashboard-kpi"><div class="ico">✅</div><h3>Achievement %</h3><b>${metrics.achievement?metrics.achievement.toFixed(1):'0.0'}%</b><small>Actual / Target</small></div>
        <div class="stat dashboard-kpi"><div class="ico">↔️</div><h3>Gap</h3><b>${dashboardMoney(metrics.gap)}</b><small>ยอดที่ต้องเติม</small></div>
      </div>
      <div class="dashboard-section-grid">
        <div class="card dashboard-card">
          <div class="section-title"><h2>BU Summary</h2></div>
          <div class="dashboard-mini-grid">
            <div><small>Gyproc</small><b>${dashboardMoney(metrics.bu.Gyproc)}</b></div>
            <div><small>Weber</small><b>${dashboardMoney(metrics.bu.Weber)}</b></div>
            <div><small>Quotation Value</small><b>${dashboardMoney(metrics.actual)}</b></div>
            <div><small>New Customer</small><b>${metrics.newCustomers||0}</b></div>
          </div>
        </div>
        <div class="card dashboard-card">
          <div class="section-title"><h2>Quotation KPI</h2></div>
          <div class="dashboard-mini-grid">
            <div><small>จำนวนใบเสนอราคา</small><b>${metrics.quotes.length}</b></div>
            <div><small>มูลค่ารวมใบเสนอราคา</small><b>${dashboardMoney(metrics.actual)}</b></div>
            <div><small>Draft</small><b>${metrics.draft.length}</b></div>
            <div><small>Saved</small><b>${metrics.saved.length}</b></div>
            <div><small>Cancelled</small><b>${metrics.cancelled.length}</b></div>
          </div>
        </div>
      </div>
      <div class="dashboard-section-grid">
        <div class="card dashboard-card">
          <div class="section-title"><h2>Top Customer</h2></div>
          <div class="dashboard-list">${renderDashboardList(metrics.topCustomers,item=>`<div class="dashboard-row"><span>${dashboardText(item.name)}</span><b>${dashboardMoney(item.value)}</b><small>${item.count||0} ใบ</small></div>`,'-')}</div>
        </div>
        <div class="card dashboard-card">
          <div class="section-title"><h2>Top Product</h2></div>
          <div class="dashboard-list">${renderDashboardList(metrics.topProducts,item=>`<div class="dashboard-row"><span>${dashboardText(item.name)}</span><b>${dashboardMoney(item.value)}</b><small>จำนวน ${item.qty||0}</small></div>`,'-')}</div>
        </div>
      </div>
      <div class="card dashboard-card">
        <div class="section-title"><h2>Customer Follow-up</h2></div>
        <div class="dashboard-followup">
          <div>
            <h3>ลูกค้าที่มีใบเสนอราคาแต่ยังไม่ได้ปิด</h3>
            ${renderDashboardList(metrics.openQuoteCustomers,item=>`<div class="dashboard-row"><span>${dashboardText(item.name)}</span><b>${dashboardMoney(item.value)}</b><small>${item.count||0} ใบ</small></div>`,'-')}
          </div>
          <div>
            <h3>ลูกค้าที่ไม่มีการเสนอราคาในช่วงล่าสุด</h3>
            ${renderDashboardList(metrics.noRecentCustomers,item=>`<div class="dashboard-row"><span>${dashboardText(item.customerName||item.customerCode)}</span><b>${dashboardText(item.province)}</b><small>${dashboardText(item.customerCode||item.customerId)}</small></div>`,'-')}
          </div>
        </div>
      </div>`;
  }
  const setText=(id,value)=>{const el=$(id); if(el)el.textContent=value;};
  setText('statQuotes',metrics.quotes.length);
  setText('statSales',Number(metrics.actual||0).toLocaleString('th-TH'));
  setText('statCustomers',customerCount);
  setText('statPending',metrics.draft.length);
  setText('rProducts',productCount);
  setText('rCustomers',customerCount);
  setText('rPromos',DB.promotions.length);
  setText('rQuotes',metrics.quotes.length);
  if(!quoteHistoryLoaded&&!quoteHistoryPromise&&(!Array.isArray(DB.quotes)||!DB.quotes.length)){
    ensureQuotationHistoryLoaded();
  }
}
function getQuoteSearchFields(){return ['quoteNo','quoteId','customerName','customerId','status','quoteType','businessUnit'];}
function formatDateTime(value){
  if(!value)return '-';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return String(value);
  return d.toLocaleString('th-TH',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function renderHistory(){
  const history=$('quoteHistory');
  if(!history)return;
  if(!quoteHistoryLoaded&&!(Array.isArray(DB.quotes)&&DB.quotes.length)){
    history.innerHTML='<p class="loading-text">กำลังโหลดข้อมูล...</p>';
    return;
  }
  const keyword=$('quoteHistorySearch')?.value||'';
  const quotes=(Array.isArray(DB.quotes)?DB.quotes:[]).map(normalizeQuoteRecord).filter(q=>smartMatch(q,keyword,getQuoteSearchFields())).sort((a,b)=>new Date(b.createdAt||b.updatedAt||0)-new Date(a.createdAt||a.updatedAt||0));
  history.innerHTML=quotes.length?quotes.map(q=>`<div class="row quote-history-row"><div><b>${q.quoteNo||'-'}</b><br><small>${q.customerName||'-'} · ${q.customerId||'-'}</small></div><span class="quote-type-badge ${quoteTypeClassForUi(q.quoteType)}">${quoteTypeLabelForUi(q.quoteType)}</span><span class="pill ${q.status==='CANCELLED'?'yellow':'blue'}">${q.status||'-'}</span><span>${formatDateTime(q.createdAt)}</span><b style="margin-left:auto">${money(q.grandTotal||q.total)}</b><button class="tiny" onclick="openQuotationDetail('${q.quoteId}')">เปิดดู</button><button class="tiny" onclick="editQuotationFromHistory('${q.quoteId}')">แก้ไข</button></div>`).join(''):'<p style="color:var(--muted)">ยังไม่มีใบเสนอราคา</p>';
}
async function refreshQuotationHistory(options){
  const force=!!(options&&options.force);
  if(quoteHistoryPromise){
    return quoteHistoryPromise;
  }
  if(!force&&typeof getCache==='function'){
    const cachedHistory=getCache('sg_quote_history_cache');
    if(Array.isArray(cachedHistory)){
      DB.quotes=cachedHistory.map(normalizeQuoteRecord);
      quoteHistoryLoaded=true;
      renderHistory();
      renderHome();
      return Promise.resolve({ok:true,data:DB.quotes,cached:true});
    }
  }
  quoteHistoryPromise=(async()=>{
  try{
    const history=$('quoteHistory');
    if(history)history.innerHTML='<p class="loading-text">กำลังโหลดข้อมูล...</p>';
    const response=await callApi('getQuotationHistory',{limit:50});
    if(!response.ok){
      toast(response.message||'โหลดประวัติใบเสนอราคาไม่สำเร็จ');
      return response;
    }
    DB.quotes=Array.isArray(response.data)?response.data.map(normalizeQuoteRecord):[];
    quoteHistoryLoaded=true;
    if(typeof setCache==='function')setCache('sg_quote_history_cache',DB.quotes,2);
    renderHistory();
    renderHome();
    return response;
  }catch(error){
    console.error(error);
    toast('โหลดประวัติใบเสนอราคาไม่สำเร็จ');
  } finally {
    quoteHistoryPromise=null;
  }
  })();
  return quoteHistoryPromise;
}
function ensureQuotationHistoryLoaded(){
  if(quoteHistoryLoaded){
    renderHistory();
    return Promise.resolve({ok:true,data:DB.quotes,cached:true});
  }
  return refreshQuotationHistory();
}
function isQuotationHistoryLoaded(){return quoteHistoryLoaded;}
function buildQuotationDetailHtml(data){
  data=data||{};
  const quote=normalizeQuoteRecord(data.quote||{});
  const lines=Array.isArray(data.lines)?data.lines:[];
  const totals=data.totals||{};
  const quoteIdAttr=htmlAttr(quote.quoteId||quote.quoteNo||'');
  return `<div class="section-title"><div><h2>${quote.quoteNo||quote.quoteId||'-'}</h2><p style="color:var(--muted);margin:4px 0 0">${quote.customerName||'-'} · ${quote.customerId||'-'}</p></div><span class="pill ${quote.status==='CANCELLED'?'yellow':'blue'}">${quote.status||'-'}</span></div><div class="quote-detail-meta"><span>วันที่: ${formatDateTime(quote.createdAt)}</span><span>ยอดสุทธิ: ${money(totals.grandTotal||quote.grandTotal)}</span></div><div class="list quote-detail-lines">${lines.length?lines.map((line,index)=>`<div class="row"><div><b>${line.productName||'-'}</b><br><small>${line.productId||'-'} · ${line.unit||'-'}</small></div><span>จำนวน ${line.qty||0}</span><span>ราคา ${money(line.listPrice)}</span><span>ส่วนลด ${line.discountPercent||0}%</span><b style="margin-left:auto">${money(line.grandTotal||line.lineTotal)}</b></div>`).join(''):'<p style="color:var(--muted)">ไม่มีรายการสินค้า</p>'}</div><div class="quote-total-box"><p>Subtotal <b>${money(totals.subtotal||quote.subtotal)}</b></p><p>VAT <b>${money(totals.vat||quote.vat)}</b></p><p>Grand Total <b>${money(totals.grandTotal||quote.grandTotal)}</b></p></div><div class="actions no-print"><button class="primary" onclick="printQuotation('${quoteIdAttr}')">Print</button><button class="yellow" onclick="exportQuotationPNG('${quoteIdAttr}')">Save PNG</button><button class="yellow" onclick="shareQuote('${quoteIdAttr}')">Share</button><button class="ghost" onclick="editQuotationFromHistory('${quoteIdAttr}')">แก้ไข</button><button class="ghost" onclick="duplicateQuotationFromHistory('${quoteIdAttr}')">Duplicate</button><button class="yellow" onclick="cancelQuotationFromHistory('${quoteIdAttr}')">Cancel</button></div>`;
}
function renderQuotationDetail(data){
  const box=$('quoteDetail');
  if(!box)return;
  if(!data){
    box.classList.add('hidden');
    box.innerHTML='';
    return;
  }
  box.classList.remove('hidden');
  box.innerHTML=buildQuotationDetailHtml(data);
}
function openQuotationDetailModal(data){
  const modal=$('quoteDetailModal');
  const body=$('quoteDetailModalBody');
  if(!modal||!body)return;
  body.innerHTML=buildQuotationDetailHtml(data||{});
  modal.classList.remove('hidden');
  modal.classList.add('show');
}
function closeQuotationDetailModal(){
  const modal=$('quoteDetailModal');
  if(modal){
    modal.classList.add('hidden');
    modal.classList.remove('show');
  }
}
async function openQuotationDetail(quoteId){
  const id=String(quoteId||'').trim();
  if(!id){
    return {ok:false,message:'quoteId is required'};
  }
  if(openQuotationDetailPromises[id]){
    return openQuotationDetailPromises[id];
  }
  openQuotationDetailPromises[id]=(async()=>{
  try{
    if(typeof openQuotation!=='function'){
      toast('ไม่พบฟังก์ชันโหลดใบเสนอราคา');
      return {ok:false,message:'openQuotation not available'};
    }
    const response=await openQuotation(id);
    if(!response.ok){
      toast(response.message||'เปิดใบเสนอราคาไม่สำเร็จ');
      return response;
    }
    renderQuotationDetail(null);
    openQuotationDetailModal(response.data);
    return response;
  }catch(error){
    console.error(error);
    toast('เปิดใบเสนอราคาไม่สำเร็จ');
  }finally{
    delete openQuotationDetailPromises[id];
  }
  })();
  return openQuotationDetailPromises[id];
}
async function duplicateQuotationFromHistory(quoteId){
  try{
    const response=await callApi('duplicateQuotation',{quoteId});
    if(!response.ok){
      toast(response.message||'Duplicate ไม่สำเร็จ');
      return response;
    }
    toast('สร้างสำเนาใบเสนอราคาแล้ว');
    const newQuoteId=response.data?.newQuoteId||response.data?.quoteId;
    if(typeof clearCache==='function')clearCache('sg_quote_history_cache');
    await refreshQuotationHistory({force:true});
    if(newQuoteId)await openQuotationDetail(newQuoteId);
    return response;
  }catch(error){
    console.error(error);
    toast('Duplicate ไม่สำเร็จ');
  }
}
async function editQuotationFromHistory(quoteId){
  if(typeof openQuotation!=='function'){
    toast('ไม่พบฟังก์ชันโหลดใบเสนอราคา');
    return;
  }
  const response=await openQuotation(quoteId);
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
    if(typeof clearQuotationCache==='function'){
      clearQuotationCache(quoteId);
    }
    await openQuotationDetail(quoteId);
    if(typeof clearCache==='function')clearCache('sg_quote_history_cache');
    await refreshQuotationHistory({force:true});
    return response;
  }catch(error){
    console.error(error);
    toast('Cancel ไม่สำเร็จ');
  }
}
function renderSettings(){if(!USER)return;let s=DB.settings||{},identity=getSystemIdentitySettingsForUi(); let set=(id,val)=>{let el=$(id); if(el)el.value=val||''}; set('setDisplay',USER.displayName); set('setPosition',USER.position); set('setPhone',USER.phone); set('setPhoto',USER.photoUrl); set('setPersonalGreeting',USER.greetingText||''); set('setCompany',identity.companyName); set('setAppName',identity.systemName); set('setWelcome',s.welcomeText); set('setMorning',s.greetingMorning); set('setAfternoon',s.greetingAfternoon); set('setEvening',s.greetingEvening); set('setNight',s.greetingNight); applySettingsPermissionUi(); updateProfilePreview(USER.photoUrl||'');}
function openSettingPage(name){const targetName=String(name||'home'); if(['identity','systemGreeting'].indexOf(targetName)>=0&&!canManageSystemIdentitySettings()){toast('คุณไม่มีสิทธิ์แก้ไขชื่อบริษัทและชื่อระบบ');name='home'} document.querySelectorAll('#page-settings .setting-sub').forEach(x=>x.classList.remove('active')); let id=name==='home'?'settingsHome':'setting'+name.charAt(0).toUpperCase()+name.slice(1); let el=$(id); if(el)el.classList.add('active'); renderSettings(); if(name==='identity')loadSystemIdentitySettingsForSettings(); window.scrollTo({top:0,behavior:'smooth'});}
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
async function saveSettings(){return saveSystemGreetingSettings();}
function renderHomeProfileSafe(){
  const name=(currentDisplayName()||'-').split(' ')[0];
  const greetingEl=$('greetingText');
  const welcomeEl=$('welcomeText');
  if(greetingEl)greetingEl.textContent=`${greeting()}, ${name} 👋`;
  if(welcomeEl)welcomeEl.textContent=DB.settings?.welcomeText||'-';
}

const originalRenderHomeForSettings=renderHome;
renderHome=function(){
  originalRenderHomeForSettings();
  renderHomeProfileSafe();
};

renderSettings=function(){
  if(!USER)return;
  let s=DB.settings||{};
  let identity=getSystemIdentitySettingsForUi();
  let set=(id,val)=>{let el=$(id); if(el)el.value=val||''};
  set('setDisplay',USER.displayName||USER.fullName||USER.username);
  set('setQuoteDisplayName',USER.quoteDisplayName||USER.displayName||USER.fullName||USER.username);
  set('setPosition',USER.jobTitle||USER.position||'');
  set('setPhone',USER.phone);
  const phoneLink=$('setPhoneLink');
  if(phoneLink)phoneLink.innerHTML=renderPhoneLink(USER.phone);
  set('setEmail',USER.email);
  set('setPhoto',USER.profileImageUrl||USER.photoUrl);
  set('setPersonalGreeting',USER.greetingText||'');
  set('setCompany',identity.companyName);
  set('setAppName',identity.systemName);
  set('setWelcome',s.welcomeText);
  set('setMorning',s.greetingMorning);
  set('setAfternoon',s.greetingAfternoon);
  set('setEvening',s.greetingEvening);
  set('setNight',s.greetingNight);
  applySettingsPermissionUi();
  PROFILE_IMAGE_DATA='';
  updateProfilePreview(USER.profileImageUrl||USER.photoUrl||'');
};

updateProfilePreview=function(src){
  let box=$('profilePreview');
  if(!box)return;
  box.innerHTML=src?`<img src="${src}" onerror="this.parentNode.textContent='👤'">`:'👤';
};

handleProfileImage=function(ev){
  let file=ev.target.files&&ev.target.files[0];
  if(!file)return;
  if(!/^image\/(png|jpe?g|webp)$/i.test(file.type||'')){toast('ไฟล์ต้องเป็น JPG, PNG หรือ WEBP');return;}
  if(file.size>5*1024*1024){toast('ไฟล์รูปใหญ่เกินไป');return;}
  let reader=new FileReader();
  reader.onload=e=>{
    let img=new Image();
    img.onload=()=>{
      let canvas=document.createElement('canvas');
      let max=960,scale=Math.min(max/img.width,max/img.height,1);
      canvas.width=Math.round(img.width*scale);
      canvas.height=Math.round(img.height*scale);
      let ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      PROFILE_IMAGE_DATA=canvas.toDataURL(file.type==='image/png'?'image/png':'image/jpeg',0.82);
      let photoInput=$('setPhoto');
      if(photoInput)photoInput.value='';
      updateProfilePreview(PROFILE_IMAGE_DATA);
      toast('อัพโหลดรูปแล้ว กดบันทึกโปรไฟล์เพื่อใช้งาน');
    };
    img.onerror=()=>toast('ไม่สามารถอ่านรูปภาพได้');
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
};

saveProfile=async function(){
  const btn=$('saveProfileBtn');
  try{
    if(btn){btn.disabled=true;btn.textContent='กำลังบันทึก...';}
    let profileImageUrl=$('setPhoto')?.value||'';
    if(PROFILE_IMAGE_DATA){
      toast('กำลังอัพโหลดรูป...');
      const uploadResponse=await gas('uploadProfileImage',{profileImageData:PROFILE_IMAGE_DATA});
      if(!uploadResponse.ok){
        toast(uploadResponse.message||'Upload failed');
        return;
      }
      profileImageUrl=uploadResponse.data?.profileImageUrl||uploadResponse.data?.photoUrl||'';
    }
    const phone=normalizePhone($('setPhone')?.value||'');
    if(phone&&!isValidPhone(phone)){toast('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');return;}
    let p={
      displayName: $('setDisplay')?.value||'',
      quoteDisplayName: $('setQuoteDisplayName')?.value||'',
      jobTitle: $('setPosition')?.value||'',
      phone: phone,
      profileImageUrl: profileImageUrl,
      greetingText: USER?.greetingText||''
    };
    let r=await gas('updateProfile',p);
    toast(r.message||'Profile saved');
    if(r.ok){
      USER=Object.assign({},USER||{},r.data||{});
      PROFILE_IMAGE_DATA='';
      localStorage.setItem('currentUser',JSON.stringify(USER));
      localStorage.setItem('sg_user',JSON.stringify(USER));
      if(typeof clearCache==='function')clearCache('sg_bootstrap_cache');
      renderProfile();
      renderHome();
      renderSettings();
    }
  }catch(error){
    console.error(error);
    toast(error&&error.message?error.message:'Profile save failed');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='บันทึกโปรไฟล์';}
  }
};

async function saveSystemGreetingSettings(){
  const btn=$('saveSettingsBtn');
  try{
    if(btn){btn.disabled=true;btn.textContent='กำลังบันทึก...';}
    let p={
      welcomeText: $('setWelcome')?.value||'',
      greetingMorning: $('setMorning')?.value||'',
      greetingAfternoon: $('setAfternoon')?.value||'',
      greetingEvening: $('setEvening')?.value||'',
      greetingNight: $('setNight')?.value||''
    };
    let r=await gas('updateSettings',p);
    toast(r.message||'Settings saved');
    if(r.ok){
      const identity=getSystemIdentitySettingsForUi();
      DB.settings=Object.assign({},DB.settings||{},r.data||p,identity);
      if(typeof invalidateBootstrapApiCache==='function')invalidateBootstrapApiCache();
      else if(typeof clearCache==='function')clearCache('sg_bootstrap_cache');
      renderBrand();
      renderHome();
    }
  }catch(error){
    console.error(error);
    toast(error&&error.message?error.message:'Settings save failed');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='บันทึกคำทักทายจากระบบ';}
  }
}

saveSettings=async function(){return saveSystemGreetingSettings();};

async function loadSystemIdentitySettingsForSettings(){
  if(!canManageSystemIdentitySettings())return null;
  try{
    const response=await callApi('getSystemIdentitySettings',{});
    if(response&&response.ok&&response.data){
      setPublicSystemSettings(response.data);
      const identity=getSystemIdentitySettingsForUi();
      const company=$('setCompany');
      const system=$('setAppName');
      if(company)company.value=identity.companyName;
      if(system)system.value=identity.systemName;
    }
    return response;
  }catch(error){
    console.warn('System identity load failed',error);
    return null;
  }
}

function validateSystemIdentityInputForUi(value,label){
  const text=String(value||'').trim();
  if(!text)return `${label} ต้องไม่ว่าง`;
  if(text.length>100)return `${label} ต้องไม่เกิน 100 ตัวอักษร`;
  if(/^[=+\-@]/.test(text)||/[<>]/.test(text)||/<\/?[a-z][\s\S]*>/i.test(text)||/script/i.test(text)){
    return `${label} ต้องไม่เป็น HTML, Script หรือสูตร`;
  }
  return '';
}

async function saveSystemIdentitySettings(){
  const btn=$('saveSystemIdentityBtn');
  if(!canManageSystemIdentitySettings()){
    toast('คุณไม่มีสิทธิ์แก้ไขชื่อบริษัทและชื่อระบบ');
    return;
  }
  try{
    if(btn){btn.disabled=true;btn.textContent='กำลังบันทึก...';}
    const payload={
      companyName: String($('setCompany')?.value||'').trim(),
      systemName: String($('setAppName')?.value||'').trim()
    };
    const companyError=validateSystemIdentityInputForUi(payload.companyName,'ชื่อบริษัท');
    const systemError=validateSystemIdentityInputForUi(payload.systemName,'ชื่อระบบ');
    if(companyError||systemError){
      toast(companyError||systemError);
      return {ok:false,message:companyError||systemError};
    }
    const response=await callApi('updateSystemIdentitySettings',payload);
    if(!response||!response.ok){
      toast(response?.message||'ไม่สามารถบันทึกชื่อบริษัทและชื่อระบบได้ กรุณาลองใหม่อีกครั้ง');
      return response;
    }
    if(typeof clearCache==='function'){
      clearCache(PUBLIC_SETTINGS_CACHE_KEY);
    }
    if(typeof invalidateBootstrapApiCache==='function')invalidateBootstrapApiCache();
    setPublicSystemSettings(response.data||payload);
    renderSettings();
    toast(response.message||'บันทึกชื่อบริษัทและชื่อระบบเรียบร้อยแล้ว');
    return response;
  }catch(error){
    console.error(error);
    toast('ไม่สามารถบันทึกชื่อบริษัทและชื่อระบบได้ กรุณาลองใหม่อีกครั้ง');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='บันทึกชื่อบริษัทและชื่อระบบ';}
  }
}

async function savePersonalGreetingSettings(){
  const btn=$('savePersonalGreetingBtn');
  try{
    if(btn){btn.disabled=true;btn.textContent='กำลังบันทึก...';}
    const greetingText=$('setPersonalGreeting')?.value||'';
    const response=await callApi('updateProfile',{greetingText:greetingText});
    toast(response?.message||'บันทึกคำทักทายส่วนตัวแล้ว');
    if(response&&response.ok){
      USER=Object.assign({},USER||{},response.data||{},{greetingText:greetingText});
      localStorage.setItem('currentUser',JSON.stringify(USER));
      localStorage.setItem('sg_user',JSON.stringify(USER));
      if(typeof invalidateBootstrapApiCache==='function')invalidateBootstrapApiCache();
      renderHome();
      renderSettings();
    }
    return response;
  }catch(error){
    console.error(error);
    toast('ไม่สามารถบันทึกคำทักทายส่วนตัวได้');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='บันทึกคำทักทายส่วนตัว';}
  }
}

function customerFormHtml(customer){const c=customer||{};return `<div class="field"><label>รหัสร้านค้า</label><input id="mCustomerId" value="${escapeHtml(c.customerId||'')}" ${c.customerId?'disabled':''}></div><div class="field"><label>ชื่อร้าน</label><input id="mName" value="${escapeHtml(c.customerName||'')}"></div><div class="field"><label>จังหวัด</label><input id="mProvince" value="${escapeHtml(c.province||'')}"></div><div class="field"><label>โทร</label><input id="mPhone" type="tel" inputmode="tel" value="${escapeHtml(c.phone==='-'?'':c.phone||'')}"></div><div class="field"><label>ที่อยู่</label><textarea id="mAddress">${escapeHtml(c.address||'')}</textarea></div><div class="field"><label>หมายเหตุ</label><textarea id="mNotes">${escapeHtml(c.notes||'')}</textarea></div><button id="saveCustomerModalButton" class="primary" onclick="saveCustomerModal('${escapeHtml(c.customerId||'')}')">บันทึก</button>`}
function openModal(type){let title={customer:'เพิ่มร้านค้า',product:'เพิ่มสินค้า',promo:'เพิ่มโปรโมชั่น'}[type]; document.getElementById('modalTitle').textContent=title; let html=''; if(type==='customer')html=customerFormHtml(); if(type==='product')html=`<div class="field"><label>ชื่อสินค้า</label><input id="mName"></div><div class="field"><label>แบรนด์</label><select id="mBrand"><option>Weber</option><option>Gyproc</option></select></div><div class="field"><label>หน่วย</label><input id="mUnit"></div><div class="field"><label>ราคา</label><input id="mPrice" type="number"></div><button class="primary" onclick="saveModal('product')">บันทึก</button>`; if(type==='promo')html=`<div class="field"><label>แบรนด์</label><select id="mBrand"><option>Weber</option><option>Gyproc</option></select></div><div class="field"><label>สินค้า</label><input id="mName"></div><div class="field"><label>รายละเอียด</label><textarea id="mDesc"></textarea></div><div class="field"><label>ส่วนลด/โปร</label><input id="mDiscount"></div><button class="primary" onclick="saveModal('promo')">บันทึก</button>`; document.getElementById('modalBody').innerHTML=html; document.getElementById('modal').classList.add('show')}
function canEditCustomers(){return !!(DB.permissions&&DB.permissions.canManageCustomers)||['SUPER_ADMIN','ADMIN'].indexOf(currentRole())>=0}
function openCustomerEditModal(customerId){if(!canEditCustomers()){toast('คุณไม่มีสิทธิ์แก้ไขข้อมูลร้านค้า');return;}const customer=findCustomerById(customerId);if(!customer){toast('ไม่พบข้อมูลร้านค้า');return;}$('modalTitle').textContent='แก้ไขข้อมูลร้านค้า';$('modalBody').innerHTML=customerFormHtml(customer);$('modal').classList.add('show')}
async function saveCustomerModal(existingId){const button=$('saveCustomerModalButton');const customerId=String(existingId||$('mCustomerId')?.value||'').trim();const phone=normalizePhone($('mPhone')?.value||'');if(!customerId||!String($('mName')?.value||'').trim()){toast('กรุณากรอกรหัสและชื่อร้านค้า');return;}if(phone&&!isValidPhone(phone)){toast('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');return;}const payload={customerId:customerId,customerName:$('mName')?.value||'',province:$('mProvince')?.value||'',phone:phone,address:$('mAddress')?.value||'',notes:$('mNotes')?.value||''};try{if(button)button.disabled=true;const response=await callApi(existingId?'updateCustomer':'saveCustomer',payload);toast(response.message||(response.ok?'บันทึกแล้ว':'บันทึกไม่สำเร็จ'));if(!response.ok)return;closeModal();clearCustomersFrontendCache();invalidateBootstrapCustomerCacheIfNeeded();customersLoaded=false;await loadCustomers({force:true});await loadFavoriteCustomers();}finally{if(button)button.disabled=false}}
function closeModal(){document.getElementById('modal').classList.remove('show')}
async function saveModal(type){
  let r;
  if (type === 'customer') return saveCustomerModal('');
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
  if(type==='customer'){
    clearCustomersFrontendCache();
    invalidateBootstrapCustomerCacheIfNeeded();
    customersLoaded=false;
    await loadCustomers({force:true});
    return;
  }
  if(type==='product'){
    if(typeof clearCache==='function')clearCache('sg_products_cache');
    productsLoaded=false;
    await loadProducts({force:true});
    return;
  }
  await loadData({force:true});
}
function toast(msg){const el=document.getElementById('toast'); if(!el)return; el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2600)}

function isFavoriteCustomer(customerId){return FAVORITE_CUSTOMERS.some(c=>String(c.customerId||'')===String(customerId||''))}
function renderCustomerCard(c,isFavorite){const id=escapeHtml(c.customerId||'');const quoteButton=currentRole()==='VIEWER'?'':`<button class="ghost" onclick="selectCustomer('${id}')">ออกใบเสนอราคา</button>`;return `<div class="card ${isFavorite?'favorite-card':''}" ${isFavorite?`draggable="true" data-customer-id="${id}"`:''}><h3>${escapeHtml(c.customerName||'-')}</h3><p>รหัสร้านค้า: ${escapeHtml(c.customerCode||c.customerId||c.id||'-')}</p><p>ประเภท: ${escapeHtml(c.customerType||'-')}</p><p>จังหวัด: ${escapeHtml(c.province||'-')}</p><p>โทร: ${renderPhoneLink(c.phone)||'-'}</p><p>ที่อยู่: ${escapeHtml(c.address||'-')}</p><p>หมายเหตุ: ${escapeHtml(c.notes||'-')}</p><div class="customer-actions">${quoteButton}${canEditCustomers()?`<button class="ghost" onclick="openCustomerEditModal('${id}')">✏️ แก้ไขข้อมูล</button>`:''}</div><button class="favorite-toggle" onclick="toggleFavoriteCustomer('${id}')">${isFavorite?'⭐ ยกเลิกปักหมุด':'☆ เพิ่มในร้านค้าโปรด'}</button></div>`}
function renderFavoriteCustomers(){const box=$('favoriteCustomers');if(!box)return;const q=$('customerSearch')?.value||'';const visible=FAVORITE_CUSTOMERS.filter(c=>!q||smartMatch(c,q,['customerId','customerCode','customerName','province','customerType','phone','notes','address']));box.innerHTML=`<div class="favorite-head"><div><h2>⭐ ร้านค้าโปรด</h2><small>${q?'ล้างคำค้นหาเพื่อจัดเรียง':'ลากการ์ดเพื่อจัดเรียงร้านค้าโปรด'}</small></div><b>${FAVORITE_CUSTOMERS.length} / 5 ร้าน</b></div>${visible.length?`<div id="favoriteCustomerGrid" class="favorite-grid">${visible.map(c=>renderCustomerCard(c,true)).join('')}</div>`:'<div class="favorite-empty">ยังไม่มีร้านค้าโปรด</div>'}`;if(q){box.querySelectorAll('[draggable]').forEach(card=>card.removeAttribute('draggable'))}else{bindFavoriteDragAndDrop()}}
function renderCustomers(){ensureCustomerCrmUi();let q=$('customerSearch')?.value||'';let type=($('customerTypeFilter')?.value||'');let fields=['customerId','customerCode','customerName','province','customerType','phone','notes','address'];let customers=DB.customers.filter(c=>smartMatch(c,q,fields)&&(!type||c.customerType===type));let limited=limitList(customers,LIST_RENDER_LIMIT);renderCustomerSummary(DB.customers);renderFavoriteCustomers();let grid=$('customerGrid');if(!grid)return;if(!customersLoaded&&!DB.customers.length){grid.innerHTML='<p class="loading-text">กำลังโหลดข้อมูล...</p>';return;}grid.innerHTML=renderLimitNotice(limited.limited,LIST_RENDER_LIMIT)+limited.items.map(c=>renderCustomerCard(c,isFavoriteCustomer(c.customerId))).join('')}
async function loadFavoriteCustomers(){const response=await callApi('getFavoriteCustomers',{});if(response&&response.ok)FAVORITE_CUSTOMERS=Array.isArray(response.data)?response.data:[];renderCustomers();return response}
async function toggleFavoriteCustomer(customerId){const favorite=isFavoriteCustomer(customerId);if(!favorite&&FAVORITE_CUSTOMERS.length>=5){toast('สามารถปักร้านค้าโปรดได้สูงสุด 5 ร้าน');return;}const response=await callApi(favorite?'removeFavoriteCustomer':'addFavoriteCustomer',{customerId:customerId});toast(response.message||(response.ok?'บันทึกแล้ว':'บันทึกไม่สำเร็จ'));if(response.ok)await loadFavoriteCustomers()}
async function persistFavoriteOrder(){const grid=$('favoriteCustomerGrid');if(!grid)return;const customerIds=Array.from(grid.querySelectorAll('[data-customer-id]')).map(el=>el.dataset.customerId);const response=await callApi('reorderFavoriteCustomers',{customerIds:customerIds});if(!response.ok){toast(response.message||'จัดลำดับไม่สำเร็จ');await loadFavoriteCustomers();return;}const map=new Map(FAVORITE_CUSTOMERS.map(c=>[String(c.customerId),c]));FAVORITE_CUSTOMERS=customerIds.map(id=>map.get(id)).filter(Boolean)}
function bindFavoriteDragAndDrop(){const grid=$('favoriteCustomerGrid');if(!grid||grid.dataset.bound)return;grid.dataset.bound='true';let dragged=null;grid.addEventListener('dragstart',event=>{dragged=event.target.closest('.favorite-card');if(!dragged)return;dragged.classList.add('is-dragging');event.dataTransfer.effectAllowed='move'});grid.addEventListener('dragover',event=>{event.preventDefault();const target=event.target.closest('.favorite-card');if(dragged&&target&&target!==dragged)grid.insertBefore(dragged,target)});grid.addEventListener('dragend',()=>{if(dragged)dragged.classList.remove('is-dragging');dragged=null;persistFavoriteOrder()});let timer=null,touchCard=null;grid.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'||event.target.closest('button,a'))return;touchCard=event.target.closest('.favorite-card');if(touchCard)timer=setTimeout(()=>{touchCard.classList.add('is-dragging');touchCard.setPointerCapture(event.pointerId)},350)});grid.addEventListener('pointermove',event=>{if(!touchCard||!touchCard.classList.contains('is-dragging'))return;event.preventDefault();const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.favorite-card');if(target&&target!==touchCard)grid.insertBefore(touchCard,target)});const finish=()=>{clearTimeout(timer);if(touchCard&&touchCard.classList.contains('is-dragging')){touchCard.classList.remove('is-dragging');persistFavoriteOrder()}touchCard=null};grid.addEventListener('pointerup',finish);grid.addEventListener('pointercancel',finish)}

function renderProducts(){let q=$('searchProducts')?.value||''; let grid=$('productGrid'); if(!grid)return; let fields=['productId','sku','productName','description','brand','discountGroup','groupCode','unit','notes','promoText']; let products=DB.products.filter(p=>smartMatch(p,q,fields));let limited=limitList(products,LIST_RENDER_LIMIT); if(!productsLoaded&&!DB.products.length){grid.innerHTML='<p class="loading-text">กำลังโหลดข้อมูล...</p>';return;} grid.innerHTML=renderLimitNotice(limited.limited,LIST_RENDER_LIMIT)+limited.items.map(p=>{const id=encodeURIComponent(String(p.productId||p.sku||p.id||''));return `<div class="card product-card-clickable" role="button" tabindex="0" onclick="openProductCalculator(decodeURIComponent('${id}'))" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openProductCalculator(decodeURIComponent('${id}'))}"><span class="pill ${p.brand==='Weber'?'yellow':'blue'}">${p.brand||'-'}</span><h3>${p.productName||'-'}</h3><p>รหัสสินค้า: ${p.sku||p.productId||p.id||'-'}</p><p>${p.unit||'-'}</p><b>${money(p.listPrice)}</b><br><button class="ghost" onclick="addProductCardToQuote(decodeURIComponent('${id}'),event)">เพิ่มลงใบเสนอราคา</button></div>`}).join('')}

function renderQuoteCustomerPicker(forceShow){
  const picker=$('quoteCustomerPicker'),input=$('quoteCustomerSearch');
  if(!picker||!input)return;
  const q=input.value||'';
  const shouldShow=forceShow||document.activeElement===input;
  if(!shouldShow){picker.classList.remove('show');picker.innerHTML='';return;}
  if(!customersLoaded&&!DB.customers.length){
    picker.classList.add('show');
    picker.innerHTML='<div class="quote-empty">กำลังโหลดข้อมูล...</div>';
    loadCustomers();
    return;
  }
  const matchesAll=DB.customers.filter(c=>smartMatch(c,q,getQuoteCustomerFields()));
  const limited=limitList(matchesAll,QUOTE_PICKER_LIMIT);
  picker.classList.add('show');
  picker.innerHTML=limited.items.length?renderLimitNotice(limited.limited,QUOTE_PICKER_LIMIT)+limited.items.map(c=>`<button type="button" class="quote-option" onclick="chooseQuoteCustomer('${c.customerId}')"><b>${c.customerName||'-'}</b><small>รหัสร้านค้า: ${c.customerCode||c.customerId||'-'} · ${c.province||'-'} · ${c.customerType||'-'}</small></button>`).join(''):'<div class="quote-empty">ไม่พบรายการที่ค้นหา</div>';
}

function renderQuoteProductPicker(){
  const requestId=++quoteProductSearchSequence;
  const q=$('productSearch')?.value||'';
  const picker=$('productPicker');
  if(!picker)return;
  if(!isQuoteBusinessUnitReadyForProducts()){
    picker.innerHTML='<div class="row quote-empty">กรุณาเลือก BU ก่อนแสดงสินค้า</div>';
    return;
  }
  const businessUnit=getSelectedQuoteBusinessUnitForProducts();
  const businessUnitLabel=quoteBusinessUnitLabel(businessUnit);
  if(!productsLoaded&&!DB.products.length){
    picker.innerHTML=`<div class="row quote-empty">กำลังโหลดสินค้า โดยเรียง ${businessUnitLabel} ก่อน...</div>`;
    if(document.activeElement===$('productSearch')){
      loadProducts().then(()=>{if(requestId===quoteProductSearchSequence&&businessUnit===getSelectedQuoteBusinessUnitForProducts())renderQuoteProductPicker();});
    }
    return;
  }
  const matchesAll=filterQuoteProductsByBusinessUnit(q,businessUnit);
  const limited=limitList(matchesAll,QUOTE_PICKER_LIMIT);
  const notice=limited.limited?`<div class="list-limit">แสดง 30 รายการแรกจากทุก BU โดยเรียง ${businessUnitLabel} ก่อน กรุณาค้นหาเพิ่มเติม</div>`:'';
  picker.innerHTML=limited.items.length?notice+limited.items.map(p=>{const productUnit=normalizeProductBusinessUnitForUi(p);return `<div class="row"><div class="product-img">${productUnit==='WEBER'?'🟨':'🟦'}</div><div><div class="quote-product-title">${quoteProductBusinessUnitBadge(p,businessUnit)}<b>${p.productName||'-'}</b></div><small>${p.brand||quoteBusinessUnitLabel(productUnit)} · รหัสสินค้า: ${p.sku||p.productId||p.id||'-'} · ${p.unit||'-'} · ${money(p.listPrice)}</small></div><button class="tiny" style="margin-left:auto" onclick='addCart(${JSON.stringify(p)})'>+ เพิ่ม</button></div>`}).join(''):`<div class="row quote-empty">ไม่พบสินค้าที่ตรงกับคำค้น</div>`;
}

function normalizeRole(role){const text=String(role||'').trim().toLowerCase().replace(/[\s-]+/g,'_');if(text==='super_admin'||text==='superadmin')return'SUPER_ADMIN';if(text==='admin')return'ADMIN';if(text==='manager')return'MANAGER';if(text==='viewer')return'VIEWER';return'SALES'}
function currentRole(){return normalizeRole(USER&&USER.role)}
function canManageSystemIdentitySettings(){return currentRole()==='SUPER_ADMIN'||Boolean(DB.permissions&&DB.permissions.isSuperAdmin)}
function applySettingsPermissionUi(){
  const allowed=canManageSystemIdentitySettings();
  document.querySelectorAll('[data-super-admin-only="true"]').forEach(el=>{
    el.classList.toggle('hidden',!allowed);
    el.hidden=!allowed;
  });
  const active=document.querySelector('#page-settings .setting-sub.active[data-super-admin-only="true"]');
  if(active&&!allowed){
    active.classList.remove('active');
    const home=$('settingsHome');
    if(home)home.classList.add('active');
  }
}
function getRoleLevel(role){const levels={SUPER_ADMIN:50,ADMIN:40,MANAGER:30,SALES:20,VIEWER:10};return levels[normalizeRole(role)]||0}
function canManageUserRole(targetRole){return getRoleLevel(currentRole())>getRoleLevel(targetRole)}
function getManageableRoleOptions(existingRole){
  const roles=['SUPER_ADMIN','ADMIN','MANAGER','SALES','VIEWER'];
  if(currentRole()==='SUPER_ADMIN')return roles;
  const allowed=roles.filter(role=>getRoleLevel(currentRole())>getRoleLevel(role));
  const current=normalizeRole(existingRole||'');
  if(current&&allowed.indexOf(current)<0&&canManageUserRole(current))allowed.unshift(current);
  return allowed;
}
function escapeHtml(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function getUserArea(user){return String(user&&user.area||user&&user.branch||'').trim()}
function normalizePhone(value){const raw=String(value==null?'':value).trim();const prefix=raw.charAt(0)==='+'?'+':'';return prefix+raw.replace(/\D/g,'')}
function isValidPhone(value){return /^\+?\d{8,15}$/.test(normalizePhone(value))}
function formatPhoneForDisplay(value){const phone=normalizePhone(value);return /^0\d{9}$/.test(phone)?`${phone.slice(0,3)}-${phone.slice(3,6)}-${phone.slice(6)}`:phone}
function buildTelHref(value){const phone=normalizePhone(value);return isValidPhone(phone)?`tel:${phone}`:''}
function renderPhoneLink(value){const href=buildTelHref(value);if(!href)return '';const label=formatPhoneForDisplay(value);return `<a class="phone-link" href="${escapeHtml(href)}" aria-label="โทรหา ${escapeHtml(label)}">${escapeHtml(label)}</a>`}
function passwordEyeIcon(visible){return visible?'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.7 10.7 0 0112 4c5.5 0 9 5 9 5a16 16 0 01-2.1 2.5M6.2 6.2C4.2 7.5 3 9 3 9s3.5 5 9 5c1 0 1.9-.2 2.7-.4"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>'}
function toggleUserPasswordVisibility(inputId,button){
  const input=$(inputId);
  if(!input)return;
  const show=input.type==='password';
  input.type=show?'text':'password';
  button.innerHTML=passwordEyeIcon(show);
  button.setAttribute('aria-label',show?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน');
  button.setAttribute('aria-pressed',String(show));
}
function canAccessPage(page){const role=currentRole();const access={SUPER_ADMIN:['home','quote','customers','products','promos','quotes','users','report','settings'],ADMIN:['home','quote','customers','products','promos','quotes','users','report','settings'],MANAGER:['home','customers','quotes','report','settings'],SALES:['home','quote','customers','products','promos','quotes','settings'],VIEWER:['home','customers','quotes','report','settings']};return (access[role]||access.VIEWER).indexOf(page)>=0}
function applyRolePermissions(){
  document.querySelectorAll('.nav button[data-page]').forEach(btn=>{const page=btn.getAttribute('data-page');btn.classList.toggle('hidden',!canAccessPage(page));});
  document.querySelectorAll('.main-action').forEach(btn=>{btn.classList.toggle('hidden',['SUPER_ADMIN','ADMIN'].indexOf(currentRole())<0);});
  const quoteActions=document.querySelector('#page-quote .actions');
  if(quoteActions)quoteActions.classList.toggle('hidden',currentRole()==='VIEWER');
  applySettingsPermissionUi();
}
const baseNormalizeDbForAuth=normalizeDb;
normalizeDb=function(data){
  const db=baseNormalizeDbForAuth(data);
  db.users=Array.isArray(data&&data.users)?data.users:[];
  db.permissions=data&&data.permissions?data.permissions:{};
  if(data&&data.user){
    USER=Object.assign({}, USER||{}, data.user, {displayName:data.user.displayName||data.user.fullName||data.user.username});
    try{localStorage.setItem('sg_user',JSON.stringify(USER));localStorage.setItem('currentUser',JSON.stringify(USER));localStorage.setItem('sg_role',USER.role||'');localStorage.setItem('sg_userId',USER.userId||'')}catch(error){}
  }
  return db;
};
const baseShowAppForAuth=showApp;
showApp=function(){baseShowAppForAuth();applyRolePermissions();};
const baseRenderAllForAuth=renderAll;
renderAll=function(){baseRenderAllForAuth();renderUsers();applyRolePermissions();};
const baseGoForAuth=go;
go=function(page,btn){if(!canAccessPage(page)){toast('ไม่มีสิทธิ์เข้าใช้งานหน้านี้');return;}baseGoForAuth(page,btn);applyRolePermissions();};
const baseEnsurePageDataForAuth=ensurePageData;
ensurePageData=function(page){if(page==='users'){return loadUsers();}if(page==='customers'){return Promise.all([baseEnsurePageDataForAuth(page),loadFavoriteCustomers()]);}if(page==='quote'){return Promise.all([baseEnsurePageDataForAuth(page),loadProductPreferences()]);}return baseEnsurePageDataForAuth(page);};
async function loadUsers(){
  if(['SUPER_ADMIN','ADMIN'].indexOf(currentRole())<0)return {ok:false,message:'Insufficient permission'};
  const response=await callApi('loadUsers',{});
  if(response&&response.ok){DB.users=Array.isArray(response.data)?response.data:[];renderUsers();}
  else toast(response.message||'โหลด Users ไม่สำเร็จ');
  return response;
}
function renderUsers(){
  const list=$('userList');if(!list)return;
  if(['SUPER_ADMIN','ADMIN'].indexOf(currentRole())<0){list.innerHTML='<p class="loading-text">Admin only</p>';return;}
  const q=normalizeSearchText($('userSearch')?.value||'');
  const users=(Array.isArray(DB.users)?DB.users:[]).filter(u=>!q||smartMatch(u,q,['fullName','displayName','username','role','branch','status','email','phone']));
  list.innerHTML=users.length?users.map(u=>`<div class="row user-row"><div><b>${u.fullName||u.displayName||u.username||'-'}</b><br><small>${u.username||'-'} · ${u.email||'-'}</small></div><span class="pill blue">${u.role||'-'}</span><span>${u.branch||'-'}</span><span>${u.status||'-'}</span><small>${u.lastLogin||'-'}</small><button class="tiny" onclick="openUserForm('${u.userId||''}')">Edit</button></div>`).join(''):'<p class="loading-text">No users</p>';
}
function openUserForm(userId){
  const form=$('userForm');if(!form)return;
  const user=(Array.isArray(DB.users)?DB.users:[]).find(u=>String(u.userId||'')===String(userId||''))||{};
  form.classList.remove('hidden');
  const roleOptions=(currentRole()==='SUPER_ADMIN'?['SUPER_ADMIN','ADMIN','MANAGER','SALES','VIEWER']:['ADMIN','MANAGER','SALES','VIEWER']).map(r=>`<option value="${r}">${r}</option>`).join('');
  form.innerHTML=`<div class="grid2"><div class="field"><label>Full Name</label><input id="userFullName" value="${user.fullName||user.displayName||''}"></div><div class="field"><label>Username</label><input id="userUsername" value="${user.username||''}" ${user.userId?'disabled':''}></div><div class="field"><label>Password ${user.userId?'(leave blank to keep)':''}</label><input id="userPassword" type="password"></div><div class="field"><label>Email</label><input id="userEmail" value="${user.email||''}"></div><div class="field"><label>Phone</label><input id="userPhone" value="${user.phone||''}"></div><div class="field"><label>Role</label><select id="userRole">${roleOptions}</select></div><div class="field"><label>Branch</label><input id="userBranch" value="${user.branch||''}"></div><div class="field"><label>Status</label><select id="userStatus"><option>Active</option><option>Inactive</option><option>Locked</option></select></div></div><div class="actions"><button class="primary" onclick="saveUserForm('${user.userId||''}')">${user.userId?'Update User':'Create User'}</button><button class="ghost" onclick="$('userForm').classList.add('hidden')">Cancel</button></div>`;
  $('userRole').value=normalizeRole(user.role||'SALES');
  $('userStatus').value=user.status||'Active';
}
async function saveUserForm(userId){
  const payload={userId:userId||'',fullName:$('userFullName')?.value||'',username:$('userUsername')?.value||'',password:$('userPassword')?.value||'',email:$('userEmail')?.value||'',phone:$('userPhone')?.value||'',role:$('userRole')?.value||'Sales',branch:$('userBranch')?.value||'',status:$('userStatus')?.value||'Active'};
  const action=userId?'updateUser':'createUser';
  const response=await callApi(action,payload);
  toast(response.message || (response.ok ? 'Saved' : 'Save failed'));
  if(response&&response.ok){$('userForm')?.classList.add('hidden');await loadUsers();}
  return response;
}
renderUsers=function(){
  const list=$('userList');if(!list)return;
  if(['SUPER_ADMIN','ADMIN'].indexOf(currentRole())<0){list.innerHTML='<p class="loading-text">Admin only</p>';return;}
  const q=normalizeSearchText($('userSearch')?.value||'');
  const users=(Array.isArray(DB.users)?DB.users:[]).filter(u=>!q||smartMatch(Object.assign({},u,{area:getUserArea(u)}),q,['fullName','displayName','username','role','area','status','email','phone']));
  list.innerHTML=users.length?users.map(u=>{
    const canEdit=canManageUserRole(u.role);
    return `<div class="row user-row"><div><b>${escapeHtml(u.fullName||u.displayName||u.username||'-')}</b><br><small>${escapeHtml(u.username||'-')} · ${escapeHtml(u.email||'-')}</small><br>${renderPhoneLink(u.phone)||'<small>-</small>'}</div><span class="pill blue">${escapeHtml(u.role||'-')}</span><span>${escapeHtml(getUserArea(u)||'-')}</span><span>${escapeHtml(u.status||'-')}</span><small>${escapeHtml(u.lastLogin||'-')}</small><button class="tiny" ${canEdit?'':'disabled'} onclick="openUserForm('${escapeHtml(u.userId||'')}')">${canEdit?'แก้ไข':'ไม่มีสิทธิ์'}</button></div>`;
  }).join(''):'<p class="loading-text">No users</p>';
};
openUserForm=function(userId){
  const form=$('userForm');if(!form)return;
  const user=(Array.isArray(DB.users)?DB.users:[]).find(u=>String(u.userId||'')===String(userId||''))||{};
  if(user.userId&&!canManageUserRole(user.role)){toast('ไม่มีสิทธิ์แก้ไขผู้ใช้งาน Role นี้');return;}
  form.classList.remove('hidden');
  const roleOptions=getManageableRoleOptions(user.role).map(r=>`<option value="${r}">${r}</option>`).join('');
  const passwordHelp=user.userId?'เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน':'ต้องกรอกรหัสผ่านและยืนยันรหัสผ่าน';
  form.innerHTML=`<div class="grid2"><div class="field"><label>ชื่อ-นามสกุล</label><input id="userFullName" maxlength="150" value="${escapeHtml(user.fullName||user.displayName||'')}"></div><div class="field"><label>Username</label><input id="userUsername" value="${escapeHtml(user.username||'')}" ${user.userId?'disabled':''}></div><div class="password-pair"><div class="field"><label>รหัสผ่าน ${user.userId?'(ไม่กรอก = ใช้รหัสเดิม)':''}</label><div class="password-field"><input id="userPassword" type="password" autocomplete="new-password" aria-describedby="userPasswordHelp"><button type="button" class="password-toggle" onclick="toggleUserPasswordVisibility('userPassword',this)" aria-label="แสดงรหัสผ่าน" aria-pressed="false">${passwordEyeIcon(false)}</button></div><small id="userPasswordHelp">${passwordHelp}</small></div><div class="field"><label>ยืนยันรหัสผ่าน</label><div class="password-field"><input id="userConfirmPassword" type="password" autocomplete="new-password"><button type="button" class="password-toggle" onclick="toggleUserPasswordVisibility('userConfirmPassword',this)" aria-label="แสดงรหัสผ่าน" aria-pressed="false">${passwordEyeIcon(false)}</button></div></div></div><div class="field"><label>Email</label><input id="userEmail" value="${escapeHtml(user.email||'')}"></div><div class="field"><label>เบอร์โทรศัพท์</label><input id="userPhone" type="tel" inputmode="tel" autocomplete="tel" value="${escapeHtml(user.phone||'')}"></div><div class="field"><label>สิทธิ์ผู้ใช้งาน</label><select id="userRole">${roleOptions}</select></div><div class="field"><label>Area</label><input id="userArea" value="${escapeHtml(getUserArea(user))}"><small>พื้นที่ที่ใช้กำหนดขอบเขตข้อมูล Dashboard รายงาน และผู้ใช้งาน</small></div><div class="field"><label>สถานะ</label><select id="userStatus"><option>Active</option><option>Inactive</option><option>Locked</option></select></div></div><div class="actions"><button id="saveUserButton" class="primary" onclick="saveUserForm('${escapeHtml(user.userId||'')}')">${user.userId?'บันทึกผู้ใช้งาน':'สร้างผู้ใช้งาน'}</button><button class="ghost" onclick="$('userForm').classList.add('hidden')">ยกเลิก</button></div>`;
  $('userRole').value=normalizeRole(user.role||'SALES');
  $('userStatus').value=user.status||'Active';
};
saveUserForm=async function(userId){
  const fullName=String($('userFullName')?.value||'').trim();
  const password=$('userPassword')?.value||'';
  const confirmPassword=$('userConfirmPassword')?.value||'';
  const area=String($('userArea')?.value||'').trim();
  if(!fullName){toast('กรุณากรอกชื่อ-นามสกุล');return {ok:false,message:'fullName is required'};}
  if(!area){toast('กรุณากรอก Area');return {ok:false,message:'area is required'};}
  if(!userId&&(!password||!confirmPassword)){toast('กรุณากรอกรหัสผ่านและยืนยันรหัสผ่าน');return {ok:false,message:'password is required'};}
  if((password||confirmPassword)&&password!==confirmPassword){toast('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');return {ok:false,message:'PASSWORD_CONFIRM_MISMATCH'};}
  const button=$('saveUserButton');
  if(button)button.disabled=true;
  const phone=normalizePhone($('userPhone')?.value||'');
  if(phone&&!isValidPhone(phone)){toast('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');return {ok:false,message:'Invalid phone format'};}
  const payload={userId:userId||'',fullName:fullName,displayName:fullName,username:$('userUsername')?.value||'',password:password,confirmPassword:confirmPassword,email:$('userEmail')?.value||'',phone:phone,role:$('userRole')?.value||'Sales',area:area,branch:area,status:$('userStatus')?.value||'Active'};
  const action=userId?'updateUser':'createUser';
  try{
    const response=await callApi(action,payload);
    toast(response.message || (response.ok ? 'บันทึกผู้ใช้งานแล้ว' : 'บันทึกไม่สำเร็จ'));
    if(response&&response.ok){$('userForm')?.classList.add('hidden');await loadUsers();}
    return response;
  }finally{
    if(button)button.disabled=false;
  }
};
const baseRenderHistoryForAuth=renderHistory;
renderHistory=function(){baseRenderHistoryForAuth();if(currentRole()==='VIEWER'){document.querySelectorAll('#quoteHistory button').forEach(btn=>{if(!/เปิดดู|Open/i.test(btn.textContent||''))btn.classList.add('hidden');});}};
const baseRenderHomeForAuth=renderHome;
renderHome=function(){baseRenderHomeForAuth();const role=currentRole();const title=document.querySelector('#dashboardContent .dashboard-kpi-grid');if(title&&role==='VIEWER'){document.querySelectorAll('#dashboardContent button').forEach(btn=>btn.classList.add('hidden'));}};
function getQuoteProductPreferenceId(product){return String(product&& (product.productId||product.sku||product.productCode||product.id||product.itemCode) || '').trim()}
function normalizeQuoteProductPreferenceId(value){return String(value||'').trim().toLowerCase()}
function getFavoriteProductIdSet(){return new Set(FAVORITE_PRODUCTS.map(product=>normalizeQuoteProductPreferenceId(getQuoteProductPreferenceId(product))).filter(Boolean))}
function getPinnedProductIdSet(){return new Set(PINNED_PRODUCTS.map(product=>normalizeQuoteProductPreferenceId(getQuoteProductPreferenceId(product))).filter(Boolean))}
function getPinnedProductOrderMap(){const map=new Map();PINNED_PRODUCTS.forEach((product,index)=>{const id=normalizeQuoteProductPreferenceId(getQuoteProductPreferenceId(product));if(id)map.set(id,Number(product.pinnedSortOrder||index+1)||index+1)});return map}
function canManageQuoteProductPreferences(){return currentRole()!=='VIEWER'&&canAccessPage('quote')}
function decorateQuotePreferenceProduct(product){const item=Object.assign({},product||{});const id=normalizeQuoteProductPreferenceId(getQuoteProductPreferenceId(item));const favoriteIds=getFavoriteProductIdSet();const pinnedOrders=getPinnedProductOrderMap();item.isFavoriteProduct=favoriteIds.has(id)||Boolean(item.isFavoriteProduct);item.isPinnedProduct=pinnedOrders.has(id)||Boolean(item.isPinnedProduct);item.pinnedSortOrder=pinnedOrders.get(id)||Number(item.pinnedSortOrder||0)||0;return item}
function productPreferenceRank(product){const item=decorateQuotePreferenceProduct(product);if(item.isPinnedProduct)return item.pinnedSortOrder||1;return item.isFavoriteProduct?1000:2000}
function findQuoteProductById(productId){const id=normalizeQuoteProductPreferenceId(productId);return DB.products.find(product=>normalizeQuoteProductPreferenceId(getQuoteProductPreferenceId(product))===id)||null}
function getPreferenceProductList(list){return (Array.isArray(list)?list:[]).map(product=>decorateQuotePreferenceProduct(Object.assign({},findQuoteProductById(getQuoteProductPreferenceId(product))||{},product))).filter(product=>getQuoteProductPreferenceId(product))}
function ensureProductPreferenceContainers(){const picker=$('productPicker');if(!picker||($('pinnedProducts')&&$('favoriteProducts')))return;const parent=picker.parentNode;if(!parent)return;if(!$('pinnedProducts')){const pinned=document.createElement('div');pinned.id='pinnedProducts';pinned.className='quote-product-preferences';parent.insertBefore(pinned,picker)}if(!$('favoriteProducts')){const favorite=document.createElement('div');favorite.id='favoriteProducts';favorite.className='quote-product-preferences';parent.insertBefore(favorite,picker)}}
async function loadProductPreferences(force){if(productPreferencesLoaded&&!force)return {ok:true,data:{favorites:FAVORITE_PRODUCTS,pinned:PINNED_PRODUCTS}};if(productPreferencesPromise&&!force)return productPreferencesPromise;productPreferencesPromise=callApi('getProductPreferences',{}).then(response=>{if(response&&response.ok){const data=response.data||{};FAVORITE_PRODUCTS=getPreferenceProductList(data.favorites);PINNED_PRODUCTS=getPreferenceProductList(data.pinned).sort((a,b)=>(Number(a.pinnedSortOrder||0)||999)-(Number(b.pinnedSortOrder||0)||999));productPreferencesLoaded=true;}renderQuoteProductPreferenceSections();if($('productPicker')&&typeof renderQuoteProductPicker==='function')setTimeout(()=>renderQuoteProductPicker(),0);return response}).finally(()=>{productPreferencesPromise=null});return productPreferencesPromise}
function renderQuoteProductPreferenceCard(product,options){
  const item=decorateQuotePreferenceProduct(product);
  const rawId=getQuoteProductPreferenceId(item);
  const idAttr=htmlAttr(rawId);
  const jsId=escapeHtml(JSON.stringify(rawId));
  const productUnit=normalizeProductBusinessUnitForUi(item);
  const opts=options||{};
  const source=String(opts.source||(opts.pinned?'PINNED':'FAVORITE')).toUpperCase();
  const sourceAttr=htmlAttr(source);
  const draggable=opts.pinned&&canManageQuoteProductPreferences()?' draggable="true" data-product-id="'+idAttr+'"':'';
  const listPrice=Number(String(item.listPrice||0).replace(/,/g,''));
  const priceHtml=listPrice>0?money(listPrice):'<span class="quote-product-missing-price">ยังไม่มีราคา</span>';
  const actions=canManageQuoteProductPreferences()?`<div class="quote-product-actions" data-no-drag><button type="button" class="quote-product-pref-button ${item.isFavoriteProduct?'is-active':''}" data-no-drag onclick='toggleFavoriteProduct(${jsId})'>${item.isFavoriteProduct?'♥':'♡'}</button><button type="button" class="quote-product-pref-button ${item.isPinnedProduct?'is-active':''}" data-no-drag onclick='togglePinnedProduct(${jsId})'>${item.isPinnedProduct?'📌':'📍'}</button><button type="button" class="tiny quote-add-product-button" data-no-drag data-product-id="${idAttr}" data-product-source="${sourceAttr}" onclick="addProductToQuoteByReference(event)">+ เพิ่ม</button></div>`:'';
  return `<div class="row quote-product-pref-card ${opts.pinned?'pinned-product-card':''}"${draggable}><div class="product-img">${productUnit==='WEBER'?'🟨':'🟦'}</div><div class="quote-product-pref-main"><div class="quote-product-title">${quoteProductBusinessUnitBadge(item,getSelectedQuoteBusinessUnitForProducts())}<b>${escapeHtml(item.productName||'-')}</b></div><small>${escapeHtml(item.brand||quoteBusinessUnitLabel(productUnit))} · ${escapeHtml(item.sku||item.productId||item.id||'-')} · ${escapeHtml(item.unit||'-')} · ${priceHtml}</small></div>${actions}</div>`;
}
function getProductPreferenceCollapseKey(type){return type==='favorite'?FAVORITE_PRODUCTS_COLLAPSED_KEY:PINNED_PRODUCTS_COLLAPSED_KEY}
function isProductPreferenceCollapsed(type){try{return localStorage.getItem(getProductPreferenceCollapseKey(type))==='true'}catch(error){return false}}
function setProductPreferenceCollapsed(type,collapsed){try{localStorage.setItem(getProductPreferenceCollapseKey(type),collapsed?'true':'false')}catch(error){}}
function updateProductPreferenceCollapseUi(type,collapsed){
  const box=$(type==='favorite'?'favoriteProducts':'pinnedProducts');
  if(!box)return;
  box.classList.toggle('is-collapsed',!!collapsed);
  const button=box.querySelector('.quote-section-toggle');
  if(button){
    const title=type==='favorite'?'Favorite Products':'Pinned Products';
    button.setAttribute('aria-expanded',String(!collapsed));
    button.title=(collapsed?'Expand ':'Collapse ')+title;
    const icon=button.querySelector('span');
    if(icon)icon.textContent=collapsed?'▸':'▾';
  }
}
function toggleProductPreferenceSection(type){
  const collapsed=!isProductPreferenceCollapsed(type);
  setProductPreferenceCollapsed(type,collapsed);
  updateProductPreferenceCollapseUi(type,collapsed);
  if(type==='pinned'&&!collapsed)bindPinnedProductDragAndDrop();
}
function renderQuotePreferenceSectionHeader(type,icon,title,count,limit,collapsed){return `<div class="quote-preference-head"><button class="quote-section-toggle" data-no-drag onclick="toggleProductPreferenceSection('${type}')" aria-expanded="${!collapsed}" title="${collapsed?'Expand':'Collapse'} ${title}"><span>${collapsed?'▸':'▾'}</span></button><b>${icon} ${title}</b><small>${count} / ${limit}</small></div>`}
function renderQuoteProductPreferenceSections(){ensureProductPreferenceContainers();const pinnedBox=$('pinnedProducts');const favoriteBox=$('favoriteProducts');if(pinnedBox){const pinned=PINNED_PRODUCTS.map(decorateQuotePreferenceProduct);const collapsed=isProductPreferenceCollapsed('pinned');pinnedBox.classList.toggle('is-collapsed',collapsed);pinnedBox.innerHTML=renderQuotePreferenceSectionHeader('pinned','📌','Pinned Products',pinned.length,5,collapsed)+`<div class="quote-preference-body">${pinned.length?`<div id="pinnedProductGrid" class="quote-preference-list">${pinned.map(product=>renderQuoteProductPreferenceCard(product,{pinned:true,source:'PINNED'})).join('')}</div>`:'<div class="quote-preference-empty">ยังไม่มีสินค้าปักหมุด</div>'}</div>`;if(!collapsed)bindPinnedProductDragAndDrop()}if(favoriteBox){const pinnedIds=getPinnedProductIdSet();const favorites=FAVORITE_PRODUCTS.map(decorateQuotePreferenceProduct).filter(product=>!pinnedIds.has(normalizeQuoteProductPreferenceId(getQuoteProductPreferenceId(product))));const collapsed=isProductPreferenceCollapsed('favorite');favoriteBox.classList.toggle('is-collapsed',collapsed);favoriteBox.innerHTML=renderQuotePreferenceSectionHeader('favorite','♥','Favorite Products',FAVORITE_PRODUCTS.length,20,collapsed)+`<div class="quote-preference-body">${favorites.length?`<div class="quote-preference-list">${favorites.map(product=>renderQuoteProductPreferenceCard(product,{source:'FAVORITE'})).join('')}</div>`:'<div class="quote-preference-empty">ยังไม่มีสินค้ารายการโปรด</div>'}</div>`;}}
async function toggleFavoriteProduct(productId){if(!canManageQuoteProductPreferences())return;const id=String(productId||'').trim();const isFavorite=getFavoriteProductIdSet().has(normalizeQuoteProductPreferenceId(id));if(!isFavorite&&FAVORITE_PRODUCTS.length>=20){toast('เพิ่มสินค้ารายการโปรดได้สูงสุด 20 รายการ');return;}const response=await callApi(isFavorite?'removeFavoriteProduct':'addFavoriteProduct',{productId:id});toast(response.message||(response.ok?'บันทึกแล้ว':'บันทึกไม่สำเร็จ'));if(response&&response.ok)await loadProductPreferences(true);renderQuoteProductPicker();return response}
async function togglePinnedProduct(productId){if(!canManageQuoteProductPreferences())return;const id=String(productId||'').trim();const isPinned=getPinnedProductIdSet().has(normalizeQuoteProductPreferenceId(id));if(!isPinned&&PINNED_PRODUCTS.length>=5){toast('ปักหมุดสินค้าได้สูงสุด 5 รายการ');return;}const response=await callApi(isPinned?'removePinnedProduct':'addPinnedProduct',{productId:id});toast(response.message||(response.ok?'บันทึกแล้ว':'บันทึกไม่สำเร็จ'));if(response&&response.ok)await loadProductPreferences(true);renderQuoteProductPicker();return response}
async function persistPinnedProductOrder(){const grid=$('pinnedProductGrid');if(!grid)return;const productIds=Array.from(grid.querySelectorAll('[data-product-id]')).map(el=>el.dataset.productId).filter(Boolean);const response=await callApi('reorderPinnedProducts',{productIds:productIds});if(!response.ok){toast(response.message||'จัดลำดับสินค้าปักหมุดไม่สำเร็จ');await loadProductPreferences(true);return response;}const byId=new Map(PINNED_PRODUCTS.map(product=>[getQuoteProductPreferenceId(product),product]));PINNED_PRODUCTS=productIds.map((id,index)=>Object.assign({},byId.get(id),{pinnedSortOrder:index+1})).filter(product=>getQuoteProductPreferenceId(product));renderQuoteProductPreferenceSections();renderQuoteProductPicker();return response}
function bindPinnedProductDragAndDrop(){const grid=$('pinnedProductGrid');if(!grid||grid.dataset.bound)return;grid.dataset.bound='true';let dragged=null;grid.addEventListener('dragstart',event=>{dragged=event.target.closest('.pinned-product-card');if(!dragged)return;dragged.classList.add('is-dragging');event.dataTransfer.effectAllowed='move'});grid.addEventListener('dragover',event=>{event.preventDefault();const target=event.target.closest('.pinned-product-card');if(dragged&&target&&target!==dragged)grid.insertBefore(dragged,target)});grid.addEventListener('dragend',()=>{if(dragged)dragged.classList.remove('is-dragging');dragged=null;persistPinnedProductOrder()});let timer=null,touchCard=null;grid.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'||event.target.closest('button,a,[data-no-drag]'))return;touchCard=event.target.closest('.pinned-product-card');if(touchCard)timer=setTimeout(()=>{touchCard.classList.add('is-dragging');try{touchCard.setPointerCapture(event.pointerId)}catch(error){}},350)});grid.addEventListener('pointermove',event=>{if(!touchCard||!touchCard.classList.contains('is-dragging'))return;event.preventDefault();const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.pinned-product-card');if(target&&target!==touchCard)grid.insertBefore(touchCard,target)});const finish=()=>{clearTimeout(timer);if(touchCard&&touchCard.classList.contains('is-dragging')){touchCard.classList.remove('is-dragging');persistPinnedProductOrder()}touchCard=null};grid.addEventListener('pointerup',finish);grid.addEventListener('pointercancel',finish)}
const baseFilterQuoteProductsByBusinessUnitForPreferences=filterQuoteProductsByBusinessUnit;
filterQuoteProductsByBusinessUnit=function(query,businessUnit){return baseFilterQuoteProductsByBusinessUnitForPreferences(query,businessUnit).map(decorateQuotePreferenceProduct).sort((a,b)=>productPreferenceRank(a)-productPreferenceRank(b)||rankQuoteProductBusinessUnit(a,businessUnit)-rankQuoteProductBusinessUnit(b,businessUnit)||rankQuoteProduct(a,query)-rankQuoteProduct(b,query)||String(a.productName||'').localeCompare(String(b.productName||''),'th'))};
const baseRenderQuoteProductPickerForPreferences=renderQuoteProductPicker;
renderQuoteProductPicker=function(){const requestId=++quoteProductSearchSequence;ensureProductPreferenceContainers();if(!productPreferencesLoaded&&!productPreferencesPromise&&USER)loadProductPreferences();const q=$('productSearch')?.value||'';const picker=$('productPicker');if(!picker)return;if(!isQuoteBusinessUnitReadyForProducts()){picker.innerHTML='<div class="row quote-empty">กรุณาเลือก BU ก่อนแสดงสินค้า</div>';renderQuoteProductPreferenceSections();return;}const businessUnit=getSelectedQuoteBusinessUnitForProducts();const businessUnitLabel=quoteBusinessUnitLabel(businessUnit);if(!productsLoaded&&!DB.products.length){picker.innerHTML=`<div class="row quote-empty">กำลังโหลดสินค้า โดยเรียง ${businessUnitLabel} ก่อน...</div>`;if(document.activeElement===$('productSearch')){loadProducts().then(()=>{if(requestId===quoteProductSearchSequence&&businessUnit===getSelectedQuoteBusinessUnitForProducts())renderQuoteProductPicker();});}renderQuoteProductPreferenceSections();return;}const matchesAll=filterQuoteProductsByBusinessUnit(q,businessUnit);const limited=limitList(matchesAll,QUOTE_PICKER_LIMIT);const notice=limited.limited?`<div class="list-limit">แสดง 30 รายการแรกจากทุก BU โดยเรียง ${businessUnitLabel} และสินค้าปักหมุดก่อน กรุณาค้นหาเพิ่มเติม</div>`:'';picker.innerHTML=limited.items.length?notice+limited.items.map(product=>renderQuoteProductPreferenceCard(product,{source:'SEARCH'})).join(''):`<div class="row quote-empty">ไม่พบสินค้าที่ตรงกับคำค้น</div>`;renderQuoteProductPreferenceSections();};
window.toggleMenu=toggleMenu; window.go=go; window.normalizeDb=normalizeDb; window.normalizeProduct=normalizeProduct; window.normalizeCustomer=normalizeCustomer; window.showApp=showApp; window.hydrateBootstrapFromCache=hydrateBootstrapFromCache; window.loadData=loadData; window.loadCustomers=loadCustomers; window.refreshCustomersFromServer=refreshCustomersFromServer; window.loadProducts=loadProducts; window.ensurePageData=ensurePageData; window.loadUsers=loadUsers; window.renderUsers=renderUsers; window.openUserForm=openUserForm; window.saveUserForm=saveUserForm; window.renderAll=renderAll; window.renderBrand=renderBrand; window.greeting=greeting; window.renderProfile=renderProfile; window.renderHome=renderHome; window.renderCustomers=renderCustomers; window.renderProducts=renderProducts; window.openProductCalculator=openProductCalculator; window.closeProductCalculator=closeProductCalculator; window.resetProductCalculator=resetProductCalculator; window.renderProductCalculator=renderProductCalculator; window.saveProductCalculatorImage=saveProductCalculatorImage; window.addProductCardToQuote=addProductCardToQuote; window.getProductDiscount=getProductDiscount; window.renderQuoteCustomerPicker=renderQuoteCustomerPicker; window.chooseQuoteCustomer=chooseQuoteCustomer; window.renderQuoteProductPicker=renderQuoteProductPicker; window.renderProductPicker=renderQuoteProductPicker; window.renderPromos=renderPromos; window.renderHistory=renderHistory; window.refreshQuotationHistory=refreshQuotationHistory; window.ensureQuotationHistoryLoaded=ensureQuotationHistoryLoaded; window.isQuotationHistoryLoaded=isQuotationHistoryLoaded; window.openQuotationDetail=openQuotationDetail; window.openQuotationDetailModal=openQuotationDetailModal; window.closeQuotationDetailModal=closeQuotationDetailModal; window.editQuotationFromHistory=editQuotationFromHistory; window.duplicateQuotationFromHistory=duplicateQuotationFromHistory; window.cancelQuotationFromHistory=cancelQuotationFromHistory; window.renderSettings=renderSettings; window.openSettingPage=openSettingPage; window.updateProfilePreview=updateProfilePreview; window.handleProfileImage=handleProfileImage; window.saveProfile=saveProfile; window.saveSettings=saveSettings; window.openModal=openModal; window.closeModal=closeModal; window.saveModal=saveModal; window.clearAppCaches=clearAppCaches; window.checkAppVersion=checkAppVersion; window.applyRolePermissions=applyRolePermissions; window.toast=toast; window.loadProductPreferences=loadProductPreferences; window.toggleFavoriteProduct=toggleFavoriteProduct; window.togglePinnedProduct=togglePinnedProduct; window.persistPinnedProductOrder=persistPinnedProductOrder; window.renderQuoteProductPreferenceSections=renderQuoteProductPreferenceSections; window.toggleProductPreferenceSection=toggleProductPreferenceSection;
window.normalizeSystemIdentitySettings=normalizeSystemIdentitySettings; window.applySystemIdentityToUI=applySystemIdentityToUI; window.renderLoginBranding=renderLoginBranding; window.renderSidebarBranding=renderSidebarBranding; window.refreshPublicSystemSettings=refreshPublicSystemSettings; window.setPublicSystemSettings=setPublicSystemSettings; window.loadSystemIdentitySettingsForSettings=loadSystemIdentitySettingsForSettings; window.saveSystemIdentitySettings=saveSystemIdentitySettings; window.savePersonalGreetingSettings=savePersonalGreetingSettings; window.saveSystemGreetingSettings=saveSystemGreetingSettings; window.canManageSystemIdentitySettings=canManageSystemIdentitySettings; window.applySettingsPermissionUi=applySettingsPermissionUi;
