# MBSuite — เอกสารรวมระบบ (Consolidated Documentation)

> **รวมเอกสารระบบและคู่มือไว้ไฟล์เดียว** · ตรวจ source ณ 2 ต.ค. 2026
> เป็น static review ไม่ใช่การทดสอบ production หรือการรับรองข้อกฎหมายภาษี ข้อความที่ยังไม่ยืนยันจะระบุไว้ตรง ๆ
> ภาคผนวกชี้ไปยังเอกสารต้นทาง; ไม่ได้คัดลอกหรือแทนที่ไฟล์เหล่านั้น

---

## สารบัญ

1. [แนวคิด + ปัญหาที่ระบบแก้](#1-แนวคิด--ปัญหาที่ระบบแก้)
2. [กระบวนการทำงาน](#2-กระบวนการทำงาน)
3. [วิธีใช้งาน ฝั่งผู้ใช้](#3-วิธีใช้งาน-ฝั่งผู้ใช้)
4. [วิธีใช้งาน ฝั่ง admin](#4-วิธีใช้งาน-ฝั่ง-admin)
5. [การติดตั้ง](#5-การติดตั้ง)
6. [ขั้นตอนการทำงานของ code](#6-ขั้นตอนการทำงานของ-code)
7. [รายงานการแก้ไข แต่ละ version](#7-รายงานการแก้ไข-แต่ละ-version)
8. [ภาคผนวก — เอกสารเดิม](#8-ภาคผนวก--เอกสารเดิม)

---

## 1. แนวคิด + ปัญหาที่ระบบแก้

### 1.1 แนวคิดหลัก

**MBSuite** (เดิมชื่อ Micro-Account) คือระบบบริหารจัดการบัญชีและภาษีอัตโนมัติสำหรับ SMEs ไทย

แนวคิดที่ยึดในการออกแบบ (อ่านจาก `lib/journaling.ts`, `docs/ARCHITECTURE.md`, `CORE_RULES.md`):

| แนวคิด | รายละเอียด | หลักฐานในโค้ด |
|---|---|---|
| **Journal เป็นหลักฐานบัญชีสำคัญ** | ระบบสร้าง journal จากเอกสารบางประเภท แต่รายงานบางส่วนยังอ่าน `invoices`/`expenses` โดยตรง จึงยังยืนยันไม่ได้ว่า journal เป็น single source of truth ทั้งระบบ | `lib/journaling.ts`, `app/actions/tax-reports.ts` |
| **รูปแบบ double-entry** | แถว journal เก็บ debit account, credit account และ amount; ยังไม่มีหลักฐานว่าทุก workflow ตรวจความครบถ้วน/ความสมดุลข้ามหลายแถวได้ครอบคลุม | `lib/journaling.ts` และ server actions ที่เรียกใช้ |
| **ทะเบียนภาษีแยกจากบัญชี** | VAT/WHT เก็บเป็นบัญชีเฉพาะ (2121, 1140, 2130) ไม่ปนกับรายได้/ค่าใช้จ่าย | `lib/journaling.ts:22-28` |
| **RBAC แบบกลุ่ม** | สิทธิ์มาจาก `groups` → `group_permissions` → `user_groups` ไม่ใช่การผูกตรงกับ role | `lib/permissions.ts:40-138` |
| **Google-First** | ส่งออก/สำรองข้อมูลผ่าน Google Drive + Sheets แทนการสร้างระบบ cloud เอง | `scripts/auto-backup.mjs`, `scripts/dashboard-sheet.mjs` |
| **Offline license ไม่ต้องมีเซิร์ฟเวอร์กลาง** | ตรวจ license ในเครื่องด้วย HMAC-SHA256 + `LICENSE_SALT` | `lib/license.ts:54-125` |
| **1 โค้ด 2 โมเดลส่งมอบ** | `PRODUCT_MODE=perpetual` (ขายขาด) หรือ `subscription` (เช่ารายเดือน) | `lib/product-mode.ts:11-14` |

### 1.2 ปัญหาที่ระบบนี้แก้ให้ลูกค้า

จาก feature ที่มีจริงในโค้ด ระบบแก้ปัญหาเหล่านี้:

**ปัญหา 1: ธุรกิจ SME ไม่มีนักบัญชีประจำ**
- ต้นทุนจ้างนักบัญชีเดือนละ 10,000–30,000 บาท สำหรับรายได้ไม่กี่แสน
- MBSuite แทนที่ด้วย auto-journaling: ออกใบแจ้งหนี้ → ระบบลงเดบิต/เครดิตให้เอง (`lib/journaling.ts:338-387`)

**ปัญหา 2: ภาษีเป็นงานที่ต้องตรวจหลักฐานและจำแนกให้ถูก**
- `lib/taxAutomator.ts` มี helper สำหรับตรวจ VAT, คำนวณ WHT และสร้างคำเตือน แต่การตรวจครั้งนี้ไม่พบการเรียก `InputTaxValidator` จาก expense UI/action จึงห้ามสรุปว่า validation ทำงานอัตโนมัติใน workflow บันทึกค่าใช้จ่าย
- `WithholdingTaxEngine` มีอัตราตาม service type แต่เส้นทางอื่นกำหนด WHT แยกกัน และ `lib/rd-api.ts` hardcode 5% ในการส่ง WHT; นโยบายอัตรายังไม่สอดคล้องกัน
- หน้า tax report แสดง draft/summary ไม่ใช่หลักฐานว่ายอดถูกต้องตามกฎหมายหรือพร้อมยื่น ดู `app/actions/tax-reports.ts` และให้ผู้ทำบัญชีตรวจหลักฐานก่อนยื่น

**ปัญหา 3: ตั้งระบบให้ลูกค้าใช้เองไม่ได้ (สำคัญที่สุดสำหรับคุณพี่ฆัง)**
- ปัญหา: ซอฟต์แวร์ SME ต้องติดตั้งเอง + ออก invoice ถูกต้อง + สำรองข้อมูลเอง
- MBSuite แก้ด้วย:
  - **ติดตั้งครั้งเดียว** — `docker compose up -d --build` (`docker-compose.yml`)
  - **License ออกให้เองได้** — `node scripts/issue-license.mjs --mode perpetual --company "X"` (`lib/license.ts:74-78`)
- **สำรองข้อมูลอัตโนมัติ** — มี script และ cron registration เมื่อ `CRON_ENABLED=true`; ต้องกำหนด credentials/สภาพแวดล้อมและทดสอบ restore เอง
- **Dashboard บน Google Sheets** — scheduled `scripts/dashboard-sheet.mjs` เขียนข้อมูลลง 3 sheets; ปุ่มหน้า Dashboard ใช้อีก action ซึ่งปัจจุบันสร้าง spreadsheet แต่ไม่ได้เติมข้อมูล

**ปัญหา 4: ซื้อขายเป็นรายเอกสาร → ต้องทำบัญชีเอง**
- ระบบมีโมดูล Hosting เพิ่มใหม่ (`app/hosting/plans/`, `app/hosting/subscriptions/`) — จัดการสัญญาเช่าและออก invoice อัตโนมัติ

### 1.3 สิ่งที่ระบบยัง**ไม่**ได้ทำ (ตามความจริงจากโค้ด)

| ยังไม่มี | หลักฐาน |
|---|---|
| ยืนยันการยื่นภาษีผ่าน RD แบบ end-to-end | มี client ที่ส่ง request ไปยัง `baseUrl` ที่ตั้งค่าได้ แต่ไม่พบการยืนยันกับ RD production; batch submit เป็น stub และไฟล์ export ระบุว่าเป็น summary ไม่ใช่ format ยื่น |
| เข้ารหัส backup ก่อนส่ง Drive | `scripts/auto-backup.mjs:97` — `zlib.gzipSync` แล้วอัปโลดตรง ไม่มี encryption |
| Multi-company (หลายบริษัทใน 1 ระบบ) | `lib/license-check.ts:69` กำหนด `max_companies: 1` ตายตัว |
| GitHub Actions workflow | ไม่พบ `.github/workflows`; ยังสรุปไม่ได้ว่าไม่มี CI จากผู้ให้บริการอื่น |
| Restore script สำหรับ backup | ค้น `restore|decrypt` ใน `scripts/` แล้ว ไม่พบ script กู้คืน |

---

## 2. กระบวนการทำงาน

### 2.1 ภาพรวม 5 ชั้น

```
┌─────────────────────────────────────────────────────────┐
│  UI (React Server/Client Components)                    │
│  app/**/page.tsx, components/*.tsx                       │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  GATE: proxy.ts (ทุก request)                            │
│  ตรวจ session-token JWT → redirect /login                │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  AUTHZ: lib/auth.ts requireAdmin() / lib/permissions.ts │
│  ตรวจ role+status จาก DB (ไม่เชื่อ JWT) + RBAC ต่อ action │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  BUSINESS LOGIC: lib/*.ts, app/**/actions.ts             │
│  journaling / taxAutomator / payroll / expenses          │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  DB: PostgreSQL (lib/db.ts — Pool max=3)                 │
│  PostgreSQL; schema/migrations ต้องยึด environment จริง │
└─────────────────────────────────────────────────────────┘
```

### 2.2 กระบวนการหลัก: ออกใบแจ้งหนี้ → ลงบัญชีอัตโนมัติ

```
ผู้ใช้กรอกใบแจ้งหนี้ (app/invoices/new/page.tsx)
   ↓
หน้าและ server action: ตรวจ implementation แยกตามเส้นทาง; `createInvoice()` เองไม่เรียก `checkPermission()`
   ↓
บันทึก invoices + invoice_items
   ↓
เรียก createSalesJournalEntry()  [lib/journaling.ts:338]
   ├─ ถ้าเป็นสินค้า (ไม่ใช่บริการ):
   │    Dr 1121 ลูกหนี้การค้า      Cr 4110 รายได้จากการขาย   (net)
   │    Dr 1121 ลูกหนี้การค้า      Cr 2121 ภาษีขายค้างจ่าย   (vat)
   └─ ถ้าเป็นบริการ (isService=true):
        Dr 1121 ลูกหนี้การค้า      Cr 4110 รายได้จากการขาย   (net)
        Dr 1121 ลูกหนี้การค้า      Cr 2122 ภาษีขายไม่ถึงกำหนด (vat)
   ↓
เลข invoice ที่ UI ขอจาก `getNextInvoiceNumber()`; รูปแบบต้องยึดค่าที่ action คืน ไม่อนุมานจากเลข journal
   ↓
รายงาน/งบ P&L อ่านจาก journal_entries (lib/reports.ts)
```

**จุดสำคัญ:** บริการ (service) ใช้ VAT_UNDUE (2122) เพราะยังไม่ถึงกำหนด — เมื่อมารับเงินจริงจะมี journal กลับรายการ VAT (`lib/journaling.ts:428-440`)

### 2.3 กระบวนการ: รับเงิน (Receipt)

```
รับชำระใน app/payments → สร้าง receipt
   ↓
createReceiptJournalEntry()  [lib/journaling.ts:389]
   ├─ Dr 1111 เงินสด              Cr 1121 ลูกหนี้การค้า   (amount - wht)
   ├─ ถ้ามี WHT: Dr 1142 ภาษีถูกหักณที่จ่าย  Cr 1121 ลูกหนี้  (whtAmount)
   └─ ถ้าเป็นบริการ + มี VAT: Dr 2122 VATไม่ถึงกำหนด  Cr 2121 VATค้างจ่าย
   ↓
พิมพ์ใบเสร็จ/ใบกำกับภาษี (RECEIPT / TAX INVOICE)
```

### 2.4 กระบวนการ: บันทึกค่าใช้จ่าย

```
กรอกค่าใช้จ่าย (app/expenses) + แนบหลักฐาน
   ↓
createExpense() บันทึกรายการ แล้วเรียก createExpenseJournalEntry() [lib/journaling.ts]
   ├─ ยังไม่พบการเรียก InputTaxValidator ใน expense UI/action
   ├─ code สร้าง debit/credit entries ตาม category mapping ปัจจุบัน
   └─ การบันทึก expense และ journal ไม่ได้ใช้ transaction เดียวกันในเส้นทางนี้
   ├─ Dr ตามหมวดค่าใช้จ่าย  Cr 2111 เจ้าหนี้การค้า   (amount - vat)
   ├─ ถ้ามี VAT: Dr 1140 ภาษีซื้อ  Cr 2111 เจ้าหนี้การค้า
   └─ ถ้ามี WHT: Dr 2111 เจ้าหนี้การค้า  Cr 2130 ภาษีหักณที่จ่ายค้างจ่าย
```

**หมวดค่าใช้จ่าย → บัญชี** (จาก `lib/journaling.ts:459-470`):
| หมวด | บัญชี |
|---|---|
| ค่าเช่าสถานที่ | 5320 ค่าเช่า |
| ค่าสาธารณูปโภค / ค่าขนส่ง | 5330 ค่าสาธารณูปโภค |
| การตลาดและโฆษณา | 5210 ค่าโฆษณา |
| เงินเดือนและค่าแรง | 5310 เงินเดือน |
| ต้นทุนสินค้า / วัสดุ | 5110 ต้นทุนขาย |
| ค่า License / ซ่อมบำรุง / อื่นๆ | 5340 ค่าเสื่อมราคา |

### 2.5 กระบวนการปิดงวดเดือน

```
ปุ่ม "สรุปยอดส่งเข้า Google Drive" (components/SyncMonthlyButton.tsx)
   └─ exportMonthlySummaryToDrive() สร้าง spreadsheet ใหม่ แต่ไม่เขียนข้อมูลลง sheet

เมื่อ CRON_ENABLED=true บน persistent Node process:
   ├─ 02:00 → scripts/auto-backup.mjs → dump ตาราง public, gzip, upload Drive, cleanup ตามอายุ
   └─ 02:05 → scripts/dashboard-sheet.mjs → เขียนข้อมูลสรุปลง 3 sheets

การ upload backup สำเร็จไม่เท่ากับพิสูจน์ว่า restore ได้; ยังต้องซ้อม restore แยกต่างหาก
```

---

## 3. วิธีใช้งาน ฝั่งผู้ใช้

### 3.1 ขั้นตอนแรก — เข้าสู่ระบบ

| ขั้นตอน | ทำอะไร | เกิดอะไร |
|---|---|---|
| 1 | เปิด `/login` | กรอกอีเมล + รหัสผ่าน |
| 2 | ระบบตรวจ throttle | ลองผิด 10 ครั้ง → ล็อก 15 นาที (429) |
| 3 | ตรวจ `isActiveStatus(status)` | ถ้าเป็น `Pending` → ตอบ `Invalid credentials` เหมือนรหัสผิด (กันการเดา) |
| 4 | `bcrypt.compare()` | ผ่าน → สร้าง JWT 1 วัน เก็บ cookie `session-token` (httpOnly, sameSite=lax) |
| 5 | `proxy.ts` ตรวจทุกหน้า | มี JWT → เข้าได้ / ไม่มี → redirect `/login?callbackUrl=...` |

**ถ้าเข้าไม่ได้แต่บัญชีถูกต้อง:** แปลว่า `status` ไม่ใช่ `Active` — ต้องให้ admin อนุมัติที่ `/admin/members` (ผู้ใช้ใหม่ได้สถานะ `Pending` โดยอัตโนมัติ)

### 3.2 เส้นทางใช้งานหลัก (27 หน้า)

**ฝั่งขาย**
- `/quotations` — ใบเสนอราคา → `/quotations/new` → `/quotations/[id]/preview` (พิมพ์)
- `/invoices` → `/invoices/new` → `/invoices/preview/[id]` → `/invoices/wht50/[id]` (ใบหัก ณ ที่จ่าย 3%)
- `/receipts` — ใบเสร็จ/ใบกำกับภาษี
- `/recurring` — ตั้งรอบบิลอัตโนมัติ
- `/payments` — บันทึกการรับชำระ → `/payments/print/[id]`
- `/hosting/subscriptions` — สัญญาเช่าโฮสติ้ง

**ฝั่งค่าใช้จ่าย**
- `/expenses` — ค่าใช้จ่าย/ซัพพลายเออร์ + แนบหลักฐาน → `/expenses/[id]/wht53` (ใบ ภ.ง.ด.53)
- `/vouchers` — ใบสำคัญจ่าย (พิมพ์สรุปยอดปลายเดือน)
- `/payroll` — ค่าแรงพนักงาน (มี automated tests ที่ `tests/payroll-validation.test.mjs`)

**ฝั่งข้อมูลหลัก**
- `/contacts` — ผู้ติดต่อ/คู่ค้า
- `/inventory` — คลังสินค้า (มี QR + Barcode) + `/inventory/categories`
- `/services` — ราคากลางบริการ
- `/hosting/plans` — แพ็กเกจโฮสติ้ง

**ฝั่งบัญชีและรายงาน**
- `/journals` — สมุดรายวัน (auto + ปรับด้วยมือ) → `/journals/new`
- `/tax-reports` — รายงาน VAT ซื้อ-ขาย, WHT
- `/reports/profit-loss` — งบกำไรขาดทุน
- `/accounting/reconciliation` — กระทบยอด

**อื่นๆ**
- `/ai` — ผู้ช่วย AI ถาม-ตอบด้านบัญชี (มี widget ลอยทุกหน้า)
- `/calendar` — ปฏิทินภาษี/กำหนดส่ง
- `/profile` — ข้อมูลส่วนตัว
- `/settings` + `/settings/patterns` — ตั้งค่าบริษัท, รูปแบบเลขเอกสาร

### 3.3 ทำใบเสนอราคา → ใบแจ้งหนี้ → ใบเสร็จ (ลำดับมาตรฐาน)

```
1. /quotations/new   → กรอกสินค้า/บริการ + VAT → บันทึก → ได้เลข QT-2026-10-001
2. /invoices/new     → เลือกใบเสนอราคาที่ลูกค้าอนุมัติ → ออกบิล → INV-2026-10-001
                        (ระบบลง Dr 1121 / Cr 4110+2121 อัตโนมัติ)
3. ลูกค้าจ่าย → /payments/new → บันทึกรับเงิน
                        (ระบบลง Dr 1111 / Cr 1121 อัตโนมัติ)
4. /receipts         → พิมพ์ใบเสร็จ/ใบกำกับภาษี
5. /tax-reports      → ตรวจยอด VAT/WHT ประจำเดือน → ยื่นผ่านลิงก์ e-Filing
6. /reports/profit-loss → ดูกำไรขาดทุนสะสม
```

### 3.4 ข้อควรรู้

- **PDF**: jspdf + jspdf-autotable (พิมพ์เอกสาร), exceljs (ส่งออก Excel)
- **QR/Barcode**: react-barcode, qrcode.react
- **หลักฐาน**: อัปโหลดขึ้น Google Drive ผ่าน `components/GoogleDrivePicker.tsx` (ต้องตั้ง Google OAuth)
- **FX**: หน้าใบแจ้งหนี้มี widget อัตราแลกเปลี่ยนจากธนาคารแห่งประเทศไทย (`/api/fx-rate`)

---

## 4. วิธีใช้งาน ฝั่ง admin

### 4.1 โครงสร้างสิทธิ์ 3 ระดับ

| ระดับ | ทำอะไรได้ | ตรวจที่ไหน |
|---|---|---|
| **superadmin** | ทุกอย่าง + ข้ามเพดานจำนวนผู้ใช้ตาม license | `normalizeRole()` → `superadmin` |
| **admin** | จัดการสมาชิก/กลุ่ม/โมดูล/ตั้งค่า/สำรองข้อมูล | `canAccessAdmin()` → true |
| **user** | ใช้ตามสิทธิ์ในกลุ่มที่ได้รับมอบหมาย | ผ่าน RBAC ต่อ action |

> **สำคัญ:** ทุกหน้า `/admin/*` ถูกป้องด้วย `app/admin/layout.tsx` ซึ่งเรียก `requireAdmin()` — ถ้าไม่ใช่ admin จะถูก redirect ออกทันที (ไม่ต้องตรวจซ้ำในแต่ละหน้า)

### 4.2 `/admin` — แผงผู้ดูแล

| เมนู | หน้า | ทำอะไร |
|---|---|---|
| สมาชิก | `/admin/members` | ดู/เพิ่ม/แก้ไขผู้ใช้, เปลี่ยน role, เปิด-ปิดสถานะ |
| กลุ่มและสิทธิ์ | `/admin/groups` | สร้างกลุ่ม, กำหนดสิทธิ์รายโมดูล (create/read/update/delete/export/manage) |
| โมดูลระบบ | `/admin/modules` | เปิด/ปิดโมดูลรายบริษัท |
| ผังบัญชี | `/admin/coa` | ดูแลบัญชีในผังบัญชี (COA) |
| สำรองข้อมูล | `/admin/backup` | ส่งออกฐานข้อมูลเป็น JSON/SQL |

### 4.3 จัดการสมาชิก (`/admin/members`)

**สร้างสมาชิกใหม่**
- กด "เพิ่มสมาชิก" → `/admin/members/new`
- กรอก: ชื่อ, อีเมล, รหัสผ่าน (≥6 ตัว), role, status
- **Server action `createUserAction()`** (`app/admin/members/actions.ts:9`) ตรวจ:
  1. `requireAdmin()` — ต้องเป็น admin ที่ยัง active ใน DB (**ไม่เชื่อ role ใน JWT**)
  2. ถ้าไม่ใช่ superadmin → เช็คเพดานจำนวนผู้ใช้จาก license
  3. เช็คอีเมลซ้ำ
  4. `bcrypt.hash(password, 10)`
  5. `normalizeRole()` — บังคับเป็น `superadmin`/`admin`/`user` ตัวพิมพ์เล็ก

**แก้ไขสมาชิก** — `/admin/members/edit/[id]` → `updateUserAction()`
- เปลี่ยนชื่อ/อีเมล/role/status ได้
- การลดสิทธิ์มีผลทันที เพราะ `requireAdmin()` อ่าน role จาก DB ทุกครั้ง ไม่ต้องรอ JWT หมดอายุ

**อนุมัติผู้ใช้ Pending**
- ผู้สมัครใหม่ได้ role=`user`, status=`Pending` อัตโนมัติ
- เข้า `/admin/members` → เปลี่ยน status จาก `Pending` เป็น `Active` เท่านั้นผู้นั้นจึงจะเข้าสู่ระบบได้

### 4.4 จัดการสิทธิ์แบบกลุ่ม (`/admin/groups`)

โมเดล: `users` ← `user_groups` → `groups` ← `group_permissions`

```
ผู้ใช้ ──(user_groups)──> กลุ่ม ──(group_permissions)──> โมดูล + action
```

- **Module ที่กำหนดสิทธิ์ได้** 20 ตัว (`lib/permissions.ts:8-29`): dashboard, quotations, invoices, recurring, receipts, inventory, services, expenses, payroll, journals, vouchers, contacts, payments, tax_reports, reports, calendar, settings, member_management, permissions, groups
- **Action 6 ตัว** (`PermissionAction`, `lib/permissions.ts:5`): `create`, `read`, `update`, `delete`, `export`, `manage`
- **กติกาการรวมสิทธิ์:** ถ้าอยู่หลายกลุ่ม ใช้แบบ **OR (ใครมีสิทธิ์ ใครได้)** — `BOOL_OR()` ใน `lib/permissions.ts:87-138`
- **Group ID พิเศษ:** `isSuperAdmin()` = อยู่ group 1 · `isAdmin()` = group 1 หรือ 2 (`lib/permissions.ts:195`, `:202`)
- **คอลัมน์ใน DB:** แปลง action เป็นชื่อคอลัมน์ `can_create` … `can_manage` ผ่าน `ACTION_COLUMN_MAP` (`lib/permissions.ts:210-216`)

### 4.5 เปิด/ปิดโมดูล (`/admin/modules`)

- ตาราง `company_module_settings` เก็บสถานะเปิด/ปิดโมดูล (`lib/module-config.ts`)
- 5 หมวด: SALES, OPERATIONS, MASTER DATA, REPORTS, ADMIN
- `MODULE_REGISTRY` มี **21 โมดูล** จัดกลุ่ม 5 หมวด; `lib/permissions.ts` มี **20 permission modules** ซึ่งเป็นคนละรายการและคนละวัตถุประสงค์
- **เพิ่งแก้บั๊ก**: หน้านี้เคยใช้ `categoryOrder` ที่ไม่ตรงกับ category จริง → แสดงได้แค่หมวด ADMIN (5 โมดูล) โมดูลธุรกิจอีก 16 โมดูลไม่แสดงเลย แก้แล้วใน version ล่าสุด
- ปิดโมดูลผ่าน UI = override ใน DB · ปิดผ่าน env `NEXT_PUBLIC_MODULE_<ID>=false` = ค่า default (`lib/module-registry.ts:66-71`)

### 4.6 สำรองข้อมูล

**แบบในแอป** — `/admin/backup` → `GET /api/admin/backup?format=json|sql`
- 14 ตาราง: company_settings, chart_of_accounts, journal_entries, expenses, invoices, invoice_items, contacts, users, groups, group_permissions, user_groups, payments, payment_vouchers, document_patterns
- ทุกครั้งที่เรียกจะ log ลง audit: `[AUDIT] Database backup initiated by admin: {email} (ID: {id}) at {timestamp}`

**แบบอัตโนมัติ** — `scripts/auto-backup.mjs`
- dump ทุกตารางใน schema `public` (ยกเว้น `users_backup_1773898881424`)
- gzip → อัปโหลด `Backup-Auto/db-backup-YYYY-MM-DD.json.gz` บน Google Drive
- ลบไฟล์เก่ากว่า 30 วันอัตโนมัติ
- **ความเสี่ยงที่ต้องแก้:** ไม่มีการเข้ารหัสก่อนอัปโหลด และไฟล์มีข้อมูล `users` (รวม password hash) ทั้งหมด

### 4.7 ออก License ให้ลูกค้า

```bash
# ฝั่งผู้ขาย (พี่ฆัง) — ต้องใช้ LICENSE_SALT เดียวกับฝั่งแอป
node scripts/issue-license.mjs \
  --mode perpetual \
  --company "ชื่อบริษัทลูกค้า" \
  --licensee "อีเมลลูกค้า" \
  --max-users 5

# subscription mode เพิ่มวันหมดอายุ
node scripts/issue-license.mjs --mode subscription --expires 2027-01-01 ...
```

**รูปแบบ key:** `MBS.<base64url(payload)>.<base64url(HMAC-SHA256)>` (`lib/license.ts:33`)
**ฝั่งแอปตรวจ:** `requireActiveLicense()` — ถ้า key ผิด/หมดอายุ **ระบบจะไม่สตาร์ท** (`instrumentation.ts:10-13`)

### 4.8 การตรวจสิทธิ์ของ API

`proxy.ts` ตรวจ session สำหรับ route ที่ไม่ใช่ public แต่ session gate ไม่ได้แปลว่าผ่าน RBAC หรือเป็น admin การตรวจนี้เป็น static spot-check ไม่ใช่ inventory ที่รับรอง route ทุกตัว:

- ใช้ `requireAdmin()` สำหรับ operation ที่เป็น admin boundary
- ใช้ `checkPermission()` เฉพาะเส้นทางที่มีการเรียกจริง; อย่าสรุปว่าทุก server action/API มี RBAC ครบ
- ก่อนเปิด production ให้ตรวจ route และ server action ทั้งหมดเป็นรายการ พร้อมทดสอบ user/admin/unauthenticated

| Route | การป้องกัน |
|---|---|
| `GET /api/admin/backup` | requireAdmin + audit log |
| `PUT /api/admin/modules` | requireAdmin |
| `POST /api/migrate` | requireAdmin (ALTER TABLE) |
| `GET /api/db_schema` | requireAdmin |
| `POST /api/reset_billing` | requireAdmin + ต้องส่ง `confirmToken: "RESET_BILLING_CONFIRMED"` |
| `PUT /api/settings` | requireAdmin |
| `/api/groups/*`, `/api/users/*`, `/api/import`, `/api/invoices/delete`, `/api/payroll/*`, `/api/payments/[id]`, `/api/recurring/generate` | มี auth check |

> **หมายเหตุ:** การเปิด/ปิดใบแจ้งหนี้/ค่าใช้จ่าย/ข้อมูลติดต่อยังพึ่ง `proxy.ts` อย่างเดียว — ถ้าต้องการจำกัดตาม RBAC ให้เพิ่ม `checkPermission()` ใน route เหล่านี้ (ดู backlog ข้อ 4 ใน changelog)

---

## 5. การติดตั้ง

> ⚠️ **สถานะจริง: README.md สอนแบบหนึ่ง แต่ docker-compose.yml ใช้อีกแบบหนึ่ง** — ดูหัวข้อ 5.4

### 5.1 สิ่งที่ต้องมีก่อน

| ต้องการ | เวอร์ชัน/รายละเอียด | ตรวจจาก |
|---|---|---|
| Node.js | 20+ | `Dockerfile` ใช้ `node:20-alpine` |
| PostgreSQL | 12+ | `lib/db.ts` ใช้ `pg` 8.x |
| Docker + Compose | v2 | `docker-compose.yml` |
| Google account | สำหรับ Drive/Sheets (ถ้าใช้ auto-backup) | `scripts/google-auth.mjs` |
| Docker network ชื่อ `stack_stack` | **ต้องมีอยู่ก่อน** | `docker-compose.yml:58-61` |

### 5.2 ตัวแปรแวดล้อมที่จำเป็น

จาก `.env.example` และ `lib/env.ts` — ต้องแยกเงื่อนไข runtime ปกติกับ production license:

| ตัวแปร | บังคับ? | ใช้ทำอะไร | ถ้าไม่ตั้ง |
|---|---|---|---|
| `DATABASE_URL` | ✅ ทุก runtime ตาม `validateEnv()` | `lib/env.ts` ตรวจตอน startup |
| `POSTGRES_URL` | ตัวเลือก DB URL สำหรับ `lib/db.ts` แต่เพียงตัวเดียวไม่ผ่าน `validateEnv()` ปัจจุบัน | ตั้ง `DATABASE_URL` ด้วย |
| `NEXTAUTH_URL` | ✅ ทุก runtime | ต้องเป็น URL ที่ขึ้นต้นด้วย http(s) |
| `NEXTAUTH_SECRET` หรือ `AUTH_SECRET` | ✅ ทุก runtime | ใช้เซ็น/ตรวจ custom JWT ด้วย `jose` |
| `BILLING_DATABASE_URL` | ✅ เมื่อใช้ compose ปัจจุบัน | compose map ไป `DATABASE_URL`/`POSTGRES_URL` |
| `LICENSE_SALT`, `MBS_LICENSE_KEY` | ✅ เมื่อรัน production | `instrumentation.ts` บังคับ license ตอน runtime |
| `PRODUCT_MODE` | ไม่บังคับ | ค่าเริ่มต้น `perpetual`; `subscription` ต้องใช้ license ที่มีวันหมดอายุ |
| `CRON_ENABLED` | ไม่บังคับ | ค่าเริ่มต้นปิด; เปิด cron ใน process ที่ทำงานต่อเนื่อง |
| `SESSION_MAX_AGE` | ไม่บังคับ | validator ตรวจรูปแบบเมื่อมีค่า; login route ตั้ง cookie 1 วัน |

> `validateEnv()` ถูกเรียกที่ `instrumentation.ts:6` ตอน server startup — ตรวจ fail-fast ก่อนรับ request

**ตัวเลือก (ไม่บังคับ):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `NEXT_PUBLIC_GOOGLE_API_KEY`, `GEMINI_API_KEY`, `GMAIL_FROM`, `GMAIL_APP_PASSWORD`, `RECURRING_SECRET`

### 5.3 ติดตั้งแบบ A — Docker (สำหรับส่งมอบลูกค้า) ⭐ ตรงกับ `docker-compose.yml`

```bash
# 1) เตรียม env
cp .env.example .env.local
openssl rand -base64 32   # → ใส่เป็น NEXTAUTH_SECRET

# 2) ต้องมี network ชื่อ stack_stack อยู่ก่อน
docker network create stack_stack    # ถ้ายังไม่มี

# 3) ใส่ค่าใน .env.local:
#    BILLING_DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB?sslmode=disable
#    LICENSE_SALT=<salt เดียวกับฝั่งที่ออก license>
#    MBS_LICENSE_KEY=<key ที่ออกให้ลูกค้า>
#    NEXTAUTH_SECRET / AUTH_SECRET=<random>

# 4) เตรียม schema ผ่าน migration/runbook ที่ตรวจแล้วสำหรับ environment นี้
#    อย่ารัน scripts/CURRENT_SCHEMA_MASTER.sql โดยไม่ review; เป็น schema snapshot เก่า

# 5) รัน
docker compose up -d --build

# 6) เข้าที่ http://localhost:3001 (port ผูก loopback เท่านั้น)
```

**ข้อสำคัญจาก `docker-compose.yml`:**
- `ports: 127.0.0.1:3001:3000` — ผูกแค่ loopback (บรรทัด 48-52) เข้าผ่าน LAN/Tailscale IP ตรงไม่ได้ ต้องผ่าน proxy
- `networks: stack (external: stack_stack)` — **ต้องมี network นี้อยู่ก่อน** ไม่งั้น compose จะ error
- ไม่มี `db` service ในไฟล์นี้ — DB ต้องมาจากภายนอก

### 5.4 ติดตั้งแบบ B — Local (สำหรับ dev) — **ขัดแย้งกับ compose**

```bash
pnpm install
cp .env.example .env.local
# ตั้ง DATABASE_URL, NEXTAUTH_URL=http://localhost:3000 และ NEXTAUTH_SECRET หรือ AUTH_SECRET
pnpm dev                         # http://localhost:3000
```

Local dev ใช้ `DATABASE_URL` โดยตรง ส่วน Compose เป็นอีก topology: ใช้ `BILLING_DATABASE_URL` เป็น input, external `stack_stack` network และ external PostgreSQL; Compose ไม่มี DB service และไม่ bootstrap schema ให้อัตโนมัติ. README ได้รับการแก้ให้สะท้อนข้อแตกต่างนี้แล้ว แต่ยังไม่ได้ทดสอบ deployment จริง.

> **หมายเหตุ:** Dockerfile มี placeholder env สำหรับ build stage (บรรทัด 22-25) เพื่อให้ fail-fast guard ผ่านตอน collect page data — แต่ค่าจริงถูกส่งเข้าตอน runtime ผ่าน compose

### 5.5 สร้างผู้ดูแลคนแรก

```
1. เปิด /register → กรอกชื่อ อีเมล รหัสผ่าน (≥6 ตัว) → ลงทะเบียน
2. ระบบตรวจ SELECT EXISTS(SELECT 1 FROM users):
   ├─ ไม่มีผู้ใช้เลย → role=superadmin, status=Active  ← คนแรกได้เป็นผู้ดูแล
   └─ มีผู้ใช้แล้ว → role=user, status=Pending          ← ต้องรอ admin อนุมัติ
3. เข้า /login ด้วยบัญชีแรก
```

**กลไกกัน race condition** (`app/register/actions.ts:54-66`): ใช้ `pg_advisory_xact_lock` + transaction
- ถ้าไม่ล็อก ผู้สมัคร 2 คนพร้อมกันบนตารางว่างจะเห็น users=0 ทั้งคู่ → **ได้ superadmin ทั้งคู่**

**หน้า `/register/promote` ใช้ไม่ได้แล้ว — README เดิมบอกให้กด promote ทิ้ง**
- หน้านั้นผูกอีเมลตายตัวในทั้ง 2 จุด — เรียก action และข้อความบนหน้า (ไม่เผยอีเมลส่วนตัวซ้ำในเอกสารนี้)
- `promoteUserAction()` (`app/register/db-init.ts:67`) ตรวจ `requireAdmin()` แล้ว → คนที่ยัง login ไม่ได้ (status=`Pending`) จะได้ `gate.ok = false`
- **ผลคือวนไปตลอด:** คนแรกได้ superadmin จาก bootstrap อยู่แล้ว ส่วนคนที่ต้องการ promote คือคนที่ยังเป็น Pending ซึ่งเข้า `/admin/members` ไม่ได้ → หน้านี้เป็น dead end
- ถ้าจำเป็นต้องคงไว้ ต้องแก้ให้รับอีเมลจาก input (ยังต้องมี `requireAdmin()` คงอยู่) — **ยังไม่ได้แก้**

### 5.6 คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `pnpm dev` | โหมดพัฒนา (ปกติ port 3000) |
| `pnpm build` | build production |
| `pnpm start` | รัน production |
| `pnpm test` | รัน `tests/**/*.test.mjs` (4 ไฟล์) + `tests/**/*.test.mts` (1 ไฟล์) ผ่าน `tsx` — รวม 36 เทสต์ |
| `pnpm test:watch` | เหมือน `pnpm test` แต่ watch ระหว่างแก้ |
| `pnpm lint` | ESLint ทั้ง repository |
| `pnpm tax:update` | รัน tax update job; ไม่ใช่การยื่นแบบ |
| `pnpm ai:audit` | รัน AI Auditor |
| `pnpm check:knowledge` | ตรวจ knowledge sync |
| `pnpm check:consistency` | ตรวจ consistency script |

### 5.7 ตั้งงานอัตโนมัติ (cron)

**แบบในแอป** (แนะนำ) — ตั้ง `CRON_ENABLED=true`
- `instrumentation.ts:15-17` → `registerMaintenance()` ลง cron อัตโนมัติ
- 02:00 auto-backup · 02:05 dashboard-sheet

**แบบ host crontab** (ถ้าไม่เปิด CRON_ENABLED)
```
0 2 * * *  cd /path/to/app && node scripts/auto-backup.mjs
5 2 * * *  cd /path/to/app && node scripts/dashboard-sheet.mjs
```

---

## 6. ขั้นตอนการทำงานของ code

### 6.1 Request lifecycle

```
ผู้ใช้เปิดหน้า /invoices
   │
   ├─(1) proxy.ts ทำงานก่อนเสมอ (Next.js middleware)
   │      matcher: /((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)
   │      • public: /login, /register, /api/login, /api/logout, /api/auth/*
   │      • อื่นๆ ทั้งหมด: ต้องมี cookie session-token → jwtVerify()
   │      • ไม่มี → 302 ไป /login?callbackUrl=<path>
   │
   ├─(2) page.tsx (Server Component) เรียก auth()
   │      cookies() → session-token → verifyToken() → UserSession {id,email,name,role}
   │      ถ้าไม่มี → null (component ต้องจัดการเอง)
   │
   ├─(3) ตรวจสิทธิ์รายโมดูล
   │      checkPermission(userId, 'invoices', 'read')
   │      → SELECT EXISTS(... user_groups JOIN group_permissions ...)
   │      → cache ใน Map ตาม userId (รีเซ็ตเมื่อ restart)
   │
   ├─(4) query() ดึงข้อมูล
   │      Pool(max=3, idleTimeout=10s, connectionTimeout=15s)
   │
   └─(5) render → ส่ง HTML ให้ client
```

### 6.2 การเขียน (Mutation) — Server Action

```
ผู้ใช้กด Submit
   ↓
<form action={serverAction}>  → Next.js เรียกฟังก์ชันที่มี "use server"
   ↓
① ตรวจ authentication/authorization ตาม action จริง
② validate input                        ← ขอบเขต validation แตกต่างกันตาม action
③ withTransaction(client => {           ← ใช้เฉพาะ flow ที่ต่อ client เดียวกัน
     BEGIN
     ... queries ...
     COMMIT                              ← lib/db.ts:44-63
   })
   ↓
④ revalidatePath('/...')                ← ล้าง cache ของหน้าที่เกี่ยวข้อง
   ↓
⑤ return { success: true } | { error: "..." }
```

**ตัวอย่างจริง** — `app/register/actions.ts:54-66`
```typescript
await withTransaction(async (client) => {
  await client.query("SELECT pg_advisory_xact_lock($1)", [BOOTSTRAP_LOCK_KEY]);
  const userCountRes = await client.query(
    "SELECT EXISTS (SELECT 1 FROM users) AS has_users"
  );
  const access = resolveRegistrationAccess(userCountRes.rows[0]?.has_users === true);
  await client.query(
    "INSERT INTO users (name, email, password, role, status, company_id) VALUES ($1,$2,$3,$4,$5,$6)",
    [name, email, hashedPassword, access.role, access.status, companyId]
  );
});
```

**เหตุผลที่ต้องใช้ `withTransaction` ไม่ใช่ `query()`** (`lib/db.ts:40-43`):
`pool.query()` เช็คเอาต์ connection คนละตัวแบบสุ่ม → `BEGIN` และ `COMMIT` อาจไม่ได้รันบน connection เดียวกัน = **ไม่ใช่ transaction จริง**

### 6.3 Startup sequence

```
node server.js
   ↓
instrumentation.ts register()
   ├─ validateEnv()                    ← ตรวจ DATABASE_URL, NEXTAUTH_URL, JWT secret
   │                                     ไม่ผ่าน = throw = ไม่สตาร์ท
   ├─ if (NODE_ENV=production && !NEXT_PHASE)
   │     requireActiveLicense()        ← ตรวจ MBS_LICENSE_KEY
   │                                     ไม่ผ่าน = throw = ไม่สตาร์ท
   └─ if (CRON_ENABLED=true)
         registerMaintenance()         ← ลง cron 02:00 / 02:05
   ↓
module load: lib/db.ts อ่าน DATABASE_URL → ไม่มี = throw
module load: lib/auth.ts อ่าน NEXTAUTH_SECRET → ไม่มี = throw
module load: proxy.ts อ่าน NEXTAUTH_SECRET → ไม่มี = throw
   ↓
พร้อมรับ request
```

> **จุดที่ตั้งใจ:** 3 ไฟล์นี้ throw ตอน **module load** ไม่ใช่ตอนใช้งาน — ทำให้ misconfiguration โดนเจอทันทีตอนสตาร์ท ไม่ใช่ตอนผู้ใช้กดเมนู

### 6.4 โครงสร้างไฟล์

```
lib/                          ← business logic (ห้าม import จาก components)
├── db.ts                     ← Pool, query(), withTransaction()
├── auth.ts                   ← JWT, requireAdmin(), checkUserLimit()
├── core-standards.ts         ← normalizeRole(), canAccessAdmin()
├── registration-bootstrap.mjs← isActiveStatus(), resolveRegistrationAccess()
├── permissions.ts            ← checkPermission(), logActivity()
├── module-registry.ts        ← MODULE_REGISTRY (single source of truth)
├── module-config.ts          ← เปิด/ปิดโมดูลรายบริษัท
├── journaling.ts             ← COA mapping + createXxxJournalEntry()
├── taxAutomator.ts           ← VAT/WHT/PP36 validators
├── reports.ts                ← P&L calculation
├── license.ts                ← offline signed license
├── license-check.ts          ← license middleware + PROTECTED_FEATURES
├── product-mode.ts           ← perpetual/subscription
├── env.ts                    ← validateEnv()
└── settings.ts               ← company_settings (มี allowlist columns)

app/                          ← Next.js App Router
├── proxy → ../../proxy.ts
├── layout.tsx                ← root layout + Providers
├── page.tsx                  ← Dashboard
├── login/ register/ profile/
├── quotations/ invoices/ payments/ receipts/ recurring/   ← sales
├── expenses/ payroll/ vouchers/ journals/                ← operations
├── inventory/ services/ contacts/ hosting/               ← master data
├── tax-reports/ reports/ accounting/ calendar/           ← reports
├── ai/ system-audit/
└── admin/                    ← ป้องด้วย admin/layout.tsx

app/api/                      ← 32 REST route
components/                   ← 13 React components ที่ใช้ซ้ำ
scripts/                      ← auto-backup, dashboard-sheet, issue-license, *.sql
jobs/                         ← scheduleTaxUpdate, scheduleAiAudit, scheduleMaintenance
migrations/                   ← 7 ไฟล์ SQL migration
tests/                        ← 4 ไฟล์ `.test.mjs` + `taxAutomator.test.mts` (เคยมี `.test.ts` ที่ไม่เคยรัน — ลบแล้ว เขียนใหม่เป็น `.mts` ดู 7.6.1–7.6.2)
```

### 6.5 จุดสำคัญที่ต้องรู้เรื่อง DB

**Connection pool** (`lib/db.ts:26-33`)
```typescript
new Pool({
  connectionString,     // sslmode ถูกลบออกจาก URL
  ssl,                  // disable → false; อื่น → { rejectUnauthorized: true }
  max: 3,               // จำกัด 3 connection (ออกแบบมาสำหรับ Vercel serverless)
  min: 0,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
})
```

**นโยบาย TLS** (`lib/db.ts:21-24`)
- default (`require`/`verify-ca`/`verify-full`) → ตรวจ certificate เข้ม
- ระบุ `?sslmode=disable` ชัดเจน → ไม่ใช้ TLS (ใช้ local dev เท่านั้น)

**การตั้งค่า `company_settings`** — `lib/settings.ts` ใช้ `WRITABLE_SETTINGS_COLUMNS` เป็น allowlist
- SQL identifier เลือกจาก allowlist เท่านั้น ไม่รับ key จาก request
- `redactSettingsSecrets()` ตัด field ลับก่อนส่งออก

### 6.6 จุดที่ระบบแก้เองอัตโนมัติ (auto-fix)

หลายโมดูลเรียก `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN IF NOT EXISTS` ตอนใช้งาน เช่น:
- `lib/auth.ts:38-81` — `ensureCompanyLicensingSchema()` (ตาราง companies)
- `lib/module-config.ts:3-14` — `ensureModuleConfigSchema()`
- `app/expense-actions.ts:19-49` — `ensureExpensesTable()`

> **ข้อควรระจำ:** นี่คือ "lazy migration" — สะดวกแต่ทำให้ production schema เปลี่ยนโดยไม่มี audit trail
> ขัดกับหลักใน `docs/RBAC_STANDARD.md:40-42` ("ห้ามทำลาย/รีเซ็ต production tables, ใช้ additive migration เท่านั้น")
> **ควรย้ายไป `migrations/` เมื่อเก็บ production** — บันทึกไว้เป็น backlog

---

## 7. รายงานการแก้ไข แต่ละ version

### 7.1 เวอร์ชันจาก Git

ครบทั้งสาขา ณ 2 ต.ค. 2026

| Commit | วันที่ | รายละเอียด |
|---|---|---|
| `fb12f59` | 21 ก.ย. | นำเข้า Micro Business Suite (สะอาด จาก Micro-Account ไม่มีประวัติ ไม่มีข้อมูลลูกค้า) |
| `025288a` | 21 ก.ย. | ล้างข้อมูลบริษัท + ship |
| `2588df0` | 21 ก.ย. | เพิ่ม offline signed license + Docker delivery |
| `f1be184` | 1 ต.ค. | Initial commit |
| `6c9513b` | 1 ต.ค. | Initial commit: เพิ่มโครงสร้างโปรเจกต์ + config |
| `65e1b8f` | 1 ต.ค. | Merge remote branch with resolved conflicts |
| `2926d35` | 1 ต.ค. | "i am delete" |
| `589c1e2` | 1 ต.ค. | เปลี่ยนชื่อแอปเป็น MBSuite |
| `cb7a2ed` | 1 ต.ค. | ย้าย Billing ไป stack-db + ผูก port เฉพาะ loopback |
| `e1aac51` | 2 ต.ค. | ปราบปรุง endpoint สิทธิ์พิเศษ + settings API |
| `e58c3df` | 2 ต.ค. | migrate schema company_settings + แก้ insert default row |
| `db577ec` | 2 ต.ค. | `normalizeRole()` รู้จัก 'administrator' = admin |
| `54eaa59` | 2 ต.ค. | เพิ่มโมดูล Hosting (plans + subscriptions) |
| `218975e` | 2 ต.ค. | เพิ่ม project skill `mbsuite-billing-deploy` |
| `7a79d9b` | 2 ต.ค. | gitignore license_key.txt + .opencode/ |
| `7e4bcdc` | 2 ต.ค. | เลิก track next-env.d.ts (build artifact) |
| `db1a171` | 2 ต.ค. | ปิดช่องโหว่ P1 (escalation, secret exposure, authz) |
| `b432102` | 2 ต.ค. | hosting query ผ่าน lib/db แทน @vercel/postgres |
| `4cbcf58` | 2 ต.ค. | ปรับ registration notice และเพิ่ม BILLING_DATABASE_URL ใน env example |
| `6b9e366` | 2 ต.ค. | เพิ่ม consolidated documentation |
| `9f701da` | 2 ต.ค. | เพิ่ม admin layout guard และ login-throttle tests |
| `93b97d1` | 2 ต.ค. | ลบไฟล์ว่าง 4 ไฟล์ที่ root (`micro-account@0.1.0`, `next`, `psql`, `rmdir`) |
| `faeb48a` | 2 ต.ค. | merge `gitea/main` เข้ามา — gitea/main เคยได้ commit 3 ชุดเดียวกันเป็นคนละ object |

> ตารางนี้แสดง 21 commit จาก 26 ที่มีในสาขาปัจจุบัน · ที่เหลือคือ `cbc8ec1`, `dd6e44d`, `a586411`
> ซึ่งเป็น commit 3 ชุดเดียวกับ `7a79d9b`, `7e4bcdc`, `b432102` แต่ถูก push ไป `gitea/main` ก่อนหน้า
> จึงได้ hash ต่างกัน (ดู 7.5.7)

### 7.2 v0.1.0 — security hardening (2 ต.ค. 2026)

**รายการที่แก้** (จาก `AUDIT-2026-10-01.md` ฉบับ Reassessment)

| ระดับ | ปัญหา | สถานะ | วิธีแก้ |
|---|---|---|---|
| P1 | `updateCompanySettings` ผูก parameter เกิน | ✅ CLOSED | กรอง field ผ่าน `WRITABLE_SETTINGS_COLUMNS` + ไม่ผูก timestamp เพิ่ม |
| P1 | `PUT /api/settings` ไม่ตรวจ admin + แทรก key ลง SQL | ✅ CLOSED | เรียก `requireAdmin()` + identifier มาจาก allowlist |
| P2 | `POST /api/migrate` ไม่ตรวจสิทธิ์ | ✅ CLOSED | เรียก `requireAdmin()` ก่อน ALTER TABLE |
| P2 | สิทธิ์ admin ยังไหลอยู่หลังเปลี่ยน role | ✅ CLOSED | `requireAdmin()` อ่าน role+status จาก DB แบบ real-time |
| P2 | login เปิดเผยว่าอีเมลมี/ไม่มี + ไม่มี throttle | ✅ CLOSED | ข้อความเดียวกันทุกกรณี + ล็อก 15 นาทีเมื่อผิด 10 ครั้ง |
| P3 | `/api/db_schema` เปิด metadata ใบแจ้งหนี้ | ✅ CLOSED | เรียก `requireAdmin()` |

**ไฟล์ใหม่:** `app/admin/layout.tsx`, `app/admin/page.tsx`, `lib/login-throttle.mjs`, `tests/login-throttle.test.mjs`
**ผลทดสอบ:** `pnpm test` → 14/14 ผ่าน ณ 2026-10-02

### 7.3 v0.1.1 — onboarding & install alignment (2 ต.ค. 2026, รอบนี้)

**ปัญหาที่พบ:** อ่านโค้ดจริงแล้วพบ 4 จุดที่เอกสารไม่ตรงกับพฤติกรรม

| # | ไฟล์ | ปัญหา | การแก้ |
|---|---|---|---|
| 1 | `.env.example` | เดิมไม่มี `BILLING_DATABASE_URL` แต่ compose ใช้เป็นตัวแปรต้นทาง | เพิ่ม key ในหมวด 5d; README Docker instructions ได้รับการแก้ให้ตั้งชื่อตัวแปรตรงกันแล้ว |
| 2 | `AUDIT-2026-10-01.md` | ฉบับก่อนหน้าระบุ 12 tests ทั้งที่รันได้ 14 | audit ปัจจุบันระบุ 14 และ full lint/typecheck results แล้ว |
| 3 | `app/admin/modules/page.tsx` | **บั๊กจริง** — `categoryOrder` = `[admin, finance_accounting, finance_tax, stock, hr, sales_co, service]` แต่ registry ใช้ `[sales, operations, master_data, reports, admin]` → **แสดงได้แค่หมวด ADMIN (5 โมดูล) โมดูลธุรกิจอีก 16 โมดูลไม่แสดงเลย** | แก้ `categoryOrder` + เพิ่ม `CATEGORY_LABELS` แสดงชื่อไทย/อังกฤษ |
| 4 | `app/register/page.tsx` | ไม่มีคำอธิบายว่าคนแรกได้ superadmin / คนถัดไปเป็น Pending | เพิ่มกล่องแจ้งเตือน (ตรงกับ logic ใน `registration-bootstrap.mjs`) |

**ผลตรวจสอบ ณ 2 ต.ค. 2026 หลังปิดงานเอกสารรอบนี้:**
```
pnpm test              → 14/14 ผ่าน
pnpm exec tsc --noEmit → สะอาด 0 errors   (เดิม 17 errors ใน tests/taxAutomator.test.ts — ลบแล้ว ดู 7.6.1)
pnpm check:consistency → ผ่าน
```
> ตัวเลขเหล่านี้เป็นสถานะ ณ ตอนปิดงานเอกสารเท่านั้น ปัจจุบันเทสต์เป็น **36/36** เพราะเพิ่ม
> `tests/taxAutomator.test.mts` แล้ว — ดู **7.6.2**

### 7.4 v0.1.2 — เอกสารรวม (2 ต.ค. 2026)

- สร้าง `docs/MICRO-BUSINESS-SUITE-DOCUMENTATION.md` — รวม 7 หัวข้อไว้ไฟล์เดียว
- อ้างอิงเอกสารเดิม 14 ไฟล์ไว้ท้ายเป็นภาคผนวก (ไม่ลบไฟล์ใด)
- อ้างอิง source paths และ symbols ที่ใช้ตรวจ; line numbers ในเอกสารเป็น snapshot และต้อง recheck ก่อนใช้เป็นตำแหน่งอ้างอิง
- **รอบตรวจซ้ำ (2 ต.ค. 2026):** ถอดข้อความที่ยืนยันไม่ได้ออกจากเอกสาร ได้แก่ การอ้างว่า journal เป็น single source of truth ทั้งระบบ, การอ้างว่า `InputTaxValidator` ทำงานอัตโนมัติใน expense flow, การอ้างว่า `checkPermission()` ครอบคลุม invoice creation, ตาราง route ที่นับจาก grep และผลทดสอบตัวเลขที่ล้าสมัย — เหลือเฉพาะที่ตรวจจาก source แล้ว
- ถอดคำสั่งรัน `scripts/CURRENT_SCHEMA_MASTER.sql` ออกจากขั้นตอนติดตั้ง เพราะไฟล์นั้นเป็น schema snapshot เก่าที่สร้าง FK ไปยังตารางก่อนที่ตารางนั้นจะถูกสร้างในไฟล์

### 7.5 ⚠️ ปัญหาที่ยัง**ไม่ได้แก้** — ต้องตัดสินใจ

#### 7.5.1 ⏸️ Backup ไม่เข้ารหัส — พี่ฆังสั่ง "หยุดไว้ก่อน" (2 ต.ค. 2026)

`scripts/auto-backup.mjs:97` — `zlib.gzipSync()` แล้วอัปโหลดตรงขึ้น Google Drive
- ไฟล์มี **ข้อมูลผู้ใช้ทั้งหมด** รวม bcrypt password hash
- Drive ปกติเข้ารหัสระหว่างส่ง (HTTPS + Google encrypt at rest) แต่ **คนที่มีสิทธิ์เข้าโฟลเดอร์อ่านได้**
- ควร: เข้ารหัสก่อนอัปโหลด (เช่น AES-256-GCM) หรือแยกข้อมูลลับออกจาก backup

> พี่ฆังตัดสินใจ **ไม่แก้ในรอบนี้** — คงรายการไว้ติดตาม ต้องทบทวนก่อนเปิดใช้งานจริง
> เพราะไฟล์ backup มีข้อมูลลูกค้าทั้งหมด

#### 7.5.3 Deployment topology ที่ยังต้องเตรียมก่อน deploy

README และ env instructions ได้รับการแก้ให้ตรงกับ Compose แล้ว อย่างไรก็ตาม Compose ยังพึ่ง external PostgreSQL, external network `stack_stack`, การเตรียม schema แยก และ reverse proxy สำหรับการเข้าถึงจากภายนอก การ deploy จริงยังไม่ถูกทดสอบ

#### 7.5.4 Route-level authorization ยังต้องมี inventory ครบ

`proxy.ts` ตรวจ session แต่ไม่ได้แทน per-route RBAC; ยังไม่ควรใช้ตัวเลข route ที่ผ่าน/ไม่ผ่าน guard จาก grep เดี่ยวเป็นหลักฐานรับรอง production
- จัดทำ inventory ของ API และ server actions พร้อม permission ที่ต้องใช้
- เพิ่ม route-level tests สำหรับ role และ module permission หลังยืนยัน policy ของแต่ละ endpoint

#### 7.5.5 GitHub workflow และคุณภาพ static checks

- ไม่พบ `.github/workflows/` ใน repository ณ วันที่ตรวจ; ไม่ได้ยืนยัน CI จาก provider อื่น
- `pnpm exec tsc --noEmit` ณ 2026-10-02: **สะอาด 0 errors** (เดิม 17 errors — ลบ `tests/taxAutomator.test.ts` ตามดู 7.6.1)
- `pnpm test` ณ 2026-10-02: **36 passed** — `tests/**/*.test.mjs` 4 ไฟล์ + `tests/taxAutomator.test.mts` (เพิ่มใหม่ ดู 7.6.2)
  สคริปต์เปลี่ยนเป็น `node --import tsx --test tests/**/*.test.mjs tests/**/*.test.mts`
- `pnpm lint` ณ 2026-10-02: **363 errors, 169 warnings** — ยังไม่ได้แก้ ต้องตัดสินใจว่าจะลด scope หรือทยอยแก้
  (ไฟล์เทสต์ใหม่ lint สะอาด 0 warnings ตัวเลขรวมไม่เปลี่ยน)

#### 7.5.6 Lazy migration ขัดกับนโยบายตัวเอง

ดูข้อ 6.6 — `CREATE TABLE IF NOT EXISTS` เรียกตอนใช้งาน ขัดกับ `RBAC_STANDARD.md:40-42`

#### 7.5.7 ประวัติ commit ซ้ำระหว่างสอง remote

commit 3 ชุดเดียวกันถูกสร้างเป็น 2 object คนละ hash เพราะถูก commit/push ไปคนละ remote ก่อนที่สองฝั่งจะ sync กัน:

| สาขานี้ | `gitea/main` | เนื้อหา |
|---|---|---|
| `7a79d9b` | `cbc8ec1` | gitignore license_key.txt + .opencode/ |
| `7e4bcdc` | `dd6e44d` | เลิก track next-env.d.ts |
| `b432102` | `a586411` | hosting query ผ่าน lib/db |

แก้แล้วด้วย merge commit `faeb48a` — ตอนนี้ `gitea/main` เป็น ancestor ของสาขานี้แล้ว

> ต่างกันจุดเดียว: `gitea/main` ยังเก็บไฟล์ว่าง 4 ไฟล์ที่ root (`micro-account@0.1.0`, `next`, `psql`, `rmdir`)
> ซึ่งถูกลบใน `93b97d1` — ถ้า merge `main` กลับเข้ามาเมื่อไร ไฟล์เหล่านี้จะกลับมาต้องลบซ้ำ
> ที่มาของไฟล์: คำสั่งลบที่ redirect ผิดทางจึงสร้างไฟล์เปล่าแทนที่จะลบ — ควรใช้ `rm` ที่ quote path เสมอ

### 7.6 ✅ แก้แล้ว — ปิดรายการที่ตัดสินใจแล้ว

#### 7.6.1 ลบ `tests/taxAutomator.test.ts` (พี่ฆังสั่ง 2 ต.ค. 2026)

**อาการเดิม:** `pnpm test` ผ่าน 14/14 แต่ `pnpm exec tsc --noEmit` แจ้ง error 17 จุด

**สาเหตุ 2 ชั้น:**

1. **ไม่ได้รันโดย test script** — `package.json` ใช้ `node --test tests/**/*.test.mjs` → เลือกเฉพาะ `.mjs`; TypeScript compiler ยังตรวจ `.test.ts` แล้วพบ errors
   → เทสต์ภาษีทั้งชุด **ไม่เคยทำงาน** ตั้งแต่เขียนมา
2. **โค้ดพังจริง** — เขียนสมัยที่ API เป็น sync:
   - `COMPANY_TAX_ID`, `COMPANY_ADDRESS` — **ไม่มี export** นี้ใน `lib/taxAutomator.ts` (export มีแค่ `TAX_FILING_URLS`, `RD_EFILING_HOMEPAGE` ที่ `:6`/`:14` และ 4 class — ย้ายไปอ่านจาก `company_settings` ผ่าน `getCompanySettings()` ที่ `:37` แล้ว)
   - `InputTaxValidator.validate()` เป็น **async** แต่เทสต์ไม่ `await` → เทสต์จะอ้าง property ของ Promise

**ที่เลือก:** ลบทิ้ง เพราะเทสต์นี้ไม่เคยรันมาก่อน จึงไม่มี "ที่ผ่านมาก่อน" ที่จะสูญเสีย
และการคงไว้ทำให้ type-check แดงต่อเนื่อง ไม่ได้ช่วยจับบั๊กใด ๆ

**ผลหลังลบ (รันคำสั่งจริง):**
```
pnpm test              → 14/14 ผ่าน
pnpm exec tsc --noEmit → สะอาด 0 errors
pnpm lint              → 532 problems (363 errors, 169 warnings) — ไม่เปลี่ยน
```

> **ผลหลังลบ:** โค้ดที่หายไปเป็นเทสต์ที่พังตั้งแต่แรก (ดูรายละเอียดด้านบน)
> ต่อมาพี่ฆังสั่งให้เขียนเทสต์ภาษีขึ้นใหม่ทั้งชุด และทำเสร็จแล้ว — ดู **7.6.2**

#### 7.6.2 ✅ เขียน `tests/taxAutomator.test.mts` ครอบคลุม 4 class (พี่ฆังสั่ง 2 ต.ค. 2026)

**ผลรันจริง:**
```
pnpm test               → 36/36 ผ่าน (เดิม 14)
pnpm exec tsc --noEmit  → สะอาด 0 errors
pnpm check:consistency  → ผ่าน
pnpm lint               → 532 problems (เท่าเดิม ไฟล์ใหม่สะอาด 0 warnings)
```

**ทำไมเป็น `.mts` ไม่ใช่ `.ts`:** `package.json` ไม่มี `"type": "module"` → tsx/esbuild
ตีความ `.ts` เป็น CommonJS และตายด้วย `Top-level await is currently not supported with the "cjs" output format`
ต้องการ `.mts` เพื่อบังคับ ESM

**ทำไมต้อง dynamic import:** `lib/taxAutomator.ts` → `lib/settings.ts` → `lib/db.ts`
และ `lib/db.ts` **throw ตอน module load** ถ้าไม่มี `POSTGRES_URL`
(`FATAL: Database connection URL is not configured`) จึงต้อง set env ให้เสร็จก่อน import จึงเขียนเป็น `await import(...)`

**ทำไมต้องทับ env ไม่ใช่ใช้ค่าเดิม:** `getCompanySettings()` เรียก `ensureCompanySettingsTable()`
ซึ่งรัน DDL — ถ้า test สืบทอด `POSTGRES_URL` จริงจากผู้พัฒนา เทสต์หน่วยจะเขียนลงฐานข้อมูลจริง
จึงกำหนด `process.env.POSTGRES_URL` เป็น loopback ที่ปิด (`127.0.0.1:1`) แบบไม่มีเงื่อนไข
connection ล้มเหลวทันที `getCompanySettings()` กลืน error เองคืน `{ success: false }` → `company.data` เป็น `undefined`
**ไม่มีการต่อฐานข้อมูลจริงในการรันเทสต์**

**สิ่งที่ครอบคลุม (22 เทสต์):**
| class | ครอบคลุม |
|---|---|
| `WithholdingTaxEngine` | เกณฑ์ 1,000 บาท · continuous contract · อัตรา Rent/Advertisement/Transport · เลือก ภ.ง.ด. 53/3 · service ที่ไม่อยู่ใน map |
| `OverseasServiceTrigger` | ต่างประเทศ+บริการ → ภ.พ. 36 · ในประเทศ · ต่างประเทศแต่ไม่ใช่บริการ |
| `TaxCalendarAlerts` | วันที่ 1/5/10 แบบกระดาษ · e-Filing 15–20 พร้อมลิงก์ ภ.พ. 30 · วันธรรมดาเงียบ · 1 ส.ค. มี ภ.ง.ด. 51 · RD homepage |
| `InputTaxValidator` | invoice ครบ/ไม่ครบ · VAT ตรง 7% · VAT ผิด · หมวดต้องห้าม 2 แบบ · ไม่มี VAT · เงื่อนไข float |

**เจอบั๊กจริงระหว่างเขียน — VAT tolerance 1 สตางค์ไม่ทำงาน:**
`lib/taxAutomator.ts:64` คอมเมนต์ว่า *"Allow slight floating point discrepancy (1 satang)"*
แต่เงื่อนไขคือ `Math.abs(expectedVat - actualVat) > 0.01` และ float ทำให้ช่องว่าง 1 สตางค์ออกมาเป็น
`0.010000000000005116` ซึ่ง **มากกว่า 0.01 จริง** → ต่าง 1 สตางค์ถูกปฏิเสธ ไม่ใช่ถูกยอมรับ
ยืนยันด้วยการรันจริง: `netAmount: 1000, vatAmount: 70.01` → ขึ้น error `ยอด VAT ไม่ถูกต้อง`

เทสต์ที่เขียนไว้ **pin พฤติกรรมจริง** (ปฏิเสธ) พร้อมคอมเมนต์อธิบาย ไม่ได้แก้ `lib/taxAutomator.ts`
เพราะพี่ฆังสั่งไม่แตะ logic ภาษี — **การเปลี่ยน threshold เป็นการตัดสินใจทางภาษี ต้องให้ผู้ทำบัญชี/ผู้พัฒนาตัดสิน**

**ยังไม่ครอบคลุม 1 branch เดียว:** การเทียบ `taxId`/`address` กับ `company_settings`
เพราะต้องมีฐานข้อมูลจริง — เทสต์จึงไม่ส่ง `taxId`/`address` เลย ทำให้ทุก assertion
ข้างบนไม่ขึ้นกับว่าฐานข้อมูลต่อได้หรือไม่

> **ยังค้างอยู่:** ไม่มีการเรียก `InputTaxValidator` จาก expense UI/action (ดูข้อ 2)
> คือโค้ดภาษีที่ทดสอบแล้ว **ยังไม่ถูกเรียกใน workflow จริง** — coverage ไม่ได้แปลว่ามีผลใช้งาน


---

## 8. ภาคผนวก — เอกสารเดิม

ไฟล์เหล่านี้**ยังอยู่ครบ ไม่ได้ลบ** เนื้อหาละเอียดอยู่ในไฟล์เหล่านี้:

| ไฟล์ | เนื้อหา/ข้อควรระวัง |
|---|---|
| `docs/COMPLETE_MANUAL.md` | คู่มือโมดูล; มี caveat สำหรับขั้นตอนที่ยังไม่ยืนยัน |
| `docs/THAI_TAX_GUIDE.md` | ข้อมูลประกอบภาษี; ต้องตรวจข้อกำหนดปัจจุบันกับผู้ทำบัญชี |
| `docs/USER_MANUAL.md`, `docs/manual.md` | คู่มือผู้ใช้; บาง workflow มีข้อจำกัดระบุไว้ |
| `docs/DECISIONS.md`, `docs/BUSINESS_RULES.md` | บันทึก decisions และกฎธุรกิจ |
| `docs/SUPPLIER_INVOICE_GUIDE.md` | แจ้งความขัดแย้ง COA/WHT กับ implementation |
| `docs/LOGIN_PROBLEM_RESOLVED.md` | ประวัติ login; root cause เก่ายังยืนยันย้อนหลังไม่ได้ |
| `docs/ARCHITECTURE.md`, `docs/CHANGELOG_PROJECT.md` | สถาปัตยกรรมและ changelog |
| `docs/RBAC_STANDARD.md`, `docs/KNOWLEDGE_PACK.md` | มาตรฐานสิทธิ์และลำดับเอกสารความรู้ |
| `docs/PND53.txt`, `docs/PP30.txt` | คำเตือน placeholder; ไม่ใช่ template สำหรับยื่นภาษี |

**ไฟล์ที่อยู่ที่ root (ไม่ใช่ใน docs/):**
| ไฟล์ | เนื้อหา |
|---|---|
| `AUDIT-2026-10-01.md` | ผล reassessment ด้านความปลอดภัยและ verification limits |
| `CORE_RULES.md` | กฎระบบหลัก |
| `AUTH_RULES.md` | ข้อกำหนด authentication |

**ผู้ควรอ่านอะไรก่อน:**
- ลูกค้า → คู่มือที่ผ่านการตรวจล่าสุด พร้อมตรวจข้อจำกัดในเอกสารรวมก่อนใช้ workflow ที่เกี่ยวกับภาษี/บัญชี
- ผู้ดูแล → หัวข้อ 4 ของไฟล์นี้ + `RBAC_STANDARD.md`
- นักพัฒนา → `CORE_RULES.md` + หัวข้อ 6 ของไฟล์นี้
- ฝ่ายภาษี → `THAI_TAX_GUIDE.md`

---

*เอกสารนี้สะท้อนสถานะโค้ด ณ 2 ต.ค. 2026 · ทุกการแก้ไขจากนี้ไปต้องบันทึกในหัวข้อ 7 ของไฟล์นี้*
