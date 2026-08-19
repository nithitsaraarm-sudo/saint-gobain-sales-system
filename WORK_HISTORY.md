## 2026-08-19 — Customer Agreement / Store Benefit Tracking V1

Scope completed:

- Added a separate Customer Agreement module for manual customer agreement and store-benefit tracking.
- Added additive sheet support for `CustomerAgreements`, `AgreementEntries`, and `AgreementAttachments`.
- Added central API routing for agreement list/detail/create/update/close/archive, entry create/update/deactivate, and attachment upload/delete.
- Added backend-owned calculations for achievement percent, pass/fail, benefit amount, and summary totals.
- Added customer-card UI entry point and responsive agreement list/detail modal with entry and attachment workflows.
- Preserved Customer area/assigned-sales scope, PC non-SALES behavior, VIEWER read/write restrictions, and existing quotation/customer/product/promotion logic.
- Added optimistic concurrency re-checks inside `LockService` critical sections before writes.
- Added unit and integration tests for formulas, validation, RBAC/API route contracts, and attachment validation.

Validation completed:

- `npm.cmd run check` passed.
- `npm.cmd run test:all` passed with 103/103 tests.
- `npm.cmd run verify` passed with 103/103 tests.

Runtime Apps Script deployment, live Google Sheets validation, Google Drive upload validation, desktop/mobile browser checks, iPhone Safari, Android Chrome, and PWA UAT remain required before release approval.

## 2026-08-18 — Deferred Runtime UAT Status

Scope completed:

- Audited release/status documentation after Phase 4 automated integration/API contract testing.
- Recorded the explicit project decision to defer Runtime UAT temporarily so development can continue.
- Preserved the release blocker: Runtime UAT must PASS before Pilot Go-Live and Production Go-Live.
- Updated status language so live/runtime tests remain **NOT RUN**, not PASS or source-verified.
- Preserved the current automated baseline: static validation PASS, unit tests PASS, integration/API contract tests PASS, total automated tests 92/92 PASS.
- No production runtime, API, backend, database, test harness, or tooling files were changed.

Gate status:

| Gate | Status |
|---|---|
| Development Gate | PASS |
| Release Gate | BLOCKED — Runtime UAT pending |

Deferred Runtime UAT status:

| Runtime validation | Status |
|---|---|
| Apps Script Live Backend | NOT RUN |
| Google Sheets Live Data | NOT RUN |
| Desktop Runtime UAT | NOT RUN |
| iPhone Safari | NOT RUN |
| Android Chrome | NOT RUN |
| PWA Runtime | NOT RUN |

## 2026-08-18 — Phase 4 Integration / API Contract Testing

Scope completed:

- Audited the current frontend API client (`js/api.js`), Apps Script API router (`appscript/Api.gs`), `doPost()` handoff (`appscript/Code.gs`), response helpers (`appscript/Response.gs`), permission helpers (`appscript/Permission.gs`), Customer API, Sales Target API, Product/Promotion write routes, and Quotation routes before changing files.
- Added zero-network integration tests using Node built-ins only (`node:test`, `node:assert/strict`, `node:vm`) and synthetic fixtures.
- Added API client contract coverage for success, legacy `success:true/result`, HTTP failure, empty response, invalid JSON, timeout/abort, network failure, `eventId` preservation, session context attachment, and empty-list vs error-state behavior.
- Added API router contract coverage for frontend/backend action-name parity, `getSalesTargetManagementData` routing through `dispatchSalesTargetAction_`, unknown action behavior, invalid-session rejection, authenticated `currentUser` injection, and frontend role/permission payload tampering denial.
- Added Customer contract coverage through the central router for SALES own-area create/update, cross-area denial, assignment tampering denial, VIEWER/PC write denial, and scoped customer list empty-state behavior.
- Added Sales Target contract coverage for configurable `GYPROC`/`WEBER`, filter-only `ALL`, historical `ALL`, duplicate active target conflict, stale/correct version update, legacy ALL deactivation/reactivation, SALES effective-target read vs management denial, PC denial, and no double-counting legacy ALL.
- Added Product/Promotion contract coverage preserving current read RBAC and direct API write denial for SALES/PC while ADMIN/SUPER_ADMIN remain allowed.
- Added Quotation contract coverage for save/update route shape, validation error preservation, view/history/duplicate/cancel guards, VIEWER read-only behavior, and PC denial.
- Added `npm run test:integration`, `npm run test:all`, and updated `verify` to run `check + test:all`.
- No production application, API, backend, database, Google Apps Script runtime behavior, or Google Sheet schema was changed.

Validation status at this point:

- `node -v` returned `v24.19.0`; `npm.cmd -v` returned `11.17.0`.
- `npm.cmd run check` passed locally.
- `npm.cmd run test` passed locally with 57/57 unit tests.
- `npm.cmd run test:integration` passed locally with 35/35 integration tests.
- `npm.cmd run test:all` passed locally with 92/92 total tests.
- Controlled failure validation passed: a temporary failing integration fixture caused `npm.cmd run test:integration` to exit non-zero, then the fixture was removed.
- `npm.cmd run verify` passed locally with `check + test:all` and 92/92 tests.
- `git diff --check` passed with line-ending warnings only.
- Live Apps Script, Google Sheets, desktop browser, iPhone Safari, Android Chrome, and PWA UAT remain not run by this phase.

Files added/modified in this phase are limited to test harnesses, fixtures, npm scripts, and documentation.

## 2026-08-18 — Phase 3.2.1 Customer Add Button Permission Sync

Scope completed:

- Audited Customer add entry points in `index.html`, frontend permission helpers in `js/app.js`, bootstrap permission state from `appscript/Code.gs`, and central API customer/Product/Promotion guards in `appscript/Api.gs`.
- Confirmed the Customer page `+ เพิ่มร้านค้า` button used generic `[data-permission]` handling while the Phase 3.2 customer modal/data-entry flow used `canManageCustomersUi()`, creating inconsistent UI permission behavior for SALES.
- Updated Customer UI permission resolution so `data-permission="canManageCustomers"` uses `canManageCustomersUi()` instead of the generic `permissionFlag(permission,false)` path.
- Updated the original `openModal('customer')` guard and `canEditCustomers()` to use `canManageCustomersUi()` directly, then removed the duplicate customer permission wrapper.
- Preserved Product/Promotion create restrictions for SALES, VIEWER/PC customer-create denial, and all Phase 3.2 backend area/assignment protections.
- Added frontend unit coverage for Customer page button visibility, Settings/Data Entry consistency, modal-open guard consistency, PC/VIEWER denial, and Product/Promotion denial for SALES.

Validation performed locally:

- Baseline before implementation: `npm.cmd run verify` passed with 53/53 tests.
- After implementation: `npm.cmd run check` passed.
- After implementation: `npm.cmd run test` passed with 57/57 tests.
- After implementation: `npm.cmd run verify` passed with 57/57 tests.
- After implementation: `git diff --check` passed; Git only reported line-ending normalization warnings.
- Confirmed `node_modules` and `package-lock.json` are absent, with no root temp/bak files detected.

Runtime Apps Script deployment, live Google Sheets validation, desktop/mobile browser checks, iPhone Safari, Android Chrome, and PWA UAT remain required.

## 2026-08-18 — Sales Target Management UI/UX cleanup

Scope completed:

- Removed the duplicate visible `All` Business Unit filter option by making `ALL` the single canonical filter value displayed as `ทุก BU`.
- Kept target create/edit Business Unit configuration limited to `GYPROC` and `WEBER`.
- Identified the previously reported unlabeled dropdown as `salesTargetArea`, sourced from `SALES_TARGET_OPTIONS.areas` and saved as payload field `salesArea`.
- Added explicit accessible names to Sales Target Add/Edit form controls while preserving visible `label for/id` associations.
- Hid and disabled the Month field for annual targets, made Month required only for monthly targets, and kept annual payloads normalized to blank `periodMonth`.
- Added unit coverage for annual period normalization, missing monthly month rejection, monthly/leap-year period calculation, and unique filter/configurable BU options.

No backend business logic, Sales Target RBAC, area scope, database schema, unrelated modules, or PWA versioning were changed. Browser/device UAT remains required after deployment.

## 2026-08-18 — Sales Target BU rule remediation

Scope completed:

- Separated configurable Sales Target Business Units from filter Business Units.
- Configurable target form/API Business Units are now `GYPROC` and `WEBER` only.
- `ALL` remains available as a filter/history value and historical `ALL` rows remain readable.
- Backend validation rejects new configurable `ALL` targets and rejects reactivation of legacy `ALL` targets.
- Effective Sales Target and management summaries now derive current totals from active `GYPROC + WEBER` only, excluding legacy `ALL` to avoid double counting.
- Frontend Sales Target create/edit UI removes `All` from normal target configuration and displays legacy `ALL` records as read-only BU entries.
- Added unit coverage for create/reject/filter/history/aggregation/duplicate/concurrency Sales Target rules and Dashboard Sales KPI total usage.

No data migration was added. Existing Google Sheet rows are not deleted, split, or rewritten automatically. Active legacy `ALL` rows, if present in production data, still require manual business review after deployment.

## 2026-08-18 — Automated unit tests for critical business logic

