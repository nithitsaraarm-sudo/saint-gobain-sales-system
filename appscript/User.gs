// User profile and account helpers.
function sanitizeUserText(value) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function sanitizeUserInputText(value, maxLength) {
  const text = sanitizeUserText(value).replace(/[<>]/g, '');
  const limit = maxLength || 150;
  return text.length > limit ? text.slice(0, limit) : text;
}

// Phone numbers are identifiers, not quantities. Keep them as text end-to-end.
function normalizePhone(value) {
  const raw = String(value === null || value === undefined ? '' : value).trim();
  const hasInternationalPrefix = raw.charAt(0) === '+';
  const digits = raw.replace(/\D/g, '');
  return (hasInternationalPrefix ? '+' : '') + digits;
}

function formatPhoneForDisplay(value) {
  const phone = normalizePhone(value);
  if (/^0\d{9}$/.test(phone)) return phone.slice(0, 3) + '-' + phone.slice(3, 6) + '-' + phone.slice(6);
  return phone;
}

function buildTelHref(value) {
  const phone = normalizePhone(value);
  return isValidPhone(phone) ? 'tel:' + phone : '';
}

function isValidPhone(value) {
  const phone = normalizePhone(value);
  return /^\+?\d{8,15}$/.test(phone);
}

function normalizeUserRole(role) {
  const value = String(role || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (value === 'SUPERADMIN') return USER_ROLES.SUPER_ADMIN;
  if (value === USER_ROLES.SUPER_ADMIN) return USER_ROLES.SUPER_ADMIN;
  if (value === USER_ROLES.ADMIN) return USER_ROLES.ADMIN;
  if (value === USER_ROLES.MANAGER) return USER_ROLES.MANAGER;
  if (value === USER_ROLES.VIEWER) return USER_ROLES.VIEWER;
  return USER_ROLES.SALES;
}

function getRoleLevel(role) {
  const normalizedRole = normalizeUserRole(role);
  const levels = {};
  levels[USER_ROLES.SUPER_ADMIN] = 50;
  levels[USER_ROLES.ADMIN] = 40;
  levels[USER_ROLES.MANAGER] = 30;
  levels[USER_ROLES.SALES] = 20;
  levels[USER_ROLES.VIEWER] = 10;
  return levels[normalizedRole] || 0;
}

function canManageRole(actorRole, targetRole) {
  const actor = normalizeUserRole(actorRole);
  const target = normalizeUserRole(targetRole);
  if (actor === USER_ROLES.SUPER_ADMIN) return true;
  return getRoleLevel(actor) > getRoleLevel(target);
}

function canCreateRole(actorRole, requestedRole) {
  return canManageRole(actorRole, requestedRole);
}

function normalizeUserStatus(status, active) {
  const value = String(status || active || '').trim().toLowerCase();
  if (!value) return USER_STATUSES.ACTIVE;
  if (value === 'active' || value === 'true' || value === 'yes' || value === '1' || value === 'ใช้งาน') return USER_STATUSES.ACTIVE;
  if (value === 'pending' || value === 'รออนุมัติ') return USER_STATUSES.PENDING;
  if (value === 'locked' || value === 'lock' || value === 'ล็อก') return USER_STATUSES.LOCKED;
  return USER_STATUSES.INACTIVE;
}

function normalizeUserAccount(user) {
  const source = user && typeof user === 'object' ? user : {};
  const fullName = sanitizeUserInputText(source.fullName || source['Full Name'] || source.displayName || source.name || source.username, 150);
  const displayName = sanitizeUserText(source.displayName || fullName || source.username);
  const area = sanitizeUserInputText(source.area || source.Area || source.branch || source.Branch, 80);
  const jobTitle = sanitizeUserText(source.jobTitle || source.position || source.title || area || source.branch);
  const profileImageUrl = sanitizeUserText(source.profileImageUrl || source.photoUrl || source.imageUrl);
  const quoteDisplayName = sanitizeUserInputText(source.quoteDisplayName || fullName || displayName || source.username, 150);
  const status = normalizeUserStatus(source.status, source.active);
  const role = normalizeUserRole(source.role);
  return Object.assign({}, source, {
    userId: sanitizeUserText(source.userId),
    username: sanitizeUserText(source.username),
    passwordHash: sanitizeUserText(source.passwordHash || source.password),
    passwordSalt: sanitizeUserText(source.passwordSalt),
    fullName: fullName,
    displayName: displayName,
    email: sanitizeUserText(source.email),
    phone: normalizePhone(source.phone),
    jobTitle: jobTitle,
    position: jobTitle,
    profileImageUrl: profileImageUrl,
    photoUrl: profileImageUrl,
    quoteDisplayName: quoteDisplayName,
    companyName: sanitizeUserText(source.companyName),
    greetingText: sanitizeUserText(source.greetingText),
    role: role,
    area: area,
    branch: sanitizeUserText(source.branch || area),
    status: status,
    mustChangePassword: normalizeBooleanFlag(source.mustChangePassword),
    createdBy: sanitizeUserText(source.createdBy),
    updatedBy: sanitizeUserText(source.updatedBy),
    failedLoginCount: String(source.failedLoginCount || '0').trim(),
    active: status === USER_STATUSES.ACTIVE ? 'TRUE' : 'FALSE',
    lastLogin: sanitizeUserText(source.lastLogin),
    createdAt: sanitizeUserText(source.createdAt),
    updatedAt: sanitizeUserText(source.updatedAt)
  });
}

function sanitizeUser(user) {
  const item = normalizeUserAccount(user);
  if (!item || !item.userId && !item.username) return null;
  return {
    userId: item.userId,
    username: item.username,
    fullName: item.fullName,
    displayName: item.displayName,
    email: item.email,
    phone: item.phone,
    jobTitle: item.jobTitle,
    position: item.jobTitle,
    profileImageUrl: item.profileImageUrl,
    photoUrl: item.profileImageUrl,
    quoteDisplayName: item.quoteDisplayName,
    companyName: item.companyName,
    greetingText: item.greetingText,
    role: item.role,
    area: item.area,
    branch: item.branch,
    status: item.status,
    mustChangePassword: item.mustChangePassword,
    lastLogin: item.lastLogin
  };
}

function normalizeBooleanFlag(value) {
  const text = String(value || '').trim().toLowerCase();
  return text === 'true' || text === 'yes' || text === '1' || text === 'y';
}

function createPasswordSalt() {
  return Utilities.getUuid() + '-' + Utilities.getUuid();
}

function listUserAccounts() {
  const startedAt = Date.now();
  const result = getSheetData(getUsersSheetName());
  if (!result.ok) return result;
  const users = Array.isArray(result.data) ? result.data.map(normalizeUserAccount) : [];
  const response = success(users);
  response.cacheHit = result.cacheHit;
  response.spreadsheetOpenMs = result.spreadsheetOpenMs;
  response.usersReadMs = Date.now() - startedAt;
  return response;
}

function getUserByUsername(usernameOrEmail) {
  try {
    const result = listUserAccounts();
    if (!result.ok) return result;
    const target = String(usernameOrEmail || '').trim().toLowerCase();
    const user = result.data.find(function (item) {
      return String(item.username || '').trim().toLowerCase() === target || String(item.email || '').trim().toLowerCase() === target;
    });
    return user ? success(user) : fail('User not found');
  } catch (error) {
    logError('getUserByUsername', error);
    return fail('Unable to load user');
  }
}

function getUserById(userId) {
  try {
    const result = listUserAccounts();
    if (!result.ok) return result;
    const target = String(userId || '').trim();
    const user = result.data.find(function (item) {
      return String(item.userId || '').trim() === target;
    });
    return user ? success(user) : fail('User not found');
  } catch (error) {
    logError('getUserById', error);
    return fail('Unable to load user');
  }
}

function generateUserId() {
  const result = listUserAccounts();
  const users = result.ok && Array.isArray(result.data) ? result.data : [];
  var maxNo = 0;
  users.forEach(function (user) {
    const match = String(user.userId || '').match(/^U(\d+)$/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > maxNo) maxNo = n;
    }
  });
  return 'U' + ('000' + (maxNo + 1)).slice(-3);
}

