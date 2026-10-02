# MBSuite: ระบบบัญชีอัจฉริยะ

ระบบจัดการเอกสารธุรกิจและบัญชีสำหรับ SMEs — มี invoice, expenses, journals, reports และส่วนเตรียมข้อมูลภาษี การคำนวณ/รายงานภาษีต้องตรวจสอบกับเอกสารต้นทางและผู้ทำบัญชีก่อนยื่น

---

## ฟีเจอร์หลัก

### ขาย (Sales)
- ใบเสนอราคา (Quotation) พร้อมหน้าพิมพ์/Preview
- ใบแจ้งหนี้ (Invoice) พร้อมหน้าพิมพ์ + AI Auto-Journal (บันทึกเดบิต/เครดิตอัตโนมัติเมื่อออกบิล)
- รอบบิลอัตโนมัติ (Recurring) — สร้างใบแจ้งหนี้จากรอบที่ตั้งไว้
- ใบเสร็จรับเงิน (Receipt) — **พิมพ์ใบเสร็จ/ใบกำกับภาษีแบบเดียว** (RECEIPT / TAX INVOICE) จากทุกจุดเข้ารายการ

### ค่าใช้จ่ายและบัญชี (Operations)
- ค่าใช้จ่าย / ซัพพลายเออร์ พร้อมแนบหลักฐาน (รูป / ลิงก์ Google Drive)
- ค่าแรงพนักงาน (Payroll) พร้อมระบบตรวจสอบความถูกต้อง (มี automated tests)
- ใบสำคัญจ่าย (Voucher) + พิมพ์เอกสารสรุปยอดปลายเดือน
- สมุดรายวัน (Journal) — ระบบจดบัญชีอัตโนมัติ + ทะเบียนภาษี

### ข้อมูลหลัก (Master Data)
- คลังสินค้า (Inventory) พร้อม **QR Code + Barcode** ต่อสินค้า
- ราคากลางบริการ (Services)
- ผังบัญชี (COA)
- ผู้ติดต่อ / คู่ค้า (Contacts)

### รายงานและภาษี (Reports & Tax)
- รายงาน/summary ภาษี VAT, WHT และ ภ.พ.36 เพื่อช่วยเตรียมข้อมูล; ไม่ใช่การยื่นแบบหรือไฟล์ RD โดยตรง
- มี RD API client บางเส้นทาง แต่ยังไม่ยืนยันการทำงาน end-to-end กับ production; batch submit ปัจจุบันเป็น stub
- งบกำไรขาดทุน (P&L)

### AI และระบบอัตโนมัติ
- ผู้ช่วย AI ถาม-ตอบด้านบัญชี (`/ai`) + AI Chat ทั่วแอพ
- **AI Auditor** — ตรวจสอบความผิดปกติของข้อมูลและกระเปาะแจ้งเตือน + job รายงานอัตโนมัติ (`npm run ai:audit`)
- **Tax Automator** — มี helper/job สำหรับตรวจและสรุปบางกรณี (`pnpm tax:update`); ไม่ถือเป็นการรับรองผลภาษี

### คลาวด์ & ระบบอัตโนมัติ Google (Google-First)
- ปุ่มสรุปบน Dashboard สร้าง Google Sheet แต่ action ปัจจุบันยังไม่เติมข้อมูลลงใน sheet
- เมื่อเปิด `CRON_ENABLED=true` บน Node process ที่ทำงานต่อเนื่อง จะเรียก backup เวลา 02:00 และ `dashboard-sheet` เวลา 02:05
- `scripts/dashboard-sheet.mjs` เขียนสรุปลง 3 sheets; ยังต้องทดสอบ credentials, schedule และ restore ใน environment จริง
- มีหน้า Calendar; การสร้าง/ส่ง reminder ผ่าน Google ยังต้องตั้งค่าและทดสอบ end-to-end ก่อนถือว่าใช้งานอัตโนมัติได้

### การจัดการ (Admin)
- จัดการสมาชิก / บทบาท (RBAC) ตาม `docs/RBAC_STANDARD.md`
- จัดการกลุ่ม / สิทธิ์เข้าถึงรายโมดูล
- เปิด-ปิดโมดูลได้ (ตั้งค่าผ่านหน้า /admin/modules หรือ env `NEXT_PUBLIC_MODULE_*`)
- Database Backup

---

## เริ่มใช้งาน

1. หน้าแรก (Dashboard) — ภาพรวมสุขภาพการเงิน
2. ออกเอกสาร: ใบเสนอราคา → ใบแจ้งหนี้ → รับชำระ (ใบเสร็จ/ใบกำกับภาษี)
3. ตรวจสอบรายงานเดือนจากฐานข้อมูลและเอกสารต้นทาง; อย่าใช้ปุ่ม Google Sheet เป็นรายงานที่กรอกข้อมูลแล้วจนกว่าจะมีการยืนยันการเติมข้อมูล

