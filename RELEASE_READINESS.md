# Release Readiness Report — Audit Remediation

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
