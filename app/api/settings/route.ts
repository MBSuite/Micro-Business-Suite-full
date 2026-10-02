// =====================================================
// MBSuite: Company Settings API
// RESTful API for company branding and configuration
// Copyright (c) 2026 MBSuite. All Rights Reserved.
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCompanySettings, updateCompanySettings, WRITABLE_SETTINGS_COLUMNS, redactSettingsSecrets } from '@/lib/settings';
import { requireAdmin } from '@/lib/auth';

// GET company settings
export async function GET() {
  try {
    const result = await getCompanySettings();
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: redactSettingsSecrets(result.data)
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// PUT company settings
export async function PUT(request: NextRequest) {
  try {
    // Authorization: only admins may change company settings.
    const gate = await requireAdmin();
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Whitelist fields — ignore anything not in WRITABLE_SETTINGS_COLUMNS.
    const sanitized: Record<string, unknown> = {};
    for (const key of WRITABLE_SETTINGS_COLUMNS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        sanitized[key] = body[key];
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided' },
        { status: 400 }
      );
    }

    const result = await updateCompanySettings(sanitized);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: sanitized
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
