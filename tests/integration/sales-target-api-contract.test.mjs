import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUsers, apiUserList, salesTargetHeaders, makeSalesTarget } from '../fixtures/api-contract-data.mjs';
import { clone, failure, loadAppsScriptContext, ok, RESPONSE_CODES } from '../helpers/api-contract-harness.mjs';

function createSalesTargetApiContext(actor, initialRows = []) {
  const rows = initialRows.map(row => Object.assign({}, row));
  let uuid = 0;
  const writes = [];
  function rowWithNumber(row, index) {
    return Object.assign({}, row, { _rowNumber: index + 2 });
  }
  const ctx = loadAppsScriptContext([
    'appscript/Response.gs',
    'appscript/Permission.gs',
    'appscript/SalesTarget.gs',
    'appscript/Api.gs'
  ], {
    RESPONSE_CODES,
    getSheetData() {
      return ok(rows.map(rowWithNumber));
    },
    ensureSheet() {
      return {
        getLastRow() {
          return rows.length + 1;
        },
        getRange(row) {
          return {
            setValues(values) {
              const record = {};
              salesTargetHeaders.forEach((header, index) => {
                record[header] = values[0][index];
              });
              const targetIndex = Number(row) - 2;
              if (targetIndex >= 0 && targetIndex < rows.length) {
                rows[targetIndex] = Object.assign({}, rows[targetIndex], record);
              } else {
                rows.push(record);
              }
              writes.push({ row, record });
            }
          };
        }
      };
    },
    listUserAccounts() {
      return ok(apiUserList.map(user => Object.assign({}, user)));
    },
    clearSheetDataCache() {}
  });
  ctx.Utilities.getUuid = function getSyntheticUuid() {
    uuid += 1;
    return `00000000-0000-4000-8000-${String(uuid).padStart(12, '0')}`;
  };
  ctx.requireApiUser = function requireSyntheticApiUser() {
    return actor ? ok(actor) : failure('Session expired', 'FORBIDDEN');
  };
  ctx.__rows = rows;
  ctx.__writes = writes;
  return ctx;
}

