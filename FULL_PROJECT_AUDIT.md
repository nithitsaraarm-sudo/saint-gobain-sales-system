# Full Project Audit — Saint-Gobain Sales System

วันที่ตรวจ: 2026-07-26  
สถานะ: Full repository audit / read-only analysis ยกเว้นการสร้างไฟล์รายงานนี้  
Repository root: `D:\saint-gobain-sales-system`

## Remediation Status Addendum — 2026-07-26

This document is the original full-repository audit baseline. The original findings below are intentionally preserved for traceability.

Current remediation status on branch `audit/full-remediation`:

| Area | Status | Commit / source |
|---|---|---|
| Quotation cache permission bypass | Fixed | Phase 1: `4ed7abba5628b1f3b4dae490a2ae823e5586a7a3` |
| Discount customer/area scope validation | Fixed | Phase 1: `4ed7abba5628b1f3b4dae490a2ae823e5586a7a3` |
| Token-bearing JSONP and service-worker API caching | Fixed | Phase 1: `4ed7abba5628b1f3b4dae490a2ae823e5586a7a3` |
| MANAGER/VIEWER quotation RBAC drift | Fixed | Phase 2: `064bdcf243e2fc26c6cbefa8a73964aa9d517071` |
| Customer form option metadata exposure | Fixed | Phase 2: `064bdcf243e2fc26c6cbefa8a73964aa9d517071` |
| Promotion save stub and demo-login production visibility | Fixed | Phase 3: `8f306fdf9e67136332e0a5446852b158babd08c2` |
| Version/cache/deployment config drift | Fixed | Phase 4: `89f6b53e54f82bf2af2627ac6482b537ec50eb5b` |
| External CDN SRI and frontend render escaping | Fixed / partially migrated | Phase 5: `fc256877e42a970cecf5353bac4c95868bbf0d2c` |
| Apps Script row update/delete performance hotspots | Improved | Phase 6: `fb7e3e4cb59ebab9ebf50ed0a2c9608d652524c3` |
| Frontend private cache/session leakage risk | Fixed | Phase 7: `2caeaca4fecec848dc7ef771a8d6080a50a6d79f` |
| Duplicate legacy renderer definitions | Fixed | Phase 8: `f6981df33420d545e271ed49ff9f8715b655dc77` |
| Manual accessibility checklist and button/modal semantics | Added / improved | Phase 9: `0b54ca266866f8cd05cf90aede2ff6a2e9526156` |

Detailed phase notes are maintained in `REMEDIATION_PROGRESS.md`. Accessibility/manual browser checks are maintained in `ACCESSIBILITY_CHECKLIST.md`.

## 1. Scope Summary

Audit รอบนี้ครอบคลุมทุกไฟล์ที่อยู่ใน repository inventory ด้วย `rg --files` และ `Get-ChildItem`:

- Total inventory: 66 files รวมไฟล์ audit ก่อนหน้า `RBAC_PERMISSION_AUDIT.md`
- Project files เดิมก่อนสร้าง audit documents: 65 files
- Text/code files inspected: HTML, CSS, JS, Apps Script, Markdown, JSON, SVG
- Binary assets inspected: PNG/ICO metadata, size, dimensions, hash uniqueness
- No code fix was applied in this audit
- No backend/API/database/business logic was changed

ข้อจำกัด:

- ไม่มี access ไปยัง live Google Sheets data จึงตรวจ schema จาก source code และ docs เท่านั้น
- ไม่มี local Node.js ในเครื่องนี้ (`node` command not found) จึงไม่สามารถรัน `node --check`, lint หรือ test runner ได้
- ไม่พบ `package.json` หรือ test/build config จึงไม่มี automated test command ให้รัน

## 2. Files Audited

### Root / Frontend

- `index.html`
- `manifest.json`
- `service-worker.js`
- `favicon.ico`

### CSS

- `css/main.css`

### Frontend JavaScript

- `js/config.js`
- `js/api.js`
- `js/auth.js`
- `js/app.js`
- `js/quotation.js`

### Apps Script Backend

