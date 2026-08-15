function redactLogSecret_(value) {
  const text = String(value === undefined || value === null ? '' : value);
  return text
    .replace(/("(?:password|currentPassword|newPassword|confirmPassword|sessionToken|sg_token|token|authorization)"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
    .replace(/((?:password|currentPassword|newPassword|confirmPassword|sessionToken|sg_token|token|authorization)=)[^&;\s"']+/gi, '$1[REDACTED]');
}

function logInfo(action, detail) {
  try {
    logActivity('', action, redactLogSecret_(detail));
    return success(null, 'logged');
  } catch (error) {
    const safeError = redactLogSecret_(error && error.message ? error.message : error);
    console.log('[INFO] ' + action + ': ' + safeError);
    return fail('Logger failed', RESPONSE_CODES.ERROR, safeError);
  }
}

function logWarning(action, detail) {
  try {
    logActivity('', action, redactLogSecret_(detail));
    return success(null, 'warning logged');
  } catch (error) {
    const safeError = redactLogSecret_(error && error.message ? error.message : error);
    console.warn('[WARN] ' + action + ': ' + safeError);
    return fail('Logger failed', RESPONSE_CODES.ERROR, safeError);
  }
}

function logError(action, error) {
  try {
    const safeError = redactLogSecret_(error && error.message ? error.message : error);
    console.error('[ERROR] ' + action + ': ' + safeError);
    return fail('Error logged', RESPONSE_CODES.ERROR, safeError);
  } catch (err) {
    const safeLoggerError = redactLogSecret_(err && err.message ? err.message : err);
    console.error('[ERROR] ' + action + ': ' + safeLoggerError);
    return fail('Logger failed', RESPONSE_CODES.ERROR, safeLoggerError);
  }
}

function logActivity(userId, action, detail) {
  try {
    const safeDetail = redactLogSecret_(detail);
    console.log('[SYSLOG] ' + userId + ' | ' + action + ' | ' + safeDetail);
    const row = {
      userId: userId || '',
      action: action || '',
      detail: safeDetail || '',
      createdAt: new Date().toISOString()
    };
    appendRow(SHEET_NAMES.SYSTEM_LOGS, row);
    return success(null, 'logged');
  } catch (error) {
    const safeError = redactLogSecret_(error && error.message ? error.message : error);
    console.log('[SYSLOG] ' + userId + ' | ' + action + ' | ' + safeError);
    return fail('Activity log failed', RESPONSE_CODES.ERROR, safeError);
  }
}
