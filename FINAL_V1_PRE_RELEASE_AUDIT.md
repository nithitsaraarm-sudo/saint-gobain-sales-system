# Final V1 Pre-Release Audit — Saint-Gobain Sales System

Date: 2026-07-29
Branch inspected: `audit/full-remediation`
Commit inspected before this document phase: `6a723ed`
Application version inspected: `0.5.26`
Audit type: static repository review + documentation readiness review. Runtime Apps Script, live Google Sheets, real browsers/devices, and production/PWA sessions were not available in this environment.

## 1. Readiness decision

Decision: **NOT READY** for real-user UAT or Pilot Go-Live today.

The codebase shows strong remediation progress and no new static P0 code defect was confirmed during this pass, but the release cannot be called ready because release-blocking runtime validation has not been executed against the target Apps Script deployment, UAT Google Sheet data, user credentials, real mobile browsers, and PWA install sessions.

Practical status:

- Repository/static readiness: **approximately 72%**
- Executed test catalogue pass rate: **15/74 = 20.3% total catalogue coverage**
- Executed static checks pass rate: **15/15 = 100% of executed static checks**
- Runtime/manual/browser/PWA/production smoke pass rate: **0 claimed; not executed**

Minimum path to change this to `READY WITH CONDITIONS`:

1. Execute all P0 runtime/API/RBAC tests in `TEST_CASES.md`.
2. Complete UAT entry checklist in `UAT_CHECKLIST.md`.
3. Verify backup and restore steps in `ROLLBACK_PLAN_V1.md`.
4. Attach evidence for iPhone Safari, Android Chrome, Desktop, and PWA standalone tests.

## 2. Scope and files inspected

Repository inventory was checked with `rg --files`. Release-critical files inspected by content:

Frontend and PWA:

- `index.html`
- `css/main.css`
- `js/api.js`
- `js/app.js`
- `js/auth.js`
- `js/config.js`
- `js/quotation.js`
- `js/notifications.js`
- `service-worker.js`
- `manifest.json`

Apps Script backend:

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

Documents reviewed:

- `FULL_PROJECT_AUDIT.md`
- `RBAC_PERMISSION_AUDIT.md`
- `REMEDIATION_PROGRESS.md`
- `RELEASE_READINESS.md`
- `TEST_CASES.md`
- `ACCESSIBILITY_CHECKLIST.md`
- `SECURITY.md`
- `WORK_HISTORY.md`
- `API.md`
- `DATABASE.md`
- `DEPLOYMENT.md`
- `QUOTATION_ENGINE_SPEC.md`
- `DISCOUNT_ENGINE_SPEC.md`

## 3. System baseline

