# Production Test Cases — Saint-Gobain Sales System

Date prepared: 2026-07-26
Scope: Production regression catalogue for the audit-remediation branch.
Sources: `FULL_PROJECT_AUDIT.md`, `RBAC_PERMISSION_AUDIT.md`, `REMEDIATION_PROGRESS.md`, `RELEASE_READINESS.md`, `ACCESSIBILITY_CHECKLIST.md`, and the current repository.

## V1 final pre-release addendum — 2026-07-29

This catalogue remains the production test source of truth for V1. During the final pre-release audit, no runtime/manual/browser/PWA/production smoke test was executed in this local environment.

Current execution status:

- Total catalogue: 81 tests
- Static checks passed: 18
- Runtime integration tests blocked/not run: 33
- Manual browser/PWA tests blocked/not run: 19
- Production smoke tests blocked/not run: 11
- Failed tests reported by this audit: 0

Important: this means the release is **not ready for real-user UAT/Pilot** until the P0 tests are executed against the target Apps Script deployment, UAT Google Sheets, role-specific users, and real browsers/devices. Static inspection is recorded only as `Static Check Passed`; do not convert it to runtime pass status without evidence.

Related V1 documents:

- `FINAL_V1_PRE_RELEASE_AUDIT.md`
- `UAT_CHECKLIST.md`
- `KNOWN_ISSUES.md`
- `PILOT_GO_LIVE_PLAN.md`
- `ROLLBACK_PLAN_V1.md`

## Quotation draft expiration addendum — 2026-07-29

Policy under test: local quotation drafts expire after 14 days. Expired, corrupted, missing-timestamp, or invalid-timestamp drafts must remove only the current user-specific draft key from `localStorage` before the recovery modal is shown. Saved quotations, Apps Script APIs, Google Sheets data, quotation numbering, and other users' draft keys must remain unchanged.

These tests were added for the Draft Expiration implementation and have not been executed in a live browser/PWA session.

| Test ID | Module | Priority | Test type | Applicable roles | Preconditions | Test data | Numbered steps | Expected result | Actual result | Status | Environment | Evidence | Related audit finding or requirement | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DRAFT-TTL-01 | QUOTE | P1 | Manual browser/PWA | Quote creators | Logged in; quotation page available | Local draft with `savedAt` 13 days ago | 1. Seed current user's draft key. 2. Open quotation page. | Recovery modal is shown normally. | Not executed. | Not Run | Browser/PWA | Required screenshot/localStorage redacted | Draft TTL requirement | Valid draft path must stay unchanged. |
| DRAFT-TTL-02 | QUOTE | P1 | Manual browser/PWA | Quote creators | Logged in | Local draft with `savedAt` exactly 14 days ago | 1. Seed draft. 2. Open quotation page. 3. Inspect localStorage key. | Draft is deleted and modal is not shown. | Not executed. | Not Run | Browser/PWA | Required screenshot/storage evidence | Draft TTL requirement | Boundary condition. |
| DRAFT-TTL-03 | QUOTE | P1 | Manual browser/PWA | Quote creators | Logged in | Local draft with `savedAt` 15 days ago | 1. Seed draft. 2. Open quotation page. | Draft is deleted and modal is not shown. | Not executed. | Not Run | Browser/PWA | Required screenshot/storage evidence | Draft TTL requirement | Expired path. |
| DRAFT-TTL-04 | QUOTE | P1 | Manual browser/PWA | Quote creators | Logged in | Local draft missing `savedAt` | 1. Seed draft without `savedAt`. 2. Open quotation page. | Draft is deleted safely; page loads normally. | Not executed. | Not Run | Browser/PWA | Required console/storage evidence | Draft invalid timestamp requirement | No blocking modal. |
| DRAFT-TTL-05 | QUOTE | P1 | Manual browser/PWA | Quote creators | Logged in | Local draft with invalid `savedAt` | 1. Seed draft with invalid date string. 2. Open quotation page. | Draft is deleted safely; page loads normally. | Not executed. | Not Run | Browser/PWA | Required console/storage evidence | Draft invalid timestamp requirement | No crash. |
| DRAFT-TTL-06 | QUOTE | P1 | Manual browser/PWA | Quote creators | Logged in | Corrupted JSON at current draft key | 1. Seed malformed JSON. 2. Open quotation page. | App continues without crash; corrupted current key is removed. | Not executed. | Not Run | Browser/PWA | Required console/storage evidence | Draft corrupted requirement | No modal. |
| DRAFT-TTL-07 | QUOTE | P1 | Manual browser/PWA | Quote creators | Two user draft keys exist | Draft key for another user plus current key | 1. Seed another user's key. 2. Seed current user's mismatched-owner draft if needed. 3. Open quotation page. | Another user's key is untouched; mismatched draft is not restored. | Not executed. | Not Run | Browser/PWA | Required storage evidence | User isolation requirement | Existing owner validation remains. |
| DRAFT-TTL-08 | QUOTE | P2 | Manual browser/PWA | Quote creators | Logged in | Draft `savedAt` slightly in the future | 1. Seed future timestamp. 2. Open quotation page. | Anomaly is logged; recovery behavior continues. | Not executed. | Not Run | Browser/PWA | Required console evidence | Future timestamp requirement | Do not delete potentially valid draft. |
| DRAFT-TTL-09 | QUOTE | P1 | Manual browser/PWA | Quote creators | Expired draft was deleted | Same browser/session | 1. Refresh quotation page after deletion. | Recovery modal does not reappear. | Not executed. | Not Run | Browser/PWA | Required screenshot/storage evidence | Draft TTL requirement | Verifies deletion persists. |
| DRAFT-TTL-10 | QUOTE | P1 | Manual browser/PWA | Quote creators | Expired draft was deleted | New quotation changes | 1. Enter new quote data. 2. Wait autosave debounce. 3. Inspect current key. | New draft autosaves normally. | Not executed. | Not Run | Browser/PWA | Required storage evidence | Autosave compatibility | No storage lockout after deletion. |
| DRAFT-TTL-11 | QUOTE | P1 | Manual browser/PWA | Quote creators | Valid draft exists | Draft younger than TTL | 1. Open quotation page. 2. Choose restore. 3. Save draft/quote. | Existing restore flow and save flow remain unchanged. | Not executed. | Not Run | Browser/PWA | Required screenshot/API response | Backward compatibility | Saved quotations unaffected. |
| DRAFT-TTL-12 | QUOTE | P2 | Manual browser/PWA | Quote creators | Browser offline; expired draft exists | Expired local draft | 1. Set browser offline. 2. Open quotation page. | Expiration still works locally; no API dependency. | Not executed. | Not Run | Browser/PWA | Required screenshot/storage evidence | Offline requirement | Manual/PWA test. |