- `appscript/Api.gs`
- `appscript/Auth.gs`
- `appscript/Code.gs`
- `appscript/Config.gs`
- `appscript/Constants.gs`
- `appscript/Customer.gs`
- `appscript/Database.gs`
- `appscript/Discount.gs`
- `appscript/FavoriteCustomer.gs`
- `appscript/FavoriteProduct.gs`
- `appscript/Logger.gs`
- `appscript/Permission.gs`
- `appscript/Product.gs`
- `appscript/Quotation.gs`
- `appscript/Response.gs`
- `appscript/User.gs`
- `appscript/Validator.gs`
- `appscript/README_APPSCRIPT.md`

### Assets

- `images/.gitkeep`
- `images/gyproc-logo.png`
- `images/weber-logo.png`
- `icons/apple-touch-icon.png`
- `icons/favicon-16x16.png`
- `icons/favicon-32x32.png`
- `icons/icon-192.png`
- `icons/icon-512.png`
- `icons/icon-maskable-192.png`
- `icons/icon-maskable-512.png`
- `assets/icons/logout.svg`
- `assets/icons/sidebar/calculator.png`
- `assets/icons/sidebar/create-quotation.png`
- `assets/icons/sidebar/customer.png`
- `assets/icons/sidebar/dashboard.png`
- `assets/icons/sidebar/home.png`
- `assets/icons/sidebar/logout.png`
- `assets/icons/sidebar/product.png`
- `assets/icons/sidebar/promotion.png`
- `assets/icons/sidebar/quotation.png`
- `assets/icons/sidebar/quotation-history.png`
- `assets/icons/sidebar/quote-history.png`
- `assets/icons/sidebar/reports.png`
- `assets/icons/sidebar/settings.png`
- `assets/icons/sidebar/users.png`

### Documentation

- `API.md`
- `CHANGELOG.md`
- `CODING_STANDARD.md`
- `DATABASE.md`
- `DEPLOYMENT.md`
- `DISCOUNT_ENGINE_SPEC.md`
- `FOLDER_STRUCTURE.md`
- `PROJECT_PLAN.md`
- `QUOTATION_ENGINE_SPEC.md`
- `README.md`
- `SECURITY.md`
- `WORK_HISTORY.md`
- `RBAC_PERMISSION_AUDIT.md`

## 3. Repository Health Snapshot

Largest maintainability hotspots by line count:

| File | Lines | Risk |
|---|---:|---|
| `js/quotation.js` | 5098 | Very high complexity / hard to review safely |
| `js/app.js` | 3125 | Very high complexity / mixed responsibilities |
| `appscript/Quotation.gs` | 1995 | High complexity / core business risk |
| `appscript/Customer.gs` | 1399 | High complexity / permission + migration risk |
| `appscript/User.gs` | 911 | Medium/high auth-profile-user risk |
| `css/main.css` | 545 lines but 91 KB | Dense minified-like CSS, hard to diff/review |

No test/build scaffold found:

- No `package.json`
- No `package-lock.json`
- No `pnpm-lock.yaml`
- No `yarn.lock`
- No `jest.config.*`
- No `vitest.config.*`
- No `playwright.config.*`
- No `tsconfig.json`

## 4. Severity Summary

| Severity | Count | Theme |
|---|---:|---|
| Critical | 1 | Quotation cache authorization bypass |
| High | 6 | API scope, token/caching, config/deployment, external scripts |
| Medium | 14 | permission drift, maintainability, data consistency, PWA cache, performance |
| Low / Hygiene | 9 | docs drift, asset cleanup, version consistency, coding standards |

## 5. Critical Findings

### C-1: `loadQuotation()` server cache can bypass permission

Files:

- `appscript/Quotation.gs`
- Related cache usage in `js/api.js`

Finding:

- `loadQuotation(payload)` checks `getServerCache(getLoadQuotationCacheKey(quoteId))` and returns cached quote data before running `canAccessQuotationRecord(payload.currentUser, quote)`.
- This was also documented in `RBAC_PERMISSION_AUDIT.md`.

Risk:

- If an authorized user loads a quotation and it enters server cache, another authenticated user could potentially request the same quote id/quote no and receive cached data without the intended ownership/role check.

