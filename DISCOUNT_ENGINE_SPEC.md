# DISCOUNT_ENGINE_SPEC

## 1. Overview
ระบบใบเสนอราคาต้องใช้ DiscountMatrix เป็นแหล่งข้อมูลส่วนลดหลักสำหรับคำนวณราคาสินค้าในแต่ละคำสั่งเสนอราคา โดยอิงจากข้อมูลสองชิ้นหลักคือ Products.groupCode และ Customers.customerId

## 2. DiscountMatrix Rule
- DiscountMatrix เป็นแหล่งข้อมูลส่วนลดหลักและต้องไม่เปลี่ยนโครงสร้างหัวตาราง
- Products.groupCode ใช้ค้นหา row ใน DiscountMatrix
- Customers.customerId ใช้ค้นหา column ใน DiscountMatrix
- ถ้าไม่พบ row/column ที่ตรงกัน ให้ return ส่วนลด 0% และบันทึก warning
- ส่วนลดที่ได้จาก DiscountMatrix คือตัวแปร discountPercent
- ห้ามใช้ข้อมูลจากแหล่งอื่นแทนค่า discountPercent โดยไม่ได้รับอนุญาต

## 3. Data Relationship
- Products: มีข้อมูล groupCode สำหรับระบุกลุ่มสินค้า
- Customers: มีข้อมูล customerId สำหรับระบุลูกค้า
- DiscountMatrix: มีโครงสร้างที่ใช้ groupCode เป็นแถวและ customerId เป็นคอลัมน์
- การเชื่อมโยงต้องเป็นแบบตรงตามค่าที่อยู่ในระบบ ไม่ควรมีการแปลงค่าที่ไม่จำเป็น

## 4. Discount Lookup Flow
1. รับข้อมูลสินค้าและลูกค้าในคำสั่งเสนอราคา
2. ดึง Products.groupCode ของสินค้า
3. ดึง Customers.customerId ของลูกค้า
4. ค้นหา cell ใน DiscountMatrix โดยใช้ groupCode เป็น row key และ customerId เป็น column key
5. ถ้าเจอให้ใช้ค่าความเสี่ยง/ส่วนลดที่ตรงกัน
6. ถ้าไม่เจอให้ใช้ 0% และสร้าง warning log

## 5. Net Price Calculation
- สูตรสำหรับราคาหลังหักส่วนลด:
  - netPrice = listPrice * (1 - discountPercent / 100)
- สำหรับแต่ละรายการสินค้า:
  - amount = qty * netPrice

## 6. VAT Calculation
- VAT คำนวณจาก subtotal ของรายการทั้งหมด
- สูตร:
  - VAT = subtotal * 7%

## 7. Special Discount
- Special Discount ต้องแยกจาก discountPercent
- discountPercent คือส่วนลดจาก DiscountMatrix
- specialDiscount คือค่าลดพิเศษที่เพิ่ม/ลดในคำสั่งเสนอราคาแบบแยกต่างหาก
- ควรเก็บค่า specialDiscount แยกจาก discountPercent เพื่อความชัดเจนและตรวจสอบย้อนหลัง

## 8. Freight / Shipping
- ค่าขนส่งหรือ freight ควรคำนวณแยกต่างหากจากราคาสินค้า
- shipping เป็นค่าที่เพิ่มเข้าไปใน total สุดท้าย
- ต้องไม่ผสมความหมายของ shipping กับส่วนลดจาก DiscountMatrix

## 9. Manual Override
- Manual Override สามารถใช้เพื่อแทนค่า discountPercent หรือ specialDiscount ในกรณีที่ต้องการแก้ไขแบบกำหนดเอง
- ทุกครั้งที่มีการ Override ต้องมี audit log เพื่อบันทึก:
  - ผู้ที่แก้ไข
  - ค่าเดิม
  - ค่าที่แก้เป็น
  - เหตุผล
  - timestamp

## 10. Error Cases
- ไม่พบ Products.groupCode → ใช้ discountPercent = 0% และ warning
- ไม่พบ Customers.customerId → ใช้ discountPercent = 0% และ warning
- ไม่พบ cell ใน DiscountMatrix → ใช้ discountPercent = 0% และ warning
- ค่าความเสี่ยง/ส่วนลดไม่ใช่ตัวเลข → ข้ามและใช้ 0%
- ข้อมูลไม่ครบถ้วน → คืนค่า error หรือยกเลิกการคำนวณตามกรอบระบบ

## 11. Example Cases
### Case 1: พบส่วนลดจาก DiscountMatrix
- listPrice = 1000
- discountPercent = 10%
- netPrice = 1000 * (1 - 10/100) = 900
- amount = qty * 900

### Case 2: ไม่พบส่วนลด
- listPrice = 1000
- discountPercent = 0%
- netPrice = 1000
- amount = qty * 1000

### Case 3: มี specialDiscount และ shipping
- subtotal = 9000
- VAT = 630
- total = 9000 + 630 + shipping - specialDiscount

## 12. Future Improvements
- เพิ่ม validation สำหรับรูปแบบข้อมูลใน DiscountMatrix
- เพิ่ม cache สำหรับ lookup ที่ใช้บ่อย
- เพิ่ม rule engine ที่รองรับเงื่อนไขซับซ้อนมากขึ้น
- เพิ่ม dashboard สำหรับติดตามการ Override และ warning
- เพิ่ม unit test สำหรับกรณี lookup, net price, VAT, และ special discount
