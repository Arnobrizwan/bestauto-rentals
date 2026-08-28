import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader, Pagination, TableSearch } from "@/components/admin/table";
import { ExportButton } from "@/components/admin/export-button";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { listCustomers } from "@/server/repositories/customers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customers" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(first(params.page) ?? 1) || 1);
  const result = await listCustomers({ q: first(params.q), page, pageSize: 12 });

  return (
    <>
      <PageHeader title="Customers" subtitle="Ranked by lifetime value across every completed booking." >
        <ExportButton dataset="customers" />
      </PageHeader>

      <Card className="overflow-hidden">
        <div className="border-b border-line p-4">
          <Suspense fallback={<Skeleton className="h-10 w-full sm:max-w-xs" />}>
            <TableSearch placeholder="Name, email or city" />
          </Suspense>
        </div>

        {result.items.length === 0 ? (
          <EmptyState title="No customers found" detail="Nothing matches that search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="bg-canvas text-left">
                  {["Customer", "Location", "Bookings", "Last booking", "Joined", "Lifetime value"].map((h) => (
                    <th key={h} className="px-5 py-3 font-admin text-[13px] font-bold text-ink-900 last:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-canvas">
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-900 font-admin text-[12px] font-bold text-white">
                          {initials(c.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-admin text-[14px] font-bold text-ink-900">{c.name}</span>
                          <span className="block truncate text-[12px] text-ink-400">{c.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-ink-500">
                      {c.city}
                      <span className="block text-[12px] text-ink-400">{c.country}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={c.bookingCount >= 5 ? "softSuccess" : "neutral"}>{c.bookingCount}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-ink-500">
                      {c.lastBookingAt ? formatDate(c.lastBookingAt) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-ink-500">{formatDate(c.createdAt)}</td>
                    <td className="px-5 py-3.5 text-right font-admin text-[14px] font-bold text-ink-900">
                      {formatCurrency(c.lifetimeValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Suspense fallback={null}>
          <Pagination page={result.page} pageCount={result.pageCount} total={result.total} />
        </Suspense>
      </Card>
    </>
  );
}
