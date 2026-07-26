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
| Phase 1 — Critical Security Fixes | Pending | - |
| Phase 2 — Canonical RBAC and Permission Alignment | Pending | - |
| Phase 3 — Incomplete and Misleading Features | Pending | - |
| Phase 4 — Version, Environment, and Deployment Configuration | Pending | - |
| Phase 5 — External Script and Frontend Security Hardening | Pending | - |
| Phase 6 — Apps Script Performance and Data Safety | Pending | - |
| Phase 7 — Frontend Cache and State Reliability | Pending | - |
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

## Rollback Notes

Rollback preferred per phase:

```bash
git revert <phase-commit-hash>
```

Do not reset the entire repository.
