function api(action, payload) {
  try {
    const normalizedAction = String(action || '').trim();
    switch (normalizedAction) {
      case 'login':
        return authorizeAction(loginUser, [payload && payload.username, payload && payload.password]);
      case 'demoLogin':
        return authorizeAction(demoLogin, []);
      case 'register':
        return authorizeAction(registerUser, [payload]);
      case 'resetPassword':
        return authorizeAction(resetPassword, [payload && payload.phone, payload && payload.username, payload && payload.newPassword]);
      case 'updateProfile':
        return authorizeAction(updateProfile, [payload]);
      case 'customers':
      case 'getCustomers':
        return authorizeAction(getCustomers, []);
      case 'customer':
        return authorizeAction(getCustomer, [payload && payload.customerId]);
      case 'searchCustomers':
        return authorizeAction(searchCustomers, [payload && payload.keyword]);
      case 'products':
      case 'getProducts':
        return authorizeAction(getProducts, []);
      case 'product':
        return authorizeAction(getProduct, [payload && payload.productId]);
      case 'discount':
        return authorizeAction(getDiscount, [payload && payload.customerId, payload && payload.groupCode]);
      case 'saveCustomer':
        return authorizeAction(saveCustomer, [payload]);
      case 'saveProduct':
        return authorizeAction(saveProduct, [payload]);
      case 'savePromotion':
        return authorizeAction(savePromotion, [payload]);
      case 'updateSettings':
        return authorizeAction(updateSettings, [payload]);
      case 'createQuotation':
        return authorizeAction(createQuotation, [payload]);
      case 'loadQuotation':
        return authorizeAction(loadQuotation, [payload]);
      case 'duplicateQuotation':
        return authorizeAction(duplicateQuotation, [payload]);
      case 'cancelQuotation':
        return authorizeAction(cancelQuotation, [payload]);
      case 'getQuotationHistory':
        return authorizeAction(getQuotationHistory, [payload]);
      case 'quotation':
        return authorizeAction(saveQuotation, [payload]);
      case 'bootstrap':
        return authorizeAction(getBootstrapData, []);
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
