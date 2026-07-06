function requireValue(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return validationError(fieldName + ' is required');
  }
  return success(value);
}

function validateEmail(email) {
  if (!email) {
    return success(true);
  }
  const re = /^([^\s@]+)@([^\s@]+)\.([^\s@]+)$/;
  return re.test(String(email)) ? success(true) : validationError('Invalid email format');
}

function validatePhone(phone) {
  if (!phone) {
    return success(true);
  }
  return String(phone).replace(/\D/g, '').length >= 8 ? success(true) : validationError('Invalid phone format');
}

function validateUsername(username) {
  const value = String(username || '').trim();
  if (value.length < 3) {
    return validationError('Username must be at least 3 characters');
  }
  return success(value);
}

function validatePassword(password) {
  const value = String(password || '').trim();
  if (value.length < 4) {
    return validationError('Password must be at least 4 characters');
  }
  return success(value);
}

function validatePayload(payload, requiredFields) {
  const data = payload || {};
  for (var i = 0; i < requiredFields.length; i++) {
    const field = requiredFields[i];
    const check = requireValue(data[field], field);
    if (!check.ok) {
      return check;
    }
  }
  return success(data);
}
