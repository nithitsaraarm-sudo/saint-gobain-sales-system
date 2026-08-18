import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadAppsScriptContext, repoRoot } from './source-loader.mjs';
import { apiUserList } from '../fixtures/api-contract-data.mjs';

export { loadAppsScriptContext };

export const RESPONSE_CODES = Object.freeze({
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN'
});

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function ok(data, message = '') {
  return {
    ok: true,
    code: 'SUCCESS',
    data: data === undefined ? null : data,
    message
  };
}

export function failure(message = 'Request failed', code = 'ERROR', detail = null) {
  return {
    ok: false,
    code,
    data: null,
    message,
    detail
  };
}

export function readRepoText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

export function makeResponse({ ok: responseOk = true, status = 200, body = '', redirected = false, url = 'https://example.test/exec' } = {}) {
  return {
    ok: responseOk,
    status,
    redirected,
    url,
    text() {
      return Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body));
    }
  };
}

function createStorage(seed = {}) {
  const values = new Map(Object.entries(seed).map(([key, value]) => [String(key), String(value)]));
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

function createJsonpDocument() {
  return {
    head: {
      appendChild() {},
      removeChild() {}
    },
    createElement() {
      return {
        parentNode: null,
        set src(value) {
          this._src = value;
        },
        get src() {
          return this._src || '';
        }
      };
    }
  };
}

export function createApiClientContext(fetchImpl, options = {}) {
  const localStorage = createStorage(options.localStorage || {});
  const sessionStorage = createStorage(options.sessionStorage || {});
  const window = {
    APP_ENV: options.appEnv || 'production',
    APP_VERSION: 'test',
    APP_INFO: { version: 'test' },
    GAS_WEB_APP_URL: options.url || 'https://example.test/apps-script/exec',
    console,
    document: createJsonpDocument(),
    localStorage,
    sessionStorage,
    navigator: { userAgent: 'node-test' },
    location: { href: 'https://example.test/app', pathname: '/app', hash: '' },
    setTimeout,
    clearTimeout,
    addEventListener() {},
    removeEventListener() {}
  };
  window.window = window;
  const context = vm.createContext({
    window,
    console,
    document: window.document,
    localStorage,
    sessionStorage,
    navigator: window.navigator,
    location: window.location,
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
    URL,
    URLSearchParams,
    AbortController,
    fetch: fetchImpl || (() => Promise.reject(new Error('Network access is disabled in integration tests')))
  });
  context.window = window;
  vm.runInContext(readRepoText('js/api.js'), context, { filename: 'js/api.js' });
  return context;
}

export function createRouterContext(actor, handlers = {}, options = {}) {
  const calls = {};
  const handlerMap = Object.assign({}, handlers);
  const extra = Object.assign({
    RESPONSE_CODES,
    getSession() {
      return actor
        ? ok({ user: actor, sessionToken: 'synthetic-session' })
        : failure('Session expired', 'FORBIDDEN');
    },
    getUserById(userId) {
      const user = apiUserList.find(item => String(item.userId) === String(userId));
      return user ? ok(user) : failure('User not found', 'NOT_FOUND');
    },
    normalizeUserAccount(user) {
      return Object.assign({}, user);
    },
    sanitizeUser(user) {
      return Object.assign({}, user);
    },
    logWarning() {}
  }, handlerMap);
  Object.keys(handlerMap).forEach(name => {
    if (typeof handlerMap[name] !== 'function') return;
    extra[name] = function trackedHandler(...args) {
      calls[name] = (calls[name] || 0) + 1;
      return handlerMap[name].apply(null, args);
    };
  });
  const ctx = loadAppsScriptContext(['appscript/Response.gs', 'appscript/Permission.gs', 'appscript/Api.gs'], extra);
  ctx.__calls = calls;
  if (options.authFailure) {
    ctx.requireApiUser = function requireApiUserFailure() {
      return failure(options.authFailure.message || 'Session expired', options.authFailure.code || 'FORBIDDEN');
    };
  } else {
    ctx.requireApiUser = function requireApiUserSuccess() {
      return actor ? ok(actor) : failure('Session expired', 'FORBIDDEN');
    };
  }
  return ctx;
}
