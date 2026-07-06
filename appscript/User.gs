// User profile and account helpers.
function sanitizeUser(user) {
  if (!user) {
    return null;
  }
  return {
    userId: user.userId || '',
    username: user.username || '',
    displayName: user.displayName || '',
    role: user.role || '',
    phone: user.phone || '',
    email: user.email || '',
    photoUrl: user.photoUrl || '',
    active: user.active || ''
  };
}

function getUserByUsername(username) {
  try {
    const result = getSheetData(getUsersSheetName());
    if (!result.ok) {
      return result;
    }
    const users = result.data || [];
    const user = users.find(function (item) {
      return String(item.username || '').toLowerCase() === String(username || '').toLowerCase();
    });
    return user ? success(sanitizeUser(user)) : fail('User not found');
  } catch (error) {
    logError('getUserByUsername', error);
    return fail('Unable to load user');
  }
}

function getUserById(userId) {
  try {
    const result = getSheetData(getUsersSheetName());
    if (!result.ok) {
      return result;
    }
    const users = result.data || [];
    const user = users.find(function (item) {
      return String(item.userId || '') === String(userId || '');
    });
    return user ? success(sanitizeUser(user)) : fail('User not found');
  } catch (error) {
    logError('getUserById', error);
    return fail('Unable to load user');
  }
}

function registerUserCore(payload) {
  try {
    const body = payload || {};
    const usernameValidation = validateUsername(body.username);
    const passwordValidation = validatePassword(body.password);
    const emailValidation = validateEmail(body.email);
    const phoneValidation = validatePhone(body.phone);
    if (!usernameValidation.ok || !passwordValidation.ok || !emailValidation.ok || !phoneValidation.ok) {
      return validationError('Invalid registration payload', [usernameValidation, passwordValidation, emailValidation, phoneValidation]);
    }
    const existing = getUserByUsername(body.username);
    if (existing.ok) {
      return fail('Username already exists');
    }
    const now = new Date().toISOString();
    const row = {
      userId: 'user-' + new Date().getTime(),
      username: String(body.username || '').trim(),
      password: hashPassword(body.password),
      displayName: String(body.displayName || body.username || ''),
      role: String(body.role || USER_ROLES.SALES).toUpperCase(),
      phone: String(body.phone || ''),
      email: String(body.email || ''),
      photoUrl: String(body.photoUrl || ''),
      active: 'true',
      createdAt: now,
      updatedAt: now
    };
    const insertResult = appendRow(getUsersSheetName(), row);
    if (!insertResult.ok) {
      return insertResult;
    }
    logActivity(row.userId, 'registerUser', 'registered new user');
    return success({ user: sanitizeUser(row) });
  } catch (error) {
    logError('registerUser', error);
    return fail(error && error.message ? error.message : 'Registration failed');
  }
}

function resetPasswordCore(phone, username, newPassword) {
  try {
    const targetPhone = String(phone || '').trim();
    const targetUsername = String(username || '').trim();
    const targetNewPassword = String(newPassword || '').trim();
    const payloadCheck = validatePayload({ phone: targetPhone, username: targetUsername, newPassword: targetNewPassword }, ['phone', 'username', 'newPassword']);
    if (!payloadCheck.ok) {
      return payloadCheck;
    }
    const usersResult = getSheetData(getUsersSheetName());
    if (!usersResult.ok) {
      return usersResult;
    }
    const users = usersResult.data || [];
    const match = users.find(function (item) {
      return String(item.phone || '').trim() === targetPhone && String(item.username || '').trim().toLowerCase() === targetUsername.toLowerCase();
    });
    if (!match) {
      return fail('No matching user found');
    }
    const updateResult = updateRowById(getUsersSheetName(), 'userId', match.userId, { password: hashPassword(targetNewPassword), updatedAt: new Date().toISOString() });
    if (!updateResult.ok) {
      return updateResult;
    }
    logActivity(match.userId, 'resetPassword', 'password reset');
    return success({ userId: match.userId });
  } catch (error) {
    logError('resetPassword', error);
    return fail(error && error.message ? error.message : 'Password reset failed');
  }
}

function updateProfileCore(payload) {
  try {
    const body = payload || {};
    const userId = String(body.userId || '').trim();
    if (!userId) {
      return fail('userId is required');
    }
    const updateObject = {
      displayName: String(body.displayName || ''),
      role: String(body.role || '').toUpperCase(),
      phone: String(body.phone || ''),
      email: String(body.email || ''),
      photoUrl: String(body.photoUrl || ''),
      updatedAt: new Date().toISOString()
    };
    const updateResult = updateRowById(getUsersSheetName(), 'userId', userId, updateObject);
    if (!updateResult.ok) {
      return updateResult;
    }
    logActivity(userId, 'updateProfile', 'profile updated');
    return success({ userId: userId });
  } catch (error) {
    logError('updateProfile', error);
    return fail(error && error.message ? error.message : 'Profile update failed');
  }
}

function registerUser(payload) {
  return registerUserCore(payload);
}

function resetPassword(phone, username, newPassword) {
  return resetPasswordCore(phone, username, newPassword);
}

function updateProfile(payload) {
  return updateProfileCore(payload);
}
