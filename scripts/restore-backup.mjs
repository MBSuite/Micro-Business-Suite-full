#!/usr/bin/env node
import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/restore-backup.mjs <encrypted-backup-file>");
  process.exit(1);
}
const buf = fs.readFileSync(file);
if (buf.length < 12 + 16) throw new Error("Invalid encrypted file");
const iv = buf.subarray(0, 12);
const tag = buf.subarray(12, 28);
const enc = buf.subarray(28);

const keyStr = process.env.BACKUP_ENCRYPTION_KEY;
if (!keyStr) throw new Error("BACKUP_ENCRYPTION_KEY required");
let key = Buffer.from(keyStr, "hex");
if (key.length !== 32) {
  try { key = Buffer.from(keyStr, "base64"); } catch {}
}
if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY must be 32 bytes");

const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
decipher.setAuthTag(tag);
const gz = Buffer.concat([decipher.update(enc), decipher.final()]);
const json = zlib.gunzipSync(gz).toString("utf8");
console.log("Decrypted OK, length:", json.length);
process.stdout.write(json.slice(0, 80) + (json.length > 80 ? "..." : "\n"));
