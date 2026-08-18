import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppsScriptContext } from '../helpers/source-loader.mjs';

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

const salesNE03 = {
  userId: 'U-SALES-NE03',
  username: 'sales.ne03',
  displayName: 'Sales NE03',
  fullName: 'Sales NE03',
  quoteDisplayName: 'Sales NE03',
  role: 'SALES',
  area: 'NE03',
  branch: 'NE03',
  status: 'Active'
};

const salesNE03Other = {
  userId: 'U-SALES-OTHER',
  username: 'sales.other',
  displayName: 'Other Sales',
  role: 'SALES',
  area: 'NE03',
  branch: 'NE03',
  status: 'Active'
};

const salesNE01 = {
  userId: 'U-SALES-NE01',
  username: 'sales.ne01',
  displayName: 'Sales NE01',
  role: 'SALES',
  area: 'NE01',
  branch: 'NE01',
  status: 'Active'
};

const adminSystem = {
  userId: 'U-ADMIN',
  username: 'admin',
  displayName: 'Admin',
  role: 'ADMIN',
  area: 'System',
  branch: 'System',
  status: 'Active'
};

const superAdmin = {
  userId: 'U-SA',
  username: 'super',
  displayName: 'Super Admin',
  role: 'SUPER_ADMIN',
  area: 'System',
  branch: 'System',
  status: 'Active'
};

const viewer = {
  userId: 'U-VIEWER',
  username: 'viewer',
  displayName: 'Viewer',
  role: 'VIEWER',
  area: 'System',
  branch: 'System',
  status: 'Active'
};

const pcUser = {
  userId: 'U-PC',
  username: 'pc.user',
  displayName: 'PC User',
  role: 'PC',
  area: 'NE03',
  branch: 'NE03',
  status: 'Active'
};

const allUsers = [salesNE03, salesNE03Other, salesNE01, adminSystem, superAdmin, viewer, pcUser];
const customerHeaders = [
  'customerId',
  'customerName',
  'province',
  'district',
  'salesArea',
  'assignedSalesUserId',
  'assignedSalesUsername',
  'assignedSalesNameSnapshot',
  'sellsWeber',
  'sellsGyproc',
  'active',
  'updatedAt',
  'updatedBy'
];

function ok(data, message = '') {
  return { ok: true, success: true, data: data === undefined ? null : data, message, code: 'SUCCESS' };
}

function fail(message, code = 'ERROR', data = null) {
  return { ok: false, success: false, data, message, code };
}

function makeCustomer(overrides = {}) {
  return Object.assign({
    customerId: 'C-NE03-001',
    customerName: 'NE03 Store',
    province: 'Bangkok',
    district: 'Bang Kapi',
    salesArea: 'NE03',
    assignedSalesUserId: salesNE03.userId,
    assignedSalesUsername: salesNE03.username,
    assignedSalesNameSnapshot: salesNE03.displayName,
    sellsWeber: 'TRUE',
    sellsGyproc: 'FALSE',
    active: 'TRUE'
  }, overrides);
}

function createCustomerContext(actor, rows = []) {
  const customers = rows.map(row => Object.assign({}, row));
  const appended = [];
  const updates = [];
  const ctx = loadAppsScriptContext(['appscript/Permission.gs', 'appscript/Customer.gs'], {
    CUSTOMERS_SHEET: 'Customers',
    QUOTE_HISTORY_SHEET: 'QuoteHistory',
    CUSTOMER_FREQUENT_PRODUCTS_SHEET: 'CustomerFrequentProducts',
    requireApiUser() {
      return ok(actor);
    },
    validatePayload(payload, fields) {
      const missing = (Array.isArray(fields) ? fields : []).find(field => !String(payload && payload[field] || '').trim());
      return missing ? { ok: false, success: false, message: `${missing} is required`, code: 'VALIDATION_ERROR', data: null } : ok(true);
    },
    requireValue(value, field) {
      return String(value || '').trim() ? ok(String(value).trim()) : { ok: false, success: false, message: `${field} is required`, code: 'VALIDATION_ERROR', data: null };
    },
    getSheetData(sheetName) {
      return ok(String(sheetName) === 'Customers' ? customers : []);
    },
    appendRow(sheetName, row) {
      if (String(sheetName) !== 'Customers') return fail('Unexpected sheet', 'ERROR');
      const copy = Object.assign({}, row);
      appended.push(copy);
      customers.push(copy);
      return ok(copy);
    },
    updateRowById(sheetName, idField, idValue, updateObject) {
      if (String(sheetName) !== 'Customers') return fail('Unexpected sheet', 'ERROR');
      const row = customers.find(item => String(item[idField] || '').trim() === String(idValue || '').trim());
      if (!row) return fail('Customer not found', 'NOT_FOUND');
      Object.assign(row, updateObject);
      updates.push({ sheetName, idField, idValue, updateObject: Object.assign({}, updateObject) });
      return ok(updateObject);
    },
    getHeadersForSheet() {
      return customerHeaders.slice();
    },
    getHeaders() {
      return customerHeaders.slice();
    },
    ensureSheet() {
      return {
        getLastRow() { return 1; },
        getMaxRows() { return 10; },
        getLastColumn() { return customerHeaders.length; },
        getRange() {
          return {
            setNumberFormat() {},
            setValues() {},
            getDisplayValues() { return []; }
          };
        }
      };
    },
    getUserById(userId) {
      const user = allUsers.find(item => String(item.userId) === String(userId));
      return user ? ok(user) : fail('User not found');
    },
    listUserAccounts() {
      return ok(allUsers);
    },
    normalizeUserAccount(user) {
      return Object.assign({}, user);
    },
    normalizePhone(value) {
      return String(value || '').replace(/\D/g, '');
    },
    clearSheetDataCache() {},
    getServerCache() { return null; },
    setServerCache() {},
    startPerformanceTimer() { return {}; },
    endPerformanceTimer() {}
  });
  ctx.requireApiUser = function requireApiUserForCustomerPermissionTest() {
    return ok(actor);
  };
  ctx.__customers = customers;
  ctx.__appended = appended;
  ctx.__updates = updates;
  return ctx;
}

