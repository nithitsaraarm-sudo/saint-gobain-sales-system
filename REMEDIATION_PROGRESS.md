# Audit Remediation Progress — Saint-Gobain Sales System

Started: 2026-07-26  
Initial branch: `feature/product-promo-card-phase1`  
Remediation branch: `audit/full-remediation`  
Initial commit hash: `e659260c2f39fa34c9a7211a34ff35b872426450`  
Audit baseline commit: `0cb62334d62341a78ba6f3b1194ca42c985c1c47`

## Usage Budget Note

Codex weekly usage percentage is not exposed to the local repository tools used in this session.

If remaining weekly usage is shown as 30% or lower in the product UI, stop after the current phase is validated, committed, and this file is updated.

## Phase Status

| Phase | Status | Commit |
|---|---|---|
| Phase 0 — Initial repository check and audit baseline | Completed | `0cb62334d62341a78ba6f3b1194ca42c985c1c47` |
| Phase 1 — Critical Security Fixes | Completed | `4ed7abba5628b1f3b4dae490a2ae823e5586a7a3` |
| Phase 2 — Canonical RBAC and Permission Alignment | Completed | `064bdcf243e2fc26c6cbefa8a73964aa9d517071` |
| Phase 3 — Incomplete and Misleading Features | Completed | `8f306fdf9e67136332e0a5446852b158babd08c2` |
| Phase 4 — Version, Environment, and Deployment Configuration | Completed | `89f6b53e54f82bf2af2627ac6482b537ec50eb5b` |
| Phase 5 — External Script and Frontend Security Hardening | Completed | `fc256877e42a970cecf5353bac4c95868bbf0d2c` |
| Phase 6 — Apps Script Performance and Data Safety | Completed | `fb7e3e4cb59ebab9ebf50ed0a2c9608d652524c3` |
| Phase 7 — Frontend Cache and State Reliability | Completed | `2caeaca4fecec848dc7ef771a8d6080a50a6d79f` |
| Phase 8 — Controlled Maintainability Refactor | Pending | - |
| Phase 9 — UX Reliability and Accessibility | Pending | - |
| Phase 10 — Documentation Synchronization | Pending | - |
| Phase 11 — Test and Release Readiness | Pending | - |

## Initial Remediation Checklist

| Finding ID | Verified status | Files involved | Planned phase | Risk | Expected tests |
|---|---|---|---|---|---|
| C-1 | Verified valid: `loadQuotation()` returns cached data before permission check | `appscript/Quotation.gs`, `appscript/Api.gs`, `js/api.js` | Phase 1 | Critical | Static search confirms permission check before sensitive cache return; authorized/unauthorized quote access logic review |
| H-1 | Verified valid: `discount` action calls `getDiscount()` without customer scope validation | `appscript/Api.gs`, `appscript/Discount.gs`, `appscript/Customer.gs`, `js/api.js`, `js/quotation.js` | Phase 1 | High | Unauthorized customer discount rejected; local discount cache user-scoped |
| H-2 | Verified valid: authenticated read actions use JSONP GET with payload/session token in URL | `js/api.js`, `appscript/Code.gs` | Phase 1 | High | Authenticated API calls use POST where safe; no token-bearing URL logs |
| H-3 | Verified valid: Service Worker caches all GET responses and fallback can mask failed API/non-navigation requests | `service-worker.js`, `js/api.js`, `js/config.js` | Phase 1 | High | Static SW policy excludes Apps Script/API/token URLs; same-origin static assets remain cached |
| H-4 | Verified valid: concrete GAS Web App URL is hardcoded in frontend config path | `js/api.js`, `js/config.js`, `DEPLOYMENT.md` | Phase 4 | High | Static hosting compatible config pattern documented; no private credentials in frontend |
| H-5 | Verified valid: external CDN scripts have no SRI/crossorigin | `index.html` | Phase 5 | High | SRI or local vendored script strategy; app still loads export libraries |
| H-6 | Verified valid: MANAGER/VIEWER quotation permission behavior differs across frontend/backend/bootstrap/history/load | `appscript/Permission.gs`, `appscript/Api.gs`, `appscript/Code.gs`, `appscript/Quotation.gs`, `js/app.js`, `js/quotation.js` | Phase 2 | High | Canonical matrix documented and enforced backend-first |
| M-6 | Verified valid: `savePromotion()` returns success without persistence | `appscript/Code.gs`, `index.html`, `js/app.js` | Phase 3 | Medium | Promotion save cannot falsely report persistence |
| M-7 | Verified valid: app/cache versions differ across frontend/backend/assets | `js/config.js`, `js/api.js`, `appscript/Constants.gs`, `index.html`, `manifest.json`, `service-worker.js` | Phase 4 | Medium | Version search shows aligned release/cache strategy |
| M-11 | Verified valid: customer form options expose sales/area metadata broadly | `appscript/Customer.gs`, `appscript/Api.gs` | Phase 2 | Medium | Non-admin receives reduced data or forbidden response according to final policy |