Important execution rule: do not mark a runtime/manual test as Passed unless it was actually executed in that stated environment. Static repository checks may be marked `Static Check Passed`. Tests requiring live Google Sheets, Apps Script deployment, browsers, devices, or credentials remain `Not Run` or `Blocked` with the reason recorded.

## 1. Critical pre-release gate

Release is blocked if any P0 test is Failed, Blocked without an approved workaround, or Not Run without sign-off.

Minimum gate before production:

- All P0 static checks must pass.
- All P0 Apps Script/API integration tests must be executed against the target deployment.
- All P0 RBAC/customer-area/security tests must pass for `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `SALES`, and `VIEWER`.
- All P0 quotation save/load/export/security tests must pass.
- All P0 PWA/cache isolation tests must pass on at least one installed PWA session.
- All P0 mobile layout tests must pass on iPhone Safari and Android Chrome.

## 2. Go / No-Go criteria

| Decision | Criteria |
|---|---|
| Go | 100% P0 passed, no unresolved Sev1/Sev2 defects, manual evidence attached for runtime/browser/device tests, rollback path confirmed. |
| Conditional Go | P0 passed, only documented Sev3/Sev4 defects remain, business owner accepts risk, rollback owner assigned. |
| No-Go | Any failed P0, any unresolved auth/RBAC/data-leak defect, any quotation save/load/export blocker, or missing production deployment validation. |

## 3. Defect severity rules

| Severity | Definition | Examples |
|---|---|---|
| Sev1 Critical | Data leak, privilege escalation, data loss, duplicate quotation number, broken login, or production outage. | SALES sees another area, cached quote bypasses permission, concurrent save duplicates quoteNo. |
| Sev2 High | Core workflow blocked or incorrect financial output. | Cannot save quote, wrong discount/VAT/grand total, export broken for all users. |
| Sev3 Medium | Important feature degraded with workaround. | Favorite reorder fails, profile image does not refresh until reload, modal scroll awkward on one device. |
| Sev4 Low | Cosmetic/doc issue with no functional impact. | Minor label mismatch, spacing issue, stale wording. |

## 4. Evidence requirements

For each executed test, attach or reference:

- Environment: browser/device/OS, Apps Script deployment ID or URL alias, spreadsheet/UAT dataset.
- User role and user id/username used.
- Screenshot or screen recording for UI/browser/PWA tests.
- API request/response excerpt with tokens redacted for integration/security tests.
- Google Apps Script execution log id/time for backend tests.
- Before/after sheet row numbers for data-write tests.
- Defect id if actual result differs from expected result.

## 5. Test data preparation

Create or verify these records in a UAT spreadsheet before runtime execution:

- Users: `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `SALES_A`, `SALES_B`, `VIEWER`.
- Areas: `AREA_A`, `AREA_B`.
- Customers: at least two active customers in each area, one inactive customer, one customer assigned to `SALES_A`, one customer assigned to `SALES_B`, one customer selling Weber only, one Gyproc only, one both.
- Products: at least two Weber records, two Gyproc records, one exact duplicate product set, one same-code/different-price product, one same-code/different-unit product.
- Discounts: one valid discount for an in-scope customer/group and one out-of-scope customer/group.
- Quotations: one legacy quote number starting `QT-`, one draft, one saved, one cancelled, one SALES-owned quote, one quote owned by another SALES user.
- Promotions: one active, one inactive/expired, one duplicate candidate.
- Profile image: one valid public image URL and one invalid URL.

## 6. Execution summary

| Suite | Total | Static Check Passed | Not Run | Blocked | Failed | Notes |
|---|---:|---:|---:|---:|---:|---|
| Automated/static checks | 18 | 18 | 0 | 0 | 0 | Static checks were executed locally in repository context. |
| Runtime integration tests | 33 | 0 | 0 | 33 | 0 | Blocked until live Apps Script, Google Sheets UAT data, and credentials are available. |
| Manual browser/PWA tests | 19 | 0 | 0 | 19 | 0 | Blocked until browsers/devices/PWA install session are available. |
| Production post-deployment smoke tests | 11 | 0 | 0 | 11 | 0 | Blocked until production deployment exists. |
| Total | 81 | 18 | 0 | 63 | 0 | No runtime/manual pass is claimed in this document. |

## 7. Test case counts by module and priority

| Module | P0 | P1 | P2 | Total |
|---|---:|---:|---:|---:|
| A11Y | 1 | 5 | 0 | 6 |
| API | 4 | 2 | 0 | 6 |
| AUTH | 2 | 2 | 0 | 4 |
| CUST | 3 | 6 | 1 | 10 |
| DISC | 3 | 0 | 0 | 3 |
| PERF | 0 | 3 | 1 | 4 |
| PROD | 0 | 6 | 0 | 6 |
| PROFILE | 0 | 3 | 0 | 3 |
| PROMO | 2 | 1 | 2 | 5 |
| PWA | 2 | 1 | 0 | 3 |
| QUOTE | 12 | 4 | 0 | 16 |
| RBAC | 6 | 1 | 0 | 7 |
| REG | 1 | 2 | 2 | 5 |
| USER | 2 | 1 | 0 | 3 |
| Total | 38 | 37 | 6 | 81 |

Note: The canonical executable test catalogue below contains 81 rows.

## 8. Automated/static checks

