window.APP_CONFIG = Object.assign({
  appName: "Saint-Gobain Sales System",
  version: "0.5.43",
  environment: "production",
  cacheVersion: "0.5.43",
  enableDemoLogin: false,
  gasWebAppUrl: "https://script.google.com/macros/s/AKfycbyuhRP2aIYI11vzMsIzGr2ncuhrflHb1u9flm_OwjpjZOJOTXvAg1HQu4iq62ZwjJn3RQ/exec"
}, window.APP_CONFIG || {});

window.APP_NAME = window.APP_CONFIG.appName;
window.APP_VERSION = window.APP_CONFIG.version;
window.APP_ENV = window.APP_CONFIG.environment;
window.ENABLE_DEMO_LOGIN = window.APP_CONFIG.enableDemoLogin === true;
window.GAS_WEB_APP_URL = window.APP_CONFIG.gasWebAppUrl;

window.CACHE_VERSION = window.APP_CONFIG.cacheVersion;
window.DEFAULT_PAGE_SIZE = 50;

window.APP_CACHE_KEYS = [
  "sg_products_cache",
  "sg_product_promotions_cache",
  "sg_customers_cache",
  "sg_bootstrap_cache",
  "sg_public_settings_cache",
  "sg_discount_cache",
  "sg_quotation_history_cache",
  "sg_quotation_cache"
];
