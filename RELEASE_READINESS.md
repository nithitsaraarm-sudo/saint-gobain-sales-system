# Release Readiness Report — Audit Remediation

## Customer Agreement V1 addendum — 2026-08-19

Decision impact: **DEVELOPMENT VALIDATION PASSED / RELEASE GATE STILL BLOCKED**.

Customer Agreement / Store Benefit Tracking V1 has local source-level validation only:

| Validation | Status |
|---|---|
| Static JS/GAS/JSON/assets check | PASS |
| Automated unit/integration tests | PASS — 103/103 |
| Apps Script live deployment | NOT RUN |
| Google Sheets live migration/headers | NOT RUN |
| Google Drive attachment upload | NOT RUN |
| Desktop/mobile browser UAT | NOT RUN |
| iPhone Safari, Android Chrome, PWA UAT | NOT RUN |

Release recommendation is unchanged: do not approve Pilot Go-Live or Production Go-Live until runtime/manual UAT passes with evidence.

## Deferred Runtime UAT decision — 2026-08-18

Decision impact: **DEVELOPMENT MAY CONTINUE / RELEASE GATE BLOCKED**.

Runtime UAT is intentionally deferred during active development. This deferment does **not** mean runtime validation passed, and it does **not** weaken Pilot Go-Live or Production Go-Live criteria.

Current live/runtime status:

| Runtime validation | Status |
|---|---|
| Apps Script Live Backend | NOT RUN |
| Google Sheets Live Data | NOT RUN |
| Desktop Runtime UAT | NOT RUN |
| iPhone Safari | NOT RUN |
| Android Chrome | NOT RUN |
| PWA Runtime | NOT RUN |

Gate status:

| Gate | Status | Meaning |
|---|---|---|
| Development Gate | PASS | Engineering phases may continue from the current source-verified baseline. |
| Release Gate | BLOCKED — Runtime UAT pending | Pilot Go-Live and Production Go-Live must not proceed until mandatory runtime validation passes with evidence. |

Current automated baseline preserved:

- Static validation: PASS
- Unit tests: PASS
- Integration/API contract tests: PASS
- Total automated tests: 92/92 PASS
- Phase 4 commit: `a3c25c3f5a295ba8f01b3996fa30f9a0ece78535`

Mandatory before Pilot Go-Live:

- Apps Script live backend: PASS
- Google Sheets persistence: PASS
- Desktop runtime smoke test: PASS
- SALES/ADMIN/RBAC runtime checks: PASS
- iPhone Safari critical flow: PASS
- Android Chrome critical flow: PASS
- PWA install/open/update flow: PASS

Mandatory before Full Production Go-Live:

- All P0/P1 runtime blockers resolved.
- Critical mobile/PWA flows PASS.
- No unresolved live backend persistence issue.

## Phase 4 Integration/API Contract Testing addendum — 2026-08-18

Decision impact: **SOURCE CONTRACT COVERAGE IMPROVED / NOT RUNTIME READY**.

Phase 4 adds zero-network integration/API contract coverage across the frontend API client, Apps Script API router, backend action dispatch, permission gates, response normalization, and empty/error-state behavior.

Local source coverage added:

- API client: success, legacy success compatibility, HTTP failure, empty response, invalid JSON, timeout/abort, network failure, `eventId`, redirect metadata on HTTP failure, and session context attachment.
- API router: frontend/backend action-name parity, `getSalesTargetManagementData` dispatch, unknown action contract, invalid session rejection, authenticated `currentUser` injection, and request payload role/permission tamper denial.
- Customer: SALES own-area create/update, cross-area denial, assignment tampering denial, VIEWER/PC write denial, and scoped list empty-state handling.
- Sales Target: GYPROC/WEBER configurable targets, ALL filter/history behavior, duplicate active conflict, stale/correct version updates, legacy ALL status handling, effective target read vs management permissions, and no double-counting legacy ALL.
- Product/Promotion: current read RBAC plus master write denial for SALES/PC and allow path for ADMIN/SUPER_ADMIN.
- Quotation: save/update response shape, validation error shape, view/history/duplicate/cancel guards, VIEWER read-only behavior, and PC denial.
- Auth/RBAC/Error: PC is distinct from SALES, permission payload shape remains bootstrap-compatible, backend failures are preserved by the frontend, and successful empty arrays are not converted into errors.

Tooling update:

- `npm.cmd run check` = static validation.
- `npm.cmd run test` / `npm.cmd run test:unit` = unit business-logic tests.
- `npm.cmd run test:integration` = zero-network API/contract integration tests.
- `npm.cmd run test:all` = unit + integration tests.
- `npm.cmd run verify` = `check + test:all`.

Local Phase 4 validation result:

