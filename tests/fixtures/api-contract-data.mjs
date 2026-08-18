export const apiUsers = Object.freeze({
  superAdmin: Object.freeze({
    userId: 'U-SUPER-001',
    username: 'super.admin',
    displayName: 'Synthetic Super Admin',
    fullName: 'Synthetic Super Admin',
    quoteDisplayName: 'Synthetic Super Admin',
    role: 'SUPER_ADMIN',
    area: 'System',
    branch: 'System',
    status: 'Active'
  }),
  adminNE03: Object.freeze({
    userId: 'U-ADMIN-NE03',
    username: 'admin.ne03',
    displayName: 'Synthetic Admin NE03',
    fullName: 'Synthetic Admin NE03',
    quoteDisplayName: 'Synthetic Admin NE03',
    role: 'ADMIN',
    area: 'NE03',
    branch: 'NE03',
    status: 'Active'
  }),
  managerNE03: Object.freeze({
    userId: 'U-MANAGER-NE03',
    username: 'manager.ne03',
    displayName: 'Synthetic Manager NE03',
    fullName: 'Synthetic Manager NE03',
    role: 'MANAGER',
    area: 'NE03',
    branch: 'NE03',
    status: 'Active'
  }),
  salesNE03: Object.freeze({
    userId: 'U-SALES-NE03',
    username: 'sales.ne03',
    displayName: 'Synthetic Sales NE03',
    fullName: 'Synthetic Sales NE03',
    quoteDisplayName: 'Synthetic Sales NE03',
    role: 'SALES',
    area: 'NE03',
    branch: 'NE03',
    status: 'Active'
  }),
  salesNE03Other: Object.freeze({
    userId: 'U-SALES-NE03-B',
    username: 'sales.ne03.b',
    displayName: 'Synthetic Sales NE03 B',
    fullName: 'Synthetic Sales NE03 B',
    role: 'SALES',
    area: 'NE03',
    branch: 'NE03',
    status: 'Active'
  }),
  salesNE01: Object.freeze({
    userId: 'U-SALES-NE01',
    username: 'sales.ne01',
    displayName: 'Synthetic Sales NE01',
    fullName: 'Synthetic Sales NE01',
    role: 'SALES',
    area: 'NE01',
    branch: 'NE01',
    status: 'Active'
  }),
  viewer: Object.freeze({
    userId: 'U-VIEWER-001',
    username: 'viewer.user',
    displayName: 'Synthetic Viewer',
    fullName: 'Synthetic Viewer',
    role: 'VIEWER',
    area: 'System',
    branch: 'System',
    status: 'Active'
  }),
  pc: Object.freeze({
    userId: 'U-PC-001',
    username: 'pc.user',
    displayName: 'Synthetic PC',
    fullName: 'Synthetic PC',
    role: 'PC',
    area: 'NE03',
    branch: 'NE03',
    status: 'Active'
  })
});

export const apiUserList = Object.freeze(Object.values(apiUsers));

export const customerHeaders = Object.freeze([
  'customerId',
  'customerName',
  'province',
  'district',
  'phone',
  'notes',
  'address',
  'group',
  'salesArea',
  'assignedSalesUserId',
  'assignedSalesUsername',
  'assignedSalesNameSnapshot',
  'sellsWeber',
  'sellsGyproc',
  'active',
  'createdAt',
  'updatedAt',
  'updatedBy'
]);

export const salesTargetHeaders = Object.freeze([
  'targetId',
  'targetType',
  'periodYear',
  'periodMonth',
  'periodStart',
  'periodEnd',
  'businessUnit',
  'salesArea',
  'salesUserId',
  'salesUserNameSnapshot',
  'targetAmount',
  'currency',
  'status',
  'active',
  'createdByUserId',
  'createdByNameSnapshot',
  'createdAt',
  'updatedByUserId',
  'updatedByNameSnapshot',
  'updatedAt',
  'version'
]);

export function makeCustomer(overrides = {}) {
  return Object.assign({
    customerId: 'C-NE03-001',
    customerName: 'Synthetic NE03 Store',
    province: 'Bangkok',
    district: 'Bang Kapi',
    phone: '0812345678',
    notes: '',
    address: '',
    group: '',
    salesArea: 'NE03',
    assignedSalesUserId: apiUsers.salesNE03.userId,
    assignedSalesUsername: apiUsers.salesNE03.username,
    assignedSalesNameSnapshot: apiUsers.salesNE03.displayName,
    sellsWeber: 'TRUE',
    sellsGyproc: 'FALSE',
    active: 'TRUE',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    updatedBy: apiUsers.salesNE03.userId
  }, overrides);
}

export function makeSalesTarget(overrides = {}) {
  return Object.assign({
    targetId: 'TARGET-GYP-NE03-202607',
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
    currency: 'THB',
    status: 'ACTIVE',
    active: true,
    createdByUserId: apiUsers.adminNE03.userId,
    createdByNameSnapshot: apiUsers.adminNE03.displayName,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedByUserId: apiUsers.adminNE03.userId,
    updatedByNameSnapshot: apiUsers.adminNE03.displayName,
    updatedAt: '2026-07-01T00:00:00.000Z',
    version: 1
  }, overrides);
}
