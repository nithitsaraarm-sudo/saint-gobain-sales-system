import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppsScriptContext } from '../helpers/source-loader.mjs';

const ctx = loadAppsScriptContext('appscript/CustomerAgreement.gs');

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('Customer Agreement calculation ignores caller supplied derived values', () => {
  const result = ctx.agreementValidateEntryPayload_({
    entryType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    targetAmount: '1,000.00',
    actualAmount: '1,250.00',
    eligibleAmount: '800.00',
    benefitRate: '10',
    achievementPercent: 999,
    passed: false,
    benefitAmount: 999
  }, null, 'TEST');

  assert.equal(result.ok, true);
  assert.equal(result.data.achievementPercent, 125);
  assert.equal(result.data.passed, true);
  assert.equal(result.data.benefitAmount, 80);
});

test('Customer Agreement target zero produces no valid achievement and no benefit', () => {
  const calculated = ctx.agreementCalculateEntryValues_({
    targetAmount: 0,
    actualAmount: 500,
    eligibleAmount: 500,
    benefitRate: 20
  });

  assert.equal(calculated.achievementPercent, '');
  assert.equal(calculated.passed, false);
  assert.equal(calculated.benefitAmount, 0);
});

test('Customer Agreement period validation supports monthly, quarterly, half-year, annual and manual fee entries', () => {
  const monthly = ctx.agreementValidatePeriod_('MONTHLY', { periodYear: 2026, periodMonth: 7 }, 'TEST');
  const quarterly = ctx.agreementValidatePeriod_('QUARTERLY', { periodYear: 2026, periodQuarter: 3 }, 'TEST');
  const half = ctx.agreementValidatePeriod_('HALF_YEAR', { periodYear: 2026, periodHalf: 2 }, 'TEST');
  const annual = ctx.agreementValidatePeriod_('ANNUAL', { periodYear: 2026 }, 'TEST');
  const marketing = ctx.agreementValidatePeriod_('MARKETING_FEE', { periodYear: 2026 }, 'TEST');

  assert.deepEqual(plain(monthly.data), { periodYear: 2026, periodMonth: 7, periodQuarter: '', periodHalf: '' });
  assert.deepEqual(plain(quarterly.data), { periodYear: 2026, periodMonth: '', periodQuarter: 3, periodHalf: '' });
  assert.deepEqual(plain(half.data), { periodYear: 2026, periodMonth: '', periodQuarter: '', periodHalf: 2 });
  assert.deepEqual(plain(annual.data), { periodYear: 2026, periodMonth: '', periodQuarter: '', periodHalf: '' });
  assert.deepEqual(plain(marketing.data), { periodYear: 2026, periodMonth: '', periodQuarter: '', periodHalf: '' });
});

test('Customer Agreement money parser accepts formatted numbers and rejects malformed amounts', () => {
  assert.equal(ctx.agreementValidateMoney_('1,000,000.25', 'targetAmount', 'TEST').data, 1000000.25);
  assert.equal(ctx.agreementValidateMoney_('1,2,3', 'targetAmount', 'TEST').ok, false);
  assert.equal(ctx.agreementValidateMoney_(Infinity, 'targetAmount', 'TEST').ok, false);
  assert.equal(ctx.agreementValidateMoney_(-1, 'targetAmount', 'TEST').ok, false);
});

test('Customer Agreement summary uses active entries and derived benefit values', () => {
  const summary = ctx.agreementBuildSummary_([
    { active: true, targetAmount: 100, actualAmount: 120, eligibleAmount: 1000, benefitRate: 5 },
    { active: false, targetAmount: 900, actualAmount: 900, eligibleAmount: 9000, benefitRate: 50 },
    { active: true, targetAmount: 100, actualAmount: 40, eligibleAmount: 1000, benefitRate: 5 }
  ]);

  assert.equal(summary.entryCount, 2);
  assert.equal(summary.passedCount, 1);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.totalTarget, 200);
  assert.equal(summary.totalActual, 160);
  assert.equal(summary.totalBenefit, 50);
  assert.equal(summary.achievementPercent, 80);
});

test('Customer Agreement permissions keep VIEWER/PC read/write behavior explicit', () => {
  assert.equal(ctx.agreementCanView_({ role: 'VIEWER' }), true);
  assert.equal(ctx.agreementCanManage_({ role: 'VIEWER' }), false);
  assert.equal(ctx.agreementCanView_({ role: 'PC' }), false);
  assert.equal(ctx.agreementCanManage_({ role: 'PC' }), false);
  assert.equal(ctx.agreementCanManage_({ role: 'SALES' }), true);
});

test('Customer Agreement closed agreements are read-only', () => {
  const closed = ctx.agreementEditableCheck_({ status: 'CLOSED', active: true }, 'TEST');
  const archived = ctx.agreementEditableCheck_({ status: 'ARCHIVED', active: false }, 'TEST');
  const active = ctx.agreementEditableCheck_({ status: 'ACTIVE', active: true }, 'TEST');

  assert.equal(closed.ok, false);
  assert.equal(closed.code, 'AGREEMENT_CLOSED');
  assert.equal(archived.ok, false);
  assert.equal(active.ok, true);
});

test('Customer Agreement attachment validation allows PDF/PNG/XLSX only and enforces size', () => {
  const png = ctx.agreementValidateAttachmentPayload_({
    agreementId: 'AGR-1',
    fileName: 'proof.png',
    mimeType: 'image/png',
    fileSize: 1024,
    fileData: 'data:image/png;base64,AAAA'
  }, 'TEST');
  const script = ctx.agreementValidateAttachmentPayload_({
    agreementId: 'AGR-1',
    fileName: 'bad.js',
    mimeType: 'application/javascript',
    fileSize: 100,
    fileData: 'AAAA'
  }, 'TEST');
  const tooLarge = ctx.agreementValidateAttachmentPayload_({
    agreementId: 'AGR-1',
    fileName: 'big.pdf',
    mimeType: 'application/pdf',
    fileSize: 11 * 1024 * 1024,
    fileData: 'AAAA'
  }, 'TEST');

  assert.equal(png.ok, true);
  assert.equal(png.data.fileExtension, 'png');
  assert.equal(script.ok, false);
  assert.equal(tooLarge.ok, false);
});
