function hasRole(user, roles) {
  try {
    const role = String(user && user.role ? user.role : '').toUpperCase();
    if (!roles || roles.length === 0) {
      return false;
    }
    return roles.some(function (item) {
      return String(item).toUpperCase() === role;
    });
  } catch (error) {
    return false;
  }
}

function requireRole(user, roles) {
  return hasRole(user, roles) ? success(true) : forbidden('Insufficient permission');
}

function canUseDemoLogin() {
  return isDevelopmentEnvironment();
}

function canManageUsers(user) {
  return hasRole(user, [USER_ROLES.ADMIN, USER_ROLES.MANAGER]);
}

function canCreateQuotation(user) {
  return hasRole(user, [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SALES]);
}

function canViewDashboard(user) {
  return hasRole(user, [USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SALES, USER_ROLES.VIEWER]);
}