Recommended fix:

- Permission must be checked before cached data is returned.
- Either make the cache key user/scope-aware or cache only after validating access for the current request.

## 6. High Findings

### H-1: `discount` API lacks customer/area scope validation

Files:

- `appscript/Api.gs`
- `appscript/Discount.gs`
- `js/quotation.js`

Finding:

- API action `discount` directly calls `getDiscount(payload.customerId, payload.groupCode)`.
- Any authenticated user can query arbitrary customer/group discount if they know ids.

Risk:

- Sales users may infer discounts outside their assigned sales area or assigned customers.

Recommended fix:

- In `Api.gs`, validate `getCustomer(customerId, { currentUser: user })` before returning discount.
- Scope frontend/local discount cache by user/session.

### H-2: Authenticated JSONP GET sends `sessionToken` in URL

Files:

- `js/api.js`
- `appscript/Code.gs`
- `service-worker.js`

Finding:

- Read actions use JSONP via `<script src="... ?action=...&payload=...&callback=...">`.
- `payload` can include `sessionToken`.
- URLs can be visible in browser history/devtools/proxies and may be cached by Service Worker.

Risk:

- Session token exposure via URL.

Recommended fix:

- Prefer POST for authenticated requests.
- If JSONP must remain for Apps Script/CORS compatibility, remove token-bearing requests from Service Worker caching and aggressively avoid logging full URLs.

### H-3: Service Worker caches every GET response

File:

- `service-worker.js`

Finding:

```js
if (event.request.method !== 'GET') return;
caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
  const copy = response.clone();
  caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
  return response;
})
```

Risk:

- Authenticated API GET/JSONP responses and token-bearing URLs can be cached.
- Offline fallback returns `index.html` for failed GETs, which can mask broken asset/API requests.

Recommended fix:

- Only cache same-origin static assets from an allowlist.
- Exclude Apps Script URL, `script.google.com`, URLs with `sessionToken`, `payload`, or `callback`.

### H-4: Hardcoded Google Apps Script Web App URL in frontend

File:

- `js/api.js`

Finding:

- `GAS_WEB_APP_URL` contains a concrete Apps Script deployment URL.
- `DEPLOYMENT.md` recommends storing `DEPLOY_ID` in secret/environment and not in repo.

Risk:

- Environment drift and accidental production endpoint exposure.
- Harder to separate dev/UAT/prod.

Recommended fix:

- Move API base URL into environment-specific config that is intentionally managed.
- At minimum, document that this public web app URL is not secret and define separate values for dev/UAT/prod.

### H-5: External CDN scripts have no SRI / CSP hardening

File:

- `index.html`

Finding:

- External scripts are loaded from jsDelivr:
  - `html2canvas@1.4.1`
  - `jspdf@2.5.1`
- No `integrity` attribute.
- No visible CSP policy in static app.

Risk:

- Supply-chain / CDN compromise risk.

Recommended fix:

- Add SRI hashes and `crossorigin="anonymous"`, or vendor/pin reviewed copies locally.
- Add a deploy-time CSP where hosting supports it.

### H-6: Quotation role policy drift across frontend/backend

Files:

- `js/app.js`
- `appscript/Permission.gs`
- `appscript/Code.gs`
- `appscript/Quotation.gs`

Finding:

- Backend `canCreateQuotations` includes `MANAGER`.
- Frontend route guard hides Quote page from `MANAGER`.
- `filterQuotesForUser()` allows `MANAGER` broad quote list in bootstrap.
- `canAccessQuotationRecord()` does not grant `MANAGER` access.
- `VIEWER` can view quotations broadly in helper, but UI action controls are not consistently restricted.

Risk:

- Inconsistent UX and possible direct API behavior mismatch.

Recommended fix:

- Define one canonical quotation permission matrix and reuse it in all backend endpoints.
- Then align frontend route/menu visibility to the backend truth.

## 7. Medium Findings

### M-1: Core frontend files are too large and mixed-responsibility

Files:

- `js/app.js`
- `js/quotation.js`

Finding:

