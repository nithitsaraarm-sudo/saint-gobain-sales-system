// Authentication helpers.
const SESSION_TTL_SECONDS = 21600;
const LOGIN_LOCK_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_SECONDS = 900;

function hashPassword(password, salt) {
  try {
    const value = String(password || '');
    const saltValue = String(salt || '');
    const input = saltValue ? saltValue + ':' + value : value;
    return value ? Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8).map(function (b) {
      return ('0' + (b & 0xff).toString(16)).slice(-2);
    }).join('') : '';
  } catch (error) {
    logError('hashPassword', error);
    return '';
  }
}

function verifyPassword(inputPassword, storedPassword, salt) {
  try {
    const inputHash = hashPassword(inputPassword, salt);
    const storedHash = String(storedPassword || '').trim();
    return Boolean(inputHash && storedHash && inputHash === storedHash);
  } catch (error) {
    logError('verifyPassword', error);
    return false;
  }
}

function getSessionCacheKey(sessionToken) {
  return 'sg_session:' + String(sessionToken || '').trim();
}

function getLoginAttemptKey(username) {
  return 'sg_login_attempt:' + String(username || '').trim().toLowerCase();
}

function getLoginLockKey(username) {
  return 'sg_login_lock:' + String(username || '').trim().toLowerCase();
}

function getAuthCache() {
  return CacheService.getScriptCache();
}

function getSessionStore() {
  return PropertiesService.getScriptProperties();
}

function createSession(user) {
  try {
    const safeUser = sanitizeUser(user);
    if (!safeUser || !safeUser.userId && !safeUser.username) {
      return fail('Unable to create session');
    }
    const token = 'sess-' + Utilities.getUuid() + '-' + Utilities.getUuid();
    const now = new Date();
    const session = {
      sessionToken: token,
      token: token,
      user: safeUser,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString()
    };
    const json = JSON.stringify(session);
    getAuthCache().put(getSessionCacheKey(token), json, SESSION_TTL_SECONDS);
    getSessionStore().setProperty(getSessionCacheKey(token), json);
    return success(session, 'Login successful');
  } catch (error) {
    logError('createSession', error);
    return fail('Unable to create session');
  }
}

function getSession(sessionToken) {
  try {
    const token = String(sessionToken || '').trim();
    if (!token) return fail('Session not found');
    const key = getSessionCacheKey(token);
    const cache = getAuthCache();
    var cached = cache.get(key);
    var cacheHit = true;
    if (!cached) {
      cacheHit = false;
      cached = getSessionStore().getProperty(key);
    }
    if (!cached) return fail('Session not found');
    const session = JSON.parse(cached);
    const expiresAt = new Date(session.expiresAt || 0);
    const now = new Date().getTime();
    if (!session.user || isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now) {
      logoutUser(token);
      return fail('Session expired');
    }
    if (!cacheHit) {
      const remainingSeconds = Math.max(1, Math.min(Math.floor((expiresAt.getTime() - now) / 1000), SESSION_TTL_SECONDS));
      cache.put(key, cached, remainingSeconds);
    }
    const result = success(session);
    result.cacheHit = cacheHit;
    return result;
  } catch (error) {
    logError('getSession', error);
    return fail('Session lookup failed');
  }
}

function logoutUser(sessionToken) {
  try {
    const token = String(sessionToken || '').trim();
    if (token) {
      getAuthCache().remove(getSessionCacheKey(token));
      getSessionStore().deleteProperty(getSessionCacheKey(token));
    }
    return success({ sessionToken: token }, 'Logged out');
  } catch (error) {
    logError('logoutUser', error);
    return fail('Logout failed');
  }
}

function revokeUserSessions(userId) {
  try {
    const targetUserId = String(userId || '').trim();
    if (!targetUserId) return success({ revoked: 0 });
    const store = getSessionStore();
    const properties = store.getProperties();
    var revoked = 0;
    Object.keys(properties || {}).forEach(function (key) {
      if (key.indexOf('sg_session:') !== 0) return;
      try {
        const session = JSON.parse(properties[key] || '{}');
        const sessionUserId = String(session.user && session.user.userId || '').trim();
        if (sessionUserId === targetUserId) {
          getAuthCache().remove(key);
          store.deleteProperty(key);
          revoked += 1;
        }
      } catch (parseError) {
        logWarning('revokeUserSessions', 'Unable to parse stored session for cleanup');
      }
    });
    return success({ revoked: revoked });
  } catch (error) {
    logError('revokeUserSessions', error);
    return fail('Unable to revoke sessions');
  }
}

function revokeUserSessionsExcept_(userId, activeSessionToken) {
  try {
    const targetUserId = String(userId || '').trim();
    const activeKey = getSessionCacheKey(activeSessionToken);
    if (!targetUserId) return success({ revoked: 0 });
    const store = getSessionStore();
    const properties = store.getProperties();
    var revoked = 0;
    Object.keys(properties || {}).forEach(function (key) {
      if (key.indexOf('sg_session:') !== 0 || key === activeKey) return;
      try {
        const session = JSON.parse(properties[key] || '{}');
        const sessionUserId = String(session.user && session.user.userId || '').trim();
        if (sessionUserId === targetUserId) {
          getAuthCache().remove(key);
          store.deleteProperty(key);
          revoked += 1;
        }
      } catch (parseError) {
        logWarning('revokeUserSessionsExcept_', 'Unable to parse stored session for cleanup');
      }
    });
    return success({ revoked: revoked });
  } catch (error) {
    logError('revokeUserSessionsExcept_', error);
    return fail('Unable to revoke sessions');
  }
}

