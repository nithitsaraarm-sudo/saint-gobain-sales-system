(function () {
  'use strict';

  const DIAGNOSTIC_STORAGE_KEY = 'sg_diagnostic_logs_v1';
  const MAX_DIAGNOSTIC_LOGS = 100;
  const TOAST_DEDUPE_MS = 900;
  const DEFAULT_TOAST_DURATION_MS = 3600;
  const NOTIFICATION_FRAMEWORK_VERSION = '1.1.0';
  const MODAL_ICON_MAP = {
    success: 'check_circle',
    info: 'info',
    warning: 'warning',
    error: 'error',
    destructive: 'delete',
    confirm: 'help',
    offline: 'wifi_off',
    loading: 'sync'
  };
  const SEVERITY_ICON_MAP = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'crisis_alert'
  };
  const ERROR_CATALOG = {
    DEFAULT: {
      errorCode: 'APP-0001',
      title: 'เกิดข้อผิดพลาด',
      message: 'ไม่สามารถทำรายการได้ กรุณาลองใหม่อีกครั้ง',
      severity: 'error',
      retryable: false,
      category: 'APP'
    },
    TIMEOUT: {
      errorCode: 'API-3001',
      title: 'การเชื่อมต่อนานเกินไป',
      message: 'ระบบใช้เวลาตอบสนองนานเกินไป กรุณาลองใหม่อีกครั้ง',
      severity: 'warning',
      retryable: true,
      category: 'API'
    },
    NETWORK_ERROR: {
      errorCode: 'NET-5001',
      title: 'ไม่สามารถเชื่อมต่อได้',
      message: 'กรุณาตรวจสอบอินเทอร์เน็ต แล้วลองใหม่อีกครั้ง',
      severity: 'warning',
      retryable: true,
      category: 'NETWORK'
    },
    API_RESPONSE_INVALID: {
      errorCode: 'API-3002',
      title: 'ข้อมูลตอบกลับไม่ถูกต้อง',
      message: 'ระบบได้รับข้อมูลที่ไม่สมบูรณ์ กรุณาลองใหม่อีกครั้ง',
      severity: 'error',
      retryable: true,
      category: 'API'
    },
    INVALID_JSON: {
      errorCode: 'API-3002',
      title: 'ข้อมูลตอบกลับไม่ถูกต้อง',
      message: 'ระบบได้รับข้อมูลที่ไม่สมบูรณ์ กรุณาลองใหม่อีกครั้ง',
      severity: 'error',
      retryable: true,
      category: 'API'
    },
    FORBIDDEN: {
      errorCode: 'AUTH-4002',
      title: 'ไม่มีสิทธิ์ทำรายการ',
      message: 'บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้',
      severity: 'warning',
      retryable: false,
      category: 'PERMISSION'
    },
    SESSION_EXPIRED: {
      errorCode: 'AUTH-4001',
      title: 'เซสชันหมดอายุ',
      message: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
      severity: 'warning',
      retryable: false,
      category: 'AUTH'
    },
    DUPLICATE_SUBMIT: {
      errorCode: 'QT-2003',
      title: 'ระบบกำลังทำรายการนี้อยู่',
      message: 'คำขอนี้กำลังดำเนินการ กรุณารอสักครู่',
      severity: 'info',
      retryable: true,
      category: 'QUOTATION'
    },
    QUOTE_SAVE_FAILED: {
      errorCode: 'QT-2001',
      title: 'บันทึกใบเสนอราคาไม่สำเร็จ',
      message: 'ไม่สามารถบันทึกใบเสนอราคาได้ กรุณาลองใหม่อีกครั้ง',
      severity: 'error',
      retryable: true,
      category: 'QUOTATION'
    },
    DRAFT_STORAGE_FAILED: {
      errorCode: 'CACHE-6001',
      title: 'ไม่สามารถบันทึกแบบร่างได้',
      message: 'ระบบไม่สามารถเก็บแบบร่างไว้ในเครื่องได้ กรุณาตรวจสอบพื้นที่จัดเก็บหรือโหมดส่วนตัวของเบราว์เซอร์',
      severity: 'warning',
      retryable: true,
      category: 'DRAFT'
    },
    DRAFT_CORRUPTED: {
      errorCode: 'DRF-1002',
      title: 'ไม่สามารถกู้คืนแบบร่างได้',
      message: 'แบบร่างที่บันทึกไว้ไม่สมบูรณ์ กรุณาเริ่มใบเสนอราคาใหม่',
      severity: 'warning',
      retryable: false,
      category: 'DRAFT'
    },
    DRAFT_CUSTOMER_UNAVAILABLE: {
      errorCode: 'DRF-1003',
      title: 'ไม่สามารถกู้คืนใบเสนอราคาได้',
      message: 'ร้านค้าที่อ้างอิงในแบบร่างไม่สามารถใช้งานได้ในขณะนี้',
      severity: 'warning',
      retryable: true,
      category: 'DRAFT'
    },
    DRAFT_RECOVERY_FAILED: {
      errorCode: 'DRF-1004',
      title: 'ไม่สามารถกู้คืนใบเสนอราคาได้',
      message: 'ระบบไม่สามารถกู้คืนแบบร่างนี้ได้ในขณะนี้',
      severity: 'warning',
      retryable: true,
      category: 'DRAFT'
    },
    CUSTOMER_ACCESS_DENIED: {
      errorCode: 'DRF-1005',
      title: 'ไม่สามารถใช้ร้านค้านี้ได้',
      message: 'ร้านค้าในแบบร่างอยู่นอกสิทธิ์การเข้าถึงของคุณ',
      severity: 'warning',
      retryable: false,
      category: 'PERMISSION'
    }
  };

  let toastContainer = null;
  let lastToastKey = '';
  let lastToastAt = 0;
  let activeDialog = null;
  let activeDialogPromise = null;
  let activeLoadingOverlay = null;
  let loadingItems = {};

  function text(value, limit) {
    const raw = String(value === undefined || value === null ? '' : value);
    const cleaned = raw.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const max = limit || 500;
    return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
  }

  function createElement(tagName, className, textContent) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (textContent !== undefined && textContent !== null) element.textContent = String(textContent);
    return element;
  }

  function getAppVersion() {
    return text(window.APP_VERSION || window.CACHE_VERSION || window.APP_CONFIG && window.APP_CONFIG.version || '', 40);
  }

  function getSafeCurrentUser() {
    const source = window.USER || readJsonStorage('sg_user') || readJsonStorage('currentUser') || {};
    return {
      userId: text(source.userId || source.username || 'anonymous', 80),
      role: normalizeRole(source.role || 'anonymous')
    };
  }

  function normalizeRole(value) {
    const role = text(value || '', 40).toUpperCase().replace(/[\s-]+/g, '_');
    if (role === 'SUPERADMIN') return 'SUPER_ADMIN';
    return role || 'ANONYMOUS';
  }

  function isSuperAdmin() {
    return getSafeCurrentUser().role === 'SUPER_ADMIN';
  }

  function readJsonStorage(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function generateEventId() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    let random = '';
    try {
      const bytes = new Uint8Array(4);
      crypto.getRandomValues(bytes);
      random = Array.from(bytes).map(function (byte) {
        return byte.toString(16).padStart(2, '0');
      }).join('').toUpperCase();
    } catch (error) {
      random = Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, '0').slice(0, 8);
    }
    return 'EVT-' + yyyy + mm + dd + '-' + random;
  }

  function getBrowserFamily() {
    const ua = navigator.userAgent || '';
    if (/Edg\//.test(ua)) return 'Edge';
    if (/CriOS|Chrome\//.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
    if (/Firefox\//.test(ua)) return 'Firefox';
    return 'Unknown';
  }

  function getDeviceType() {
    const ua = navigator.userAgent || '';
    if (/iPhone|Android.+Mobile/.test(ua)) return 'mobile';
    if (/iPad|Tablet|Android/.test(ua)) return 'tablet';
    return 'desktop';
  }

  function isPwaStandalone() {
    return Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone);
  }

  function getDevicePlatform() {
    const ua = navigator.userAgent || '';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Unknown';
  }

  function formatLocalTimestamp(value) {
    const date = value ? new Date(value) : new Date();
    if (isNaN(date.getTime())) return '';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + min + ':' + ss;
  }

  function normalizeSeverity(value) {
    const severity = text(value || 'ERROR', 30).toUpperCase();
    if (severity === 'INFO' || severity === 'WARNING' || severity === 'ERROR' || severity === 'CRITICAL') return severity;
    if (severity === 'WARN') return 'WARNING';
    return 'ERROR';
  }

  function humanizeDiagnosticValue(value) {
    const raw = text(value, 160);
    if (!raw) return '';
    return raw.replace(/_/g, ' ').replace(/\b\w/g, function (letter) {
      return letter.toUpperCase();
    });
  }

  function diagnosticSummaryFor(errorInfo) {
    const code = text(errorInfo && errorInfo.errorCode || '', 40).toUpperCase();
    const summaries = {
      'DRF-1003': {
        diagnosis: 'ร้านค้าที่อ้างอิงในแบบร่างไม่พบในข้อมูลปัจจุบัน',
        recommendation: 'รีเฟรชข้อมูลร้านค้าแล้วลองใหม่ หากร้านค้าไม่มีอยู่จริง ให้เก็บหรือลบแบบร่างตามความเหมาะสม'
      },
      'DRF-1005': {
        diagnosis: 'ผู้ใช้ปัจจุบันไม่มีสิทธิ์เข้าถึงร้านค้าในแบบร่าง',
        recommendation: 'ตรวจสอบสิทธิ์ พื้นที่ขาย หรือผู้รับผิดชอบร้านค้าก่อนลองใหม่'
      },
      'DRF-1002': {
        diagnosis: 'ข้อมูลแบบร่างไม่สมบูรณ์หรือไม่รองรับเวอร์ชันปัจจุบัน',
        recommendation: 'เก็บแบบร่างไว้ตรวจสอบ หรือยืนยันลบแบบร่างเมื่อแน่ใจว่าไม่ต้องใช้แล้ว'
      },
      'DRF-1004': {
        diagnosis: 'ระบบไม่สามารถกู้คืนแบบร่างได้ในขณะนี้',
        recommendation: 'ลองใหม่อีกครั้ง หากยังไม่สำเร็จให้เก็บแบบร่างไว้แล้วส่ง Event ID ให้ผู้ดูแลระบบ'
      }
    };
    return summaries[code] || {
      diagnosis: 'ระบบพบข้อผิดพลาดที่ตรวจสอบได้',
      recommendation: 'ใช้ Error Code และ Event ID เพื่อตรวจสอบเหตุการณ์นี้'
    };
  }

  function addDiagnosticRow(rows, label, value) {
    const safeValue = text(value, 180);
    if (!safeValue) return;
    rows.push({ label: label, value: safeValue });
  }

  function buildSafeDiagnosticView(errorInfo) {
    const data = errorInfo && typeof errorInfo === 'object' ? errorInfo : {};
    const detail = data.diagnostics && typeof data.diagnostics === 'object' ? sanitizeDiagnosticDetail(data.diagnostics) : {};
    const severity = normalizeSeverity(data.severity);
    const summary = diagnosticSummaryFor(data);
    const currentUser = getSafeCurrentUser();
    const sections = [];

    const coreRows = [];
    addDiagnosticRow(coreRows, 'Event ID', data.eventId);
    addDiagnosticRow(coreRows, 'Error Code', data.errorCode);
    addDiagnosticRow(coreRows, 'Severity', severity);
    addDiagnosticRow(coreRows, 'Status', humanizeDiagnosticValue(detail.result || 'failed'));
    addDiagnosticRow(coreRows, 'Module', humanizeDiagnosticValue(detail.module || data.category));
    addDiagnosticRow(coreRows, 'Action', humanizeDiagnosticValue(detail.action));
    addDiagnosticRow(coreRows, 'Safe Reason', humanizeDiagnosticValue(detail.reason));
    addDiagnosticRow(coreRows, 'Validation Code', detail.validationCode);
    addDiagnosticRow(coreRows, 'Timestamp', formatLocalTimestamp(data.timestamp));
    if (coreRows.length) sections.push({ title: 'Core', rows: coreRows });

    const requestRows = [];
    addDiagnosticRow(requestRows, 'Endpoint', detail.endpoint);
    addDiagnosticRow(requestRows, 'HTTP Status', detail.apiStatus || detail.status);
    addDiagnosticRow(requestRows, 'Request Duration', detail.durationMs ? detail.durationMs + ' ms' : '');
    addDiagnosticRow(requestRows, 'Retry Count', detail.retryCount);
    if (requestRows.length) sections.push({ title: 'Request', rows: requestRows });

    const appRows = [];
    addDiagnosticRow(appRows, 'App Version', getAppVersion());
    addDiagnosticRow(appRows, 'Notification Framework', NOTIFICATION_FRAMEWORK_VERSION);
    addDiagnosticRow(appRows, 'Draft Version', detail.draftVersion);
    if (appRows.length) sections.push({ title: 'Application', rows: appRows });

    const environmentRows = [];
    addDiagnosticRow(environmentRows, 'Browser', getBrowserFamily());
    addDiagnosticRow(environmentRows, 'Platform', getDevicePlatform());
    addDiagnosticRow(environmentRows, 'Device Type', humanizeDiagnosticValue(getDeviceType()));
    addDiagnosticRow(environmentRows, 'PWA Mode', isPwaStandalone() ? 'Yes' : 'No');
    addDiagnosticRow(environmentRows, 'Network', navigator.onLine === false ? 'Offline' : 'Online');
    if (environmentRows.length) sections.push({ title: 'Environment', rows: environmentRows });

    const referenceRows = [];
    addDiagnosticRow(referenceRows, 'Draft ID', detail.draftId);
    addDiagnosticRow(referenceRows, 'Customer ID', detail.customerId);
    addDiagnosticRow(referenceRows, 'Quotation ID', detail.quotationId);
    addDiagnosticRow(referenceRows, 'User Role', currentUser.role);
    if (referenceRows.length) sections.push({ title: 'Safe References', rows: referenceRows });

    return {
      eventId: text(data.eventId, 60),
      errorCode: text(data.errorCode, 40),
      severity: severity,
      severityIcon: SEVERITY_ICON_MAP[severity] || SEVERITY_ICON_MAP.ERROR,
      summary: summary,
      sections: sections
    };
  }

  function buildDiagnosticCopyText(view) {
    const lines = ['Saint-Gobain Sales System Diagnostic', ''];
    (view.sections || []).forEach(function (section) {
      (section.rows || []).forEach(function (row) {
        lines.push(row.label + ': ' + row.value);
      });
    });
    return lines.join('\n');
  }

  function copyTextToClipboard(value) {
    const content = text(value, 4000);
    if (!content) return Promise.reject(new Error('Nothing to copy'));
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(content);
    }
    return new Promise(function (resolve, reject) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand && document.execCommand('copy');
        if (textarea.parentNode) textarea.parentNode.removeChild(textarea);
        copied ? resolve() : reject(new Error('Clipboard fallback failed'));
      } catch (error) {
        reject(error);
      }
    });
  }

  function sanitizeDiagnosticDetail(detail) {
    const source = detail && typeof detail === 'object' ? detail : {};
    const safe = {};
    [
      'module',
      'action',
      'result',
      'severity',
      'route',
      'method',
      'endpoint',
      'status',
      'durationMs',
      'retryCount',
      'draftVersion',
      'draftId',
      'customerId',
      'quotationId',
      'apiStatus',
      'validationCode',
      'reason'
    ].forEach(function (key) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
        safe[key] = text(source[key], 160);
      }
    });
    return safe;
  }

  function resolveCatalogEntry(codeOrKey) {
    const key = text(codeOrKey || '').toUpperCase();
    return ERROR_CATALOG[key] || Object.keys(ERROR_CATALOG).map(function (name) {
      return ERROR_CATALOG[name];
    }).find(function (entry) {
      return entry.errorCode === key;
    }) || ERROR_CATALOG.DEFAULT;
  }

  function normalizeAppError(input, context) {
    const opts = input && typeof input === 'object' ? input : { message: input };
    const catalog = resolveCatalogEntry(opts.code || opts.errorCode || opts.category);
    const eventId = text(opts.eventId || generateEventId(), 40);
    const normalized = {
      eventId: eventId,
      errorCode: text(opts.errorCode || catalog.errorCode, 20),
      title: text(opts.title || catalog.title, 120),
      message: text(opts.message || catalog.message, 500),
      severity: text(opts.severity || catalog.severity || 'error', 30),
      retryable: opts.retryable !== undefined ? Boolean(opts.retryable) : Boolean(catalog.retryable),
      category: text(opts.category || catalog.category || 'APP', 40),
      timestamp: text(opts.timestamp || new Date().toISOString(), 40),
      diagnostics: sanitizeDiagnosticDetail(Object.assign({}, context || {}, opts.diagnostics || {}))
    };
    logDiagnosticEvent(normalized);
    return normalized;
  }

  function logDiagnosticEvent(entry) {
    try {
      const user = getSafeCurrentUser();
      const payload = Object.assign({
        timestamp: new Date().toISOString(),
        userId: user.userId,
        role: user.role,
        route: location.hash || location.pathname || '',
        browserFamily: getBrowserFamily(),
        deviceType: getDeviceType(),
        pwaStandalone: isPwaStandalone(),
        online: navigator.onLine !== false,
        appVersion: getAppVersion()
      }, entry || {});
      payload.message = text(payload.message, 500);
      payload.title = text(payload.title, 160);
      payload.diagnostics = sanitizeDiagnosticDetail(payload.diagnostics || {});
      const raw = localStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(payload);
      localStorage.setItem(DIAGNOSTIC_STORAGE_KEY, JSON.stringify(list.slice(0, MAX_DIAGNOSTIC_LOGS)));
      if (window.console && typeof console.warn === 'function') {
        console.warn('[DiagnosticEvent]', {
          eventId: payload.eventId,
          errorCode: payload.errorCode,
          category: payload.category,
          severity: payload.severity,
          action: payload.diagnostics && payload.diagnostics.action || ''
        });
      }
      return payload;
    } catch (error) {
      try {
        console.warn('[DiagnosticEvent] logging failed');
      } catch (ignore) {}
      return null;
    }
  }

  function getDiagnosticHistory() {
    if (!isSuperAdmin()) return [];
    try {
      const raw = localStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.slice(0, MAX_DIAGNOSTIC_LOGS) : [];
    } catch (error) {
      return [];
    }
  }

  function ensureToastContainer() {
    if (toastContainer && toastContainer.parentNode) return toastContainer;
    toastContainer = document.getElementById('sgToastContainer');
    if (!toastContainer) {
      toastContainer = createElement('div', 'sg-toast-container');
      toastContainer.id = 'sgToastContainer';
      toastContainer.setAttribute('aria-live', 'polite');
      toastContainer.setAttribute('aria-atomic', 'false');
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function iconName(type) {
    return MODAL_ICON_MAP[type] || MODAL_ICON_MAP.info;
  }

  function showToast(options, legacyOptions) {
    if (typeof document === 'undefined') return '';
    const opts = typeof options === 'string'
      ? Object.assign({ message: options }, legacyOptions || {})
      : Object.assign({}, options || {});
    const type = text(opts.type || opts.variant || 'info', 24);
    const message = text(opts.message || opts.title || '', 500);
    if (!message) return '';
    const key = type + ':' + message;
    const now = Date.now();
    if (key === lastToastKey && now - lastToastAt < TOAST_DEDUPE_MS) return '';
    lastToastKey = key;
    lastToastAt = now;
    const container = ensureToastContainer();
    const toast = createElement('div', 'sg-toast sg-toast-' + type);
    toast.setAttribute('role', opts.role || (type === 'error' ? 'alert' : 'status'));
    toast.dataset.toastId = opts.id || generateEventId();
    const icon = createElement('span', 'material-symbols-rounded sg-toast-icon', iconName(type));
    icon.setAttribute('aria-hidden', 'true');
    const body = createElement('div', 'sg-toast-body');
    if (opts.title) body.appendChild(createElement('b', '', text(opts.title, 120)));
    body.appendChild(createElement('span', '', message));
    const close = createElement('button', 'sg-toast-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'ปิดการแจ้งเตือน');
    toast.appendChild(icon);
    toast.appendChild(body);
    toast.appendChild(close);
    container.appendChild(toast);
    const remove = function () {
      toast.classList.add('is-leaving');
      window.setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 180);
    };
    close.addEventListener('click', remove);
    if (opts.duration !== 0) {
      window.setTimeout(remove, Number(opts.duration || DEFAULT_TOAST_DURATION_MS));
    }
    return toast.dataset.toastId;
  }

  function showSuccess(message, options) {
    return showToast(Object.assign({}, options || {}, { type: 'success', message: message }));
  }

  function showInfo(message, options) {
    return showToast(Object.assign({}, options || {}, { type: 'info', message: message }));
  }

  function showWarning(message, options) {
    const opts = Object.assign({
      type: 'warning',
      title: 'โปรดตรวจสอบ',
      message: message,
      primaryLabel: 'เข้าใจแล้ว',
      secondaryLabel: 'ปิด',
      primaryValue: true,
      secondaryValue: false
    }, options || {});
    return showDialog(opts);
  }

  function closeActiveDialog(result) {
    if (!activeDialog) return;
    const state = activeDialog;
    activeDialog = null;
    activeDialogPromise = null;
    document.removeEventListener('keydown', state.keyHandler, true);
    document.body.classList.remove('sg-dialog-open');
    if (state.backdrop.parentNode) state.backdrop.parentNode.removeChild(state.backdrop);
    if (state.resolve) state.resolve(result);
    if (state.previousFocus && typeof state.previousFocus.focus === 'function') {
      window.setTimeout(function () {
        try {
          state.previousFocus.focus({ preventScroll: true });
        } catch (error) {
          try { state.previousFocus.focus(); } catch (ignore) {}
        }
      }, 0);
    }
  }

  function getFocusableElements(container) {
    return Array.prototype.slice.call(container.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
  }

  function showDialog(options) {
    if (typeof document === 'undefined') return Promise.resolve(false);
    if (activeDialogPromise) return activeDialogPromise;
    const opts = Object.assign({
      type: 'confirm',
      title: 'ยืนยันการทำรายการ',
      message: '',
      primaryLabel: 'ตกลง',
      secondaryLabel: 'ยกเลิก',
      primaryValue: true,
      secondaryValue: false,
      preventBackdropClose: true,
      allowEscape: true,
      destructive: false
    }, options || {});
    const previousFocus = document.activeElement;
    activeDialogPromise = new Promise(function (resolve) {
      const backdrop = createElement('div', 'sg-dialog-backdrop sg-dialog-' + text(opts.type, 24));
      const panel = createElement('div', 'sg-dialog-panel');
      const titleId = 'sgDialogTitle-' + generateEventId();
      const descId = 'sgDialogDesc-' + generateEventId();
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-labelledby', titleId);
      panel.setAttribute('aria-describedby', descId);
      const icon = createElement('span', 'material-symbols-rounded sg-dialog-icon', iconName(opts.type));
      icon.setAttribute('aria-hidden', 'true');
      const heading = createElement('h2', '', text(opts.title, 140));
      heading.id = titleId;
      const description = createElement('div', 'sg-dialog-description');
      description.id = descId;
      String(opts.message || '').split('\n').filter(Boolean).forEach(function (line) {
        description.appendChild(createElement('p', '', text(line, 500)));
      });
      if (!description.childNodes.length) {
        description.appendChild(createElement('p', '', ''));
      }
      const actions = createElement('div', 'sg-dialog-actions');
      const actionButtons = [];
      const actionDefinitions = Array.isArray(opts.actions) && opts.actions.length
        ? opts.actions
        : [
            { label: opts.secondaryLabel, value: opts.secondaryValue, className: 'ghost sg-dialog-secondary' },
            {
              label: opts.primaryLabel,
              value: opts.primaryValue,
              className: opts.destructive || opts.type === 'destructive' ? 'danger sg-dialog-primary' : 'primary sg-dialog-primary'
            }
          ];
      actionDefinitions.forEach(function (action) {
        const item = action && typeof action === 'object' ? action : {};
        const className = text(item.className || (item.danger || item.destructive ? 'danger' : item.primary ? 'primary sg-dialog-primary' : 'ghost sg-dialog-secondary'), 120);
        const button = createElement('button', className, text(item.label || 'ตกลง', 80));
        button.type = 'button';
        button.dataset.dialogAction = text(item.name || item.value || item.label || '', 80);
        actionButtons.push({ button: button, value: item.value });
        actions.appendChild(button);
      });
      panel.appendChild(icon);
      panel.appendChild(heading);
      panel.appendChild(description);
      if (opts.errorInfo) {
        panel.appendChild(renderErrorMeta(opts.errorInfo));
      }
      panel.appendChild(actions);
      backdrop.appendChild(panel);
      const resolveOnce = function (value) {
        actionButtons.forEach(function (entry) {
          entry.button.disabled = true;
        });
        closeActiveDialog(value);
      };
      actionButtons.forEach(function (entry) {
        entry.button.addEventListener('click', function () { resolveOnce(entry.value); });
      });
      backdrop.addEventListener('click', function (event) {
        if (event.target === backdrop) {
          event.preventDefault();
          event.stopPropagation();
          if (!opts.preventBackdropClose) resolveOnce(opts.secondaryValue);
        }
      });
      const keyHandler = function (event) {
        if (!activeDialog || activeDialog.backdrop !== backdrop) return;
        const target = event.target && event.target.closest ? event.target : null;
        if (event.key === 'Enter' && target && target.closest('.sg-copy-button,.sg-copy-diagnostic,.sg-admin-diagnostics')) {
          return;
        }
        if (event.key === 'Escape' && opts.allowEscape) {
          event.preventDefault();
          resolveOnce(opts.escapeValue !== undefined ? opts.escapeValue : opts.secondaryValue);
          return;
        }
        if (event.key === 'Enter' && !opts.destructive && opts.enterSubmits !== false) {
          event.preventDefault();
          resolveOnce(opts.enterValue !== undefined ? opts.enterValue : opts.primaryValue);
          return;
        }
        if (event.key !== 'Tab') return;
        const focusable = getFocusableElements(panel);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };
      activeDialog = { backdrop: backdrop, keyHandler: keyHandler, previousFocus: previousFocus, resolve: resolve };
      document.body.appendChild(backdrop);
      document.body.classList.add('sg-dialog-open');
      document.addEventListener('keydown', keyHandler, true);
      window.setTimeout(function () {
        const focusButton = actionButtons.find(function (entry) {
          return opts.focusValue !== undefined && entry.value === opts.focusValue;
        }) || actionButtons.find(function (entry) {
          return entry.button.className.indexOf('danger') < 0 && entry.button.className.indexOf('destructive') < 0;
        }) || actionButtons[0];
        try { focusButton.button.focus({ preventScroll: true }); } catch (error) { try { focusButton.button.focus(); } catch (ignore) {} }
      }, 20);
    });
    return activeDialogPromise;
  }

  function renderErrorMeta(errorInfo) {
    const box = createElement('div', 'sg-error-meta');
    const view = buildSafeDiagnosticView(errorInfo || {});
    const code = view.errorCode;
    const eventId = view.eventId;
    if (code) box.appendChild(createElement('p', '', 'Error Code: ' + code));
    if (eventId) {
      const eventRow = createElement('p', 'sg-event-id-row');
      eventRow.appendChild(createElement('span', '', 'Event ID: ' + eventId));
      const eventCopy = createElement('button', 'sg-copy-button sg-copy-event-id', '');
      eventCopy.type = 'button';
      eventCopy.setAttribute('aria-label', 'คัดลอกรหัสเหตุการณ์ ' + eventId);
      eventCopy.setAttribute('title', 'คัดลอกรหัสเหตุการณ์');
      const eventIcon = createElement('span', 'material-symbols-rounded', 'content_copy');
      eventIcon.setAttribute('aria-hidden', 'true');
      eventCopy.appendChild(eventIcon);
      eventCopy.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        copyTextToClipboard(eventId).then(function () {
          showToast({ type: 'success', message: 'คัดลอกรหัสเหตุการณ์แล้ว' });
          logDiagnosticEvent({
            eventId: eventId,
            errorCode: code,
            severity: 'info',
            category: 'DIAGNOSTIC',
            diagnostics: { module: 'Notification', action: 'event_id_copied', result: 'success' }
          });
        }).catch(function () {
          showToast({ type: 'error', message: 'ไม่สามารถคัดลอกรหัสเหตุการณ์ได้' });
        });
      });
      eventRow.appendChild(eventCopy);
      box.appendChild(eventRow);
    }
    if (isSuperAdmin()) {
      const details = createElement('details', 'sg-admin-diagnostics');
      const panelId = 'sgAdminDiagnostics-' + (eventId || generateEventId()).replace(/[^A-Za-z0-9_-]/g, '');
      const summary = createElement('summary', 'sg-admin-diagnostics-summary');
      summary.setAttribute('aria-expanded', 'false');
      summary.setAttribute('aria-controls', panelId);
      const chevron = createElement('span', 'material-symbols-rounded sg-admin-diagnostics-chevron', 'expand_more');
      chevron.setAttribute('aria-hidden', 'true');
      summary.appendChild(chevron);
      summary.appendChild(createElement('span', '', 'รายละเอียดสำหรับผู้ดูแลระบบ'));
      details.appendChild(summary);
      const panel = createElement('div', 'sg-admin-diagnostics-panel');
      panel.id = panelId;
      const summaryBlock = createElement('div', 'sg-diagnostic-summary');
      summaryBlock.appendChild(createElement('b', '', 'Diagnosis'));
      summaryBlock.appendChild(createElement('p', '', view.summary.diagnosis));
      summaryBlock.appendChild(createElement('b', '', 'Recommended action'));
      summaryBlock.appendChild(createElement('p', '', view.summary.recommendation));
      panel.appendChild(summaryBlock);
      const badge = createElement('div', 'sg-severity-badge sg-severity-' + view.severity.toLowerCase());
      const severityIcon = createElement('span', 'material-symbols-rounded', view.severityIcon);
      severityIcon.setAttribute('aria-hidden', 'true');
      badge.appendChild(severityIcon);
      badge.appendChild(createElement('span', '', view.severity));
      panel.appendChild(badge);
      (view.sections || []).forEach(function (section) {
        const sectionEl = createElement('section', 'sg-diagnostic-section');
        sectionEl.appendChild(createElement('h3', '', section.title));
        const grid = createElement('dl', 'sg-diagnostic-grid');
        (section.rows || []).forEach(function (row) {
          const item = createElement('div', 'sg-diagnostic-row');
          item.appendChild(createElement('dt', '', row.label));
          item.appendChild(createElement('dd', '', row.value));
          grid.appendChild(item);
        });
        sectionEl.appendChild(grid);
        panel.appendChild(sectionEl);
      });
      const tools = createElement('div', 'sg-diagnostic-tools');
      const copyDiagnostic = createElement('button', 'ghost sg-copy-diagnostic', 'คัดลอกรายละเอียด');
      copyDiagnostic.type = 'button';
      copyDiagnostic.setAttribute('aria-label', 'คัดลอกรายละเอียด diagnostic สำหรับผู้ดูแลระบบ');
      copyDiagnostic.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        copyTextToClipboard(buildDiagnosticCopyText(view)).then(function () {
          showToast({ type: 'success', message: 'คัดลอกรายละเอียดแล้ว' });
          logDiagnosticEvent({
            eventId: eventId,
            errorCode: code,
            severity: 'info',
            category: 'DIAGNOSTIC',
            diagnostics: { module: 'Notification', action: 'diagnostic_copied', result: 'success' }
          });
        }).catch(function () {
          showToast({ type: 'error', message: 'ไม่สามารถคัดลอกรายละเอียดได้' });
        });
      });
      tools.appendChild(copyDiagnostic);
      panel.appendChild(tools);
      details.appendChild(panel);
      details.addEventListener('toggle', function () {
        const expanded = details.open ? 'true' : 'false';
        summary.setAttribute('aria-expanded', expanded);
        if (details.open && !details.dataset.openLogged) {
          details.dataset.openLogged = 'true';
          logDiagnosticEvent({
            eventId: eventId,
            errorCode: code,
            severity: 'info',
            category: 'DIAGNOSTIC',
            diagnostics: { module: 'Notification', action: 'diagnostic_panel_opened', result: 'opened' }
          });
        }
      });
      box.appendChild(details);
    }
    return box;
  }

  function showConfirm(options) {
    const opts = Object.assign({
      type: 'confirm',
      title: 'ยืนยันการทำรายการ',
      primaryLabel: 'ยืนยัน',
      secondaryLabel: 'ยกเลิก',
      primaryValue: true,
      secondaryValue: false
    }, options || {});
    return showDialog(opts);
  }

  function showDestructiveConfirm(options) {
    const opts = Object.assign({
      type: 'destructive',
      title: 'ยืนยันการลบหรือยกเลิกข้อมูล',
      primaryLabel: 'ยืนยัน',
      secondaryLabel: 'ยกเลิก',
      destructive: true,
      enterSubmits: false,
      primaryValue: true,
      secondaryValue: false
    }, options || {});
    return showDialog(opts);
  }

  function showError(options) {
    const normalized = normalizeAppError(options || {});
    return showDialog({
      type: 'error',
      title: normalized.title,
      message: normalized.message,
      primaryLabel: normalized.retryable ? 'ลองใหม่' : 'ปิด',
      secondaryLabel: 'ปิด',
      primaryValue: normalized.retryable ? 'retry' : false,
      secondaryValue: false,
      errorInfo: normalized,
      enterSubmits: false
    });
  }

  function showPromptDialog(options) {
    const opts = Object.assign({
      title: 'กรอกข้อมูล',
      message: '',
      inputLabel: '',
      value: '',
      primaryLabel: 'ตกลง',
      secondaryLabel: 'ยกเลิก'
    }, options || {});
    if (activeDialogPromise) return activeDialogPromise;
    const previousFocus = document.activeElement;
    activeDialogPromise = new Promise(function (resolve) {
      const backdrop = createElement('div', 'sg-dialog-backdrop sg-dialog-prompt');
      const panel = createElement('div', 'sg-dialog-panel');
      const titleId = 'sgPromptTitle-' + generateEventId();
      const descId = 'sgPromptDesc-' + generateEventId();
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-labelledby', titleId);
      panel.setAttribute('aria-describedby', descId);
      const icon = createElement('span', 'material-symbols-rounded sg-dialog-icon', MODAL_ICON_MAP.confirm);
      icon.setAttribute('aria-hidden', 'true');
      const heading = createElement('h2', '', text(opts.title, 140));
      heading.id = titleId;
      const description = createElement('div', 'sg-dialog-description');
      description.id = descId;
      if (opts.message) description.appendChild(createElement('p', '', text(opts.message, 500)));
      const field = createElement('label', 'field sg-prompt-field');
      if (opts.inputLabel) field.appendChild(createElement('span', '', text(opts.inputLabel, 120)));
      const input = createElement(opts.multiline ? 'textarea' : 'input', '');
      if (!opts.multiline) input.type = opts.inputType || 'text';
      input.value = text(opts.value, 300);
      input.maxLength = Number(opts.maxLength || 300);
      field.appendChild(input);
      const actions = createElement('div', 'sg-dialog-actions');
      const secondary = createElement('button', 'ghost sg-dialog-secondary', text(opts.secondaryLabel, 80));
      secondary.type = 'button';
      const primary = createElement('button', 'primary sg-dialog-primary', text(opts.primaryLabel, 80));
      primary.type = 'button';
      actions.appendChild(secondary);
      actions.appendChild(primary);
      panel.appendChild(icon);
      panel.appendChild(heading);
      panel.appendChild(description);
      panel.appendChild(field);
      panel.appendChild(actions);
      backdrop.appendChild(panel);
      function resolvePrompt(value) {
        primary.disabled = true;
        secondary.disabled = true;
        closeActiveDialog(value);
      }
      primary.addEventListener('click', function () { resolvePrompt(text(input.value, opts.maxLength || 300)); });
      secondary.addEventListener('click', function () { resolvePrompt(null); });
      backdrop.addEventListener('click', function (event) {
        if (event.target === backdrop) {
          event.preventDefault();
          event.stopPropagation();
        }
      });
      const keyHandler = function (event) {
        if (!activeDialog || activeDialog.backdrop !== backdrop) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          resolvePrompt(null);
          return;
        }
        if (event.key === 'Enter' && !opts.multiline) {
          event.preventDefault();
          resolvePrompt(text(input.value, opts.maxLength || 300));
          return;
        }
        if (event.key !== 'Tab') return;
        const focusable = getFocusableElements(panel);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };
      activeDialog = { backdrop: backdrop, keyHandler: keyHandler, previousFocus: previousFocus, resolve: resolve };
      document.body.appendChild(backdrop);
      document.body.classList.add('sg-dialog-open');
      document.addEventListener('keydown', keyHandler, true);
      window.setTimeout(function () {
        try { input.focus({ preventScroll: true }); } catch (error) { try { input.focus(); } catch (ignore) {} }
      }, 20);
    });
    return activeDialogPromise;
  }

  function ensureLoadingOverlay() {
    if (activeLoadingOverlay && activeLoadingOverlay.parentNode) return activeLoadingOverlay;
    activeLoadingOverlay = createElement('div', 'sg-loading-overlay');
    activeLoadingOverlay.id = 'sgLoadingOverlay';
    activeLoadingOverlay.setAttribute('role', 'status');
    activeLoadingOverlay.setAttribute('aria-live', 'polite');
    document.body.appendChild(activeLoadingOverlay);
    return activeLoadingOverlay;
  }

  function renderLoadingOverlay() {
    const overlay = ensureLoadingOverlay();
    const ids = Object.keys(loadingItems);
    if (!ids.length) {
      overlay.classList.remove('show');
      overlay.textContent = '';
      return;
    }
    const latest = loadingItems[ids[ids.length - 1]];
    overlay.textContent = '';
    overlay.appendChild(createElement('span', 'material-symbols-rounded sg-loading-icon', MODAL_ICON_MAP.loading));
    overlay.appendChild(createElement('span', '', text(latest.message || 'กำลังดำเนินการ...', 160)));
    overlay.classList.add('show');
  }

  function showLoading(options) {
    const opts = typeof options === 'string' ? { message: options } : Object.assign({}, options || {});
    const id = text(opts.id || generateEventId(), 60);
    loadingItems[id] = {
      message: text(opts.message || 'กำลังดำเนินการ...', 160),
      startedAt: new Date().toISOString()
    };
    renderLoadingOverlay();
    return id;
  }

  function hideLoading(id) {
    if (id) delete loadingItems[id];
    else loadingItems = {};
    renderLoadingOverlay();
  }

  window.AppNotifications = {
    showToast: showToast,
    showSuccess: showSuccess,
    showInfo: showInfo,
    showWarning: showWarning,
    showDialog: showDialog,
    showError: showError,
    showConfirm: showConfirm,
    showDestructiveConfirm: showDestructiveConfirm,
    showLoading: showLoading,
    hideLoading: hideLoading,
    showPromptDialog: showPromptDialog,
    generateEventId: generateEventId,
    normalizeAppError: normalizeAppError,
    logDiagnosticEvent: logDiagnosticEvent,
    getDiagnosticHistory: getDiagnosticHistory,
    errorCatalog: ERROR_CATALOG
  };
  window.showToast = showToast;
  window.showSuccess = showSuccess;
  window.showInfo = showInfo;
  window.showWarning = showWarning;
  window.showNotificationDialog = showDialog;
  window.showError = showError;
  window.showConfirm = showConfirm;
  window.showDestructiveConfirm = showDestructiveConfirm;
  window.showLoading = showLoading;
  window.hideLoading = hideLoading;
  window.showPromptDialog = showPromptDialog;
  window.generateNotificationEventId = generateEventId;
  window.normalizeAppError = normalizeAppError;
  window.logDiagnosticEvent = logDiagnosticEvent;
  window.getDiagnosticHistory = getDiagnosticHistory;
  if (typeof window.toast !== 'function') {
    window.toast = function (message) {
      return showToast({ type: 'info', message: message });
    };
  }
})();