Scope completed:

- Added dependency-free Node built-in unit tests using `node:test` and `node:assert/strict`.
- Added a VM-based source loader so tests exercise existing production JavaScript and Apps Script functions without calling production APIs, Google Sheets, Drive, Gmail, Service Worker endpoints, or network resources.
- Covered quotation calculations/validation, Sales Target summaries/effective target resolution, Customer KPI, Business KPI, Sales KPI, Promotion status/date/summary logic, and shared normalization utilities.
- Added `npm run test`, `npm run test:unit`, and `npm run verify` while preserving Phase 2 `check:*` scripts.
- Ran controlled failing test validation; `node --test` failed with non-zero exit as expected and the temporary failing fixture was removed.
- Updated README, release readiness, and test catalogue with completed automated tests only.

Production source files were not modified. No third-party dependencies, `node_modules`, or `package-lock.json` were created.

Production bug / business-rule mismatch found but not fixed in this phase:

- Sales Target still exposes `ALL` as a configurable Business Unit in the UI/backend, while the approved Phase 3 rule expects only `GYPROC` and `WEBER` for new target configuration.

## 2026-08-18 — Minimal Node.js development validation tooling

Scope completed:

- Added a private, dependency-free `package.json` for development/static validation scripts only.
- Added Node built-in tooling for JavaScript syntax, Google Apps Script syntax via stdin, JSON parse validation, and local static asset reference validation.
- Preserved GitHub Pages/static frontend, Google Apps Script backend, Google Sheets data source, PWA, service worker, API contracts, RBAC, and all production runtime source.
- Ran positive validation for `check:js`, `check:gas`, `check:json`, `check:assets`, and aggregate `check`.
- Ran controlled negative tests with temporary invalid JS, Apps Script, JSON, and missing-asset fixtures; each failed as expected and temporary files were removed.
- Updated README, test catalogue, and release-readiness documentation without claiming CI, unit tests, browser automation, or runtime validation exists.

No npm dependencies, `node_modules`, or `package-lock.json` were created.

## 2026-08-18 — Quotation share file-only workflow

Scope completed:

- Audited quotation sharing in `js/quotation.js`, including `navigator.share`, generated share text helpers, clipboard fallback, PNG export, and PDF export paths.
- Root cause: quotation share included generated text/caption fields (`title` and `text`) in the Web Share payload, and fallback copied the same quotation summary text to the clipboard.
- Removed the legacy text-only `shareQuote()` implementation and duplicate share-text helper code.
- Updated the active quotation share workflow so native Web Share sends image files only via `{ files }`.
- Preserved PNG/PDF document generation and quotation export filenames.
- Preserved quotation save, pricing, permissions, API, backend, and database behavior.
- Updated fallback behavior to download generated quotation image pages only; fallback no longer copies quote/customer/total/system text.

Static validation was performed locally. Runtime native-share validation on iPhone Safari, Android Chrome, and installed PWA remains required after deployment.

## 2026-08-15 — Final release audit fixes before commit

Scope completed:

- Audited the dirty working tree on `audit/full-remediation` before staging.
- Confirmed `getSalesTargetManagementData` is wired from frontend action name to `appscript/Api.gs` central router and `dispatchSalesTargetAction_()`.
- Fixed Login UX release blocker: the Login button now exposes loading text, `aria-busy`, a polite live status region, disabled state, and duplicate-submit guard.
- Changed successful login to reveal the App shell immediately while bootstrap continues in the background.
- Kept password clearing in `finally` for login and added reset-password sensitive-field clearing.
- Fixed the disabled `resetPassword` route classification so the login-page Forgot Password flow returns the intended disabled response without requiring an existing session.
- Re-ran static release checks locally: `git diff --check`, action route duplicate scan, old runtime-version scan, button type scan, sensitive logging marker scan, and Service Worker asset existence scan.

Runtime Apps Script, Google Sheets, browser/device, and installed-PWA tests remain required after deployment.

## 2026-07-30 — Sales Target Management implementation (provided file set)

Completed:

- Replaced legacy Dashboard target reads from Settings with a dedicated `SalesTargets` entity.
- Added annual/monthly, BU, Area and individual Sales scope with historical rows.
- Added backend list/detail/effective/create/update/status APIs, backend RBAC, Area scope, validation, duplicate-active conflict checks, ScriptLock, optimistic versioning and event IDs.
- Added effective-target precedence and combined Gyproc/Weber behavior.
- Added Settings → Sales Target Management UI, filters, summaries, responsive cards, accessible form, loading/empty/error states and double-submit protection.
- Added centralized `calculateSalesKpi()` with elapsed-period forecast, nullable achievement, remaining and required monthly average.
- Added target-specific frontend cache keys and invalidation.
- Updated API, RBAC, release and test documentation.

Files changed/added:

- `appscript/SalesTarget.gs` (new)
- `appscript/Code.gs`
- `appscript/Database.gs`
- `js/api.js`
- `js/app.js`
- `index.html`
- `css/main.css`
- `service-worker.js`
- `API.md`
- `RBAC_PERMISSION_AUDIT.md`
- `RELEASE_NOTES_V1.md`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Static checks were executed on the provided file set. Live Apps Script, Google Sheets, browser/device and installed-PWA tests remain Not Run.

# Saint-Gobain Sales System - Work History

## 2026-07-30 — Customer KPI SSOT audit and fix

Scope completed:

- Fixed Customer KPI without changing Customer API, RBAC, area permissions, assigned-sales permissions, Dashboard layout, or business modules.
- Root cause: Total Customer could use `DB.counts.customers` while category counts used an empty lazy-loaded `DB.customers` array. Dashboard was not re-rendered after customer load.
- Added `calculateCustomerSummary()` as the single calculation source.
- Added centralized active-state resolution supporting current and legacy status fields.
- Missing/unknown status defaults to Active for backward compatibility.
- Added customer creation-date parser supporting ISO, Google Sheet-style dates, Thai digits, and Buddhist years.
- New Customer uses creation fields only and no longer falls back to `updatedAt`.
- Added Dashboard customer-load trigger and Dashboard re-render after customer cache/API refresh.
- Category values show `—` while records are loading instead of false zeroes.
- Aggregation now uses one O(n) customer pass.
- Bumped frontend version/cache generation to `0.5.57` / `20260730-03`.

Files changed:

- `js/app.js`
- `js/version.js`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Runtime browser/PWA/API tests remain required after deployment.

## 2026-07-30 — Production-ready centralized Version Management System

Scope completed:

- Added `js/version.js` as the only application version definition.
- Added immutable `globalThis.APP_INFO` fields for application version, build, release channel, and cache generation.
- Replaced Home, footer, About/version dialog, console diagnostics, browser asset query strings, manifest URL, and Service Worker cache naming with `APP_INFO`.
- Added safe `Unknown` fallbacks when the version source cannot be loaded.
- Added version-aware loading for local CSS, JavaScript, manifest, favicons, and touch icons.
- Updated the Service Worker to import the same version source, generate its cache name from `APP_INFO.cacheVersion`, remove legacy Saint-Gobain caches during activation, skip waiting, claim clients, and reload once after controller change.
- Removed version query strings from `manifest.json`; the manifest contains no duplicated version value.
- Preserved routing, authentication, RBAC, quotation, customer, promotion, Dashboard, API, Google Apps Script, and business logic.
- Removed literal historical semantic-version values from this working-history file so repository version scans identify only the centralized version source.

Files changed:

- `js/version.js` (new)
- `index.html`
- `js/app.js`
- `css/main.css`
- `manifest.json`
- `service-worker.js`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Static validation completed:

- Central version literal exists only in `js/version.js`.
- Runtime files contain no hardcoded semantic version values.
- Home, footer, version dialog, and console read from `APP_INFO`.
- Service Worker cache name reads from `APP_INFO.cacheVersion`.
- Manifest icon paths contain no version query strings.
- Existing sensitive-request and approved-static-asset cache guards remain in place.

Runtime validation still required:

- Desktop Chrome/Edge.
- iPhone Safari.
- Android Chrome.
- Installed PWA update from the previous cache generation.
- Offline launch after the new Service Worker has activated.

Rollback:

```powershell
git checkout -- index.html js/app.js css/main.css manifest.json service-worker.js TEST_CASES.md WORK_HISTORY.md
Remove-Item js/version.js
```

# Saint-Gobain Sales System - Work History

## 2026-07-30 — Announcement/News frontend setting

Scope completed in the provided file set:

- Added the dedicated `setAnnouncementText` textarea to the existing SUPER_ADMIN System Greeting / News settings section.
- Added `maxlength=500`, multiline input, helper text, accessible live character counter, and mobile-safe textarea styling.
- Loaded `DB.settings.announcementText` into the form with backward-compatible empty-string normalization.
- Added trimmed `announcementText` to the existing `updateSettings` payload.
- Preserved entered form values when save fails and retained the existing loading/error/success flow.
- Added a duplicate-submission guard and `aria-busy` state to the existing save button.
- Changed the Home News card to render only `announcementText` by `textContent`; it no longer reuses `welcomeText`.
- Added the empty state `ยังไม่มีข่าวสารหรือประกาศจากระบบ`.
- Added safe multiline rendering with `white-space: pre-line` and `overflow-wrap: anywhere`.
- Preserved the existing welcome/hero behavior controlled by `welcomeText`.

