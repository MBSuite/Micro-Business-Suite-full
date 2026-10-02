"use client";

import { useEffect, useState } from "react";
import { Globe, Plus, Calendar, ShieldCheck } from "lucide-react";
import { getHostingSubscriptions, createHostingSubscription, getHostingPlans } from "@/app/actions";

type Subscription = {
  id: number;
  domain_name: string;
  plan_name: string;
  plan_code: string;
  billing_cycle: string;
  price: number;
  status: string;
  start_date: string;
  renewal_date: string;
  server_ip: string;
};

type Plan = {
  id: number;
  name: string;
  price_monthly: number;
  price_yearly: number;
};

export default function HostingSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    plan_id: 0,
    domain_name: "",
    billing_cycle: "monthly",
    price: 299,
    start_date: new Date().toISOString().split("T")[0],
    renewal_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    server_ip: "192.168.1.200",
  });

  const loadData = async () => {
    setLoading(true);
    const [subRes, planRes] = await Promise.all([
      getHostingSubscriptions(),
      getHostingPlans(),
    ]);
    const plansData = ((planRes.success ? planRes.data : []) as Plan[]) || [];
    setSubscriptions(((subRes.success ? subRes.data : []) as Subscription[]) || []);
    setPlans(plansData);
    if (plansData.length > 0) {
      setForm((prev) => ({ ...prev, plan_id: plansData[0].id, price: plansData[0].price_monthly }));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePlanChange = (planId: number) => {
    const selected = plans.find((p) => p.id === planId);
    if (selected) {
      const price = form.billing_cycle === "yearly" ? selected.price_yearly : selected.price_monthly;
      setForm((prev) => ({ ...prev, plan_id: planId, price }));
    }
  };

  const handleCycleChange = (cycle: string) => {
    const selected = plans.find((p) => p.id === form.plan_id);
    if (selected) {
      const price = cycle === "yearly" ? selected.price_yearly : selected.price_monthly;
      setForm((prev) => ({ ...prev, billing_cycle: cycle, price }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await createHostingSubscription(form);
    setSaving(false);
    if (!res.success) {
      alert(res.error || "บันทึกสัญญาเช่าโฮสติ้งไม่สำเร็จ");
      return;
    }
    setForm({
      plan_id: plans[0]?.id || 0,
      domain_name: "",
      billing_cycle: "monthly",
      price: plans[0]?.price_monthly || 0,
      start_date: new Date().toISOString().split("T")[0],
      renewal_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      server_ip: "192.168.1.200",
    });
    await loadData();
  };

  return (
    <main className="p-6 md:p-8 min-h-screen bg-[#f4f6f9]">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-sm">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Globe className="text-indigo-600" /> บริหารจัดการสัญญาเช่าโฮสติ้ง & รอบบิล (Subscriptions)
          </h1>
          <p className="text-slate-500 text-sm mt-2">
            ติดตามโดเมนของลูกค้า วันครบกำหนดต่ออายุ (Renewal Date) และสถานะบริการเช่า
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold md:col-span-2"
            placeholder="ชื่อโดเมนลูกค้า (เช่น clientdomain.com)"
            value={form.domain_name}
            onChange={(e) => setForm({ ...form, domain_name: e.target.value })}
            required
          />
          <select
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold"
            value={form.plan_id}
            onChange={(e) => handlePlanChange(Number(e.target.value))}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold"
            value={form.billing_cycle}
            onChange={(e) => handleCycleChange(e.target.value)}
          >
            <option value="monthly">รายเดือน (Monthly)</option>
            <option value="yearly">รายปี (Yearly)</option>
          </select>
          <input
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold"
            placeholder="ราคา (THB)"
            type="number"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            required
          />
          <input
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm"
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            required
          />
          <input
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm"
            type="date"
            value={form.renewal_date}
            onChange={(e) => setForm({ ...form, renewal_date: e.target.value })}
            required
          />
          <input
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-mono"
            placeholder="Server IP"
            value={form.server_ip}
            onChange={(e) => setForm({ ...form, server_ip: e.target.value })}
          />
          <button
            type="submit"
            disabled={saving}
            className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 md:col-span-4 transition shadow-sm"
          >
            <Plus size={18} /> {saving ? "กำลังบันทึก..." : "เพิ่มสัญญาเช่าโฮสติ้งใหม่"}
          </button>
        </form>

        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 font-bold text-slate-800">
            รายการสัญญาเช่าโฮสติ้งทั้งหมด ({subscriptions.length})
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400">กำลังโหลดข้อมูล...</div>
          ) : subscriptions.length === 0 ? (
            <div className="p-8 text-center text-slate-400">ยังไม่มีสัญญาเช่าโฮสติ้งในระบบ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-100">
                    <th className="p-4 font-bold">โดเมนลูกค้า</th>
                    <th className="p-4 font-bold">แพ็กเกจ</th>
                    <th className="p-4 font-bold">รอบบิล</th>
                    <th className="p-4 font-bold text-right">ราคา</th>
                    <th className="p-4 font-bold">วันหมดอายุ / ต่ออายุ</th>
                    <th className="p-4 font-bold">สถานะ</th>
                    <th className="p-4 font-bold">Server IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscriptions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-mono font-bold text-indigo-600 flex items-center gap-2">
                        <Globe size={14} /> {s.domain_name}
                      </td>
                      <td className="p-4 font-bold text-slate-800">{s.plan_name}</td>
                      <td className="p-4 text-slate-600 capitalize">{s.billing_cycle}</td>
                      <td className="p-4 text-right font-bold text-emerald-600">฿{Number(s.price).toLocaleString()}</td>
                      <td className="p-4 text-slate-600 flex items-center gap-1.5">
                        <Calendar size={14} /> {s.renewal_date}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          <ShieldCheck size={12} /> {s.status}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-xs text-slate-500">{s.server_ip}</td>
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
