# Deployment Guide

คำแนะนำการ deploy สำหรับแต่ละส่วนของระบบ: Frontend (GitHub Pages / Static Hosting) และ Backend (Google Apps Script)

## Versioning Policy
- ใช้ Semantic Versioning: `MAJOR.MINOR.PATCH`
- Tag releases ใน Git เช่น `v0.1.0`
- อัปเดต `CHANGELOG.md` ก่อน tag

## Deploy Frontend (GitHub Pages)

### Environment configuration

Frontend runtime configuration is centralized in `js/config.js`.

- `APP_CONFIG.version` is the canonical frontend release version.
- `APP_CONFIG.cacheVersion` must match the release version used by `index.html`, `manifest.json`, and `service-worker.js` cache-busting query strings.
- `APP_CONFIG.environment` supports `development`, `uat`, and `production`.
- `APP_CONFIG.enableDemoLogin` must remain `false` in production.
- `APP_CONFIG.gasWebAppUrl` stores the deployed Google Apps Script Web App URL. This URL is public deployment configuration, not a private credential.

For UAT or production-specific deployments, publish an environment-specific `js/config.js` with the target Apps Script Web App URL and matching release/cache version. Do not store passwords, session tokens, or private API credentials in frontend configuration.

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
