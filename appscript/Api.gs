function api(action, payload) {
  try {
    const normalizedAction = String(action || '').trim();
    const publicActions = ['login', 'demoLogin', 'register', 'resetPassword', 'getPublicSystemSettings'];
    const authStartedAt = Date.now();
    const auth = publicActions.indexOf(normalizedAction) >= 0 ? null : requireApiUser(payload);
    const authMs = Date.now() - authStartedAt;
    const user = auth && auth.ok ? auth.data : null;
    const permissions = user ? getUserPermissions(user) : {};
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      payload._authMs = authMs;
    }
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
      case 'getCustomerFormOptions':
        if (!permissions.canViewCustomerFormOptions) return forbidden('Insufficient permission');
        if (!payload || typeof payload !== 'object') payload = {};
        payload.currentUser = user;
        return normalizedAction === 'getCustomerFilters'
          ? authorizeAction(getCustomerFilters, [payload])
          : (normalizedAction === 'getAreas'
            ? authorizeAction(getAreas, [payload])
            : authorizeAction(getCustomerFormOptions, [payload]));
      case 'getAssignableSalesUsers':
        if (!permissions.canViewCustomerAssignmentOptions) return forbidden('Insufficient permission');
        if (!payload || typeof payload !== 'object') payload = {};
        payload.currentUser = user;
        return authorizeAction(getAssignableSalesUsers, [payload]);
      case 'products':
      case 'getProducts':
        if (!permissions.canViewProducts) return forbidden('Insufficient permission');
        return authorizeAction(getProducts, []);
      case 'getProductPromotions':
      case 'getPromotionDashboard':
        if (!permissions.canViewPromotions || !permissions.canViewProducts) return forbidden('Insufficient permission');
        if (!payload || typeof payload !== 'object') payload = {};
        payload.currentUser = user;
        return authorizeAction(getProductPromotions, [payload]);
      case 'promotions':
      case 'getPromotions':
        if (!permissions.canViewPromotions) return forbidden('Insufficient permission');
        if (!payload || typeof payload !== 'object') payload = {};
        payload.currentUser = user;
        return authorizeAction(getPromotions, [payload]);
      case 'searchQuoteProducts':
        if (!permissions.canCreateQuotations) return forbidden('Insufficient permission');
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
        if (!permissions.canViewProducts) return forbidden('Insufficient permission');
        return authorizeAction(getProduct, [payload && (payload.productId || payload.value)]);
      case 'discount': {
        const discountScope = validateDiscountCustomerScope_(payload, user);
        if (!discountScope.ok) return discountScope;
        return authorizeAction(getDiscount, [payload && payload.customerId, payload && payload.groupCode]);
      }
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
        if (!payload || typeof payload !== 'object') payload = {};
        payload.currentUser = user;
        payload._authMs = authMs;
        return authorizeAction(getFavoriteCustomers, [payload]);
      case 'addFavoriteCustomer':
        return authorizeAction(addFavoriteCustomer, [payload]);
      case 'removeFavoriteCustomer':
        return authorizeAction(removeFavoriteCustomer, [payload]);
      case 'reorderFavoriteCustomers':
        return authorizeAction(reorderFavoriteCustomers, [payload]);
      case 'getCustomerAgreements':
      case 'getAgreementDetail':
      case 'getAgreementEntries':
        if (!hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SALES, USER_ROLES.VIEWER])) return forbidden('Insufficient permission');
        if (!payload || typeof payload !== 'object') payload = {};
        payload.currentUser = user;
        if (normalizedAction === 'getCustomerAgreements') return authorizeAction(getCustomerAgreements, [payload]);
        if (normalizedAction === 'getAgreementDetail') return authorizeAction(getAgreementDetail, [payload]);
        return authorizeAction(getAgreementEntries, [payload]);
      case 'createCustomerAgreement':
      case 'updateCustomerAgreement':
      case 'closeCustomerAgreement':
      case 'archiveCustomerAgreement':
      case 'createAgreementEntry':
      case 'updateAgreementEntry':
      case 'deactivateAgreementEntry':
      case 'uploadAgreementAttachment':
      case 'deleteAgreementAttachment':
        if (!hasRole(user, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.SALES])) return forbidden('Insufficient permission');
        if (!payload || typeof payload !== 'object') payload = {};
        payload.currentUser = user;
        if (normalizedAction === 'createCustomerAgreement') return authorizeAction(createCustomerAgreement, [payload]);
        if (normalizedAction === 'updateCustomerAgreement') return authorizeAction(updateCustomerAgreement, [payload]);
        if (normalizedAction === 'closeCustomerAgreement') return authorizeAction(closeCustomerAgreement, [payload]);
        if (normalizedAction === 'archiveCustomerAgreement') return authorizeAction(archiveCustomerAgreement, [payload]);
        if (normalizedAction === 'createAgreementEntry') return authorizeAction(createAgreementEntry, [payload]);
        if (normalizedAction === 'updateAgreementEntry') return authorizeAction(updateAgreementEntry, [payload]);
        if (normalizedAction === 'deactivateAgreementEntry') return authorizeAction(deactivateAgreementEntry, [payload]);
        if (normalizedAction === 'uploadAgreementAttachment') return authorizeAction(uploadAgreementAttachment, [payload]);
        return authorizeAction(deleteAgreementAttachment, [payload]);
      case 'saveProduct':
        if (!permissions.canManageProducts) return forbidden('Insufficient permission');
        return authorizeAction(saveProduct, [payload]);
      case 'savePromotion':
        if (!permissions.canManagePromotions) return forbidden('Insufficient permission');
        if (!payload || typeof payload !== 'object') payload = {};
        payload.currentUser = user;
        return authorizeAction(savePromotion, [payload]);
      case 'updateSettings':
        if (!permissions.canManageSettings) return forbidden('Insufficient permission');
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) payload = {};
        payload.currentUser = user;
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
        if (!permissions.canViewQuotations) return forbidden('Insufficient permission');
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
        if (!permissions.canViewQuotations) return forbidden('Insufficient permission');
        if (payload && typeof payload === 'object') payload.currentUser = user;
        return authorizeAction(getQuotationHistory, [payload]);
      case 'getSalesTargets':
      case 'getSalesTarget':
      case 'getEffectiveSalesTarget':
      case 'getSalesTargetFormOptions':
      case 'getSalesTargetManagementData':
      case 'saveSalesTarget':
      case 'updateSalesTarget':
      case 'setSalesTargetStatus':
        if (typeof dispatchSalesTargetAction_ !== 'function') return fail('Action not available');
        return authorizeAction(dispatchSalesTargetAction_, [normalizedAction, payload]);
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
        if (auth && !auth.ok) return auth;
        return authorizeAction(getBootstrapDataForAuthenticatedUser_, [payload, user]);
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

function validateDiscountCustomerScope_(payload, user) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const customerId = String(data.customerId || '').trim();
  if (!customerId) {
    return validationError('customerId is required');
  }
  const customerResult = getCustomer(customerId, { currentUser: user });
  if (!customerResult.ok) {
    return customerResult;
  }
  return success(true);
}
