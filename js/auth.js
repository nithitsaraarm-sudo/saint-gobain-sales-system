function showLoginTab(t) {
  ['login', 'register', 'reset'].forEach(function (x) {
    const panel = document.getElementById(x + 'Panel');
    if (panel) panel.classList.toggle('hidden', x !== t);
    const btn = document.getElementById('tab' + cap(x));
    if (btn) btn.classList.toggle('active', x === t);
  });
}

function cap(s) {
  return String(s || '')[0].toUpperCase() + String(s || '').slice(1);
}

function toastMessage(message) {
  if (typeof toast === 'function') {
    toast(message);
  } else {
    alert(message);
  }
}

function saveSession(user, sessionToken) {
  try {
    ['sg_bootstrap_cache', 'sg_quotation_history_cache', 'sg_quotation_cache'].forEach(function (key) {
      localStorage.removeItem(key);
    });
  } catch (error) {}
  if (user) {
    const normalizedUser = Object.assign({}, user, {
      displayName: user.displayName || user.fullName || user.username || '',
      fullName: user.fullName || user.displayName || user.username || '',
      role: user.role || 'Sales'
    });
    localStorage.setItem('sg_user', JSON.stringify(normalizedUser));
    localStorage.setItem('sg_role', String(normalizedUser.role || ''));
    localStorage.setItem('sg_userId', String(normalizedUser.userId || ''));
    localStorage.setItem('currentUser', JSON.stringify(normalizedUser));
  }
  if (sessionToken) {
    localStorage.setItem('sg_token', String(sessionToken));
    localStorage.setItem('sessionToken', String(sessionToken));
  }
}

function clearSession() {
  localStorage.removeItem('sg_user');
  localStorage.removeItem('sg_token');
  localStorage.removeItem('sg_role');
  localStorage.removeItem('sg_userId');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('sessionToken');
  USER = null;
}

function getCurrentUser() {
  try {
    const stored = localStorage.getItem('sg_user') || localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    return null;
  }
}

function getSessionToken() {
  return localStorage.getItem('sg_token') || localStorage.getItem('sessionToken') || '';
}

function isLoggedIn() {
  return Boolean(getCurrentUser());
}

function extractAuthData(response) {
  const data = response && response.data ? response.data : {};
  const user = data.user || data;
  const sessionToken = response?.sessionToken || data.sessionToken || user.sessionToken || '';
  return { user: user || {}, sessionToken: sessionToken };
}

async function loadBootstrap() {
  try {
    if (typeof loadData === 'function') {
      return loadData();
    }
    const response = await callApi('bootstrap', {});
    if (!response.ok) {
      toastMessage(response.message || 'โหลดข้อมูลไม่สำเร็จ');
      return response;
    }
    if (response.data) {
      DB = typeof normalizeDb === 'function' ? normalizeDb(response.data) : response.data;
    }
    if (typeof renderAll === 'function') {
      renderAll();
    }
    return response;
  } catch (error) {
    console.error(error);
    toastMessage('เข้าสู่ระบบไม่สำเร็จ');
    return { ok: false, message: String(error && error.message ? error.message : 'API error') };
  }
}

async function login() {
  try {
    const username = document.getElementById('loginUsername') ? document.getElementById('loginUsername').value : '';
    const password = document.getElementById('loginPassword') ? document.getElementById('loginPassword').value : '';
    const remember = document.getElementById('rememberLogin') ? document.getElementById('rememberLogin').checked : false;
    if (!String(username || '').trim() || !String(password || '').trim()) {
      toastMessage('กรุณากรอก Email/Username และ Password');
      return { ok: false, message: 'username and password are required' };
    }
    const response = await callApi('login', { username: username, password: password });
    if (!response.ok) {
      toastMessage(response.message || 'เข้าสู่ระบบไม่สำเร็จ');
      return response;
    }
    const auth = extractAuthData(response);
    const user = auth.user;
    const sessionToken = auth.sessionToken;
    saveSession(user, sessionToken);
    localStorage.setItem('rememberLogin', remember ? 'true' : 'false');
    if (remember) localStorage.setItem('rememberUsername', String(username || '').trim());
    else localStorage.removeItem('rememberUsername');
    USER = user;
    showApp();
    await loadBootstrap();
    if (user && user.mustChangePassword) {
      toastMessage('กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานต่อ');
      if (typeof go === 'function') go('settings');
      if (typeof openSettingPage === 'function') openSettingPage('password');
    }
    return response;
  } catch (error) {
    console.error(error);
    toastMessage('เข้าสู่ระบบไม่สำเร็จ');
    return { ok: false, message: String(error && error.message ? error.message : 'API error') };
  }
}

