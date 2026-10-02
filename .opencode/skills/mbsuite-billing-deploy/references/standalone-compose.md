# โหมด A — self-contained docker compose (postgres sidecar)

ใช้เมื่อเครื่องปลายทาง**ไม่มี** external DB อย่าง `stack-db` — compose สร้าง postgres ของตัวเอง
เหมาะกับเครื่อง workspace, local, staging

> ทดสอบจริงบนเครื่อง workspace (Docker 29, Ubuntu 26.04) 2026-10-02 → ผ่าน
> (ยกเว้น `/hosting/*` ที่ commit เก่ายังไม่มี route)

## ข้อเท็จจริงที่ตรวจแล้ว

- compose มี 2 service: `db` (`postgres:16-alpine`, container `mbs-db`) + `app` (`mbs-app`)
- `db` มี volume `mbs-db-data` + healthcheck (`pg_isready -U mbs -d mbs`)
- schema init อัตโนมัติจาก `./scripts/backup.sql` (35 ตาราง) + `./scripts/init-chart-of-accounts.sql`
  mount ไว้ที่ `/docker-entrypoint-initdb.d/` → **รันครั้งเดียวตอน volume ยังว่าง**
- `app` ตั้ง `POSTGRES_URL`/`DATABASE_URL` inline เป็น `postgresql://mbs:...@db:5432/mbs?sslmode=disable`
  → ไม่พึ่ง external DB · `depends_on: db: condition: service_healthy`
- `app` build เป็น `output: standalone` · `NODE_ENV=production` → cookie เป็น `Secure`

## ⚠️ กับดักของโหมดนี้ (เรียงตามลำดับที่เจอจริง)

1. **compose plugin ไม่มีใน Ubuntu บางตัว** (Docker 29 บน Ubuntu 26.04)
   อาการ: `docker: unknown command: docker compose`
   - มี sudo: `sudo apt update && sudo apt install -y docker-compose-v2`
   - **ไม่มี sudo (ถ้าอยู่ในกลุ่ม `docker`):** ติดตั้งเป็น CLI plugin ระดับ user
     ```bash
     mkdir -p ~/.docker/cli-plugins
     curl -fL -o ~/.docker/cli-plugins/docker-compose \
       https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64
     chmod +x ~/.docker/cli-plugins/docker-compose
     # แนะนำ: เทียบ sha256 กับ checksums.txt ของ release เดียวกันก่อนใช้
     docker compose version    # ต้องขึ้น v2.20+ (ทดสอบได้ v5.5.1)
     ```
2. **compose อ่าน `.env` ไม่ใช่ `.env.local`** → ส่ง `--env-file .env.local` ทุกครั้ง
   ถ้าลืม `${NEXTAUTH_SECRET}`/`AUTH_SECRET` จะว่างและแอป fatal
3. **`port 3000` ไม่ว่างเสมอ** — ตรวจก่อนด้วย `ss -ltn | grep ':3000'`
   ถ้าชน (มี process ของ user อื่นจับอยู่) ให้ map เป็น `127.0.0.1:3002:3000` **โดยไม่แก้ไฟล์ใน repo**
   ด้วย override + Compose tag `!override` (ต้อง ≥ v2.20):
   ```yaml
   # /tmp/mbs-local.override.yml
   services:
     app:
       ports: !override ["127.0.0.1:3002:3000"]
     db:
       ports: !override ["127.0.0.1:5432:5432"]
   ```
   แล้วเรียก `-f docker-compose.yml -f /tmp/mbs-local.override.yml` (bind DB ไว้ loopback ปลอดภัยกว่า)
4. **`.env.local` มักเป็น template ยังไม่ใส่ค่าจริง** — ค่าอาจเป็น `your_...` (placeholder)
   ทำให้ license gate ล้ม (`Invalid license key format` / `signature verification failed`)
   สำหรับทดสอบ local ให้ mint license เฉพาะเครื่อง **โดยไม่แก้ `.env.local`** (ส่งผ่าน shell env ทับ):
   ```bash
   SALT=$(openssl rand -base64 48 | tr -d '\n')
   # ⚠️ ต้องส่ง LICENSE_SALT ให้ issuer ในคำสั่งเดียวกันที่เซ็น — ไม่งั้น signature ไม่ตรง
   LICENSE_SALT="$SALT" node scripts/issue-license.mjs --mode perpetual \
     --company "Local-Test" --licensee admin@localhost --type ENTERPRISE --out /tmp/lic.txt >/dev/null
   export MBS_LICENSE_KEY="$(cat /tmp/lic.txt)"; rm -f /tmp/lic.txt
   export LICENSE_SALT="$SALT"
   export AUTH_SECRET="$(openssl rand -hex 32)"; export NEXTAUTH_SECRET="$AUTH_SECRET"
   export NEXTAUTH_URL="http://localhost:3002"
   ```
