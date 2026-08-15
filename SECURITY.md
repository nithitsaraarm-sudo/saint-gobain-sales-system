# Security Guidelines

## Authentication/session hardening addendum — 2026-08-13

Static audit status after this hardening pass: **improved / runtime validation still required**.

What was hardened in code:

- Public `getPublicSystemSettings` JSONP requests no longer receive `sessionToken` or `currentUserId` from the frontend API client.
- Apps Script `doGet()` now allows JSONP only for public API actions and rejects credential-bearing GET/query payloads.
- Backend identity resolution continues to derive the canonical user from the validated server-side session; a supplied `currentUserId` mismatch now returns `Session user mismatch`.
- Frontend API diagnostics redact password/session-token fields from debug logs, technical-issue logs, response previews, and pending-request keys.
- Backend log helpers redact password/session-token fields before console/SystemLogs writes.
- New sessions use two UUID values in the bearer token string; existing stored sessions remain backward-compatible until expiry/revocation.
- Self password change now revokes other server-side sessions for the same user while preserving the current session.
- Private frontend cache scope no longer stores the trailing session-token substring; it uses a per-session client scope id.

Architecture notes:

- Current auth remains a localStorage bearer-token model because an HttpOnly Secure SameSite cookie migration needs separate proof across Apps Script `/exec` redirects, `googleusercontent` runtime URLs, PWA standalone mode, and iPhone Safari behavior.
- Passwords still exist transiently in the login form and HTTPS POST request body; that is expected browser behavior and not by itself a transport-security defect.
- Password hashing remains the existing salted SHA-256 model for backward compatibility. A stronger password-derivation migration should be planned separately.

Runtime evidence still required:

- Old token fails after logout.
- Tampered `currentUserId` cannot impersonate another user.
- Expired token is rejected.
- Disabled/locked users cannot continue with old tokens.
- Password change revokes other sessions.
- Logs and browser diagnostics do not expose password/session tokens.
- Public settings remains accessible without auth.
- Desktop, Android Chrome, iPhone Safari, and installed PWA login/session behavior.

## V1 pre-release security addendum — 2026-07-29

Final static security review status: **conditional / not production-cleared**.

Static positives observed:

- Production config has demo login disabled.
- Non-public API actions pass through `requireApiUser()` in `appscript/Api.gs`.
- Backend role checks exist for customers, products, promotions, quotations, users, settings, and system identity actions.
- Customer area and assigned-sales scope is enforced in backend customer access helpers.
- Quotation load/save/history paths include customer/quotation access checks and quote save lock/idempotency/rollback protection.
- Discount API validates customer scope before returning discount data.
- Service worker excludes Apps Script and token-bearing/sensitive requests from cache handling.
- Profile image display uses canonical `profileImageUrl` with backward-compatible legacy reads and safe fallback.

Open security/readiness risks:

- P0 gate: runtime RBAC/data-isolation tests have not been executed against live UAT deployment/data/users.
- Strict CSP is still future work because the legacy UI uses inline handlers and dynamic `innerHTML`.
- Quotation concurrency and rollback behavior are statically implemented but require live simultaneous-save evidence.
- Backup/restore drill has not been executed in this environment.

Do not mark the system ready for real-user UAT/Pilot until the P0 security tests in `TEST_CASES.md` pass with evidence.

เอกสารนี้สรุปแนวทางความปลอดภัยสำหรับโปรเจกต์ โดยครอบคลุมการจัดการสิทธิการเข้าถึง Google Sheets, การปกป้องข้อมูลส่วนบุคคล และแนวปฏิบัติด้านความปลอดภัยของฝั่งไคลเอนต์

## หลักการสำคัญ
- Principle of Least Privilege: ให้สิทธิ์เฉพาะที่จำเป็นต่อการทำงาน
- Defense in Depth: ใช้มาตรการหลายชั้น เช่น validation ทั้งฝั่งไคลเอนต์และเซิร์ฟเวอร์

## Google Sheets / Apps Script
- อย่าเก็บ secrets (เช่น API keys) ใน repository
- ใช้ PropertiesService หรือ Secret Manager ของ GCP (ถ้าจำเป็น)
- จำกัดการเข้าถึงไฟล์ Google Sheets: ให้เฉพาะ service account / แอปที่เชื่อถือได้
- Logs: บันทึก activity สำคัญลง `Audit` sheet แต่ไม่บันทึกข้อมูล sensitive เช่น full password

## Authentication & Authorization
- หากระบบต้องการผู้ใช้จริง ให้พิจารณาใช้ OAuth2 หรือ Firebase Auth
- หากใช้การยืนยันผ่าน Sheets ให้เข้ารหัสค่า password (hash + salt) และอย่าเก็บ plaintext

## Frontend Security
- ป้องกัน XSS: sanitize input ก่อนแสดงผล
- Content Security Policy (CSP): พิจารณาเพิ่ม header CSP เพื่อจำกัดแหล่งโหลดสคริปต์
- Service Worker: ตรวจสอบ caching policy เพื่อไม่เก็บข้อมูล sensitive ใน cache
- Development Mode: อนุญาตให้มี Demo Login และ Debug Log เฉพาะในสภาพแวดล้อมพัฒนาเท่านั้น
- Production Mode: ต้องไม่มี Demo Login, ไม่มี Debug Menu, ไม่มี Test Data, และซ่อน Developer Settings ทั้งหมด

## Data Validation
- Validate ทุก input ทั้งฝั่ง client และใน Apps Script
- ตรวจสอบขอบเขตค่า (เช่น % ส่วนลดไม่เป็นลบหรือ >100)

## Backup & Auditing
- สำรอง `DiscountMatrix` และ `QuoteHistory` เป็นระยะ
- เก็บ `DiscountChangeLog` เพื่อ audit trail

## Incident Response
- มีขั้นตอน rollback และผู้รับผิดชอบชัดเจน
- แจ้งทีมที่เกี่ยวข้องเมื่อพบการเปลี่ยนแปลงที่ไม่ได้รับอนุญาต

## Frontend external script hardening

`index.html` loads the pinned `html2canvas@1.4.1` and `jspdf@2.5.1` browser bundles from jsDelivr. These script tags must keep Subresource Integrity (`integrity`) and `crossorigin="anonymous"` so a CDN-side file change is rejected by the browser.

## Content Security Policy migration plan

The current frontend still contains inline event handlers and inline bootstrap scripts. A strict CSP such as `script-src 'self'` cannot be enabled safely until those inline handlers are migrated to delegated `addEventListener` bindings and any required bootstrap script receives a nonce or hash.

Recommended order:

1. Keep all third-party scripts version-pinned with SRI.
2. Move inline event handlers to JavaScript event delegation.
3. Move inline startup/configuration scripts into local versioned files or provide a deployment-time nonce.
4. Add a report-only CSP first, monitor violations, then enforce.

Until CSP enforcement is ready, all dynamic HTML renderers that consume Sheet/API data must escape text and safely encode values used inside inline JavaScript handlers.

---
*ต้องการให้ผมช่วยตั้งค่า CSP ตัวอย่างหรือตัวอย่างการ hash password ใน Apps Script ไหมครับ?*
