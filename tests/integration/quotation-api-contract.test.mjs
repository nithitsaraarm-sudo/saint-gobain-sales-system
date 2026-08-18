import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUsers } from '../fixtures/api-contract-data.mjs';
import { createRouterContext, failure, ok } from '../helpers/api-contract-harness.mjs';

function createQuotationRouter(actor, overrides = {}) {
  return createRouterContext(actor, Object.assign({
    createQuotation(payload) {
      return ok({ quoteId: 'QUOTE-SYN-001', customerId: payload.customerId });
    },
    saveQuotation(payload) {
      if (!payload || !payload.customerId) {
        return failure('customerId is required', 'VALIDATION_ERROR');
      }
      return ok({
        quoteId: payload.quoteId || 'QUOTE-SYN-001',
        quoteNo: payload.quoteNo || 'WEBQT-202607-0001',
        status: payload.status || 'SAVED',
        lineCount: Array.isArray(payload.items) ? payload.items.length : 0
      }, 'Quotation saved');
    },
    loadQuotation(payload) {
      return ok({
        quote: { quoteId: payload.quoteId, quoteNo: 'WEBQT-202607-0001', status: 'SAVED' },
        lines: [],
        totals: { subtotal: 0, vat: 0, grandTotal: 0 }
      });
    },
    getQuotationHistory() {
      return ok([]);
    },
    duplicateQuotation(payload) {
      return ok({ originalQuoteId: payload.quoteId, newQuoteId: 'QUOTE-SYN-COPY' });
    },
    cancelQuotation(payload) {
      return ok({ quoteId: payload.quoteId, status: 'CANCELLED' });
    }
  }, overrides));
}

test('Quotation save route accepts existing frontend payload and returns identifier fields required by UI', () => {
  const ctx = createQuotationRouter(apiUsers.salesNE03);
  const result = ctx.api('saveQuotation', {
    sessionToken: 'synthetic',
    customerId: 'C-NE03-001',
    items: [
      { productId: 'PROD-WEB-001', qty: 1, quotedListPrice: 100 }
    ]
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.quoteId, 'QUOTE-SYN-001');
  assert.equal(result.data.quoteNo, 'WEBQT-202607-0001');
  assert.equal(result.data.lineCount, 1);
});

test('Quotation update route maps to saveQuotation while create/view/history/cancel keep role guards', () => {
  const ctx = createQuotationRouter(apiUsers.salesNE03);
  const update = ctx.api('updateQuotation', {
    sessionToken: 'synthetic',
    quoteId: 'QUOTE-SYN-001',
    customerId: 'C-NE03-001',
    items: []
  });
  assert.equal(update.ok, true);
  assert.equal(update.data.quoteId, 'QUOTE-SYN-001');
  assert.equal(ctx.__calls.saveQuotation, 1);

  assert.equal(ctx.api('createQuotation', { sessionToken: 'synthetic', customerId: 'C-NE03-001' }).ok, true);
  assert.equal(ctx.api('loadQuotation', { sessionToken: 'synthetic', quoteId: 'QUOTE-SYN-001' }).ok, true);
  assert.equal(ctx.api('getQuotationHistory', { sessionToken: 'synthetic' }).ok, true);
  assert.equal(ctx.api('duplicateQuotation', { sessionToken: 'synthetic', quoteId: 'QUOTE-SYN-001' }).ok, true);
  assert.equal(ctx.api('cancelQuotation', { sessionToken: 'synthetic', quoteId: 'QUOTE-SYN-001' }).ok, true);
});

test('Quotation write failures preserve validation code and message for frontend handling', () => {
  const ctx = createQuotationRouter(apiUsers.salesNE03);
  const result = ctx.api('saveQuotation', {
    sessionToken: 'synthetic',
    items: []
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'VALIDATION_ERROR');
  assert.equal(result.message, 'customerId is required');
});

test('Quotation routes keep VIEWER read-only and PC fully restricted by current RBAC', () => {
  const viewer = createQuotationRouter(apiUsers.viewer);
  const save = viewer.api('saveQuotation', {
    sessionToken: 'synthetic',
    customerId: 'C-NE03-001',
    items: []
  });
  assert.equal(save.ok, false);
  assert.equal(save.code, 'FORBIDDEN');
  assert.equal(viewer.api('getQuotationHistory', { sessionToken: 'synthetic' }).ok, true);
  assert.equal(viewer.api('loadQuotation', { sessionToken: 'synthetic', quoteId: 'QUOTE-SYN-001' }).ok, true);

  const pc = createQuotationRouter(apiUsers.pc);
  assert.equal(pc.api('saveQuotation', { sessionToken: 'synthetic', customerId: 'C-NE03-001' }).code, 'FORBIDDEN');
  assert.equal(pc.api('getQuotationHistory', { sessionToken: 'synthetic' }).code, 'FORBIDDEN');
});
