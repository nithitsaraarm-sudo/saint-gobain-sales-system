# Known Issues — Saint-Gobain Sales System V1

Date prepared: 2026-07-29
Source: final pre-release audit, static repository inspection, and existing remediation documents.

## Open issue summary

| Severity | Count |
|---|---:|
| P0 | 1 |
| P1 | 4 |
| P2 | 3 |
| P3 | 1 |

## Issues

| ID | Severity | Status | Issue | Risk | Recommended fix/next action |
|---|---|---|---|---|---|
| V1-P0-001 | P0 | Open release blocker / Deferred for development | Runtime environment validation is pending: Apps Script live backend, Google Sheets persistence, Desktop Runtime UAT, iPhone Safari, Android Chrome, and PWA Runtime are **NOT RUN**. | Development may continue, but release risk remains high because live backend persistence, role isolation, duplicate quote prevention, exports, stale cache, and mobile/PWA behavior are not proven. | Resume Runtime UAT before Pilot Go-Live, execute all P0 tests in `TEST_CASES.md` and `UAT_CHECKLIST.md`, resolve P0/P1 runtime blockers, and attach evidence before UAT invite or pilot. |
| V1-P1-001 | P1 | Open | Backup/restore drill is documented but not verified in this environment. | Data recovery may fail during pilot. | Execute backup and restore drill before UAT and pilot. |
| V1-P1-002 | P1 | Open | Quotation concurrency/idempotency is statically implemented but not runtime-tested with simultaneous users. | Duplicate quotation number or lock behavior could fail under real concurrency. | Run concurrent save tests against live deployment. |
| V1-P1-003 | P1 | Open hardening | Strict CSP cannot be safely enforced yet because the legacy frontend still uses inline handlers and dynamic `innerHTML`. | XSS defense relies on escaping and trusted code discipline rather than enforceable CSP. | Migrate inline handlers to delegated listeners in a future hardening phase; start with report-only CSP. |
| V1-P1-004 | P1 | Open | No local JavaScript/browser test runner was available in this environment. | Regression testing remains largely manual/static. | Add a lightweight browser/static test workflow when tooling is available. |
| V1-P2-001 | P2 | Open | Live performance measurements are not recorded for the final deployment. | Apps Script timeouts may still appear under real data volume. | Capture performance logs for bootstrap, customers, quote save, quote history, and exports during UAT. |
| V1-P2-002 | P2 | Open | Business-user UAT guide and final training screenshots still need owner completion. | Pilot users may need extra support. | Use `UAT_CHECKLIST.md` and add screenshots after deployment. |
| V1-P2-003 | P2 | Open | Public Apps Script Web App URL is hardcoded in `js/config.js`; not secret, but release owner must confirm target. | Wrong deployment URL can send users to the wrong backend. | Confirm deployment URL during release checklist and version bump. |
| V1-P3-001 | P3 | Open housekeeping | Untracked `*- Copy.md` files exist in the repository working tree. | Could confuse future documentation reviews if accidentally committed. | Leave untouched or clean up intentionally in a separate housekeeping commit. |
