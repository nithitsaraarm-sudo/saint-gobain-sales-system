import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppsScriptContext, loadFrontendAppContext } from '../helpers/source-loader.mjs';

const discount = loadAppsScriptContext('appscript/Discount.gs');
const quotation = loadAppsScriptContext(['appscript/Discount.gs', 'appscript/Quotation.gs']);
const salesTarget = loadAppsScriptContext('appscript/SalesTarget.gs');
const app = loadFrontendAppContext();

test('Currency and discount normalization follow Apps Script production helpers', () => {
  assert.equal(discount.parseDiscountPercent('15%'), 15);
  assert.equal(discount.parseDiscountPercent('0.15'), 15);
  assert.equal(discount.parseDiscountPercent('invalid'), 0);
  assert.equal(discount.roundCurrency(10.005), 10.01);
  assert.equal(quotation.parseQuotationNumericValue('1,000.50%'), 1000.5);
});

test('Business Unit and quotation type normalization preserve current accepted variants', () => {
  assert.equal(quotation.normalizeQuoteType('GYPROC'), 'GYPROC');
  assert.equal(quotation.normalizeQuoteType(''), 'WEBER');
  assert.equal(quotation.getQuotationProductBusinessUnit({ brand: 'Gyproc Saint-Gobain' }), 'GYPROC');
  assert.equal(app.normalizeDashboardBusinessUnit({ brand: ' weber ' }), 'WEBER');
});

test('Client number parser and dashboard line fallback normalize numeric strings', () => {
  assert.equal(app.parseClientNumber('1,000.25'), 1000.25);
  assert.equal(app.parseClientNumber('not-a-number'), 0);
  assert.equal(app.getDashboardLineValue({ qty: '2', unitPrice: '1,000' }), 2000);
  assert.equal(app.getDashboardLineValue({ lineTotal: '3,500' }), 3500);
});

test('Sales Target version normalization keeps optimistic concurrency versions safe', () => {
  assert.equal(salesTarget.salesTargetNormalizeRow_({ version: undefined }).version, 1);
  assert.equal(salesTarget.salesTargetNormalizeRow_({ version: null }).version, 1);
  assert.equal(salesTarget.salesTargetNormalizeRow_({ version: '0' }).version, 1);
  assert.equal(salesTarget.salesTargetNormalizeRow_({ version: '3' }).version, 3);
});