Files changed:

- `index.html`
- `js/app.js`
- `css/main.css`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Validation completed:

- Static syntax/structure checks passed for the modified frontend files.
- Static checks confirmed the Home announcement path no longer reads `welcomeText`.
- Static checks confirmed the textarea, 500-character limit, helper text, counter, plain-text rendering, empty state, trimming, duplicate-submit guard, and bootstrap cache invalidation are present.

Not completed because the provided file set did not include Apps Script/backend files:

- Server allowlist/schema/default validation.
- Google Sheet Settings storage migration/support.
- Live SUPER_ADMIN authorization verification.
- Live API, browser, iPhone Safari, Android, and installed PWA execution.

Rollback command for the provided frontend/documentation scope:

```powershell
git checkout -- index.html js/app.js css/main.css TEST_CASES.md WORK_HISTORY.md
```


## 2026-07-30 — Sidebar route-key navigation hardening

Scope:

- Audited and hardened sidebar navigation after the navigation label/constants changes.
- Ensured sidebar routing uses unique route keys, not display labels, array index, or label keys.
- Preserved existing route names, page ids, RBAC, area permission, backend APIs, Apps Script code, Google Sheet schema, quotation logic, and PWA behavior.

Audit result:

- Sidebar navigation is rendered from `NAVIGATION_ITEMS` in `js/app.js`.
- Mobile drawer reuses the same sidebar DOM and does not have a separate renderer.
- Breadcrumb renderer was not found in the repository.
- The previous navigation metadata used one overloaded `page` field as the route/page id.
- The sidebar renderer embedded inline `onclick="go(...)"` directly from that overloaded field.
- Active menu state trusted a passed button in `go()` without verifying that the button route matched the requested target.
- No index-based navigation was found, but the route contract was not explicit enough to prevent wrong-target regressions.

Implementation:

- Updated `NAVIGATION_ITEMS` to use explicit `id` and `route` fields.
- Rendered sidebar buttons with:
  - `data-nav-id`
  - `data-route`
  - backward-compatible `data-page`
- Removed inline sidebar navigation `onclick` from generated nav buttons.
- Added delegated sidebar click handling through `bindSidebarNavigationEvents()`.
- Navigation clicks now read only the immutable `data-route`.
- Hardened `getNavButtonForPage()` and `applyRolePermissions()` to use `getNavigationButtonRoute()`.
- Hardened `go()` so a passed button is used for active state only when its route matches the target route.
- Added non-blocking `validateNavigationConfiguration()` checks for duplicate routes and missing page DOM targets.
- Bumped runtime/cache version to `[legacy version]`.
- Updated `TEST_CASES.md` with `REG-STATIC-006`.

Files changed:

- `index.html`
- `js/app.js`
- `js/api.js`
- `js/config.js`
- `service-worker.js`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Expected route map:

- `หน้าหลัก` → `home` → `#page-home`
- `Dashboard` → `dashboard` → `#page-dashboard`
- `ออกใบเสนอราคา` → `quote` → `#page-quote`
- `ร้านค้า` → `customers` → `#page-customers`
- `สินค้า` → `products` → `#page-products`
- `โปรโมชั่น` → `promos` → `#page-promos`
- `ประวัติใบเสนอราคา` → `quotes` → `#page-quotes`
- `ผู้ใช้งาน` → `users` → `#page-users`
- `รายงาน` → `report` → `#page-report`
- `ตั้งค่า` → `settings` → `#page-settings`

Validation notes:

- Static scan confirmed every `NAVIGATION_ITEMS` entry has explicit `id` and `route`.
- Static scan confirmed generated sidebar buttons use `data-route`.
- Static scan confirmed `bindSidebarNavigationEvents()`, `getNavigationButtonRoute()`, and route-safe active logic are present.
- Static scan confirmed runtime files use `[legacy version]`; no stale `[legacy version]` strings remain in checked runtime files.
- `git diff --check` passed with only line-ending warnings.
- Runtime browser/device/PWA validation is still required for desktop clicks, mobile drawer clicks, browser Back/Forward, refresh, and installed PWA.
- Rollback command for this phase:

```powershell
git checkout -- index.html js/app.js js/api.js js/config.js service-worker.js TEST_CASES.md WORK_HISTORY.md
```

## 2026-07-30 — Centralized navigation labels constants

Scope:

- Created a single shared navigation label source of truth for main application navigation.
- Centralized approved labels:
  - `home`: `หน้าหลัก`
  - `dashboard`: `Dashboard`
  - `newQuotation`: `ออกใบเสนอราคา`
  - `customers`: `ร้านค้า`
  - `products`: `สินค้า`
  - `promotions`: `โปรโมชั่น`
  - `quotationHistory`: `ประวัติใบเสนอราคา`
  - `users`: `ผู้ใช้งาน`
  - `reports`: `รายงาน`
  - `settings`: `ตั้งค่า`
- Preserved existing route keys, RBAC, area permission, backend APIs, Apps Script code, Google Sheet schema, quotation logic, and PWA behavior.

Audit result:

- Sidebar navigation labels were duplicated in `index.html` across visible text, `title`, and `aria-label`.
- Home quick actions duplicated the same navigation text in `js/app.js`.
- Main module page headings duplicated navigation labels in `index.html`.
- Mobile navigation reuses the same sidebar DOM, so one sidebar renderer covers both desktop and mobile drawer.

Implementation:

- Added `NAVIGATION_LABELS`, `NAVIGATION_ITEMS`, and route-to-label mapping in `js/app.js`.
- Added helpers:
  - `getNavigationLabel()`
  - `getNavigationLabelForPage()`
  - `renderSidebarNavigation()`
  - `applyNavigationLabels()`
- Replaced hardcoded sidebar button markup with `#mainNavigation`, rendered from `NAVIGATION_ITEMS`.
- Replaced module page headings with `data-nav-label` bindings.
- Updated Home primary quotation action and Home quick actions to use navigation label keys.
- Exported navigation constants/helpers on `window` for frontend reuse/debugging.
- Bumped runtime/cache version to `[legacy version]`.
- Updated `TEST_CASES.md` with `REG-STATIC-005`.

Files changed:

- `index.html`
- `js/app.js`
- `js/api.js`
- `js/config.js`
- `service-worker.js`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Validation notes:

- Static scan confirmed `NAVIGATION_LABELS`, `NAVIGATION_ITEMS`, `renderSidebarNavigation()`, and `applyNavigationLabels()` are present.
- Static scan confirmed `#mainNavigation` is now the sidebar container and hardcoded sidebar label markup was removed.
- Static scan confirmed page headings use `data-nav-label` bindings.
- Static scan confirmed runtime files use `[legacy version]`; no stale `[legacy version]` strings remain in checked runtime files.
- `git diff --check` passed with only line-ending warnings.
- Runtime browser/device/PWA validation is still required on Desktop Chrome/Edge, Android Chrome, iPhone Safari, and installed PWA.
- Rollback command for this phase:

```powershell
git checkout -- index.html js/app.js js/api.js js/config.js service-worker.js TEST_CASES.md WORK_HISTORY.md
```

## 2026-07-30 — New Home command center and Dashboard route split

Scope:

- Created a new Home page as a work-starting command center.
- Moved the existing KPI Dashboard UI to its own `dashboard` route.
- Preserved existing Dashboard metric calculations, quotation/customer/product data sources, and business logic.
- Preserved backend APIs, Apps Script code, Google Sheet schema, RBAC policy, area permissions, authentication, quotation logic, and pricing logic.

Audit result:

- Previous default page was `#page-home`, and `#page-home` rendered the KPI Dashboard.
- The Dashboard renderer was `renderHomeDashboardRedesign()` in `js/app.js`, using `buildDashboardMetrics()`.
- Sidebar/mobile drawer navigation is static markup in `index.html`; mobile reuses the same sidebar DOM.
- The primary navigation function was `go(page, btn)` with no page hash/pushState route support.
- Existing browser history usage was limited to the mobile sidebar drawer.
- No breadcrumb renderer was found.
- `document.title` is only set from company/system identity settings.
- PWA `start_url` remains `./index.html`; service worker serves navigation fallback to cached `index.html`.

Implementation:

- Added `หน้าหลัก` navigation item for the new Home page.
- Added `Dashboard` navigation item for the existing KPI Dashboard.
- Created `#page-home` command center sections:
  - personalized greeting
  - current user/profile chip
  - Gyproc and Weber branding
  - primary “ออกใบเสนอราคาใหม่” action
  - permission-aware quick actions
  - system version / announcement / existing record summary
- Created `#page-dashboard` for the existing KPI Dashboard shell.
- Updated `ensureDashboardLayout()` to target `#page-dashboard`.
- Kept Dashboard calculations on the existing `buildDashboardMetrics()` / `renderHomeDashboardRedesign()` path.
- Added `renderDashboard()` as the Dashboard renderer while `renderHome()` now renders the command center.
- Added minimal hash route support:
  - default route: `home`
  - Dashboard route: `dashboard`
  - existing module routes remain unchanged
  - route helpers support refresh/back-forward through `#home`, `#dashboard`, etc.
