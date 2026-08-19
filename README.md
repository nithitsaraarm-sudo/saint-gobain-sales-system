# Saint-Gobain Sales System

## Customer Agreement / Store Benefit Tracking V1

V1 adds a separate customer-context module for manually tracking customer agreements and store benefits. It is intentionally **not** merged into Sales Target and has **no automatic sales-data synchronization**.

- Source of truth: manual user input for target, actual, eligible sales, and benefit rate.
- Backend-owned derived values: achievement percent, pass/fail, benefit amount, and summary totals.
- Dedicated Sheets: `CustomerAgreements`, `AgreementEntries`, and `AgreementAttachments`.
- Permissions reuse existing Customer area/assignment scope. SALES users may manage only agreements for customers they are authorized to access. VIEWER and PC remain read/write restricted by the central API router.
- Attachments support PDF, PNG, and XLSX only, up to 10 MB, stored in Google Drive through Apps Script.
- Runtime Google Sheets, Drive upload, mobile browser, and PWA UAT remain required before release approval.

เอกสารเบื้องต้นสำหรับทีมพัฒนา: โครงงาน PWA เพื่อจัดการใบเสนอราคาและการคำนวณส่วนลดโดยใช้ Google Sheets เป็นแหล่งข้อมูลหลัก

**เนื้อหาใน repo นี้**
- หน้าเว็บหลัก: `index.html` (วางที่รากโปรเจกต์ เพื่อรองรับ GitHub Pages)
- ไฟล์สไตล์: `css/main.css` (แยกจาก inline)
- โค้ดไคลเอนต์: `js/*.js` (เช่น `auth.js`, `quotation.js`, `app.js`)
- PWA: `manifest.json`, `service-worker.js`
- Apps Script scaffold: `appscript/Code.gs` (ใช้สำหรับเชื่อมต่อ Google Sheets)
- เอกสารโครงการ: `README.md`, `PROJECT_PLAN.md`, `DATABASE.md`, `CHANGELOG.md`, `API.md`, `FOLDER_STRUCTURE.md`, `CODING_STANDARD.md`, `DEPLOYMENT.md`, `SECURITY.md`

## จุดประสงค์
เอกสารนี้และไฟล์อื่นในโฟลเดอร์ `docs/` (หรือรากโปรเจกต์) มีจุดประสงค์เพื่อ:
- ให้ทีมเข้าใจสถาปัตยกรรมของระบบ
- ระบุ workflow การพัฒนาและการ deploy
- อธิบายรูปแบบข้อมูลใน Google Sheets และการทำงานของ Apps Script

## เริ่มต้น (Quickstart)
1. เปิดไฟล์ `index.html` ในเบราว์เซอร์หรือใช้เซิร์ฟเวอร์สเตติก เช่น Python http.server:

```bash
# ใน PowerShell
python -m http.server 8000
# แล้วเปิด http://127.0.0.1:8000/
```

## Development Validation

Phase 3.1 remediates the Sales Target Business Unit rule found by Phase 3 tests:

- Configurable Sales Target Business Units are `GYPROC` and `WEBER` only.
- Sales Target filters may still use `ALL`, `GYPROC`, or `WEBER`.
- Current total target is derived as `GYPROC target + WEBER target`.
- Historical `ALL` Sales Target rows remain readable for audit/history, but new configurable `ALL` targets are rejected by backend validation.

Phase 4 adds zero-network integration/API contract tests that validate the frontend API client, Apps Script API router, backend action dispatch, permission gates, response normalization, and empty/error-state contracts. Phase 3 unit tests continue to cover critical business logic using Node built-in `node:test` and `node:assert/strict`. Node.js/npm remain development/testing tools only; production runtime remains static HTML/CSS/vanilla JavaScript + Google Apps Script + Google Sheets + GitHub Pages/PWA.

Use these commands during development:

```bash
npm run check
npm run test
npm run test:integration
npm run test:all
npm run verify
```

