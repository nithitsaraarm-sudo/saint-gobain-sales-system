import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClientContext, makeResponse } from '../helpers/api-contract-harness.mjs';

function parseLastRequest(calls) {
  assert.equal(calls.length, 1);
  return JSON.parse(calls[0].options.body);
}

test('API client posts action and payload to the configured Apps Script endpoint without live network access', async () => {
  const calls = [];
  const ctx = createApiClientContext((url, options) => {
    calls.push({ url, options });
    return Promise.resolve(makeResponse({
      body: { ok: true, data: { saved: true }, eventId: 'EVT-CLIENT-001' },
      redirected: true,
      url: 'https://script.googleusercontent.example.test/macros/exec'
    }));
  });

  const result = await ctx.window.apiPost('saveCustomer', { customerId: 'C-SYN-001' });
  assert.equal(result.ok, true);
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { saved: true });
  assert.equal(result.eventId, 'EVT-CLIENT-001');

  assert.equal(calls[0].url, 'https://example.test/apps-script/exec');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.redirect, 'follow');
  assert.equal(calls[0].options.headers['Content-Type'], 'text/plain;charset=utf-8');
  assert.deepEqual(parseLastRequest(calls), {
    action: 'saveCustomer',
    payload: { customerId: 'C-SYN-001' }
  });
});

test('API client keeps legacy success:true/result response compatibility when production normalization supports it', async () => {
  const ctx = createApiClientContext(() => Promise.resolve(makeResponse({
    body: { success: true, result: { legacy: true }, message: 'legacy ok' }
  })));

  const result = await ctx.window.apiPost('legacyAction', {});
  assert.equal(result.ok, true);
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { legacy: true });
  assert.equal(result.message, 'legacy ok');
});

test('API client returns controlled HTTP_ERROR for non-2xx responses and preserves redirect metadata', async () => {
  const ctx = createApiClientContext(() => Promise.resolve(makeResponse({
    ok: false,
    status: 500,
    body: 'server unavailable',
    redirected: true,
    url: 'https://script.googleusercontent.example.test/failure'
  })));

  const result = await ctx.window.apiPost('customers', {});
  assert.equal(result.ok, false);
  assert.equal(result.success, false);
  assert.equal(result.code, 'HTTP_ERROR');
  assert.equal(result.message, 'HTTP 500');
  assert.equal(result.status, 500);
  assert.equal(result.redirected, true);
  assert.equal(result.responseUrl, 'https://script.googleusercontent.example.test/failure');
  assert.match(result.detail, /server unavailable/);
});

test('API client distinguishes empty response from a successful empty list', async () => {
  const emptyCtx = createApiClientContext(() => Promise.resolve(makeResponse({ body: '' })));
  const emptyResult = await emptyCtx.window.apiPost('customers', {});
  assert.equal(emptyResult.ok, false);
  assert.equal(emptyResult.code, 'EMPTY_RESPONSE');

  const listCtx = createApiClientContext(() => Promise.resolve(makeResponse({ body: { ok: true, data: [] } })));
  const listResult = await listCtx.window.apiPost('customers', {});
  assert.equal(listResult.ok, true);
  assert.deepEqual(listResult.data, []);
});

test('API client returns production API_RESPONSE_INVALID code for invalid JSON', async () => {
  const ctx = createApiClientContext(() => Promise.resolve(makeResponse({ body: '<html>not json</html>' })));
  const result = await ctx.window.apiPost('customers', {});

  assert.equal(result.ok, false);
  assert.equal(result.success, false);
  assert.equal(result.code, 'API_RESPONSE_INVALID');
  assert.equal(result.message, 'API response is not JSON');
  assert.match(result.detail, /not json/);
});

test('API client returns TIMEOUT for AbortError and NETWORK_ERROR for transport failure', async () => {
  const abortError = new Error('aborted');
  abortError.name = 'AbortError';
  const timeoutCtx = createApiClientContext(() => Promise.reject(abortError));
  const timeoutResult = await timeoutCtx.window.apiPost('customers', {}, { timeoutMs: 1 });
  assert.equal(timeoutResult.ok, false);
  assert.equal(timeoutResult.code, 'TIMEOUT');

  const networkCtx = createApiClientContext(() => Promise.reject(new Error('synthetic network failure')));
  const networkResult = await networkCtx.window.apiPost('customers', {});
  assert.equal(networkResult.ok, false);
  assert.equal(networkResult.code, 'NETWORK_ERROR');
  assert.equal(networkResult.message, 'synthetic network failure');
});

test('callApi attaches stored session context and never mutates the caller payload object', async () => {
  const calls = [];
  const ctx = createApiClientContext((url, options) => {
    calls.push({ url, options });
    return Promise.resolve(makeResponse({ body: { ok: true, data: [] } }));
  }, {
    localStorage: {
      sg_token: 'synthetic-session-token',
      sg_userId: 'U-SALES-NE03'
    }
  });
  const payload = { force: true };

  const result = await ctx.window.callApi('customers', payload);
  assert.equal(result.ok, true);
  assert.deepEqual(payload, { force: true });

  const request = parseLastRequest(calls);
  assert.equal(request.action, 'customers');
  assert.equal(request.payload.force, true);
  assert.equal(request.payload.sessionToken, 'synthetic-session-token');
  assert.equal(request.payload.currentUserId, 'U-SALES-NE03');
  assert.match(request.payload.requestId, /^customers-/);
});
