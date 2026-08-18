import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUsers } from '../fixtures/api-contract-data.mjs';
import { createRouterContext, ok, readRepoText } from '../helpers/api-contract-harness.mjs';

function extractFrontendActions() {
  const jsFiles = ['js/app.js', 'js/auth.js', 'js/quotation.js'];
  const actions = new Set();
  jsFiles.forEach(file => {
    const text = readRepoText(file);
    for (const match of text.matchAll(/callApi\(\s*['"]([^'"]+)['"]/g)) {
      actions.add(match[1]);
    }
    for (const match of text.matchAll(/callApi\(\s*[^?\n]+?\?\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g)) {
      actions.add(match[1]);
      actions.add(match[2]);
    }
    for (const match of text.matchAll(/\bgas\(\s*['"]([^'"]+)['"]/g)) {
      actions.add(match[1]);
    }
  });
  return Array.from(actions).sort();
}

function extractBackendCases() {
  const apiSource = readRepoText('appscript/Api.gs');
  return Array.from(apiSource.matchAll(/case\s+['"]([^'"]+)['"]/g)).map(match => match[1]).sort();
}

test('Frontend callApi action strings all have matching backend router cases', () => {
  const frontendActions = extractFrontendActions();
  const backendCases = new Set(extractBackendCases());
  const missing = frontendActions.filter(action => !backendCases.has(action));

  assert.deepEqual(missing, []);
  assert.ok(frontendActions.includes('getSalesTargetManagementData'));
  assert.ok(backendCases.has('getSalesTargetManagementData'));
});

test('Backend critical sales target route delegates through dispatchSalesTargetAction_', () => {
  const calls = [];
  const ctx = createRouterContext(apiUsers.adminNE03, {
    dispatchSalesTargetAction_(action, payload) {
      calls.push({ action, payload });
      return ok({ route: action });
    }
  });

  const result = ctx.api('getSalesTargetManagementData', { sessionToken: 'synthetic' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { route: 'getSalesTargetManagementData' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'getSalesTargetManagementData');
});

test('Unknown backend action returns the current controlled unsupported-action contract', () => {
  const ctx = createRouterContext(apiUsers.superAdmin);
  const result = ctx.api('notARealAction', { sessionToken: 'synthetic' });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'ERROR');
  assert.equal(result.message, 'Unsupported API action: notARealAction');
});

test('Router injects authenticated currentUser and ignores caller supplied currentUser role escalation', () => {
  let receivedPayload = null;
  const ctx = createRouterContext(apiUsers.salesNE03, {
    saveCustomer(payload) {
      receivedPayload = payload;
      return ok({ actorRole: payload.currentUser.role, actorId: payload.currentUser.userId });
    },
    saveProduct() {
      return ok({ shouldNotRun: true });
    }
  });

  const customer = ctx.api('saveCustomer', {
    sessionToken: 'synthetic',
    customerId: 'C-ROUTE-001',
    currentUser: { userId: 'U-FAKE', role: 'SUPER_ADMIN' }
  });
  assert.equal(customer.ok, true);
  assert.equal(customer.data.actorRole, 'SALES');
  assert.equal(customer.data.actorId, apiUsers.salesNE03.userId);
  assert.equal(receivedPayload.currentUser.userId, apiUsers.salesNE03.userId);

  const product = ctx.api('saveProduct', {
    sessionToken: 'synthetic',
    currentUser: { userId: 'U-FAKE', role: 'SUPER_ADMIN' }
  });
  assert.equal(product.ok, false);
  assert.equal(product.code, 'FORBIDDEN');
  assert.equal(ctx.__calls.saveProduct || 0, 0);
});

test('Router rejects authenticated actions before handlers when session is invalid', () => {
  const ctx = createRouterContext(apiUsers.salesNE03, {
    getCustomers() {
      return ok([]);
    }
  }, {
    authFailure: { code: 'FORBIDDEN', message: 'Session expired' }
  });

  const result = ctx.api('customers', { sessionToken: 'expired' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(result.message, 'Session expired');
  assert.equal(ctx.__calls.getCustomers || 0, 0);
});