function countActiveSuperAdmins(excludeUserId) {
  const result = listUserAccounts();
  const users = result.ok && Array.isArray(result.data) ? result.data : [];
  const excluded = String(excludeUserId || '').trim();
  return users.filter(function (user) {
    return user.userId !== excluded && user.role === USER_ROLES.SUPER_ADMIN && user.status === USER_STATUSES.ACTIVE;
  }).length;
}

function canActorManageTargetRole(actor, targetRole) {
  return canManageRole(actor && actor.role, targetRole);
}

function canEditUserRole(actorUser, targetUser, requestedRole) {
  const actor = actorUser || {};
  const target = targetUser || {};
  if (String(actor.userId || '').trim() === String(target.userId || '').trim()) {
    return forbidden('Users cannot change their own role or status');
  }
  if (!canManageRole(actor.role, target.role)) {
    return forbidden('CANNOT_MANAGE_HIGHER_ROLE');
  }
  if (!canManageRole(actor.role, requestedRole)) {
    return forbidden('FORBIDDEN_ROLE_ASSIGNMENT');
  }
  return success(true);
}

function validateUserPasswordForCreate(password) {
  const value = String(password || '').trim();
  if (value.length < 6) return validationError('password must be at least 6 characters');
  return success(value);
}

function validateUserFullName(value) {
  const fullName = sanitizeUserInputText(value, 150);
  if (!fullName) return validationError('กรุณากรอกชื่อ-นามสกุล');
  return success(fullName);
}

