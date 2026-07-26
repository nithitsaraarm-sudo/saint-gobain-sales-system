# RBAC & Security Audit — Saint-Gobain Sales System

วันที่ตรวจ: 2026-07-26  
สถานะ: Audit-only / ไม่มีการแก้ไขโค้ดระบบจาก audit นี้

## Remediation Status Addendum — 2026-07-26

This file remains the original RBAC/security audit baseline. The findings are preserved for evidence, while remediation status is tracked here and in `REMEDIATION_PROGRESS.md`.

Resolved after this audit:

- Critical quotation cache permission bypass: fixed in Phase 1.
- Discount endpoint customer/area-scope validation: fixed in Phase 1.
- Authenticated token-bearing JSONP GET flow and broad service-worker GET caching: fixed in Phase 1.
- MANAGER/VIEWER quotation permission drift: fixed in Phase 2 with MANAGER as oversight/read-only for quotation history/detail and reports.
- Customer form assignment metadata exposure to lower roles: fixed in Phase 2.
- Promotion save stub and production demo-login visibility: fixed in Phase 3.
- Frontend private cache/session leakage risk: fixed in Phase 7.
- Quote detail modal/export action visibility remains governed by the canonical permission flags introduced in Phase 2.

Remaining hardening themes after Phase 9:

- Strict CSP is still future work because inline handlers remain in legacy UI architecture.
- Automated browser/accessibility tests are still not configured; use `ACCESSIBILITY_CHECKLIST.md` for manual smoke testing.
- Large frontend files remain maintainability hotspots and should be split carefully in future phases.

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
| View Products | ✓ | ✓ | ✗ | ✓ | ✗ |
| Search Products | ✓ | ✓ | ✗ | ✓ | ✗ |
| Product Detail | ✓ | ✓ | ✗ | ✓ | ✗ |
| Product Price | ✓ | ✓ | ✗ | ✓ | ✗ |
| Product Promotion | ✓ | ✓ | ✗ | ✓ | ✗ |
| Favorite/Pinned Products | ✓ | ✓ | ✗ | ✓ | ✗ |
| Edit Product | ✓ | ✓ | ✗ | ✗ | ✗ |
| Delete Product | Not found | Not found | Not found | Not found | Not found |
| Import Products | Not found | Not found | Not found | Not found | Not found |
| View Promotions | ✓ | ✓ | ✗ | ✓ | ✗ |
| Search Promotions | ✓ | ✓ | ✗ | ✓ | ✗ |
| Promotion Detail | ✓ | ✓ | ✗ | ✓ | ✗ |
| Create/Edit Promotion | ✓ | ✓ | ✗ | ✗ | ✗ |
| Delete Promotion | Not found | Not found | Not found | Not found | Not found |
| Create Quotation | ✓ | ✓ | ✗ | ✓ | ✗ |
| New Quotation | ✓ | ✓ | ✗ | ✓ | ✗ |
| Select Customer | ✓ | ✓ | ✗ | Scoped | ✗ |
| Select BU | ✓ | ✓ | ✗ | ✓ | ✗ |
| Add Product to Quote | ✓ | ✓ | ✗ | ✓ | ✗ |
| Edit Quantity | ✓ | ✓ | ✗ | ✓ | ✗ |
| Edit Unit | ✓ | ✓ | ✗ | ✓ | ✗ |
| Edit Discount | ✓ | ✓ | ✗ | ✓ | ✗ |
| Free Item | ✓ | ✓ | ✗ | ✓ | ✗ |
| Save Quotation | ✓ | ✓ | ✗ | ✓ | ✗ |
| Update Quotation | ✓ | ✓ | ✗ | Scoped/Own | ✗ |
| View Quotation | ✓ | ✓ | ✓ | Scoped/Own | ✓ |
| View History | ✓ | ✓ | ✓ | Scoped/Own | ✓ |
| Search History | ✓ | ✓ | ✓ | Scoped/Own | ✓ |
| Print Quotation | ✓ | ✓ | ✓ | Scoped/Own | ✓ |
| Export PDF/PNG | ✓ | ✓ | ✓ | Scoped/Own | ✓ |
| Share Quotation | ✓ | ✓ | ✓ | Scoped/Own | ✓ |
| Duplicate Quotation | ✓ | ✓ | ✗ | Scoped/Own | ✗ |
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
| `quote` | SUPER_ADMIN, ADMIN, SALES | Aligned with backend `canCreateQuotations` |
| `customers` | All roles | Backend applies customer scope |
| `products` | SUPER_ADMIN, ADMIN, SALES | Aligned with backend `canViewProducts` |
| `promos` | SUPER_ADMIN, ADMIN, SALES | Aligned with backend `canViewPromotions` |
| `quotes` | SUPER_ADMIN, ADMIN, MANAGER, SALES, VIEWER | Aligned with backend `canViewQuotations` |
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
| `products` / `product` / product search | Canonical role gate excludes MANAGER and VIEWER | Low |
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
| ออกใบเสนอราคา / Quote | SUPER_ADMIN, ADMIN, SALES | Aligned with backend |
| Customers | All roles | Backend customer scope important and present |
| Products | SUPER_ADMIN, ADMIN, SALES | Aligned with backend |
| Promotions | SUPER_ADMIN, ADMIN, SALES | Verify intended MANAGER access |
| Quote History | SUPER_ADMIN, ADMIN, MANAGER, SALES, VIEWER | Aligned with backend |
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

Status: Mitigated in Phase 2. Edit/cancel controls are now hidden for read-only roles. Print/export/share remain visible by policy because they are read/presentation actions for users who can view quotations.

Location: `js/app.js`