async function startTestMode() {
  try {
    const response = await callApi('demoLogin', {});
    if (!response.ok) {
      toastMessage(response.message || 'เข้าสู่ระบบไม่สำเร็จ');
      return response;
    }
    const auth = extractAuthData(response);
    const user = auth.user;
    const sessionToken = auth.sessionToken;
    saveSession(user, sessionToken);
    USER = user;
    showApp();
    await loadBootstrap();
    toastMessage('เข้าสู่โหมดทดลองใช้งานแล้ว');
    return response;
  } catch (error) {
    console.error(error);
    toastMessage('เข้าสู่ระบบไม่สำเร็จ');
    return { ok: false, message: String(error && error.message ? error.message : 'API error') };
  }
}

async function logout() {
  try {
    await callApi('logout', { sessionToken: getSessionToken() });
  } catch (error) {
    console.warn('Logout API failed', error);
  }
  clearSession();
  if (typeof showLoginTab === 'function') {
    showLoginTab('login');
  }
  if (document.getElementById('appView')) {
    document.getElementById('appView').classList.add('hidden');
  }
  if (document.getElementById('loginView')) {
    document.getElementById('loginView').classList.remove('hidden');
  }
  if (typeof applySystemIdentityToUI === 'function') {
    applySystemIdentityToUI();
  }
  if (typeof refreshPublicSystemSettings === 'function') {
    refreshPublicSystemSettings({ silent: true });
  }
}