- Node.js/npm observed: `node v24.19.0`, `npm 11.17.0`.
- `npm.cmd run check` passed.
- `npm.cmd run test` passed with 57/57 unit tests.
- `npm.cmd run test:integration` passed with 35/35 integration/API contract tests.
- `npm.cmd run test:all` passed with 92/92 total tests.
- Controlled failure validation passed: a temporary failing integration fixture produced a non-zero test result and was removed before final validation.
- `npm.cmd run verify` passed with 92/92 total tests.
- `git diff --check` passed with line-ending warnings only.

Runtime readiness remains unchanged: Apps Script live backend, Google Sheets live data, desktop browser, iPhone Safari, Android Chrome, installed PWA, and production smoke tests still require manual/runtime execution with evidence. This addendum does **not** change the release recommendation to runtime-ready.

## Phase 3.2.1 Customer Add Button Permission Sync addendum — 2026-08-18

Decision impact: **SOURCE UI PERMISSION SYNC REMEDIATED / NOT RUNTIME READY**.

Phase 3.2.1 remediated the Customer page add-action visibility regression found after Phase 3.2:

- The Customer page `+ เพิ่มร้านค้า` button and Settings > เพิ่มข้อมูล customer action now resolve `canManageCustomers` through the same frontend helper used by the customer modal open/edit flow.
- `SALES` resolves customer-create UI access from the approved scoped customer-management policy, including resilience against stale pre-3.2 cached permission maps.
- `VIEWER` and `PC` remain blocked from customer-create UI access.
- Product Master and Promotion Master add actions remain hidden/forbidden for `SALES`.
- Customer backend authorization and Phase 3.2 area/assignment protections were not changed.
- Automated unit coverage increased to 57 tests after adding the Phase 3.2.1 frontend permission-sync suite.

Local source validation for this addendum:

- Baseline `npm.cmd run verify`: passed before implementation with 53/53 tests.
- `npm.cmd run check`: passed after implementation.
- `npm.cmd run test`: passed after implementation with 57/57 tests.
- `npm.cmd run verify`: passed after implementation with 57/57 tests.
- `git diff --check`: passed; Git only reported line-ending normalization warnings.
- `node_modules`: absent; `package-lock.json`: absent; no root temp/bak files detected.

Runtime readiness still requires Apps Script deployment, live role-specific Google Sheets/API/UAT, desktop browser checks, iPhone Safari, Android Chrome, and installed-PWA verification. This addendum does **not** change the release recommendation to runtime-ready.

## Phase 3.2 Sales scoped customer self-service addendum — 2026-08-18

Decision impact: **SOURCE RBAC REMEDIATED / NOT RUNTIME READY**.

Phase 3.2 remediated the customer self-service permission gap:

- `SALES` can now pass the canonical `canManageCustomers` permission for scoped customer create/edit only.
- `SALES` still cannot manage Product Master or Promotion Master through the central API router.
- `Customer.gs` now enforces customer write permission directly, derives SALES assignment from the authenticated user on create, rejects cross-area writes, rejects assignment hijack attempts, and blocks SALES changes to protected metadata/status fields.
- `PC` is now normalized as a distinct restricted role rather than falling through to `SALES`.
- Frontend data-entry UI now reflects customer-only access for SALES and hides assignment controls for roles without assignment-management permission.
- Automated unit coverage increased to 53 tests after adding the Phase 3.2 customer/RBAC suite.

Local source validation currently completed for this addendum:

- Baseline `npm.cmd run verify`: passed before implementation with 38 tests.
- `npm.cmd run check`: passed after implementation.
- `npm.cmd run test`: passed after implementation with 53/53 tests.
- `npm.cmd run verify`: passed after implementation with 53/53 tests.
- `git diff --check`: passed; Git only reported line-ending normalization warnings.

Runtime readiness still requires Apps Script deployment, live Google Sheets API/UAT, role-specific browser checks, iPhone Safari, Android Chrome, Desktop, and installed-PWA verification. This addendum does **not** change the release recommendation to runtime-ready.

## Sales Target Management UI/UX cleanup addendum — 2026-08-18

Decision impact: **SOURCE UI/UX DEFECTS REMEDIATED / NOT RUNTIME READY**.

The focused Sales Target cleanup removed the duplicate visible `All` filter option, clarified the Sales Area form dropdown, hid/disabled Month for annual targets, required Month only for monthly targets, and preserved the approved `GYPROC + WEBER` Sales Target model.

Automated unit coverage is now 38 tests after adding annual/monthly Sales Target period normalization coverage. Runtime readiness still requires Apps Script deployment plus live browser/mobile/PWA UAT for the Sales Target Management screen.

## Sales Target BU remediation addendum — 2026-08-18

