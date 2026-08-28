import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { DataTable, Td, Tr } from "@/components/admin/data-table";
import { StatRow } from "@/components/admin/stat-row";
import { PageHeader } from "@/components/admin/table";
import { Badge, EmptyState } from "@/components/ui";
import { cn, formatCurrency, formatNumber, percent } from "@/lib/utils";
import { getLowAvailability } from "@/server/repositories/catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Low availability" };

export default async function LowAvailabilityPage() {
  const rows = await getLowAvailability();

  const soldOut = rows.filter((r) => r.unitsAvailable === 0);
  const demandAtRisk = rows.reduce((sum, r) => sum + r.recentBookings, 0);

  return (
    <>
      <PageHeader
        title="Low availability"
        subtitle="Models with 40% or less of their units free. Recent demand is shown alongside, because a thin model only matters when people are asking for it."
      />

      <StatRow
        stats={[
          { label: "Models running short", value: formatNumber(rows.length), tone: rows.length ? "warning" : "success" },
          { label: "Fully committed", value: formatNumber(soldOut.length), tone: soldOut.length ? "danger" : "success" },
          { label: "Bookings in last 30 days", value: formatNumber(demandAtRisk), detail: "across these models" },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="The whole fleet has headroom"
          detail="Every model has more than 40% of its units free right now."
        />
      ) : (
        <DataTable
          rowCount={rows.length}
          minWidth={880}
          columns={[
            { label: "Vehicle" },
            { label: "Segment" },
            { label: "Branch" },
            { label: "Price / day" },
            { label: "Availability" },
            { label: "Last 30 days", align: "right" },
          ]}
          empty={{ title: "Nothing running short", detail: "Every model has headroom." }}
        >
          {rows.map((v) => {
            const pct = v.ratio * 100;
            return (
              <Tr key={v.id}>
                <Td>
                  <span className="flex items-center gap-3">
                    <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                      <Image src={v.imageUrl} alt="" fill sizes="44px" className="object-cover" />
                    </span>
                    <Link
                      href={`/cars/${v.slug}`}
                      className="font-admin text-[14px] font-bold text-ink-900 hover:text-brand-500"
                    >
                      {v.name}
                    </Link>
                  </span>
                </Td>
                <Td>
                  <Badge tone={v.segment === "exclusive" ? "softWarning" : "neutral"}>{v.segment}</Badge>
                </Td>
                <Td muted>{v.location}</Td>
                <Td strong>{formatCurrency(v.pricePerDay)}</Td>
                <Td>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
                      <span
                        className={cn("block h-full rounded-full", pct === 0 ? "bg-danger" : pct <= 20 ? "bg-danger" : "bg-brand-400")}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </span>
                    <span className="tabular-nums">
                      {v.unitsAvailable}/{v.unitsTotal}
                    </span>
                    <span className="text-ink-400">({percent(pct)})</span>
                  </span>
                </Td>
                <Td align="right" strong>
                  {formatNumber(v.recentBookings)}
                </Td>
              </Tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}