| Area | Finding |
|---|---|
| Architecture | Static frontend/PWA talks to Google Apps Script API and Google Sheets data store. |
| Current app version | `0.5.26` in `appscript/Constants.gs`, `js/config.js`, `js/api.js`, `index.html` asset URLs, `manifest.json`, and `service-worker.js`. |
| Runtime config | `js/config.js` is production mode with `enableDemoLogin: false` and a public Apps Script Web App URL. |
| API timeout | `js/api.js` sets `API_TIMEOUT_MS = 30000`. |
| Service worker | Static same-origin asset cache allowlist; Apps Script and token-bearing requests are treated as sensitive and not cached. |
| Auth session | Apps Script session TTL is 6 hours; login lock is 5 failed attempts / 900 seconds. |
| Roles found | `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `SALES`, `VIEWER`. No `PC` role is implemented in the inspected role constants. |

## 4. Current permission matrix

This matrix reflects the current static implementation in `appscript/Permission.gs`, `appscript/Api.gs`, `appscript/Customer.gs`, `appscript/Quotation.gs`, and `js/app.js`.

| Feature | SUPER_ADMIN | ADMIN | MANAGER | SALES | VIEWER |
|---|---|---|---|---|---|
| Login/logout/session | Yes | Yes | Yes | Yes | Yes |
| Change own password | Yes | Yes | Yes | Yes | Yes |
| View dashboard/home | Yes | Yes | Yes | Yes | Yes |
| View customers | All areas | Scoped | Scoped | Own assigned/area scoped | Scoped/read-only |
| Search/filter customers | All areas | Scoped | Scoped | Own assigned/area scoped | Scoped/read-only |
| Add/edit customers | Yes | Yes | No | No | No |
| Customer assignment options | Yes | Yes | No | No | No |
| Favorite customers | Yes, scoped by API | Yes, scoped by API | Yes, scoped by API | Yes, scoped by API | Yes, scoped by API |
| View products | Yes | Yes | No | Yes | No |
| Manage products | Yes | Yes | No | No | No |
| View promotions | Yes | Yes | No | Yes | No |
| Manage promotions | Yes | Yes | No | No | No |
| Product favorites/pinned | Yes | Yes | No | Yes | No |
| Create quotation | Yes | Yes | No | Yes | No |
| Edit/update quotation | Yes | Yes | No | Own/scope only | No |
| Cancel quotation | Yes | Yes | No | Own/scope only | No |
| Duplicate quotation | Yes | Yes | No | Yes, after load/access check | No |
| View quotation/history | Yes | Yes | Yes | Own/scope only | Yes |
| Print/PDF/PNG/share quotation | Yes | Yes | Yes | Own/scope only | Yes |
| View reports | Yes | Yes | Yes | No | Yes |
| Manage users | Yes | Yes, lower roles/area scoped | No | No | No |
| Manage system identity/settings | Yes | No | No | No | No |
| Profile settings | Yes | Yes | Yes | Yes | Yes |

Notes:

- `SALES` customer visibility is constrained by sales area and, when present, `assignedSalesUserId`.
- `SUPER_ADMIN` is the only role that can act across all areas without area restriction.
- `ADMIN` user-management ability is lower-role/area constrained in `User.gs`; the frontend also hides unauthorized pages.
- UI hiding is not treated as the only protection. Critical API actions are backed by server-side role checks.

## 5. API security audit summary

| API group/action | Auth | Role/scope validation observed | Risk |
|---|---|---|---|
| `login` | Public | Password + lockout in `Auth.gs` | Low |
| `demoLogin` | Public action but disabled by `canUseDemoLogin()` | Production config disables demo login | Low |
| `register` / `resetPassword` | Public dispatcher entries | Self-registration disabled; forgot password not available | Low |
| `bootstrap` | Auth path tolerated for expired session response | Calls `getBootstrapData`; must be runtime tested | Medium |
| `customers`, `customer`, `searchCustomers` | Required | Role check + backend customer area/assignment scope | Low/Medium pending runtime tests |
| `getCustomerFormOptions` | Required | Reduced by permission; assignment options admin-only | Low/Medium pending runtime tests |
| `products`, `product` | Required | Product view permission | Low |
| `promotions`, `savePromotion` | Required | View/manage promotion permission + duplicate guard | Low |
| `discount` | Required | `validateDiscountCustomerScope_()` before `getDiscount()` | Low/Medium pending runtime tests |
| `saveCustomer`, `updateCustomer` | Required | `canManageCustomers`; customer area/brand/sales validation | Low/Medium pending runtime tests |
| `getFavoriteCustomers` and mutations | Required | User-scoped and customer-scope filtered | Low/Medium pending runtime tests |
| `getProductPreferences` and mutations | Required | Preference mutations require quote creation permission | Low |
| `createQuotation`, `saveQuotation`, `updateQuotation` | Required | Quote permission + customer access validation + ScriptLock + idempotency | Medium until concurrency runtime test |
| `loadQuotation`, `getQuotationHistory` | Required | `canAccessQuotationRecord()` and scoped history filtering | Low/Medium pending runtime tests |
| `duplicateQuotation`, `cancelQuotation` | Required | Permission and record access checks | Medium until runtime tests |
| `updateProfile`, `uploadProfileImage` | Required | Current session user only; canonical `profileImageUrl` | Low/Medium pending image runtime tests |
| `loadUsers`, `createUser`, `updateUser` | Required | SUPER_ADMIN/ADMIN; role hierarchy and area validation | Low/Medium pending runtime tests |
| `get/updateSystemIdentitySettings` | Required | SUPER_ADMIN only | Low |

## 6. Regression audit summary

| Module | Static status | Runtime/manual status | Release concern |
|---|---|---|---|
| Authentication/session | Static reviewed | Not executed | Must verify login, logout, expiry, disabled user, password change. |
| RBAC/routes/sidebar | Static reviewed | Not executed | Must verify direct navigation and hidden menus per role. |
| Customers/area scope | Static reviewed | Not executed | Must verify SALES cannot see cross-area/customers assigned to other sales. |
| Products/promotions | Static reviewed | Not executed | Product duplicate guard exists; must verify with real sheet data. |
| Discounts | Static reviewed | Not executed | Must verify out-of-scope customer discount is rejected. |
| Quotation workflow | Static reviewed | Not executed | Must verify save/update/cancel/duplicate/print/PDF/PNG/share and old quote compatibility. |
| Quotation concurrency | Static reviewed | Not executed | Must verify no duplicate quotation number under concurrent saves. |
| Profile image | Static reviewed | Not executed | Must verify Drive thumbnail display, save, refresh, logout/login, PWA reopen. |
| PWA/cache | Static reviewed | Not executed | Must verify install, refresh, stale cache isolation, new version update. |
| Accessibility/responsive | Existing checklist reviewed | Not executed | Must verify iPhone Safari, Android Chrome, Desktop, keyboard/focus. |

## 7. Test execution status

Based on the existing `TEST_CASES.md` catalogue:

| Suite | Total | Static Check Passed | Runtime Passed | Blocked/Not Run | Failed |
|---|---:|---:|---:|---:|---:|
| Automated/static checks | 15 | 15 | 0 | 0 | 0 |
| Runtime integration tests | 31 | 0 | 0 | 31 | 0 |
| Manual browser/PWA tests | 17 | 0 | 0 | 17 | 0 |
| Production post-deployment smoke tests | 11 | 0 | 0 | 11 | 0 |
| Total | 74 | 15 | 0 | 59 | 0 |

No runtime/manual test is marked passed by this audit.

## 8. Open issue counts

| Severity | Count | Meaning |
|---|---:|---|
| P0 | 1 | Release gate blocker: P0 runtime/security/UAT tests not executed against the target deployment and data. |
| P1 | 4 | High-priority readiness gaps for backup/restore, concurrency evidence, CSP hardening, and automated browser/runtime test coverage. |
| P2 | 3 | Medium operational/documentation gaps. |
| P3 | 1 | Low housekeeping item. |

See `KNOWN_ISSUES.md` for details.

## 9. Production readiness summary

| Area | Status | Notes |
|---|---|---|
| Deployment/version alignment | Static OK | Version `0.5.26` is aligned across inspected runtime files. |
| Environment config | Conditional | Production flags are set; release owner must confirm Apps Script URL and deployment target. |
| Database/schema | Conditional | No migration required by this audit; UAT backup/restore must be verified. |
| Security/RBAC | Conditional | Static checks are promising; runtime role and data-isolation proof is still required. |
| Performance | Conditional | Instrumentation exists in several backend paths; live timing targets are not measured. |
| PWA/cache | Conditional | Static cache policy is safer; install/reopen/cache refresh tests are blocked. |
| Accessibility/mobile | Conditional | Checklist exists; real device/browser evidence is blocked. |
| Support/rollback | Conditional | Rollback plan documented; restore drill not executed. |
| Pilot readiness | Not ready | Pilot requires completed UAT and support runbook sign-off. |

## 10. Recommended implementation/order before UAT

1. Prepare UAT environment, spreadsheet backup, and role-specific test accounts.
2. Execute all P0 tests in `TEST_CASES.md`, especially RBAC/customer-area/quotation save/load/export/concurrency.
3. Execute `UAT_CHECKLIST.md` with business users and capture evidence.
4. Fix any P0/P1 failures discovered during runtime testing.
5. Re-run regression smoke and update `RELEASE_READINESS.md`.
6. Only after successful UAT, start pilot using `PILOT_GO_LIVE_PLAN.md`.

## 11. Rollback

Use `ROLLBACK_PLAN_V1.md`. For this documentation-only phase, rollback is:

```bash
git revert <documentation-commit-hash>
```

Do not use `git reset --hard` and do not roll back unrelated feature work.
