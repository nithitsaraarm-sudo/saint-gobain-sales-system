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

---
*ต้องการให้ผมช่วยตั้งค่า CSP ตัวอย่างหรือตัวอย่างการ hash password ใน Apps Script ไหมครับ?*