- Quick actions call existing routes only and are filtered with `canAccessPage()`.
- Added scoped Home CSS only; no global button/card rules were changed.
- Bumped runtime/cache version to `[legacy version]`.

Files changed:

- `index.html`
- `js/app.js`
- `css/main.css`
- `js/api.js`
- `js/config.js`
- `service-worker.js`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Validation notes:

- Static scan confirmed `#page-home` contains the new command center and `#page-dashboard` contains the Dashboard shell.
- Static scan confirmed `data-page="home"` / `go('home')`, `data-page="dashboard"` / `go('dashboard')`, and `data-page="users"` / `go('users')` are present.
- Static scan confirmed `ensureDashboardLayout()` targets `page-dashboard`.
- Static scan confirmed Dashboard still uses `buildDashboardMetrics()` and `renderHomeDashboardRedesign()`.
- Static scan confirmed runtime files use `[legacy version]`; no stale `[legacy version]` strings remain in checked runtime files.
- `git diff --check` passed with only line-ending warnings.
- `node --check js/app.js` could not run because Node.js is not available in this environment.
- Runtime browser/device/PWA validation is still required on Desktop Chrome/Edge, Android Chrome, iPhone Safari, and installed PWA.
- Rollback command for this phase:

```powershell
git checkout -- index.html js/app.js css/main.css js/api.js js/config.js service-worker.js TEST_CASES.md WORK_HISTORY.md
```

## 2026-07-29 - Quotation local draft expiration

### Branch

`audit/full-remediation`

### Files changed

- `js/quotation.js`
- `TEST_CASES.md`
- `REMEDIATION_PROGRESS.md`
- `WORK_HISTORY.md`

### Summary

- Added a 14-day TTL policy for local quotation drafts.
- Draft expiration runs before the recovery modal is shown.
- Expired, invalid-timestamp, missing-timestamp, empty, and corrupted current-user draft entries are removed silently from the exact scoped `localStorage` key.
- Future timestamps are logged and allowed to continue existing recovery behavior.
- Valid draft recovery, autosave, saved quotations, quotation APIs, Google Sheets, and quotation numbering were not changed.
- Added manual/browser/PWA test coverage rows `DRAFT-TTL-01` through `DRAFT-TTL-12`.

## 2026-07-29 - V1 final pre-release audit documentation package

### Branch

`audit/full-remediation`

### Files changed

- `FINAL_V1_PRE_RELEASE_AUDIT.md`
- `UAT_CHECKLIST.md`
- `PILOT_GO_LIVE_PLAN.md`
- `KNOWN_ISSUES.md`
- `RELEASE_NOTES_V1.md`
- `ROLLBACK_PLAN_V1.md`
- `RELEASE_READINESS.md`
- `TEST_CASES.md`
- `RBAC_PERMISSION_AUDIT.md`
- `SECURITY.md`
- `REMEDIATION_PROGRESS.md`

### Summary

- Performed a final static pre-release audit of the V1 candidate at version `[legacy version]`.
- Recorded release decision as `NOT READY` for real-user UAT/Pilot because runtime API, RBAC, mobile/PWA, production smoke, concurrency, and backup/restore evidence is still blocked/not run.
- Created business-readable UAT checklist, pilot plan, release notes, known issues, and rollback plan.
- No application code, API behavior, database schema, permissions, or configuration was changed in this phase.

ไฟล์นี้ใช้เก็บประวัติการทำงานเชิงพัฒนา เพื่อส่งต่อให้ Codex/ผู้พัฒนาคนถัดไปเข้าใจบริบทล่าสุดได้เร็วกว่าอ่าน diff ทั้งหมด

> หมายเหตุ: `CHANGELOG.md` มีอยู่แล้วและเหมาะสำหรับบันทึกการเปลี่ยนแปลงระดับ release ส่วนไฟล์นี้ใช้เป็น working notes / handoff notes ระหว่างพัฒนา

## 2026-07-14 - Favorite and pinned products for quotation product picker

### Branch

`feature/favorite-and-pinned-products`

### Files changed

- `appscript/FavoriteProduct.gs`
- `appscript/Api.gs`
- `appscript/Product.gs`
- `appscript/Constants.gs`
- `appscript/Config.gs`
- `appscript/Database.gs`
- `js/api.js`
- `js/app.js`
- `js/quotation.js`
- `css/main.css`

### Summary

- Added per-user product preference sheets: `UserFavoriteProducts` and `UserPinnedProducts`.
- Added API actions: `getProductPreferences`, `addFavoriteProduct`, `removeFavoriteProduct`, `addPinnedProduct`, `removePinnedProduct`, and `reorderPinnedProducts`.
- Favorite products are limited to 20 per user; pinned products are limited to 5 per user.
- Product preferences are scoped to the current session user via `requireApiUser()`.
- Pinned products sort above normal quote product search results, then favorite products, while preserving the existing BU-aware ranking.
- Quotation product picker now renders pinned/favorite sections, toggle buttons, and add-to-quote through the existing quote flow.
- Pinned products can be reordered by drag/drop and long-press drag on touch devices; order persists via `reorderPinnedProducts`.
- Viewer role can view preference data but does not see quote edit/add/pin/favorite actions.
- Added SystemLogs actions: `FAVORITE_PRODUCT_ADDED`, `FAVORITE_PRODUCT_REMOVED`, `PINNED_PRODUCT_ADDED`, `PINNED_PRODUCT_REMOVED`, and `PINNED_PRODUCT_REORDERED`.

### Notes

- No localStorage is used as the primary preference database.
- Existing pricing, discount, promotion, add-to-cart, and quotation save logic remain connected to the original quote flow.
- `index.html` was not changed; `js/app.js` creates the preference containers near `productPicker` if they are missing.
- `js/quotation.js` keeps `window.renderProductPicker` pointed at the enhanced picker after script load order applies.

## 2026-07-14 - Scroll to newly added quotation item

### Branch

`feature/scroll-to-added-quote-item`

### Files changed

- `js/quotation.js`
- `css/main.css`
- `WORK_HISTORY.md`

### Summary

- Connected the existing `addProduct(productId, qty)` flow to auto-scroll after a product is added.
- The target quote item uses existing `lineId` and `.quote-line[data-line-id]`, not product name or productId.
- Duplicate products keep the existing merge behavior: quantity increases on the existing line and scroll targets that same line.
- New products scroll to the newly created line after `renderCart()` completes.
- Async discount refreshes re-render the cart and re-scroll only if that line is still the latest requested target.
- Added bounded retry after DOM render using `requestAnimationFrame()` plus short retry delay.
- Added race-condition guard with `QUOTE_ITEM_SCROLL_SEQUENCE` and `QUOTE_ITEM_PENDING_SCROLL_LINE_ID`.
- Added temporary highlight class `.is-newly-added`.
- Added `scroll-margin-top` / `scroll-margin-bottom` to avoid fixed/sticky UI covering the card.

### Test checklist

- Add first product, verify it scrolls to the item card and highlights.
- Add product from lower search results, verify the newly added card is visible.
- Add the same product again, verify quantity increases and scroll stays on the existing line.
- Rapidly add multiple products, verify the latest clicked product wins the scroll.
- Verify quantity, discount, free item, totals, save draft, update quotation, PDF, PNG, and drag reorder still work.

## 2026-07-14 - User role, area, password confirmation, and quotation seller snapshot

### Branch

`feature/user-role-area-permissions`

### Files changed

- `appscript/User.gs`
- `appscript/Auth.gs`
- `appscript/Config.gs`
- `appscript/Database.gs`
- `appscript/Quotation.gs`
- `js/app.js`
- `js/quotation.js`
- `css/main.css`
- `index.html`

### Summary

- Added `area` to Users while keeping legacy `branch` as fallback.
- Added safe Users migration for `branch -> area`, `displayName -> fullName`, and blank `quoteDisplayName -> fullName`.
- Added role hierarchy helpers: `getRoleLevel`, `canManageRole`, `canCreateRole`, and `canEditUserRole`.
- Enforced server-side user management:
  - ADMIN can create/edit only lower roles.
  - ADMIN cannot manage ADMIN or SUPER_ADMIN.
  - SUPER_ADMIN can manage other users including SUPER_ADMIN.
  - Users cannot change their own role/status via `updateUser()`.
  - Last active SUPER_ADMIN cannot be disabled or demoted.
- Added Area scope checks for `loadUsers()`, `createUser()`, and `updateUser()`.
- Added create/update validation for required full name, required Area, confirm password, duplicate email, and password matching.
- Added session revocation when an admin resets password or changes user status away from Active.
- Updated Users UI with Thai labels, Area field, confirm password, show/hide password buttons, role-filtered dropdown, and save-button disabled state.
- Added quotation seller snapshot fields: `quoteDisplayName`, `createdByUserId`, `createdByUsername`, and `updatedByUsername`.
- Quotation preview/PDF/PNG now prefer the `quoteDisplayName` snapshot and fall back to legacy `createdBy`.

### Verification notes

- `git diff --check` passed.
- `node --check` could not run because `node` is not installed in this environment.
- Manual Apps Script deployment and browser testing are still required.

