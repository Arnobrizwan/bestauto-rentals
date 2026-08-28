import type { Metadata } from "next";
import { Suspense } from "react";

import { DataTable, Td, Tr } from "@/components/admin/data-table";
import { StatRow } from "@/components/admin/stat-row";
import { FilterTabs, PageHeader } from "@/components/admin/table";
import { Badge, Skeleton } from "@/components/ui";
import { formatCurrency, formatDate, formatNumber, timeAgo } from "@/lib/utils";
import { getMaintenanceSummary, listMaintenance } from "@/server/repositories/fleet-ops";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Off-road & maintenance" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const STATUS_TONE = { open: "softDanger", "in-progress": "softWarning", done: "softSuccess" } as const;

export default async function MaintenancePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = first(params.status) ?? "all";

  const [jobs, summary] = await Promise.all([listMaintenance({ status }), getMaintenanceSummary()]);

  return (
    <>
      <PageHeader
        title="Off-road & maintenance"
        subtitle="Every workshop job against a registered unit. An open job is why a car is not earning."
      />

      <StatRow
        stats={[
          { label: "Open jobs", value: formatNumber(summary.openJobs), tone: summary.openJobs ? "warning" : "success" },
          {
            label: "Units off the road",
            value: formatNumber(summary.unitsOffRoad),
            tone: summary.unitsOffRoad ? "danger" : "success",
          },
          { label: "Spend this year", value: formatCurrency(summary.spendYtd) },
          { label: "Average job cost", value: formatCurrency(summary.avgCost) },
        ]}
      />

      <DataTable
        rowCount={jobs.length}
        minWidth={1020}
        toolbar={
          <Suspense fallback={<Skeleton className="h-10 w-80" />}>
            <FilterTabs
              name="status"
              options={[
                { value: "all", label: "All jobs" },
                { value: "open", label: "Still open" },
                { value: "in-progress", label: "In progress" },
                { value: "done", label: "Completed" },
              ]}
            />
          </Suspense>
        }
        columns={[
          { label: "Registration" },
          { label: "Vehicle" },
          { label: "Job" },
          { label: "Garage" },
          { label: "Opened" },
          { label: "Status" },
          { label: "Cost", align: "right" },
        ]}
        empty={{ title: "No jobs match", detail: "Nothing in the workshop under this filter." }}
      >
        {jobs.map((j) => (
          <Tr key={j.id}>
            <Td strong>
              <span className="font-mono text-[13px] tracking-tight">{j.registration}</span>
            </Td>
            <Td>
              {j.vehicleName}
              <span className="block text-[11px] text-ink-400">{j.branch}</span>
            </Td>
            <Td>
              <span className="block font-semibold text-ink-700 capitalize">{j.kind}</span>
              <span className="block text-[12px] text-ink-400">{j.summary}</span>
            </Td>
            <Td muted>{j.garage}</Td>
            <Td muted>
              {timeAgo(j.openedAt)}
              {j.closedAt && (
                <span className="block text-[11px] text-ink-400">
                  closed {formatDate(j.closedAt, { day: "numeric", month: "short" })}
                </span>
              )}
            </Td>
            <Td>
              <Badge tone={STATUS_TONE[j.status as keyof typeof STATUS_TONE] ?? "neutral"}>{j.status}</Badge>
            </Td>
            <Td align="right" strong>
              {formatCurrency(j.cost)}
            </Td>
          </Tr>
        ))}
      </DataTable>
    </>
  );
}
