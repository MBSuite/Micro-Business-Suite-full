---
name: mbsuite-billing-deploy
description: Deploy, serve, smoke-test, or rename the MBSuite Hosting-Billing-System app. Supports two database topologies - a self-contained docker compose with a postgres sidecar (local/staging, no external DB needed) or the sv production stack using external stack-db plus Tailscale-only HTTPS. Use when asked to deploy/redeploy the billing app, fix billing login or "Secure cookie" problems, set up or change HTTPS/Tailscale access, check billing DB tables or backups, change the app display name to MBSuite, or run the login smoke test. Do NOT use for Next.js apps on Vercel/Neon, or the Micro-Account project.
version: 2.1.0
license: MIT
compatibility: opencode
---

# MBSuite — Hosting-Billing-System (deploy / test / rename)

แอป Billing (container `mbs-app`) รองรับ **2 โหมดฐานข้อมูล** — เลือกตามเครื่องปลายทาง
ทุกค่าที่ระบุในนี้มาจากการตรวจเครื่องจริงแล้ว ไม่ใช่การเดา

## เลือกโหมดก่อนเริ่ม

| โหมด | ฐานข้อมูล | ใช้เมื่อ | รายละเอียด |
|---|---|---|---|
| **A — self-contained** | postgres sidecar ใน compose เอง | เครื่องทั่วไป, local, staging, workspace | `references/standalone-compose.md` |
| **B — sv production** | external `stack-db` + Tailscale HTTPS | เซิร์ฟเวอร์ `sv` (192.168.1.200) | `references/sv-production.md` |

ตรวจก่อนว่ากำลังทำเครื่องไหน แล้วเปิด reference ของโหมดนั้น — อย่าปนค่าของสองโหมด

## Gotchas (ใช้ทั้งสองโหมด)

1. **`Secure` cookie:** `NODE_ENV=production` ตั้ง cookie เป็น `Secure` → เปิดผ่าน
   `http://<LAN-IP>` เบราว์เซอร์จะ login ไม่ได้ · ยกเว้น **`http://localhost`** ที่ browser
   ถือเป็น secure context → ใช้ได้ · ทางแก้จริงคือ HTTPS (โหมด B ทำแล้ว)
2. **ห้ามแก้ identifier ที่ผูก license** — `lib/license.ts` เช็ค `product === "micro-business-suite"`
   แก้แล้ว **license key เดิมพังทั้งหมด** (gate 500) · ต้องแก้ `scripts/issue-license.mjs` คู่และออก key ใหม่ — ขออนุมัติก่อน
3. **`scripts/CURRENT_SCHEMA_MASTER.sql` ใช้เป็น schema source ไม่ได้** (FK พัง, 9 ตาราง)
   → ใช้ **`scripts/backup.sql`** (35 ตาราง) เป็นตัวจริง
4. **`.env.local` อ่านยากหลายทาง** — (ก) มีคีย์ซ้ำ 2 ชุด → สคริปต์ที่ "เก็บค่าแรก" ได้ค่าผิด (เคยทำ license 500) · (ข) อาจเป็น CRLF (Windows) + ค่ามีช่องว่างไม่ใส่ quote → **ห้าม `source` ไฟล์ตรง ๆ** (ค่าได้ `\r` ติด, มีการรัน command) ให้ใช้ตัวอ่าน last-wins ที่ทน CRLF
5. **repo ทั้งสองฝั่งมีงานค้างของพี่เสมอ** → ห้าม `git add -A` · `license_key.txt` ห้าม commit
6. **การ seed admin** — `backup.sql` มีแต่ schema ไม่มีข้อมูล → DB ใหม่**ไม่มี admin user** และ repo ไม่มี seed script · โหมด A มี DB published `127.0.0.1:5432` → seed จาก host ด้วย `bcryptjs`+`pg` ของโปรเจกต์ได้ · โหมด B ไม่มี DB port → seed ใน `node:22-alpine` + mount `node_modules` แล้วลบตัวเอง
7. **port ต้อง verify ด้วย `ss`/`docker ps` จริงก่อนเลือก** ไม่ใช่เดา
   (`3000` ชน `stack-gitea` บน sv / บนเครื่อง workspace เองก็มีคนจับ `3000`)

## Deploy — โหมด A (self-contained)

```bash
cd "<project dir>"
docker compose --env-file .env.local up -d --build
docker compose ps
```

