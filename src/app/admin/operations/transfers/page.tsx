import type { Metadata } from "next";

import { DataTable, Td, Tr } from "@/components/admin/data-table";
import { StatRow } from "@/components/admin/stat-row";
import { PageHeader } from "@/components/admin/table";
import { Badge, Card } from "@/components/ui";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { resolveRange } from "@/server/repositories/analytics";
import { getBranchFlow, getOneWayCorridors } from "@/server/repositories/branches";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Branch transfers" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TransfersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = resolveRange(first(params.range) ?? "90d", first(params.from), first(params.to));

  const [flow, corridors] = await Promise.all([getBranchFlow(range), getOneWayCorridors(range)]);

  const accumulating = flow.filter((f) => f.net > 0).sort((a, b) => b.net - a.net);
  const draining = flow.filter((f) => f.net < 0).sort((a, b) => a.net - b.net);
  const oneWay = flow.reduce((sum, f) => sum + f.oneWayOut, 0);
  const toMove = accumulating.reduce((sum, f) => sum + f.net, 0);

  return (
    <>
      <PageHeader
        title="Branch transfers"
        subtitle="A one-way hire from Dhaka to Cox's Bazar leaves a car at the coast that somebody has to drive back. This is where the fleet ends up, and what needs repositioning."
      />

      <StatRow
        stats={[
          { label: "One-way hires", value: formatNumber(oneWay), detail: "in the last 90 days" },
          {
            label: "Cars to reposition",
            value: formatNumber(toMove),
            tone: toMove ? "warning" : "success",
            detail: `${accumulating.length} branches accumulating`,
          },
          { label: "Branches running short", value: formatNumber(draining.length), tone: draining.length ? "danger" : "success" },
          { label: "Branches", value: formatNumber(flow.length) },
        ]}
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card className="px-5 py-4">
          <h2 className="font-admin text-[15px] font-bold text-ink-900">Cars piling up</h2>
          <p className="mt-0.5 mb-3 text-[13px] text-ink-400">More cars returned here than were collected.</p>
          {accumulating.length === 0 ? (
            <p className="text-[13px] text-ink-400">The network is balanced — nothing to move.</p>
          ) : (
            <ul className="space-y-2">
              {accumulating.slice(0, 5).map((f) => (
                <li key={f.branch} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-ink-700">{f.branch}</span>
                  <Badge tone="softWarning">+{f.net} to move</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="px-5 py-4">
          <h2 className="font-admin text-[15px] font-bold text-ink-900">Busiest one-way corridors</h2>
          <p className="mt-0.5 mb-3 text-[13px] text-ink-400">The routes a repositioning run should follow, in reverse.</p>
          {corridors.length === 0 ? (
            <p className="text-[13px] text-ink-400">No one-way hires in this period.</p>
          ) : (
            <ul className="space-y-2">
              {corridors.slice(0, 5).map((c) => (
                <li key={`${c.from}-${c.to}`} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[13px] text-ink-600">
                    {c.from} <span className="text-brand-500">→</span> {c.to}
                  </span>
                  <span className="shrink-0 font-admin text-[13px] font-bold text-ink-900">{c.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <DataTable
        rowCount={flow.length}
        minWidth={880}
        columns={[
          { label: "Branch" },
          { label: "Home fleet", align: "right" },
          { label: "Collected", align: "right" },
          { label: "Returned", align: "right" },
          { label: "One-way out", align: "right" },
          { label: "Net flow", align: "right" },
          { label: "Revenue", align: "right" },
        ]}
        empty={{ title: "No branch activity", detail: "Nothing was collected or returned in this period." }}
      >
        {flow.map((f) => (
          <Tr key={f.branch}>
            <Td strong>{f.branch}</Td>
            <Td align="right">{formatNumber(f.homeFleet)}</Td>
            <Td align="right">{formatNumber(f.pickups)}</Td>
            <Td align="right">{formatNumber(f.dropoffs)}</Td>
            <Td align="right">{formatNumber(f.oneWayOut)}</Td>
            <Td align="right">
              <span
                className={cn(
                  "font-admin text-[13px] font-bold tabular-nums",
                  f.net > 0 ? "text-brand-500" : f.net < 0 ? "text-danger" : "text-ink-400",
                )}
              >
                {f.net > 0 ? `+${f.net}` : f.net}
              </span>
            </Td>
            <Td align="right" strong>
              {formatCurrency(f.revenue)}
            </Td>
          </Tr>
        ))}
      </DataTable>
    </>
  );
}
