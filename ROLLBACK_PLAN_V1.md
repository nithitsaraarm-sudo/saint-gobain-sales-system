# Rollback Plan V1 — Saint-Gobain Sales System

Date prepared: 2026-07-29
Scope: V1 UAT/Pilot rollback planning.

## 1. Rollback principles

- Prefer reverting the exact release or documentation commit.
- Do not use `git reset --hard` for shared work.
- Do not roll back unrelated customer, product, quotation, profile, or UI work unless the defect is proven to come from that change.
- Back up Google Sheets before any production/pilot deployment and before any rollback.

## 2. Documentation-only rollback

If rolling back this final documentation/audit phase:

```bash
git revert <documentation-commit-hash>
```

## 3. Application rollback

If a code release has already been deployed:

1. Stop new pilot activity.
2. Export or copy the current Google Sheet workbook.
3. Record current Apps Script deployment ID/version.
4. Re-deploy the last known-good Apps Script version.
5. Re-deploy the last known-good static/PWA assets.
6. Confirm `APP_VERSION`, `cacheVersion`, service worker cache name, and asset query strings match the rollback version.
7. Ask users to close/reopen PWA only if service-worker activation requires it.
8. Verify login, customers, quotation history, and quote save with a smoke test.

## 4. Data rollback

Data rollback should be done only by the assigned data owner:

1. Identify affected sheets and row ranges.
2. Preserve the current broken state in a separate backup.
3. Restore only affected rows/sheets from the pre-release backup.
4. Verify totals, quote numbers, customer area assignments, and user roles.
5. Document the restore evidence in the incident record.

## 5. Immediate rollback triggers

Rollback or halt the release if any of these appears:

- SALES can see another sales area's restricted customers.
- A user can load or export a quotation they should not access.
- Duplicate quotation numbers are generated.
- Quote save produces partial header/line data that cannot be repaired.
- Login/logout/session behavior fails for multiple users.
- PWA cache serves stale private data across users.
- Google Sheet data loss or corruption is observed.

## 6. Smoke test after rollback

- Login/logout as SUPER_ADMIN and SALES.
- Load customers and verify area scope.
- Load quotation history and open a known quote.
- Create a small draft quotation in a test dataset only.
- Verify PWA loads the rollback version.
