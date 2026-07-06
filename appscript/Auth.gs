// Authentication helpers.
function hashPassword(password) {
  try {
    const value = String(password || '');
    return value ? Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8).map(function (b) {
      return ('0' + (b & 0xff).toString(16)).slice(-2);
    }).join('') : '';
  } catch (error) {
    logError('hashPassword', error);
    return '';
  }
}

function verifyPassword(inputPassword, storedPassword) {
  try {
    const inputHash = hashPassword(inputPassword);
    const storedHash = String(storedPassword || '');
    return inputHash && storedHash ? inputHash === storedHash : false;
  } catch (error) {
    logError('verifyPassword', error);
    return false;
  }
}

function createSession(user) {
  try {
    const token = 'sess-' + Utilities.getUuid();
    return success({ sessionToken: token, user: sanitizeUser(user) });
  } catch (error) {
    logError('createSession', error);
    return fail('Unable to create session');
  }
}

function loginUserCore(username, password) {
  try {
    const normalizedUsername = String(username || '').trim();
    const normalizedPassword = String(password || '').trim();
    const usernameCheck = validateUsername(normalizedUsername);
    const passwordCheck = validatePassword(normalizedPassword);
    if (!usernameCheck.ok || !passwordCheck.ok) {
      return validationError('Invalid login payload', [usernameCheck, passwordCheck]);
    }
    const usersResult = getSheetData(getUsersSheetName());
    if (!usersResult.ok) {
      return usersResult;
    }
    const users = usersResult.data || [];
    const user = users.find(function (item) {
      return String(item.username || '').toLowerCase() === normalizedUsername.toLowerCase();
    });
    if (!user) {
      return fail('User not found');
    }
    const storedPassword = String(user.password || '');
    const plainPasswordMatch = storedPassword === normalizedPassword;
    const hashedPasswordMatch = verifyPassword(normalizedPassword, storedPassword);
    const canUseLegacyPlainPassword = isDevelopmentEnvironment() && plainPasswordMatch;
    if (!hashedPasswordMatch && !canUseLegacyPlainPassword) {
      logWarning('loginUser', 'Invalid credentials for ' + normalizedUsername);
      return fail('Invalid credentials');
    }
    if (String(user.active || '').toLowerCase() !== 'true' && String(user.active || '').toLowerCase() !== 'yes' && String(user.active || '') !== '1') {
      return fail('User is inactive');
    }
    const session = createSession(user);
    if (!session.ok) {
      return session;
    }
    logActivity(user.userId || '', 'loginUser', 'successful login');
    return success(session.data);
  } catch (error) {
    logError('loginUser', error);
    return fail(error && error.message ? error.message : 'Login failed');
  }
}

function demoLoginCore() {
  try {
    if (!canUseDemoLogin()) {
      return fail('Demo Login is disabled in production');
    }
    const demoUser = {
      userId: 'demo-user',
      username: 'demo',
      password: hashPassword('demo'),
      displayName: 'Demo User',
      role: USER_ROLES.SALES,
      phone: '',
      email: '',
      photoUrl: '',
      active: 'true',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const existing = getSheetData(getUsersSheetName());
    if (existing.ok && Array.isArray(existing.data) && existing.data.some(function (item) {
      return String(item.username || '').toLowerCase() === 'demo';
    })) {
      logInfo('demoLogin', 'demo user already present');
      return success({ userId: demoUser.userId, username: demoUser.username, displayName: demoUser.displayName, role: demoUser.role });
    }
    const insertResult = appendRow(getUsersSheetName(), demoUser);
    if (!insertResult.ok) {
      return insertResult;
    }
    logInfo('demoLogin', 'created demo user');
    return success({ userId: demoUser.userId, username: demoUser.username, displayName: demoUser.displayName, role: demoUser.role });
  } catch (error) {
    logError('demoLogin', error);
    return fail(error && error.message ? error.message : 'Demo login failed');
  }
}

function logoutUser(sessionToken) {
  try {
    return success({ sessionToken: sessionToken || '' }, 'Logged out');
  } catch (error) {
    logError('logoutUser', error);
    return fail('Logout failed');
  }
}

function getSession(sessionToken) {
  try {
    return sessionToken ? success({ sessionToken: sessionToken }) : fail('Session not found');
  } catch (error) {
    logError('getSession', error);
    return fail('Session lookup failed');
  }
}

function isAuthenticated(sessionToken) {
  return Boolean(sessionToken);
}

function loginUser(username, password) {
  return loginUserCore(username, password);
}

function demoLogin() {
  return demoLoginCore();
}