Issue:

- History list hides some buttons for VIEWER, but quote detail modal HTML can still include Print/PNG/Share/Edit/Cancel controls.

Risk:

- UI allows actions that may not be intended for VIEWER.

Recommended fix:

- Apply role-based filtering inside quote detail modal rendering and backend endpoints.

#### 8.6 MANAGER frontend/backend permission drift

Status: Fixed in Phase 2. `MANAGER` is now an oversight/read role and cannot create quotations or access product/promotion working pages.

Locations:

- `appscript/Permission.gs`
- `appscript/Api.gs`
- `js/app.js`

Original issue:

- Before Phase 2, backend allowed MANAGER to create quotations and use products.
- Frontend hides Quote and Products pages from MANAGER.

Risk:

- Confusing behavior and possible direct API access inconsistent with UI.

Recommended fix:

- Decide whether MANAGER should create quotes/view products, then align frontend/backend.

#### 8.7 Settings page shows admin-looking data management UI to all roles

Status: Fixed in Phase 2 for Settings > Data Entry visibility and direct modal/save guards. System identity controls were already SUPER_ADMIN-only.

Location: `index.html`, `js/app.js`

Issue:

- Settings page visible to all.
- Some management buttons may be shown even when backend denies save.

Risk:

- Poor UX and misleading affordance.

Recommended fix:

- Hide/disable admin-only settings UI based on permissions.

#### 8.8 `getCustomerFormOptions` exposes assignable sales/area data

Status: Fixed in Phase 2. Lower roles receive reduced options without `salesUsers` / `assignableSalesUsers`; full assignment options require `SUPER_ADMIN` or `ADMIN`.

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

## 14. Phase 2 Implemented Canonical RBAC Policy

Status: Implemented on branch `audit/full-remediation` during Phase 2.

Canonical policy decision:

- Backend permission helpers in `appscript/Permission.gs` are the source of truth.
- `MANAGER` is an oversight/read role: dashboard, scoped customers, quotation history/detail, reports, and settings profile; no quotation create/edit/cancel and no product/promotion working pages.
- `VIEWER` remains read-only: dashboard, scoped customers, quotation history/detail, reports, and settings profile; no create/edit/cancel.
- `SALES` can create and edit quotations only through existing ownership/customer-scope checks.
- Quote print/export/share are read/presentation actions and are allowed for roles that can view quotations.
- Customer assignment metadata (`salesUsers` / `assignableSalesUsers`) is returned only to roles that can manage customer assignments: `SUPER_ADMIN` and `ADMIN`.

Implemented permission matrix:

| Feature | SUPER_ADMIN | ADMIN | MANAGER | SALES | VIEWER |
|---|---:|---:|---:|---:|---:|
| View Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| View Customers | ✓ | ✓ | ✓ scoped | ✓ scoped/assigned | ✓ scoped |
| Manage Customers | ✓ | ✓ | ✗ | ✗ | ✗ |
| View Customer Form Options | ✓ | ✓ | Reduced | Reduced | Reduced |
| View Customer Assignment Options | ✓ | ✓ | ✗ | ✗ | ✗ |
| View Products Page/API | ✓ | ✓ | ✗ | ✓ | ✗ |
| Manage Products | ✓ | ✓ | ✗ | ✗ | ✗ |
| View Promotions Page | ✓ | ✓ | ✗ | ✓ | ✗ |
| Manage Promotions | ✓ | ✓ | ✗ | ✗ | ✗ |
| Create Quotation | ✓ | ✓ | ✗ | ✓ | ✗ |
| Edit/Update Quotation | ✓ | ✓ | ✗ | ✓ scoped/own | ✗ |
| Cancel Quotation | ✓ | ✓ | ✗ | ✓ scoped/own | ✗ |
| Duplicate Quotation | ✓ | ✓ | ✗ | ✓ scoped/own | ✗ |
| View Quotation | ✓ | ✓ | ✓ | ✓ scoped/own | ✓ |
| View Quotation History | ✓ | ✓ | ✓ | ✓ scoped/own | ✓ |
| Print/Export/Share Quotation | ✓ | ✓ | ✓ | ✓ scoped/own | ✓ |
| View Reports | ✓ | ✓ | ✓ | ✗ | ✓ |
| Manage Users | ✓ | ✓ with hierarchy | ✗ | ✗ | ✗ |
| Manage System Identity Settings | ✓ | ✗ | ✗ | ✗ | ✗ |
| Personal Profile / Password Settings | ✓ | ✓ | ✓ | ✓ | ✓ |

Phase 2 code alignment:

- `appscript/Permission.gs`: expanded canonical permission object.
- `appscript/Api.gs`: dispatcher uses canonical permission flags for products, quotation view/history, quotation create/edit, and customer assignment options.
- `appscript/Code.gs`: bootstrap quote filtering reuses `canAccessQuotationRecord()` instead of a separate role policy.
- `appscript/Quotation.gs`: `MANAGER` can view quotation records but cannot create/edit; duplicate quotation preserves authenticated context.
- `appscript/Customer.gs`: lower roles receive reduced customer form option metadata.
- `js/app.js`: route/menu/action visibility follows backend permission flags with safe fallback defaults.
- `js/quotation.js`: quotation edit navigation and line snapshot editing use the same frontend permission policy.
- `index.html`: Settings data-entry tile is marked for permission-driven hiding.

Follow-up permission-related remediation status:

- Phase 3 addressed the `savePromotion()` persistence stub and production demo-login visibility.
- Phase 5 continued dynamic HTML / inline handler hardening.
- Phase 7 completed broader frontend cache lifecycle cleanup for private frontend state.
