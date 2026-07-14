# Saint-Gobain Sales System - Work History

ไฟล์นี้ใช้เก็บประวัติการทำงานเชิงพัฒนา เพื่อส่งต่อให้ Codex/ผู้พัฒนาคนถัดไปเข้าใจบริบทล่าสุดได้เร็วกว่าอ่าน diff ทั้งหมด

> หมายเหตุ: `CHANGELOG.md` มีอยู่แล้วและเหมาะสำหรับบันทึกการเปลี่ยนแปลงระดับ release ส่วนไฟล์นี้ใช้เป็น working notes / handoff notes ระหว่างพัฒนา

## 2026-07-14 - User role, area, password confirmation, and quotation seller snapshot

### Branch

`feature/user-role-area-permissions`

### Files changed

- `appscript/User.gs`
- `appscript/Auth.gs`
- `appscript/Config.gs`
- `appscript/Database.gs`
- `appscript/Quotation.gs`
- `js/app.js`
- `js/quotation.js`
- `css/main.css`
- `index.html`

### Summary

- Added `area` to Users while keeping legacy `branch` as fallback.
- Added safe Users migration for `branch -> area`, `displayName -> fullName`, and blank `quoteDisplayName -> fullName`.
- Added role hierarchy helpers: `getRoleLevel`, `canManageRole`, `canCreateRole`, and `canEditUserRole`.
- Enforced server-side user management:
  - ADMIN can create/edit only lower roles.
  - ADMIN cannot manage ADMIN or SUPER_ADMIN.
  - SUPER_ADMIN can manage other users including SUPER_ADMIN.
  - Users cannot change their own role/status via `updateUser()`.
  - Last active SUPER_ADMIN cannot be disabled or demoted.
- Added Area scope checks for `loadUsers()`, `createUser()`, and `updateUser()`.
- Added create/update validation for required full name, required Area, confirm password, duplicate email, and password matching.
- Added session revocation when an admin resets password or changes user status away from Active.
- Updated Users UI with Thai labels, Area field, confirm password, show/hide password buttons, role-filtered dropdown, and save-button disabled state.
- Added quotation seller snapshot fields: `quoteDisplayName`, `createdByUserId`, `createdByUsername`, and `updatedByUsername`.
- Quotation preview/PDF/PNG now prefer the `quoteDisplayName` snapshot and fall back to legacy `createdBy`.

### Verification notes

- `git diff --check` passed.
- `node --check` could not run because `node` is not installed in this environment.
- Manual Apps Script deployment and browser testing are still required.

## 2026-07-14 - Quotation reorder, cross-BU quotation, and deployment note

### Branch ล่าสุด

`feature/card-long-press-reordering`

### สถานะ Worktree

มีไฟล์แก้ค้างจากหลายงานก่อนหน้าอยู่ใน worktree จึงควรตรวจ `git status` และแยก commit ตาม scope ก่อน push/merge

### งานล่าสุด: ปรับระบบเรียงลำดับสินค้าในหน้า “ออกใบเสนอราคา”

ไฟล์หลักที่เกี่ยวข้อง:

- `js/quotation.js`
- `css/main.css`
- `appscript/Quotation.gs`
- `appscript/Database.gs`

ทำแล้ว:

- ลบปุ่ม drag handle รูปขีด 3 เส้น `.quote-drag-handle` ออกจาก UI cart
- ใช้ตัวการ์ดสินค้า `.quote-line` เป็นพื้นที่ลากแทน
- ใช้ Pointer Events เดิม ไม่ได้เพิ่ม SortableJS
- Touch device ต้องกดค้างประมาณ `380ms` ก่อนเริ่มลาก
- Desktop ลากด้วย mouse จากพื้นที่ว่างบน card ได้
- ป้องกันไม่ให้เริ่ม drag จาก controls:
  - `button`
  - `input`
  - `select`
  - `textarea`
  - `a`
  - `label`
  - `[data-no-drag]`
- เพิ่ม auto-scroll ระหว่างลากใกล้ขอบจอ
- เพิ่ม visual states:
  - `card--drag-ready`
  - `card--chosen`
  - `card--dragging`
  - `card--ghost`
- เพิ่ม hint ครั้งแรก:
  - “กดค้างที่การ์ดแล้วลากเพื่อเรียงสินค้า”
- เพิ่ม keyboard fallback:
  - focus ที่ card แล้วกด `Alt + ↑/↓`
- หลัง drop จะ update `CART` จริง และ renumber:
  - `lineNo`
  - `lineOrder`
  - `sortOrder`

### การ persist ลำดับสินค้า

- Frontend ส่ง `lineNo`, `lineOrder`, `sortOrder` ใน quotation payload
- Backend เพิ่ม QuoteLines headers:
  - `lineOrder`
  - `sortOrder`
