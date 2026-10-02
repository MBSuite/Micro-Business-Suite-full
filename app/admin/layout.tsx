import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gate = await requireAdmin();

  if (!gate.ok) {
    redirect(gate.status === 401 ? "/login" : "/");
  }

  return children;
}