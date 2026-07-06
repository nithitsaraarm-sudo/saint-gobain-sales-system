// Configuration for Saint-Gobain Sales System Apps Script.
function getScriptProperty(name, fallback) {
  try {
    const value = PropertiesService.getScriptProperties().getProperty(name);
    return value || fallback || '';
  } catch (error) {
    logError('getScriptProperty', error);
    return fallback || '';
  }
}

function getCurrentEnvironmentCore() {
  try {
    const env = String(getScriptProperty(APP_ENV, 'development')).trim().toLowerCase();
    return env === 'production' ? 'production' : 'development';
  } catch (error) {
    logError('getCurrentEnvironmentCore', error);
    return 'development';
  }
}

function getCurrentEnvironment() {
  return getCurrentEnvironmentCore();
}

function isDevelopmentEnvironment() {
  return getCurrentEnvironmentCore() === 'development';
}

function isProductionEnvironment() {
  return getCurrentEnvironmentCore() === 'production';
}

function getSpreadsheetId() {
  return getScriptProperty('SPREADSHEET_ID', '');
}

function getUsersSheetName() {
  return SHEET_NAMES.USERS;
}

function getSystemLogsSheetName() {
  return SHEET_NAMES.SYSTEM_LOGS;
}

function getDiscountMatrixSheetName() {
  return SHEET_NAMES.DISCOUNT_MATRIX;
}

function getProductsSheetName() {
  return SHEET_NAMES.PRODUCTS;
}

function getCustomersSheetName() {
  return SHEET_NAMES.CUSTOMERS;
}

function getQuoteHistorySheetName() {
  return SHEET_NAMES.QUOTE_HISTORY;
}

function getQuoteLinesSheetName() {
  return SHEET_NAMES.QUOTE_LINES;
}

function getCustomerFrequentProductsSheetName() {
  return SHEET_NAMES.CUSTOMER_FREQUENT_PRODUCTS;
}

function getDiscountGroupsSheetName() {
  return SHEET_NAMES.DISCOUNT_GROUPS;
}

function getCustomerProductDiscountsSheetName() {
  return SHEET_NAMES.CUSTOMER_PRODUCT_DISCOUNTS;
}

function getDiscountChangeLogSheetName() {
  return SHEET_NAMES.DISCOUNT_CHANGE_LOG;
}

function getDefaultUserHeaders() {
  return ['userId', 'username', 'password', 'displayName', 'role', 'phone', 'email', 'photoUrl', 'active', 'createdAt', 'updatedAt'];
}
