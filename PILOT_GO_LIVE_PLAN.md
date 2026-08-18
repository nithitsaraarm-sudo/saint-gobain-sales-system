# Pilot Go-Live Plan — Saint-Gobain Sales System V1

Date prepared: 2026-07-29
Current recommendation: **Do not start pilot until UAT passes.**

Runtime UAT deferment status as of 2026-08-18: **DEFERRED FOR DEVELOPMENT / BLOCKER BEFORE PILOT GO-LIVE**.

Development may continue from the current automated baseline, but Pilot Go-Live must not start until these runtime items are executed and PASS with evidence:

- Apps Script live backend
- Google Sheets persistence
- Desktop runtime smoke test
- SALES/ADMIN/RBAC runtime checks
- iPhone Safari critical flow
- Android Chrome critical flow
- Installed PWA install/open/update flow

## 1. Pilot objective

Run a limited pilot with controlled users and real-but-recoverable data to validate production behavior before broad rollout.

## 2. Prerequisites

- UAT checklist completed and signed off.
- Deferred Runtime UAT resumed and passed for Apps Script live backend, Google Sheets persistence, Desktop, iPhone Safari, Android Chrome, and installed PWA.
- All P0 tests in `TEST_CASES.md` passed with evidence.
- No unresolved Sev1/Sev2 defects.
- Google Sheet backup and restore drill completed.
- Production Apps Script deployment, static hosting, and PWA cache version confirmed.
- Support owner, escalation channel, and rollback owner assigned.

## 3. Recommended pilot scope

| Scope item | Recommendation |
|---|---|
| Duration | 3-5 business days |
| Users | 1 SUPER_ADMIN, 1 ADMIN, 1 MANAGER, 2 SALES from different areas, 1 VIEWER |
| Data | Production-like pilot data with pre-pilot backup |
| Core flows | Login, customer search, quote creation, quote history, exports, profile image, mobile/PWA |
| Out of scope | Bulk import, mass data cleanup, schema changes, unrelated UI redesign |

## 4. Day-by-day plan

| Day | Activity | Exit signal |
|---|---|---|
| Day 0 | Backup, deploy, smoke test, confirm rollback owner | Smoke tests passed |
| Day 1 | Pilot login/RBAC/customer visibility | No data leak or login blocker |
| Day 2 | Quotation creation/update/export across Weber/Gyproc/mixed | Correct quote numbers and totals |
| Day 3 | Mobile/PWA/profile/favorites/pinned workflows | No device-specific blocker |
| Day 4-5 | Regression, issue triage, business sign-off | Go/No-Go decision |

## 5. Monitoring

Monitor:

- Apps Script execution errors and latency.
- Quote save failures, duplicate submit, lock timeout, partial save detection.
- Customer-area access denials.
- Profile image upload failures.
- PWA cache/update complaints.
- Manual reports from pilot users.

## 6. Incident response

| Severity | Example | Response |
|---|---|---|
| Sev1 | Data leak, duplicate quote number, login outage, data loss | Stop pilot, revoke access if needed, execute rollback. |
| Sev2 | Quotation save/export blocked for pilot users | Pause affected workflow, hotfix only after defect record. |
| Sev3 | Workaround exists | Continue pilot with documented workaround if owner accepts. |
| Sev4 | Cosmetic issue | Track for next release. |

## 7. Rollback trigger

Rollback if any of these occurs:

- SALES can access another area/customer outside scope.
- Duplicate quotation number is created.
- Quote save causes partial data that cannot be automatically rolled back.
- Login/session failure affects multiple users.
- PWA/cache serves another user's private data.

Detailed rollback steps are in `ROLLBACK_PLAN_V1.md`.
