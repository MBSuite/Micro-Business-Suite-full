import Link from "next/link";
import {
  DatabaseBackup,
  Settings2,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";

const adminTools = [
  {
    href: "/admin/members",
    label: "สมาชิก",
    description: "ตรวจสอบบัญชีผู้ใช้และการเข้าถึง",
    icon: UsersRound,
  },
  {
    href: "/admin/groups",
    label: "กลุ่มและสิทธิ์",
    description: "จัดการกลุ่มและสิทธิ์ระดับโมดูล",
    icon: ShieldCheck,
  },
  {
    href: "/admin/modules",
    label: "โมดูลระบบ",
    description: "กำหนดโมดูลที่เปิดใช้ในบริษัท",
    icon: Settings2,
  },
  {
    href: "/admin/coa",
    label: "ผังบัญชี",
    description: "ดูแลบัญชีที่ใช้บันทึกรายการ",
    icon: WalletCards,
  },
  {
    href: "/admin/backup",
    label: "สำรองฐานข้อมูล",
    description: "ส่งออกข้อมูลสำหรับการสำรอง",
    icon: DatabaseBackup,
  },
];

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#f4f6f9] p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 border-b border-slate-200 pb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Administration
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">แผงผู้ดูแลระบบ</h1>
          <p className="mt-2 text-sm text-slate-600">
            จัดการผู้ใช้ สิทธิ์การเข้าถึง โมดูล และข้อมูลระบบ
          </p>
        </header>

        <nav aria-label="เครื่องมือผู้ดูแลระบบ" className="divide-y divide-slate-200 border-y border-slate-200">
          {adminTools.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-20 items-center gap-4 py-4 transition-colors hover:bg-white"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 group-hover:text-blue-700">
                <Icon aria-hidden="true" size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">{label}</span>
                <span className="mt-1 block text-sm text-slate-600">{description}</span>
              </span>
              <span aria-hidden="true" className="px-3 text-lg text-slate-400 group-hover:text-blue-700">
                &rarr;
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}