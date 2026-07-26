# TEST CASES — Saint-Gobain Sales System

วันที่จัดทำ: 2026-07-26
สถานะ: Manual regression baseline สำหรับรอบ audit remediation
อ้างอิงเพิ่มเติม: `RELEASE_READINESS.md`, `REMEDIATION_PROGRESS.md`, `ACCESSIBILITY_CHECKLIST.md`

## Test Environment

ให้ทดสอบอย่างน้อยบน environment ต่อไปนี้ก่อน deploy production:

- Desktop Chrome / Edge: 1366x768
- Android Chrome: 360x800
- iPhone Safari: 375x667 และ 390x844
- PWA Standalone Mode
- Google Apps Script deployment จริง
- Google Sheets data จริงหรือ UAT copy

## Test Data Roles

ต้องมี user สำหรับแต่ละ role:

- SUPER_ADMIN
- ADMIN
- MANAGER
- SALES area A
- SALES area B
- VIEWER

ต้องมีข้อมูลตัวอย่าง:

- Customer area A อย่างน้อย 2 ร้าน
- Customer area B อย่างน้อย 2 ร้าน
- Customer inactive อย่างน้อย 1 ร้าน
- Product Weber อย่างน้อย 2 รายการ
- Product Gyproc อย่างน้อย 2 รายการ
- Product exact duplicate อย่างน้อย 1 ชุด ถ้ามีการทดสอบ dedupe
- Quotation เก่า format เดิม `QT-...`
- Quotation ใหม่ format ปัจจุบัน

## 1. Authentication and Session

| ID | Test Case | Steps | Expected Result | Priority |
|---|---|---|---|---|
| AUTH-001 | Login สำเร็จ | Login ด้วย user ที่ active | เข้าระบบได้, แสดงชื่อ/role ถูกต้อง | P0 |
| AUTH-002 | Login ผิดรหัส | Login ด้วย password ผิด | ระบบปฏิเสธและแสดง error | P0 |
| AUTH-003 | Logout | กด Logout จาก header | session ถูกล้างและกลับหน้า login | P0 |
| AUTH-004 | Settings Logout text | ไป Settings > Account & Security | ปุ่มยังแสดงข้อความ `ออกจากระบบ` | P1 |
| AUTH-005 | Private cache after logout/login | Login user A, logout, login user B | ไม่เห็น cache/private data ของ user A | P0 |
| AUTH-006 | Change password | เปลี่ยนรหัสผ่านด้วย current password ถูกต้อง | password เปลี่ยนสำเร็จและ login ใหม่ได้ | P1 |

## 2. RBAC and Route Guards

| ID | Test Case | Steps | Expected Result | Priority |
|---|---|---|---|---|
| RBAC-001 | SUPER_ADMIN menu | Login SUPER_ADMIN | เห็นทุกเมนูที่ควรจัดการได้ | P0 |
| RBAC-002 | ADMIN menu | Login ADMIN | เห็นเมนูจัดการตามสิทธิ์ แต่ไม่เห็น SUPER_ADMIN-only settings | P0 |
| RBAC-003 | MANAGER read-only policy | Login MANAGER | เห็น Dashboard, Customers scoped, Quote History, Reports, Settings profile; ไม่สามารถ create/edit quote | P0 |
| RBAC-004 | SALES policy | Login SALES | เห็นข้อมูลเฉพาะ scope และสร้างใบเสนอราคาได้ตามสิทธิ์ | P0 |
| RBAC-005 | VIEWER read-only | Login VIEWER | เห็นข้อมูล read-only, ไม่มีปุ่ม create/edit/cancel | P0 |
| RBAC-006 | Direct route blocked | พยายามเปิด route ที่ role ไม่มีสิทธิ์ผ่าน URL/hash | ถูก redirect หรือถูกปฏิเสธตาม guard | P0 |

## 3. Customer Area and Scope

