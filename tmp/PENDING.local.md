# ============================================================
# หมายเหตุภายใน (ไม่ขึ้น git) — ทิศทางสินค้า
# เก็บไว้เฉพาะเครื่อง เพื่อไม่ให้ติดไปกับชุดส่งมอบลูกค้า
# ============================================================

## [2026-09-21] แยกส่งมอบ 2 ชุด: Online (subscription) vs Installer (perpetual)

- Context: ระบบถูกวางเป็น 1 โค้ด 2 โมเดล (`PRODUCT_MODE`) แต่การส่งมอบจริงต้องแยกช่องทาง
- Decision: แยกส่วนเป็น 2 ชุดส่งมอบ (ทำภายหลัง)
  1. **ตัวออนไลน์ (subscription)** — ให้เช่ารายเดือน, license มี `expires_at`, quota, `PRODUCT_MODE=subscription`, รันบนคลาวด์ที่พี่ควบคุม
  2. **ตัวติดตั้ง (perpetual)** — ขายขาด, license ไม่หมดอายุ, ส่ง Docker compose (app + postgres) ให้ลูกค้า, ตรวจ offline ผ่าน `MBS_LICENSE_KEY` (ออกด้วย `scripts/issue-license.mjs`)
- ลำดับงานหน้า: (ก) แยก build/config เป็น 2 ชุด (ข) เขียนคู่มือติดตั้ง/ใช้งานแยก (ลูกค้า + ผู้ดูแล)
- Why: ลูกค้าตัวติดตั้งได้แพ็คเกจพร้อมใช้ ไม่พึ่งเซิร์ฟเวอร์กลางพี่; subscription ต้องมีศูนย์กลางออก license/จัดการ quota
- ไฟล์ที่เกี่ยวข้อง: lib/license.ts, lib/license-check.ts, lib/product-mode.ts, Dockerfile, docker-compose.yml, scripts/issue-license.mjs, .env.example, README.md

บันทึกโดย ฌอน ตามคำสั่งพี่ฆัง 2026-09-21 (ยังไม่อัปรายละเอียดขึ้น git จนกว่าพี่สั่ง)