- `js/quotation.js` is over 5000 lines.
- `js/app.js` is over 3000 lines.
- Both contain UI rendering, state, event wiring, API orchestration, validation, and utility logic.

Risk:

- Bug fixes become risky because unrelated behavior shares global state and duplicated functions.

Recommended fix:

- Split by domain:
  - `quotation/state.js`
  - `quotation/render.js`
  - `quotation/print-export.js`
  - `customers/render.js`
  - `settings/profile.js`
  - `shared/dom.js`

### M-2: Dense CSS makes responsive regressions likely

File:

- `css/main.css`

Finding:

- CSS is 91 KB in only 545 lines.
- Many unrelated responsive rules are packed densely.

Risk:

- Small changes are hard to review and can affect unrelated pages.

Recommended fix:

- Split into logical sections/files or at least expand formatting:
  - `base.css`
  - `layout.css`
  - `sidebar.css`
  - `quotation.css`
  - `customer-modal.css`
  - `print.css`

### M-3: Inline event handlers throughout HTML and generated HTML

Files:

- `index.html`
- `js/app.js`
- `js/quotation.js`

Finding:

- Many handlers use `onclick`, `oninput`, `onerror`, and generated inline JavaScript.

Risk:

- Harder CSP adoption.
- Higher XSS blast radius if any unescaped value enters generated handler strings.

Recommended fix:

- Migrate high-risk generated lists to delegated event listeners with `data-*` attributes.
- Keep CSP-compatible patterns for new code.

### M-4: XSS protection is present but uneven

Files:

- `js/app.js`
- `js/quotation.js`

Finding:

- There are helpers like `escapeHtml()` and `escapeQuotationPrintHtml()`.
- Some older/generated snippets still interpolate product/customer values into `innerHTML`.
- Some handlers embed serialized objects into inline `onclick`.

Risk:

- If Sheet data contains unexpected HTML/quotes/script-like text, UI rendering may be vulnerable in older paths.

Recommended fix:

- Make escaped rendering mandatory for every Sheet-sourced string.
- Avoid inline object serialization in handler attributes.

### M-5: Apps Script uses cell-by-cell writes in some loops

Files:

- `appscript\Database.gs`
- `appscript\Quotation.gs`
- `appscript\User.gs`
- `appscript\Customer.gs`

Examples:

- `updateRowById()` writes each updated cell with `sheet.getRange(...).setValue(...)`
- user/customer migration helpers use `setValue()` inside row loops
- quotation line replacement deletes rows one by one

Risk:

- Slow execution on large Sheets.
- Timeout risk in Apps Script.

Recommended fix:

- Batch writes where possible.
- For migrations, read/write full ranges once.

### M-6: `savePromotion()` backend is a stub

File:

- `appscript/Code.gs`

Finding:

```js
function savePromotion(payload) {
  try {
    return success(payload || {}, 'Promotion saved');
  } catch (error) {
    ...
  }
}
```

Risk:

- UI/API can report promotion saved without persisting data.

Recommended fix:

- Either implement real Promotions sheet write/update or disable/hide promotion create UI until implemented.

### M-7: Version values are inconsistent

Files:

- `js/config.js`
- `js/api.js`
- `appscript/Constants.gs`
- `index.html`
- `manifest.json`
- `service-worker.js`

Finding:

- Frontend `APP_VERSION`: `0.5.24`
- `js/api.js` fallback: `0.5.17`
- Apps Script `APP_VERSION`: `0.5.6`
- Manifest/icon cache query: `0.5.7`
- Logo query: `0.5.8`
- Logout icon query: `0.5.14`
- Service worker cache: `sales-system-v5-0.5.24`

Risk:

- PWA stale cache and confusing debugging.

Recommended fix:

- Use a single release version source and bump consistently per deployment.

### M-8: API.md appears outdated against actual API dispatcher

Files:

- `API.md`
- `appscript/Api.gs`
- `js/api.js`

Finding:

- Docs mention endpoint/action examples like `getBootstrapData`, `loginUser`, `getQuotation`.
- Current client/server use dispatcher actions like `bootstrap`, `login`, `loadQuotation`, `getQuotationHistory`.