function isAuthenticated(sessionToken) {
  return getSession(sessionToken).ok;
}

function isLoginLocked(username) {
  return Boolean(getAuthCache().get(getLoginLockKey(username)));
}

function recordFailedLogin(username) {
  const cache = getAuthCache();
  const attemptKey = getLoginAttemptKey(username);
  const attempts = Number(cache.get(attemptKey) || 0) + 1;
  cache.put(attemptKey, String(attempts), LOGIN_LOCK_SECONDS);
  if (attempts >= LOGIN_LOCK_MAX_ATTEMPTS) {
    cache.put(getLoginLockKey(username), 'LOCKED', LOGIN_LOCK_SECONDS);
  }
}

function clearFailedLogin(username) {
  const cache = getAuthCache();
  cache.remove(getLoginAttemptKey(username));
  cache.remove(getLoginLockKey(username));
}

function loginUserCore(username, password) {
  const trace = typeof createBackendPerformanceTrace_ === 'function' ? createBackendPerformanceTrace_('login') : null;
  var outcome = 'ERROR';
  try {
    const normalizedUsername = String(username || '').trim();
    const normalizedPassword = String(password || '').trim();
    if (trace) markBackendPerformanceStep_(trace, 'input_normalized', { usernameLength: normalizedUsername.length });
    if (!normalizedUsername || !normalizedPassword) {
      outcome = 'VALIDATION_ERROR';
      return validationError('กรุณากรอก Username และ Password');
    }
    if (isLoginLocked(normalizedUsername)) {
      outcome = 'LOCKED';
      return forbidden('บัญชีถูกล็อกชั่วคราว กรุณาลองใหม่ภายหลัง');
    }
    if (trace) markBackendPerformanceStep_(trace, 'login_lock_checked');
    const userResult = getUserByUsername(normalizedUsername);
    if (trace) markBackendPerformanceStep_(trace, 'user_lookup_finished', {
      ok: userResult.ok,
      cacheHit: userResult.cacheHit,
      usersReadMs: userResult.usersReadMs,
      spreadsheetOpenMs: userResult.spreadsheetOpenMs
    });
    if (!userResult.ok) {
      recordFailedLogin(normalizedUsername);
      outcome = 'INVALID_CREDENTIALS';
      return fail('Username หรือ Password ไม่ถูกต้อง');
    }
    const user = normalizeUserAccount(userResult.data);
    if (user.status === USER_STATUSES.PENDING) {
      outcome = 'PENDING';
      return fail('บัญชีอยู่ระหว่างรออนุมัติ');
    }
    if (user.status === USER_STATUSES.LOCKED) {
      outcome = 'LOCKED';
      return forbidden('บัญชีนี้ถูกล็อก กรุณาติดต่อผู้ดูแลระบบ');
    }
    if (user.status !== USER_STATUSES.ACTIVE) {
      outcome = 'INACTIVE';
      return fail('บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
    }
    if (trace) markBackendPerformanceStep_(trace, 'user_status_checked', { role: user.role, status: user.status });
    if (!verifyPassword(normalizedPassword, user.passwordHash, user.passwordSalt)) {
      recordFailedLogin(normalizedUsername);
      logWarning('loginUser', 'Invalid credentials for ' + normalizedUsername);
      outcome = 'INVALID_CREDENTIALS';
      return fail('Username หรือ Password ไม่ถูกต้อง');
    }
    if (trace) markBackendPerformanceStep_(trace, 'password_verified');
    clearFailedLogin(normalizedUsername);
    const now = new Date().toISOString();
    const updateResult = updateRowById(getUsersSheetName(), 'userId', user.userId, { lastLogin: now, updatedAt: now });
    if (trace) markBackendPerformanceStep_(trace, 'last_login_updated', { ok: updateResult && updateResult.ok });
    user.lastLogin = now;
    const session = createSession(user);
    if (trace) markBackendPerformanceStep_(trace, 'session_created', { ok: session && session.ok });
    if (!session.ok) {
      outcome = 'SESSION_CREATE_FAILED';
      return session;
    }
    logActivity(user.userId || '', 'loginUser', 'successful login');
    if (trace) markBackendPerformanceStep_(trace, 'audit_logged');
    outcome = 'SUCCESS';
    return success(session.data, 'Login successful');
  } catch (error) {
    logError('loginUser', error);
    return fail('ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง');
  } finally {
    if (trace) endBackendPerformanceTrace_(trace, outcome);
  }
}

function loginUser(username, password) {
  return loginUserCore(username, password);
}

function demoLoginCore() {
  return fail('Demo Login is disabled');
}

function demoLogin() {
  return demoLoginCore();
}
