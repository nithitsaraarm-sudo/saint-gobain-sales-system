# UAT Checklist — Saint-Gobain Sales System V1

Date prepared: 2026-07-29
Purpose: business-readable checklist for controlled UAT before any Pilot Go-Live.

## 1. UAT status

Current status: **Not started / blocked until environment is ready**.

Do not invite real users until the entry criteria below are complete.

## 2. Entry criteria

| Item | Owner | Status | Evidence |
|---|---|---|---|
| UAT Apps Script deployment URL confirmed | Release owner | Not Run | Deployment URL / version |
| UAT Google Sheet copied from safe baseline | Data owner | Not Run | Sheet URL and backup timestamp |
| Backup and restore procedure verified | Release owner | Not Run | Restore drill evidence |
| Test accounts created for all roles | Admin | Not Run | User list with passwords stored securely |
| Test data prepared for customers, products, discounts, quotes, promotions | Data owner | Not Run | Data preparation checklist |
| PWA/cache version confirmed as `0.5.26` | Release owner | Static checked only | `service-worker.js`, `manifest.json`, `js/config.js` |
| Known issues reviewed and accepted | Product owner | Not Run | Sign-off |

## 3. Required UAT roles

- `SUPER_ADMIN`
- `ADMIN`
- `MANAGER`
- `SALES` in Area A
- `SALES` in Area B
- `VIEWER`

No `PC` role was found in the current implementation.

## 4. UAT scenarios

| ID | Scenario | Roles | Expected result | Status |
|---|---|---|---|---|
| UAT-AUTH-01 | Login and logout | All roles | User can log in, see correct profile, and log out cleanly. | Not Run |
| UAT-AUTH-02 | Change password | All roles | Current password required; new session uses new password. | Not Run |
| UAT-RBAC-01 | Sidebar/menu visibility | All roles | Menus match the permission matrix. | Not Run |
| UAT-RBAC-02 | Direct route access | All roles | Restricted pages are blocked, not just hidden. | Not Run |
| UAT-CUST-01 | Customer list by role | All roles | SALES sees only assigned/area customers; SUPER_ADMIN sees all. | Not Run |
| UAT-CUST-02 | Add/edit customer | SUPER_ADMIN, ADMIN | Required sales area, assigned sales, and brand fields validate correctly. | Not Run |
| UAT-CUST-03 | Favorite customers | All roles | Favorites never reveal out-of-scope customers. | Not Run |
| UAT-PROD-01 | Product list/search | SUPER_ADMIN, ADMIN, SALES | Product duplicate guard shows exact duplicates once while preserving distinct price/unit/brand records. | Not Run |
| UAT-PROMO-01 | Promotion list/search | SUPER_ADMIN, ADMIN, SALES | Active promotions display; inactive/duplicates behave as expected. | Not Run |
| UAT-DISC-01 | Discount lookup | Quote creators | Out-of-scope customer discount requests are rejected. | Not Run |
| UAT-QUOTE-01 | Create Weber quotation | SUPER_ADMIN, ADMIN, SALES | Quote saves with `WEBQT-YYYYMM-RUNNING4`. | Not Run |
| UAT-QUOTE-02 | Create Gyproc quotation | SUPER_ADMIN, ADMIN, SALES | Quote saves with `GYPQT-YYYYMM-RUNNING4`. | Not Run |
| UAT-QUOTE-03 | Create mixed brand quotation | SUPER_ADMIN, ADMIN, SALES | Quote saves with `MBQT-YYYYMM-RUNNING4`. | Not Run |
| UAT-QUOTE-04 | Edit/update quote | SUPER_ADMIN, ADMIN, SALES | Existing quote updates without duplicate lines or wrong totals. | Not Run |
| UAT-QUOTE-05 | Duplicate/cancel quote | SUPER_ADMIN, ADMIN, SALES | Permission checks apply; original quote stays unchanged. | Not Run |
| UAT-QUOTE-06 | Print/PDF/PNG/share | View-quote roles | Export works and shows correct quote number/totals. | Not Run |
| UAT-QUOTE-07 | Legacy quote compatibility | View-quote roles | Old `QT-...` quote opens, edits, previews, prints, and exports. | Not Run |
| UAT-USER-01 | User management | SUPER_ADMIN, ADMIN | Role hierarchy, area scope, status, and password reset behave correctly. | Not Run |
| UAT-PROFILE-01 | Profile image upload/display | All roles | Image appears immediately and persists after refresh/logout/PWA reopen. | Not Run |
| UAT-PWA-01 | PWA install/reopen/cache | All roles | No stale data leak; app updates to current version. | Not Run |
| UAT-A11Y-01 | Keyboard/mobile accessibility | All roles | Use `ACCESSIBILITY_CHECKLIST.md` as the detailed checklist. | Not Run |

## 5. Exit criteria

UAT can close only when:

- 100% of P0 tests in `TEST_CASES.md` are passed with evidence.
- No open Sev1/Sev2 defect remains.
- Business owner signs off all core flows: customers, products, quotations, quote history, profile, PWA/mobile.
- Release owner confirms rollback and support procedures.

## 6. Evidence to collect

- Screenshot or screen recording per critical flow.
- Role/account used.
- Browser/device/OS.
- Apps Script deployment version and Google Sheet dataset.
- Redacted API response/log excerpt for security/API tests.
- Defect ID for any mismatch.