Risk:

- New developers may call wrong actions.

Recommended fix:

- Generate/update API docs from actual `Api.gs` switch cases.

### M-9: Folder structure docs are outdated

Files:

- `FOLDER_STRUCTURE.md`
- `appscript/README_APPSCRIPT.md`

Finding:

- Folder docs still describe a simplified structure.
- Actual repo has many Apps Script files, `js/api.js`, `js/config.js`, assets sidebar icons, and audit docs.

Risk:

- Deployment/copy order mistakes.

Recommended fix:

- Update folder structure and copy-order docs after each backend file addition.

### M-10: Profile image workflow exists but depends on Drive folder setup

Files:

- `index.html`
- `js/app.js`
- `appscript/User.gs`

Finding:

- Backend has `PROFILE_IMAGE_FOLDER_ID` and auto-create folder logic.
- Upload uses Apps Script/Drive and public URL patterns.
- This is workable, but runtime depends on Drive permissions and deployment identity.

Risk:

- Upload may fail in deployments without Drive permission or with restricted execution identity.

Recommended fix:

- Document required Apps Script scopes/deployment account behavior.
- Add a visible health/error message when Drive folder creation/upload fails.

### M-11: Customer form options can expose sales user metadata broadly

Files:

- `appscript/Customer.gs`
- `appscript/Api.gs`

Finding:

- `getCustomerFormOptions`, `getAssignableSalesUsers`, and related options are allowed for all authenticated roles.

Risk:

- Lower-privileged users can see sales user/area metadata that may not be necessary.

Recommended fix:

- Return reduced metadata for non-admin roles or restrict full options to `canManageCustomers`.

### M-12: Quotation number schema fields are derived, not stored

File:

- `appscript/Quotation.gs`

Finding:

- New format helpers exist for `WEBQT/GYPQT/MBQT`.
- `getQuoteHistoryHeaders()` does not include optional `quotationPrefix`, `quotationYearMonth`, or `quotationRunning`.

Risk:

- This is not necessarily wrong because `quoteNo` stores the full number.
- Reporting or later debugging may require parsing `quoteNo` repeatedly.

Recommended fix:

- Keep as-is if avoiding schema changes is preferred.
- If reporting needs grow, add optional fields through a migration with clear backward compatibility.

### M-13: Product duplicate guard exists, but live Sheet cleanup cannot be verified locally

File:

- `appscript/Product.gs`

Finding:

- Helpers exist:
  - `createProductIdentityKey(product)`
  - `dedupeExactProducts(products)`
  - `auditProductSheetDuplicates()`
- Live Products sheet is not available in repo, so actual duplicate count cannot be verified in this audit.

Risk:

- UI may still depend on production Sheet cleanup/data quality.

Recommended fix:

- Run `auditProductSheetDuplicates()` in Apps Script against production/UAT copy and save the report.

### M-14: Demo login is visible in UI even though backend disables it

Files:

- `index.html`
- `appscript/Auth.gs`

Finding:

- Login screen still shows Demo Login button.
- Backend `demoLogin()` returns disabled.

Risk:

- UX confusion in production.

Recommended fix:

- Hide Demo Login button when `APP_ENV === 'production'`.

## 8. Low / Hygiene Findings

### L-1: `CHANGELOG.md` is stale

Status:

- Updated in Phase 10 with `0.5.25` remediation notes.

Finding:

- Changelog only documents `0.1.0` and initial docs.
- Current app version is `0.5.24`.

Recommended fix:

- Update changelog for recent UI, customer-area, quotation, profile image, PWA, and security changes.

### L-2: `README.md` still refers to `docs/` although docs are in root

Finding:

- README says “files in `docs/` or root” but no `docs/` folder exists.

Recommended fix:

- Clarify current docs layout or create `docs/`.

### L-3: Asset naming has legacy duplicates

Files:

- `assets/icons/sidebar/quotation.png`
- `assets/icons/sidebar/quote-history.png`
- `assets/icons/sidebar/quotation-history.png`

Finding:

- Both `quote-history.png` and `quotation-history.png` exist.
- Current sidebar uses `quotation-history.png`.