function createApiContext(actor) {
  const calls = { saveCustomer: 0, updateCustomer: 0, saveProduct: 0, savePromotion: 0 };
  const ctx = loadAppsScriptContext(['appscript/Permission.gs', 'appscript/Api.gs'], {
    requireApiUser() {
      return ok(actor);
    },
    authorizeAction(fn, args) {
      return fn.apply(null, Array.isArray(args) ? args : []);
    },
    saveCustomer(payload) {
      calls.saveCustomer += 1;
      return ok({ currentUser: payload.currentUser });
    },
    updateCustomer(customerId, payload) {
      calls.updateCustomer += 1;
      return ok({ customerId, currentUser: payload.currentUser });
    },
    saveProduct() {
      calls.saveProduct += 1;
      return ok(true);
    },
    savePromotion() {
      calls.savePromotion += 1;
      return ok(true);
    }
  });
  ctx.requireApiUser = function requireApiUserForApiPermissionTest() {
    return ok(actor);
  };
  ctx.__calls = calls;
  return ctx;
}

test('Permission model allows SALES to manage customers but not product or promotion masters', () => {
  const ctx = loadAppsScriptContext('appscript/Permission.gs');
  const permissions = ctx.getUserPermissions(salesNE03);
  assert.equal(permissions.canManageCustomers, true);
  assert.equal(permissions.canManageProducts, false);
  assert.equal(permissions.canManagePromotions, false);
});

test('PC role remains restricted and no longer falls through to SALES permissions', () => {
  const ctx = loadAppsScriptContext('appscript/Permission.gs');
  const permissions = ctx.getUserPermissions(pcUser);
  assert.equal(permissions.role, 'PC');
  assert.equal(permissions.isSales, false);
  assert.equal(permissions.isPc, true);
  assert.equal(permissions.canManageCustomers, false);
  assert.equal(permissions.canCreateQuotations, false);
});

test('API router permits SALES customer writes and keeps product/promotion writes forbidden', () => {
  const ctx = createApiContext(salesNE03);
  const saveCustomer = ctx.api('saveCustomer', { customerId: 'C-001' });
  assert.equal(saveCustomer.ok, true);
  assert.equal(ctx.__calls.saveCustomer, 1);

  const product = ctx.api('saveProduct', { productId: 'P-001' });
  assert.equal(product.ok, false);
  assert.equal(product.code, 'FORBIDDEN');
  assert.equal(ctx.__calls.saveProduct, 0);

  const promotion = ctx.api('savePromotion', { promoCode: 'PROMO-001' });
  assert.equal(promotion.ok, false);
  assert.equal(promotion.code, 'FORBIDDEN');
  assert.equal(ctx.__calls.savePromotion, 0);
});