## Phase 1 Plan

1. Move quotation authorization ahead of sensitive cached `loadQuotation` return.
2. Add discount customer-scope validation in API dispatch.
3. Scope frontend discount localStorage cache by authenticated user/session context.
4. Change authenticated API flow to use POST where compatible; keep JSONP only for public/read-only compatibility if needed.
5. Replace broad Service Worker GET caching with same-origin static-asset policy and navigation-only offline fallback.
6. Validate with static searches and available local checks.

## Phase 1 Completion Notes

Completed commit: `4ed7abba5628b1f3b4dae490a2ae823e5586a7a3`

Files changed:

- `appscript/Quotation.gs`
- `appscript/Api.gs`
- `js/api.js`
- `js/quotation.js`
- `service-worker.js`

Implemented fixes:

- Moved `loadQuotation()` authorization before server-side cached quotation returns.
- Added record identity verification before serving cached quotation data.
- Added API-level customer scope validation before the `discount` endpoint returns discount data.
- Removed frontend local quotation-cache returns that could bypass fresh backend authorization.
- Routed authenticated API requests through POST instead of JSONP GET so tokens and payloads are not placed in URLs.
- Kept JSONP compatibility only for `getPublicSystemSettings`.
- Scoped quotation discount cache by authenticated user/customer/business unit/group.
- Restricted the service worker to cache only the static asset allowlist and to use offline fallback only for navigation requests.

Validation results:

- `git diff --check` passed; only expected Windows LF/CRLF warnings were reported.
- `rg "apiJsonpGet\\(" .` shows JSONP is only reachable through the public-read branch and the helper definition.
- `rg "getCachedQuotation\\(|setCachedQuotation\\(|getLoadedQuotationCache\\(|setLoadedQuotationCache\\(" js\\api.js js\\quotation.js` shows quotation cache helpers are no longer called for load flow.
- `rg "cache=hit authorized=true|canAccessQuotationRecord|getServerCache\\(cacheKey\\)" appscript\\Quotation.gs` confirms `canAccessQuotationRecord()` runs before the load-quotation cache hit.
- `rg "case 'discount'|validateDiscountCustomerScope_|authorizeAction\\(getDiscount" appscript\\Api.gs` confirms discount API scope validation runs before `getDiscount()`.
- `rg "cache\\.put|caches\\.match|isApprovedStaticAsset|isSensitiveRequestUrl|isNavigationRequest" service-worker.js` confirms service worker caching is static-asset scoped.
- `where.exe node` failed because Node.js is not installed in this local environment; no JavaScript runtime test runner was available.

## Phase 2 Completion Notes

Completed commit: `064bdcf243e2fc26c6cbefa8a73964aa9d517071`

Files changed:

- `appscript/Permission.gs`
- `appscript/Api.gs`
- `appscript/Code.gs`
- `appscript/Quotation.gs`
- `appscript/Customer.gs`
- `js/app.js`
- `js/quotation.js`
- `index.html`
- `RBAC_PERMISSION_AUDIT.md`

Implemented fixes:

- Made backend permission helpers the canonical RBAC source for quotation create/edit/view/export, products, promotions, reports, customer form options, and customer assignment options.
- Chose and documented the MANAGER policy as oversight/read-only for quotation history/detail, reports, scoped customers, and settings profile.
- Removed MANAGER quotation-create/edit/cancel drift across API, Apps Script helpers, and frontend route/action guards.
- Kept VIEWER read-only and kept SALES quotation access constrained by existing ownership/customer-scope checks.
- Reduced customer assignment/sales-user metadata exposure so only SUPER_ADMIN/ADMIN receive assignment option lists.
- Aligned frontend buttons, routes, modal entry points, settings data-entry access, and quotation workflow actions with backend permission flags.
- Preserved area-based customer filtering and SUPER_ADMIN hierarchy protection.

Validation results:

- `git diff --check` passed; only expected Windows LF/CRLF warnings were reported.
- Static searches confirmed quotation create/edit permissions now exclude MANAGER while quotation view/history remains available to read roles.
- Static searches confirmed `products`, `searchQuoteProducts`, `loadQuotation`, `getQuotationHistory`, customer form options, and assignment-option API cases use canonical permission flags.
- Static searches confirmed frontend edit/cancel/duplicate/export/settings/data-entry visibility and direct-action guards use the same permission flags.
- Static searches confirmed the RBAC audit no longer contains outdated drift labels for the implemented MANAGER quotation policy.
- `where.exe node` failed because Node.js is not installed in this local environment; no JavaScript runtime test runner was available.

