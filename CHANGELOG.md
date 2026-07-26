# CHANGELOG

ทุกการเปลี่ยนแปลงสำคัญจะถูกบันทึกที่นี่ตามรูปแบบ Keep a Changelog

## [Unreleased]
- จัดทำเอกสารโครงสร้างโปรเจกต์และแผนงาน

## [0.5.25] - 2026-07-26
### Security
- Fixed quotation cache authorization order so cached quotation data is not returned before permission validation.
- Added customer/area scope validation before returning discount data.
- Moved authenticated API calls away from token-bearing JSONP GET and restricted service-worker caching to approved static assets.
- Aligned canonical RBAC behavior across backend, bootstrap, route guards, quotation actions, reports, and settings.
- Added Subresource Integrity metadata for pinned external export libraries.
- Hardened active frontend render paths with safer escaping/string-literal helpers.

### Fixed
- Replaced the promotion save stub with real validated persistence.
- Hid Demo Login in production unless explicitly enabled for development.
- Scoped private frontend caches by authenticated user/session context and reset private state on login/logout.
- Removed legacy duplicate frontend renderer definitions.
- Improved Apps Script row updates/deletes by batching contiguous sheet writes/deletes.

### Changed
- Centralized frontend runtime configuration and aligned app, manifest, asset, and service-worker cache versions.
- Added explicit button types, modal dialog semantics, toast live-region semantics, and visible focus styles for core UI controls.

### Documentation
- Added `FULL_PROJECT_AUDIT.md`, `RBAC_PERMISSION_AUDIT.md`, `REMEDIATION_PROGRESS.md`, and `ACCESSIBILITY_CHECKLIST.md`.
- Documented remediation phase status and remaining hardening work.

## [0.1.0] - 2026-07-06
### Added
- แยก CSS และ JS จาก `index.html` เป็นไฟล์ `css/main.css` และ `js/*.js`
- สร้างเอกสาร: `README.md`, `PROJECT_PLAN.md`, `DATABASE.md` (ปรับปรุง), `API.md`, `FOLDER_STRUCTURE.md`, `CODING_STANDARD.md`, `DEPLOYMENT.md`, `SECURITY.md`

---
*บันทึกการเปลี่ยนแปลงควรถูกอัปเดตทุกครั้งก่อนการปล่อย tag ใหม่*
