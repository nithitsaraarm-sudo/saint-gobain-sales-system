import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function formatDateKey(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0')
  ].join('-');
}

function createScriptProperties() {
  const values = new Map();
  return {
    getProperty(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setProperty(key, value) {
      values.set(String(key), String(value));
    },
    deleteProperty(key) {
      values.delete(String(key));
    }
  };
}

function createCache() {
  const values = new Map();
  return {
    get(key) {
      return values.has(key) ? values.get(key) : null;
    },
    put(key, value) {
      values.set(String(key), String(value));
    },
    remove(key) {
      values.delete(String(key));
    },
    removeAll(keys) {
      (Array.isArray(keys) ? keys : []).forEach(key => values.delete(String(key)));
    }
  };
}

export function createAppsScriptContext(extraContext = {}) {
  const scriptProperties = createScriptProperties();
  const scriptCache = createCache();
  const context = {
    console,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Set,
    Map,
    JSON,
    isNaN,
    isFinite,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent,
    QUOTE_STATUSES: { DRAFT: 'DRAFT', SAVED: 'SAVED', CANCELLED: 'CANCELLED' },
    LINE_STATUSES: { ACTIVE: 'ACTIVE', REMOVED: 'REMOVED' },
    USER_ROLES: { SUPER_ADMIN: 'SUPER_ADMIN', ADMIN: 'ADMIN', MANAGER: 'MANAGER', SALES: 'SALES', VIEWER: 'VIEWER', PC: 'PC' },
    USER_STATUSES: { ACTIVE: 'Active', PENDING: 'Pending', LOCKED: 'Locked', INACTIVE: 'Inactive' },
    success(data, message) {
      return { ok: true, success: true, data: data === undefined ? null : data, message: String(message || ''), code: 'SUCCESS' };
    },
    fail(message, code, data) {
      return { ok: false, success: false, data: data === undefined ? null : data, message: String(message || ''), code: String(code || 'ERROR') };
    },
    validationError(message, data) {
      return { ok: false, success: false, data: data === undefined ? null : data, message: String(message || ''), code: 'VALIDATION_ERROR' };
    },
    forbidden(message, data) {
      return { ok: false, success: false, data: data === undefined ? null : data, message: String(message || 'Forbidden'), code: 'FORBIDDEN' };
    },
    notFound(message, data) {
      return { ok: false, success: false, data: data === undefined ? null : data, message: String(message || 'Not found'), code: 'NOT_FOUND' };
    },
    logError() {},
    logWarning() {},
    logInfo() {},
    logActivity() {},
    normalizeString(value) {
      return String(value || '').trim().toLowerCase();
    },
    getUserPermissions() {
      return { canCreateQuotations: true, canEditQuotations: true };
    },
    hasRole(user, roles) {
      const role = String(user && user.role || '').trim().toUpperCase();
      return (Array.isArray(roles) ? roles : [roles]).map(String).map(item => item.toUpperCase()).includes(role);
    },
    Utilities: {
      getUuid() {
        return '00000000-0000-4000-8000-000000000001';
      },
      formatDate(date) {
        return formatDateKey(date);
      }
    },
    Session: {
      getScriptTimeZone() {
        return 'Asia/Bangkok';
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return scriptProperties;
      }
    },
    CacheService: {
      getScriptCache() {
        return scriptCache;
      }
    },
    LockService: {
      getScriptLock() {
        return {
          tryLock() { return true; },
          waitLock() {},
          releaseLock() {}
        };
      }
    }
  };
  return vm.createContext(Object.assign(context, extraContext));
}

export function loadAppsScriptContext(files, extraContext = {}) {
  const context = createAppsScriptContext(extraContext);
  (Array.isArray(files) ? files : [files]).forEach(file => {
    vm.runInContext(readRepoFile(file), context, { filename: file });
  });
  return context;
}

class FakeElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.id = id;
    this.children = [];
    this.childNodes = this.children;
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.parentNode = null;
    this.options = [];
    this.classList = {
      add: () => {},
      remove: () => {},
      contains: () => false,
      toggle: () => false
    };
  }

  append(...children) {
    children.flat().forEach(child => this.appendChild(child));
  }

  appendChild(child) {
    if (child && typeof child === 'object') child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child) {
    return this.appendChild(child);
  }

  setAttribute(name, value) {
    this.attributes[String(name)] = String(value);
  }

  getAttribute(name) {
    return this.attributes[String(name)] || null;
  }

  removeAttribute(name) {
    delete this.attributes[String(name)];
  }

  addEventListener() {}
  removeEventListener() {}
  focus() {}
  blur() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  remove() {}
}

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(String(key)) ? values.get(String(key)) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    },
    clear() {
      values.clear();
    }
  };
}

function createDocument() {
  const elements = new Map();
  return {
    body: new FakeElement('body', 'body'),
    documentElement: new FakeElement('html', 'html'),
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    createTextNode(text) {
      return String(text || '');
    },
    getElementById(id) {
      const key = String(id || '');
      if (!elements.has(key)) elements.set(key, new FakeElement('div', key));
      return elements.get(key);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    removeEventListener() {},
    elementFromPoint() {
      return null;
    }
  };
}

export function loadFrontendAppContext(extraContext = {}) {
  const document = createDocument();
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const window = {
    appState: {},
    DEFAULT_PAGE_SIZE: 50,
    console,
    document,
    localStorage,
    sessionStorage,
    navigator: { userAgent: 'node-test', share: undefined },
    location: { hash: '', href: 'http://localhost/index.html', pathname: '/index.html' },
    history: { pushState() {}, replaceState() {}, back() {} },
    addEventListener() {},
    removeEventListener() {},
    matchMedia() {
      return { matches: false, addEventListener() {}, removeEventListener() {} };
    },
    scrollTo() {},
    setTimeout,
    clearTimeout
  };
  window.window = window;
  const context = vm.createContext(Object.assign({
    console,
    window,
    document,
    localStorage,
    sessionStorage,
    navigator: window.navigator,
    location: window.location,
    history: window.history,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Set,
    Map,
    JSON,
    Intl,
    URL,
    URLSearchParams,
    Blob: class Blob {},
    FileReader: class FileReader {},
    Image: class Image {},
    Option: class Option {
      constructor(text, value) {
        this.text = text;
        this.value = value;
        this.dataset = {};
      }
    },
    requestAnimationFrame(callback) {
      return setTimeout(callback, 0);
    },
    cancelAnimationFrame(id) {
      clearTimeout(id);
    },
    fetch() {
      throw new Error('Network access is disabled in unit tests');
    },
    confirm() {
      return true;
    },
    alert() {}
  }, extraContext));
  context.window = window;
  window.globalThis = context;
  vm.runInContext(readRepoFile('js/app.js'), context, { filename: 'js/app.js' });
  return context;
}
