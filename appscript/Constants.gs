const APP_ENV = 'APP_ENV';
const APP_VERSION = '0.2.0';

const SHEET_NAMES = {
  USERS: 'Users',
  SYSTEM_LOGS: 'SystemLogs',
  DISCOUNT_MATRIX: 'DiscountMatrix',
  PRODUCTS: 'Products',
  CUSTOMERS: 'Customers',
  QUOTE_HISTORY: 'QuoteHistory',
  QUOTE_LINES: 'QuoteLines',
  CUSTOMER_FREQUENT_PRODUCTS: 'CustomerFrequentProducts',
  DISCOUNT_GROUPS: 'DiscountGroups',
  CUSTOMER_PRODUCT_DISCOUNTS: 'CustomerProductDiscounts',
  DISCOUNT_CHANGE_LOG: 'DiscountChangeLog'
};

const USER_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  SALES: 'SALES',
  VIEWER: 'VIEWER'
};

const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
};

const RESPONSE_CODES = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN'
};
