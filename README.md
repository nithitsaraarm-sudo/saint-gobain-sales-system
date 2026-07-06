# Saint-Gobain Sales System

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

2. เอกสารเพิ่มเติมและแผนงานอยู่ในไฟล์:
- [PROJECT_PLAN.md](PROJECT_PLAN.md)
- [DATABASE.md](DATABASE.md)
- [API.md](API.md)
- [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md)
- [CODING_STANDARD.md](CODING_STANDARD.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [SECURITY.md](SECURITY.md)

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