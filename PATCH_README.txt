Saint-Gobain Sales System — Centralized Version Management

Copy files into the project using these paths:

- js/version.js
- js/app.js
- css/main.css
- index.html
- manifest.json
- service-worker.js
- TEST_CASES.md
- WORK_HISTORY.md
- VERSION_MANAGEMENT_REPORT.md

Release updates:
Edit only js/version.js.

Important:
- Keep js/version.js loaded before local CSS/JavaScript asset generation.
- Deploy version.js together with service-worker.js and index.html.
- Runtime browser/PWA testing is still required after deployment.
