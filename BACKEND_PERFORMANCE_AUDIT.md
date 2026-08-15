# Backend Performance Audit — Login / Bootstrap

Date: 2026-08-13

Scope: backend-only audit and safe optimization for `login`, `bootstrap`, session validation, user lookup, Google Sheets reads used by bootstrap, effective Sales Target read, backend cache usage, backend logging overhead, and Apps Script timing diagnostics.

## Confirmed root causes / hotspots

1. `bootstrap` authenticated twice on the central API path.
   - `api('bootstrap', payload)` already called `requireApiUser(payload)`.
   - `getBootstrapData(payload)` then called `requireApiUser(payload)` again.
   - Each `requireApiUser()` calls `getSession()` and `getUserById()`, so the bootstrap request could repeat session validation and Users sheet lookup.

2. `SalesTargets` was not included in the shared `getSheetData()` cache-key map.
   - `salesTargetRows_()` uses `getSheetData(SALES_TARGETS_SHEET)`.
   - Before this change, `SalesTargets` returned no cache key, so the effective Sales Target read in bootstrap could hit Google Sheets on every bootstrap cache miss.

3. Bootstrap re-read settings/default settings helpers unnecessarily.
   - Bootstrap loaded `settings` and later called `getPublicSystemSettingsData_()`, which loaded settings again.
   - Bootstrap also called `getDefaultSystemSettings()` repeatedly for the same response object.

4. Runtime timing was too coarse for root-cause isolation.
   - Existing `[PERF] bootstrap <ms>` total timing existed, but it did not identify whether latency came from auth, Settings, Quote History, Quote Lines, Customers, Promotions, Products count, Sales Targets, cache read/write, or logging.

## Call graph before fix

### Login

```text
Frontend
→ apiPost('login')
→ doPost()
→ api('login')
→ loginUser()
→ loginUserCore()
→ isLoginLocked()
→ getUserByUsername()
→ listUserAccounts()
→ getSheetData(Users)
→ verifyPassword()
→ updateRowById(Users, lastLogin/updatedAt)
→ createSession()
→ CacheService.put()
→ ScriptProperties.setProperty()
→ logActivity(SystemLogs)
→ JSON success
```

Successful login intentionally still performs a `lastLogin` write and an audit log write. Those are audit/security behaviors and were not removed.

### Bootstrap before fix

```text
Frontend
→ apiPost('bootstrap')
→ doPost()
→ api('bootstrap')
→ requireApiUser()
→ getSession()
→ getUserById()
→ listUserAccounts()
→ getSheetData(Users)
→ getBootstrapData()
→ requireApiUser()      <-- duplicate auth/user lookup
→ getSession()
→ getUserById()
→ listUserAccounts()
→ getSheetData(Users)
→ getSystemSettings()
→ getSheetData(Settings)
→ getServerCache(bootstrap)
→ getBootstrapQuoteHistoryRows()
→ getSheetData(Quote History)
→ getBootstrapQuoteLineRows()
→ getSheetData(Quote Lines)
→ getCustomers()
→ getSheetData(Customers)
→ getPromotions()
→ getSheetData(Promotions)
→ countSheetDataRows(Products)
→ salesTargetRows_()
→ getSheetData(SalesTargets)  <-- uncached before fix
→ resolveEffectiveSalesTarget_()
→ setServerCache(bootstrap)
→ JSON success
```

## Call graph after fix

```text
Frontend
→ apiPost('bootstrap')
→ doPost()
→ api('bootstrap')
→ requireApiUser()
→ getSession()
→ getUserById()
→ listUserAccounts()
→ getSheetData(Users)
→ getBootstrapDataForAuthenticatedUser_(payload, user)
→ getBootstrapDataCore_(payload, user)
→ getSystemSettings()
→ getServerCache(bootstrap)
→ sheet reads only on bootstrap cache miss
→ salesTargetRows_()
→ getSheetData(SalesTargets) with shared sheet cache
→ setServerCache(bootstrap)
→ JSON success
```

Direct calls to `getBootstrapData(payload)` still authenticate themselves for backward compatibility.

## Google Sheets reads on bootstrap cache miss

Expected logical reads after this change:

