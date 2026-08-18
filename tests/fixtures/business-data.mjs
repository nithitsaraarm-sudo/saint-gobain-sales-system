export function makeSalesTarget(overrides = {}) {
  return Object.assign({
    targetId: 'TARGET-001',
    targetType: 'MONTHLY',
    periodYear: 2026,
    periodMonth: 7,
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    businessUnit: 'GYPROC',
    salesArea: 'NE03',
    salesUserId: '',
    salesUserNameSnapshot: '',
    targetAmount: 1300000,
    status: 'ACTIVE',
    active: true,
    version: 1
  }, overrides);
}

export const dashboardQuotes = [
  { quoteId: 'QUOTE-001', quoteNo: 'WEBQT-202607-0001', status: 'SAVED', grandTotal: 1070 },
  { quoteId: 'QUOTE-002', quoteNo: 'GYPQT-202607-0001', status: 'CANCELLED', grandTotal: 9999 }
];

export const dashboardLines = [
  { quoteId: 'QUOTE-001', lineId: 'LINE-001', productId: 'PROD-GYP-001', businessUnit: 'GYPROC', qty: 10, unitPrice: 100, lineTotal: 1000, status: 'ACTIVE' },
  { quoteId: 'QUOTE-001', lineId: 'LINE-002', productId: 'PROD-WEB-001', businessUnit: 'weber', qty: 2, unitPrice: 50, status: 'ACTIVE' },
  { quoteId: 'QUOTE-002', lineId: 'LINE-003', productId: 'PROD-GYP-002', businessUnit: 'GYPROC', qty: 1, unitPrice: 9999, status: 'ACTIVE' }
];

export const dashboardProducts = [
  { productId: 'PROD-GYP-001', productName: 'Synthetic Gyproc Board', brand: 'GYPROC', unit: 'sheet', listPrice: 100 },
  { productId: 'PROD-WEB-001', productName: 'Synthetic Weber Mortar', brand: 'WEBER', unit: 'bag', listPrice: 50 }
];

export const dashboardCustomers = [
  { customerId: 'CUSTOMER-001', customerName: 'Synthetic Active Store', status: 'ACTIVE', createdAt: '2026-07-20' },
  { customerId: 'CUSTOMER-002', customerName: 'Synthetic Inactive Store', status: 'INACTIVE', createdAt: '2026-05-01' }
];
