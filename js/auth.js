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
  if (user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
  }
  if (sessionToken) {
    localStorage.setItem('sessionToken', String(sessionToken));
  }
}

function clearSession() {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('sessionToken');
  USER = null;
}

function getCurrentUser() {
  try {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    return null;
  }
}

function getSessionToken() {
  return localStorage.getItem('sessionToken') || '';
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
    const response = await callApi('login', { username: username, password: password });
    if (!response.ok) {
      toastMessage(response.message || 'เข้าสู่ระบบไม่สำเร็จ');
      return response;
    }
    const auth = extractAuthData(response);
    const user = auth.user;
    const sessionToken = auth.sessionToken;
    saveSession(user, sessionToken);
    USER = user;
    await loadBootstrap();
    showApp();
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
    await loadBootstrap();
    showApp();
    toastMessage('เข้าสู่โหมดทดลองใช้งานแล้ว');
    return response;
  } catch (error) {
    console.error(error);
    toastMessage('เข้าสู่ระบบไม่สำเร็จ');
    return { ok: false, message: String(error && error.message ? error.message : 'API error') };
  }
}

async function logout() {
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
}

async function register() {
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
    await loadBootstrap();
    showApp();
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
