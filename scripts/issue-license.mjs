#!/usr/bin/env node
// =====================================================
// Micro Business Suite — License Key Issuer
// ใช้ฝั่งผู้ขาย (seller) ออก license ให้ลูกค้า
//
// วิธีใช้:
//   node scripts/issue-license.mjs --mode perpetual --company "Acme" --licensee a@b.com
//   node scripts/issue-license.mjs --mode subscription --company "Acme" --licensee a@b.com --expires 2026-12-31
//   node scripts/issue-license.mjs --mode perpetual --company "Acme" --licensee a@b.com --out license.txt
//
// อ่าน LICENSE_SALT จาก env (.env.local) — ต้องตั้งให้ตรงกับฝั่ง app เสมอ
// =====================================================

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);

// --- Load .env.local if exists ---
try {
  require("dotenv").config({ path: ".env.local" });
} catch {
  // dotenv not available — fall back to process env only
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// Load LICENSE_SALT from the project root
if (!process.env.LICENSE_SALT) {
  try {
    require("dotenv").config({ path: path.join(projectRoot, ".env.local") });
  } catch {
    // ignore
  }
}

// --- CLI parsing ---
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : fallback;
}

const mode = (getArg("mode", "perpetual") || "perpetual").toLowerCase();
if (!["perpetual", "subscription"].includes(mode)) {
  console.error(`❌ mode ต้องเป็น perpetual หรือ subscription เท่านั้น (ได้รับ: ${mode})`);
  process.exit(1);
}

const company = getArg("company");
const licensee = getArg("licensee");
const expires = getArg("expires");
const type = (getArg("type", "PROFESSIONAL") || "PROFESSIONAL").toUpperCase();
const maxUsers = parseInt(getArg("max-users", "5"), 10);
const maxTx = parseInt(getArg("max-transactions", "1000"), 10);
const outFile = getArg("out");
const featuresArg = getArg("features", "");

if (!company || !licensee) {
  console.error("❌ ต้องระบุ --company และ --licensee (อีเมลลูกค้า)");
  console.error("ตัวอย่าง:");
  console.error("  node scripts/issue-license.mjs --mode perpetual --company \"Acme\" --licensee a@b.com");
  process.exit(1);
}

if (mode === "subscription" && !expires) {
  console.error("❌ subscription license ต้องระบุ --expires (YYYY-MM-DD)");
  process.exit(1);
}

if (mode === "perpetual" && expires) {
  console.warn("⚠️ perpetual license มี expires — license จะหมดอายุจริงตามค่านั้น (ไม่ปกติ)");
}

const salt = process.env.LICENSE_SALT;
if (!salt) {
  console.error("❌ LICENSE_SALT ไม่ถูกตั้งค่าใน environment/.env.local");
  console.error("   สร้างได้ด้วย: openssl rand -base64 48");
  process.exit(1);
}

const allowedTypes = ["TRIAL", "STANDARD", "PROFESSIONAL", "ENTERPRISE"];
if (!allowedTypes.includes(type)) {
  console.error(`❌ --type ต้องเป็น ${allowedTypes.join(" / ")}`);
  process.exit(1);
}

const defaultFeatures = {
  TRIAL: ["basic_access", "journal_engine", "tax_reporting"],
  STANDARD: ["basic_access", "journal_engine", "tax_reporting", "coa_management"],
  PROFESSIONAL: [
    "basic_access",
    "journal_engine",
    "advanced_reports",
    "automated_journaling",
    "coa_management",
    "tax_reporting",
  ],
  ENTERPRISE: [
    "basic_access",
    "journal_engine",
    "advanced_reports",
    "multi_company",
    "api_access",
    "custom_branding",
    "automated_journaling",
    "coa_management",
    "tax_reporting",
  ],
};

const features = featuresArg
  ? featuresArg.split(",").map((f) => f.trim()).filter(Boolean)
  : (defaultFeatures[type] || defaultFeatures.PROFESSIONAL);

const payload = {
  product: "micro-business-suite",
  mode,
  license_type: type,
  licensee,
  company,
  issued_at: new Date().toISOString(),
  ...(mode === "subscription" && expires ? { expires_at: `${expires}T23:59:59.999Z` } : {}),
  max_users: maxUsers,
  max_transactions_per_month: maxTx,
  allowed_features: features,
};

function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64url");
}

function hmacSignature(payloadB64) {
  return crypto.createHmac("sha256", salt).update(payloadB64).digest("base64url");
}

const payloadB64 = base64UrlEncode(JSON.stringify(payload));
const signature = hmacSignature(payloadB64);
const licenseKey = `MBS.${payloadB64}.${signature}`;

const report = [
  "",
  "================================================================",
  "✅ License Key Generated",
  "================================================================",
  `  mode      : ${mode}`,
  `  type      : ${type}`,
  `  company   : ${company}`,
  `  licensee  : ${licensee}`,
  `  max_users : ${maxUsers}`,
  `  max_tx/mo : ${maxTx}`,
  `  issued    : ${payload.issued_at}`,
  mode === "subscription" ? `  expires   : ${payload.expires_at}` : "  expires   : (ไม่มี — ขายขาด)",
  `  features  : ${features.join(", ")}`,
  "",
  "  LICENSE KEY (ใส่เป็น MBS_LICENSE_KEY ใน .env ของลูกค้า):",
  "  ----------------------------------------------------------",
  licenseKey,
  "  ----------------------------------------------------------",
  "",
].join("\n");

if (outFile) {
  const outPath = path.isAbsolute(outFile) ? outFile : path.join(projectRoot, outFile);
  fs.writeFileSync(outPath, licenseKey + "\n", "utf8");
  console.log(report);
  console.log(`📄 บันทึก license ลงไฟล์: ${outPath}`);
} else {
  console.log(report);
}