Recommended fix:

- Keep legacy asset only if referenced by older deployments; otherwise remove after a deprecation check.

### L-4: CSS uses many inline styles in HTML

File:

- `index.html`

Finding:

- Several `style="..."` attributes remain.

Recommended fix:

- Move recurring inline styles into CSS classes for maintainability and CSP readiness.

### L-5: `manifest.json` versioned icon query params differ from app version

Status:

- Fixed in Phase 4 by aligning app, manifest, asset, and service-worker cache versions to `0.5.25`.

Finding:

- Manifest icons use `?v=0.5.7` while app is `0.5.24`.

Recommended fix:

- Align version strategy or document why asset cache versions differ.

### L-6: No automated accessibility audit

Status:

- Manual checklist added in Phase 9: `ACCESSIBILITY_CHECKLIST.md`.
- Automated axe/playwright/lighthouse checks remain future work.

Finding:

- UI includes many `aria-label`s and alt-empty decorative images.
- No automated axe/playwright/lighthouse config exists.

Recommended fix:

- Add at least a manual accessibility checklist; later add Playwright + axe.

### L-7: No CSP-ready event architecture

Finding:

- Inline handlers block strict CSP adoption.

Recommended fix:

- Start with new features using delegated listeners; do not add new inline handlers.

### L-8: Apps Script copy order must be kept current

File:

- `appscript/README_APPSCRIPT.md`

Finding:

- Copy order currently lists all backend files observed.
- This is good, but manually maintained.

Recommended fix:

- Re-check copy order on every new Apps Script file.

### L-9: Report/audit docs are now untracked unless committed

Files:

- `RBAC_PERMISSION_AUDIT.md`
- `FULL_PROJECT_AUDIT.md`

Finding:

- Audit docs are useful but need commit if they should persist in Git.

Recommended fix:

- Commit them with a docs commit if the team wants permanent history.

## 9. Asset Audit

Image dimensions verified:

| Asset group | Result |
|---|---|
| Sidebar icons | All 256x256 PNG |
| PWA icons | 16, 32, 180, 192, 512 sizes present |
| Brand logos | `gyproc-logo.png` 613x180, `weber-logo.png` 585x180 |
| Logout SVG | Vector file present |

Hash check:

- All inspected image/icon files have distinct SHA-256 hashes.
- No exact duplicate binary asset was detected from the audited asset set.

Risk notes:

- Sidebar icon set is coherent in size.
- Brand logos are wider aspect-ratio assets and need CSS `object-fit: contain`, which is already used in quotation logo-related CSS/HTML.
- Keep only currently referenced legacy icons after confirming no deployment uses older filenames.

## 10. PWA / Cache Audit

Files:

- `manifest.json`
- `service-worker.js`
- `js/config.js`
- `index.html`
- `js/api.js`

Good:

- Manifest has standalone display, portrait orientation, Thai language, theme/background colors.
- Service worker precaches primary static assets.
- `APP_VERSION` and `CACHE_VERSION` exist.

Risks:

- Service worker caches all GETs, including external or token-bearing requests.
- Mixed asset version query strings increase stale-cache debugging cost.
- No explicit cache exclusion for Apps Script API.

Recommended priority:

1. Exclude API/JSONP and token-bearing URLs from SW cache.
2. Align cache version strategy.
3. Add a PWA cache smoke test checklist for deploy.

## 11. Frontend UI/UX Audit

Good:

- Customer modal has mobile-safe layout:
  - `100dvh` fallback
  - safe-area env support
  - scroll body
  - fixed header/footer within modal
  - `-webkit-overflow-scrolling: touch`
- Quotation responsive CSS includes many mobile-specific fixes.
- Sidebar icons are image assets and dimensions are consistent.
- Profile upload input is mobile-friendly and visually hidden with accessible label pattern.

Risks:

- UI code heavily relies on inline event handlers and generated HTML.
- Some pages mix Thai and English labels:
  - `Users`
  - `Change Password`
  - `Print`, `Save PDF`, `Save PNG`, `Share`
  - `+ New Quotation`
- Settings data tile exposes add-data affordances to all roles, even when backend will reject some saves.