async function changePassword() {
  try {
    const payload = {
      currentPassword: document.getElementById('currentPassword') ? document.getElementById('currentPassword').value : '',
      newPassword: document.getElementById('newPassword') ? document.getElementById('newPassword').value : '',
      confirmPassword: document.getElementById('confirmPassword') ? document.getElementById('confirmPassword').value : ''
    };
    const response = await callApi('changePassword', payload);
    toastMessage(response.message || (response.ok ? 'เปลี่ยนรหัสผ่านแล้ว' : 'เปลี่ยนรหัสผ่านไม่สำเร็จ'));
    if (response.ok) {
      ['currentPassword', 'newPassword', 'confirmPassword'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      try {
        const user = getCurrentUser() || {};
        user.mustChangePassword = false;
        localStorage.setItem('sg_user', JSON.stringify(user));
        localStorage.setItem('currentUser', JSON.stringify(user));
        USER = user;
      } catch (error) {}
    }
    return response;
  } catch (error) {
    toastMessage('เปลี่ยนรหัสผ่านไม่สำเร็จ');
    return { ok: false, message: String(error && error.message ? error.message : 'API error') };
  }
}

async function legacyRegisterUnused() {
  try {
    const payload = {
      username: document.getElementById('regUsername') ? document.getElementById('regUsername').value : '',
      password: document.getElementById('regPassword') ? document.getElementById('regPassword').value : '',
      displayName: document.getElementById('regDisplay') ? document.getElementById('regDisplay').value : '',
      phone: document.getElementById('regPhone') ? document.getElementById('regPhone').value : '',
      position: document.getElementById('regPosition') ? document.getElementById('regPosition').value : ''
    };
    const response = await callApi('register', payload);
    if (!response.ok) {
      toastMessage(response.message || 'เข้าสู่ระบบไม่สำเร็จ');
      return response;
    }
    const auth = extractAuthData(response);
    const user = auth.user;
    const sessionToken = auth.sessionToken;
    saveSession(user, sessionToken);
    USER = user;
    showApp();
    await loadBootstrap();
    return response;
  } catch (error) {
    console.error(error);
    toastMessage('เข้าสู่ระบบไม่สำเร็จ');
    return { ok: false, message: String(error && error.message ? error.message : 'API error') };
  }
}

async function resetPass() {
  try {
    const payload = {
      phone: document.getElementById('resetPhone') ? document.getElementById('resetPhone').value : '',
      username: document.getElementById('resetUsername') ? document.getElementById('resetUsername').value : '',
      newPassword: document.getElementById('resetPassword') ? document.getElementById('resetPassword').value : ''
    };
    const response = await callApi('resetPassword', payload);
    toastMessage(response.message || (response.ok ? 'สำเร็จ' : 'ไม่สำเร็จ'));
    if (response.ok && typeof showLoginTab === 'function') {
      showLoginTab('login');
    }
    return response;
  } catch (error) {
    toastMessage('เข้าสู่ระบบไม่สำเร็จ');
    return { ok: false, message: String(error && error.message ? error.message : 'API error') };
  }
}

async function updateProfile(payload) {
  try {
    const response = await callApi('updateProfile', payload);
    if (!response.ok) {
      toastMessage(response.message || 'บันทึกโปรไฟล์ไม่สำเร็จ');
      return response;
    }
    return response;
  } catch (error) {
    toastMessage('เข้าสู่ระบบไม่สำเร็จ');
    return { ok: false, message: String(error && error.message ? error.message : 'API error') };
  }
}

let registerRequestRunning = false;

function readInputValue(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

function setRegisterLoading(isLoading) {
  const button = document.getElementById('registerButton');
  if (!button) return;
  button.disabled = Boolean(isLoading);
  button.textContent = isLoading ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชี';
}

function validateRegisterPayload(payload) {
  if (!payload.fullName) return 'กรุณากรอกชื่อ-นามสกุล';
  if (!payload.username) return 'กรุณากรอก Username';
  if (!payload.password) return 'กรุณากรอก Password';
  if (payload.password.length < 6) return 'Password ต้องมีอย่างน้อย 6 ตัวอักษร';
  if (!payload.confirmPassword) return 'กรุณายืนยัน Password';
  if (payload.password !== payload.confirmPassword) return 'Password และ Confirm Password ไม่ตรงกัน';
  return '';
}

async function register(event) {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  if (registerRequestRunning) {
    return { ok: false, message: 'Registration is already running' };
  }
  try {
    const payload = {
      fullName: readInputValue('regDisplay'),
      displayName: readInputValue('regDisplay'),
      username: readInputValue('regUsername'),
      password: readInputValue('regPassword'),
      confirmPassword: readInputValue('regConfirmPassword'),
      phone: readInputValue('regPhone'),
      position: readInputValue('regPosition')
    };
    const validationMessage = validateRegisterPayload(payload);
    if (validationMessage) {
      toastMessage(validationMessage);
      return { ok: false, message: validationMessage };
    }
    registerRequestRunning = true;
    setRegisterLoading(true);
    const response = await callApi('register', payload);
    if (!response.ok) {
      toastMessage(response.message || 'สร้างบัญชีไม่สำเร็จ');
      return response;
    }
    ['regUsername', 'regDisplay', 'regPhone', 'regPassword', 'regConfirmPassword'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    toastMessage(response.message || 'สร้างบัญชีแล้ว กรุณารอผู้ดูแลอนุมัติ');
    if (typeof showLoginTab === 'function') {
      showLoginTab('login');
    }
    return response;
  } catch (error) {
    console.error(error);
    toastMessage('สร้างบัญชีไม่สำเร็จ');
    return { ok: false, message: String(error && error.message ? error.message : 'API error') };
  } finally {
    registerRequestRunning = false;
    setRegisterLoading(false);
  }
}

window.showLoginTab = showLoginTab;
window.cap = cap;
window.startTestMode = startTestMode;
window.login = login;
window.register = register;
window.resetPass = resetPass;
window.logout = logout;
window.isLoggedIn = isLoggedIn;
window.getCurrentUser = getCurrentUser;
window.getSessionToken = getSessionToken;
window.extractAuthData = extractAuthData;
window.saveSession = saveSession;
window.clearSession = clearSession;
window.loadBootstrap = loadBootstrap;
window.updateProfile = updateProfile;
window.changePassword = changePassword;

document.addEventListener('DOMContentLoaded', function () {
  try {
    const remembered = localStorage.getItem('rememberLogin') === 'true';
    const username = localStorage.getItem('rememberUsername') || '';
    const rememberEl = document.getElementById('rememberLogin');
    const usernameEl = document.getElementById('loginUsername');
    if (rememberEl) rememberEl.checked = remembered;
    if (remembered && usernameEl && username) usernameEl.value = username;
  } catch (error) {}
});
