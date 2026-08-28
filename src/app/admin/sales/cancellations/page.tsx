import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, Td, Tr } from "@/components/admin/data-table";
import { StatRow } from "@/components/admin/stat-row";
import { PageHeader } from "@/components/admin/table";
import { Badge } from "@/components/ui";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { resolveRange } from "@/server/repositories/analytics";
import { listCancellations } from "@/server/repositories/sales";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cancellations" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const BAND_TONE = {
  "full refund": "softInfo",
  "50% retained": "softWarning",
  "no-show": "softDanger",
} as const;

export default async function CancellationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = resolveRange(first(params.range) ?? "90d", first(params.from), first(params.to));

  const rows = await listCancellations(range);

  const lost = rows.reduce((sum, r) => sum + r.total, 0);
  const refunded = rows.reduce((sum, r) => sum + r.refund, 0);
  const retained = rows.reduce((sum, r) => sum + r.retained, 0);

  return (
    <>
      <PageHeader
        title="Cancellations"
        subtitle="Cancelled bookings and what each one cost. The refund band follows the published policy — full refund beyond 48 hours' notice, half retained inside it, everything retained on a no-show — and is computed live, so the board always reflects the current policy."
      />

      <StatRow
        stats={[
          { label: "Cancellations", value: formatNumber(rows.length), detail: "last 90 days" },
          { label: "Booking value lost", value: formatCurrency(lost), tone: "danger" },
          { label: "Refunded", value: formatCurrency(refunded) },
          { label: "Retained", value: formatCurrency(retained), tone: "success" },
        ]}
      />

      <DataTable
        rowCount={rows.length}
        minWidth={980}
        columns={[
          { label: "Reference" },
          { label: "Customer" },
          { label: "Vehicle" },
          { label: "Was due" },
          { label: "Band" },
          { label: "Refund", align: "right" },
          { label: "Retained", align: "right" },
        ]}
        empty={{ title: "No cancellations", detail: "Nothing was cancelled in this period — a good sign." }}
      >
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td strong>
              <Link href={`/booking/${r.reference}`} className="font-mono text-[13px] hover:text-brand-500">
                {r.reference}
              </Link>
            </Td>
            <Td>
              {r.customerName}
              <span className="block text-[11px] text-ink-400">{r.customerPhone || r.customerEmail}</span>
            </Td>
            <Td muted>{r.vehicleName}</Td>
            <Td muted>{formatDate(r.pickupAt, { day: "numeric", month: "short", year: "numeric" })}</Td>
            <Td>
              <Badge tone={BAND_TONE[r.band]}>{r.band}</Badge>
            </Td>
            <Td align="right">{formatCurrency(r.refund)}</Td>
            <Td align="right" strong>
              {formatCurrency(r.retained)}
            </Td>
          </Tr>
        ))}
      </DataTable>
    </>
  );
}