Decision impact: **SOURCE BUSINESS RULE REMEDIATED / NOT RUNTIME READY**.

Phase 3.1 remediated the Sales Target Business Unit mismatch found in Phase 3:

- Target create/edit configuration now allows only `GYPROC` and `WEBER`.
- `ALL` remains available as a filter/history concept.
- Backend validation rejects new configurable `ALL` targets and reactivation of legacy `ALL` targets.
- Current target total is derived from active `GYPROC + WEBER` targets; legacy active `ALL` rows are excluded from current totals and flagged for manual review.
- Automated unit coverage increased to 37 tests.

Runtime readiness still requires Apps Script deployment and live Google Sheets/browser/PWA/UAT verification. If production contains active legacy `ALL` target rows, those rows require manual business review; the source code does not delete, split, or rewrite them automatically.

## Minimal Node unit business validation addendum — 2026-08-18

Decision impact: **SOURCE REGRESSION PROTECTION IMPROVED / NOT RUNTIME READY**.

Phase 3 added dependency-free unit tests with Node built-in `node:test` / `node:assert` for critical business logic: quotation calculations/validation, Sales Target summary/effective target logic, Dashboard Customer/Business/Sales KPI logic, Promotion date/status/summary logic, and shared normalization utilities.

Recommended pre-release source validation command:

```powershell
npm.cmd run verify
```

`verify` runs Phase 2 static checks and Phase 3 unit tests. It does not replace live Apps Script, Google Sheets, RBAC, mobile browser, PWA, quotation export/share, or production smoke testing.

Phase 3 found a Sales Target business-rule mismatch; source remediation is now tracked in the Phase 3.1 addendum above. Runtime deployment/UAT remains required before marking the production environment ready.

Date: 2026-07-26
Branch: `audit/full-remediation`
Baseline audit commit: `0cb62334d62341a78ba6f3b1194ca42c985c1c47`

## Minimal Node development validation addendum — 2026-08-18

Decision impact: **SOURCE VALIDATION IMPROVED / NOT RUNTIME READY**.

Phase 2 added development-only npm scripts with zero dependencies for local static validation:

- `npm run check`
- `npm run check:js`
- `npm run check:gas`
- `npm run check:json`
- `npm run check:assets`

Pre-release source validation should now include `npm run check` before Apps Script/static deployment. This does not replace live Apps Script, Google Sheets, RBAC, mobile browser, PWA, quotation, customer, product, promotion, or production smoke testing. Do not change the release recommendation to runtime-ready until the existing `TEST_CASES.md` runtime/manual gates are executed with evidence.

## Final commit-readiness addendum — 2026-08-15

Decision: **SOURCE READY TO COMMIT / NOT RUNTIME READY**.

This local final audit confirmed the working tree source routes, security markers, Service Worker asset list, and whitespace checks before commit. Two Login/Forgot Password release blockers were fixed locally: Login now has loading/disabled duplicate-submit protection, and disabled `resetPassword` no longer requires an authenticated session before returning the intended disabled response.

Runtime acceptance is still required after Apps Script deployment and static asset refresh. Do not mark this release ready for real-user UAT/Pilot until live API, Google Sheets, role-based browser, mobile Safari/Android, and installed-PWA smoke tests are executed and evidence is attached.

## V1 final pre-release addendum — 2026-07-29

Decision: **NOT READY** for real-user UAT or Pilot Go-Live today.

Reason: the repository/static audit is substantially remediated, but release-blocking runtime validation has not been executed against the target Apps Script deployment, UAT Google Sheets, role-specific accounts, iPhone Safari, Android Chrome, Desktop browsers, or installed PWA sessions.

Current evidence:

- Branch inspected: `audit/full-remediation`
- Commit inspected before this document phase: `6a723ed`
- Version inspected: `0.5.26`
- Static catalogue checks: 15/15 passed
- Full catalogue coverage: 15/74 = 20.3%
- Runtime/API/browser/PWA/production smoke tests: 59 blocked/not run; 0 claimed passed
- Open release-gate issues: P0=1, P1=4, P2=3, P3=1

Authoritative V1 readiness documents:

- `FINAL_V1_PRE_RELEASE_AUDIT.md`
- `TEST_CASES.md`
- `UAT_CHECKLIST.md`
- `KNOWN_ISSUES.md`
- `PILOT_GO_LIVE_PLAN.md`
- `ROLLBACK_PLAN_V1.md`
- `RELEASE_NOTES_V1.md`

Minimum action before status can move to `READY WITH CONDITIONS`: execute every P0 runtime/API/RBAC/PWA/browser test in `TEST_CASES.md`, attach evidence, verify backup/restore, and update this report with actual results.

## Completed phases

