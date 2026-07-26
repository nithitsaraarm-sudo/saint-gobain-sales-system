# RBAC & Security Audit — Saint-Gobain Sales System

วันที่ตรวจ: 2026-07-26  
สถานะ: Audit-only / ไม่มีการแก้ไขโค้ดระบบจาก audit นี้

## 1. Executive Summary

จากการตรวจระบบ Role-Based Access Control (RBAC), route guard, sidebar/menu visibility, frontend API client และ Google Apps Script backend พบว่าระบบมีการป้องกันพื้นฐานแล้ว โดยเฉพาะ:

- ทุก API action ที่ไม่ใช่ public ต้องผ่าน `requireApiUser`
- การจัดการ Users จำกัดที่ `SUPER_ADMIN` และ `ADMIN`
- การจัดการ Products / Customers / Promotions จำกัดที่ `SUPER_ADMIN` และ `ADMIN`
- Customer API มี area-scope และ assigned-sales validation ใน backend
- Quotation save ตรวจ customer scope ก่อนบันทึก

แต่ยังพบช่องว่างสำคัญที่ควรแก้ก่อน production hardening:

1. `loadQuotation()` มี cache bypass ก่อนตรวจ permission
2. `discount` API ให้ authenticated user ใด ๆ query discount ของ customer/group ใดก็ได้
3. JSONP GET ส่ง `sessionToken` ใน URL และ Service Worker cache GET ทุก request
4. Quotation permission ของ `MANAGER` / `VIEWER` ไม่สอดคล้องกันระหว่าง bootstrap, history และ load
5. บาง UI ซ่อนปุ่มด้วย frontend เท่านั้น แต่ backend ยังต้องตรวจซ้ำให้ครบทุก action

## 2. Files Inspected

Frontend:

- `index.html`
- `js/api.js`
- `js/auth.js`
- `js/app.js`
- `js/quotation.js`
- `js/config.js`
- `service-worker.js`

Backend / Apps Script:

- `appscript/Api.gs`
- `appscript/Auth.gs`
- `appscript/Code.gs`
- `appscript/Constants.gs`
- `appscript/Customer.gs`
- `appscript/Database.gs`
- `appscript/Discount.gs`
- `appscript/FavoriteCustomer.gs`
- `appscript/FavoriteProduct.gs`
- `appscript/Permission.gs`
- `appscript/Product.gs`
- `appscript/Quotation.gs`
- `appscript/User.gs`
- `appscript/Validator.gs`
- `appscript/Response.gs`

Not found:

- `appscript/Promotion.gs`

## 3. Roles

Roles found in system:

- `SUPER_ADMIN`
- `ADMIN`
- `MANAGER`
- `SALES`
- `VIEWER`

Permission source:

- `appscript/Permission.gs`
- `js/app.js`
- `appscript/Api.gs`
- per-feature backend helpers such as `canAccessQuotationRecord()` and customer scope helpers

## 4. Current Permission Matrix

Legend:

- ✓ = allowed
- ✗ = blocked / hidden / denied
- Scoped = allowed only within ownership, sales area, or assigned scope
- Drift = frontend/backend behavior does not fully match