| Test ID | Module | Priority | Test type | Applicable roles | Preconditions | Test data | Numbered steps | Expected result | Actual result | Status | Environment | Evidence | Related audit finding or requirement | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| API-STATIC-001 | API | P0 | Automated/static check | All | Repository available | `js/api.js` | 1. Search for `apiJsonpGet(`. 2. Inspect dispatch branch. | JSONP is only used for public settings; authenticated requests use POST. | `apiJsonpGet()` remains only behind public `getPublicSystemSettings` path. | Static Check Passed | Local repository / PowerShell / ripgrep | Search command: `apiJsonpGet` and `isPublicJsonpReadAction` in `js/api.js`. | H-2, Phase 1 | Candidate for CI static check. |
| API-STATIC-002 | PWA | P0 | Automated/static check | All | Repository available | `service-worker.js` | 1. Inspect service worker fetch handler. 2. Search cache writes. | Service worker caches only approved static assets and navigation fallback. | Static functions `isSensitiveRequestUrl`, `isApprovedStaticAsset`, and navigation fallback found. | Static Check Passed | Local repository / PowerShell / ripgrep | Search command: service-worker cache policy markers in `service-worker.js`. | H-3, Phase 1 | Candidate for CI static check. |
| QUOTE-STATIC-001 | QUOTE | P0 | Automated/static check | All authenticated roles | Repository available | `appscript/Quotation.gs` | 1. Inspect `loadQuotation`. 2. Confirm permission before cache return. | `canAccessQuotationRecord()` runs before cached quotation data is returned. | Permission check appears before `getServerCache(cacheKey)` return path. | Static Check Passed | Local repository / PowerShell / ripgrep | Search command: `canAccessQuotationRecord` and `getServerCache(cacheKey)` in `appscript/Quotation.gs`. | C-1, Phase 1 | Runtime test still required. |
| DISC-STATIC-001 | DISC | P0 | Automated/static check | All authenticated roles | Repository available | `appscript/Api.gs` | 1. Inspect `discount` API case. 2. Confirm scope validation before `getDiscount`. | `validateDiscountCustomerScope_()` runs before returning discount data. | Validation helper and dispatch call found. | Static Check Passed | Local repository / PowerShell / ripgrep | Search command: `case 'discount'` and `validateDiscountCustomerScope_` in `appscript/Api.gs`. | H-1, Phase 1 | Runtime test still required. |
| RBAC-STATIC-001 | RBAC | P0 | Automated/static check | SUPER_ADMIN, ADMIN, MANAGER, SALES, VIEWER | Repository available | `appscript/Permission.gs`, `js/app.js` | 1. Inspect canonical permission helpers. 2. Inspect frontend guards. | Backend and frontend use canonical permission flags for route/action visibility. | Canonical policy documented and implemented in Phase 2 files. | Static Check Passed | Local repository / PowerShell / ripgrep | `REMEDIATION_PROGRESS.md` Phase 2 notes | H-6, Phase 2 | Runtime role matrix still required. |
| CUST-STATIC-001 | CUST | P0 | Automated/static check | SALES, ADMIN, SUPER_ADMIN | Repository available | `appscript/Customer.gs`, `appscript/Api.gs` | 1. Inspect customer form options action. 2. Inspect assignment metadata gating. | Lower roles do not receive assignable sales metadata. | Phase 2 notes and code references confirm reduced option response. | Static Check Passed | Local repository / PowerShell / ripgrep | `REMEDIATION_PROGRESS.md` Phase 2 notes | M-11, Phase 2 | Runtime response payload test still required. |
| CUST-STATIC-002 | CUST | P1 | Automated/static check | SUPER_ADMIN, ADMIN, SALES, VIEWER | Repository available | `js/app.js`, `css/main.css` | 1. Inspect `renderCustomerCard`. 2. Inspect customer action button markup. 3. Inspect delegated click handler and busy/error helpers. | Customer card Details/Edit/Favorite buttons use `data-customer-action`, validate `customerId`, route through one delegated handler, expose accessible labels/tooltips, and have loading/disabled states. | `renderCustomerActionButtonHtml`, `bindCustomerCardActions`, `handleCustomerAction`, `openCustomerDetailsModal`, and scoped customer lookup found; customer detail CSS found. | Static Check Passed | Local repository / PowerShell / ripgrep | Search command: `data-customer-action`, `CUSTOMER_ACTION_PENDING`, `openCustomerDetailsModal` in `js/app.js`; `.customer-detail` in `css/main.css`. | Customer Card action button regression | Runtime browser/API validation still required. |
| PROD-STATIC-002 | PROD | P1 | Automated/static check | SUPER_ADMIN, ADMIN, SALES | Repository available | `js/app.js`, `js/quotation.js`, `css/main.css` | 1. Inspect Product Card renderer. 2. Inspect `createAddProductButton`. 3. Inspect delegated product action handler. 4. Search for inline product favorite/add handlers. 5. Inspect card-level calculator click guard. | Product favorite/add actions use `data-product-action`, validate against resolved product records, prevent duplicate clicks, expose busy/disabled/accessibility state, and do not bubble into the card calculator click path. | `renderProductCard`, `createAddProductButton`, `bindProductCardActions`, `handleProductAction`, optimistic `toggleFavoriteProduct`, and `handleProductCardCalculatorClick` / `isProductCardInteractiveClick` guard found; no inline product favorite/add onclick remains. | Static Check Passed | Local repository / PowerShell / ripgrep | Search commands: `data-product-action`, `handleProductCardCalculatorClick`, `isProductCardInteractiveClick`, `onclick=.*(toggleFavoriteProduct|addProductCardToQuote|addProductToQuoteByReference)`, and `git diff --check`. | Product Card action button regression | Runtime browser/API validation still required. |
| PROMO-STATIC-001 | PROMO | P0 | Automated/static check | SUPER_ADMIN, ADMIN | Repository available | `appscript/Code.gs`, `appscript/Api.gs` | 1. Search for old promotion stub success. 2. Inspect save path. | `savePromotion()` persists with validation instead of returning fake success. | Old stub removed; promotion persistence added in Phase 3. | Static Check Passed | Local repository / PowerShell / ripgrep | `REMEDIATION_PROGRESS.md` Phase 3 notes | M-6, Phase 3 | Runtime sheet write test still required. |
| AUTH-STATIC-001 | AUTH | P1 | Automated/static check | All | Repository available | `index.html`, `js/config.js` | 1. Inspect demo login config. 2. Inspect demo login markup. | Demo Login is hidden in production unless explicitly enabled. | `ENABLE_DEMO_LOGIN = false` documented in Phase 3 notes. | Static Check Passed | Local repository / PowerShell / ripgrep | `REMEDIATION_PROGRESS.md` Phase 3 notes | Demo-login production risk | Runtime production check still required. |
| API-STATIC-003 | API | P1 | Automated/static check | All | Repository available | Runtime/config files | 1. Search runtime files for stale version strings. | Runtime version/cache strings align to current release. | No old runtime version strings found outside preserved audit baseline. | Static Check Passed | Local repository / PowerShell / ripgrep | Search command: old `0.5.x` and `sales-system-v5-0.5.24` strings in runtime files. | M-7, Phase 4 | Audit baseline intentionally keeps old examples. |
| API-STATIC-004 | API | P1 | Automated/static check | All | Repository available | `index.html` | 1. Inspect external CDN scripts. 2. Confirm SRI/crossorigin. | External pinned scripts include integrity and crossorigin metadata. | Phase 5 notes confirm SRI added. | Static Check Passed | Local repository / PowerShell / ripgrep | `REMEDIATION_PROGRESS.md` Phase 5 notes | H-5, Phase 5 | Browser load still required. |
| REG-STATIC-001 | REG | P1 | Automated/static check | All | Repository available | `js/app.js` | 1. Run duplicate function declaration scan. | No duplicate active function declarations remain in `js/app.js`. | Duplicate function declaration script returned zero duplicates. | Static Check Passed | Local repository / PowerShell | `duplicate_function_declarations=0` | Phase 8 | Candidate for CI static check. |
| A11Y-STATIC-001 | A11Y | P1 | Automated/static check | All | Repository available | `index.html`, `js/app.js`, `js/quotation.js` | 1. Search generated/static buttons without type. | All static/generated buttons declare `type="button"` where appropriate. | Search returned zero buttons without type. | Static Check Passed | Local repository / PowerShell / ripgrep PCRE2 | `buttons_without_type=0` | Phase 9 | Candidate for CI static check. |
| A11Y-STATIC-002 | A11Y | P1 | Automated/static check | All | Repository available | `index.html` | 1. Inspect dialog and toast semantics. | Main modals have dialog semantics and toast has polite live region. | 5 dialog roles, 5 aria-modal attributes, one toast live region found. | Static Check Passed | Local repository / PowerShell | Marker-count check | Phase 9 | Runtime screen reader check still required. |
| A11Y-STATIC-003 | A11Y | P1 | Automated/static check | All | Repository available | `index.html`, `css/main.css` | 1. Inspect scrollable section selectors. 2. Confirm horizontal sections use scoped overflow-x/touch scroll rules. 3. Confirm large Product, Customer, Quote History, Cart, User, and Promotion Product lists remain vertical. | Dashboard KPI/widgets, dashboard recent/best lists, customer favorites, promotion summary/cards, and quotation favorite/pinned product lists use horizontal scrolling; large datasets remain vertical and scoped to avoid page horizontal overflow. | `.ds-horizontal-scroll`, `dashboard-kpi-grid`, `dashboard-widget-grid`, `dashboard-widget-list`, `dashboard-best-products`, `promotion-summary-grid`, `promotion-grid`, `favorite-grid`, and `quote-preference-list` found; vertical safeguards found for `#productGrid`, `#productPicker`, `#customerGrid`, `#quoteHistory`, `#cartList`, `#userList`, and `.promotion-product-list`. | Static Check Passed | Local repository / PowerShell / ripgrep | Search command: scroll standard selectors in `index.html` and `css/main.css`; `git diff --check`. | Design System scrolling standard | Runtime browser/device/PWA validation still required. |
| PERF-STATIC-001 | PERF | P1 | Automated/static check | All | Repository available | `appscript/Database.gs`, `appscript/Quotation.gs`, `appscript/User.gs` | 1. Inspect row update/delete helpers. | Batch helpers are present for contiguous row writes/deletes. | Phase 6 helpers and adoption documented. | Static Check Passed | Local repository / PowerShell / ripgrep | `REMEDIATION_PROGRESS.md` Phase 6 notes | Apps Script performance risk | Live performance test still required. |
| REG-STATIC-002 | REG | P2 | Automated/static check | All | Repository available | Documentation | 1. Inspect release docs. 2. Confirm test/readiness links. | `RELEASE_READINESS.md`, `TEST_CASES.md`, and checklist are present and linked. | `TEST_CASES.md` is present; release link added in this task. | Static Check Passed | Local repository | File existence and docs inspection | Release readiness requirement | Documentation-only. |

