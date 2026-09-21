// =====================================================
// Micro Business Suite: Product Mode
// 1 codebase, 2 delivery models:
//   perpetual   = ตัวที่ขายขาด / ติดตั้งให้ลูกค้า (ไม่มี license-lock / อ่าน company_settings)
//   subscription= ตัวที่ให้เช่ารายเดือน (license-check + quotas + billing)
// เลือกผ่าน env PRODUCT_MODE (ค่าเริ่มต้น perpetual)
// =====================================================

export type ProductMode = 'perpetual' | 'subscription';

export function getProductMode(): ProductMode {
  const mode = (process.env.PRODUCT_MODE || 'perpetual').toLowerCase();
  return mode === 'subscription' ? 'subscription' : 'perpetual';
}

export function isSubscription(): boolean {
  return getProductMode() === 'subscription';
}

export function isPerpetual(): boolean {
  return getProductMode() === 'perpetual';
}