function validateUserArea(value) {
  const area = sanitizeUserInputText(value, 80);
  if (!area) return validationError('area is required');
  return success(area);
}

function canActorUseArea(actor, area) {
  if (hasRole(actor, [USER_ROLES.SUPER_ADMIN])) return true;
  const actorArea = normalizeString(actor && (actor.area || actor.branch));
  if (!actorArea || actorArea === normalizeString('System')) return true;
  return actorArea === normalizeString(area);
}

function validateActorAreaScope(actor, area) {
  return canActorUseArea(actor, area) ? success(true) : forbidden('AREA_SCOPE_VIOLATION');
}

function validateUserPasswordConfirmation(password, confirmPassword, required) {
  const value = String(password || '').trim();
  const confirm = String(confirmPassword || '').trim();
  if (required || value || confirm) {
    if (!value) return validationError('password is required');
    if (!confirm) return validationError('confirmPassword is required');
    if (value !== confirm) return validationError('PASSWORD_CONFIRM_MISMATCH');
    return validateUserPasswordForCreate(value);
  }
  return success(true);
}

function loadUsers(payload) {
  try {
    const auth = requireApiRole(payload, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN]);
    if (!auth.ok) return auth;
    const result = listUserAccounts();
    if (!result.ok) return result;
    const actor = normalizeUserAccount(auth.data);
    const actorArea = normalizeString(actor.area || actor.branch);
    const users = result.data.filter(function (user) {
      const item = normalizeUserAccount(user);
      if (hasRole(actor, [USER_ROLES.SUPER_ADMIN])) return true;
      if (!canManageRole(actor.role, item.role)) return false;
      if (!actorArea || actorArea === normalizeString('System')) return true;
      return normalizeString(item.area || item.branch) === actorArea;
    });
    return success(users.map(sanitizeUser));
  } catch (error) {
    logError('loadUsers', error);
    return fail(error && error.message ? error.message : 'Failed to load users');
  }
}

function createUser(payload) {
  try {
    migrateUsersSheet();
    const auth = requireApiRole(payload, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN]);
    if (!auth.ok) return auth;
    const actor = auth.data;
    const data = payload && payload.user ? payload.user : payload || {};
    const username = sanitizeUserText(data.username);
    const password = String(data.password || '').trim();
    const role = normalizeUserRole(data.role);
    const status = normalizeUserStatus(data.status);
    if (!username) return validationError('username is required');
    const fullNameCheck = validateUserFullName(data.fullName || data.displayName);
    if (!fullNameCheck.ok) return fullNameCheck;
    const areaCheck = validateUserArea(data.area || data.branch);
    if (!areaCheck.ok) return areaCheck;
    const areaScopeCheck = validateActorAreaScope(actor, areaCheck.data);
    if (!areaScopeCheck.ok) return areaScopeCheck;
    const passwordCheck = validateUserPasswordConfirmation(password, data.confirmPassword, true);
    if (!passwordCheck.ok) return passwordCheck;
    if (!canCreateRole(actor.role, role)) return forbidden('FORBIDDEN_ROLE_ASSIGNMENT');
    const existing = getUserByUsername(username);
    if (existing.ok) return validationError('username already exists');
    const email = sanitizeUserText(data.email);
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) return emailCheck;
    if (email) {
      const existingEmail = getUserByUsername(email);
      if (existingEmail.ok) return validationError('email already exists');
    }
    const phone = normalizePhone(data.phone);
    if (phone && !isValidPhone(phone)) return validationError('Invalid phone format');
    const now = new Date().toISOString();
    const passwordSalt = createPasswordSalt();
    const row = {
      userId: sanitizeUserText(data.userId || generateUserId()),
      username: username,
      passwordHash: hashPassword(password, passwordSalt),
      passwordSalt: passwordSalt,
      fullName: fullNameCheck.data,
      displayName: sanitizeUserText(data.displayName || fullNameCheck.data || username),
      email: email,
      phone: phone,
      jobTitle: sanitizeUserText(data.jobTitle || data.position),
      profileImageUrl: sanitizeUserText(data.profileImageUrl || data.photoUrl),
      photoUrl: sanitizeUserText(data.profileImageUrl || data.photoUrl),
      quoteDisplayName: sanitizeUserInputText(data.quoteDisplayName || fullNameCheck.data, 150),
      companyName: sanitizeUserText(data.companyName),
      greetingText: sanitizeUserText(data.greetingText),
      role: role,
      area: areaCheck.data,
      branch: sanitizeUserText(data.branch || areaCheck.data),
      status: status,
      mustChangePassword: normalizeBooleanFlag(data.mustChangePassword) ? 'TRUE' : 'FALSE',
      createdBy: actor.userId || actor.username || '',
      updatedBy: actor.userId || actor.username || '',
      failedLoginCount: 0,
      lastLogin: '',
      createdAt: now,
      updatedAt: now
    };
    const insertResult = appendRow(getUsersSheetName(), row);
    if (!insertResult.ok) return insertResult;
    if (typeof bumpCustomerFormOptionsCacheVersion_ === 'function') {
      bumpCustomerFormOptionsCacheVersion_();
    }
    logActivity(actor.userId || '', 'USER_CREATED', 'created user ' + row.username + ' as ' + row.role + ' area=' + row.area);
    return success(sanitizeUser(row), 'User created');
  } catch (error) {
    logError('createUser', error);
    return fail(error && error.message ? error.message : 'Failed to create user');
  }
}