| Step | Sheet / store | Cache behavior |
|---|---|---|
| API auth | Session CacheService / ScriptProperties | CacheService first; ScriptProperties fallback repopulates CacheService |
| API auth user lookup | Users | Existing `sheetData:users` cache |
| Settings | Settings | Existing settings sheet cache path |
| Quote history | Quote History | Still read from sheet path; not changed to avoid quotation cache-safety risk |
| Quote lines | Quote Lines | Still read from sheet path; not changed to avoid quotation cache-safety risk |
| Customers | Customers | Existing `sheetData:customers` cache |
| Promotions | Promotions | Existing `sheetData:promotions` cache |
| Product count | Products | Uses sheet `getLastRow()` only |
| Effective target | SalesTargets | New `sheetData:salesTargets` cache |

## Changes implemented

- Added backend performance trace helpers that log to `Logger.log()` only:
  - `createBackendPerformanceTrace_()`
  - `markBackendPerformanceStep_()`
  - `endBackendPerformanceTrace_()`
- Added login step timing:
  - input normalization
  - lock check
  - user lookup
  - status check
  - password verification
  - lastLogin write
  - session creation
  - audit log
- Added bootstrap step timing:
  - authenticated user ready
  - permission resolution
  - settings load
  - Sales Target cache version load
  - bootstrap cache check
  - quote history load/scope
  - quote line load
  - customer load
  - promotion load
  - counts
  - Sales Target row load
  - response build
  - bootstrap cache write
- Removed duplicate bootstrap authentication on the central API path by adding:
  - `getBootstrapDataForAuthenticatedUser_()`
  - `getBootstrapDataCore_()`
- Kept `getBootstrapData(payload)` as the public/backward-compatible authenticated wrapper.
- Added `SalesTargets` to `getSheetDataCacheKey()`.
- Updated `salesTargetInvalidateCaches_()` to clear the shared `SalesTargets` sheet cache when targets change.
- Updated `getPublicSystemSettingsData_()` to accept already-loaded settings/defaults while preserving old calls.
- Propagated internal user lookup timing metadata from `getUserByUsername()` and `getUserById()`.

## Security and scope confirmation

- No Sales KPI formulas changed.
- No Sales Target precedence/business rule changed.
- No RBAC or permission checks were removed.
- No auth/session hardening was weakened.
- No frontend orchestration or timeout value changed.
- No Quotation, Customer, Product, Promotion, Reports, PWA, or database schema behavior was intentionally changed.
- Timing logs do not include passwords, session tokens, authorization headers, or raw payloads.

## Static validation

- `git diff --check`: passed with Windows LF/CRLF warnings only.
- Static grep confirmed:
  - exactly one `case 'bootstrap'` in `appscript/Api.gs`
  - one public `getBootstrapData(payload)` wrapper
  - `getBootstrapDataForAuthenticatedUser_()` is used by `Api.gs`
  - `getBootstrapDataCore_()` is the shared implementation
  - `sheetData:salesTargets` cache key exists
  - `salesTargetInvalidateCaches_()` clears `SalesTargets` sheet cache

## Blocked runtime validation

Not run in this repository-only environment:

- Live Apps Script `login` timing.
- Live Apps Script `bootstrap` timing.
- Cache-hit/cache-miss timing comparison.
- Real Google Sheets row-count dependent measurement.
- Browser Network timing.
- Production/UAT deployed API tests.

Do not claim runtime performance improvement until Apps Script execution logs show before/after timing.

## Recommended runtime acceptance checks after deployment

1. Login as a normal active user and inspect Apps Script logs:
   - `[PERF_STEP] action=login ... user_lookup_finished`
   - `[PERF_STEP] action=login ... last_login_updated`
   - `[PERF_DONE] action=login status=SUCCESS`
2. Call bootstrap once with cache miss and inspect:
   - `[PERF_STEP] action=bootstrap ... auth_ready authMs=<number>`
   - no second `requireApiUser` path inside bootstrap core
   - `sales_target_rows_loaded`
   - `[PERF_DONE] action=bootstrap status=CACHE_MISS`
3. Call bootstrap again without `force`:
   - expected `[PERF_DONE] action=bootstrap status=CACHE_HIT`
4. Update a Sales Target:
   - next bootstrap uses the new Sales Target cache version and does not serve stale effective target data.

## Rollback

Rollback only files touched by this backend performance task:

```bash
git checkout -- appscript/Api.gs appscript/Auth.gs appscript/Code.gs appscript/Database.gs appscript/SalesTarget.gs appscript/User.gs WORK_HISTORY.md TEST_CASES.md
Remove-Item -LiteralPath BACKEND_PERFORMANCE_AUDIT.md
```

Use file-specific rollback only. Do not reset the whole repository.