| Feature | SUPER_ADMIN | ADMIN | MANAGER | SALES | VIEWER |
|---|---:|---:|---:|---:|---:|
| Login | ✓ | ✓ | ✓ | ✓ | ✓ |
| Logout | ✓ | ✓ | ✓ | ✓ | ✓ |
| Session validation | ✓ | ✓ | ✓ | ✓ | ✓ |
| Change password | ✓ | ✓ | ✓ | ✓ | ✓ |
| Forgot password | ✗ | ✗ | ✗ | ✗ | ✗ |
| View Dashboard/Home | ✓ | ✓ | ✓ | ✓ | ✓ |
| View Customers | ✓ | ✓ | Scoped | Scoped | Scoped |
| Search Customers | ✓ | ✓ | Scoped | Scoped | Scoped |
| Filter Customers | ✓ | ✓ | Scoped | Scoped | Scoped |
| View Customer Detail | ✓ | ✓ | Scoped | Scoped | Scoped |
| Add Customer | ✓ | ✓ | ✗ | ✗ | ✗ |
| Edit Customer | ✓ | ✓ | ✗ | ✗ | ✗ |
| Delete/Deactivate Customer | Not exposed | Not exposed | Not exposed | Not exposed | Not exposed |
| Favorite Customer | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pinned Customer | Not clearly exposed | Not clearly exposed | Not clearly exposed | Not clearly exposed | Not clearly exposed |
| Customer Assignment | ✓ | ✓ | ✗ | ✗ | ✗ |
| Customer Import | Not found | Not found | Not found | Not found | Not found |
| Customer Export | Not found | Not found | Not found | Not found | Not found |
| View Products | ✓ | ✓ | Drift | ✓ | ✗ |
| Search Products | ✓ | ✓ | Drift | ✓ | ✗ |
| Product Detail | ✓ | ✓ | Drift | ✓ | ✗ |
| Product Price | ✓ | ✓ | Drift | ✓ | ✗ |
| Product Promotion | ✓ | ✓ | Drift | ✓ | ✗ |
| Favorite/Pinned Products | ✓ | ✓ | Drift | ✓ | ✗ |
| Edit Product | ✓ | ✓ | ✗ | ✗ | ✗ |
| Delete Product | Not found | Not found | Not found | Not found | Not found |
| Import Products | Not found | Not found | Not found | Not found | Not found |
| View Promotions | ✓ | ✓ | Hidden/Drift | ✓ | ✗ |
| Search Promotions | ✓ | ✓ | Hidden/Drift | ✓ | ✗ |
| Promotion Detail | ✓ | ✓ | Hidden/Drift | ✓ | ✗ |
| Create/Edit Promotion | ✓ | ✓ | ✗ | ✗ | ✗ |
| Delete Promotion | Not found | Not found | Not found | Not found | Not found |
| Create Quotation | ✓ | ✓ | Backend ✓ / UI ✗ | ✓ | ✗ |
| New Quotation | ✓ | ✓ | Backend ✓ / UI ✗ | ✓ | ✗ |
| Select Customer | ✓ | ✓ | Backend ✓ / UI ✗ | Scoped | ✗ |
| Select BU | ✓ | ✓ | Backend ✓ / UI ✗ | ✓ | ✗ |
| Add Product to Quote | ✓ | ✓ | Backend ✓ / UI ✗ | ✓ | ✗ |
| Edit Quantity | ✓ | ✓ | Backend ✓ / UI ✗ | ✓ | ✗ |
| Edit Unit | ✓ | ✓ | Backend ✓ / UI ✗ | ✓ | ✗ |
| Edit Discount | ✓ | ✓ | Backend ✓ / UI ✗ | ✓ | ✗ |
| Free Item | ✓ | ✓ | Backend ✓ / UI ✗ | ✓ | ✗ |
| Save Quotation | ✓ | ✓ | Backend ✓ / UI ✗ | ✓ | ✗ |
| Update Quotation | ✓ | ✓ | ✗ | Scoped/Own | ✗ |
| View Quotation | ✓ | ✓ | Drift | Scoped/Own | ✓ |
| View History | ✓ | ✓ | Drift | Scoped/Own | ✓ |
| Search History | ✓ | ✓ | Drift | Scoped/Own | ✓ |
| Print Quotation | ✓ | ✓ | Drift | Potential UI access | Potential UI access |
| Export PDF/PNG | ✓ | ✓ | Drift | Potential UI access | Potential UI access |
| Share Quotation | ✓ | ✓ | Drift | Potential UI access | Potential UI access |
| Duplicate Quotation | ✓ | ✓ | Backend ✓ but likely bug | ✓ but likely bug | ✗ |
| Cancel Quotation | ✓ | ✓ | ✗ | Scoped/Own | ✗ |
| View Reports | ✓ | ✓ | ✓ | ✗ | ✓ |
| Export Reports | Not confirmed | Not confirmed | Not confirmed | Not confirmed | Not confirmed |
| View Users | ✓ | ✓ | ✗ | ✗ | ✗ |
| Add User | ✓ | ✓ | ✗ | ✗ | ✗ |
| Edit User | ✓ | ✓ | ✗ | ✗ | ✗ |
| Delete User | Not found | Not found | Not found | Not found | Not found |
| Reset Password | ✓ | ✓ | ✗ | ✗ | ✗ |
| Assign Role | ✓ | ✓, lower role only | ✗ | ✗ | ✗ |
| Change User Status | ✓ | ✓, lower role only | ✗ | ✗ | ✗ |
| Change User Area | ✓ | ✓, area-scoped | ✗ | ✗ | ✗ |
| Settings Page | ✓ | ✓ | ✓ | ✓ | ✓ |
| Profile | ✓ | ✓ | ✓ | ✓ | ✓ |
| Company/System Settings | ✓ | ✗ | ✗ | ✗ | ✗ |
| Announcement Management | ✓ | Not confirmed | ✗ | ✗ | ✗ |
| Theme/Version | ✓ | ✓ | ✓ | ✓ | ✓ |

