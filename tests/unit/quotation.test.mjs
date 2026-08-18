import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppsScriptContext } from '../helpers/source-loader.mjs';

const ctx = loadAppsScriptContext(['appscript/Discount.gs', 'appscript/Quotation.gs']);

function assertMoney(actual, expected, message) {
  assert.equal(Number(actual).toFixed(2), Number(expected).toFixed(2), message);
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function paidLine(overrides = {}) {
  return Object.assign({
    lineId: 'LINE-001',
    productId: 'PROD-WEB-001',
    productCode: 'PROD-WEB-001',
    productName: 'Synthetic Weber Product',
    productBusinessUnit: 'WEBER',
    unit: 'bag',
    quotedUnit: 'bag',
    qty: 10,
    quotedListPrice: 100,
    listPrice: 100,
    discountPercent: 0,
    isFreeItem: false,
    status: 'ACTIVE'
  }, overrides);
}

test('Quotation normalizes a basic paid line with 7% VAT', () => {
  const line = ctx.normalizeQuotationPayloadItem(paidLine(), 1, 'WEBER', 'PROD-WEB-001', { listPrice: 100, unit: 'bag' }, {});
  assertMoney(line.unitPrice, 100);
  assertMoney(line.lineTotal, 1000);
  assertMoney(line.vat, 70);
  assertMoney(line.grandTotal, 1070);
  assert.equal(line.isFreeItem, false);
});

test('Quotation applies percentage discount before line total and VAT', () => {
  const line = ctx.normalizeQuotationPayloadItem(paidLine({ discountPercent: 15 }), 1, 'WEBER', 'PROD-WEB-001', { listPrice: 100, unit: 'bag' }, {});
  assertMoney(line.unitPrice, 85);
  assertMoney(line.lineTotal, 850);
  assertMoney(line.vat, 59.5);
  assertMoney(line.grandTotal, 909.5);
});

test('Quotation preserves production rounding for decimal promotion factor equivalent', () => {
  const line = ctx.normalizeQuotationPayloadItem(paidLine({
    qty: 1,
    quotedListPrice: 80.978,
    listPrice: 80.978,
    discountPercent: 2
  }), 1, 'WEBER', 'PROD-WEB-001', { listPrice: 80.978, unit: 'bag' }, {});
  assertMoney(line.unitPrice, 79.36);
  assertMoney(line.lineTotal, 79.36);
  assertMoney(line.vat, 5.56);
  assertMoney(line.grandTotal, 84.92);
});

test('Quotation supports decimal quantity when validation receives a positive quantity', () => {
  const line = ctx.normalizeQuotationPayloadItem(paidLine({ qty: 1.5, quotedListPrice: 20, listPrice: 20 }), 1, 'WEBER', 'PROD-WEB-001', { listPrice: 20, unit: 'bag' }, {});
  assertMoney(line.lineTotal, 30);
  assert.equal(ctx.validateNormalizedQuotationPayloadItems_([line]).ok, true);
});

test('Quotation validation rejects zero quantity paid lines', () => {
  const result = ctx.validateNormalizedQuotationPayloadItems_([paidLine({ qty: 0 })]);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_QUOTE_LINE');
});

test('Quotation validation rejects paid lines without a positive quoted list price', () => {
  const result = ctx.validateNormalizedQuotationPayloadItems_([paidLine({ quotedListPrice: 0, listPrice: 0 })]);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'QUOTE_LINE_PRICE_REQUIRED');
});

test('Quotation accepts free item lines only when monetary totals are zero', () => {
  const freeLine = ctx.normalizeQuotationPayloadItem(paidLine({
    isFreeItem: true,
    freeItem: true,
    quotedListPrice: 0,
    listPrice: 0,
    discountPercent: 25
  }), 1, 'GYPROC', 'PROD-GYP-001', { listPrice: 0, unit: 'sheet' }, {});
  assert.equal(freeLine.isFreeItem, true);
  assertMoney(freeLine.unitPrice, 0);
  assertMoney(freeLine.lineTotal, 0);
  assertMoney(freeLine.vat, 0);
  assert.equal(ctx.validateNormalizedQuotationPayloadItems_([freeLine]).ok, true);
});

test('Quotation rejects duplicate exact paid product lines but allows different units', () => {
  const duplicate = ctx.validateNormalizedQuotationPayloadItems_([
    paidLine({ lineId: 'LINE-A' }),
    paidLine({ lineId: 'LINE-B' })
  ]);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, 'DUPLICATE_PAID_PRODUCT_LINE');

  const differentUnit = ctx.validateNormalizedQuotationPayloadItems_([
    paidLine({ lineId: 'LINE-A', unit: 'bag', quotedUnit: 'bag' }),
    paidLine({ lineId: 'LINE-B', unit: 'box', quotedUnit: 'box' })
  ]);
  assert.equal(differentUnit.ok, true);
});

test('Quotation number helpers classify WEBQT, GYPQT, MBQT, and legacy numbers', () => {
  assert.equal(ctx.getQuotationNumberPrefixForBusinessUnits_(['WEBER']), 'WEBQT');
  assert.equal(ctx.getQuotationNumberPrefixForBusinessUnits_(['GYPROC']), 'GYPQT');
  assert.equal(ctx.getQuotationNumberPrefixForBusinessUnits_(['WEBER', 'GYPROC']), 'MBQT');
  assert.deepEqual(toPlain(ctx.parseQuotationNumberParts_('WEBQT-202607-0128')), {
    quotationPrefix: 'WEBQT',
    quotationYearMonth: '202607',
    quotationRunning: 128
  });
  assert.equal(ctx.isLegacyQuotationNumber_('QT-260719-00125'), true);
});
