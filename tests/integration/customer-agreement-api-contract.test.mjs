import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUsers } from '../fixtures/api-contract-data.mjs';
import { createRouterContext, ok } from '../helpers/api-contract-harness.mjs';

test('Customer Agreement read route injects authenticated currentUser and delegates through central API router', () => {
  let receivedPayload = null;
  const ctx = createRouterContext(apiUsers.salesNE03, {
    getCustomerAgreements(payload) {
      receivedPayload = payload;
      return ok({ actorRole: payload.currentUser.role, customerId: payload.customerId });
    }
  });

  const result = ctx.api('getCustomerAgreements', {
    sessionToken: 'synthetic',
    customerId: 'C-NE03-001',
    currentUser: { userId: 'FAKE', role: 'SUPER_ADMIN' }
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.actorRole, 'SALES');
  assert.equal(result.data.customerId, 'C-NE03-001');
  assert.equal(receivedPayload.currentUser.userId, apiUsers.salesNE03.userId);
  assert.equal(ctx.__calls.getCustomerAgreements, 1);
});

test('Customer Agreement write route blocks VIEWER before handler execution', () => {
  const ctx = createRouterContext(apiUsers.viewer, {
    createCustomerAgreement() {
      return ok({ shouldNotRun: true });
    }
  });

  const result = ctx.api('createCustomerAgreement', {
    sessionToken: 'synthetic',
    customerId: 'C-NE03-001',
    agreementName: 'Viewer should be blocked',
    agreementYear: 2026
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(ctx.__calls.createCustomerAgreement || 0, 0);
});

test('Customer Agreement PC read route is blocked by central role guard', () => {
  const ctx = createRouterContext(apiUsers.pc, {
    getCustomerAgreements() {
      return ok({ shouldNotRun: true });
    }
  });

  const result = ctx.api('getCustomerAgreements', {
    sessionToken: 'synthetic',
    customerId: 'C-NE03-001'
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(ctx.__calls.getCustomerAgreements || 0, 0);
});