Recommended fix:

- Standardize user-facing language.
- Create role-aware UI components for action buttons.
- Move inline handlers to event delegation gradually.

## 12. Backend / Apps Script Audit

Good:

- Central `api(action, payload)` dispatcher exists.
- Most write actions are POST-only from `doGet` blocker.
- `requireApiUser` is used for non-public actions.
- Users role management has hierarchy guard and last SUPER_ADMIN protection.
- Customer area/assigned-sales scope is implemented in backend.
- Quotation save has ScriptLock, idempotency, partial-save verification, and rollback attempts.
- Product duplicate identity helpers exist.

Risks:

- `discount` action lacks customer scope validation.
- `loadQuotation` cache permission bypass.
- `savePromotion` stub.
- Some operations use row/cell loops that can be slow on large Sheets.
- App version in `appscript/Constants.gs` is stale relative to frontend.

Recommended fix:

- Address security first, then performance refactors.

## 13. Documentation Audit

Good:

- Project has substantial docs:
  - README
  - API
  - DATABASE
  - SECURITY
  - DEPLOYMENT
  - Coding standard
  - Quotation/Discount specs
  - Work history

Risks:

- Some docs are clearly older than current implementation.
- `API.md` uses action names that differ from current dispatcher.
- `CHANGELOG.md` is not maintained for current version.
- `FOLDER_STRUCTURE.md` is simplified and omits current backend/frontend files.
- `DEPLOYMENT.md` says deploy id should not be stored in repo, but `js/api.js` stores concrete Web App URL.

Recommended fix:

- Update docs after security fixes.
- Add a generated API/action list from `appscript/Api.gs`.

## 14. Recommended Implementation Order

1. Fix `loadQuotation()` cache authorization bypass.
2. Add customer/area scope validation to `discount` API.
3. Exclude API/JSONP/token-bearing URLs from Service Worker cache.
4. Decide and centralize quotation policy for `MANAGER` and `VIEWER`.
5. Hide/disable Settings > Add Data controls for users without backend permissions.
6. Implement or disable `savePromotion`.
7. Align version numbers and cache busting.
8. Update API/deployment/folder/changelog docs.
9. Add minimal test harness or smoke-test checklist.
10. Begin modularizing `js/quotation.js`, `js/app.js`, and `css/main.css`.

## 15. Suggested Test Checklist

Because no automated test runner exists, use this as current manual smoke checklist:

### Auth

- Login valid user
- Logout
- Expired/invalid session
- Must-change-password flow
- Change password

### RBAC

- SUPER_ADMIN menus/actions
- ADMIN menus/actions
- MANAGER direct route/API behavior
- SALES area/customer scope
- VIEWER read-only behavior

### Customers

- Load customers by role
- Search/filter does not leak outside scope
- Add/edit customer as admin
- Favorite customer respects scope

### Products

- Product list/search
- Exact duplicate product display guard
- Favorite/pinned products
- Product calculator uses selected product record

### Quotations

- WEBQT/GYPQT/MBQT number generation
- Old `QT-*` quote open/edit/preview
- Save/update/cancel
- Duplicate
- Print/PDF/PNG/share
- Concurrent save scenario in Apps Script

### PWA / Cache

- First load
- Refresh after deploy
- Offline static shell
- API response not cached
- iPhone Safari/PWA standalone

### Profile

- Upload image
- Save profile
- Refresh/logout-login/PWA reopen
- Invalid image fallback

## 16. Rollback Plan

This audit only adds documentation.

If not committed yet:

```powershell
Remove-Item -LiteralPath FULL_PROJECT_AUDIT.md
```

If committed and you want to revert only this report:

```bash
git checkout -- FULL_PROJECT_AUDIT.md
```

Do not rollback the whole repository for this audit document.

## 17. Final Notes

- Backend, API, Database, Business Logic, and Permission code were not changed by this audit.
- Area-based customer permission was not modified.
- Existing `RBAC_PERMISSION_AUDIT.md` remains separate and more detailed for permission/security matrix.
- This file should be treated as a living audit baseline and updated after each security/performance fix.
