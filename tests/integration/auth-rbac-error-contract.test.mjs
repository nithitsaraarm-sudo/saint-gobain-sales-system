import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUsers } from '../fixtures/api-contract-data.mjs';
import { clone, createApiClientContext, createRouterContext, loadAppsScriptContext, makeResponse, ok, RESPONSE_CODES } from '../helpers/api-contract-harness.mjs';

test('Permission contract keeps PC role distinct from SALES and preserves bootstrap-compatible flags', () => {
  const ctx = loadAppsScriptContext(['appscript/Response.gs', 'appscript/Permission.gs'], { RESPONSE_CODES });
  const pc = ctx.getUserPermissions(apiUsers.pc);
  assert.equal(pc.role, 'PC');
  assert.equal(pc.isPc, true);
  assert.equal(pc.isSales, false);
  assert.equal(pc.canManageCustomers, false);
  assert.equal(pc.canCreateQuotations, false);

  const sales = ctx.getUserPermissions(apiUsers.salesNE03);
  assert.equal(sales.role, 'SALES');
  assert.equal(sales.canManageCustomers, true);
  assert.equal(sales.canCreateQuotations, true);
  assert.equal(sales.canManageProducts, false);
  assert.equal(sales.canManagePromotions, false);
});

test('Standard response helper contract keeps safe shape without leaking stack traces', () => {
  const ctx = loadAppsScriptContext('appscript/Response.gs', { RESPONSE_CODES });
  assert.deepEqual(clone(ctx.success({ id: 1 }, 'created')), {
    ok: true,
    code: 'SUCCESS',
    data: { id: 1 },
    message: 'created'
  });

  const failed = ctx.fail('Synthetic safe message', 'FORBIDDEN', { field: 'role' });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'FORBIDDEN');
  assert.equal(failed.data, null);
  assert.equal(failed.message, 'Synthetic safe message');
  assert.deepEqual(clone(failed.detail), { field: 'role' });
  assert.equal(Object.prototype.hasOwnProperty.call(failed, 'stack'), false);
});

test('Router contract prevents frontend permission flags from authorizing server-side restricted actions', () => {
  const ctx = createRouterContext(apiUsers.salesNE03, {
    savePromotion() {
      return ok({ shouldNotRun: true });
    }
  });
  const result = ctx.api('savePromotion', {
    sessionToken: 'synthetic',
    permissions: { canManagePromotions: true },
    currentUser: { role: 'SUPER_ADMIN' },
    promotionId: 'PROMO-ELEVATE'
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(ctx.__calls.savePromotion || 0, 0);
});

test('Frontend error contract preserves backend failure codes and does not convert failures to empty success', async () => {
  const ctx = createApiClientContext(() => Promise.resolve(makeResponse({
    body: {
      ok: false,
      code: 'AREA_SCOPE_VIOLATION',
      message: 'Target is outside permitted area',
      eventId: 'EVT-SCOPE-001'
    }
  })));

  const result = await ctx.window.apiPost('saveCustomer', { customerId: 'C-X' });
  assert.equal(result.ok, false);
  assert.equal(result.success, false);
  assert.equal(result.code, 'AREA_SCOPE_VIOLATION');
  assert.equal(result.message, 'Target is outside permitted area');
  assert.equal(result.eventId, 'EVT-SCOPE-001');
  assert.equal(result.data, null);
});

test('Frontend list-state contract preserves ok:true data:[] as success and ok:false as error', async () => {
  const successCtx = createApiClientContext(() => Promise.resolve(makeResponse({
    body: { ok: true, data: [] }
  })));
  const success = await successCtx.window.apiPost('getSalesTargets', {});
  assert.equal(success.ok, true);
  assert.deepEqual(success.data, []);

  const failureCtx = createApiClientContext(() => Promise.resolve(makeResponse({
    body: { ok: false, code: 'CONFLICT', message: 'Target was updated by another user' }
  })));
  const failed = await failureCtx.window.apiPost('getSalesTargets', {});
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'CONFLICT');
  assert.equal(failed.data, null);
});
