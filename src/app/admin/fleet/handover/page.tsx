import type { Metadata } from "next";

import { StatRow } from "@/components/admin/stat-row";
import { PageHeader } from "@/components/admin/table";
import { Card, EmptyState } from "@/components/ui";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { getMovements } from "@/server/repositories/availability";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Handover sheet" };

/** The physical checks a driver signs off before a car leaves the branch. */
const CHECKS = [
  "BRTA licence and NID seen and photographed",
  "Fuel level and odometer recorded",
  "Exterior walk-around, damage marked on the diagram",
  "Spare wheel, jack and first-aid kit present",
  "Air conditioning tested",
  "Deposit taken and receipt issued",
];

export default async function HandoverPage() {
  const { pickups } = await getMovements(7);

  const value = pickups.reduce((sum, p) => sum + p.total, 0);

  return (
    <>
      <PageHeader
        title="Handover sheet"
        subtitle="One sheet per car going out this week, ready to print for the counter. Every field is the real booking, so nothing is transcribed by hand."
      />

      <StatRow
        stats={[
          { label: "Handovers this week", value: formatNumber(pickups.length) },
          { label: "Value going out", value: formatCurrency(value) },
          { label: "Checks per handover", value: formatNumber(CHECKS.length) },
        ]}
      />

      {pickups.length === 0 ? (
        <EmptyState
          title="Nothing to hand over"
          detail="No confirmed pickups are scheduled in the next seven days."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {pickups.map((p) => (
            <Card key={p.reference} className="break-inside-avoid p-5">
              <div className="flex items-start justify-between gap-4 border-b border-line pb-3">
                <div>
                  <p className="font-admin text-[15px] font-bold text-ink-900">{p.vehicleName}</p>
                  <p className="text-[12px] text-ink-400">{p.pickupLocation}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-canvas px-2.5 py-1 font-mono text-[12px] font-bold text-ink-700">
                  {p.reference}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 py-3 text-[13px]">
                <div>
                  <dt className="text-ink-400">Customer</dt>
                  <dd className="font-semibold text-ink-900">{p.customerName}</dd>
                </div>
                <div>
                  <dt className="text-ink-400">Phone</dt>
                  <dd className="font-semibold text-ink-900">{p.customerPhone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-400">Out</dt>
                  <dd className="font-semibold text-ink-900">
                    {formatDate(p.pickupAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-400">Back</dt>
                  <dd className="font-semibold text-ink-900">
                    {formatDate(p.dropoffAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-400">Returning to</dt>
                  <dd className="font-semibold text-ink-900">{p.dropoffLocation}</dd>
                </div>
                <div>
                  <dt className="text-ink-400">Total</dt>
                  <dd className="font-admin font-bold text-brand-500">{formatCurrency(p.total)}</dd>
                </div>
              </dl>

              <ul className="space-y-1.5 border-t border-line pt-3">
                {CHECKS.map((check) => (
                  <li key={check} className="flex items-start gap-2.5 text-[12px] text-ink-600">
                    <span aria-hidden className="mt-0.5 size-3.5 shrink-0 rounded border border-ink-300" />
                    {check}
                  </li>
                ))}
              </ul>

              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-[11px] text-ink-400">
                <p>Driver signature</p>
                <p>Customer signature</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