test('Sales Target API creates GYPROC and WEBER configurable targets but rejects new ALL targets', () => {
  const ctx = createSalesTargetApiContext(apiUsers.adminNE03);
  const gyproc = ctx.api('saveSalesTarget', {
    sessionToken: 'synthetic',
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
  assert.equal(gyproc.data.version, 1);
  assert.match(gyproc.eventId, /^TARGET-CREATE-/);

  const weber = ctx.api('saveSalesTarget', {
    sessionToken: 'synthetic',
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
  assert.equal(ctx.__rows.length, 2);

  const all = ctx.api('saveSalesTarget', {
    sessionToken: 'synthetic',
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    businessUnit: 'ALL',
    scopeType: 'AREA',
    salesArea: 'NE03',
    targetAmount: '2,300,000',
    status: 'ACTIVE'
  });
  assert.equal(all.ok, false);
  assert.equal(all.code, 'INVALID_TARGET_BUSINESS_UNIT');
  assert.equal(ctx.__rows.length, 2);
});

test('Sales Target API accepts ALL as a filter and keeps historical ALL readable', () => {
  const ctx = createSalesTargetApiContext(apiUsers.adminNE03, [
    makeSalesTarget({ targetId: 'GYP-001', businessUnit: 'GYPROC', targetAmount: 1300000 }),
    makeSalesTarget({ targetId: 'WEB-001', businessUnit: 'WEBER', targetAmount: 1000000 }),
    makeSalesTarget({ targetId: 'ALL-LEGACY', businessUnit: 'ALL', targetAmount: 999999, status: 'INACTIVE', active: false })
  ]);

  const management = ctx.api('getSalesTargetManagementData', {
    sessionToken: 'synthetic',
    businessUnit: 'ALL',
    periodYear: 2026,
    periodMonth: 7
  });
  assert.equal(management.ok, true);
  assert.deepEqual(clone(management.data.targets.map(row => row.targetId).sort()), ['ALL-LEGACY', 'GYP-001', 'WEB-001']);
  assert.equal(management.data.summary.gyproc, 1300000);
  assert.equal(management.data.summary.weber, 1000000);
  assert.equal(management.data.summary.legacyAllRequiresManualReview, false);
  assert.deepEqual(clone(management.data.formOptions.configurableBusinessUnits), ['GYPROC', 'WEBER']);
  assert.deepEqual(clone(management.data.formOptions.filterBusinessUnits), ['ALL', 'GYPROC', 'WEBER']);

  const invalidFilter = ctx.api('getSalesTargetManagementData', {
    sessionToken: 'synthetic',
    businessUnit: 'TOTAL'
  });
  assert.equal(invalidFilter.ok, false);
  assert.equal(invalidFilter.code, 'INVALID_TARGET_BUSINESS_UNIT');
});

test('Sales Target API rejects duplicate active BU target and stale version updates', () => {
  const ctx = createSalesTargetApiContext(apiUsers.adminNE03, [
    makeSalesTarget({ targetId: 'GYP-001', businessUnit: 'GYPROC', targetAmount: 1300000, version: 3 })
  ]);

  const duplicate = ctx.api('saveSalesTarget', {
    sessionToken: 'synthetic',
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    businessUnit: 'GYPROC',
    scopeType: 'AREA',
    salesArea: 'NE03',
    targetAmount: 1400000,
    status: 'ACTIVE'
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, 'CONFLICT');

  const stale = ctx.api('updateSalesTarget', {
    sessionToken: 'synthetic',
    targetId: 'GYP-001',
    version: 2,
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    businessUnit: 'GYPROC',
    scopeType: 'AREA',
    salesArea: 'NE03',
    targetAmount: 1350000,
    status: 'ACTIVE'
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, 'CONFLICT');
  assert.equal(stale.detail.currentVersion, 3);

  const current = ctx.api('updateSalesTarget', {
    sessionToken: 'synthetic',
    targetId: 'GYP-001',
    version: 3,
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    businessUnit: 'GYPROC',
    scopeType: 'AREA',
    salesArea: 'NE03',
    targetAmount: 1350000,
    status: 'ACTIVE'
  });
  assert.equal(current.ok, true);
  assert.equal(current.data.version, 4);
  assert.equal(current.data.targetAmount, 1350000);
});

test('Sales Target API keeps legacy ALL deactivation possible but reactivation rejected', () => {
  const activeLegacy = createSalesTargetApiContext(apiUsers.adminNE03, [
    makeSalesTarget({ targetId: 'ALL-ACTIVE', businessUnit: 'ALL', targetAmount: 999999, status: 'ACTIVE', active: true })
  ]);
  const deactivate = activeLegacy.api('setSalesTargetStatus', {
    sessionToken: 'synthetic',
    targetId: 'ALL-ACTIVE',
    version: 1,
    status: 'INACTIVE'
  });
  assert.equal(deactivate.ok, true);
  assert.equal(deactivate.data.businessUnit, 'ALL');
  assert.equal(deactivate.data.status, 'INACTIVE');

  const inactiveLegacy = createSalesTargetApiContext(apiUsers.adminNE03, [
    makeSalesTarget({ targetId: 'ALL-INACTIVE', businessUnit: 'ALL', targetAmount: 999999, status: 'INACTIVE', active: false })
  ]);
  const reactivate = inactiveLegacy.api('setSalesTargetStatus', {
    sessionToken: 'synthetic',
    targetId: 'ALL-INACTIVE',
    version: 1,
    status: 'ACTIVE'
  });
  assert.equal(reactivate.ok, false);
  assert.equal(reactivate.code, 'INVALID_TARGET_BUSINESS_UNIT');
});

test('Sales Target API separates management permissions from SALES dashboard effective-target read', () => {
  const rows = [
    makeSalesTarget({ targetId: 'GYP-001', businessUnit: 'GYPROC', targetAmount: 1300000 }),
    makeSalesTarget({ targetId: 'WEB-001', businessUnit: 'WEBER', targetAmount: 1000000 })
  ];
  const sales = createSalesTargetApiContext(apiUsers.salesNE03, rows);

  const effective = sales.api('getEffectiveSalesTarget', {
    sessionToken: 'synthetic',
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    businessUnit: 'ALL'
  });
  assert.equal(effective.ok, true);
  assert.equal(effective.data.totalTarget, 2300000);
  assert.equal(effective.data.gyprocTarget, 1300000);
  assert.equal(effective.data.weberTarget, 1000000);

  const management = sales.api('getSalesTargetManagementData', {
    sessionToken: 'synthetic',
    businessUnit: 'ALL'
  });
  assert.equal(management.ok, false);
  assert.equal(management.code, 'FORBIDDEN');

  const write = sales.api('saveSalesTarget', {
    sessionToken: 'synthetic',
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 8,
    businessUnit: 'GYPROC',
    salesArea: 'NE03',
    targetAmount: 1,
    status: 'ACTIVE'
  });
  assert.equal(write.ok, false);
  assert.equal(write.code, 'FORBIDDEN');

  const pc = createSalesTargetApiContext(apiUsers.pc, rows);
  const pcEffective = pc.api('getEffectiveSalesTarget', {
    sessionToken: 'synthetic',
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    businessUnit: 'ALL'
  });
  assert.equal(pcEffective.ok, false);
  assert.equal(pcEffective.code, 'FORBIDDEN');
});

test('Sales Target effective ALL contract does not double-count legacy ALL active rows', () => {
  const ctx = createSalesTargetApiContext(apiUsers.adminNE03, [
    makeSalesTarget({ targetId: 'ALL-LEGACY', businessUnit: 'ALL', targetAmount: 999999, status: 'ACTIVE', active: true }),
    makeSalesTarget({ targetId: 'GYP-001', businessUnit: 'GYPROC', targetAmount: 1300000 }),
    makeSalesTarget({ targetId: 'WEB-001', businessUnit: 'WEBER', targetAmount: 1000000 })
  ]);

  const result = ctx.api('getEffectiveSalesTarget', {
    sessionToken: 'synthetic',
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    businessUnit: 'ALL',
    salesArea: 'NE03'
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.totalTarget, 2300000);
  assert.deepEqual(clone(result.data.sourceTargetIds).sort(), ['GYP-001', 'WEB-001']);
  assert.deepEqual(clone(result.data.legacyAllTargetIds), ['ALL-LEGACY']);
  assert.equal(result.data.legacyAllRequiresManualReview, true);
});