## 9. Runtime integration tests

These tests require a live Apps Script deployment, UAT Google Sheets data, and role-specific credentials. They are not executed in this local repository environment.

| Test ID | Module | Priority | Test type | Applicable roles | Preconditions | Test data | Numbered steps | Expected result | Actual result | Status | Environment | Evidence | Related audit finding or requirement | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AUTH-INT-001 | AUTH | P0 | Runtime integration | SUPER_ADMIN, ADMIN, MANAGER, SALES, VIEWER | Apps Script deployed; users active | Valid user per role | 1. Call login through UI or API. 2. Verify session token. 3. Load bootstrap data. | Login succeeds and bootstrap data matches role scope. | Not executed. | Blocked - live deployment and credentials unavailable | Apps Script/UAT | Required: screenshot/API response with token redacted | Authentication lifecycle | Must run for every role. |
| AUTH-INT-002 | AUTH | P0 | Runtime integration | All | Valid active session | Active session token | 1. Login. 2. Logout. 3. Attempt authenticated API call with old token. | Old token is rejected and private cache/state is cleared. | Not executed. | Blocked - live deployment and credentials unavailable | Apps Script/UAT | Required: API response/log | Phase 7 cache/session reliability | Include shared-device scenario. |
| RBAC-INT-001 | RBAC | P0 | Runtime integration | SUPER_ADMIN | SUPER_ADMIN credentials | Admin UAT data | 1. Login. 2. Open all pages. 3. Call admin APIs. | SUPER_ADMIN can access all intended admin/system features. | Not executed. | Blocked - live credentials unavailable | Apps Script/UAT | Required: screenshots/API responses | RBAC matrix | Verify no unexpected deny. |
| RBAC-INT-002 | RBAC | P0 | Runtime integration | ADMIN | ADMIN credentials | Users/customers/products/promotions | 1. Login. 2. Manage allowed data. 3. Try SUPER_ADMIN-only settings. | ADMIN can manage allowed data and cannot manage SUPER_ADMIN-only identity/settings. | Not executed. | Blocked - live credentials unavailable | Apps Script/UAT | Required: screenshots/API responses | RBAC matrix | Verify role hierarchy. |
| RBAC-INT-003 | RBAC | P0 | Runtime integration | MANAGER | MANAGER credentials | Quotations/reports/customers | 1. Login. 2. Open quote history/report. 3. Try create/edit/cancel quote. | MANAGER is read/oversight only; create/edit/cancel denied. | Not executed. | Blocked - live credentials unavailable | Apps Script/UAT | Required: screenshots/API responses | H-6, Phase 2 | Critical policy check. |
| RBAC-INT-004 | RBAC | P0 | Runtime integration | VIEWER | VIEWER credentials | Quotations/reports/customers | 1. Login. 2. Open read-only pages. 3. Try write APIs directly. | VIEWER can view allowed data and all writes are denied. | Not executed. | Blocked - live credentials unavailable | Apps Script/UAT | Required: screenshots/API responses | RBAC read-only policy | Direct API test required. |
| CUST-INT-001 | CUST | P0 | Runtime integration | SALES | SALES_A credentials | Customers in AREA_A and AREA_B | 1. Login as SALES_A. 2. Load customers. 3. Search AREA_B customer. 4. Call customer detail for AREA_B id. | AREA_B customer is not listed and direct access is denied. | Not executed. | Blocked - live UAT data unavailable | Apps Script/UAT | Required: API response/log | Customer area isolation | P0 data leak gate. |
| CUST-INT-002 | CUST | P0 | Runtime integration | SALES | SALES_A credentials | Customer assigned to SALES_B | 1. Login SALES_A. 2. Request customer assigned to SALES_B. | Customer outside assigned-sales scope is denied. | Not executed. | Blocked - live UAT data unavailable | Apps Script/UAT | Required: API response/log | Assigned-sales isolation | Validate exact response code/message. |
| CUST-INT-003 | CUST | P1 | Runtime integration | ADMIN, SUPER_ADMIN | Admin credentials | New customer payload with salesArea/brands | 1. Open customer form options. 2. Create customer. 3. Reload customers. | Customer is saved with salesArea, assigned sales snapshot, and at least one brand. | Not executed. | Blocked - live deployment unavailable | Apps Script/UAT | Required: sheet row/screenshot | Customer area/brand requirements | Include Weber-only, Gyproc-only, both. |
| CUST-INT-004 | CUST | P1 | Runtime integration | ADMIN, SUPER_ADMIN | Existing customer | Customer with assigned sales | 1. Edit salesArea/assigned sales/brand flags. 2. Save. 3. Reload as affected SALES. | Scope and card display update correctly; no data loss. | Not executed. | Blocked - live UAT data unavailable | Apps Script/UAT | Required: before/after sheet row | Customer migration/backward compatibility | Verify old rows remain intact. |
| CUST-INT-005 | CUST | P1 | Runtime integration | SUPER_ADMIN, ADMIN, SALES, VIEWER | Live deployment and scoped customer data available | One in-scope customer per role; one out-of-scope customer for SALES negative test | 1. Load customers through the UI/API. 2. Click Details for in-scope customer. 3. Click Edit as allowed role and as VIEWER. 4. Toggle Favorite twice. 5. Attempt out-of-scope customer action by direct API/DOM manipulation. | Details opens for scoped data; Edit follows RBAC; Favorite add/remove persists and prevents duplicate requests; out-of-scope access is still denied by backend. | Not executed. | Blocked - live deployment, UAT data, and credentials unavailable | Apps Script/UAT | Required: screenshots/API responses with identifiers redacted | Customer Card action button regression | Confirms frontend fix does not replace backend permission checks. |
| DISC-INT-001 | DISC | P0 | Runtime integration | SALES | SALES_A credentials | Discount for AREA_A and AREA_B customers | 1. Request discount for AREA_A customer/product group. 2. Request discount for AREA_B customer/product group. | In-scope discount returns; out-of-scope discount is denied. | Not executed. | Blocked - live UAT data unavailable | Apps Script/UAT | Required: API response/log | H-1, Phase 1 | Security gate. |
| DISC-INT-002 | DISC | P0 | Runtime integration | VIEWER, MANAGER | Read-only credentials | Any discount payload | 1. Attempt direct discount API call. | Unauthorized role/scope cannot retrieve restricted discount data. | Not executed. | Blocked - live credentials unavailable | Apps Script/UAT | Required: API response/log | Discount access prevention | Verify backend, not frontend-only. |
| PROD-INT-001 | PROD | P1 | Runtime integration | Allowed product roles | Products API/UAT sheet available | Products sheet with exact duplicate rows | 1. Load products. 2. Search exact duplicate SKU. | Exact duplicates do not produce duplicate cards if dedupe guard is active. | Not executed. | Blocked - live product data unavailable | Apps Script/UAT | Required: screenshots/API payload | Product duplicate requirement | If dedupe is frontend-only, verify selected product record. |
| PROD-INT-002 | PROD | P1 | Runtime integration | SALES, ADMIN | Product records same code but different price/unit/brand | Product variants | 1. Load products. 2. Search same code/name variants. | Different price/unit/brand records remain separately selectable. | Not executed. | Blocked - live product data unavailable | Apps Script/UAT | Required: screenshots | Product duplicate rule | Calculator compatibility gate. |
| PROD-INT-003 | PROD | P1 | Runtime integration | SUPER_ADMIN, ADMIN, SALES | Live API deployment, product preferences endpoint, quotation workflow available | One active product; one inactive product; current quote customer/BU | 1. Load Product List. 2. Toggle favorite on/off. 3. Rapid-click favorite. 4. Add product to quotation. 5. Repeat from quote search/favorite/pinned sections. | Favorite persists or rolls back on API failure; duplicate favorite/add requests are prevented; add uses the selected product record and respects existing quotation readiness/business rules. | Not executed. | Blocked - live deployment, UAT data, and credentials unavailable | Apps Script/UAT | Required: screenshots/API responses/network log | Product Card action button regression | Include negative inactive/out-of-scope product cases if available. |
| PROMO-INT-001 | PROMO | P0 | Runtime integration | ADMIN, SUPER_ADMIN | Promotion sheet available | Valid promotion payload | 1. Save promotion. 2. Reload promotions. 3. Inspect sheet row. | Promotion persists; no fake success. | Not executed. | Blocked - live deployment unavailable | Apps Script/UAT | Required: sheet row/API response | M-6, Phase 3 | Include validation error path. |
| PROMO-INT-002 | PROMO | P1 | Runtime integration | SALES, VIEWER, MANAGER | Lower-role credentials | Promotion save payload | 1. Attempt save promotion directly. | Backend denies unauthorized promotion save. | Not executed. | Blocked - live credentials unavailable | Apps Script/UAT | Required: API response/log | RBAC write protection | Direct API check. |
| QUOTE-INT-001 | QUOTE | P0 | Runtime integration | SALES, ADMIN, SUPER_ADMIN | Customer in scope; Weber products | Weber quote payload | 1. Create quote. 2. Add Weber product. 3. Save. 4. Load by quoteNo. | Quote saves and reloads with correct totals/status/owner. | Not executed. | Blocked - live deployment unavailable | Apps Script/UAT | Required: API response/sheet rows | Quotation core workflow | Include idempotency key. |
| QUOTE-INT-002 | QUOTE | P0 | Runtime integration | SALES, ADMIN, SUPER_ADMIN | Customer in scope; Gyproc products | Gyproc quote payload | 1. Create quote. 2. Add Gyproc product. 3. Save. 4. Load by quoteNo. | Quote saves and reloads with correct totals/status/owner. | Not executed. | Blocked - live deployment unavailable | Apps Script/UAT | Required: API response/sheet rows | Quotation core workflow | Verify BU/product compatibility. |
| QUOTE-INT-003 | QUOTE | P0 | Runtime integration | SALES | SALES_A and SALES_B credentials | Quote owned by SALES_A | 1. SALES_A loads quote. 2. SALES_B attempts same quoteNo. | SALES_B is denied even if quote was previously cached. | Not executed. | Blocked - live deployment unavailable | Apps Script/UAT | Required: API response/log | C-1, Phase 1 | Critical cache permission gate. |
| QUOTE-INT-004 | QUOTE | P0 | Runtime integration | SALES, ADMIN | Existing quote | Updated quote payload | 1. Load quote. 2. Modify qty/discount/unit/free item if available. 3. Save. 4. Reload. | Updated lines/totals persist accurately. | Not executed. | Blocked - live deployment unavailable | Apps Script/UAT | Required: before/after API response | Quotation update | Verify line IDs stable. |
| QUOTE-INT-005 | QUOTE | P0 | Runtime integration | Authorized edit roles | Existing quote | Cancel action payload | 1. Cancel quote. 2. Reload. 3. Attempt edit/save. | Status is CANCELLED; further edit/save denied. | Not executed. | Blocked - live deployment unavailable | Apps Script/UAT | Required: API response/sheet row | Quotation cancel | Direct API and UI. |
| QUOTE-INT-006 | QUOTE | P1 | Runtime integration | SALES, ADMIN | Existing quote | Duplicate action payload | 1. Duplicate quote. 2. Load new quote. | New quote is created with authenticated context and original lines copied. | Not executed. | Blocked - live deployment unavailable | Apps Script/UAT | Required: source/new quote responses | Duplicate quotation issue | Validate customer scope. |
| QUOTE-INT-007 | QUOTE | P0 | Runtime integration | SALES, ADMIN | Save endpoint deployed | Same payload and same clientRequestId | 1. Submit save. 2. Submit same request again within TTL. | Duplicate submit returns cached/idempotent result, not duplicate quote. | Not executed. | Blocked - live deployment unavailable | Apps Script/UAT | Required: API responses/sheet row count | Idempotency requirement | P0 duplicate prevention. |
| QUOTE-INT-008 | QUOTE | P0 | Runtime integration | Multiple users | ScriptLock enabled | Concurrent quote payloads | 1. Fire parallel saves from two users. 2. Inspect quoteNo and rows. | No duplicate quoteNo; no partial save remains. | Not executed. | Blocked - no concurrency harness/live deployment | Apps Script/UAT | Required: timestamps/API responses/sheet rows | Locking/concurrency | Automate later with harness. |
| QUOTE-INT-009 | QUOTE | P0 | Runtime integration | ADMIN, SALES | Simulated line/header write failure if possible | Fault injection or controlled failure | 1. Trigger save failure path. 2. Inspect header/line sheets. | Partial write is detected and rollback succeeds or failure reports rollback status. | Not executed. | Blocked - no safe fault-injection environment | Apps Script/UAT | Required: logs/sheet rows | Partial-save rollback | Requires UAT-only fault setup. |
| QUOTE-INT-010 | QUOTE | P0 | Runtime integration | All quote-view roles | Legacy quote exists | Legacy `QT-...` quoteNo | 1. Load legacy quote. 2. Preview/print/export. 3. Edit if role allowed. | Legacy quote remains compatible and is not converted unexpectedly. | Not executed. | Blocked - live legacy data unavailable | Apps Script/UAT | Required: screenshots/API response | Backward compatibility | P0 compatibility gate. |
| USER-INT-001 | USER | P0 | Runtime integration | SUPER_ADMIN, ADMIN | User sheet UAT | New user payload | 1. Create user with role/area. 2. Login as new user. | User is created with correct area/role/status and can login if active. | Not executed. | Blocked - live deployment unavailable | Apps Script/UAT | Required: sheet row/API response | User management | Verify hierarchy. |
| USER-INT-002 | USER | P0 | Runtime integration | ADMIN | Existing higher/equal role user | Role change payload | 1. ADMIN attempts to modify SUPER_ADMIN or own role/status. | Backend denies forbidden role/status change. | Not executed. | Blocked - live credentials unavailable | Apps Script/UAT | Required: API response/log | Role hierarchy/last SUPER_ADMIN | Security gate. |
| PROFILE-INT-001 | PROFILE | P1 | Runtime integration | All | Profile image folder configured | Valid image upload payload | 1. Upload image. 2. Save profile. 3. Reload current user. | `profileImageUrl` persists and response updates current user. | Not executed. | Blocked - Drive folder/live deployment unavailable | Apps Script/UAT/Drive | Required: API response/screenshot | Profile image workflow | Verify no permission changes. |
| API-INT-001 | API | P0 | Runtime integration | All | Live API deployment | Invalid/missing payloads | 1. Call critical APIs with missing required fields. 2. Call with malformed values. | APIs return validation errors without mutation. | Not executed. | Blocked - live deployment unavailable | Apps Script/UAT | Required: API responses/sheet row unchanged | API validation/error handling | Include customer/product/quote/user. |
| API-INT-002 | API | P0 | Runtime integration | All | Live API deployment | GET and POST calls | 1. Attempt write action with GET if possible. 2. Attempt authenticated read. | Writes require POST; authenticated reads do not expose token in URL flow. | Not executed. | Blocked - live deployment unavailable | Apps Script/UAT | Required: network trace/log | H-2/API method security | Browser network evidence required. |