function updateUser(payload) {
  try {
    migrateUsersSheet();
    const auth = requireApiRole(payload, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN]);
    if (!auth.ok) return auth;
    const actor = auth.data;
    const data = payload && payload.user ? payload.user : payload || {};
    const userId = sanitizeUserText(data.userId);
    if (!userId) return validationError('userId is required');
    const currentResult = getUserById(userId);
    if (!currentResult.ok) return currentResult;
    const current = normalizeUserAccount(currentResult.data);
    const newRole = normalizeUserRole(data.role || current.role);
    const newStatus = normalizeUserStatus(data.status || current.status);
    const roleCheck = canEditUserRole(actor, current, newRole);
    if (!roleCheck.ok) return roleCheck;
    if (current.role === USER_ROLES.SUPER_ADMIN && (newRole !== USER_ROLES.SUPER_ADMIN || newStatus !== USER_STATUSES.ACTIVE)) {
      if (countActiveSuperAdmins(current.userId) < 1) {
        return forbidden('Cannot disable or demote the last SUPER_ADMIN');
      }
    }
    const fullNameCheck = validateUserFullName(data.fullName || data.displayName || current.fullName);
    if (!fullNameCheck.ok) return fullNameCheck;
    const areaCheck = validateUserArea(data.area || data.branch || current.area || current.branch);
    if (!areaCheck.ok) return areaCheck;
    const currentAreaScopeCheck = validateActorAreaScope(actor, current.area || current.branch);
    if (!currentAreaScopeCheck.ok) return currentAreaScopeCheck;
    const nextAreaScopeCheck = validateActorAreaScope(actor, areaCheck.data);
    if (!nextAreaScopeCheck.ok) return nextAreaScopeCheck;
    const passwordCheck = validateUserPasswordConfirmation(data.password, data.confirmPassword, false);
    if (!passwordCheck.ok) return passwordCheck;
    const previousQuoteDisplayName = sanitizeUserText(current.quoteDisplayName);
    const previousFullName = sanitizeUserText(current.fullName);
    const requestedQuoteDisplayName = sanitizeUserInputText(data.quoteDisplayName, 150);
    const nextQuoteDisplayName = requestedQuoteDisplayName || (!previousQuoteDisplayName || previousQuoteDisplayName === previousFullName ? fullNameCheck.data : previousQuoteDisplayName);
    const email = sanitizeUserText(data.email);
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) return emailCheck;
    if (email && normalizeString(email) !== normalizeString(current.email)) {
      const existingEmail = getUserByUsername(email);
      if (existingEmail.ok && String(existingEmail.data && existingEmail.data.userId || '') !== current.userId) {
        return validationError('email already exists');
      }
    }
    const phone = normalizePhone(data.phone);
    if (phone && !isValidPhone(phone)) return validationError('Invalid phone format');
    const updateObject = {
      fullName: fullNameCheck.data,
      displayName: sanitizeUserText(data.displayName || fullNameCheck.data || current.displayName),
      email: email,
      phone: phone,
      jobTitle: sanitizeUserText(data.jobTitle || data.position || current.jobTitle),
      profileImageUrl: sanitizeUserText(data.profileImageUrl || data.photoUrl || current.profileImageUrl),
      photoUrl: sanitizeUserText(data.profileImageUrl || data.photoUrl || current.profileImageUrl),
      quoteDisplayName: nextQuoteDisplayName,
      companyName: sanitizeUserText(data.companyName || current.companyName),
      greetingText: sanitizeUserText(data.greetingText || current.greetingText),
      role: newRole,
      area: areaCheck.data,
      branch: sanitizeUserText(data.branch || areaCheck.data),
      status: newStatus,
      updatedBy: actor.userId || actor.username || '',
      updatedAt: new Date().toISOString()
    };
    var passwordChanged = false;
    if (data.password !== undefined && String(data.password || '').trim()) {
      const password = String(data.password || '').trim();
      const passwordSalt = createPasswordSalt();
      updateObject.passwordHash = hashPassword(password, passwordSalt);
      updateObject.passwordSalt = passwordSalt;
      updateObject.mustChangePassword = 'TRUE';
      passwordChanged = true;
    }
    const result = updateRowById(getUsersSheetName(), 'userId', userId, updateObject);
    if (!result.ok) return result;
    if (typeof bumpCustomerFormOptionsCacheVersion_ === 'function') {
      bumpCustomerFormOptionsCacheVersion_();
    }
    if ((newStatus !== USER_STATUSES.ACTIVE || passwordChanged) && typeof revokeUserSessions === 'function') {
      revokeUserSessions(userId);
    }
    logActivity(actor.userId || '', 'USER_UPDATED', 'updated user ' + userId + ' role=' + updateObject.role + ' status=' + updateObject.status + ' area=' + updateObject.area);
    if (current.role !== newRole) {
      logActivity(actor.userId || '', 'USER_ROLE_CHANGED', 'user ' + userId + ' role ' + current.role + ' -> ' + newRole);
    }
    if (current.status !== newStatus) {
      logActivity(actor.userId || '', 'USER_STATUS_CHANGED', 'user ' + userId + ' status ' + current.status + ' -> ' + newStatus);
    }
    if (normalizeString(current.area || current.branch) !== normalizeString(areaCheck.data)) {
      logActivity(actor.userId || '', 'USER_AREA_CHANGED', 'user ' + userId + ' area changed to ' + areaCheck.data);
    }
    if (passwordChanged) {
      logActivity(actor.userId || '', 'USER_PASSWORD_RESET', 'password reset for user ' + userId);
    }
    return success(Object.assign({ userId: userId }, updateObject), 'User updated');
  } catch (error) {
    logError('updateUser', error);
    return fail(error && error.message ? error.message : 'Failed to update user');
  }
}

