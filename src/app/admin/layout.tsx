import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/shell";
import { getCurrentAdmin } from "@/lib/auth/server";
import { getLeadFunnel } from "@/server/repositories/leads";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Best Auto admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Middleware has already verified the cookie signature; this is the
  // authoritative check that the account still exists and is active.
  const user = await getCurrentAdmin();
  if (!user) redirect("/login?next=/admin");

  const funnel = await getLeadFunnel().catch(() => []);
  const hotLeads = funnel.find((f) => f.tier === "hot")?.n ?? 0;

  return (
    <AdminShell hotLeads={hotLeads} user={user}>
      {children}
    </AdminShell>
  );
}
