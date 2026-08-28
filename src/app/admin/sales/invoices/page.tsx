import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DataTable, Td, Tr } from "@/components/admin/data-table";
import { StatRow } from "@/components/admin/stat-row";
import { PageHeader, TableSearch } from "@/components/admin/table";
import { Card, Skeleton } from "@/components/ui";
import { formatCurrency, formatDate, formatNumber, percent } from "@/lib/utils";
import { resolveRange } from "@/server/repositories/analytics";
import { getPaymentMix, listInvoices, VAT_RATE } from "@/server/repositories/sales";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoices" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = resolveRange(first(params.range) ?? "90d", first(params.from), first(params.to));

  const [invoices, mix] = await Promise.all([
    listInvoices(range, { q: first(params.q), method: first(params.method) }),
    getPaymentMix(range),
  ]);

  const gross = invoices.reduce((sum, i) => sum + i.total, 0);
  const vat = invoices.reduce((sum, i) => sum + i.vat, 0);
  const mixTotal = mix.reduce((sum, m) => sum + m.revenue, 0);

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Every confirmed booking is an invoice. VAT is shown as the 15% component already inside the total, the way a Bangladeshi VAT challan reads — not added on top."
      />

      <StatRow
        stats={[
          { label: "Invoices", value: formatNumber(invoices.length), detail: "last 90 days" },
          { label: "Gross billed", value: formatCurrency(gross) },
          { label: "VAT component", value: formatCurrency(vat), detail: `${percent(VAT_RATE * 100)} inclusive` },
          { label: "Net of VAT", value: formatCurrency(gross - vat) },
        ]}
      />

      <Card className="mb-5 px-5 py-4">
        <h2 className="font-admin text-[15px] font-bold text-ink-900">Collected by rail</h2>
        <p className="mt-0.5 mb-3 text-[13px] text-ink-400">Which payment method the money actually arrived on.</p>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {mix.map((m) => (
            <li key={m.method} className="rounded-lg bg-canvas px-3 py-2.5">
              <span className="block font-admin text-[13px] font-bold text-ink-900">{m.method}</span>
              <span className="block text-[12px] text-ink-400">
                {formatNumber(m.orders)} orders · {percent(mixTotal ? (m.revenue / mixTotal) * 100 : 0)}
              </span>
              <span className="mt-1 block font-admin text-[14px] font-bold text-brand-500">
                {formatCurrency(m.revenue)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <DataTable
        rowCount={invoices.length}
        minWidth={1000}
        toolbar={
          <Suspense fallback={<Skeleton className="h-10 w-full sm:max-w-xs" />}>
            <TableSearch placeholder="Search by reference or customer" />
          </Suspense>
        }
        columns={[
          { label: "Invoice" },
          { label: "Customer" },
          { label: "Vehicle" },
          { label: "Issued" },
          { label: "Method" },
          { label: "Net", align: "right" },
          { label: "VAT", align: "right" },
          { label: "Total", align: "right" },
        ]}
        empty={{ title: "No invoices", detail: "No confirmed bookings in this period." }}
      >
        {invoices.map((i) => (
          <Tr key={i.id}>
            <Td strong>
              <Link href={`/booking/${i.reference}`} className="font-mono text-[13px] hover:text-brand-500">
                {i.reference}
              </Link>
            </Td>
            <Td>
              {i.customerName}
              <span className="block text-[11px] text-ink-400">{i.customerEmail}</span>
            </Td>
            <Td muted>
              {i.vehicleName}
              <span className="block text-[11px] text-ink-400">{i.days} days</span>
            </Td>
            <Td muted>{formatDate(i.createdAt, { day: "numeric", month: "short", year: "numeric" })}</Td>
            <Td muted>{i.paymentMethod}</Td>
            <Td align="right">{formatCurrency(i.net)}</Td>
            <Td align="right">{formatCurrency(i.vat)}</Td>
            <Td align="right" strong>
              {formatCurrency(i.total)}
            </Td>
          </Tr>
        ))}
      </DataTable>
    </>
  );
}
