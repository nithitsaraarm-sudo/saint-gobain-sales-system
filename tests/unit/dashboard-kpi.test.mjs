import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFrontendAppContext } from '../helpers/source-loader.mjs';
import { dashboardCustomers, dashboardLines, dashboardProducts, dashboardQuotes } from '../fixtures/business-data.mjs';

const app = loadFrontendAppContext();

function assertClose(actual, expected, tolerance = 0.001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
}

test('Customer KPI counts active, inactive, and new customers with deterministic reference date', () => {
  const summary = app.window.calculateCustomerSummary(dashboardCustomers, {
    now: new Date(2026, 6, 31, 12),
    recentDays: 30
  });
  assert.equal(summary.totalCustomers, 2);
  assert.equal(summary.activeCustomers, 1);
  assert.equal(summary.inactiveCustomers, 1);
  assert.equal(summary.newCustomers, 1);
  assert.equal(summary.activeCustomers + summary.inactiveCustomers, summary.totalCustomers);
});

test('Customer KPI handles missing status as active and counts invalid created dates', () => {
  const summary = app.window.calculateCustomerSummary([
    { customerId: 'CUSTOMER-003', customerName: 'Legacy Store', createdAt: 'bad-date' }
  ], { now: new Date(2026, 6, 31, 12), recentDays: 30 });
  assert.equal(summary.totalCustomers, 1);
  assert.equal(summary.activeCustomers, 1);
  assert.equal(summary.inactiveCustomers, 0);
  assert.equal(summary.invalidCreatedDateCount, 1);
});

test('Customer date parser supports Buddhist year date strings', () => {
  const parsed = app.window.parseCustomerDateForKpi('31/07/2569');
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 6);
  assert.equal(parsed.getDate(), 31);
});

test('Business KPI excludes cancelled quotations and aggregates line values by BU', () => {
  const summary = app.calculateBusinessSummary({
    quotes: dashboardQuotes,
    lines: dashboardLines,
    products: dashboardProducts,
    customers: dashboardCustomers
  });
  const unitTotals = Object.fromEntries(summary.units.map(unit => [unit.key, unit.total]));
  assert.equal(summary.quotationValue, 1070);
  assert.equal(unitTotals.GYPROC, 1000);
  assert.equal(unitTotals.WEBER, 100);
  assert.equal(summary.valuedLineCount, 2);
  assert.equal(summary.state, 'ready');
});

test('Sales KPI calculates achievement, remaining, forecast, and required averages', () => {
  const result = app.window.calculateSalesKpi({
    actual: 500000,
    effectiveTarget: {
      totalTarget: 1000000,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      sourceScope: 'AREA',
      businessUnit: 'ALL'
    },
    today: new Date(2026, 6, 16, 12)
  });
  assert.equal(result.target, 1000000);
  assert.equal(result.actual, 500000);
  assert.equal(result.elapsedDays, 16);
  assert.equal(result.remainingDays, 15);
  assertClose(result.achievementPercent, 50);
  assert.equal(result.remaining, 500000);
  assertClose(result.forecast, 968750);
  assertClose(result.requiredDailyAverage, 33333.333333);
  assert.equal(result.requiredMonthlyAverage, 500000);
});

test('Sales KPI uses explicit missing-target state when no effective target is available', () => {
  const result = app.window.calculateSalesKpi({
    actual: 500000,
    effectiveTarget: null,
    today: new Date(2026, 6, 16, 12)
  });
  assert.equal(Boolean(result.hasTarget), false);
  assert.equal(result.target, null);
  assert.equal(result.achievementPercent, null);
  assert.equal(result.remaining, null);
});

test('Sales KPI dashboard target total uses GYPROC plus WEBER effective total', () => {
  const result = app.window.calculateSalesKpi({
    actual: 500000,
    effectiveTarget: {
      totalTarget: 2300000,
      gyprocTarget: 1300000,
      weberTarget: 1000000,
      legacyAllActiveAmount: 999999,
      legacyAllRequiresManualReview: true,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      businessUnit: 'ALL'
    },
    today: new Date(2026, 6, 16, 12)
  });
  assert.equal(result.target, 2300000);
  assertClose(result.achievementPercent, 21.73913, 0.00001);
});