## 10. Manual browser/PWA tests

These tests require actual browsers/devices. See `ACCESSIBILITY_CHECKLIST.md` for detailed accessibility/mobile checklist; this section cross-references it instead of duplicating every checklist item.

| Test ID | Module | Priority | Test type | Applicable roles | Preconditions | Test data | Numbered steps | Expected result | Actual result | Status | Environment | Evidence | Related audit finding or requirement | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AUTH-MAN-001 | AUTH | P1 | Manual browser/PWA | All | Browser session available | Valid users | 1. Login. 2. Refresh. 3. Logout. 4. Login as different user. | Session lifecycle works and private state does not leak. | Not executed. | Blocked - browser/session unavailable | Desktop/mobile browsers | Required: screenshots/network notes | Phase 7 | Must run on shared device. |
| RBAC-MAN-001 | RBAC | P1 | Manual browser/PWA | All roles | Browser and credentials available | Role users | 1. Login each role. 2. Inspect sidebar/topbar/settings/buttons. | Menus and action buttons match canonical RBAC; backend still denies direct invalid actions. | Not executed. | Blocked - credentials/browser unavailable | Desktop Chrome/Edge | Required: screenshots per role | Phase 2/3 | UI visibility is not security proof. |
| CUST-MAN-001 | CUST | P1 | Manual browser/PWA | SALES, ADMIN | Browser and UAT data | Scoped customers | 1. Open Customers. 2. Search/filter. 3. Open add/edit modal. | Cards, summary counts, area/brand display, modal scroll, and filters work without leakage. | Not executed. | Blocked - browser/UAT data unavailable | Desktop/mobile browsers | Required: screenshots | Customer area/brand workflow | Include iPhone Safari. |
| PROD-MAN-001 | PROD | P1 | Manual browser/PWA | SALES, ADMIN | Browser and product data | Products with promos/duplicates | 1. Open Products. 2. Search. 3. Open calculator. 4. Add to quote. | Product card uses selected record; calculator and quote use same price/unit. | Not executed. | Blocked - browser/UAT data unavailable | Desktop/mobile browsers | Required: screenshots | Product card/calculator compatibility | Include duplicate variants. |
| PROD-MAN-002 | PROD | P1 | Manual browser/PWA | SUPER_ADMIN, ADMIN, SALES | Browser/device and role credentials available | Product cards plus quote product picker results | 1. Open Product List on Desktop Chrome/Edge. 2. Toggle Favorite and Add Product. 3. Repeat on Android Chrome. 4. Repeat on iPhone Safari/PWA if installed. 5. Repeat from quotation search, favorite products, and pinned products. 6. Rapid-tap buttons and inspect console/network. | Favorite icon updates immediately; API failure rolls back; Add Product shows busy/disabled state and adds the correct product once; no JS errors, duplicate requests, touch conflicts, or broken quotation workflow. | Not executed. | Blocked - browser/device/live API unavailable | Desktop Chrome/Edge, Android Chrome, iPhone Safari, PWA | Required: screenshots/video/network log | Product Card action button regression | Validate minimum 44px touch targets and no card-click propagation. |
| PROMO-MAN-001 | PROMO | P2 | Manual browser/PWA | ADMIN, SALES | Browser and promotion data | Active/inactive promos | 1. Open Promotions. 2. Search. 3. View product promo teaser. | Promotions render correctly and save controls match role. | Not executed. | Blocked - browser/UAT data unavailable | Desktop/mobile browsers | Required: screenshots | Promotion persistence/UI | Lower priority if no active promos. |
| QUOTE-MAN-001 | QUOTE | P0 | Manual browser/PWA | SALES, ADMIN | Browser and UAT data | Customer/products | 1. Create quote. 2. Select BU/customer/product. 3. Edit cart. 4. Save. | No layout break; totals are correct; save button state prevents double-submit. | Not executed. | Blocked - browser/UAT data unavailable | Desktop Chrome/Edge, Android Chrome, iPhone Safari | Required: screenshots/video | Quotation workflow/mobile requirements | Critical manual gate. |
| QUOTE-MAN-002 | QUOTE | P1 | Manual browser/PWA | Quote-view roles | Browser and existing quotes | Saved quote | 1. Open history. 2. Search. 3. Open detail. 4. Print/PDF/PNG/share. | History/detail/export UI works and controls match role. | Not executed. | Blocked - browser/UAT data unavailable | Desktop/mobile browsers | Required: screenshots/files | Export/share requirements | Attach exported files. |
| PROFILE-MAN-001 | PROFILE | P1 | Manual browser/PWA | All | Browser/device camera roll available | Valid image file | 1. Open profile. 2. Upload image. 3. Save. 4. Refresh/logout-login/PWA reopen. | New avatar appears immediately and persists. | Not executed. | Blocked - browser/device/live API unavailable | iPhone Safari, Android Chrome, Desktop | Required: screenshots | Profile image issue | Include invalid URL fallback. |
| PWA-MAN-001 | PWA | P0 | Manual browser/PWA | All | PWA install available | Current deployment | 1. Install PWA. 2. Open standalone. 3. Login/logout. 4. Reopen. | Safe area, routing, cache refresh, and private cache isolation work. | Not executed. | Blocked - deployed PWA unavailable | iPhone Safari PWA, Android Chrome PWA | Required: screen recording | PWA/cache requirements | Critical for mobile rollout. |
| A11Y-MAN-001 | A11Y | P1 | Manual browser/PWA | All | Browser available | App pages | 1. Follow `ACCESSIBILITY_CHECKLIST.md`. 2. Verify keyboard focus, dialogs, live regions, touch targets. | Checklist items pass or defects are logged. | Not executed. | Blocked - browser/device unavailable | Desktop/mobile browsers | Required: completed checklist/screenshots | L-6/Phase 9 | Do not duplicate checklist here. |
| A11Y-MAN-002 | A11Y | P0 | Manual browser/PWA | SALES, ADMIN | iPhone and Android available | Customer modal and quote page | 1. Open customer modal. 2. Focus lower fields. 3. Open keyboard. 4. Save/validation error. | Header/footer visible, body scrolls, footer does not hide fields, no horizontal overflow. | Not executed. | Blocked - devices unavailable | iPhone Safari 375/390, Android Chrome 360 | Required: screenshots/video | Mobile modal/quotation responsive requirements | Critical mobile gate. |
| REG-MAN-001 | REG | P1 | Manual browser/PWA | All | Browser available | Existing regression scenarios | 1. Smoke Dashboard, Customers, Products, Promotions, Quotes, Reports, Users, Settings. | Existing behavior remains backward compatible after remediation. | Not executed. | Blocked - browser/credentials unavailable | Desktop/mobile browsers | Required: screenshots/notes | Regression/backward compatibility | Use before every release. |
| PERF-MAN-001 | PERF | P1 | Manual browser/PWA | SALES, ADMIN | Browser and larger UAT data | Large customers/products/quotes data | 1. Load dashboard. 2. Load customers/products/history. 3. Measure perceived load/API duration. | No timeout or severe delay; API request timeout is not exceeded. | Not executed. | Blocked - large live dataset unavailable | Desktop/mobile browsers | Required: timings/network screenshots | Performance audit/API timeout | Record Apps Script execution durations. |
| PERF-MAN-002 | PERF | P2 | Manual browser/PWA | ADMIN | Browser and UAT sheet | User/customer migrations if triggered | 1. Trigger allowed migration/setup flow in UAT. 2. Observe execution time/logs. | Batched sheet operations complete without timeout. | Not executed. | Blocked - live UAT migration environment unavailable | Apps Script/UAT | Required: logs | Phase 6 performance | UAT only; do not run in production casually. |
| REG-MAN-002 | REG | P2 | Manual browser/PWA | All | Browser available | Legacy assets/cache | 1. Hard refresh. 2. Open old bookmarked routes if any. 3. Verify assets/logos/icons. | No stale missing asset or broken icon. | Not executed. | Blocked - browser/deployment unavailable | Desktop/mobile browsers | Required: screenshots | Version/cache backward compatibility | Include service worker update. |
| QUOTE-MAN-003 | QUOTE | P1 | Manual browser/PWA | SALES | Browser and product preferences | Favorite/pinned products | 1. Add favorite/pinned product. 2. Reorder pinned. 3. Search product picker. | Favorites/pinned render, persist, and do not duplicate or hide search results. | Not executed. | Blocked - browser/live API unavailable | Desktop/mobile browsers | Required: screenshots/API responses | Product favorite/pinned workflow | Also tests generated button type. |
| CUST-MAN-002 | CUST | P2 | Manual browser/PWA | SALES | Browser and favorites data | 5 favorite customers | 1. Add/reorder/remove favorites. 2. Change search/filter. | Favorites respect max count and area scope; no duplicate favorite cards. | Not executed. | Blocked - browser/live API unavailable | Desktop/mobile browsers | Required: screenshots/API responses | Favorite customer scope | Include out-of-scope negative case. |
| CUST-MAN-003 | CUST | P1 | Manual browser/PWA | SUPER_ADMIN, ADMIN, SALES, VIEWER | Browser/device and role credentials available | Customer cards visible in each role scope | 1. Open Customers on Desktop Chrome/Edge. 2. Click Details, Edit, and Favorite. 3. Repeat on Android Chrome. 4. Repeat on iPhone Safari/PWA if installed. 5. Rapid-tap Favorite. 6. Inspect console/network. | Buttons respond on desktop/mobile; Details modal opens; Edit opens only when permitted; Favorite shows busy state, toggles once per click, rolls back on API failure, and shows toast feedback; no JS errors or horizontal/touch issues. | Not executed. | Blocked - browser/device/live API unavailable | Desktop Chrome/Edge, Android Chrome, iPhone Safari, PWA | Required: screenshots/video/network log | Customer Card action button regression | Validate 44px touch target and backend area enforcement. |

