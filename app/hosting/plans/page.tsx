"use client";

import { useEffect, useState } from "react";
import { Server, Plus, HardDrive, Cpu } from "lucide-react";
import { getHostingPlans, createHostingPlan } from "@/app/actions";

type Plan = {
  id: number;
  plan_code: string;
  name: string;
  description: string;
  disk_space_mb: number;
  bandwidth_mb: number;
  price_monthly: number;
  price_yearly: number;
  is_active: boolean;
};

export default function HostingPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    plan_code: "",
    name: "",
    description: "",
    disk_space_mb: 10240,
    bandwidth_mb: 102400,
    price_monthly: 299,
    price_yearly: 2990,
  });

  const loadPlans = async () => {
    setLoading(true);
    const res = await getHostingPlans();
    setPlans(((res.success ? res.data : []) as Plan[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await createHostingPlan(form);
    setSaving(false);
    if (!res.success) {
      alert(res.error || "สร้างแพ็กเกจไม่สำเร็จ");
      return;
    }
    setForm({
      plan_code: "",
      name: "",
      description: "",
      disk_space_mb: 10240,
      bandwidth_mb: 102400,
      price_monthly: 299,
      price_yearly: 2990,
    });
    await loadPlans();
  };

  return (
    <main className="p-6 md:p-8 min-h-screen bg-[#f4f6f9]">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-sm">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Server className="text-indigo-600" /> จัดการแพ็กเกจ Web Hosting
          </h1>
          <p className="text-slate-500 text-sm mt-2">
            กำหนดสเปกพื้นที่ พื้นที่รับส่งข้อมูล (Bandwidth) และรอบราคาบริการรายเดือน/รายปี
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold"
            placeholder="Plan Code (เช่น HOST-S)"
            value={form.plan_code}
            onChange={(e) => setForm({ ...form, plan_code: e.target.value })}
            required
          />
          <input
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold md:col-span-2"
            placeholder="ชื่อแพ็กเกจ (เช่น Standard Hosting)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm"
            placeholder="Disk (MB)"
            type="number"
            value={form.disk_space_mb}
            onChange={(e) => setForm({ ...form, disk_space_mb: Number(e.target.value) })}
            required
          />
          <input
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm"
            placeholder="Bandwidth (MB)"
            type="number"
            value={form.bandwidth_mb}
            onChange={(e) => setForm({ ...form, bandwidth_mb: Number(e.target.value) })}
            required
          />
          <input
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm"
            placeholder="ราคา/เดือน (THB)"
            type="number"
            step="0.01"
            value={form.price_monthly}
            onChange={(e) => setForm({ ...form, price_monthly: Number(e.target.value) })}
            required
          />
          <input
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm"
            placeholder="ราคา/ปี (THB)"
            type="number"
            step="0.01"
            value={form.price_yearly}
            onChange={(e) => setForm({ ...form, price_yearly: Number(e.target.value) })}
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 md:col-span-4 transition shadow-sm"
          >
            <Plus size={18} /> {saving ? "กำลังบันทึก..." : "เพิ่มแพ็กเกจโฮสติ้งใหม่"}
          </button>
        </form>

        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 font-bold text-slate-800">
            รายการแพ็กเกจทั้งหมด ({plans.length})
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400">กำลังโหลดข้อมูล...</div>
          ) : plans.length === 0 ? (
            <div className="p-8 text-center text-slate-400">ยังไม่มีแพ็กเกจโฮสติ้งในระบบ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-100">
                    <th className="p-4 font-bold">รหัสแพ็กเกจ</th>
                    <th className="p-4 font-bold">ชื่อแพ็กเกจ</th>
                    <th className="p-4 font-bold">Disk Space</th>
                    <th className="p-4 font-bold">Bandwidth</th>
                    <th className="p-4 font-bold text-right">ราคา/เดือน</th>
                    <th className="p-4 font-bold text-right">ราคา/ปี</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plans.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-mono font-bold text-indigo-600">{p.plan_code}</td>
                      <td className="p-4 font-bold text-slate-800">{p.name}</td>
                      <td className="p-4 text-slate-600 flex items-center gap-1.5"><HardDrive size={14} /> {p.disk_space_mb} MB</td>
                      <td className="p-4 text-slate-600"><Cpu size={14} className="inline mr-1" /> {p.bandwidth_mb} MB</td>
                      <td className="p-4 text-right font-bold text-emerald-600">฿{Number(p.price_monthly).toLocaleString()}</td>
                      <td className="p-4 text-right font-bold text-indigo-600">฿{Number(p.price_yearly).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
