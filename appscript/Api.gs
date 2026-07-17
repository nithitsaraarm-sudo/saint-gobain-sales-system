function api(action, payload) {
  try {
    const normalizedAction = String(action || '').trim();
    const publicActions = ['login', 'demoLogin', 'register', 'getPublicSystemSettings'];
    const auth = publicActions.indexOf(normalizedAction) >= 0 ? null : requireApiUser(payload);
    const user = auth && auth.ok ? auth.data : null;
    const permissions = user ? getUserPermissions(user) : {};
    if (auth && !auth.ok && normalizedAction !== 'bootstrap') {
      return auth;
    }
    if (user && user.mustChangePassword && ['bootstrap', 'changePassword', 'logout'].indexOf(normalizedAction) < 0) {
      return forbidden('กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานต่อ');
    }
    switch (normalizedAction) {
      case 'login':
        return authorizeAction(loginUser, [payload && payload.username, payload && payload.password]);
      case 'getPublicSystemSettings':
        return authorizeAction(getPublicSystemSettings, []);
      case 'demoLogin':
        return authorizeAction(demoLogin, []);
      case 'logout':
        return authorizeAction(logoutUser, [payload && (payload.sessionToken || payload.sg_token || payload.token)]);
      case 'changePassword':
        return authorizeAction(changePassword, [payload]);
      case 'createUser':
        return authorizeAction(createUser, [payload]);
      case 'updateUser':
        return authorizeAction(updateUser, [payload]);
      case 'loadUsers':
        return authorizeAction(loadUsers, [payload]);
      case 'register':
        return forbidden('Self registration is disabled');
      case 'resetPassword':
        return fail('Forgot password is not available yet');
      case 'updateProfile':
        return authorizeAction(updateProfile, [payload]);
      case 'uploadProfileImage':
        return authorizeAction(uploadProfileImage, [payload]);
      case 'customers':
      case 'getCustomers':
        if (!hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SALES, USER_ROLES.VIEWER])) return forbidden('Insufficient permission');
        if (!payload || typeof payload !== 'object') payload = {};
        payload.currentUser = user;
        return authorizeAction(getCustomers, [payload]);
      case 'customer':
        if (!hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SALES, USER_ROLES.VIEWER])) return forbidden('Insufficient permission');
        if (!payload || typeof payload !== 'object') payload = { value: payload };
        payload.currentUser = user;
        return authorizeAction(getCustomer, [payload && (payload.customerId || payload.value), payload]);
      case 'searchCustomers':
        if (!hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SALES, USER_ROLES.VIEWER])) return forbidden('Insufficient permission');
        if (!payload || typeof payload !== 'object') payload = { keyword: payload };
        payload.currentUser = user;
        return authorizeAction(searchCustomers, [payload && typeof payload === 'object' ? payload.keyword : payload, payload]);
      case 'getCustomerFilters':
      case 'getAreas':
      case 'getAssignableSalesUsers':
        if (!hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SALES, USER_ROLES.VIEWER])) return forbidden('Insufficient permission');
        if (!payload || typeof payload !== 'object') payload = {};
        payload.currentUser = user;
        return normalizedAction === 'getCustomerFilters'
          ? authorizeAction(getCustomerFilters, [payload])
          : (normalizedAction === 'getAreas' ? authorizeAction(getAreas, [payload]) : authorizeAction(getAssignableSalesUsers, [payload]));
      case 'products':
      case 'getProducts':
        if (!hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SALES])) return forbidden('Insufficient permission');
        return authorizeAction(getProducts, []);
      case 'searchQuoteProducts':
        if (!hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SALES])) return forbidden('Insufficient permission');
        if (payload && typeof payload === 'object') payload.currentUser = user;
        return authorizeAction(searchQuoteProducts, [payload]);
      case 'getProductPreferences':
        if (!hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SALES, USER_ROLES.VIEWER])) return forbidden('Insufficient permission');
        return authorizeAction(getProductPreferences, [payload]);
      case 'addFavoriteProduct':
        if (!permissions.canCreateQuotations) return forbidden('Insufficient permission');
        return authorizeAction(addFavoriteProduct, [payload]);
      case 'removeFavoriteProduct':
        if (!permissions.canCreateQuotations) return forbidden('Insufficient permission');
        return authorizeAction(removeFavoriteProduct, [payload]);
      case 'addPinnedProduct':
        if (!permissions.canCreateQuotations) return forbidden('Insufficient permission');
        return authorizeAction(addPinnedProduct, [payload]);
      case 'removePinnedProduct':
        if (!permissions.canCreateQuotations) return forbidden('Insufficient permission');
        return authorizeAction(removePinnedProduct, [payload]);
      case 'reorderPinnedProducts':
        if (!permissions.canCreateQuotations) return forbidden('Insufficient permission');
        return authorizeAction(reorderPinnedProducts, [payload]);
      case 'product':
        if (!hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SALES])) return forbidden('Insufficient permission');
        return authorizeAction(getProduct, [payload && (payload.productId || payload.value)]);
      case 'discount':
        return authorizeAction(getDiscount, [payload && payload.customerId, payload && payload.groupCode]);
      case 'saveCustomer':
        if (!permissions.canManageCustomers) return forbidden('Insufficient permission');
        if (!payload || typeof payload !== 'object') payload = {};
        payload.currentUser = user;
        return authorizeAction(saveCustomer, [payload]);
      case 'updateCustomer':
        if (!permissions.canManageCustomers) return forbidden('Insufficient permission');
        if (!payload || typeof payload !== 'object') payload = {};
        payload.currentUser = user;
        return authorizeAction(updateCustomer, [payload && payload.customerId, payload]);
      case 'getFavoriteCustomers':
        return authorizeAction(getFavoriteCustomers, [payload]);
      case 'addFavoriteCustomer':
        return authorizeAction(addFavoriteCustomer, [payload]);
      case 'removeFavoriteCustomer':
        return authorizeAction(removeFavoriteCustomer, [payload]);
      case 'reorderFavoriteCustomers':
        return authorizeAction(reorderFavoriteCustomers, [payload]);
      case 'saveProduct':
        if (!permissions.canManageProducts) return forbidden('Insufficient permission');
        return authorizeAction(saveProduct, [payload]);
      case 'savePromotion':
        if (!permissions.canManagePromotions) return forbidden('Insufficient permission');
        return authorizeAction(savePromotion, [payload]);
      case 'updateSettings':
        if (!permissions.canManageSettings) return forbidden('Insufficient permission');
        return authorizeAction(updateSettings, [payload]);
      case 'getSystemIdentitySettings':
        if (!hasRole(user, [USER_ROLES.SUPER_ADMIN])) return getSuperAdminOnlySystemIdentityError_();
        return authorizeAction(getSystemIdentitySettings, [payload]);
      case 'updateSystemIdentitySettings':
        if (!hasRole(user, [USER_ROLES.SUPER_ADMIN])) return getSuperAdminOnlySystemIdentityError_();
        return authorizeAction(updateSystemIdentitySettings, [payload]);
      case 'createQuotation':
        if (!permissions.canCreateQuotations) return forbidden('Insufficient permission');
        if (payload && typeof payload === 'object') payload.currentUser = user;
        return authorizeAction(createQuotation, [payload]);
      case 'loadQuotation':
        if (payload && typeof payload === 'object') payload.currentUser = user;
        return authorizeAction(loadQuotation, [payload]);
      case 'duplicateQuotation':
        if (!permissions.canCreateQuotations) return forbidden('Insufficient permission');
        if (payload && typeof payload === 'object') payload.currentUser = user;
        return authorizeAction(duplicateQuotation, [payload]);
      case 'cancelQuotation':
        if (!permissions.canEditQuotations) return forbidden('Insufficient permission');
        if (payload && typeof payload === 'object') payload.currentUser = user;
        return authorizeAction(cancelQuotation, [payload]);
      case 'getQuotationHistory':
        if (payload && typeof payload === 'object') payload.currentUser = user;
        return authorizeAction(getQuotationHistory, [payload]);
      case 'updateQuotation':
        if (!permissions.canEditQuotations) return forbidden('Insufficient permission');
        if (payload && typeof payload === 'object') payload.currentUser = user;
        return authorizeAction(saveQuotation, [payload]);
      case 'quotation':
      case 'saveQuotation':
        if (!permissions.canCreateQuotations) return forbidden('Insufficient permission');
        if (payload && typeof payload === 'object') payload.currentUser = user;
        return authorizeAction(saveQuotation, [payload]);
      case 'bootstrap':
        return authorizeAction(getBootstrapData, [payload]);
      default:
        return fail('Unsupported API action: ' + normalizedAction);
    }
  } catch (error) {
    logError('api', error);
    return fail(error && error.message ? error.message : 'API request failed');
  }
}

function authorizeAction(fn, args) {
  if (typeof fn !== 'function') {
    return fail('Action not available');
  }
  return fn.apply(null, args);
}