- `check` = static validation for JavaScript, Apps Script syntax, JSON, and local static assets.
- `test` / `test:unit` = automated unit business-logic tests.
- `test:integration` = zero-network API/client/router/permission contract tests using mocks and synthetic fixtures.
- `test:all` = unit + integration tests.
- `verify` = `check + test:all`; run before commit/deploy handoff.

On Windows PowerShell, if `npm.ps1` is blocked by Execution Policy, use:

```powershell
npm.cmd run check
npm.cmd run test
npm.cmd run test:integration
npm.cmd run test:all
npm.cmd run verify
```

Node.js/npm ใช้สำหรับ development และ automated static validation เท่านั้น Production runtime ยังเป็น Static HTML/CSS/JavaScript + Google Apps Script + Google Sheets เหมือนเดิม และไม่ต้องใช้ Node.js ในการเปิดใช้งานระบบ

Phase 2 tooling ไม่มี third-party dependencies และไม่ต้องรัน `npm install`

```bash
npm run check
npm run check:js
npm run check:gas
npm run check:json
npm run check:assets
```

หาก PowerShell บน Windows บล็อก `npm.ps1` ด้วย Execution Policy ให้เรียกผ่าน npm command shim แทน:

```powershell
npm.cmd run check
```

2. เอกสารเพิ่มเติมและแผนงานอยู่ในไฟล์:
- [PROJECT_PLAN.md](PROJECT_PLAN.md)
- [DATABASE.md](DATABASE.md)
- [API.md](API.md)
- [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md)
- [CODING_STANDARD.md](CODING_STANDARD.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [SECURITY.md](SECURITY.md)

Current audit/remediation documents are kept at the repository root:

- [FULL_PROJECT_AUDIT.md](FULL_PROJECT_AUDIT.md)
- [RBAC_PERMISSION_AUDIT.md](RBAC_PERMISSION_AUDIT.md)
- [REMEDIATION_PROGRESS.md](REMEDIATION_PROGRESS.md)
- [ACCESSIBILITY_CHECKLIST.md](ACCESSIBILITY_CHECKLIST.md)

## ข้อควรระวัง
- ห้ามแก้ไขโค้ดธุรกิจ (business logic) ใน `js/` หรือ `appscript/` โดยไม่ได้ประสานกับทีม
- ห้ามเปลี่ยน header ของ `DiscountMatrix` ใน Google Sheets
- ทุกฟีเจอร์ใหม่ต้องมี specification ก่อนเขียนโค้ด
- ห้ามเปลี่ยน Google Sheet schema โดยไม่ได้รับอนุมัติ

## โหมดการทำงานของระบบ
- Development Mode: ใช้เฉพาะช่วงพัฒนา มี Demo Login, Debug Log, Test Data สำหรับทดสอบระบบเท่านั้น
- UAT Mode: ใช้ Login จริงและ Google Sheet จริง สำหรับทดสอบก่อนใช้งานจริง
- Production Mode: ไม่มี Demo Login, ไม่มี Debug Menu, ไม่มี Test Data, ต้องใช้ Login จริงเท่านั้น และ Developer Settings ต้องถูกซ่อนทั้งหมด

## กฎ Demo Login
- Demo Login ใช้เฉพาะพี่เกศสำหรับทดสอบระบบระหว่างพัฒนา
- ก่อนขึ้น Production ต้องลบหรือปิด Demo Login ทั้งหมด
- ใช้ตัวแปรควบคุมสภาพแวดล้อม เช่น `APP_ENV = "development"` หรือ `APP_ENV = "production"`

## กฎ DiscountMatrix
- DiscountMatrix เป็นข้อมูลหลักของส่วนลด
- ห้ามเปลี่ยนหัวตาราง
- ห้ามเปลี่ยนชื่อ `groupCode`
- ห้ามเปลี่ยน column รหัสลูกค้า (`customerId`)
- `Products.groupCode` ต้องเชื่อมกับ `DiscountMatrix.groupCode`
- `Customers.customerId` ต้องเชื่อมกับ column `customerId` ใน `DiscountMatrix`

---
*เอกสารนี้เป็นจุดเริ่มต้นสำหรับทีมพัฒนาที่ต้องการทำงานร่วมกันอย่างเป็นระบบ*
