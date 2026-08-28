import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DataTable, Td, Tr } from "@/components/admin/data-table";
import { StatRow } from "@/components/admin/stat-row";
import { FilterTabs, PageHeader, TableSearch } from "@/components/admin/table";
import { Badge, Skeleton } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { getUnitBranches, listUnits } from "@/server/repositories/fleet-ops";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Units" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const STATUS_TONE = {
  available: "softSuccess",
  "on-hire": "softInfo",
  maintenance: "softWarning",
  "off-road": "softDanger",
} as const;

export default async function UnitsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = first(params.status) ?? "all";

  const [units, branches] = await Promise.all([
    listUnits({ q: first(params.q), status, branch: first(params.branch) }),
    getUnitBranches(),
  ]);

  const available = units.filter((u) => u.status === "available").length;
  const lapsed = units.filter((u) => u.soonestExpiryDays !== null && u.soonestExpiryDays < 0).length;
  const withJobs = units.filter((u) => u.openJobs > 0).length;

  return (
    <>
      <PageHeader
        title="Units"
        subtitle={`${formatNumber(units.length)} registered cars across ${branches.length} branches — the individual vehicles behind each model`}
      />

      <StatRow
        stats={[
          { label: "Registered units", value: formatNumber(units.length) },
          { label: "Available now", value: formatNumber(available), tone: "success" },
          { label: "With an open job", value: formatNumber(withJobs), tone: withJobs ? "warning" : "default" },
          {
            label: "Carrying a lapsed document",
            value: formatNumber(lapsed),
            tone: lapsed ? "danger" : "success",
            detail: lapsed ? "Cannot legally carry a fare" : "All papers current",
          },
        ]}
      />

      <DataTable
        rowCount={units.length}
        minWidth={980}
        toolbar={
          <>
            <Suspense fallback={<Skeleton className="h-10 w-full sm:max-w-xs" />}>
              <TableSearch placeholder="Search by registration or model" />
            </Suspense>
            <div className="flex flex-1 flex-wrap items-center gap-3 lg:justify-end">
              <Suspense fallback={<Skeleton className="h-10 w-72" />}>
                <FilterTabs
                  name="status"
                  options={[
                    { value: "all", label: "All" },
                    { value: "available", label: "Available" },
                    { value: "on-hire", label: "On hire" },
                    { value: "maintenance", label: "Maintenance" },
                  ]}
                />
              </Suspense>
            </div>
          </>
        }
        columns={[
          { label: "Registration" },
          { label: "Model" },
          { label: "Branch" },
          { label: "Status" },
          { label: "Odometer", align: "right" },
          { label: "Open jobs", align: "right" },
          { label: "Papers", align: "right" },
        ]}
        empty={{ title: "No units match", detail: "Try clearing the search or switching status." }}
      >
        {units.map((u) => (
          <Tr key={u.id}>
            <Td strong>
              <span className="font-mono text-[13px] tracking-tight">{u.registration}</span>
            </Td>
            <Td>
              <Link href={`/cars/${u.vehicleSlug}`} className="font-semibold text-ink-700 hover:text-brand-500">
                {u.vehicleName}
              </Link>
            </Td>
            <Td muted>{u.branch}</Td>
            <Td>
              <Badge tone={STATUS_TONE[u.status as keyof typeof STATUS_TONE] ?? "neutral"}>{u.status}</Badge>
            </Td>
            <Td align="right">{formatNumber(u.odometerKm)} km</Td>
            <Td align="right">
              {u.openJobs > 0 ? <span className="font-bold text-brand-500">{u.openJobs}</span> : "—"}
            </Td>
            <Td align="right">
              {u.soonestExpiryDays === null ? (
                <span className="text-ink-400">—</span>
              ) : u.soonestExpiryDays < 0 ? (
                <Badge tone="softDanger">lapsed</Badge>
              ) : u.soonestExpiryDays <= 30 ? (
                <Badge tone="softWarning">{u.soonestExpiryDays}d</Badge>
              ) : (
                <span className="text-ink-400">{u.soonestExpiryDays}d</span>
              )}
            </Td>
          </Tr>
        ))}
      </DataTable>
    </>
  );
}
