# Deployment Guide

คำแนะนำการ deploy สำหรับแต่ละส่วนของระบบ: Frontend (GitHub Pages / Static Hosting) และ Backend (Google Apps Script)

## Versioning Policy
- ใช้ Semantic Versioning: `MAJOR.MINOR.PATCH`
- Tag releases ใน Git เช่น `v0.1.0`
- อัปเดต `CHANGELOG.md` ก่อน tag

## Deploy Frontend (GitHub Pages)
1. Push code to `main` branch
2. เปิด GitHub Pages ใน repository settings ให้ใช้ branch `main` และ folder `/` (root)
3. เมื่อ push แล้วเว็บจะ live ที่ `https://<org>.github.io/<repo>`

## Local testing

```bash
# เปลี่ยนไปยัง root folder
python -m http.server 8000
# เปิด http://127.0.0.1:8000/
```

## Deploy Apps Script
- เปิด `appscript/Code.gs` ใน Google Apps Script editor
- ทดสอบฟังก์ชันใน editor
- Deploy → New deployment → Web app
- กำหนดการเข้าถึง (Access) ตามความเหมาะสม (เช่น Anyone with link ถ้าจำเป็น) และจด `DEPLOY_ID`
- รวบรวม `DEPLOY_ID` ใน secret หรือ environment ของระบบ (ไม่ควรเก็บใน repo)

## Release checklist
- [ ] Code review ผ่าน
- [ ] Linting ผ่าน
- [ ] Smoke test local ผ่าน
- [ ] CHANGELOG และ tag ถูกสร้าง
- [ ] Backup Google Sheets ก่อน deploy (ถ้ามี migration)

## Rollback
- หากมีปัญหา revert commit บน `main` และ redeploy GitHub Pages
- สำหรับ Apps Script ใช้ previous deployment version ใน editor

---
*หากต้องการ ผมสามารถช่วยสร้าง GitHub Action workflow เบื้องต้นสำหรับ build/lint และ deploy ได้*