5. **`backup.sql` ไม่มีข้อมูล (ไม่มี INSERT)** → DB ใหม่**ไม่มี admin user** และ repo ไม่มี seed script
   ต้อง seed เอง (โหมด A มี DB published บน `127.0.0.1:5432` → seed จาก host ได้):
   ```js
   // node seed-admin.mjs  (ใช้ bcryptjs + pg ของโปรเจกต์)
   const bcrypt = require("bcryptjs"), { Client } = require("pg");
   const hash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 10);
   const c = new Client({ host:"127.0.0.1", port:5432, user:"mbs", password:"mbs", database:"mbs" });
   await c.connect();
   await c.query("INSERT INTO users (name,email,password,role,status) VALUES ($1,$2,$3,$4,$5)",
     [process.env.SEED_ADMIN_NAME||"Administrator", process.env.SEED_ADMIN_EMAIL, hash, "Administrator", "Active"]);
   await c.end();
   ```
   ต้องรัน node จาก project dir (ให้ `require` เจอ `node_modules`) · `role` ต้องสื่อความ "admin"
   ตามที่ `app/admin` gate ใช้ · ไม่พิมพ์รหัสผ่าน/hash ลง stdout
6. **`.env.local` อาจเป็น CRLF (Windows) + ค่ามีช่องว่างโดยไม่ใส่ quote** (เช่น `GMAIL_APP_PASSWORD=xxxx xxxx`)
   → **ห้าม `source` ไฟล์ตรง ๆ** (จะได้ `\r` ติดค่า + พยายามรันคำสั่ง) · `test_login.sh` อ่านแบบทน CRLF แล้ว
7. **Secure cookie กับ `http://<LAN-IP>`** — เบราว์เซอร์ไม่เก็บ cookie → login ไม่ได้
   · `http://localhost:*` ใช้ได้ (secure context) · ถ้าเปิดจากเครื่องอื่นต้องมี HTTPS ด้านหน้า
8. **`license_key.txt` / `MBS_LICENSE_KEY` ห้าม commit** — อยู่ `.env.local` หรือ secret store
9. **schema init รันครั้งเดียว** — แก้ `backup.sql` ทีหลังต้อง `down -v` (ลบข้อมูลทั้งหมด — ถามพี่ก่อน)

## ขั้นตอน deploy (แบบไม่แตะ repo)

```bash
D="<project dir>"                 # ที่มี docker-compose.yml
docker compose version            # ต้องมี (กับดัก 1)
ss -ltn | grep ':3000' || echo "3000 ว่าง"
# สร้าง override ถ้า port ชน/ต้องการ bind loopback (กับดัก 3)

# เตรียม env (กับดัก 4) — export MBS_LICENSE_KEY/LICENSE_SALT/AUTH_SECRET/NEXTAUTH_SECRET
export NEXTAUTH_URL="http://localhost:3002"

docker compose -f "$D/docker-compose.yml" -f /tmp/mbs-local.override.yml \
  --env-file "$D/.env.local" up -d --build
docker compose ps
```

ตรวจหลังรัน:
```bash
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E 'mbs-app|mbs-db'
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/login    # 200
docker exec mbs-db psql -U mbs -d mbs -tAc \
  "select count(*) from information_schema.tables where table_schema='public';"   # 35
docker logs mbs-app 2>&1 | grep -iE "license|error|fail|exception" | tail -5     # ต้องว่าง
```

## Smoke test

`test_login.sh` อ่าน secrets แบบทน CRLF (ไม่ใช้ `source`) → ชี้ไป `.env.local` ดิบได้เลย

```bash
BASE_URL=http://localhost:3002 SECRETS="$D/.env.local" APP_CONTAINER=mbs-app \
EXPECT_HTTPS=1 EXPECT_BLOCKED=" " \
  ./scripts/test_login.sh
```

`EXPECT_BLOCKED` ต้องใส่ค่าที่ไม่ว่าง (เช่น `" "`) ถ้าต้องการข้ามเช็ค HTTP ตรง — เพราะ `${VAR:-default}` จะคืน default เมื่อค่าว่าง

## ตรวจ DB ในโหมดนี้

postgres อยู่ container `mbs-db` (ไม่ใช่ `stack-db`), user/db คือ `mbs`:
```bash
docker exec mbs-db psql -U mbs -d mbs -c "\dt"     # ต้องได้ 35 ตาราง
```

## ปิด / ล้าง

```bash
docker compose -f "$D/docker-compose.yml" -f /tmp/mbs-local.override.yml \
  --env-file "$D/.env.local" down       # เก็บ volume (ข้อมูลอยู่)
docker compose ... down -v              # ลบ volume ด้วย (ข้อมูลหาย — ถามพี่ก่อน)
```

## ข้อมูลที่ต้องรู้เพิ่ม

- `scripts/backup.sql` เป็น schema source ที่ถูกต้อง (ไม่ใช่ `CURRENT_SCHEMA_MASTER.sql`, FK พัง 9 ตาราง)
- `users_backup_1773898881424` เป็นตาราง backup เก่า — ห้าม drop
- ถ้า login ไม่ผ่านเพราะ license: ตรวจว่า `MBS_LICENSE_KEY` เซ็นด้วย `LICENSE_SALT` **ตัวเดียวกับ** ที่แอปใช้
- ย้ายข้อมูลจากโหมด B (sv) มาโหมดนี้: `pg_dump` จาก `mbs_billing` แล้ว restore เข้า `mbs` — อย่า copy volume ข้ามเครื่อง
- commit เก่าอาจยังไม่มี `app/hosting/` → `/hosting/plans` ตอบ 404 ได้ (ไม่ใช่บั๊ก deploy)
