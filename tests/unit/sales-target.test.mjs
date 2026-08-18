import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppsScriptContext } from '../helpers/source-loader.mjs';
import { makeSalesTarget } from '../fixtures/business-data.mjs';

const ctx = loadAppsScriptContext('appscript/SalesTarget.gs');
const adminNE03 = { userId: 'ADMIN-001', role: 'ADMIN', area: 'NE03' };

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSaveContext(rows = []) {
  const writes = [];
  const saveCtx = loadAppsScriptContext('appscript/SalesTarget.gs', {
    requireApiUser() {
      return { ok: true, data: adminNE03 };
    },
    getSheetData() {
      return { ok: true, data: rows };
    },
    ensureSheet() {
      return {
        getLastRow() {
          return rows.length + 1;
        },
        getRange(row, column, rowCount, columnCount) {
          return {
            setValues(values) {
              writes.push({ row, column, rowCount, columnCount, values });
            }
          };
        }
      };
    },
    clearSheetDataCache() {}
  });
  saveCtx.__writes = writes;
  return saveCtx;
}

test('Sales Target summary sums active GYPROC and WEBER targets independently', () => {
  const rows = [
    makeSalesTarget({ targetId: 'GYP-001', businessUnit: 'GYPROC', targetAmount: 1300000 }),
    makeSalesTarget({ targetId: 'WEB-001', businessUnit: 'WEBER', targetAmount: 1000000 }),
    makeSalesTarget({ targetId: 'ALL-LEGACY', businessUnit: 'ALL', targetAmount: 999999 }),
    makeSalesTarget({ targetId: 'WEB-INACTIVE', businessUnit: 'WEBER', targetAmount: 500000, status: 'INACTIVE', active: false })
  ];
  const summary = ctx.salesTargetBuildSummary_(rows);
  assert.equal(summary.gyproc, 1300000);
  assert.equal(summary.weber, 1000000);
  assert.equal(summary.totalActive, 2300000);
  assert.equal(summary.legacyAllActiveCount, 1);
  assert.equal(summary.legacyAllRequiresManualReview, true);
});

test('Sales Target creation accepts GYPROC and WEBER configurable targets', () => {
  const gyprocCtx = createSaveContext();
  const gyproc = gyprocCtx.saveSalesTarget({
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    businessUnit: 'GYPROC',
    scopeType: 'AREA',
    salesArea: 'NE03',
    targetAmount: '1,300,000',
    status: 'ACTIVE'
  });
  assert.equal(gyproc.ok, true);
  assert.equal(gyproc.data.businessUnit, 'GYPROC');
  assert.equal(gyprocCtx.__writes.length, 1);

  const weberCtx = createSaveContext();
  const weber = weberCtx.saveSalesTarget({
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    businessUnit: 'WEBER',
    scopeType: 'AREA',
    salesArea: 'NE03',
    targetAmount: '1,000,000',
    status: 'ACTIVE'
  });
  assert.equal(weber.ok, true);
  assert.equal(weber.data.businessUnit, 'WEBER');
  assert.equal(weberCtx.__writes.length, 1);
});

