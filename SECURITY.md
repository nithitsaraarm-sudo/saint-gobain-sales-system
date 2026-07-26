# Security Guidelines

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