ต้องมี compose plugin — Ubuntu บางตัวไม่มี (ดูวิธีติดตั้งใน reference)
compose นี้มี service `db` (postgres:16-alpine) + healthcheck + init จาก `backup.sql` ให้เอง

## Deploy — โหมด B (sv production)

```bash
ssh devg@192.168.1.200
cd /home/devg/MBSuite/Hosting-Billing-System
docker compose --env-file /datastore/secrets/billing.env up -d --build
```

ต้องใช้ `--env-file` เสมอ · URL `https://sv.tail7b4d4a.ts.net:8443` · รายละเอียด Serve/DB isolation อยู่ใน reference

## Smoke test (ใช้ได้ทั้งสองโหมด)

`scripts/test_login.sh` POST `/api/login` เก็บ **cookie จริง** แล้วยิงหน้าจริง
— พิสูจน์ว่าเบราว์เซอร์ใช้ได้ ไม่ใช่แค่ auth ทำงาน · ไม่พิมพ์ secret ลง stdout

```bash
# โหมด B (ค่า default)
./scripts/test_login.sh

# โหมด A บน localhost (ใช้ 3002 ถ้า 3000 ชน)
BASE_URL=http://localhost:3002 SECRETS=.env.local ./scripts/test_login.sh
```

สคริปต์อ่าน secrets แบบ **ทน CRLF** และไม่ใช้ `source` (ดู gotcha 4) · ค่าที่ต้องมีคือ
`SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD`

ผลที่ต้องได้: `/login` 200 · login `success:true` + role · cookie เข้า jar · 7 หน้า 200 ·
ไม่มี cookie → 307 ไป `/login` · log ไม่มี error (โหมด B เพิ่มเช็ค HTTP ตรงถูกปิด)

**หมายเหตุ:** `/dashboard` และ `/hosting` ตอบ 404 เพราะ**ไม่มี route นี้ในโค้ด** (มีแค่
`/hosting/plans` กับ `/hosting/subscriptions`) — ไม่ใช่บั๊ก

## เปลี่ยนชื่อแอปเป็น MBSuite

เปลี่ยนเฉพาะ **display name** ที่มองเห็น — ห้ามแตะชื่อโฟลเดอร์

```
"MICRO BUSINESS SUITE"  -> "MBSUITE"
"Micro Business Suite"  -> "MBSuite"
"Micro-Business-Suite"  -> "MBSuite"
```

**ห้ามแตะ** (identifier ผูกกับ format ภายนอก):

| ไฟล์ | ค่าที่ต้องคง |
|---|---|
| `lib/license.ts` | `product: "micro-business-suite"` (2 จุด) — แก้แล้ว license เดิมใช้ไม่ได้ |
| `scripts/issue-license.mjs` | `product: "micro-business-suite"` |
| `scripts/auto-backup.mjs` | `kind: "micro-business-suite-db-backup"` — ผูกกับไฟล์ backup เดิม |
| `package.json` / `package-lock.json` | `"name": "micro-business-suite"` |

`.env.local` และ `license_key.txt` ห้ามแตะเด็ดขาด (secret)
หลังแก้ต้อง rebuild + ทดสอบว่า license gate ผ่าน · login ยัง 200 · commit เฉพาะไฟล์ที่แก้

## Agent Guidelines

- **ห้ามเดา** — ทุกค่าใน skill นี้ผ่านการตรวจเครื่องจริง ถ้าไม่แน่ใจให้ตรวจซ้ำก่อน
- ระบุโหมดให้ชัดก่อนทำทุกครั้ง — ค่าของโหมด A กับ B ต่างกัน
- secret อยู่จุดเดียวต่อโหมด: โหมด A `.env.local` · โหมด B `/datastore/secrets/billing.env`
  — ห้ามพิมพ์ค่า ห้าม commit
- ทุกคำสั่ง `sudo` บน sv ผ่าน `~/python-tools/sv.py` เท่านั้น
- แก้ compose ต้อง verify port ด้วย `ss`/`docker ps` หลัง `up -d` ทุกครั้ง
- ทดสอบ login ต้องใช้ cookie จริงจาก `/api/login` ไม่ใช่ส่ง token ด้วยมือ
- แก้ `lib/license.ts` · revoke DB · แตะ Coolify/DNS → ขออนุมัติพี่ก่อนเสมอ
- ไม่แตะ reverse proxy ของเว็บหลัก (โหมด B ตัดสินใจ Tailscale-only แล้ว)