## 5. Route Audit

Frontend route guard found in `js/app.js` via `canAccessPage(page)`.

| Route/Page | Current Frontend Protection | Notes |
|---|---|---|
| `home` | All roles | Dashboard/home visible to all |
| `quote` | SUPER_ADMIN, ADMIN, SALES | Backend also allows MANAGER create/save quote, causing drift |
| `customers` | All roles | Backend applies customer scope |
| `products` | SUPER_ADMIN, ADMIN, SALES | Backend allows MANAGER but UI hides route |
| `promos` | SUPER_ADMIN, ADMIN, SALES | Backend product/promo behavior should be clarified |
| `quotes` | SUPER_ADMIN, ADMIN, MANAGER, SALES, VIEWER | Backend history/load behavior inconsistent for MANAGER/VIEWER |
| `users` | SUPER_ADMIN, ADMIN | Backend also restricts |
| `report` | SUPER_ADMIN, ADMIN, MANAGER, VIEWER | SALES hidden |
| `settings` | All roles | Some admin-looking tiles visible; backend blocks writes |

## 6. API Audit

Central API dispatcher: `appscript/Api.gs`.

Public actions:

- `login`
- `demoLogin`
- `register`
- `getPublicSystemSettings`

All other actions require session authentication through `requireApiUser(payload)`.

| API Action / Area | Current Validation | Risk |
|---|---|---|
| `customers` / `customer` / `searchCustomers` | Auth + backend customer scope | Low |
| `saveCustomer` / `updateCustomer` | Auth + `canManageCustomers` + customer validation | Low |
| `customerFormOptions` / `getCustomerFormOptions` | Auth only | Medium: exposes users/areas to VIEWER |
| `products` / `product` / product search | Role gate excludes VIEWER | Medium: MANAGER allowed backend but hidden frontend |
| Product favorite/pinned mutation | `canCreateQuotations` | Medium: MANAGER allowed backend but hidden frontend |
| `discount` | Auth only | High: missing customer/area/ownership validation |
| `quotation` / `saveQuotation` | `canCreateQuotations`, save validates customer scope | Medium: MANAGER drift |
| `loadQuotation` | Auth + internal quote access, but cache checked before permission | Critical |
| `getQuotationHistory` | Auth + `canAccessQuotationRecord` filter | High/Medium: MANAGER denied here but bootstrap allows |
| `duplicateQuotation` | `canCreateQuotations`, but internal payload loses session/currentUser | Medium: likely functional failure |
| `cancelQuotation` / `updateQuotation` | `canEditQuotations` + ownership helper | Medium |
| `loadUsers` / `createUser` / `updateUser` | SUPER_ADMIN/ADMIN + role hierarchy + area scope | Low |
| `updateSettings` | SUPER_ADMIN | Low |
| `savePromotion` | API role gate SUPER_ADMIN/ADMIN, backend stub in `Code.gs` | Medium functional/data integrity risk |

## 7. Sidebar/Menu Audit

Sidebar menu source observed in `index.html`; visibility controlled by `js/app.js`.

