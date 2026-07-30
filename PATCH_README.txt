Saint-Gobain Sales System - Announcement Text Patch

Replace the matching project files with the files in this package:
- app.js
- index.html
- main.css
- Api.gs
- Code.gs
- WORK_HISTORY.md
- TEST_CASES.md

Database migration:
No new sheet column is required. The Settings sheet is key-value based.
On first successful save, a new row with key `announcementText` will be inserted automatically.

Recommended deployment order:
1. Back up the current Apps Script project and web files.
2. Replace Code.gs and Api.gs.
3. Replace app.js, index.html, and main.css.
4. Deploy a new Apps Script web-app version.
5. Clear browser/PWA cache or update the service-worker version if the old assets remain cached.
6. Run the announcement test cases in TEST_CASES.md.
