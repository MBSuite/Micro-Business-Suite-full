import { query } from "@/lib/db";
import { redactSettingsSecrets } from "@/lib/settings";
import SettingsClient from "@/components/SettingsClient";

export const dynamic = 'force-dynamic';

async function getCompanyData() {
  try {
    const res = await query('SELECT * FROM company_settings LIMIT 1');
    const row = res.rows[0];
    if (!row) return null;

    // SettingsClient is a client component: whatever we pass is serialized into
    // the RSC payload sent to the browser. Never include secret values — pass
    // only presence flags so the UI can still show the "•••• (saved)" state.
    const redacted = redactSettingsSecrets(row) as Record<string, unknown>;
    return {
      ...redacted,
      rd_client_secret_set: Boolean(row.rd_client_secret),
      rd_api_key_set: Boolean(row.rd_api_key),
      google_client_secret_set: Boolean(row.google_client_secret),
      google_refresh_token_set: Boolean(row.google_refresh_token),
    };
  } catch {
    return null;
  }
}

export default async function SettingsPage() {
  const company = await getCompanyData();

  return (
    <main className="p-6 md:p-8 min-h-screen bg-[#f4f6f9]">
      <div className="max-w-7xl mx-auto">
        
        {/* Content Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
              <h1 className="text-2xl font-bold text-gray-800 uppercase tracking-tight">ตั้งค่าระบบ (Settings)</h1>
              <p className="text-sm text-gray-500 mt-1">จัดการข้อมูลพื้นฐานและความปลอดภัยขององค์กร</p>
           </div>
           <div className="bg-white px-4 py-2 rounded shadow-sm border border-gray-200 text-xs font-bold text-gray-500 flex items-center gap-4">
              <span className="text-blue-600">Enterprise Edition</span>
              <span>v1.0.4</span>
           </div>
        </div>

        <SettingsClient initialData={company} />

        <div className="text-center text-gray-400 text-xs font-medium pb-8 border-t border-gray-200 pt-6 mt-12">
           © 2026 MBSuite.
        </div>
      </div>
    </main>
  );
}
