import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/shell";
import { getCurrentAdmin } from "@/lib/auth/server";
import { countUnactionedHotLeads } from "@/server/repositories/leads";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Best Auto admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Middleware has already verified the cookie signature; this is the
  // authoritative check that the account still exists and is active.
  // The cookie signature already passed at the edge, so arriving here without
  // an account means the row is gone or deactivated. `stale` tells the login
  // page to explain that rather than silently showing an empty form.
  const user = await getCurrentAdmin();
  if (!user) redirect("/login?next=/admin&stale=1");

  // Hot leads still waiting on someone, not every lead ever scored hot — the
  // badge has to fall when the work is done, or it is not a badge.
  const hotLeads = await countUnactionedHotLeads().catch(() => 0);

  return (
    <AdminShell hotLeads={hotLeads} user={user}>
      {children}
    </AdminShell>
  );
}