function changePassword(payload) {
  try {
    migrateUsersSheet();
    const auth = requireApiUser(payload);
    if (!auth.ok) return auth;
    const data = payload || {};
    const currentPassword = String(data.currentPassword || '').trim();
    const newPassword = String(data.newPassword || '').trim();
    const confirmPassword = String(data.confirmPassword || '').trim();
    if (newPassword.length < 6) return validationError('new password must be at least 6 characters');
    if (newPassword !== confirmPassword) return validationError('confirm password does not match');
    const userResult = getUserById(auth.data.userId);
    if (!userResult.ok) return userResult;
    const user = normalizeUserAccount(userResult.data);
    if (!verifyPassword(currentPassword, user.passwordHash, user.passwordSalt)) return forbidden('Current password is incorrect');
    const passwordSalt = createPasswordSalt();
    const result = updateRowById(getUsersSheetName(), 'userId', user.userId, {
      passwordHash: hashPassword(newPassword, passwordSalt),
      passwordSalt: passwordSalt,
      mustChangePassword: 'FALSE',
      updatedAt: new Date().toISOString()
    });
    if (!result.ok) return result;
    logActivity(user.userId || '', 'changePassword', 'password changed');
    return success({ userId: user.userId }, 'Password changed');
  } catch (error) {
    logError('changePassword', error);
    return fail(error && error.message ? error.message : 'Failed to change password');
  }
}

function updateProfile(payload) {
  try {
    migrateUsersSheet();
    const auth = requireApiUser(payload);
    if (!auth.ok) return auth;
    const body = payload || {};
    const userId = sanitizeUserText(auth.data.userId);
    if (body.profileImageData) {
      return validationError('profileImageData must be uploaded with uploadProfileImage first');
    }
    if (userId !== String(auth.data.userId || '').trim() && !hasRole(auth.data, [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN])) {
      return forbidden('Cannot update another user profile');
    }
    const hasOwn = function (key) {
      return Object.prototype.hasOwnProperty.call(body, key);
    };
    const displayName = sanitizeUserText(hasOwn('displayName') ? body.displayName : (auth.data.displayName || auth.data.fullName || auth.data.username));
    const jobTitle = sanitizeUserText((hasOwn('jobTitle') || hasOwn('position')) ? (body.jobTitle || body.position) : (auth.data.jobTitle || auth.data.position));
    const profileImageUrl = sanitizeUserText((hasOwn('profileImageUrl') || hasOwn('photoUrl')) ? (body.profileImageUrl || body.photoUrl) : (auth.data.profileImageUrl || auth.data.photoUrl));
    const greetingText = body.greetingText !== undefined
      ? sanitizeUserInputText(body.greetingText, 200)
      : sanitizeUserInputText(auth.data.greetingText, 200);
    const phone = hasOwn('phone') ? normalizePhone(body.phone) : normalizePhone(auth.data.phone);
    if (phone && !isValidPhone(phone)) return validationError('Invalid phone format');
    const updateObject = {
      fullName: displayName,
      displayName: displayName,
      phone: phone,
      jobTitle: jobTitle,
      profileImageUrl: profileImageUrl,
      photoUrl: profileImageUrl,
      quoteDisplayName: sanitizeUserText(hasOwn('quoteDisplayName') ? body.quoteDisplayName : (auth.data.quoteDisplayName || displayName)),
      greetingText: greetingText,
      updatedBy: userId,
      updatedAt: new Date().toISOString()
    };
    const updateResult = updateRowById(getUsersSheetName(), 'userId', userId, updateObject);
    if (!updateResult.ok) return updateResult;
    const refreshed = getUserById(userId);
    return success(refreshed.ok ? sanitizeUser(refreshed.data) : Object.assign({ userId: userId }, updateObject), 'Profile updated');
  } catch (error) {
    logError('updateProfile', error);
    return fail(error && error.message ? error.message : 'Profile update failed');
  }
}

