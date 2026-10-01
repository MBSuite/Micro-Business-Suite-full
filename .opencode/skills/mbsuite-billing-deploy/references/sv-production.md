# โหมด B — sv production (external stack-db + Tailscale HTTPS)

ใช้เฉพาะเซิร์ฟเวอร์ `sv` (192.168.1.200) — ต่างจากโหมด A ตรงที่ใช้ DB กลางร่วมกับ stack อื่น

## ข้อเท็จจริงที่ตรวจแล้ว

| ข้อ | ค่า |
|---|---|
| URL ใช้งาน | `https://sv.tail7b4d4a.ts.net:8443` |
| container | `mbs-app` · port ใน container `3000` |
| port บน host | ผูก **แค่ `127.0.0.1:3001`** (loopback) |
| DB | `mbs_billing` ใน container `stack-db` (PostgreSQL 18.6) |
| role | `mbs_billing` — non-superuser, no createdb, no createrole |
| network | external `stack_stack` (ชื่อจริง — **ไม่ใช่** `stack_default`) |
| secrets | `/datastore/secrets/billing.env` (mode `600`, dir `700`) |
| repo บน sv | `/home/devg/MBSuite/Hosting-Billing-System` → Gitea `MBSuite/Micro-Business-Suite-full` |

## ⚠️ กับดักของโหมดนี้

1. **`coolify-proxy` (Traefik) จับ `0.0.0.0:443`** → Tailscale Serve bind 443 ไม่ได้
   อาการ: `https://...` ตอบ *"no available server"* + cert เป็น `CN=TRAEFIK DEFAULT CERT`
   → **ไม่ใช่ปัญหา cert** · ใช้ port 8443 · หรือขออนุมัติก่อนแตะ Coolify
2. **ต้องใช้ `--env-file /datastore/secrets/billing.env` เสมอ** ไม่งั้น DB/license ไม่เข้า container
3. **port `3000` ชน `stack-gitea`, `5432` ชน `neopulse-db`** → อย่าใช้ ต้องเช็คจริงก่อน
4. **DB isolation** — `mbs_billing` ถูก REVOKE ไม่ให้แตะ DB อื่น
   เพิ่ม/ถอน REVOKE ต้องขออนุมัติพี่ก่อน
5. **ตาราง `users_backup_1773898881424`** สืบทอดจาก schema dump — **ห้าม drop**
6. ทุกคำสั่ง `sudo` ผ่าน `~/python-tools/sv.py` เท่านั้น

## Deploy / Redeploy

```bash
ssh devg@192.168.1.200
cd /home/devg/MBSuite/Hosting-Billing-System
docker compose --env-file /datastore/secrets/billing.env up -d --build
```

ตรวจหลังรัน:
```bash
docker ps --filter name=mbs-app --format "{{.Ports}}"    # ต้องเป็น 127.0.0.1:3001->3000/tcp
curl -s -o /dev/null -w "%{http_code}\n" https://sv.tail7b4d4a.ts.net:8443/login   # 200
docker logs mbs-app 2>&1 | grep -iE "error|license|fail|exception" | tail -5        # ต้องว่าง
```

## ตั้ง HTTPS (Tailscale Serve)

```bash
# 1. ต้องเปิด HTTPS Certificates ใน https://login.tailscale.com/admin/dns ก่อน
sudo tailscale cert sv.tail7b4d4a.ts.net      # ได้ cert = ตั้งแล้ว

# 2. ตั้ง Serve (ผ่าน sv.py)
python3 ~/python-tools/sv.py "tailscale serve --bg --https=8443 http://127.0.0.1:3001"

# 3. verify
tailscale serve status     # ต้องขึ้น (tailnet only)
```

ยืนยัน cert ไม่ใช่ Traefik:
```bash
echo | openssl s_client -connect sv.tail7b4d4a.ts.net:8443 -servername sv.tail7b4d4a.ts.net 2>/dev/null \
  | openssl x509 -noout -subject -issuer
# คาดหวัง: CN=sv.tail7b4d4a.ts.net + Let's Encrypt  (ไม่ใช่ TRAEFIK DEFAULT CERT)
```

Serve config อยู่ใน `/var/lib/tailscale/tailscaled.state` → **ทน reboot**
ไฟล์ cert/key ที่ `tailscale cert` เขียนใน home **ลบทิ้งได้** Serve จัดการเอง
ปิดเมื่อจำเป็น: `tailscale serve --https=8443 off`
**ห้ามเปิด Funnel** = ห้ามหลุด public (พี่ตัดสินใจ Tailscale-only)

## Smoke test

```bash
./scripts/test_login.sh                      # ใช้ default ของโหมด B
```

## ตรวจ DB ในโหมดนี้

role คือ `mbs_billing` (ไม่มี role `postgres`):
```bash
docker exec stack-db psql -U mbs_billing -d mbs_billing -c "\dt"    # 40 ตาราง
```

## เปลี่ยนจากโหมด A มาโหมด B

ต่างกันแค่ที่มาของ DB และวิธี expose — โค้ดแอปไม่ต้องแก้:
- compose ผูก external network `stack_stack` + env `BILLING_DATABASE_URL` แทน service `db`
- ย้ายข้อมูล: `pg_dump` จาก `mbs` (โหมด A) → restore เข้า `mbs_billing` (โหมด B)
  อย่า copy volume ข้ามเครื่อง