| Menu | Visible Roles | Notes |
|---|---|---|
| Home | All roles | OK |
| ออกใบเสนอราคา / Quote | SUPER_ADMIN, ADMIN, SALES | Backend allows MANAGER too |
| Customers | All roles | Backend customer scope important and present |
| Products | SUPER_ADMIN, ADMIN, SALES | Backend allows MANAGER too |
| Promotions | SUPER_ADMIN, ADMIN, SALES | Verify intended MANAGER access |
| Quote History | SUPER_ADMIN, ADMIN, MANAGER, SALES, VIEWER | Backend inconsistent for MANAGER/VIEWER |
| Users | SUPER_ADMIN, ADMIN | OK |
| Reports | SUPER_ADMIN, ADMIN, MANAGER, VIEWER | OK if intended |
| Settings | All roles | Data management tile needs UI hardening |

## 8. Security Findings

### Critical

#### 8.1 `loadQuotation()` cache bypasses permission

Location: `appscript/Quotation.gs`

Issue:

- `loadQuotation()` reads `getServerCache(cacheKey)` and returns cached quotation before `canAccessQuotationRecord()` is called.

Risk:

- If one authorized user loads a quotation, another authenticated user may request the same quote id/quote no and receive cached data without proper ownership/role check.

Recommended fix:

- Always load/check quote permission before returning cached data, or include a user/role/scope-safe cache key.

### High

#### 8.2 `discount` API lacks customer scope validation

Location: `appscript/Api.gs`, `appscript/Discount.gs`

Issue:

- Any authenticated user can call `discount` with arbitrary `customerId` and `groupCode`.

Risk:

- Sales users may infer discounts for customers outside their assigned area/scope.

Recommended fix:

- Validate `getCustomer(customerId, { currentUser })` before returning discount.
- Consider role/quotation context validation.

#### 8.3 Session token appears in JSONP GET URL and may be cached

Locations:

- `js/api.js`
- `service-worker.js`
- `appscript/Code.gs`

Issue:

- Read actions are sent as JSONP GET with `sessionToken` in query string.
- Service Worker caches all GET responses by default.

Risk:

- Session token and API responses may live in browser/PWA cache.

Recommended fix:

- Exclude API/JSONP URLs and token-bearing URLs from Service Worker cache.
- Prefer POST for authenticated requests where feasible.

#### 8.4 Quotation access differs between bootstrap/history/load

Locations:

- `appscript/Code.gs`
- `appscript/Quotation.gs`
- `js/app.js`

Issue:

- `filterQuotesForUser()` allows MANAGER/VIEWER broad quote visibility.
- `canAccessQuotationRecord()` allows VIEWER all but does not allow MANAGER.
- Frontend allows MANAGER and VIEWER to quote history page.

Risk:

- Users see different data depending on endpoint/path.
- Potential overexposure or broken access.

Recommended fix:

- Define one canonical quotation visibility policy and reuse it everywhere.

### Medium

#### 8.5 VIEWER may see print/export/share actions in quotation detail modal

Location: `js/app.js`

Issue:

- History list hides some buttons for VIEWER, but quote detail modal HTML can still include Print/PNG/Share/Edit/Cancel controls.

Risk:

- UI allows actions that may not be intended for VIEWER.

Recommended fix:

- Apply role-based filtering inside quote detail modal rendering and backend endpoints.

#### 8.6 MANAGER frontend/backend permission drift

Locations:

- `appscript/Permission.gs`
- `appscript/Api.gs`
- `js/app.js`

Issue:

- Backend allows MANAGER to create quotations and use products.
- Frontend hides Quote and Products pages from MANAGER.

Risk:

- Confusing behavior and possible direct API access inconsistent with UI.

Recommended fix:

- Decide whether MANAGER should create quotes/view products, then align frontend/backend.

#### 8.7 Settings page shows admin-looking data management UI to all roles

Location: `index.html`, `js/app.js`

Issue:

- Settings page visible to all.
- Some management buttons may be shown even when backend denies save.

Risk:

- Poor UX and misleading affordance.

Recommended fix:

- Hide/disable admin-only settings UI based on permissions.

#### 8.8 `getCustomerFormOptions` exposes assignable sales/area data

Location: `appscript/Customer.gs`, `appscript/Api.gs`

Issue:

- Endpoint allowed for all authenticated roles.