function uploadProfileImage(payload) {
  try {
    const auth = requireApiUser(payload);
    if (!auth.ok) return auth;
    const body = payload || {};
    const imageData = String(body.profileImageData || body.imageData || '').trim();
    if (!imageData) {
      return validationError('profileImageData is required');
    }
    const profileImageUrl = saveProfileImageIfNeeded_(imageData, auth.data.userId);
    return success({ profileImageUrl: profileImageUrl, photoUrl: profileImageUrl }, 'Profile image uploaded');
  } catch (error) {
    logError('uploadProfileImage', error);
    return fail(error && error.message ? error.message : 'Failed to upload profile image');
  }
}

function saveProfileImageIfNeeded_(value, userId) {
  const text = String(value || '').trim();
  if (!text || text.indexOf('data:image/') !== 0) {
    return sanitizeUserText(text);
  }
  const folderId = getScriptProperty('PROFILE_IMAGE_FOLDER_ID', '');
  if (!folderId) {
    throw new Error('PROFILE_IMAGE_FOLDER_ID is required for profile image upload.');
  }
  const match = text.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!match) {
    throw new Error('Unsupported profile image format.');
  }
  const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 2 * 1024 * 1024) {
    throw new Error('Profile image is too large.');
  }
  const folder = DriveApp.getFolderById(folderId);
  const fileName = 'profile-' + sanitizeUserText(userId || 'user') + '-' + new Date().getTime() + '.' + extension;
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (sharingError) {
    logWarning('saveProfileImageIfNeeded_', 'Unable to set sharing: ' + sharingError);
  }
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

function registerUser(payload) {
  return forbidden('Self registration is disabled');
}

function resetPassword(phone, username, newPassword) {
  return forbidden('Forgot password is disabled. Please contact an administrator.');
}

function migrateUsersSheet() {
  try {
    const sheet = ensureSheet(getUsersSheetName(), getDefaultUserHeaders());
    if (!sheet) return fail('Unable to access Users sheet');
    const headers = ensureUserSheetColumns(sheet, getDefaultUserHeaders());
    const phoneMigration = migrateUserPhoneColumn_(sheet, headers);
    return success({ headers: headers, phoneReviewRows: phoneMigration.phoneReviewRows }, 'Users sheet checked');
  } catch (error) {
    logError('migrateUsersSheet', error);
    return fail(error && error.message ? error.message : 'Users migration failed');
  }
}

function migrateUserPhoneColumn_(sheet, headers) {
  const phoneIndex = headers.indexOf('phone');
  const reviewRows = [];
  if (phoneIndex < 0) return { phoneReviewRows: reviewRows };
  const lastRow = sheet.getLastRow();
  const range = sheet.getRange(2, phoneIndex + 1, Math.max(lastRow - 1, 1), 1);
  range.setNumberFormat('@');
  if (lastRow < 2) return { phoneReviewRows: reviewRows };
  const displayed = range.getDisplayValues();
  const normalized = displayed.map(function (row, index) {
    const original = String(row[0] || '').trim();
    const phone = normalizePhone(original);
    if (original && (!isValidPhone(phone) || phone.charAt(0) !== '0' && phone.charAt(0) !== '+')) {
      reviewRows.push(index + 2);
    }
    return [phone];
  });
  range.setValues(normalized);
  return { phoneReviewRows: reviewRows };
}

function ensureUserSheetColumns(sheet, requiredHeaders) {
  const existing = getHeaders(sheet).map(function (header) {
    return String(header || '').trim();
  }).filter(function (header) {
    return header;
  });
  if (!existing.length) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return requiredHeaders.slice();
  }
  var headers = existing.slice();
  var changed = false;
  requiredHeaders.forEach(function (header) {
    if (headers.indexOf(header) < 0) {
      headers.push(header);
      changed = true;
    }
  });
  if (changed) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  migrateUserAreaColumn_(sheet, headers);
  migrateUserFullNameColumn_(sheet, headers);
  return headers;
}

