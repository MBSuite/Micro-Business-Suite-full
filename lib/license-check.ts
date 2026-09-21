// =====================================================
// Micro Business Suite: License Verification Middleware
// Protects the unique 5-Journal Engine IP
// Copyright (c) 2026 Micro Business Suite. All Rights Reserved.
//
// Backed by lib/license.ts (offline signed license).
// License key format: MBS.<base64url(payload)>.<base64url(HMAC-SHA256)>
// No central server / DB required.
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import {
  verifyLicenseKey,
  parseLicenseKey,
  getSigningSalt,
  type LicensePayload,
  type LicenseType,
  type LicenseMode,
} from "./license";

export interface LicenseInfo {
  id?: number;
  license_key: string;
  machine_id?: string;
  license_type: LicenseType;
  status: "ACTIVE" | "EXPIRED" | "TAMPERED";
  max_users: number;
  max_companies: number;
  max_transactions_per_month: number;
  allowed_features: string[];
  expires_at?: string;
  company_name: string;
  licensee_email: string;
  mode: LicenseMode;
}

export interface LicenseCheckResult {
  valid: boolean;
  license?: LicenseInfo;
  error?: string;
  action?: "ALLOW" | "DENY" | "EXPIRED" | "LIMIT_REACHED";
}

// Core offline license verification
export async function verifyLicense(licenseKey: string): Promise<LicenseCheckResult> {
  try {
    const salt = getSigningSalt();
    const result = verifyLicenseKey(licenseKey, salt);

    if (!result.valid || !result.payload) {
      return {
        valid: false,
        error: result.error || "Invalid license key",
        action: result.error?.includes("expired") ? "EXPIRED" : "DENY",
      };
    }

    const payload = result.payload;

    return {
      valid: true,
      license: {
        license_key: licenseKey,
        license_type: payload.license_type,
        status: "ACTIVE",
        max_users: payload.max_users,
        max_companies: 1,
        max_transactions_per_month: payload.max_transactions_per_month,
        allowed_features: payload.allowed_features,
        expires_at: payload.expires_at,
        company_name: payload.company,
        licensee_email: payload.licensee,
        mode: payload.mode,
      },
      action: "ALLOW",
    };
  } catch (error: unknown) {
    console.error("License verification error:", error);
    return {
      valid: false,
      error: "License verification system error",
      action: "DENY",
    };
  }
}

// Feature access checking
export async function checkFeatureAccess(
  licenseKey: string,
  feature?: string
): Promise<LicenseCheckResult> {
  const licenseCheck = await verifyLicense(licenseKey);

  if (!licenseCheck.valid || !licenseCheck.license) {
    return licenseCheck;
  }

  const license = licenseCheck.license;

  if (feature) {
    const featureKey = feature as keyof typeof PROTECTED_FEATURES;
    const featureName = PROTECTED_FEATURES[featureKey] || feature;
    if (!license.allowed_features.includes(featureName)) {
      return {
        valid: false,
        error: `Feature '${featureName}' not available in ${license.license_type} license`,
        action: "DENY",
      };
    }
  }

  return { valid: true, license, action: "ALLOW" };
}

// Middleware for Next.js API routes
export function withLicenseCheck(feature?: keyof typeof PROTECTED_FEATURES) {
  return async function middleware(request: NextRequest) {
    const licenseKey = request.headers.get("x-license-key") || process.env.MBS_LICENSE_KEY;

    if (!licenseKey) {
      return NextResponse.json(
        { error: "License key required", action: "DENY" },
        { status: 401 }
      );
    }

    const licenseCheck = await checkFeatureAccess(licenseKey, feature);

    if (!licenseCheck.valid) {
      const status = licenseCheck.action === "EXPIRED" ? 403 : 403;
      return NextResponse.json(
        { error: licenseCheck.error, action: licenseCheck.action, feature },
        { status }
      );
    }

    const response = NextResponse.next();
    response.headers.set("x-license-valid", "true");
    response.headers.set("x-license-type", licenseCheck.license?.license_type || "UNKNOWN");
    response.headers.set("x-license-features", JSON.stringify(licenseCheck.license?.allowed_features || []));
    return response;
  };
}

// Protect critical 5-Journal Engine functions
export const PROTECTED_FEATURES = {
  JOURNAL_ENGINE: "journal_engine",
  ADVANCED_REPORTS: "advanced_reports",
  MULTI_COMPANY: "multi_company",
  API_ACCESS: "api_access",
  CUSTOM_BRANDING: "custom_branding",
  AUTOMATED_JOURNALING: "automated_journaling",
  COA_MANAGEMENT: "coa_management",
  TAX_REPORTING: "tax_reporting",
} as const;

// Parse a license key to inspect its payload (no verification)
export function inspectLicenseKey(licenseKey: string): LicensePayload | null {
  return parseLicenseKey(licenseKey);
}