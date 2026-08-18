import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFrontendAppContext } from '../helpers/source-loader.mjs';

const app = loadFrontendAppContext();

const today = app.normalizePromotionDateOnly('2026-07-10');

test('Promotion status detects active, ending soon, upcoming, expired, and no-date states', () => {
  assert.equal(app.calculatePromotionStatus('2026-07-01', '2026-07-30', today).value, 'ACTIVE');
  assert.equal(app.calculatePromotionStatus('2026-07-01', '2026-07-15', today).value, 'ENDING_SOON');
  assert.equal(app.calculatePromotionStatus('2026-08-01', '2026-08-31', today).value, 'UPCOMING');
  assert.equal(app.calculatePromotionStatus('2026-06-01', '2026-06-30', today).value, 'EXPIRED');
  assert.equal(app.calculatePromotionStatus('', '', today).value, 'NO_DATE');
});

test('Promotion status treats the end date boundary as ending soon with zero remaining days', () => {
  const result = app.calculatePromotionStatus('2026-07-01', '2026-07-10', today);
  assert.equal(result.value, 'ENDING_SOON');
  assert.equal(result.remainingDays, 0);
  assert.equal(result.hasValidDateRange, true);
});

test('Promotion date normalization supports ISO, slash, and Buddhist year inputs', () => {
  assert.equal(app.normalizePromotionDateOnly('2026-07-01').dateKey, '2026-07-01');
  assert.equal(app.normalizePromotionDateOnly('01/07/2026').dateKey, '2026-07-01');
  assert.equal(app.normalizePromotionDateOnly('2569-07-01').dateKey, '2026-07-01');
  assert.equal(app.normalizePromotionDateOnly('not-a-date').valid, false);
});

test('Promotion dashboard summary counts brands, multi-brand groups, products, and statuses', () => {
  const summary = app.buildPromotionDashboardSummary([
    { promotionStatus: 'ACTIVE', brandKeys: ['GYPROC'], productCount: 3 },
    { promotionStatus: 'ENDING_SOON', brandKeys: ['WEBER'], productCount: 2 },
    { promotionStatus: 'EXPIRED', brandKeys: ['GYPROC', 'WEBER'], products: [{}, {}, {}, {}] },
    { promotionStatus: 'NO_DATE', brandKeys: [], productCount: 1 }
  ]);
  assert.equal(summary.totalPromotions, 4);
  assert.equal(summary.productsInPromotion, 10);
  assert.equal(summary.gyprocPromotions, 2);
  assert.equal(summary.weberPromotions, 2);
  assert.equal(summary.multiBrandPromotions, 1);
  assert.equal(summary.activePromotions, 1);
  assert.equal(summary.endingSoonPromotions, 1);
  assert.equal(summary.expiredPromotions, 1);
  assert.equal(summary.noDatePromotions, 1);
});