function migrateUserAreaColumn_(sheet, headers) {
  try {
    const areaIndex = headers.indexOf('area');
    const branchIndex = headers.indexOf('branch');
    if (areaIndex < 0 || branchIndex < 0 || sheet.getLastRow() < 2) {
      return;
    }
    const lastRow = sheet.getLastRow();
    const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
    const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
    values.forEach(function (row, index) {
      const area = sanitizeUserText(row[areaIndex]);
      const branch = sanitizeUserText(row[branchIndex]);
      if (!area && branch) {
        sheet.getRange(index + 2, areaIndex + 1).setValue(branch);
      }
    });
  } catch (error) {
    logError('migrateUserAreaColumn_', error);
  }
}

function migrateUserFullNameColumn_(sheet, headers) {
  try {
    const fullNameIndex = headers.indexOf('fullName');
    const displayNameIndex = headers.indexOf('displayName');
    const quoteDisplayNameIndex = headers.indexOf('quoteDisplayName');
    if (fullNameIndex < 0 || sheet.getLastRow() < 2) {
      return;
    }
    const lastRow = sheet.getLastRow();
    const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
    const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
    values.forEach(function (row, index) {
      const fullName = sanitizeUserText(row[fullNameIndex]);
      const displayName = displayNameIndex >= 0 ? sanitizeUserText(row[displayNameIndex]) : '';
      if (!fullName && displayName) {
        sheet.getRange(index + 2, fullNameIndex + 1).setValue(displayName);
        row[fullNameIndex] = displayName;
      }
      if (quoteDisplayNameIndex >= 0 && !sanitizeUserText(row[quoteDisplayNameIndex])) {
        sheet.getRange(index + 2, quoteDisplayNameIndex + 1).setValue(sanitizeUserText(row[fullNameIndex] || displayName));
      }
    });
  } catch (error) {
    logError('migrateUserFullNameColumn_', error);
  }
}

function isInitialSetupCompleted() {
  return String(PropertiesService.getScriptProperties().getProperty('AUTH_INITIAL_SETUP_COMPLETED') || '').trim().toUpperCase() === 'TRUE';
}

function generateSecureTemporaryPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*()-_=+[]{}?';
  const all = upper + lower + digits + special;
  var chars = [
    upper.charAt(Math.floor(Math.random() * upper.length)),
    lower.charAt(Math.floor(Math.random() * lower.length)),
    digits.charAt(Math.floor(Math.random() * digits.length)),
    special.charAt(Math.floor(Math.random() * special.length))
  ];
  const entropy = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  for (var i = 0; chars.length < 16; i++) {
    const code = entropy.charCodeAt(i % entropy.length) + Math.floor(Math.random() * all.length);
    chars.push(all.charAt(code % all.length));
  }
  for (var j = chars.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    const tmp = chars[j];
    chars[j] = chars[k];
    chars[k] = tmp;
  }
  return chars.join('');
}

const INITIAL_SUPER_ADMIN_PROPERTY_KEYS = [
  'PRIMARY_SUPER_ADMIN_EMAIL',
  'PRIMARY_SUPER_ADMIN_USERNAME',
  'PRIMARY_SUPER_ADMIN_DISPLAY_NAME',
  'BACKUP_SUPER_ADMIN_EMAIL',
  'BACKUP_SUPER_ADMIN_USERNAME',
  'BACKUP_SUPER_ADMIN_DISPLAY_NAME'
];

function getRequiredSetupProperty(props, key) {
  const value = sanitizeUserText(props.getProperty(key));
  if (!value) {
    throw new Error('Missing Script Property: ' + key);
  }
  return value;
}

function validateInitialSuperAdminProperties_() {
  const props = PropertiesService.getScriptProperties();
  const configs = [
    {
      label: 'Primary SUPER_ADMIN',
      username: getRequiredSetupProperty(props, 'PRIMARY_SUPER_ADMIN_USERNAME'),
      email: getRequiredSetupProperty(props, 'PRIMARY_SUPER_ADMIN_EMAIL'),
      fullName: getRequiredSetupProperty(props, 'PRIMARY_SUPER_ADMIN_DISPLAY_NAME')
    },
    {
      label: 'Backup SUPER_ADMIN',
      username: getRequiredSetupProperty(props, 'BACKUP_SUPER_ADMIN_USERNAME'),
      email: getRequiredSetupProperty(props, 'BACKUP_SUPER_ADMIN_EMAIL'),
      fullName: getRequiredSetupProperty(props, 'BACKUP_SUPER_ADMIN_DISPLAY_NAME')
    }
  ];

  configs.forEach(function (config) {
    const usernameValidation = validateUsername(config.username);
    const emailValidation = validateEmail(config.email);
    if (!usernameValidation.ok) {
      throw new Error(config.label + ' username is invalid.');
    }
    if (!emailValidation.ok) {
      throw new Error(config.label + ' email is invalid.');
    }
  });

  if (normalizeString(configs[0].username) === normalizeString(configs[1].username)) {
    throw new Error('Primary and Backup usernames must be different.');
  }
  if (normalizeString(configs[0].email) === normalizeString(configs[1].email)) {
    throw new Error('Primary and Backup emails must be different.');
  }
  return configs;
}