## 2026-07-14 - Quotation reorder, cross-BU quotation, and deployment note

### Branch ล่าสุด

`feature/card-long-press-reordering`

### สถานะ Worktree

มีไฟล์แก้ค้างจากหลายงานก่อนหน้าอยู่ใน worktree จึงควรตรวจ `git status` และแยก commit ตาม scope ก่อน push/merge

### งานล่าสุด: ปรับระบบเรียงลำดับสินค้าในหน้า “ออกใบเสนอราคา”

ไฟล์หลักที่เกี่ยวข้อง:

- `js/quotation.js`
- `css/main.css`
- `appscript/Quotation.gs`
- `appscript/Database.gs`

ทำแล้ว:

- ลบปุ่ม drag handle รูปขีด 3 เส้น `.quote-drag-handle` ออกจาก UI cart
- ใช้ตัวการ์ดสินค้า `.quote-line` เป็นพื้นที่ลากแทน
- ใช้ Pointer Events เดิม ไม่ได้เพิ่ม SortableJS
- Touch device ต้องกดค้างประมาณ `380ms` ก่อนเริ่มลาก
- Desktop ลากด้วย mouse จากพื้นที่ว่างบน card ได้
- ป้องกันไม่ให้เริ่ม drag จาก controls:
  - `button`
  - `input`
  - `select`
  - `textarea`
  - `a`
  - `label`
  - `[data-no-drag]`
- เพิ่ม auto-scroll ระหว่างลากใกล้ขอบจอ
- เพิ่ม visual states:
  - `card--drag-ready`
  - `card--chosen`
  - `card--dragging`
  - `card--ghost`
- เพิ่ม hint ครั้งแรก:
  - “กดค้างที่การ์ดแล้วลากเพื่อเรียงสินค้า”
- เพิ่ม keyboard fallback:
  - focus ที่ card แล้วกด `Alt + ↑/↓`
- หลัง drop จะ update `CART` จริง และ renumber:
  - `lineNo`
  - `lineOrder`
  - `sortOrder`

### การ persist ลำดับสินค้า

- Frontend ส่ง `lineNo`, `lineOrder`, `sortOrder` ใน quotation payload
- Backend เพิ่ม QuoteLines headers:
  - `lineOrder`
  - `sortOrder`
- `saveQuotationPayload()` เขียน `lineOrder/sortOrder`
- `addQuotationItem()` legacy flow เติม `lineNo/lineOrder/sortOrder`
- `loadQuotation()` ฝั่ง Apps Script sort lines ด้วย:
  - `lineOrder || sortOrder || lineNo`
- Quote เก่าที่ไม่มี field ใหม่ fallback จาก `lineNo`/ลำดับแถวเดิม

### งานก่อนหน้า: Cross-BU product search / mixed BU quotation

ไฟล์หลักที่เกี่ยวข้อง:

- `appscript/Product.gs`
- `appscript/Quotation.gs`
- `appscript/Database.gs`
- `appscript/Api.gs`
- `js/api.js`
- `js/app.js`
- `js/quotation.js`
- `css/main.css`

ทำแล้ว:

- ค้นหาสินค้าใน quote ได้ทุก BU
- เรียงสินค้าของ BU หลักก่อน แล้วค่อย BU อื่น
- เพิ่ม `productBusinessUnit` ใน product/quote lines
- QuoteLines เพิ่ม `productBusinessUnit`
- Product picker และ cart แสดง badge Weber/Gyproc
- ถ้าสินค้าคนละ BU แสดง note “สินค้าร่วมข้าม BU”
- ไม่ block การเพิ่มสินค้าข้าม BU แล้ว
- เอกสารแสดง `Weber / Gyproc` ถ้ามีสินค้าหลาย BU
- discount cache ฝั่ง browser แยกด้วย:
  - `customerId | productBusinessUnit | groupCode`

### Bug ล่าสุดที่พบ: Apps Script error `window is not defined`

Error:

```text
ReferenceError: window is not defined
Quotation.gs:2230
```

สาเหตุ:

- ใน repo `appscript/Quotation.gs` มีประมาณ 1284 บรรทัดและไม่มี `window`
- เลขบรรทัด `2230` ตรงกับท้ายไฟล์ `js/quotation.js`
- สันนิษฐานว่าไฟล์ frontend `js/quotation.js` ถูก Apps Script parse/รันใน server context หรือถูกคัดลอกขึ้นเป็น `.gs`
- Apps Script server ไม่มี browser global เช่น `window`

แก้แล้วใน `js/quotation.js`:

```js
if (typeof window !== 'undefined') {
  window.renderQuote = renderQuote;
  // ...
}
```

ข้อควรระวัง:

- อย่า copy `js/quotation.js` ไปเป็น Apps Script `.gs` server-side โดยตรง
- Apps Script server ควรมีเฉพาะไฟล์ใน `appscript/*.gs`
- Frontend JS ควรอยู่ฝั่ง static app / GitHub Pages / HTML client เท่านั้น
- ถ้ามี deployment pipeline รวมไฟล์ผิด ต้องแก้ pipeline ไม่ให้ frontend JS ไปอยู่ใน `.gs`

### คำสั่งตรวจสอบที่ใช้บ่อย

```powershell
git status --short
git branch --show-current
git diff --check -- js\quotation.js appscript\Quotation.gs
rg -n "\bwindow\b|document\.|navigator\.|localStorage|html2canvas|jspdf" appscript\Quotation.gs appscript js\quotation.js
rg -n "quote-drag-handle|lineOrder|sortOrder|quote-reorder-hint|touchDelayMs|noDragSelector" js\quotation.js css\main.css appscript\Quotation.gs appscript\Database.gs
```

### Test checklist

Desktop:

- Chrome/Edge ลาก card เพื่อ reorder ได้
- input discount ยังพิมพ์ได้
- ปุ่ม `+/-` ยังทำงาน
- checkbox สินค้าแถมยังทำงาน
- ปุ่มลบยังทำงาน

Mobile:

- แตะสั้นไม่เริ่มลาก
- กดค้างประมาณ `380ms` แล้วลากได้
- scroll หน้ายังทำงาน
- auto-scroll ระหว่างลากได้
- ไม่เกิด pull-to-refresh ระหว่างลาก

Data / Export:

- Save Draft แล้วเปิดกลับมา ลำดับตรง
- Update Quote แล้วลำดับตรง
- Preview / PDF / PNG ใช้ลำดับเดียวกัน
- Quote เก่าเปิดได้
- สินค้า Weber + Gyproc ใน quote เดียวกันยังทำงาน
- ยอดเงินไม่เปลี่ยนจากการ reorder

### หมายเหตุเรื่องไฟล์ประวัติ

- `CHANGELOG.md` = ประวัติการเปลี่ยนแปลงระดับ release
- `WORK_HISTORY.md` = ประวัติการทำงานละเอียดสำหรับ handoff / sync Codex

## 2026-07-29 — Customer Card action buttons audit/fix

Scope:

- Fixed only the Customer Card action buttons: Details, Edit, Favorite.
- No backend, API, Google Sheet schema, RBAC policy, or area-permission logic was changed.

Audit result:

- Renderer: `js/app.js` → `renderCustomerCard(c, isFavorite)`.
- Handler location: `js/app.js` customer UI/action helpers.
- Existing customer cards relied on inline `onclick` handlers for quote/edit/favorite actions.
- The card did not have a true Details action button/workflow; the first action was actually quotation selection.
- Per-button loading/error handling was inconsistent and a failed/undefined inline handler could appear as a silent no-op.

Implementation:

- Replaced Customer Card inline action markup with a scoped `data-customer-action` delegated click flow.
- Added `renderCustomerActionButtonHtml()` for the card action buttons.
- Added `bindCustomerCardActions()` and `handleCustomerAction()` to centralize validation, busy state, error handling, and action routing.
- Added `openCustomerDetailsModal()` so Details opens an existing customer detail view from the scoped customer list.
- Kept Edit behind existing `canEditCustomers()` UI permission and existing edit modal workflow.
- Kept Favorite backend validation and added optimistic UI update with rollback on API failure.
- Added customer detail modal CSS only; existing `.icon-action-button` design/touch target remains the base.
- Bumped app/service-worker version to `[legacy version]` so updated UI assets are picked up by PWA/browser cache.

Files changed:

- `js/app.js`
- `css/main.css`
- `index.html`
- `js/api.js`
- `js/config.js`
- `service-worker.js`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Validation notes:

- Static repository checks were added to `TEST_CASES.md`.
- Runtime browser/device/API validation is still required on Desktop Chrome/Edge, Android Chrome, iPhone Safari, and PWA with live Apps Script credentials.
- Rollback command for this phase:

```powershell
git checkout -- js/app.js css/main.css index.html js/api.js js/config.js service-worker.js TEST_CASES.md WORK_HISTORY.md
```

## 2026-07-30 — Navigation label clarity update

Scope:

- Updated visible application navigation labels only.
- Current Dashboard route and functionality remain on the existing `home` route.
- No new Home page was created in this phase.
- No backend, API, database schema, RBAC policy, area permission, authentication, Dashboard calculation, or route-name changes were made.

Audit result:

