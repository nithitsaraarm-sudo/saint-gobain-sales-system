# โครงสร้างโฟลเดอร์ (Folder Structure)

โครงสร้างไฟล์ปัจจุบัน (ย่อ) และคำอธิบายการใช้งานของแต่ละโฟลเดอร์/ไฟล์

```text
/ (project root)
├─ index.html
├─ manifest.json
├─ service-worker.js
├─ css/
│  └─ main.css
├─ js/
│  ├─ app.js
│  ├─ auth.js
│  └─ quotation.js
├─ appscript/
│  └─ Code.gs
├─ icons/
├─ images/
└─ *.md (documentation files)
```

## คำอธิบายแต่ละส่วน
- `index.html`: SPA entry point (ต้องอยู่ที่รากโปรเจกต์ เพื่อรองรับ GitHub Pages)
- `css/main.css`: สไตล์ทั้งหมดของแอป (แยกจาก inline)
- `js/*.js`: โค้ดฝั่งไคลเอนต์ แยกตามหน้าที่ (auth, quotation, core app)
- `service-worker.js`: โลจิกสำหรับ caching ของ PWA
- `appscript/Code.gs`: สคริปต์สำหรับเชื่อมต่อ Google Sheets (Apps Script)
- `icons/`, `images/`: static assets
- Markdown files: เอกสารโครงการ

```mermaid
flowchart TB
    subgraph Frontend
      A[index.html]
      B[css/main.css]
      C[js/*.js]
      D[service-worker.js]
    end
    subgraph Backend
      E[Apps Script (Code.gs)]
      F[Google Sheets]
    end
    A --> C
    C --> E
    E --> F
    D -->|caches| A
```

---
*ไฟล์ธุรกิจ (JS/CSS/HTML/Apps Script) ห้ามแก้ไขโดยไม่ได้รับอนุญาตจากทีม*