| ID | Test Case | Steps | Expected Result | Priority |
|---|---|---|---|---|
| CUST-001 | SUPER_ADMIN sees all areas | Login SUPER_ADMIN แล้วเปิด Customers | เห็นร้านค้าทุก area | P0 |
| CUST-002 | SALES area isolation | Login SALES area A | เห็นเฉพาะร้าน area A | P0 |
| CUST-003 | Search does not leak area | SALES area A search customer area B | ไม่เจอร้าน area B | P0 |
| CUST-004 | Customer detail scope | SALES area A เปิด customerId area B โดยตรง | API/UI ปฏิเสธ | P0 |
| CUST-005 | Add customer | ADMIN/SUPER_ADMIN เพิ่มร้านค้าใหม่พร้อม salesArea/brand | บันทึกสำเร็จและแสดงบน card ถูกต้อง | P1 |
| CUST-006 | Edit customer | แก้ salesArea, assigned sales, Weber/Gyproc flags | บันทึกและโหลดกลับถูกต้อง | P1 |
| CUST-007 | Inactive customer | ตั้งร้าน inactive | ไม่แสดงใน active customer list | P1 |

## 4. Favorite Customers

| ID | Test Case | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FAVC-001 | Add favorite in scope | SALES ปักร้านใน area ตัวเอง | เพิ่มสำเร็จ | P1 |
| FAVC-002 | Add favorite out of scope | SALES พยายามปักร้านนอก area | ถูกปฏิเสธ | P0 |
| FAVC-003 | Favorite max limit | เพิ่มเกิน 5 ร้าน | ระบบปฏิเสธรายการที่เกิน | P1 |
| FAVC-004 | Reorder favorites | จัดลำดับ favorite | ลำดับใหม่ถูกบันทึก | P1 |
| FAVC-005 | Favorite after scope change | เปลี่ยน area ร้านแล้ว reload | Favorite นอก scope ไม่ถูกแสดง | P0 |

## 5. Products and Product Cards

| ID | Test Case | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PROD-001 | View products by allowed role | Login role ที่มีสิทธิ์ดู Products | แสดงสินค้าได้ | P1 |
| PROD-002 | Product card exact duplicate | มี exact duplicate ใน sheet | แสดง card เพียง 1 รายการสำหรับ exact duplicate | P1 |
| PROD-003 | Same code/name different price | มีสินค้า code/name เดียวกันแต่ price ต่าง | แสดงแยก card | P1 |
| PROD-004 | Same code/name/price different unit | มี unit ต่าง | แสดงแยก card | P1 |
| PROD-005 | Same code different brand | Weber/Gyproc code เดียวกัน | แสดงแยก card | P1 |
| PROD-006 | Product search/filter | ค้นหา SKU/name/brand | ผลลัพธ์ถูกต้องและไม่ซ้ำผิดปกติ | P1 |
| PROD-007 | Product calculator from selected card | เปิด calculator จาก card ที่เลือก | ใช้ product record/price/unit ของ card นั้นจริง | P0 |

## 6. Product Favorites and Pinned Products

| ID | Test Case | Steps | Expected Result | Priority |
|---|---|---|---|---|
| FAVP-001 | Add favorite product | ปัก favorite product | เพิ่มสำเร็จและแสดงใน quotation picker | P1 |
| FAVP-002 | Add pinned product | ปัก pinned product | เพิ่มสำเร็จและอยู่ใน pinned section | P1 |
| FAVP-003 | Reorder pinned products | drag/reorder pinned | ลำดับถูกบันทึก | P1 |
| FAVP-004 | Max pinned products | เพิ่มเกิน 5 pinned | ระบบปฏิเสธรายการเกิน | P1 |
| FAVP-005 | Max favorite products | เพิ่มเกิน 20 favorite | ระบบปฏิเสธรายการเกิน | P1 |

## 7. Promotions

| ID | Test Case | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PROMO-001 | View promotions | เปิดหน้า Promotions | แสดง promotion active ได้ | P1 |
| PROMO-002 | Save promotion | ADMIN/SUPER_ADMIN เพิ่ม promotion | บันทึกลง backend จริง ไม่ใช่ stub success | P0 |
| PROMO-003 | Duplicate promotion validation | เพิ่ม promotion ซ้ำ exact | ระบบป้องกัน duplicate ตาม validation | P1 |
| PROMO-004 | Unauthorized save promotion | Role ไม่มีสิทธิ์ save promotion | API ปฏิเสธ | P0 |
| PROMO-005 | Promotion card on product | Product ที่มี promo | แสดง promotion detail/teaser ถูกต้อง | P1 |

## 8. Quotation Workflow