- Sidebar/mobile drawer navigation is static markup in `index.html` under `.nav`.
- Mobile navigation reuses the same sidebar DOM; `enhanceSidebarNavItems()` reads `.nav-label` and sets `title` / `aria-label`.
- Navigation handler is `go(page, btn)` in `js/app.js`; it maps route names to `#page-${page}`.
- Current Dashboard page is `#page-home`; route name remains `home` for backward compatibility.
- Users page header is static markup in `index.html`.
- No breadcrumb renderer or page-title renderer was found in the app code.
- `Users` occurrences in `appscript/*` and API/config files are internal sheet/API/function names and were intentionally left unchanged.

Implementation:

- Renamed sidebar label, tooltip, and accessible name:
  - `หน้าหลัก` → `Dashboard`
- Renamed Users navigation label, tooltip, accessible name, and page header:
  - `Users` → `ผู้ใช้งาน`
- Kept unchanged labels:
  - `ออกใบเสนอราคา`
  - `ร้านค้า`
  - `สินค้า`
  - `โปรโมชั่น`
  - `ประวัติใบเสนอราคา`
  - `รายงาน`
  - `ตั้งค่า`
- Bumped app/service-worker version to `[legacy version]` so browser/PWA cache picks up the label updates.

Files changed:

- `index.html`
- `js/app.js`
- `js/api.js`
- `js/config.js`
- `service-worker.js`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Validation notes:

- Static scan confirmed sidebar `data-page="home"` now shows `Dashboard` while keeping `go('home')`.
- Static scan confirmed sidebar `data-page="users"` and `#page-users h1` now show `ผู้ใช้งาน` while keeping `go('users')`.
- Static scan confirmed checked runtime files use version `[legacy version]`.
- `git diff --check` passed with only line-ending warnings.
- Runtime browser/device/PWA validation is still required on Desktop Chrome/Edge, Android Chrome, iPhone Safari, and PWA.
- Rollback command for this phase:

```powershell
git checkout -- index.html js/app.js js/api.js js/config.js service-worker.js TEST_CASES.md WORK_HISTORY.md
```

## 2026-07-29 — Product Card action buttons audit/fix

Scope:

- Fixed Product Card action buttons: Favorite and Add Product.
- Covered Product List and Quotation product search / Favorite Products / Pinned Products surfaces that use the same product action component.
- No backend, API, Google Sheet schema, RBAC policy, or quotation/product business rules were changed.

Audit result:

- Product Card renderer: `js/app.js` → `renderProductCard(product, sourceListIndex)`.
- Shared Add Product component: `js/app.js` → `createAddProductButton(options)`.
- Quotation product card renderer: `js/app.js` → `renderQuoteProductPreferenceCard(product, options)`.
- Legacy quotation search fallback: `js/quotation.js` → `renderProductPicker()`.
- Existing Product Card action buttons relied on inline `onclick` while the full card also had a card-level `onclick` for the calculator.
- Failure paths could appear silent when product resolution or add handler routing failed.
- CSS did not contain an overlay/z-index/pointer-events blocker for the product card action row; however quote preference buttons had touch targets below the 44px requirement on some breakpoints.

Implementation:

- Added delegated product action flow with `data-product-action="favorite"` and `data-product-action="add"`.
- Added `bindProductCardActions()` and `handleProductAction()` to centralize validation, propagation control, duplicate-click prevention, busy state, and error handling.
- Updated `renderProductCard()` to route Favorite/Add through product record keys instead of inline handlers.
- Updated `renderQuoteProductPreferenceCard()` and the legacy `js/quotation.js` fallback picker to use the same Add Product action component without inline add handlers.
- Updated `toggleFavoriteProduct()` with optimistic UI update, duplicate-request lock, rollback on API failure, and toast feedback.
- Updated `addProductCardToQuote()` so missing product records or missing handlers show user feedback instead of failing silently.
- Kept Add Product on the existing `addProductToQuoteByReference()` quotation workflow, preserving BU/customer/product validation.
- Raised quote product favorite/pinned touch targets to 44px and added focus/disabled states.
- Bumped app/service-worker version to `[legacy version]` so browser/PWA cache picks up the action handler changes.

Files changed:

- `js/app.js`
- `js/quotation.js`
- `css/main.css`
- `index.html`
- `js/api.js`
- `js/config.js`
- `service-worker.js`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Validation notes:

- Static scan confirmed no inline `toggleFavoriteProduct`, `addProductCardToQuote`, or `addProductToQuoteByReference(event)` handlers remain for product favorite/add actions.
- `git diff --check` passed with only line-ending warnings.
- Runtime browser/device/API validation is still required on Desktop Chrome/Edge, Android Chrome, iPhone Safari, and PWA with live Apps Script credentials.
- Rollback command for this phase:

```powershell
git checkout -- js/app.js js/quotation.js css/main.css index.html js/api.js js/config.js service-worker.js TEST_CASES.md WORK_HISTORY.md
```

## 2026-07-29 — Product Card calculator click guard

Scope:

- Fixed Product Card click behavior so the card opens the price calculator only from non-action areas.
- Preserved existing Add Product, Favorite, quotation add, custom-price, and calculator business flows.
- No backend, API, Google Sheet schema, RBAC policy, pricing, discount, VAT, or quotation formula changes were made.

Audit result:

- Product Card renderer: `js/app.js` → `renderProductCard(product, sourceListIndex)`.
- Card-level calculator handler was still inline on the Product Card: `onclick="openProductCalculator(...)"`.
- Add/Favorite actions were correctly rendered with delegated `data-product-action` buttons, but the click event bubbled to the Product Card before the document-level delegated handler could stop it.
- Result: clicking the blue Add Product button could also trigger the card-level calculator action.
- No CSS overlay, `pointer-events: none`, or z-index blocker was found for the Product Card action buttons.

Implementation:

- Added `isProductCardInteractiveClick(event)` with an interactive target guard for `button`, `a`, form controls, `[data-action]`, `[data-product-action]`, and `[role="button"]`.
- Added `handleProductCardCalculatorClick(event, recordKey)` so card clicks open the calculator only when the click starts from a non-interactive area.
- Updated `renderProductCard()` to use the guarded calculator click handler instead of calling `openProductCalculator()` directly from the card inline handler.
- Kept keyboard behavior for the card itself: Enter/Space on the card still opens the calculator, while button keyboard activation remains scoped to the button action.
- Bumped app/service-worker version to `[legacy version]` so browser/PWA cache picks up the corrected click handler.

Files changed:

- `js/app.js`
- `index.html`
- `js/api.js`
- `js/config.js`
- `service-worker.js`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Validation notes:

- Static scan confirmed Product Card calculator click now routes through `handleProductCardCalculatorClick()`.
- Static scan confirmed no inline product favorite/add handlers were reintroduced.
- `git diff --check` passed with only line-ending warnings.
- Runtime browser/device/API validation is still required on Desktop Chrome/Edge, Android Chrome, iPhone Safari, and PWA with live Apps Script credentials.
- Rollback command for this phase:

```powershell
git checkout -- js/app.js index.html js/api.js js/config.js service-worker.js TEST_CASES.md WORK_HISTORY.md
```

## 2026-07-30 — Design System scroll standards

Scope:

- Implemented the UI-only scrolling standard for existing scrollable sections.
- No backend, API, Google Sheet schema, RBAC policy, area permission, pricing, discount, VAT, or quotation formula changes were made.

Audit result:

- Dashboard KPI cards in `index.html` used `.grid4`, which wrapped as a grid instead of behaving as a horizontal KPI rail.
- Dashboard widgets and dashboard recent/best lists used `.cols`, `.list`, and `.best`, which were grid/vertical layouts.
- Promotion summary and promotion cards used grid layouts and collapsed to one column on mobile instead of horizontal card rails.
- Customer favorites already had horizontal overflow, but lacked the full Design System touch/smooth/no-y scroll standard.
- Quotation pinned/favorite product lists used `.quote-preference-list` as a vertical grid.
- Product Catalog, Product Search, Customer List, Quotation History, Quotation Cart Items, Promotion Product List, Reports, and User Management were already vertical/list/grid datasets and should remain vertical.

Implementation:

- Added scoped `ds-horizontal-scroll` utility styles with `display:flex`, `overflow-x:auto`, `overflow-y:hidden`, smooth scrolling, iOS touch scrolling, snap alignment, and `overscroll-behavior-x:contain`.
- Applied horizontal scroll classes only to real horizontal sections:
  - Dashboard KPI cards
  - Dashboard widget cards
  - Dashboard recent customers / active promotions rows
  - Dashboard best products
  - Promotion summary cards
  - Promotion cards
- Standardized existing customer favorite rails and quotation pinned/favorite product lists to the same touch-scroll behavior.
- Added vertical safeguards for large dataset lists: Products, Quotation Product Search Results, Customers, Quote History, Quotation Cart, User List, and Promotion Product List.
- Bumped app/service-worker version to `[legacy version]` so browser/PWA cache picks up the CSS/layout changes.

Files changed:

- `index.html`
- `css/main.css`
- `js/app.js`
- `js/api.js`
- `js/config.js`
- `service-worker.js`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Validation notes:

