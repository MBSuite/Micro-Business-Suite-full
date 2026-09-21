// =====================================================
// Micro Business Suite: Offline Signed License
// License key = MBS.<base64url(payload)>.<base64url(HMAC-SHA256)>
// Signed by the issuer (seller) using LICENSE_SALT.
// Verified locally at runtime — no central server needed.
// =====================================================

import crypto from "node:crypto";
import { getProductMode } from "./product-mode";

export type LicenseType = "TRIAL" | "STANDARD" | "PROFESSIONAL" | "ENTERPRISE";
export type LicenseMode = "perpetual" | "subscription";

export interface LicensePayload {
  product: "micro-business-suite";
  mode: LicenseMode;
  license_type: LicenseType;
  licensee: string;
  company: string;
  issued_at: string;
  expires_at?: string;
  max_users: number;
  max_transactions_per_month: number;
  allowed_features: string[];
}

export interface LicenseVerifyResult {
  valid: boolean;
  payload?: LicensePayload;
  error?: string;
}

const KEY_VERSION = "MBS";

function getSigningSalt(): string {
  const salt = process.env.LICENSE_SALT;
  if (!salt) {
    throw new Error(
      "FATAL: LICENSE_SALT is not configured. Set LICENSE_SALT to a long random secret " +
      "to secure offline license verification."
    );
  }
  return salt;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

function hmacSignature(payloadB64: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(payloadB64).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function nowIso(): string {
  return new Date().toISOString();
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

// Build a signed license key from a payload and salt (used by scripts/issue-license.mjs)
export function createLicenseKey(payload: LicensePayload, salt: string): string {
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = hmacSignature(payloadB64, salt);
  return `${KEY_VERSION}.${payloadB64}.${sig}`;
}

// Parse a license key into its payload (signature NOT verified here)
export function parseLicenseKey(key: string): LicensePayload | null {
  try {
    const parts = key.split(".");
    if (parts.length !== 3 || parts[0] !== KEY_VERSION) return null;
    const parsed = JSON.parse(base64UrlDecode(parts[1]).toString("utf8"));
    if (parsed?.product !== "micro-business-suite") return null;
    return parsed as LicensePayload;
  } catch {
    return null;
  }
}

// Fully verify a license key: signature + payload shape + expiry
export function verifyLicenseKey(key: string, salt: string): LicenseVerifyResult {
  const parts = key.split(".");
  if (parts.length !== 3 || parts[0] !== KEY_VERSION) {
    return { valid: false, error: "Invalid license key format" };
  }

  const [version, payloadB64, sig] = parts;

  const expectedSig = hmacSignature(payloadB64, salt);
  if (!safeEqual(sig, expectedSig)) {
    return { valid: false, error: "License signature verification failed" };
  }

  const payload = parseLicenseKey(`${version}.${payloadB64}.${sig}`);
  if (!payload) {
    return { valid: false, error: "License payload is malformed" };
  }

  if (payload.expires_at && isExpired(payload.expires_at)) {
    return { valid: false, error: `License expired on ${payload.expires_at}` };
  }

  if (payload.mode === "subscription" && getProductMode() === "perpetual") {
    return { valid: false, error: "Subscription license cannot be used in perpetual mode" };
  }

  if (getProductMode() === "subscription" && !payload.expires_at) {
    return { valid: false, error: "Subscription product requires a license with an expiry date" };
  }

  return { valid: true, payload };
}

// Verify the configured MBS_LICENSE_KEY against LICENSE_SALT
export function verifyConfiguredLicense(): LicenseVerifyResult {
  const salt = getSigningSalt();
  const key = process.env.MBS_LICENSE_KEY?.trim();
  if (!key) {
    return { valid: false, error: "MBS_LICENSE_KEY is not configured" };
  }
  return verifyLicenseKey(key, salt);
}

// Fail fast if the configured license is missing / invalid / expired.
// Call at server startup (instrumentation.register) — production ships only with a valid key.
export function requireActiveLicense(): LicensePayload {
  const result = verifyConfiguredLicense();
  if (!result.valid || !result.payload) {
    throw new Error(
      `License check failed: ${result.error}. ` +
      "Run scripts/issue-license.mjs to issue a key and set it as MBS_LICENSE_KEY."
    );
  }
  return result.payload;
}

export function isLicenseValid(): boolean {
  try {
    return verifyConfiguredLicense().valid;
  } catch {
    return false;
  }
}

export { nowIso, getSigningSalt };