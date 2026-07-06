function logInfo(action, detail) {
  try {
    logActivity('', action, detail);
    return success(null, 'logged');
  } catch (error) {
    console.log('[INFO] ' + action + ': ' + error);
    return fail('Logger failed', RESPONSE_CODES.ERROR, error && error.message ? error.message : error);
  }
}

function logWarning(action, detail) {
  try {
    logActivity('', action, detail);
    return success(null, 'warning logged');
  } catch (error) {
    console.warn('[WARN] ' + action + ': ' + error);
    return fail('Logger failed', RESPONSE_CODES.ERROR, error && error.message ? error.message : error);
  }
}

function logError(action, error) {
  try {
    logActivity('', action, error && error.message ? error.message : error);
    return fail('Error logged', RESPONSE_CODES.ERROR, error && error.message ? error.message : error);
  } catch (err) {
    console.error('[ERROR] ' + action + ': ' + err);
    return fail('Logger failed', RESPONSE_CODES.ERROR, err && err.message ? err.message : err);
  }
}

function logActivity(userId, action, detail) {
  try {
    const sheet = getSheet(SHEET_NAMES.SYSTEM_LOGS);
    if (!sheet) {
      console.log('[SYSLOG] ' + userId + ' | ' + action + ' | ' + detail);
      return success(null, 'logged to console');
    }
    const row = {
      userId: userId || '',
      action: action || '',
      detail: detail || '',
      createdAt: new Date().toISOString()
    };
    appendRow(SHEET_NAMES.SYSTEM_LOGS, row);
    return success(null, 'logged');
  } catch (error) {
    console.log('[SYSLOG] ' + userId + ' | ' + action + ' | ' + error);
    return fail('Activity log failed', RESPONSE_CODES.ERROR, error && error.message ? error.message : error);
  }
}