| Phase | Status | Primary commit |
|---|---|---|
| Phase 0 — Audit baseline | Completed | `0cb62334d62341a78ba6f3b1194ca42c985c1c47` |
| Phase 1 — Critical Security Fixes | Completed | `4ed7abba5628b1f3b4dae490a2ae823e5586a7a3` |
| Phase 2 — Canonical RBAC and Permission Alignment | Completed | `064bdcf243e2fc26c6cbefa8a73964aa9d517071` |
| Phase 3 — Incomplete and Misleading Features | Completed | `8f306fdf9e67136332e0a5446852b158babd08c2` |
| Phase 4 — Version, Environment, and Deployment Configuration | Completed | `89f6b53e54f82bf2af2627ac6482b537ec50eb5b` |
| Phase 5 — External Script and Frontend Security Hardening | Completed | `fc25687576a4aadb6d17382bf0fb033817a62e8f` |
| Phase 6 — Apps Script Performance and Data Safety | Completed | `fb7e3e4cb59ebab9ebf50ed0a2c9608d652524c3` |
| Phase 7 — Frontend Cache and State Reliability | Completed | `2caeaca4fecec848dc7ef771a8d6080a50a6d79f` |
| Phase 8 — Controlled Maintainability Refactor | Completed | `f6981df33420d545e271ed49ff9f8715b655dc77` |
| Phase 9 — UX Reliability and Accessibility | Completed | `0b54ca266866f8cd05cf90aede2ff6a2e9526156` |
| Phase 10 — Documentation Synchronization | Completed | `1786ac7448d41b35171bc28fe94b3cd59da736b4` |

## Final validation performed

| Check | Result |
|---|---|
| `git diff --check` | Passed; only expected Windows LF/CRLF warnings appeared during dirty working-copy checks. |
| Runtime/config old-version search over app/runtime files | Passed; old `0.5.x` asset/cache versions were not found outside preserved audit-baseline text. |
| Authenticated JSONP check | Passed; `apiJsonpGet()` remains only for the public `getPublicSystemSettings` read path. |
| Service worker cache policy check | Passed; cache writes are scoped to approved same-origin static assets and navigation fallback. |
| Quotation cache authorization check | Passed by static inspection; `canAccessQuotationRecord()` runs before cached `loadQuotation` data is returned. |
| Discount scope validation check | Passed by static inspection; `discount` API dispatch calls `validateDiscountCustomerScope_()` before `getDiscount()`. |
| Duplicate frontend renderer declarations | Passed; duplicate function declaration script returned `duplicate_function_declarations=0`. |
| Static/generated button type check | Passed; `index.html`, `js/app.js`, and `js/quotation.js` returned `buttons_without_type=0`. |
| Modal/toast semantics check | Passed; 5 dialog roles, 5 `aria-modal="true"` attributes, and one toast polite live region were found. |
| Local JavaScript runtime availability | Not available; `where.exe node`, `where.exe deno`, and `where.exe bun` did not find installed runtimes. |

## Manual tests still required

Run these after deployment to Apps Script / static hosting:

- Login/logout/session refresh for all roles.
- SALES customer area isolation.
- SUPER_ADMIN/ADMIN user/customer/product/promotion management.
- MANAGER and VIEWER read-only quotation/report flows.
- Create, save, load, duplicate, cancel, print, export PDF, export PNG, and share quotations.
- Customer favorites and product favorite/pinned flows.
- Profile image upload/display/refresh/logout-login/PWA reopen.
- PWA install/reopen/cache refresh.
- Mobile smoke tests from `ACCESSIBILITY_CHECKLIST.md`.
- Full production execution should follow `TEST_CASES.md`; runtime, browser/PWA, and production smoke tests remain required and are not marked passed by this readiness report.

## Remaining risks

- No automated JavaScript test runner or browser automation stack exists in this repository.
- Strict CSP is not ready yet because inline handlers remain in legacy UI architecture.
- `js/app.js`, `js/quotation.js`, and `appscript/Quotation.gs` remain large maintainability hotspots.
- Live Google Sheets data and deployed Apps Script behavior were not available in this local environment.
- Audit baseline files intentionally preserve original stale examples; read the remediation addenda at the top of those files for current status.

## Rollback plan

Prefer reverting individual phase commits instead of resetting the repository:

```bash
git revert <phase-commit-hash>
```

If rolling back documentation only:

```bash
git revert 1786ac7448d41b35171bc28fe94b3cd59da736b4
```

If rolling back the latest UX/accessibility phase only:

```bash
git revert 0b54ca266866f8cd05cf90aede2ff6a2e9526156
```

Do not use `git reset --hard` or roll back unrelated customer refresh, product, quotation, or profile-image work.