## 11. Production post-deployment smoke tests

Run these immediately after production deployment. Do not mark Passed unless run against production.

| Test ID | Module | Priority | Test type | Applicable roles | Preconditions | Test data | Numbered steps | Expected result | Actual result | Status | Environment | Evidence | Related audit finding or requirement | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| REG-SMOKE-001 | REG | P0 | Production smoke | SUPER_ADMIN | Production deployed | SUPER_ADMIN account | 1. Open production app. 2. Login. 3. Verify version/assets. | App loads current assets and login succeeds. | Not executed. | Blocked - production deployment not available in local environment | Production browser | Required: screenshot/version evidence | Release readiness | First smoke test after deploy. |
| RBAC-SMOKE-001 | RBAC | P0 | Production smoke | SALES, VIEWER | Production users available | SALES/VIEWER accounts | 1. Login SALES. 2. Verify area-limited customers. 3. Login VIEWER. 4. Verify read-only UI. | No scope leak and no write affordance for VIEWER. | Not executed. | Blocked - production credentials unavailable | Production browser | Required: screenshots | RBAC/data security | Redact customer-sensitive screenshots. |
| API-SMOKE-001 | API | P0 | Production smoke | All | Production API deployed | Known invalid API request | 1. Attempt one unauthorized direct API call with safe payload. | Backend denies with expected error and no mutation. | Not executed. | Blocked - production deployment unavailable | Production Apps Script | Required: API response/log | Backend authorization | Use non-destructive request. |
| QUOTE-SMOKE-001 | QUOTE | P0 | Production smoke | SALES or ADMIN | Production-safe test customer/product | Test quotation payload | 1. Create test quote. 2. Save. 3. Load. 4. Cancel if appropriate. | Quote workflow succeeds without duplicate/partial data. | Not executed. | Blocked - production deployment unavailable | Production browser/API | Required: quoteNo/API response | Core production workflow | Use approved test customer only. |
| QUOTE-SMOKE-002 | QUOTE | P1 | Production smoke | Quote-view role | Existing production quote | Existing quoteNo | 1. Open history/detail. 2. Preview print. | Read-only quote display and print preview work. | Not executed. | Blocked - production deployment unavailable | Production browser | Required: screenshot | Export/preview readiness | Avoid sending real share links unless approved. |
| PWA-SMOKE-001 | PWA | P1 | Production smoke | Any | Production PWA installed | Production app | 1. Open installed PWA. 2. Confirm cache update. 3. Login/logout. | PWA uses current release and does not show stale private data. | Not executed. | Blocked - production PWA unavailable | Production iPhone/Android | Required: screen recording | PWA/cache isolation | Run on upgraded install, not only fresh install. |
| PROFILE-SMOKE-001 | PROFILE | P1 | Production smoke | Any | Production Drive/profile config ready | Small approved profile image | 1. Upload image. 2. Save. 3. Refresh. | Profile image displays and persists. | Not executed. | Blocked - production deployment unavailable | Production browser/device | Required: screenshot | Profile image workflow | Use test account. |
| PROMO-SMOKE-001 | PROMO | P2 | Production smoke | ADMIN | Production promotion edit approved | Safe promotion test data | 1. Save safe test promotion or verify UAT-only if production write not allowed. | Promotion persistence works or production write is intentionally skipped with sign-off. | Not executed. | Blocked - production write approval unavailable | Production/UAT | Required: sign-off/API response | Promotion stub remediation | Do not create fake production promo without approval. |
| USER-SMOKE-001 | USER | P1 | Production smoke | SUPER_ADMIN/ADMIN | Production admin account | Existing non-critical user | 1. Open Users. 2. Search user. 3. Open edit view without saving. | User management UI loads and role hierarchy controls are sane. | Not executed. | Blocked - production credentials unavailable | Production browser | Required: screenshot | User management readiness | Avoid mutating production user unless approved. |
| A11Y-SMOKE-001 | A11Y | P1 | Production smoke | Any | Production browser | Main pages | 1. Keyboard tab through login/main nav. 2. Open one modal. | Visible focus and dialog semantics work in production. | Not executed. | Blocked - production browser session unavailable | Production browser | Required: screenshot/checklist | Phase 9 | Use `ACCESSIBILITY_CHECKLIST.md`. |
| PERF-SMOKE-001 | PERF | P1 | Production smoke | SALES/ADMIN | Production dataset | Normal user workflow | 1. Load dashboard/customers/products/history. 2. Record rough timings. | No user-facing API timeout or severe delay. | Not executed. | Blocked - production deployment unavailable | Production browser/Apps Script logs | Required: network timing/logs | Performance/readiness | Establish baseline. |