Risk:

- VIEWER or lower privilege roles can inspect sales users/areas.

Recommended fix:

- Restrict full form options to roles that can manage customers, or return reduced options for non-admin roles.

#### 8.9 Local discount cache is not user-scoped

Location: `js/api.js`

Issue:

- Discount cache key is shared by customer/group and not clearly scoped by current user.

Risk:

- Shared browser/PWA device could leak stale discount info across sessions.

Recommended fix:

- Scope discount cache by user/session or clear it on login/logout.

### Low / Hardening

#### 8.10 Password hashing uses salted SHA-256

Location: `appscript/Auth.gs`

Issue:

- Salted SHA-256 is better than plain hash, but not a slow password hashing algorithm.

Risk:

- If sheet data leaks, offline password cracking is easier than with bcrypt/Argon2/PBKDF2.

Recommended fix:

- Consider Apps Script-compatible iterative hashing/PBKDF2-style approach if feasible.

#### 8.11 Permission logic is distributed

Locations:

- `Permission.gs`
- `Api.gs`
- `Code.gs`
- `Quotation.gs`
- `Customer.gs`
- `js/app.js`

Issue:

- Permission rules are duplicated across frontend/backend helpers.

Risk:

- Drift over time.

Recommended fix:

- Centralize permission registry and export a sanitized frontend permission object.

## 9. Missing / Weak Permission Checks

Items that should be fixed or clarified:

1. `loadQuotation()` must check permission before returning cached data.
2. `discount` API must validate customer access.
3. Service Worker should not cache authenticated API GET/JSONP responses.
4. Quote visibility policy for MANAGER and VIEWER must be unified.
5. Quote print/export/share should have explicit backend and frontend authorization.
6. `getCustomerFormOptions` should not expose full sales user metadata to non-admin roles.
7. Frontend hidden buttons should not be treated as security; backend should be canonical.
8. Settings data-management buttons should be hidden from users without matching permission.
9. Discount/customer/product local caches should be reviewed for user scoping.

## 10. Recommended Fix Order

1. Fix `loadQuotation()` cache authorization bypass.
2. Add scope validation to `discount` API.
3. Exclude authenticated API/JSONP requests from Service Worker cache.
4. Define canonical quotation visibility policy for all roles.
5. Align MANAGER permissions across frontend and backend.
6. Harden quote detail modal buttons and export/share endpoints.
7. Restrict or reduce `getCustomerFormOptions` for non-admin roles.
8. Hide admin-only settings controls in frontend.
9. Review localStorage/sessionStorage cache clearing on login/logout.
10. Create a central RBAC test checklist for future changes.

## 11. Future Implementation Impact

| Fix | Estimated Impact | Notes |
|---|---|---|
| `loadQuotation()` cache permission fix | Medium | Must preserve performance while ensuring permission check happens first |
| `discount` scope validation | Medium | May require frontend to pass customer context consistently |
| Service Worker cache exclusion | Low/Medium | Must avoid breaking PWA static asset caching |
| Quotation policy unification | Medium/High | Requires business decision for MANAGER/VIEWER |
| UI button hiding for quote detail/settings | Low | Frontend-only UX hardening, backend still required |
| Local cache user scoping | Medium | Must avoid stale data and preserve offline/PWA behavior |

## 12. Rollback Considerations For Future Fixes

If this file has not been committed yet, remove it with:

```powershell
Remove-Item -LiteralPath RBAC_PERMISSION_AUDIT.md
```

If this file has already been committed and you only want to restore it from Git:

```bash
git checkout -- RBAC_PERMISSION_AUDIT.md
```

For future implementation work, rollback should be file-specific only. Do not rollback the whole repository.

Recommended future rollback examples:

```bash
git checkout -- appscript/Quotation.gs
git checkout -- appscript/Api.gs appscript/Discount.gs
git checkout -- service-worker.js js/api.js
git checkout -- js/app.js index.html
```

## 13. Notes

- No database migration was performed.
- No backend/API/database code was modified by this audit file.
- Customer area-based permission logic was not changed.
- Existing dirty working tree files before this audit file were observed separately and are not part of this audit document.