## ขั้นตอนติดตั้ง

```
pnpm install
cp .env.example .env.local
# ตั้ง DATABASE_URL, NEXTAUTH_URL และ NEXTAUTH_SECRET/AUTH_SECRET
pnpm dev
```

Scripts ที่ใช้ได้: `pnpm test` (รันเฉพาะ `tests/**/*.test.mjs`), `pnpm lint`, `pnpm tax:update`, `pnpm ai:audit`, `pnpm check:knowledge`, `pnpm check:consistency`. ปัจจุบัน `pnpm test` ไม่รัน `tests/taxAutomator.test.ts`.

การตั้ง cron ในเครื่อง production ต้องยืนยันจาก environment ของเครื่องนั้น; ในแอปมี scheduler เมื่อเปิด `CRON_ENABLED=true`.

---

## ส่งมอบแบบ Docker (ขายขาด / ติดตั้งให้ลูกค้า)

```bash
cp .env.example .env.local

# 1) ออก license ให้ลูกค้า (ฝั่งผู้ขาย — sign ด้วย LICENSE_SALT ตัวเดียวกับฝั่ง app)
node scripts/issue-license.mjs \
  --mode perpetual --company "ชื่อลูกค้า" --licensee "อีเมลลูกค้า" \
  --max-users 5

# 2) ใส่ค่าจริงใน .env.local (ของเครื่องลูกค้า):
#    LICENSE_SALT   = salt เดียวกับฝั่งผู้ขาย
#    MBS_LICENSE_KEY = license key ที่ออกให้ลูกค้ารายนี้
#    BILLING_DATABASE_URL = postgresql://USER:PASS@HOST:5432/DB?sslmode=disable
#    NEXTAUTH_SECRET / AUTH_SECRET = random secret
# 3) Compose ปัจจุบันไม่มี DB service; ต้องมี external network stack_stack และ PostgreSQL ที่เข้าถึงได้
#    เตรียม schema/migrations ตาม deployment runbook ก่อนเริ่มแอป
docker compose up -d --build
```

- Compose ปัจจุบัน bind `127.0.0.1:3001:3000`; เปิดจากเครื่อง host ที่ `http://127.0.0.1:3001` และเข้าจากภายนอกผ่าน proxy ที่ตั้งค่าไว้
- ผู้ใช้คนแรกบนฐาน users ว่างจะได้ `superadmin/Active`; ผู้สมัครถัดไปเป็น `user/Pending` และต้องรอ admin อนุมัติ ไม่ต้องกด `/register/promote`
- **license lock:** production ต้องมี `LICENSE_SALT` และ `MBS_LICENSE_KEY` ทั้ง perpetual และ subscription; subscription ต้องมีวันหมดอายุ ส่วน perpetual ไม่จำเป็นต้องมีวันหมดอายุ
- โหมดการขาย: `PRODUCT_MODE=perpetual` (ขายขาด) หรือ `PRODUCT_MODE=subscription` (เช่า รายเดือน)

---

## เทคนิค

- **Stack:** Next.js 16 (App Router) + React 19 + TypeScript 5
- **UI:** Tailwind CSS 4 + lucide-react
- **ฐานข้อมูล:** PostgreSQL ผ่าน `pg` (`lib/db.ts`)
- **เอกสาร PDF:** jspdf / jspdf-autotable / exceljs · **Barcode/QR:** react-barcode / qrcode.react
- **จ็อบเบื้องหลัง:** node-cron (recurring, tax, ai-audit)
- **Integration:** googleapis (Drive / Sheets / Calendar) — อ่าน OAuth จาก `.env.local` ผ่าน `scripts/google-auth.mjs`

---

## เอกสารอ้างอิง

- กฎระบบหลัก: `CORE_RULES.md`, `AUTH_RULES.md`
- มาตรฐานสิทธิ์: `docs/RBAC_STANDARD.md`
- คู่มือใช้งาน: `docs/USER_MANUAL.md`, `docs/COMPLETE_MANUAL.md`
- เอกสารรวมสถานะและข้อจำกัดจาก code: `docs/MICRO-BUSINESS-SUITE-DOCUMENTATION.md` (snapshot; canonical rules อยู่ในไฟล์กฎด้านล่าง)
- ความรู้ทางภาษี: `docs/THAI_TAX_GUIDE.md`, `docs/KNOWLEDGE_PACK.md`
- สถาปัตยกรรม: `docs/ARCHITECTURE.md`
- บันทึกการตัดสินใจ: `docs/DECISIONS.md`