import type { Metadata } from "next";

import { describeEngine, resolveProvider } from "@/ai/provider";
import { AdminShell } from "@/components/admin/shell";
import { getLeadFunnel } from "@/server/repositories/leads";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Best Auto admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const funnel = await getLeadFunnel().catch(() => []);
  const hotLeads = funnel.find((f) => f.tier === "hot")?.n ?? 0;

  return (
    <AdminShell engine={describeEngine(resolveProvider())} hotLeads={hotLeads}>
      {children}
    </AdminShell>
  );
}
