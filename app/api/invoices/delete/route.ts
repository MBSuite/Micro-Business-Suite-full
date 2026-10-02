import { NextResponse } from "next/server";
import { deleteInvoice } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = body?.id;
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

    // Server-side authorization: verify the caller's CURRENT role in the DB,
    // not the role embedded in the (up to 1-day old) JWT.
    const gate = await requireAdmin();
    if (!gate.ok) {
      return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
    }

    const res = await deleteInvoice(Number(id));
    if (res && res.success) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: res?.error || "Failed to delete" }, { status: 500 });
  } catch (error: any) {
    console.error("API Delete Invoice Error:", error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
