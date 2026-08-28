import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, Td, Tr } from "@/components/admin/data-table";
import { StatRow } from "@/components/admin/stat-row";
import { PageHeader } from "@/components/admin/table";
import { Badge } from "@/components/ui";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/utils";
import { getMaintenanceSummary, getServiceHistoryByModel } from "@/server/repositories/fleet-ops";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Service history" };

export default async function ServiceHistoryPage() {
  const [rows, summary] = await Promise.all([getServiceHistoryByModel(), getMaintenanceSummary()]);

  const totalSpend = rows.reduce((sum, r) => sum + r.spend, 0);
  const worst = rows[0];

  return (
    <>
      <PageHeader
        title="Service history"
        subtitle="Workshop spend rolled up by model. This is the number that decides which cars stay in the fleet next year."
      />

      <StatRow
        stats={[
          { label: "Lifetime workshop spend", value: formatCurrency(totalSpend) },
          { label: "Jobs recorded", value: formatNumber(rows.reduce((s, r) => s + r.jobs, 0)) },
          { label: "Average job", value: formatCurrency(summary.avgCost) },
          {
            label: "Costliest model",
            value: worst ? worst.vehicleName : "—",
            detail: worst ? formatCurrency(worst.spend) : undefined,
            tone: "warning",
          },
        ]}
      />

      <DataTable
        rowCount={rows.length}
        minWidth={860}
        columns={[
          { label: "Vehicle" },
          { label: "Segment" },
          { label: "Jobs", align: "right" },
          { label: "Average odometer", align: "right" },
          { label: "Last job" },
          { label: "Spend", align: "right" },
          { label: "Share", align: "right" },
        ]}
        empty={{ title: "No workshop history", detail: "No maintenance has been recorded against the fleet." }}
      >
        {rows.map((r) => (
          <Tr key={r.vehicleSlug}>
            <Td strong>
              <Link href={`/cars/${r.vehicleSlug}`} className="hover:text-brand-500">
                {r.vehicleName}
              </Link>
            </Td>
            <Td>
              <Badge tone={r.segment === "exclusive" ? "softWarning" : "neutral"}>{r.segment}</Badge>
            </Td>
            <Td align="right">{formatNumber(r.jobs)}</Td>
            <Td align="right">{formatNumber(r.avgOdometer)} km</Td>
            <Td muted>{r.lastJobAt ? timeAgo(r.lastJobAt) : "—"}</Td>
            <Td align="right" strong>
              {formatCurrency(r.spend)}
            </Td>
            <Td align="right">
              <span className="flex items-center justify-end gap-2">
                <span className="h-1.5 w-14 overflow-hidden rounded-full bg-ink-100">
                  <span
                    className="block h-full rounded-full bg-brand-400"
                    style={{ width: `${totalSpend ? Math.max(3, (r.spend / totalSpend) * 100) : 0}%` }}
                  />
                </span>
              </span>
            </Td>
          </Tr>
        ))}
      </DataTable>
    </>
  );
}