| ID | Test Case | Steps | Expected Result | Priority |
|---|---|---|---|---|
| QUOTE-001 | Create quotation Weber only | เลือก Weber และเพิ่ม Weber products | สร้าง/save ได้ตาม business logic | P0 |
| QUOTE-002 | Create quotation Gyproc only | เลือก Gyproc และเพิ่ม Gyproc products | สร้าง/save ได้ตาม business logic | P0 |
| QUOTE-003 | Create mixed brand quotation | เพิ่ม Weber และ Gyproc ถ้าระบบรองรับ mixed | Prefix/BU/logic ถูกต้องตาม requirement ปัจจุบัน | P0 |
| QUOTE-004 | Select customer in scope | SALES เลือกร้านใน area | เลือกได้และสร้าง quotation ได้ | P0 |
| QUOTE-005 | Select customer out of scope | SALES พยายามเลือกร้านนอก area | API/UI ปฏิเสธ | P0 |
| QUOTE-006 | Add product to cart | เพิ่มสินค้า | line item ถูกต้อง qty/price/unit/discount | P0 |
| QUOTE-007 | Edit quantity | กด +/− และกรอก qty | totals คำนวณใหม่ถูกต้อง | P0 |
| QUOTE-008 | Edit discount | เปลี่ยน discount | totals/VAT/grand total ถูกต้อง | P0 |
| QUOTE-009 | Free item | ตั้ง free item ถ้ามี UI | line total/VAT/grand total เป็น 0 | P1 |
| QUOTE-010 | Save quotation | กด save | ได้ quoteNo/quoteId และโหลดกลับได้ | P0 |
| QUOTE-011 | Duplicate quotation | Duplicate จาก history/detail | สร้าง quotation ใหม่พร้อมรายการเดิม | P1 |
| QUOTE-012 | Cancel quotation | Role ที่มีสิทธิ์ cancel | status เป็น CANCELLED และแก้ต่อไม่ได้ | P0 |
| QUOTE-013 | Old quotation compatibility | เปิด quote เก่า `QT-...` | เปิด/preview/print/export ได้ | P0 |
| QUOTE-014 | Concurrent save | Save พร้อมกันหลาย user | ไม่เกิด duplicate quoteNo | P0 |
| QUOTE-015 | Load quotation cache permission | User นอก scope load quote ที่เคย cache | ถูกปฏิเสธ ไม่คืน cached data | P0 |

## 9. Quotation History, Preview, Export

| ID | Test Case | Steps | Expected Result | Priority |
|---|---|---|---|---|
| QHIST-001 | History list by role | เปิด Quote History ตาม role | รายการตรง scope/ownership policy | P0 |
| QHIST-002 | Search history | ค้นหา quoteNo/customer/status | ไม่รั่ว scope | P0 |
| QHIST-003 | Detail modal | เปิดรายละเอียด | modal แสดงข้อมูลและปุ่มตามสิทธิ์ | P1 |
| QHIST-004 | Print | Print quotation | preview/print layout ถูกต้อง | P1 |
| QHIST-005 | Export PDF | Save PDF | ได้ PDF ถูกต้อง | P1 |
| QHIST-006 | Export PNG | Save PNG | ได้ PNG ถูกต้อง | P1 |
| QHIST-007 | Share | Share quotation | ใช้ flow เดิมและไม่ expose token | P1 |

## 10. Profile Image

| ID | Test Case | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PROF-001 | Upload profile image desktop | เลือกรูปจาก desktop | preview แสดง, save สำเร็จ | P1 |
| PROF-002 | Upload profile image mobile | เลือกรูปจาก iPhone/Android | preview แสดง, save สำเร็จ | P1 |
| PROF-003 | Persist after refresh | Save แล้ว refresh | รูปยังแสดง | P1 |
| PROF-004 | Persist after logout/login | Save, logout, login ใหม่ | รูปยังแสดง | P1 |
| PROF-005 | Persist after PWA reopen | ปิดเปิด PWA | รูปยังแสดง | P1 |
| PROF-006 | Invalid image URL fallback | ใส่ URL รูปเสีย | แสดง default avatar ไม่มี broken-image loop | P1 |
| PROF-007 | Legacy image fields | ใช้ legacy field เช่น `photoUrl` ถ้ามี | ยัง fallback/read ได้ | P2 |

## 11. PWA and Cache

