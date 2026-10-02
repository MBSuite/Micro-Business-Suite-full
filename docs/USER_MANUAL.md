# 📘 คู่มือการใช้งานระบบ MBSuite (ฉบับละเอียด)
ระบบบัญชีและจัดการภาษีอัจฉริยะสำหรับธุรกิจ SME

---

## 1. ระบบรักษาความปลอดภัย (Security)
ระบบใช้ custom JWT และ `proxy.ts` เป็น session gate:
*   **การเข้าถึง:** request ที่ไม่มี session ที่ตรวจได้จะถูกส่งไป `/login`
*   **การจัดการ Session:** cookie ชื่อ `session-token`; รายละเอียดสิทธิ์ admin/RBAC ต้องตรวจที่ server action หรือ API ที่เกี่ยวข้อง ไม่ใช่อาศัย proxy อย่างเดียว

## 2. ระบบบันทึกบัญชีอัตโนมัติ (Automated Double-Entry)
นี่คือหัวใจของระบบที่ผมพัฒนาขึ้น:
*   **รายได้ (Invoices):** เมื่อมีการสร้างและบันทึกใบแจ้งหนี้ ระบบจะไปลงบันทึกใน **สมุดรายวัน (Journal Entries)** ให้ทันที
    *   *เดบิต:* ลูกหนี้การค้า
    *   *เครดิต:* รายได้ / ภาษีขาย (ถ้ามี)
*   **รายจ่าย (Payment Vouchers):** มี auto-journal ใน code แต่การส่ง WHT จากหน้าสร้าง voucher ยังใช้ field name ไม่ตรงกับ server action จึงต้องตรวจ journal ก่อนถือว่าลงบัญชี WHT แล้ว:
    *   *เดบิต:* ค่าใช้จ่าย / ภาษีซื้อ (ถ้ามี)
    *   *เครดิต:* เงินสด/เงินฝากธนาคาร และ ภาษีหัก ณ ที่จ่าย (WHT)

## 3. การจัดการเอกสารภาษี (Tax & Business Documents)
*   **การเก็บหลักฐาน:** ในหน้า **Payment Vouchers** พี่สามารถจัดเก็บลิงก์รูปถ่ายใบเสร็จหรือไฟล์ PDF (Receipt URL) เพื่อใช้เป็นหลักฐานลดหย่อนภาษีได้
*   **การรายงานภาษี:** มี draft/summary สำหรับช่วยตรวจ ภ.พ.30 และ ภ.ง.ด.53; บางส่วนอ่าน business tables โดยตรง ไม่ใช่แบบยื่น RD และยังต้อง reconcile กับเอกสารต้นทาง

## 4. ระบบสรุปผลรายเดือนลง Google Drive (Monthly Sync)
ปุ่มบน Dashboard เรียก action ที่สร้าง Google spreadsheet แต่ยังไม่พบการเขียนข้อมูลลง sheet ใน action นั้น อย่าใช้เป็นรายงานสรุปที่มีข้อมูลแล้ว

อีกเส้นทางหนึ่งคือ `scripts/dashboard-sheet.mjs` ซึ่ง scheduler เรียกเมื่อ `CRON_ENABLED=true`; script นี้เขียนข้อมูลสรุปลง 3 sheets หลังตั้ง Google credentials สำเร็จ

## 5. วิธีการแก้ไขปัญหาเบื้องต้น (Troubleshooting)
*   **หน้าจอขาว/Error Column:** ปัจจุบันแก้ไขแล้ว (เกิดจากฐานข้อมูลไม่มีคอลัมน์ `created_on` ระบบถูกปรับให้ใช้ `created_at` ทั้งหมดแล้ว)
*   **Build Fail:** ระบบปัจจุบันใช้ `proxy.ts` ไม่ใช่ `middleware.ts`; ตรวจ error จาก build ปัจจุบันและ environment variables ก่อนแก้ตามวิธีเก่า

---
*จัดทำโดย: Antigravity AI*
## Invoice Journal Standard Update

- Invoice journals now follow one display standard across old and new data.
- The receivable account shown in the UI should resolve to `ลูกหนี้การค้าทั่วไป`.
- The VAT line shown in the UI should resolve to `ภาษีขายจากใบแจ้งหนี้ #...`.
- If a historical invoice was posted under an older structure, the system will normalize the display instead of rewriting the original evidence immediately.

## Dashboard Profit Meaning

- `กำไรสุทธิประจำเดือน` on the dashboard is accrual-based.
- This means the system looks at invoices issued in the month, not only invoices already paid.
- Cash movement should be interpreted separately from accounting profit.
