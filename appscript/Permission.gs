function normalizePermissionRole(role) {
  const value = String(role || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (value === 'SUPERADMIN') return USER_ROLES.SUPER_ADMIN;
  if (value === USER_ROLES.SUPER_ADMIN) return USER_ROLES.SUPER_ADMIN;
  if (value === USER_ROLES.ADMIN) return USER_ROLES.ADMIN;
  if (value === USER_ROLES.MANAGER) return USER_ROLES.MANAGER;
  if (value === USER_ROLES.VIEWER) return USER_ROLES.VIEWER;
  return USER_ROLES.SALES;
}

function hasRole(user, roles) {
  try {
    const role = normalizePermissionRole(user && user.role);
    const allowed = Array.isArray(roles) ? roles : [];
    if (!allowed.length) return false;
    return allowed.some(function (item) {
      return normalizePermissionRole(item) === role;
    });
  } catch (error) {
    return false;
  }
}

function requireRole(user, roles) {
  return hasRole(user, roles) ? success(true) : forbidden('Insufficient permission');
}

function canUseDemoLogin() {
  return false;
}

function canManageUsers(user) {
  return hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN]);
}

function canCreateQuotation(user) {
  return hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SALES]);
}

function canViewDashboard(user) {
  return hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SALES, USER_ROLES.VIEWER]);
}

function getPayloadSessionToken(payload) {
  if (payload && typeof payload === 'object') {
    return String(payload.sessionToken || payload.sg_token || payload.token || '').trim();
  }
  return '';
}

function requireApiUser(payload) {
  try {
    const session = getSession(getPayloadSessionToken(payload));
    if (!session.ok || !session.data || !session.data.user) {
      return forbidden('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }
    const sessionUser = session.data.user || {};
    const userResult = getUserById(sessionUser.userId);
    if (!userResult.ok) {
      return forbidden('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }
    const user = normalizeUserAccount(userResult.data);
    if (user.status !== USER_STATUSES.ACTIVE) {
      return forbidden('บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
    }
    return success(sanitizeUser(user));
  } catch (error) {
    logError('requireApiUser', error);
    return forbidden('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }
}

function requireApiRole(payload, roles) {
  const auth = requireApiUser(payload);
  if (!auth.ok) return auth;
  return hasRole(auth.data, roles) ? auth : forbidden('คุณไม่มีสิทธิ์เข้าถึงเมนูนี้');
}

function getUserPermissions(user) {
  const role = normalizePermissionRole(user && user.role);
  const isSuperAdmin = role === USER_ROLES.SUPER_ADMIN;
  const isAdmin = role === USER_ROLES.ADMIN;
  const isManager = role === USER_ROLES.MANAGER;
  const isSales = role === USER_ROLES.SALES;
  const isViewer = role === USER_ROLES.VIEWER;
  return {
    role: role,
    isSuperAdmin: isSuperAdmin,
    canManageUsers: isSuperAdmin || isAdmin,
    canManageProducts: isSuperAdmin || isAdmin,
    canManageCustomers: isSuperAdmin || isAdmin,
    canManagePromotions: isSuperAdmin || isAdmin,
    canManageSettings: isSuperAdmin,
    canViewLogs: isSuperAdmin || isAdmin,
    canManageQuotations: isSuperAdmin || isAdmin || isSales,
    canCreateQuotations: isSuperAdmin || isAdmin || isManager || isSales,
    canEditQuotations: isSuperAdmin || isAdmin || isSales,
    canViewQuotations: isSuperAdmin || isAdmin || isManager || isSales || isViewer,
    canViewDashboard: isSuperAdmin || isAdmin || isManager || isSales || isViewer
  };
}
