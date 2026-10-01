// =====================================================
// MBSuite: Company Settings & Branding
// Centralized company configuration management
// Copyright (c) 2026 MBSuite. All Rights Reserved.
// =====================================================

import { query } from '@/lib/db';

export interface CompanySettings {
  id?: number;
  company_name: string;
  tax_id: string;
  address: string;
  logo_url?: string;
  phone?: string;
  email?: string;
  website?: string;
  created_at?: string;
  updated_at?: string;
}

// Column allowlist. Any key not in this list is ignored — never interpolate
// arbitrary request keys into SQL.
export const WRITABLE_SETTINGS_COLUMNS: Array<keyof CompanySettings> = [
  'company_name',
  'tax_id',
  'address',
  'logo_url',
  'phone',
  'email',
  'website',
];

// Initialize company settings table
export async function ensureCompanySettingsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id SERIAL PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL DEFAULT 'MBSuite',
      tax_id VARCHAR(50) NOT NULL DEFAULT '',
      address TEXT,
      logo_url TEXT,
      phone VARCHAR(50),
      email VARCHAR(255),
      website VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default settings if table is empty
  const existing = await query('SELECT COUNT(*) as count FROM company_settings');
  if (existing.rows[0].count === 0) {
    await query(`
      INSERT INTO company_settings (company_name, tax_id, address)
      VALUES ('MBSuite', '', 'Company Address, Thailand')
    `);
  }
}

// Get company settings
export async function getCompanySettings(): Promise<{ success: boolean; data?: CompanySettings; error?: string }> {
  try {
    await ensureCompanySettingsTable();
    const { rows } = await query('SELECT * FROM company_settings ORDER BY id DESC LIMIT 1');
    
    return {
      success: true,
      data: rows[0] as CompanySettings
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Update company settings
export async function updateCompanySettings(settings: Partial<CompanySettings>): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureCompanySettingsTable();
    
    const fields = WRITABLE_SETTINGS_COLUMNS.filter(
      (key) => key in settings && settings[key] !== undefined
    );
    const values = fields.map((field) => settings[field]);

    if (fields.length === 0) {
      return { success: true };
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');

    await query(`
      UPDATE company_settings
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM company_settings ORDER BY id DESC LIMIT 1)
    `, values);
    
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