test('Sales Target backend rejects new ALL targets including direct API bypass attempts', () => {
  const saveCtx = createSaveContext();
  const result = saveCtx.saveSalesTarget({
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    businessUnit: 'ALL',
    scopeType: 'AREA',
    salesArea: 'NE03',
    targetAmount: '2,300,000',
    status: 'ACTIVE'
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_TARGET_BUSINESS_UNIT');
  assert.equal(result.message, 'Sales Target must use GYPROC or WEBER.');
  assert.equal(saveCtx.__writes.length, 0);
});

test('Sales Target effective ALL request totals separate GYPROC and WEBER rows when no ALL row exists', () => {
  const rows = [
    makeSalesTarget({ targetId: 'GYP-001', businessUnit: 'GYPROC', targetAmount: 1300000 }),
    makeSalesTarget({ targetId: 'WEB-001', businessUnit: 'WEBER', targetAmount: 1000000 })
  ];
  const result = ctx.resolveEffectiveSalesTarget_(rows, adminNE03, {
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    businessUnit: 'ALL',
    salesArea: 'NE03'
  });
  assert.equal(result.totalTarget, 2300000);
  assert.equal(result.gyprocTarget, 1300000);
  assert.equal(result.weberTarget, 1000000);
  assert.deepEqual(toPlain(result.sourceTargetIds).sort(), ['GYP-001', 'WEB-001']);
});

test('Sales Target effective ALL request ignores legacy ALL and totals GYPROC plus WEBER', () => {
  const rows = [
    makeSalesTarget({ targetId: 'ALL-LEGACY', businessUnit: 'ALL', targetAmount: 999999 }),
    makeSalesTarget({ targetId: 'GYP-001', businessUnit: 'GYPROC', targetAmount: 1300000 }),
    makeSalesTarget({ targetId: 'WEB-001', businessUnit: 'WEBER', targetAmount: 1000000 })
  ];
  const result = ctx.resolveEffectiveSalesTarget_(rows, adminNE03, {
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    businessUnit: 'ALL',
    salesArea: 'NE03'
  });
  assert.equal(result.totalTarget, 2300000);
  assert.equal(result.gyprocTarget, 1300000);
  assert.equal(result.weberTarget, 1000000);
  assert.deepEqual(toPlain(result.sourceTargetIds).sort(), ['GYP-001', 'WEB-001']);
  assert.deepEqual(toPlain(result.legacyAllTargetIds), ['ALL-LEGACY']);
  assert.equal(result.legacyAllRequiresManualReview, true);
});

test('Sales Target effective total supports GYPROC-only and WEBER-only periods', () => {
  const gyprocOnly = ctx.resolveEffectiveSalesTarget_([
    makeSalesTarget({ targetId: 'GYP-ONLY', businessUnit: 'GYPROC', targetAmount: 1300000 })
  ], adminNE03, {
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    businessUnit: 'ALL',
    salesArea: 'NE03'
  });
  assert.equal(gyprocOnly.totalTarget, 1300000);
  assert.equal(gyprocOnly.gyprocTarget, 1300000);
  assert.equal(gyprocOnly.weberTarget, 0);

  const weberOnly = ctx.resolveEffectiveSalesTarget_([
    makeSalesTarget({ targetId: 'WEB-ONLY', businessUnit: 'WEBER', targetAmount: 1000000 })
  ], adminNE03, {
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    businessUnit: 'ALL',
    salesArea: 'NE03'
  });
  assert.equal(weberOnly.totalTarget, 1000000);
  assert.equal(weberOnly.gyprocTarget, 0);
  assert.equal(weberOnly.weberTarget, 1000000);
});

test('Sales Target effective result returns missing target state without misleading zero achievement source', () => {
  const result = ctx.resolveEffectiveSalesTarget_([], adminNE03, {
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    businessUnit: 'GYPROC',
    salesArea: 'NE03'
  });
  assert.equal(result.targetAmount, null);
  assert.equal(result.totalTarget, null);
  assert.equal(result.sourceScope, 'NONE');
  assert.deepEqual(toPlain(result.targets), []);
});

test('Sales Target filters keep ALL as show-all while GYPROC and WEBER narrow rows', () => {
  const rows = [
    makeSalesTarget({ targetId: 'GYP-001', businessUnit: 'GYPROC', targetAmount: 1300000 }),
    makeSalesTarget({ targetId: 'WEB-001', businessUnit: 'WEBER', targetAmount: 1000000 }),
    makeSalesTarget({ targetId: 'ALL-LEGACY', businessUnit: 'ALL', targetAmount: 999999, status: 'INACTIVE', active: false })
  ];
  const allRows = ctx.salesTargetApplyFilters_(rows.map(ctx.salesTargetNormalizeRow_), { businessUnit: 'ALL' });
  const gyprocRows = ctx.salesTargetApplyFilters_(rows.map(ctx.salesTargetNormalizeRow_), { businessUnit: 'GYPROC' });
  const weberRows = ctx.salesTargetApplyFilters_(rows.map(ctx.salesTargetNormalizeRow_), { businessUnit: 'WEBER' });
  assert.deepEqual(toPlain(allRows.map(row => row.targetId)).sort(), ['ALL-LEGACY', 'GYP-001', 'WEB-001']);
  assert.deepEqual(toPlain(gyprocRows.map(row => row.targetId)), ['GYP-001']);
  assert.deepEqual(toPlain(weberRows.map(row => row.targetId)), ['WEB-001']);

  const apiCtx = createSaveContext(rows);
  const invalidList = apiCtx.getSalesTargets({ businessUnit: 'TOTAL' });
  const invalidManagement = apiCtx.getSalesTargetManagementData({ businessUnit: 'TOTAL' });
  assert.equal(invalidList.ok, false);
  assert.equal(invalidList.code, 'INVALID_TARGET_BUSINESS_UNIT');
  assert.equal(invalidManagement.ok, false);
  assert.equal(invalidManagement.code, 'INVALID_TARGET_BUSINESS_UNIT');
});

test('Sales Target form options separate configurable BU values from filter BU values', () => {
  const options = ctx.salesTargetBuildFormOptions_({}, adminNE03);
  assert.deepEqual(toPlain(options.businessUnits), ['GYPROC', 'WEBER']);
  assert.deepEqual(toPlain(options.configurableBusinessUnits), ['GYPROC', 'WEBER']);
  assert.deepEqual(toPlain(options.filterBusinessUnits), ['ALL', 'GYPROC', 'WEBER']);
  assert.equal(new Set(options.filterBusinessUnits).size, 3);
});

test('Sales Target validation canonicalizes annual period and rejects missing monthly month', () => {
  const annual = ctx.salesTargetValidatePayload_({
    targetType: 'ANNUAL',
    periodYear: 2026,
    periodMonth: 8,
    businessUnit: 'GYPROC',
    scopeType: 'AREA',
    salesArea: 'NE03',
    targetAmount: '1,300,000',
    status: 'ACTIVE'
  }, adminNE03, null);
  assert.equal(annual.ok, true);
  assert.equal(annual.data.periodMonth, '');
  assert.equal(annual.data.periodStart, '2026-01-01');
  assert.equal(annual.data.periodEnd, '2026-12-31');

  const monthlyMissing = ctx.salesTargetValidatePayload_({
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: '',
    businessUnit: 'WEBER',
    scopeType: 'AREA',
    salesArea: 'NE03',
    targetAmount: '1,000,000',
    status: 'ACTIVE'
  }, adminNE03, null);
  assert.equal(monthlyMissing.ok, false);
  assert.equal(monthlyMissing.code, 'VALIDATION_ERROR');
  assert.equal(monthlyMissing.message, 'Invalid target period');
});

test('Historical inactive ALL targets remain readable and are not automatically mutated', () => {
  const legacy = makeSalesTarget({ targetId: 'ALL-INACTIVE', businessUnit: 'ALL', targetAmount: 999999, status: 'INACTIVE', active: false, _rowNumber: 2 });
  const saveCtx = createSaveContext([legacy]);
  const result = saveCtx.updateSalesTarget({
    targetId: 'ALL-INACTIVE',
    version: 1,
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    scopeType: 'AREA',
    salesArea: 'NE03',
    targetAmount: '999,999',
    status: 'INACTIVE'
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.businessUnit, 'ALL');
  assert.equal(result.data.status, 'INACTIVE');
  assert.equal(saveCtx.__writes.length, 1);
});

test('Historical ALL targets can be deactivated but cannot be reactivated', () => {
  const activeLegacy = makeSalesTarget({ targetId: 'ALL-ACTIVE', businessUnit: 'ALL', targetAmount: 999999, status: 'ACTIVE', active: true, _rowNumber: 2 });
  const deactivateCtx = createSaveContext([activeLegacy]);
  const deactivate = deactivateCtx.setSalesTargetStatus({ targetId: 'ALL-ACTIVE', version: 1, status: 'INACTIVE' });
  assert.equal(deactivate.ok, true);
  assert.equal(deactivate.data.businessUnit, 'ALL');
  assert.equal(deactivate.data.status, 'INACTIVE');

  const inactiveLegacy = makeSalesTarget({ targetId: 'ALL-INACTIVE', businessUnit: 'ALL', targetAmount: 999999, status: 'INACTIVE', active: false, _rowNumber: 2 });
  const reactivateCtx = createSaveContext([inactiveLegacy]);
  const reactivate = reactivateCtx.setSalesTargetStatus({ targetId: 'ALL-INACTIVE', version: 1, status: 'ACTIVE' });
  assert.equal(reactivate.ok, false);
  assert.equal(reactivate.code, 'INVALID_TARGET_BUSINESS_UNIT');
});

test('Sales Target duplicate active records are rejected per BU scope', () => {
  const rows = [
    makeSalesTarget({ targetId: 'GYP-001', businessUnit: 'GYPROC', targetAmount: 1300000 }),
    makeSalesTarget({ targetId: 'WEB-001', businessUnit: 'WEBER', targetAmount: 1000000 })
  ];
  const duplicateGyproc = makeSalesTarget({ targetId: 'GYP-002', businessUnit: 'GYPROC', targetAmount: 1400000 });
  const duplicateWeber = makeSalesTarget({ targetId: 'WEB-002', businessUnit: 'WEBER', targetAmount: 1100000 });
  assert.equal(ctx.salesTargetHasConflict_(rows, duplicateGyproc, '').targetId, 'GYP-001');
  assert.equal(ctx.salesTargetHasConflict_(rows, duplicateWeber, '').targetId, 'WEB-001');
  assert.equal(ctx.salesTargetHasConflict_(rows, makeSalesTarget({ targetId: 'GYP-DRAFT', businessUnit: 'GYPROC', status: 'DRAFT', active: false }), ''), null);
});

test('Sales Target period and numeric/version normalization keep concurrency metadata deterministic', () => {
  assert.deepEqual(toPlain(ctx.salesTargetPeriod_('MONTHLY', 2026, 7)), {
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    periodMonth: 7
  });
  assert.deepEqual(toPlain(ctx.salesTargetPeriod_('ANNUAL', 2026, 7)), {
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
    periodMonth: ''
  });
  assert.deepEqual(toPlain(ctx.salesTargetPeriod_('MONTHLY', 2024, 2)), {
    periodStart: '2024-02-01',
    periodEnd: '2024-02-29',
    periodMonth: 2
  });
  assert.equal(ctx.salesTargetPeriod_('MONTHLY', 2026, ''), null);
  assert.equal(ctx.salesTargetParseNumber_('1,300,000.50'), 1300000.5);
  assert.equal(Number.isNaN(ctx.salesTargetParseNumber_('not-a-number')), true);
  assert.equal(ctx.salesTargetNormalizeRow_({ version: 0 }).version, 1);
  assert.equal(ctx.salesTargetNormalizeRow_({ version: '5' }).version, 5);
});
