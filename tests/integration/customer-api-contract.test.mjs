import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUsers, apiUserList, customerHeaders, makeCustomer } from '../fixtures/api-contract-data.mjs';
import { clone, loadAppsScriptContext, ok, failure, RESPONSE_CODES } from '../helpers/api-contract-harness.mjs';

function createCustomerApiContext(actor, initialRows = []) {
  const customers = initialRows.map(row => Object.assign({}, row));
  const appended = [];
  const updates = [];
  const ctx = loadAppsScriptContext([
    'appscript/Response.gs',
    'appscript/Permission.gs',
    'appscript/Customer.gs',
    'appscript/Api.gs'
  ], {
    RESPONSE_CODES,
    CUSTOMERS_SHEET: 'Customers',
    QUOTE_HISTORY_SHEET: 'QuoteHistory',
    CUSTOMER_FREQUENT_PRODUCTS_SHEET: 'CustomerFrequentProducts',
    getSheetData(sheetName) {
      return ok(String(sheetName) === 'Customers' ? customers : []);
    },
    appendRow(sheetName, row) {
      if (String(sheetName) !== 'Customers') return failure('Unexpected sheet');
      const copy = Object.assign({}, row);
      customers.push(copy);
      appended.push(copy);
      return ok(copy);
    },
    updateRowById(sheetName, idField, idValue, updateObject) {
      if (String(sheetName) !== 'Customers') return failure('Unexpected sheet');
      const row = customers.find(item => String(item[idField] || '').trim() === String(idValue || '').trim());
      if (!row) return failure('Customer not found', 'NOT_FOUND');
      Object.assign(row, updateObject);
      updates.push({ idValue, updateObject: Object.assign({}, updateObject) });
      return ok(updateObject);
    },
    validatePayload(payload, fields) {
      const missing = (Array.isArray(fields) ? fields : []).find(field => !String(payload && payload[field] || '').trim());
      return missing ? failure(`${missing} is required`, 'VALIDATION_ERROR') : ok(true);
    },
    requireValue(value, field) {
      return String(value || '').trim() ? ok(String(value).trim()) : failure(`${field} is required`, 'VALIDATION_ERROR');
    },
    ensureSheet() {
      return {
        getLastRow() { return 1; },
        getLastColumn() { return customerHeaders.length; },
        getMaxRows() { return 10; },
        getRange() {
          return {
            setNumberFormat() {},
            setValues() {},
            getDisplayValues() { return []; }
          };
        }
      };
    },
    getHeadersForSheet() {
      return customerHeaders.slice();
    },
    getHeaders() {
      return customerHeaders.slice();
    },
    getUserById(userId) {
      const user = apiUserList.find(item => String(item.userId) === String(userId));
      return user ? ok(user) : failure('User not found', 'NOT_FOUND');
    },
    listUserAccounts() {
      return ok(apiUserList.map(user => Object.assign({}, user)));
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
  ctx.requireApiUser = function requireSyntheticApiUser() {
    return actor ? ok(actor) : failure('Session expired', 'FORBIDDEN');
  };
  ctx.__customers = customers;
  ctx.__appended = appended;
  ctx.__updates = updates;
  return ctx;
}

test('Customer API contract allows SALES own-area create through the central router', () => {
  const ctx = createCustomerApiContext(apiUsers.salesNE03);
  const result = ctx.api('saveCustomer', {
    sessionToken: 'synthetic',
    customerId: 'C-NEW-NE03',
    customerName: 'Synthetic Own Area Store',
    salesArea: 'NE03',
    sellsWeber: true
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.customerId, 'C-NEW-NE03');
  assert.equal(result.data.salesArea, 'NE03');
  assert.equal(result.data.assignedSalesUserId, apiUsers.salesNE03.userId);
  assert.equal(ctx.__appended.length, 1);
});

test('Customer API contract rejects SALES cross-area create and assignment tampering', () => {
  const crossArea = createCustomerApiContext(apiUsers.salesNE03);
  const crossAreaResult = crossArea.api('saveCustomer', {
    sessionToken: 'synthetic',
    customerId: 'C-NEW-NE01',
    customerName: 'Synthetic Cross Area Store',
    salesArea: 'NE01',
    sellsWeber: true
  });
  assert.equal(crossAreaResult.ok, false);
  assert.equal(crossAreaResult.code, 'AREA_SCOPE_VIOLATION');
  assert.equal(crossArea.__appended.length, 0);

  const tamper = createCustomerApiContext(apiUsers.salesNE03);
  const tamperResult = tamper.api('saveCustomer', {
    sessionToken: 'synthetic',
    customerId: 'C-TAMPER-001',
    customerName: 'Synthetic Tamper Store',
    salesArea: 'NE03',
    assignedSalesUserId: apiUsers.salesNE03Other.userId,
    sellsGyproc: true
  });
  assert.equal(tamperResult.ok, false);
  assert.equal(tamperResult.code, 'CUSTOMER_SCOPE_VIOLATION');
  assert.equal(tamper.__appended.length, 0);
});

test('Customer API contract allows own-scope update and rejects cross-area direct customerId update', () => {
  const own = createCustomerApiContext(apiUsers.salesNE03, [makeCustomer()]);
  const ownResult = own.api('updateCustomer', {
    sessionToken: 'synthetic',
    customerId: 'C-NE03-001',
    customerName: 'Updated Own Store',
    salesArea: 'NE03',
    sellsWeber: true,
    sellsGyproc: true
  });
  assert.equal(ownResult.ok, true);
  assert.equal(own.__updates.length, 1);
  assert.equal(own.__updates[0].updateObject.customerName, 'Updated Own Store');
  assert.equal(own.__updates[0].updateObject.sellsGyproc, 'TRUE');

  const crossArea = createCustomerApiContext(apiUsers.salesNE03, [
    makeCustomer({
      customerId: 'C-NE01-001',
      salesArea: 'NE01',
      assignedSalesUserId: apiUsers.salesNE01.userId,
      assignedSalesUsername: apiUsers.salesNE01.username
    })
  ]);
  const crossAreaResult = crossArea.api('updateCustomer', {
    sessionToken: 'synthetic',
    customerId: 'C-NE01-001',
    customerName: 'Cross Area Edit',
    salesArea: 'NE01',
    sellsWeber: true
  });
  assert.equal(crossAreaResult.ok, false);
  assert.equal(crossAreaResult.code, 'CUSTOMER_OUTSIDE_ASSIGNED_AREA');
  assert.equal(crossArea.__updates.length, 0);
});

test('Customer API contract keeps VIEWER and PC write attempts forbidden', () => {
  const viewerCtx = createCustomerApiContext(apiUsers.viewer);
  const viewerResult = viewerCtx.api('saveCustomer', {
    sessionToken: 'synthetic',
    customerId: 'C-VIEWER-001',
    customerName: 'Viewer Attempt',
    salesArea: 'NE03',
    sellsWeber: true
  });
  assert.equal(viewerResult.ok, false);
  assert.equal(viewerResult.code, 'FORBIDDEN');
  assert.equal(viewerCtx.__appended.length, 0);

  const pcCtx = createCustomerApiContext(apiUsers.pc);
  const pcResult = pcCtx.api('saveCustomer', {
    sessionToken: 'synthetic',
    customerId: 'C-PC-001',
    customerName: 'PC Attempt',
    salesArea: 'NE03',
    sellsWeber: true
  });
  assert.equal(pcResult.ok, false);
  assert.equal(pcResult.code, 'FORBIDDEN');
  assert.equal(pcCtx.__appended.length, 0);
});

test('Customer list API returns successful empty state separately from scope-filtered records', () => {
  const emptyCtx = createCustomerApiContext(apiUsers.salesNE03, []);
  const emptyResult = emptyCtx.api('customers', { sessionToken: 'synthetic' });
  assert.equal(emptyResult.ok, true);
  assert.deepEqual(clone(emptyResult.data), []);

  const scopedCtx = createCustomerApiContext(apiUsers.salesNE03, [
    makeCustomer({ customerId: 'C-OWN', assignedSalesUserId: apiUsers.salesNE03.userId }),
    makeCustomer({ customerId: 'C-UNASSIGNED', assignedSalesUserId: '', assignedSalesUsername: '' }),
    makeCustomer({ customerId: 'C-OTHER-SALES', assignedSalesUserId: apiUsers.salesNE03Other.userId, assignedSalesUsername: apiUsers.salesNE03Other.username }),
    makeCustomer({ customerId: 'C-NE01', salesArea: 'NE01', assignedSalesUserId: apiUsers.salesNE01.userId, assignedSalesUsername: apiUsers.salesNE01.username })
  ]);
  const scopedResult = scopedCtx.api('customers', { sessionToken: 'synthetic' });
  assert.equal(scopedResult.ok, true);
  assert.deepEqual(clone(scopedResult.data.map(customer => customer.customerId).sort()), ['C-OWN', 'C-UNASSIGNED']);
});