function clearInitialSuperAdminProperties_(props) {
  INITIAL_SUPER_ADMIN_PROPERTY_KEYS.forEach(function (key) {
    props.deleteProperty(key);
  });
}

function logInitialSuperAdminPasswords_(createdUsers) {
  Logger.log('');
  Logger.log('Initial authentication setup completed.');
  Logger.log('');
  createdUsers.forEach(function (user) {
    Logger.log(user.label);
    Logger.log('Username: ' + user.username);
    Logger.log('Email: ' + user.email);
    Logger.log('Temporary Password: ' + user.temporaryPassword);
    Logger.log('');
  });
  Logger.log('Both users must change their passwords at first login.');
  Logger.log('Save these passwords securely. They will not be shown again.');
}

function createBootstrapSuperAdmin() {
  var lock = null;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    const props = PropertiesService.getScriptProperties();
    if (isInitialSetupCompleted()) {
      throw new Error('Initial authentication setup has already been completed.');
    }

    migrateUsersSheet();
    const configs = validateInitialSuperAdminProperties_();
    const existingResult = listUserAccounts();
    if (!existingResult.ok) {
      throw new Error(existingResult.message || 'Unable to read Users sheet.');
    }
    const existingUsers = Array.isArray(existingResult.data) ? existingResult.data : [];
    const existingSuperAdmin = existingUsers.some(function (user) {
      return normalizeUserRole(user.role) === USER_ROLES.SUPER_ADMIN;
    });
    if (existingSuperAdmin) {
      throw new Error('SUPER_ADMIN already exists. Initial setup rejected.');
    }

    configs.forEach(function (config) {
      const exists = existingUsers.some(function (user) {
        return normalizeString(user.username) === normalizeString(config.username) || normalizeString(user.email) === normalizeString(config.email);
      });
      if (exists) {
        throw new Error(config.label + ' username or email already exists.');
      }
    });

    const createdUsers = configs.map(function (config) {
      const now = new Date().toISOString();
      const temporaryPassword = generateSecureTemporaryPassword();
      const passwordSalt = createPasswordSalt();
      const row = {
        userId: generateUserId(),
        username: sanitizeUserText(config.username),
        passwordHash: hashPassword(temporaryPassword, passwordSalt),
        passwordSalt: passwordSalt,
        fullName: sanitizeUserText(config.fullName),
        displayName: sanitizeUserText(config.fullName),
        email: sanitizeUserText(config.email),
        phone: '',
        jobTitle: 'SUPER_ADMIN',
        profileImageUrl: '',
        photoUrl: '',
        quoteDisplayName: sanitizeUserText(config.fullName),
        companyName: '',
        greetingText: '',
        role: USER_ROLES.SUPER_ADMIN,
        area: 'System',
        branch: 'System',
        status: USER_STATUSES.ACTIVE,
        mustChangePassword: 'TRUE',
        createdBy: 'SYSTEM_SETUP',
        updatedBy: 'SYSTEM_SETUP',
        failedLoginCount: 0,
        lastLogin: '',
        createdAt: now,
        updatedAt: now
      };
      const result = appendRow(getUsersSheetName(), row);
      if (!result.ok) {
        throw new Error(result.message || 'Failed to create ' + config.label);
      }
      existingUsers.push(normalizeUserAccount(row));
      return {
        label: config.label,
        username: row.username,
        email: row.email,
        temporaryPassword: temporaryPassword
      };
    });

    props.setProperty('AUTH_INITIAL_SETUP_COMPLETED', 'TRUE');
    props.setProperty('AUTH_INITIAL_SETUP_COMPLETED_AT', new Date().toISOString());
    clearInitialSuperAdminProperties_(props);
    logInitialSuperAdminPasswords_(createdUsers);
    return success({ created: createdUsers.length }, 'Initial authentication setup completed');
  } catch (error) {
    Logger.log('[INITIAL_SETUP] ' + (error && error.message ? error.message : error));
    return fail(error && error.message ? error.message : 'Initial setup failed');
  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        Logger.log('[INITIAL_SETUP] Failed to release lock');
      }
    }
  }
}

function setupInitialSuperAdmins() {
  return createBootstrapSuperAdmin();
}

function createInitialSuperAdmins() {
  return createBootstrapSuperAdmin();
}

function setupAuthenticationSystem() {
  try {
    const migration = migrateUsersSheet();
    if (!migration.ok) return migration;
    const superAdmins = createInitialSuperAdmins();
    if (!superAdmins.ok) return superAdmins;
    return success({ migration: migration.data, superAdmins: superAdmins.data }, 'Authentication setup checked');
  } catch (error) {
    logError('setupAuthenticationSystem', error);
    return fail(error && error.message ? error.message : 'Authentication setup failed');
  }
}