- `saveQuotationPayload()` เขียน `lineOrder/sortOrder`
- `addQuotationItem()` legacy flow เติม `lineNo/lineOrder/sortOrder`
- `loadQuotation()` ฝั่ง Apps Script sort lines ด้วย:
  - `lineOrder || sortOrder || lineNo`
- Quote เก่าที่ไม่มี field ใหม่ fallback จาก `lineNo`/ลำดับแถวเดิม

### งานก่อนหน้า: Cross-BU product search / mixed BU quotation

ไฟล์หลักที่เกี่ยวข้อง:

- `appscript/Product.gs`
- `appscript/Quotation.gs`
- `appscript/Database.gs`
- `appscript/Api.gs`
- `js/api.js`
- `js/app.js`
- `js/quotation.js`
- `css/main.css`

ทำแล้ว:

- ค้นหาสินค้าใน quote ได้ทุก BU
- เรียงสินค้าของ BU หลักก่อน แล้วค่อย BU อื่น
- เพิ่ม `productBusinessUnit` ใน product/quote lines
- QuoteLines เพิ่ม `productBusinessUnit`
- Product picker และ cart แสดง badge Weber/Gyproc
- ถ้าสินค้าคนละ BU แสดง note “สินค้าร่วมข้าม BU”
- ไม่ block การเพิ่มสินค้าข้าม BU แล้ว
- เอกสารแสดง `Business Units: Weber / Gyproc` ถ้ามีสินค้าหลาย BU
- discount cache ฝั่ง browser แยกด้วย:
  - `customerId | productBusinessUnit | groupCode`

### Bug ล่าสุดที่พบ: Apps Script error `window is not defined`

Error:

```text
ReferenceError: window is not defined
Quotation.gs:2230
```

สาเหตุ:

- ใน repo `appscript/Quotation.gs` มีประมาณ 1284 บรรทัดและไม่มี `window`
- เลขบรรทัด `2230` ตรงกับท้ายไฟล์ `js/quotation.js`
- สันนิษฐานว่าไฟล์ frontend `js/quotation.js` ถูก Apps Script parse/รันใน server context หรือถูกคัดลอกขึ้นเป็น `.gs`
- Apps Script server ไม่มี browser global เช่น `window`

แก้แล้วใน `js/quotation.js`:

```js
if (typeof window !== 'undefined') {
  window.renderQuote = renderQuote;
  // ...
}
```

ข้อควรระวัง:

- อย่า copy `js/quotation.js` ไปเป็น Apps Script `.gs` server-side โดยตรง
- Apps Script server ควรมีเฉพาะไฟล์ใน `appscript/*.gs`
- Frontend JS ควรอยู่ฝั่ง static app / GitHub Pages / HTML client เท่านั้น
- ถ้ามี deployment pipeline รวมไฟล์ผิด ต้องแก้ pipeline ไม่ให้ frontend JS ไปอยู่ใน `.gs`

### คำสั่งตรวจสอบที่ใช้บ่อย

```powershell
git status --short
git branch --show-current
git diff --check -- js\quotation.js appscript\Quotation.gs
rg -n "\bwindow\b|document\.|navigator\.|localStorage|html2canvas|jspdf" appscript\Quotation.gs appscript js\quotation.js
rg -n "quote-drag-handle|lineOrder|sortOrder|quote-reorder-hint|touchDelayMs|noDragSelector" js\quotation.js css\main.css appscript\Quotation.gs appscript\Database.gs
```

### Test checklist

Desktop:

- Chrome/Edge ลาก card เพื่อ reorder ได้
- input discount ยังพิมพ์ได้
- ปุ่ม `+/-` ยังทำงาน
- checkbox สินค้าแถมยังทำงาน
- ปุ่มลบยังทำงาน

Mobile:

- แตะสั้นไม่เริ่มลาก
- กดค้างประมาณ `380ms` แล้วลากได้
- scroll หน้ายังทำงาน
- auto-scroll ระหว่างลากได้
- ไม่เกิด pull-to-refresh ระหว่างลาก

Data / Export:

- Save Draft แล้วเปิดกลับมา ลำดับตรง
- Update Quote แล้วลำดับตรง
- Preview / PDF / PNG ใช้ลำดับเดียวกัน
- Quote เก่าเปิดได้
- สินค้า Weber + Gyproc ใน quote เดียวกันยังทำงาน
- ยอดเงินไม่เปลี่ยนจากการ reorder

### หมายเหตุเรื่องไฟล์ประวัติ

- `CHANGELOG.md` = ประวัติการเปลี่ยนแปลงระดับ release
- `WORK_HISTORY.md` = ประวัติการทำงานละเอียดสำหรับ handoff / sync Codex