- Static scan confirmed the new horizontal selectors and vertical safeguards are present.
- `git diff --check` passed with only line-ending warnings.
- Runtime browser/device/PWA validation is still required on Desktop Chrome/Edge, Android Chrome, iPhone Safari, and PWA.
- Rollback command for this phase:

```powershell
git checkout -- index.html css/main.css js/app.js js/api.js js/config.js service-worker.js TEST_CASES.md WORK_HISTORY.md
```

## 2026-07-30 — Mobile Dashboard grouped KPI redesign

Scope:

- Implemented the approved mobile Dashboard redesign with grouped KPI sections.
- Preserved existing Dashboard data sources and calculations from `DB.quotes`, `DB.quoteLines`, `DB.products`, `DB.customers`, and `DB.settings`.
- No Dashboard API, Apps Script backend, Google Sheet schema, RBAC policy, area permission, authentication, navigation route, pricing, discount, VAT, or quotation formula changes were made.

Audit result:

- Actual Dashboard output is rendered by `js/app.js` through `renderHome()` into a dynamic `#dashboardContent` container.
- `index.html` still contains legacy Dashboard markup, but `ensureDashboardLayout()` hides the legacy `.grid4`, `.cols`, and best-products card after inserting `#dashboardContent`.
- Existing Dashboard CSS was concentrated in `.dashboard-*` selectors in `css/main.css`.
- Dashboard metrics are frontend-derived from loaded in-memory data; there is no dedicated Dashboard API endpoint to change.
- Existing available KPI fields included sales target, actual quotation value, forecast, achievement, BU totals, new customer count, quote status buckets, top customers, and top products.
- Quotation statuses currently exposed by the app are `DRAFT`, `SAVED`, and `CANCELLED`; no new Pending/Approved status was invented.

Implementation:

- Added customer KPI metrics from real customer records: total, active, inactive, and new customers.
- Added `renderHomeDashboardRedesign()` and small Dashboard rendering helpers for reusable KPI cards, section wrappers, and top-list cards.
- Replaced the visible Dashboard layout with six grouped sections:
  - Sales KPI
  - Business KPI
  - Quotation KPI
  - Customer KPI
  - Top Product
  - Top Customer
- Kept "ดูทั้งหมด" actions only where existing routes already exist: Products and Customers.
- Added scoped Dashboard responsive CSS:
  - Desktop: responsive grid, no unnecessary horizontal scroll.
  - Mobile: horizontal tracks with two KPI cards per view for KPI sections.
  - Top Product/Top Customer: wider horizontal cards on mobile.
  - Section headings remain outside scroll containers.
  - Scroll tracks are keyboard-focusable with visible focus rings.
- Bumped app/service-worker version to `[legacy version]` so browser/PWA cache picks up the Dashboard CSS/JS changes.

Files changed:

- `js/app.js`
- `css/main.css`
- `index.html`
- `js/api.js`
- `js/config.js`
- `service-worker.js`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Validation notes:

- Static scan confirmed all six Dashboard sections are rendered by `renderHomeDashboardRedesign()`.
- Static scan confirmed mobile Dashboard track selectors and customer KPI fields are present.
- Static scan confirmed runtime cache/version strings were updated to `[legacy version]` and no `[legacy version]` runtime strings remain in checked files.
- `git diff --check` passed with only line-ending warnings.
- `node --check js/app.js` could not be executed because Node.js is not installed in this environment.
- Runtime browser/device/PWA validation is still required on Desktop Chrome/Edge, Android Chrome, iPhone Safari, and PWA.
- Rollback command for this phase:

```powershell
git checkout -- js/app.js css/main.css index.html js/api.js js/config.js service-worker.js TEST_CASES.md WORK_HISTORY.md
```


## Announcement Settings Backend Patch

- Added `announcementText` to backend default settings and bootstrap defaults.
- Added `announcementText` to the Settings save allowlist.
- Added server-side validation: trim, maximum 500 characters, HTML/script rejection, and spreadsheet-formula prefix rejection.
- Included `announcementText` in role-filtered bootstrap settings so Home can render it for authorized users.
- Kept the existing key-value Settings sheet structure; no destructive database migration is required.
- Normalized the `updateSettings` API payload and attached the authenticated user context.

## 2026-07-30 — Business KPI SSOT audit and production fix

### Root cause

- Quotation Value used quotation header totals from `DB.quotes`, so it remained correct.
- Business Unit totals used `DB.quoteLines`, but classified each line with `product.brand || line.brand || line.discountGroup`.
- Current records primarily use `productBusinessUnit` / `businessUnit`; `discountGroup` is not a Business Unit field.
- Product refresh called `renderHome()` but did not call `renderDashboard()`, so an early empty calculation could remain visible after products finished loading.
- Dashboard product lookup performed repeated linear searches for each quote line.

### Implementation

- Added `calculateBusinessSummary()` as the single Business KPI calculation source.
- Added centralized Business Unit resolution using current line fields, normalized product fields, and legacy quote metadata fallback.
- Added centralized line-value resolution supporting transactional total fields first and unit-price × quantity only as a fallback.
- Replaced fixed Gyproc/Weber calculation keys with a dynamic Business Unit map, automatically supporting future Business Units.
- Added one-pass quote-line aggregation and one product index per calculation.
- Added explicit `ready`, `empty`, `incomplete`, and `error` states.
- Empty or incomplete Business Unit data renders `—`; calculation failure renders `Unable to calculate KPI` instead of false `0.00` values.
- Updated product refresh rendering to recalculate Dashboard KPI after product data loads.
- Preserved Quotation Value and New Customer logic behavior.
- Bumped the centralized version source to `0.5.56` and cache generation to `20260730-02` so the corrected JavaScript reaches installed PWA/browser clients.

### Files modified

- `js/app.js`
- `js/version.js`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

### Performance

- Before: repeated `DB.products.find()` per quote line, potentially O(lines × products).
- After: one product index build plus one quote-line aggregation pass, O(products + quotes + lines + customers).

### Backward compatibility

No changes were made to Routing, Authentication, RBAC, Quotation Engine, Promotion, Customer APIs, Sidebar, Navigation, Google Apps Script, or database schema.

### Validation

- JavaScript syntax check passed with Node.js.
- Static architecture checks passed for centralized calculation, dynamic BU map, loading-state handling, and Dashboard recalculation after product refresh.
- Live browser/PWA, role-filtered data, and production API tests remain required after deployment.
## 2026-08-13 — Sales Target worktree audit and scoped fixes

Scope completed:

- Audited the current local worktree before editing as requested.
- Classified changed files across Sales Target, version/PWA/cache, Business KPI, Customer KPI and documentation.
- Restored the Service Worker to the registered root path `service-worker.js`; the misplaced untracked `js/service-worker.js` copy was moved back to the registered path.
- Routed Sales Target API actions through the central `api()` dispatcher instead of bypassing it from `doGet()` / `doPost()`.
- Added `getSalesTargetManagementData` as the consolidated management read action returning targets, summary and form options in one request.
- Hardened Sales Target management RBAC to match the current canonical policy: `SUPER_ADMIN` and `ADMIN` manage; `MANAGER` is not a management role.
- Added backend validation that a selected individual Sales user exists, is a SALES role, and belongs to the selected/allowed Area.
- Added request sequencing on the Sales Target Management frontend so stale responses cannot overwrite the current state.
- Updated Sales Target loading/error rendering so loading/error states show `—` summary values and do not render misleading business zeroes.
- Added a Sales Target cache-version script property and included it in the bootstrap cache key so target writes invalidate Dashboard/effective-target bootstrap data without clearing unrelated caches.
- Adjusted frontend version consumers so `js/config.js` and `js/api.js` read `APP_INFO` instead of stale hardcoded frontend release values.

Static validation executed:

- `git diff --check` passed with Windows LF/CRLF warnings only.
- Confirmed `service-worker.js`, `js/version.js`, `js/config.js`, `js/api.js`, `js/app.js`, and `js/quotation.js` exist.
- Duplicate function scan found zero duplicate function declarations in `js/app.js`.
- Duplicate function scan found zero duplicate function declarations in `appscript/SalesTarget.gs`.
- Duplicate HTML id scan found zero duplicate ids in `index.html`.
- Confirmed `index.html` registers `./service-worker.js` and that file now exists.
- Confirmed Service Worker still contains API/sensitive URL cache guards.

Not run:

- `node --check` because Node.js is not installed in the current environment.
- Live Apps Script / Google Sheets runtime requests.
- Browser Network verification for `getSalesTargetManagementData`.
- Desktop, Android Chrome, iPhone Safari and installed PWA runtime tests.

No commit was created in this audit phase, per instruction.

## 2026-08-13 — Authentication and session security hardening

Scope completed:

- Audited the login flow, authenticated API client flow, Apps Script `api()` routing, session helpers, permission helpers, backend logging, frontend diagnostics, and Service Worker cache policy.
- Confirmed that seeing `password`, `sessionToken`, and `currentUserId` in the browser owner's DevTools request body is expected for client-constructed requests and is not proof that HTTPS is broken.
- Confirmed sessions already have server-side `createdAt`, `expiresAt`, a 6-hour TTL, logout revocation, and active-user revalidation through `requireApiUser()`.
- Hardened session token generation for new sessions from one UUID to two UUIDs.
- Added backend mismatch rejection when `payload.currentUserId` or `payload.currentUser.userId` does not match the canonical user loaded from the validated session.
- Stopped the frontend from attaching auth context to public `getPublicSystemSettings` JSONP requests.
- Restricted Apps Script `doGet()` JSONP responses to public API actions only and rejected credentials in GET/query payloads.
- Added frontend API redaction for diagnostic logs, response previews, technical-issue logs, and pending-request keys.
- Replaced private cache scoping based on a token suffix with a per-session client cache scope id.
- Added backend logger redaction for password/session-token fields before writing console/SystemLogs details.
- Revoked other existing sessions for the same user after successful self password change while preserving the current session.
- Confirmed Service Worker already avoids POST/API/sensitive URL caching; no Service Worker code change was required in this task.

Files modified:

- `appscript/Auth.gs`
- `appscript/Code.gs`
- `appscript/Logger.gs`
- `appscript/Permission.gs`
- `appscript/User.gs`
- `js/api.js`
- `js/auth.js`
- `SECURITY.md`
- `RBAC_PERMISSION_AUDIT.md`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Static validation executed:

- `git diff --check` passed with Windows LF/CRLF warnings only.
- Static search confirmed no remaining `token.slice(...)` private cache scope usage.
- Static search confirmed the new `currentUserId` mismatch guard, GET credential rejection, JSONP public-action restriction, frontend/backend redaction helpers, and password-change session revocation hooks are present.

Blocked / not run:

- `node --check js/api.js` and `node --check js/auth.js` because Node.js is not installed in the current environment.
- Live Apps Script runtime tests for login, logout token revocation, tampered `currentUserId`, expired token rejection, and password-change old-session revocation.
- Browser/PWA tests for Chrome, Edge, Android Chrome, iPhone Safari, and installed PWA session behavior.

No commit was created, per instruction.

## 2026-08-13 — Backend login/bootstrap performance audit and safe optimization

Scope completed:

- Audited backend-only flow for login, bootstrap, session validation, user lookup, bootstrap Google Sheets reads, effective Sales Target read, cache usage, and logging overhead.
- Confirmed `api('bootstrap')` authenticated through the central router and then `getBootstrapData(payload)` authenticated again, causing duplicate session validation and duplicate Users lookup on the bootstrap path.
- Split bootstrap into a backward-compatible public wrapper and an internal authenticated core:
  - `getBootstrapData(payload)` still validates direct calls.
  - `getBootstrapDataForAuthenticatedUser_(payload, currentUser)` reuses the router-authenticated user.
  - `getBootstrapDataCore_(payload, currentUser)` performs the existing bootstrap read/build flow.
- Added backend performance step traces for login and bootstrap using `Logger.log()` only, avoiding extra SystemLogs writes and avoiding secrets in logs.
- Added ScriptProperties-to-CacheService repopulation in `getSession()` after a session cache miss and valid persistent session fallback.
- Added internal timing metadata propagation from `getUserByUsername()` and `getUserById()`.
- Added `SalesTargets` support to shared `getSheetData()` cache keys and cleared that cache from `salesTargetInvalidateCaches_()`.
- Reduced redundant settings/default settings lookups inside bootstrap by passing already-loaded settings/defaults to `getPublicSystemSettingsData_()`.
- Preserved Sales KPI formulas, Sales Target precedence, RBAC, auth rules, Quotation/Customer/Promotion business logic, frontend orchestration, timeout values, API contract, and database schema.
- Created `BACKEND_PERFORMANCE_AUDIT.md` with call graphs, sheet-read inventory, implemented changes, validation status, runtime acceptance checks, and rollback instructions.

Files modified:

- `appscript/Api.gs`
- `appscript/Auth.gs`
- `appscript/Code.gs`
- `appscript/Database.gs`
- `appscript/SalesTarget.gs`
- `appscript/User.gs`
- `BACKEND_PERFORMANCE_AUDIT.md`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Static validation executed:

- `git diff --check` passed with Windows LF/CRLF warnings only.
- Static search confirmed exactly one `case 'bootstrap'` route and one public `getBootstrapData(payload)` wrapper.
- Static search confirmed `Api.gs` routes bootstrap to `getBootstrapDataForAuthenticatedUser_(payload, user)`.
- Static search confirmed `sheetData:salesTargets` exists and `salesTargetInvalidateCaches_()` clears Sales Target sheet cache.

Blocked / not run:

- Live Apps Script runtime timing for `login` and `bootstrap`.
- Real Google Sheets cache-hit/cache-miss timing.
- Browser Network timing.
- UAT/production deployed API tests.
- Node/Python syntax tooling because Node.js was unavailable and Python execution was blocked in this sandbox.

No commit was created, per instruction.

## 2026-08-13 — Dashboard initial-load performance orchestration

Scope completed:

- Audited the current login and Dashboard load lifecycle before editing.
- Confirmed the current initial flow rendered Dashboard before bootstrap data finished, which could show misleading `0.00` KPI values while data was still loading.
- Confirmed the Dashboard route/render path could auto-trigger secondary reads around first paint: `customers`, `getQuotationHistory`, `getProductPromotions`, and `getPublicSystemSettings`.
- Confirmed `bootstrap` already returns Sales KPI-critical `quotes`, `quoteLines`, and `effectiveSalesTarget`, plus `publicSettings`, `settings`, `permissions`, `counts`, and `promotions`.
- Kept Sales KPI formulas, Sales Target business rules, Actual/Forecast calculation, Target precedence, RBAC, area permissions, API routing, and Apps Script backend logic unchanged.
- Updated authenticated startup so public settings are taken from bootstrap/cache instead of forcing a separate public settings request during authenticated app load.
- Changed Dashboard route entry so customer data loads in the background only after bootstrap/KPI data is ready.
- Removed Dashboard render-time auto-loads for quotation history and product promotions; quotation history still loads on the quotation-history route, and promotions still load on the promotions route.
- Added Dashboard KPI loading state that displays `—` and an accessible `กำลังโหลดข้อมูล...` helper before KPI-critical data is ready.
- Preserved genuine business zero display after bootstrap succeeds.

Files modified:

- `js/app.js`
- `css/main.css`
- `TEST_CASES.md`
- `WORK_HISTORY.md`

Static validation executed:

- `git diff --check` passed with Windows LF/CRLF warnings only.
- Static search confirmed Dashboard no longer calls `getQuotationHistory` or `getProductPromotions` from Dashboard render.
- Static search confirmed `getQuotationHistory` remains on the `quotes` route and `getProductPromotions` remains in `loadPromotionDashboard()`.
- Static search confirmed `getPublicSystemSettings` auth exclusion in `js/api.js` remains present.

Blocked / not run:

- `node --check js/app.js` because Node.js is not installed in the current environment.
- Live Apps Script runtime request timing.
- Browser Network before/after measurement for initial authenticated request count and KPI first meaningful paint.
- Desktop Chrome/Edge, Android Chrome, iPhone Safari, and installed PWA runtime tests.

Known follow-up:

- Google Drive profile-image/thumbnail `429 Too Many Requests` remains out of scope for this performance pass.

No commit was created, per instruction.
## 2026-08-18 — Phase 3.2 Sales scoped customer self-service permission

Scope completed:

- Opened the canonical customer-management permission flag for `SALES` while keeping Product Master and Promotion Master management restricted to `SUPER_ADMIN` / `ADMIN`.
- Added backend customer write authorization inside `appscript/Customer.gs` so `saveCustomer()` / `updateCustomer()` do not rely only on the central API router.
- Preserved customer read/edit scope through existing `canAccessCustomerRecord_()` behavior: SALES can access own-area customers only, and same-area assigned customers are limited to the assigned sales user when `assignedSalesUserId` is present.
- Added SALES create guard: requested `salesArea` must match the authenticated user area, and missing assignment is safely derived from the authenticated SALES user.
- Added assignment anti-hijack guard: SALES cannot set `assignedSalesUserId` / `assignedSalesUsername` to another sales user.
- Added protected-field guard for SALES payloads covering `active`, `status`, `createdBy`, `createdAt`, `updatedBy`, and `updatedAt`.
- Normalized `PC` as a distinct restricted role instead of falling through to `SALES`, and blocked PC customer reads/writes when backend helpers are called outside the API router.
- Updated frontend Settings/Data Entry visibility so SALES sees customer data-entry affordances only; Product and Promotion actions remain hidden/blocked.
- Hid customer assignment controls from roles without assignment-management permissions in the customer modal.
- Added automated unit coverage for SALES customer create/edit scope, direct API bypass protection, protected fields, PC restriction, and Product/Promotion write denial.

Validation performed locally:

- Baseline before implementation: `npm.cmd run verify` passed with 38/38 tests.
- After implementation: `npm.cmd run check` passed.
- After implementation: `npm.cmd run test` passed with 53/53 tests.
- After implementation: `npm.cmd run verify` passed with 53/53 tests.
- After implementation: `git diff --check` passed; Git only reported line-ending normalization warnings.

Runtime Apps Script deployment, live Google Sheets validation, desktop/mobile browser checks, iPhone Safari, Android Chrome, and PWA UAT remain required.
