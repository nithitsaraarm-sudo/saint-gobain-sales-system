# Coding Standard (มาตรฐานการเขียนโค้ด)

เอกสารนี้ระบุหลักปฏิบัติการเขียนโค้ดสำหรับทีม เพื่อให้โค้ดมีความสอดคล้อง และง่ายต่อการดูแลรักษา

## หลักการทั่วไป
- คงรูปแบบโค้ดที่อ่านได้ง่ายและสม่ำเสมอ
- หลีกเลี่ยงการเปลี่ยนแปลงที่ไม่จำเป็นในไฟล์โค้ดธุรกิจโดยไม่ได้แจ้งทีม
- ทุกไฟล์ใหม่ต้องมาพร้อมกับคำอธิบายสั้น (top-of-file comment) ถ้าจำเป็น
- ทุกฟีเจอร์ใหม่ต้องมี specification ก่อนเขียนโค้ด
- ห้ามเปลี่ยน Google Sheet schema โดยไม่ได้รับอนุมัติจากทีม

## แผนการใช้โหมดพัฒนา (Mode Rules)
- Development Mode: ใช้สำหรับพัฒนาและทดสอบภายในทีมเท่านั้น มี Demo Login, Debug Log, Test Data
- UAT Mode: ใช้ Login จริงและ Google Sheet จริง สำหรับทดสอบก่อน Production
- Production Mode: ไม่มี Demo Login, ไม่มี Debug Menu, ไม่มี Test Data, ต้องใช้ Login จริง และซ่อน Developer Settings
- ต้องมีตัวแปรควบคุม เช่น `APP_ENV = "development"` หรือ `APP_ENV = "production"`

## กฎสำหรับ Demo Login
- Demo Login ใช้เฉพาะพี่เกศสำหรับทดสอบระบบระหว่างพัฒนา
- ก่อนขึ้น Production ต้องลบหรือปิด Demo Login ทั้งหมด
- ไม่อนุญาตให้ Demo Login ถูกปล่อยออกไปใน Production

## กฎสำหรับ DiscountMatrix
- DiscountMatrix เป็นข้อมูลหลักของส่วนลด
- ห้ามเปลี่ยนหัวตาราง
- ห้ามเปลี่ยนชื่อ `groupCode`
- ห้ามเปลี่ยน column รหัสลูกค้า (`customerId`)
- `Products.groupCode` ต้องเชื่อมกับ `DiscountMatrix.groupCode`
- `Customers.customerId` ต้องเชื่อมกับ column `customerId` ใน `DiscountMatrix`
- ถ้าจำเป็นต้องเปลี่ยนโครงสร้างส่วนลด จะต้องมีการอนุมัติและอัปเดตเอกสารก่อน

## JavaScript
- Style: ECMAScript 2019+ (รองรับ modern syntax แต่หลีกเลี่ยงการใช้ฟีเจอร์ที่ไม่รองรับโดย target browsers)
- Indentation: 2 spaces
- ตัวแปร: ใช้ `const` และ `let` เท่านั้น — ห้ามใช้ `var`
- ฟังก์ชัน: ชื่อฟังก์ชันต้องสื่อความหมาย เช่น `renderQuote`, `calculateNetPrice`
- ไม่ใช้ชื่อแค่ตัวอักษรเดียว ยกเว้นใน lambda สั้นๆ
- Export to global: ถ้าจำเป็นสำหรับ `onclick` ใน `index.html` ให้ผูกเป็น `window.<name> = <fn>` และอธิบายใน comment
- Error handling: ทุก async call ต้องมี try/catch และส่ง error กลับ UI
- Linting: ใช้ ESLint (recommended rule set: `eslint:recommended` + airbnb-base rules)

## HTML
- ห้ามแก้โครงสร้าง DOM ที่ระบบคาดหวัง (เช่น id/class ที่โค้ดอ้างถึง)
- ไม่ใช้ inline CSS หรือ inline JS ใหม่โดยไม่จำเป็น

## CSS
- ใช้ตัวแปร CSS สำหรับค่าสีหลักและระยะห่าง
- ข้อความสี/ขนาด font ให้สอดคล้องกับ design tokens

## Google Apps Script (Code.gs)
- แยกฟังก์ชันตามหน้าที่: read, write, validation
- ตรวจสอบ header ของ `DiscountMatrix` ก่อนอ่าน
- ทุก write operation ควรทำการ validate input ก่อน
- บันทึก action สำคัญลง `Audit` sheet (หรือ `DiscountChangeLog`)

## Commit messages
- ใช้ Conventional Commits style: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- ตัวอย่าง: `feat(api): add saveQuotation endpoint`

## Pull Request
- ต้องมีคำอธิบายสั้น, checklist ของการทดสอบ, และ reviewer 1 คน
- หากแก้ไขโค้ดธุรกิจ ต้องระบุ impact และวิธีทดสอบ

---
*เอกสารนี้ควรถูกบังคับใช้ผ่าน CI (lint check) ใน PR pipeline*