test('API router keeps VIEWER customer writes read-only', () => {
  const ctx = createApiContext(viewer);
  const result = ctx.api('saveCustomer', { customerId: 'C-001' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(ctx.__calls.saveCustomer, 0);
});

test('Customer backend write function also denies PC without relying only on API router', () => {
  const ctx = createCustomerContext(pcUser);
  const result = ctx.saveCustomer({
    customerId: 'C-PC-001',
    customerName: 'PC Attempt',
    salesArea: 'NE03',
    sellsWeber: true
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(ctx.__appended.length, 0);
});

test('SUPER_ADMIN and ADMIN customer master permissions remain available', () => {
  const ctx = loadAppsScriptContext('appscript/Permission.gs');
  assert.equal(ctx.getUserPermissions(superAdmin).canManageCustomers, true);
  assert.equal(ctx.getUserPermissions(adminSystem).canManageCustomers, true);
  assert.equal(ctx.getUserPermissions(adminSystem).canManageProducts, true);
  assert.equal(ctx.getUserPermissions(adminSystem).canManagePromotions, true);
});

test('SALES can create a customer in own area and backend assigns the current sales user', () => {
  const ctx = createCustomerContext(salesNE03);
  const result = ctx.saveCustomer({
    customerId: 'C-NEW-NE03',
    customerName: 'New NE03 Store',
    salesArea: 'NE03',
    sellsWeber: true
  });
  assert.equal(result.ok, true);
  assert.equal(ctx.__appended.length, 1);
  assert.equal(result.data.salesArea, 'NE03');
  assert.equal(result.data.assignedSalesUserId, salesNE03.userId);
  assert.equal(result.data.assignedSalesUsername, salesNE03.username);
});

test('SALES cannot create a customer outside own area', () => {
  const ctx = createCustomerContext(salesNE03);
  const result = ctx.saveCustomer({
    customerId: 'C-NEW-NE01',
    customerName: 'Cross Area Store',
    salesArea: 'NE01',
    sellsWeber: true
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'AREA_SCOPE_VIOLATION');
  assert.equal(ctx.__appended.length, 0);
});

test('SALES cannot assign a newly-created customer to another sales user', () => {
  const ctx = createCustomerContext(salesNE03);
  const result = ctx.saveCustomer({
    customerId: 'C-NEW-OTHER',
    customerName: 'Hijack Store',
    salesArea: 'NE03',
    assignedSalesUserId: salesNE03Other.userId,
    sellsGyproc: true
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CUSTOMER_SCOPE_VIOLATION');
  assert.equal(ctx.__appended.length, 0);
});

test('SALES can edit normal profile and brand fields for a customer in own scope', () => {
  const ctx = createCustomerContext(salesNE03, [makeCustomer()]);
  const result = ctx.updateCustomer('C-NE03-001', {
    customerName: 'Updated Store',
    salesArea: 'NE03',
    sellsWeber: true,
    sellsGyproc: true,
    phone: '081-234-5678'
  });
  assert.equal(result.ok, true);
  assert.equal(ctx.__updates.length, 1);
  assert.equal(ctx.__updates[0].updateObject.customerName, 'Updated Store');
  assert.equal(ctx.__updates[0].updateObject.sellsWeber, 'TRUE');
  assert.equal(ctx.__updates[0].updateObject.sellsGyproc, 'TRUE');
  assert.equal(ctx.__updates[0].updateObject.phone, '0812345678');
});

test('SALES cannot edit a customer in another area or bypass scope by direct customerId', () => {
  const ctx = createCustomerContext(salesNE03, [
    makeCustomer({ customerId: 'C-NE01-001', salesArea: 'NE01', assignedSalesUserId: salesNE01.userId })
  ]);
  const result = ctx.updateCustomer('C-NE01-001', {
    customerName: 'Cross Area Edit',
    salesArea: 'NE01',
    sellsWeber: true
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CUSTOMER_OUTSIDE_ASSIGNED_AREA');
  assert.equal(ctx.__updates.length, 0);
});

test('SALES cannot edit a same-area customer assigned to a different sales user', () => {
  const ctx = createCustomerContext(salesNE03, [
    makeCustomer({ customerId: 'C-NE03-OTHER', assignedSalesUserId: salesNE03Other.userId, assignedSalesUsername: salesNE03Other.username })
  ]);
  const result = ctx.updateCustomer('C-NE03-OTHER', {
    customerName: 'Other Assigned Store',
    salesArea: 'NE03',
    sellsWeber: true
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CUSTOMER_ACCESS_DENIED');
  assert.equal(ctx.__updates.length, 0);
});

test('SALES cannot change protected customer metadata or active status', () => {
  const ctx = createCustomerContext(salesNE03, [makeCustomer()]);
  const result = ctx.updateCustomer('C-NE03-001', {
    customerName: 'Deactivate Attempt',
    salesArea: 'NE03',
    sellsWeber: true,
    active: false
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CUSTOMER_PROTECTED_FIELD');
  assert.equal(result.data.field, 'active');
  assert.equal(ctx.__updates.length, 0);
});

test('Customer list scope remains aligned with customer edit scope', () => {
  const ctx = createCustomerContext(salesNE03, [
    makeCustomer({ customerId: 'C-OWN', assignedSalesUserId: salesNE03.userId, assignedSalesUsername: salesNE03.username }),
    makeCustomer({ customerId: 'C-UNASSIGNED', assignedSalesUserId: '', assignedSalesUsername: '' }),
    makeCustomer({ customerId: 'C-OTHER', assignedSalesUserId: salesNE03Other.userId, assignedSalesUsername: salesNE03Other.username }),
    makeCustomer({ customerId: 'C-NE01', salesArea: 'NE01', assignedSalesUserId: salesNE01.userId, assignedSalesUsername: salesNE01.username })
  ]);
  const result = ctx.getCustomers({ currentUser: salesNE03 });
  assert.equal(result.ok, true);
  assert.deepEqual(toPlain(result.data.map(customer => customer.customerId).sort()), ['C-OWN', 'C-UNASSIGNED']);
});

test('PC customer list remains restricted when backend helpers are called outside the API router', () => {
  const ctx = createCustomerContext(pcUser, [
    makeCustomer({ customerId: 'C-PC-SCOPE', salesArea: 'NE03', assignedSalesUserId: '' })
  ]);
  const result = ctx.getCustomers({ currentUser: pcUser });
  assert.equal(result.ok, true);
  assert.deepEqual(toPlain(result.data), []);
});