## Phase 3 Completion Notes

Completed commit: `8f306fdf9e67136332e0a5446852b158babd08c2`

Files changed:

- `appscript/Api.gs`
- `appscript/Code.gs`
- `appscript/Database.gs`
- `index.html`
- `js/api.js`
- `js/app.js`
- `js/auth.js`
- `js/config.js`

Implemented fixes:

- Replaced the `savePromotion()` stub with real Promotions sheet persistence using the existing Promotions schema.
- Added promotion normalization, validation, duplicate detection, active filtering, and audit logging.
- Kept promotion duplicate check and write inside one `ScriptLock` to avoid concurrent exact duplicates.
- Added authenticated `promotions` / `getPromotions` API actions and included viewable promotions in bootstrap data.
- Made forced bootstrap refresh bypass the server cache so a post-save refresh can show newly saved promotion data.
- Added Promotions sheet data cache key support and promotion cache clearing after writes.
- Hid Demo Login in production behind explicit `ENABLE_DEMO_LOGIN = false`; development mock demo remains possible only when explicitly enabled.
- Added `data-permission` UI guards so customer/product/promotion action buttons use backend-aligned permission flags instead of a broad admin-only `.main-action` rule.
- Prevented modal save success UI from closing/toasting success when the API returns failure.

Validation results:

- `git diff --check` passed; only expected Windows LF/CRLF warnings were reported.
- Static search confirmed the old `return success(payload || {}, 'Promotion saved')` stub is gone.
- Static search confirmed `savePromotion()` and `getPromotions()` are permission-gated and wired through `appscript/Api.gs`.
- Static search confirmed production Demo Login is hidden by `data-demo-login` plus `ENABLE_DEMO_LOGIN = false`, and `startTestMode()` rejects when not explicitly enabled.
- Static search confirmed add-data buttons now declare `data-permission` and `applyRolePermissions()` reads those flags.
- `where.exe node`, `where.exe deno`, and `where.exe bun` all failed because no local JavaScript runtime is installed; browser/runtime smoke tests must be run manually.

## Phase 4 Completion Notes

Completed commit: `89f6b53e54f82bf2af2627ac6482b537ec50eb5b`

Files changed:

- `DEPLOYMENT.md`
- `appscript/Constants.gs`
- `index.html`
- `js/api.js`
- `js/app.js`
- `js/config.js`
- `js/quotation.js`
- `manifest.json`
- `service-worker.js`

Implemented fixes:

- Established `0.5.25` as the canonical release/cache version for this remediation checkpoint.
- Centralized frontend runtime configuration in `window.APP_CONFIG` inside `js/config.js`.
- Aligned frontend `APP_VERSION`, backend `APP_VERSION`, service-worker cache name, manifest icon versions, script/style query strings, favicon query strings, logout icon query string, and brand-logo query strings.
- Moved the Apps Script Web App URL lookup out of `js/api.js` and into public runtime config (`window.GAS_WEB_APP_URL` via `APP_CONFIG.gasWebAppUrl`).
- Added API URL missing-configuration errors instead of allowing requests to silently target the wrong URL.
- Documented the static-hosting-compatible environment configuration pattern in `DEPLOYMENT.md`.
- Preserved PWA static-shell behavior while forcing a new service-worker cache namespace.

Validation results:

- `rg "0\\.5\\.(3|6|7|8|14|17|24)|20260720|0\\.4\\.0|sales-system-v5-0\\.5\\.24"` over app/frontend/deployment files returned no matches.
- `rg "0\\.5\\.25|APP_CONFIG|APP_VERSION|CACHE_NAME|manifest\\.json\\?v=|main\\.css\\?v=|GAS_WEB_APP_URL|API_URL_NOT_CONFIGURED"` confirmed the canonical version/config wiring.
- `git diff --check` passed; only expected Windows LF/CRLF warnings were reported.
- No private credentials were added; the Apps Script Web App URL remains public deployment configuration.

## Phase 5 Completion Notes

Completed commit: `fc256877e42a970cecf5353bac4c95868bbf0d2c`

Files changed:

- `SECURITY.md`
- `index.html`
- `js/app.js`

Implemented fixes:

- Added Subresource Integrity and `crossorigin="anonymous"` to the pinned `html2canvas@1.4.1` and `jspdf@2.5.1` CDN scripts.
- Added `jsStringLiteralAttr()` for safe inline JavaScript string-literal arguments used by active renderers that still rely on inline handlers.
- Escaped dynamic Sheet/API output in active promotion, dashboard text, quotation history, quotation detail, customer card, quotation customer picker, product card, product promotion, product preference, and active user admin render paths touched in this phase.
- Preserved backend/API/business logic and did not change permissions, routes, quotation save logic, or Apps Script schemas.
- Added a CSP migration note in `SECURITY.md` documenting why strict CSP should wait until inline handlers are migrated to delegated listeners.

Validation results:

- `git diff --check` passed; only expected Windows LF/CRLF warnings were reported.
- Static search confirmed both external CDN scripts now include `integrity` and `crossorigin`.
- Static search confirmed `escapeHtml(JSON.stringify(...))` no longer appears; active inline JavaScript string arguments now use `jsStringLiteralAttr()`.
- Static search still finds unsafe-looking patterns in legacy duplicate renderer definitions that are overridden later in `js/app.js`; full duplicate-definition cleanup remains pending for Phase 8 / Phase 10 to avoid mixing a broad refactor into this security-hardening phase.
- `where.exe node`, `where.exe deno`, and `where.exe bun` all failed because no local JavaScript runtime is installed; browser/runtime smoke tests must be run manually.

## Phase 6 Completion Notes

Completed commit: `fb7e3e4cb59ebab9ebf50ed0a2c9608d652524c3`

Files changed:

- `appscript/Database.gs`
- `appscript/Quotation.gs`
- `appscript/User.gs`
- `appscript/FavoriteCustomer.gs`
- `appscript/FavoriteProduct.gs`

Implemented fixes:

- Added shared Apps Script helpers to group row-object updates into contiguous `setValues()` calls instead of per-cell `setValue()` writes.
- Added shared grouped row deletion helper using `deleteRows(start, count)` for contiguous delete groups.
- Updated central `updateRowById()` so all callers benefit from batched row updates while still writing only explicitly changed columns.
- Updated quotation-specific `updateQuotationObject()`, quotation line cleanup, and quotation header rollback cleanup to use the shared batch helpers.
- Updated user sheet migrations to write affected columns in one column-range batch instead of calling `setValue()` inside row loops.
- Updated favorite customer/product removal cleanup paths to batch row deletes.
- Preserved schema, backend permission checks, quotation save locking, customer area scope, and API contracts.

Validation results:

- `git diff --check` passed; only expected Windows LF/CRLF warnings were reported.
- Static search confirmed the normal update path now uses `applyRowObjectUpdate_()` and `setValues([run.values])`.
- Static search confirmed grouped row delete paths now call `deleteSheetRowsByRowNumbers_()` and `deleteRows(start, count)`.
- Remaining `setValue()` / `deleteRow()` hits in the touched files are fallback branches or unrelated existing low-volume code paths.
- No JavaScript runtime or Apps Script local runner is installed in this environment; live Google Apps Script performance smoke tests must be run after deployment.

## Phase 7 Completion Notes

Completed commit: `2caeaca4fecec848dc7ef771a8d6080a50a6d79f`

Files changed:

- `js/api.js`
- `js/auth.js`
- `js/app.js`

Implemented fixes:

- Added owner/session scope metadata to private frontend localStorage caches.
- Scoped private cache records by app version, user id, role, area, and session-token suffix.
- Kept public system settings cache unscoped so login branding still works before authentication.
- Added `clearPrivateApiCaches()` to remove exact private cache keys and prefixed private cache keys such as user-scoped customer/discount caches.
- Called private-cache clearing and authenticated in-memory state reset on login/session replacement and logout.
- Added `resetAuthenticatedFrontendState()` to clear DB, cart, customers/products loaded flags, quote-history state, favorite customers, favorite/pinned products, product selection records, profile image temporary data, and pending detail promises.
- Updated app-version cache clearing to remove prefixed private caches as well as exact cache keys.

Validation results:

- `git diff --check` passed; only expected Windows LF/CRLF warnings were reported.
- Static search confirmed `setCache()` stores `scope: getCacheScope(cacheKey)` and `getCache()` rejects mismatched private scopes.
- Static search confirmed `saveSession()` and `clearSession()` call `clearPrivateApiCaches()` and `resetAuthenticatedFrontendState()`.
- Static search confirmed `clearAppCaches()` also clears private prefixed caches.
- No backend/API contract, permission logic, or database schema was changed.
- `where.exe node`, `where.exe deno`, and `where.exe bun` were previously confirmed unavailable; browser/runtime smoke tests must be run manually.

## Rollback Notes

Rollback preferred per phase:

```bash
git revert <phase-commit-hash>
```

Do not reset the entire repository.
