# Release Notes V1 — Saint-Gobain Sales System

Date prepared: 2026-07-29
Version inspected: `0.5.26`
Release recommendation: **Not ready for real-user UAT/Pilot until P0 runtime gates pass.**

## Highlights included in the V1 candidate

- Role-based access control for `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `SALES`, and `VIEWER`.
- Customer area and assigned-sales scope enforcement.
- Weber/Gyproc customer brand assignment.
- Customer favorites.
- Product favorites and pinned products.
- Exact product duplicate guard for product card rendering while preserving distinct price/unit/brand records.
- Quotation workflow with draft/save/update/cancel/duplicate/history/detail.
- New quotation numbering format for Weber, Gyproc, and mixed-brand quotations.
- Quotation save idempotency, ScriptLock protection, verification, and rollback paths.
- Print/PDF/PNG/share UI for quotations.
- Profile image upload with compressed client image data and canonical `profileImageUrl` storage/display.
- PWA static asset caching policy and versioned cache.
- Custom UI icons/logos and mobile/responsive fixes across recent phases.

## Compatibility notes

- Existing legacy quotation numbers beginning with `QT-` are expected to remain open/edit/preview/export compatible.
- Existing user/profile image legacy fields are read backward-compatibly: `profileImageUrl`, `profilePhotoUrl`, `avatarUrl`, and `photoUrl`.
- No database migration is introduced by this final audit documentation phase.

## Known limitations before UAT

- Runtime/API/browser/PWA tests are still blocked/not run in this local environment.
- Strict CSP is future work due to legacy inline handlers.
- Production backup/restore and concurrency behavior must be verified with live deployment.

See:

- `FINAL_V1_PRE_RELEASE_AUDIT.md`
- `TEST_CASES.md`
- `UAT_CHECKLIST.md`
- `KNOWN_ISSUES.md`
- `ROLLBACK_PLAN_V1.md`