| ID | Test Case | Steps | Expected Result | Priority |
|---|---|---|---|---|
| PWA-001 | Install/open PWA | ติดตั้งและเปิด standalone | UI ทำงานและ safe area ไม่บังปุ่ม | P1 |
| PWA-002 | Static asset cache version | deploy version ใหม่ | asset refresh ตาม version `0.5.25` | P1 |
| PWA-003 | API not cached by SW | เรียก API แล้ว offline/retry | SW ไม่คืน API stale response | P0 |
| PWA-004 | Offline navigation fallback | Offline แล้วเปิด app shell | แสดง fallback navigation เท่านั้น | P2 |
| PWA-005 | Private cache scope | สลับ user บนอุปกรณ์เดียวกัน | ไม่เห็นข้อมูล private ของ user ก่อนหน้า | P0 |

## 12. Security Regression

| ID | Test Case | Steps | Expected Result | Priority |
|---|---|---|---|---|
| SEC-001 | Discount scope | User query discount customer นอก scope | API ปฏิเสธ | P0 |
| SEC-002 | POST authenticated API | เรียก action authenticated | ไม่ส่ง session token ผ่าน JSONP URL | P0 |
| SEC-003 | Public settings JSONP | โหลด public system settings ก่อน login | ยังโหลดได้ | P1 |
| SEC-004 | CDN SRI | เปิด app | external scripts load พร้อม integrity/crossorigin | P1 |
| SEC-005 | HTML escaping smoke | ใส่ข้อมูลที่มี `<script>` ใน allowed text field บน UAT | UI แสดงเป็น text ไม่ execute | P0 |
| SEC-006 | Backend permission canonical | ยิง API ที่ไม่มีสิทธิ์โดยตรง | backend ปฏิเสธ แม้ frontend ซ่อนปุ่มแล้ว | P0 |

## 13. Accessibility and Mobile UX

ดู checklist เต็มใน `ACCESSIBILITY_CHECKLIST.md`

| ID | Test Case | Steps | Expected Result | Priority |
|---|---|---|---|---|
| A11Y-001 | Keyboard focus visible | Tab ผ่านปุ่มหลัก | focus ring เห็นชัด | P1 |
| A11Y-002 | Buttons are non-submit by default | กด Enter/Space ใน forms/modals | ไม่เกิด submit แปลก ๆ หรือ double action | P1 |
| A11Y-003 | Dialog semantics | เปิด modals หลัก | มี role/label และ screen reader อ่านได้ | P1 |
| A11Y-004 | Toast live region | Trigger toast | screen reader รับ status polite | P2 |
| A11Y-005 | Customer modal mobile | เปิด add/edit customer บนมือถือ | header/footer เห็น, body scroll ได้ | P0 |
| A11Y-006 | Quotation responsive | เปิด quote page 320/375/390px | ไม่มี horizontal overflow | P0 |
| A11Y-007 | iPhone Safari keyboard | focus input ใน modal/quote page | scroll ไป field ที่ focus ได้ | P1 |

## 14. Release Readiness

| ID | Test Case | Steps | Expected Result | Priority |
|---|---|---|---|---|
| REL-001 | Apps Script copy order | ตรวจ `appscript/README_APPSCRIPT.md` | copy order ตรงไฟล์ backend ปัจจุบัน | P0 |
| REL-002 | Deployment config | ตรวจ `js/config.js` สำหรับ target env | URL/version ถูกต้อง ไม่มี secret | P0 |
| REL-003 | Smoke test all roles | Login ทุก role | เมนู/API/ข้อมูลตรง RBAC | P0 |
| REL-004 | Rollback dry run plan | ตรวจ commit hash per phase | revert ได้เป็น phase โดยไม่ reset repo | P1 |
| REL-005 | Readiness docs | เปิด `RELEASE_READINESS.md` | มี validation, risk, manual tests, rollback | P1 |

## Notes

- Repository ยังไม่มี automated test runner (`package.json`, Jest/Vitest/Playwright) ในรอบ audit นี้
- ถ้าเพิ่ม test automation ในอนาคต ให้ใช้ไฟล์นี้เป็น baseline สำหรับสร้าง automated regression suite
- ห้ามถือว่า hidden button เป็น security control; backend authorization ต้องเป็นตัวตัดสินเสมอ
