import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, Td, Tr } from "@/components/admin/data-table";
import { StatRow } from "@/components/admin/stat-row";
import { PageHeader } from "@/components/admin/table";
import { Badge, Card } from "@/components/ui";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { getFleetAvailability, getMovements } from "@/server/repositories/availability";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Availability" };

const WINDOW = 14;

export default async function AvailabilityPage() {
  const [fleet, movements] = await Promise.all([getFleetAvailability(WINDOW), getMovements(7)]);

  const onHire = fleet.reduce((sum, v) => sum + v.onHireNow, 0);
  const units = fleet.reduce((sum, v) => sum + v.unitsTotal, 0);
  const soldOut = fleet.filter((v) => v.soldOut);

  return (
    <>
      <PageHeader
        title="Availability"
        subtitle={`Every model, day by day, for the next ${WINDOW} days. A filled cell is a unit committed to a confirmed booking.`}
      />

      <StatRow
        stats={[
          { label: "On hire right now", value: `${formatNumber(onHire)} / ${formatNumber(units)}` },
          {
            label: "Models fully booked at some point",
            value: formatNumber(soldOut.length),
            tone: soldOut.length ? "warning" : "success",
          },
          { label: "Handovers due this week", value: formatNumber(movements.pickups.length) },
          { label: "Returns due this week", value: formatNumber(movements.returns.length) },
        ]}
      />

      <Card className="mb-5 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-admin text-[15px] font-bold text-ink-900">Forward availability</h2>
          <p className="mt-0.5 text-[13px] text-ink-400">
            Free units per day. Amber is the last unit; red is fully committed.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 980 }}>
            <thead>
              <tr className="bg-canvas text-left">
                <th className="sticky left-0 z-10 bg-canvas px-5 py-3 font-admin text-[13px] font-bold text-ink-900">
                  Vehicle
                </th>
                {fleet[0]?.days.map((d) => (
                  <th key={d.date} className="px-1 py-3 text-center font-admin text-[11px] font-bold text-ink-500">
                    {formatDate(d.date, { day: "numeric", month: "short" })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {fleet.map((v) => (
                <tr key={v.id} className="transition-colors hover:bg-canvas">
                  <td className="sticky left-0 z-10 bg-white px-5 py-3 group-hover:bg-canvas">
                    <Link
                      href={`/cars/${v.slug}`}
                      className="block font-admin text-[13px] font-bold text-ink-900 hover:text-brand-500"
                    >
                      {v.name}
                    </Link>
                    <span className="text-[11px] text-ink-400">{v.unitsTotal} units · {v.location}</span>
                  </td>
                  {v.days.map((d) => (
                    <td key={d.date} className="px-1 py-3 text-center">
                      <span
                        title={`${d.free} of ${v.unitsTotal} free on ${d.date}`}
                        className={cn(
                          "mx-auto grid size-7 place-items-center rounded-md font-admin text-[11px] font-bold tabular-nums",
                          d.free === 0
                            ? "bg-danger-soft text-danger"
                            : d.free === 1
                              ? "bg-warning-soft text-brand-600"
                              : "bg-success-soft text-success",
                        )}
                      >
                        {d.free}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <div>
          <h2 className="mb-2 font-admin text-[15px] font-bold text-ink-900">Handovers due</h2>
          <DataTable
            rowCount={movements.pickups.length}
            minWidth={520}
            columns={[{ label: "When" }, { label: "Customer" }, { label: "Vehicle" }, { label: "Branch" }]}
            empty={{ title: "Nothing to hand over", detail: "No pickups are scheduled in the next seven days." }}
          >
            {movements.pickups.slice(0, 12).map((p) => (
              <Tr key={p.reference}>
                <Td strong>{formatDate(p.pickupAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Td>
                <Td>
                  {p.customerName}
                  <span className="block text-[11px] text-ink-400">{p.customerPhone || p.reference}</span>
                </Td>
                <Td muted>{p.vehicleName}</Td>
                <Td muted>{p.pickupLocation}</Td>
              </Tr>
            ))}
          </DataTable>
        </div>

        <div>
          <h2 className="mb-2 font-admin text-[15px] font-bold text-ink-900">Returns due</h2>
          <DataTable
            rowCount={movements.returns.length}
            minWidth={520}
            columns={[{ label: "When" }, { label: "Customer" }, { label: "Vehicle" }, { label: "Value", align: "right" }]}
            empty={{ title: "Nothing coming back", detail: "No returns are scheduled in the next seven days." }}
          >
            {movements.returns.slice(0, 12).map((r) => (
              <Tr key={r.reference}>
                <Td strong>{formatDate(r.dropoffAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Td>
                <Td>{r.customerName}</Td>
                <Td muted>{r.vehicleName}</Td>
                <Td align="right" strong>
                  {formatCurrency(r.total)}
                </Td>
              </Tr>
            ))}
          </DataTable>
        </div>
      </div>

      {soldOut.length > 0 && (
        <p className="mt-4 text-[13px] text-ink-400">
          Fully committed at some point in the window:{" "}
          {soldOut.map((v, i) => (
            <span key={v.id}>
              {i > 0 && ", "}
              <Badge tone="softDanger">{v.name}</Badge>
            </span>
          ))}
        </p>
      )}
    </>
  );
}
