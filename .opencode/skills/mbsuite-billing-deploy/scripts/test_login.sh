#!/bin/bash
# Smoke test login ของ MBSuite — ใช้ cookie จริงจาก /api/login
# ใช้ได้ทั้ง 2 โหมด (A: self-contained, B: sv production)
# ไม่พิมพ์ token/รหัสผ่านลง stdout · อ่าน credential จาก secrets file จุดเดียว
#
# โหมด B (default):
#   ./test_login.sh
# โหมด A:
#   BASE_URL=http://localhost:3000 SECRETS=.env.local ./test_login.sh
#
# env ที่ปรับได้: BASE_URL SECRETS EXPECT_HTTPS APP_CONTAINER EXPECT_BLOCKED
set -uo pipefail

BASE_URL="${BASE_URL:-https://sv.tail7b4d4a.ts.net:8443}"
SECRETS="${SECRETS:-/datastore/secrets/billing.env}"
APP_CONTAINER="${APP_CONTAINER:-mbs-app}"
# โหมด B: คาดหวัง https + HTTP ตรงถูกปิด · โหมด A: ตั้ง EXPECT_HTTPS=0
EXPECT_HTTPS="${EXPECT_HTTPS:-1}"
# รายการ host:port ที่ต้อง "ปฏิเสธ" HTTP (คั่นด้วยช่องว่าง) — ว่าง = ข้าม
EXPECT_BLOCKED="${EXPECT_BLOCKED:-100.122.191.114:3001 192.168.1.200:3001}"

if [[ ! -r "$SECRETS" ]]; then
  echo "❌ อ่าน secrets ไม่ได้: $SECRETS"
  exit 1
fi

# อ่าน secrets แบบทน CRLF (Windows) + ค่าที่มี quote
# ห้ามใช้ `source` ตรง ๆ: ไฟล์จริงมักมี CRLF และค่าที่มีช่องว่างโดยไม่ใส่ quote
# (เช่น GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx") ทำให้ source พังและค่ารั่วเป็น command
read_secret() { # key file → value สุดท้ายที่พบ (last-wins)
  local key="$1" file="$2" line val=""
  while IFS= read -r line; do
    line="${line%$'\r'}"
    case "$line" in
      "$key="*) val="${line#*=}" ;;
    esac
  done < "$file"
  if [[ ${#val} -ge 2 && "${val:0:1}" == "${val: -1}" && ( "${val:0:1}" == '"' || "${val:0:1}" == "'" ) ]]; then
    val="${val:1:${#val}-2}"
  fi
  printf '%s' "$val"
}

SEED_ADMIN_EMAIL="$(read_secret SEED_ADMIN_EMAIL "$SECRETS")"
SEED_ADMIN_PASSWORD="$(read_secret SEED_ADMIN_PASSWORD "$SECRETS")"

for v in SEED_ADMIN_EMAIL SEED_ADMIN_PASSWORD; do
  if [[ -z "${!v:-}" ]]; then
    echo "❌ ไม่พบ $v ใน $SECRETS"
    exit 1
  fi
done

B="$BASE_URL"
J=$(mktemp); C=$(mktemp)
trap 'rm -f "$J" "$C"' EXIT

fail=0
check() { # label expected actual
  if [[ "$2" == "$3" ]]; then
    echo "  ✅ $1 → $3"
  else
    echo "  ❌ $1 → ได้ $3 (คาดหวัง $2)"
    fail=1
  fi
}

echo "=== 0. เป้าหมาย ==="
echo "  BASE_URL=$B"
echo "  SECRETS=$SECRETS"

echo "=== 1. /login ตอบ 200 ==="
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$B/login")
check "/login" 200 "$code"

echo "=== 2. login + เก็บ cookie ==="
code=$(curl -s -o "$J" -D "$C" -c "$C" -X POST "$B/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SEED_ADMIN_EMAIL\",\"password\":\"$SEED_ADMIN_PASSWORD\"}" \
  -w "%{http_code}")
check "POST /api/login" 200 "$code"
if grep -o '"success":true' "$J" >/dev/null; then
  echo "  ✅ success: true · $(grep -o '"role":"[^"]*"' "$J" | head -1)"
else
  echo "  ❌ login ไม่สำเร็จ"; fail=1
fi

echo "=== 3. cookie เข้า jar ==="
if grep -q 'session-token' "$C"; then
  echo "  ✅ cookie อยู่ใน jar"
  # Netscape cookie jar: col4 = secure (TRUE/FALSE), col1 อาจมี #HttpOnly_ นำหน้า
  sec=$(grep 'session-token' "$C" | awk -F'\t' '{print $4}' | head -1)
  if [[ "$sec" == "TRUE" ]]; then
    echo "  ✅ มี Secure flag"
    if [[ "$B" == http://* && "$B" != *localhost* && "$B" != *127.0.0.1* ]]; then
      echo "  ⚠️  Secure cookie บน http (ไม่ใช่ localhost) — เบราว์เซอร์จะไม่เก็บ (curl ยังส่งได้)"
    fi
  elif [[ "$EXPECT_HTTPS" == "1" ]]; then
    echo "  ❌ คาดหวัง Secure flag แต่ได้ '$sec'"; fail=1
  else
    echo "  ℹ️  ไม่มี Secure flag (โหมด A — ปกติ)"
  fi
else
  echo "  ❌ ไม่มี cookie ใน jar"; fail=1
fi

echo "=== 4. หน้าจริงที่ต้องมี session ==="
for p in / /invoices /quotations /contacts /hosting/plans /hosting/subscriptions /admin/members; do
  code=$(curl -s -b "$C" -o /dev/null -w "%{http_code}" --max-time 20 "$B$p")
  check "$p" 200 "$code"
done

echo "=== 5. ไม่มี cookie → ต้องถูกส่งไป /login ==="
out=$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" --max-time 20 "$B/invoices")
if [[ "$out" == 30[0-9]*"/login"* ]]; then
  echo "  ✅ $out"
else
  echo "  ❌ ได้ $out (คาดหวัง redirect ไป /login)"; fail=1
fi

if [[ -n "$EXPECT_BLOCKED" ]]; then
  echo "=== 6. HTTP ตรงต้องถูกปิด ==="
  for t in $EXPECT_BLOCKED; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 4 --max-time 8 "http://$t/login")
    if [[ "$code" == "000" ]]; then echo "  ✅ http://$t ปฏิเสธ"; else echo "  ❌ http://$t → $code (ควรปิด)"; fail=1; fi
  done
else
  echo "=== 6. HTTP ตรง — ข้าม (EXPECT_BLOCKED ว่าง) ==="
fi

echo "=== 7. error ใน container log ==="
if docker ps --format '{{.Names}}' | grep -qx "$APP_CONTAINER"; then
  errs=$(docker logs --tail 200 "$APP_CONTAINER" 2>&1 | grep -iE "error|exception|fail" | tail -5)
  if [[ -z "$errs" ]]; then echo "  ✅ ไม่มี"; else echo "$errs" | sed 's/^/  /'; fail=1; fi
else
  echo "  ℹ️  ไม่พบ container '$APP_CONTAINER' — ข้าม"
fi

echo
[[ $fail -eq 0 ]] && echo "ผ่านทั้งหมด" || echo "มีข้อที่ล้มเหลว"
exit $fail