## 12. Retest and regression procedure

When a defect is found:

1. Assign severity using the rules in section 3.
2. Record environment, role, exact data, steps, screenshots/logs, and related test id.
3. Fix in a focused branch/commit.
4. Retest the failed test case only.
5. Run regression tests for the impacted module and all P0 security/RBAC/cache tests.
6. Update `Actual result`, `Status`, `Evidence`, and `Notes` in a copy of this catalogue or in the test execution tracker.
7. Do not modify this baseline to mark a test Passed unless the execution actually happened.

## 13. Automation candidates

Highest-value future automation:

- Static checks: API JSONP policy, service-worker cache policy, stale version strings, duplicate function declarations, button type scan.
- Apps Script/API integration: auth, RBAC direct API denials, customer scope, discount scope, quotation save/load/idempotency/concurrency.
- Browser automation: route guards, visible/hidden buttons by role, quotation create/save/history/export smoke, responsive overflow checks.
- Accessibility automation: axe/Playwright smoke using `ACCESSIBILITY_CHECKLIST.md` as the baseline.

## 14. Blocked execution summary

Runtime/manual tests are blocked in this local environment because:

- No live Google Apps Script deployment credentials were provided.
- No live or UAT Google Sheets dataset is accessible from this environment.
- No browser automation stack is configured.
- Local JavaScript runtimes (`node`, `deno`, `bun`) were not available during remediation validation.
- Physical/real iPhone Safari, Android Chrome, and installed PWA sessions are not available through repository-only tools.

These blocked tests must be executed during UAT and production smoke phases before a final production Go decision.
