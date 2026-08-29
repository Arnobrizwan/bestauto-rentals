import type { Metadata } from "next";

import { CouponManager, CouponRowActions } from "@/components/admin/coupon-manager";
import { DataTable, Td, Tr } from "@/components/admin/data-table";
import { StatRow } from "@/components/admin/stat-row";
import { PageHeader } from "@/components/admin/table";
import { Badge } from "@/components/ui";
import { cn, formatCurrency, formatDate, formatNumber, percent } from "@/lib/utils";
import { listCoupons } from "@/server/repositories/fleet-ops";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Offers & coupons" };

export default async function PromoPage() {
  const coupons = await listCoupons();

  const live = coupons.filter((c) => c.active && c.daysLeft >= 0);
  const redemptions = coupons.reduce((sum, c) => sum + c.usedCount, 0);
  const expiringSoon = live.filter((c) => c.daysLeft <= 14).length;

  return (
    <>
      <PageHeader
        title="Offers & coupons"
        subtitle="Discount codes and their validity windows. The calendar here is the Bangladeshi one — Eid travel, the wedding season and the monsoon trough."
      />

      <CouponManager />

      <StatRow
        stats={[
          { label: "Live offers", value: formatNumber(live.length), tone: "success" },
          { label: "Expiring within 14 days", value: formatNumber(expiringSoon), tone: expiringSoon ? "warning" : "default" },
          { label: "Total redemptions", value: formatNumber(redemptions) },
          { label: "Codes on file", value: formatNumber(coupons.length) },
        ]}
      />

      <DataTable
        rowCount={coupons.length}
        minWidth={960}
        columns={[
          { label: "Code" },
          { label: "Offer" },
          { label: "Discount", align: "right" },
          { label: "Minimum" },
          { label: "Window" },
          { label: "Redeemed", align: "right" },
          { label: "Status", align: "right" },
          { label: "Actions", align: "right" },
        ]}
        empty={{ title: "No offers", detail: "No discount codes have been created." }}
      >
        {coupons.map((c) => (
          <Tr key={c.id}>
            <Td strong>
              <span className="font-mono text-[13px] tracking-tight">{c.code}</span>
            </Td>
            <Td muted>{c.description}</Td>
            <Td align="right" strong>
              {c.kind === "percent" ? percent(c.value) : formatCurrency(c.value)}
            </Td>
            <Td>{c.minDays === 1 ? "any booking" : `${c.minDays} days`}</Td>
            <Td muted>
              {formatDate(c.startsAt, { day: "numeric", month: "short" })} –{" "}
              {formatDate(c.endsAt, { day: "numeric", month: "short", year: "numeric" })}
            </Td>
            <Td align="right">
              <span className="flex items-center justify-end gap-2">
                <span className="h-1.5 w-14 overflow-hidden rounded-full bg-ink-100">
                  <span
                    className={cn("block h-full rounded-full bg-brand-400")}
                    style={{ width: `${c.usageLimit ? Math.min(100, (c.usedCount / c.usageLimit) * 100) : 0}%` }}
                  />
                </span>
                <span className="tabular-nums">
                  {formatNumber(c.usedCount)}/{formatNumber(c.usageLimit)}
                </span>
              </span>
            </Td>
            <Td align="right">
              {!c.active || c.daysLeft < 0 ? (
                <Badge tone="neutral">expired</Badge>
              ) : c.daysLeft <= 14 ? (
                <Badge tone="softWarning">{c.daysLeft} days left</Badge>
              ) : (
                <Badge tone="softSuccess">live</Badge>
              )}
            </Td>
            <Td align="right">
              <CouponRowActions id={c.id} code={c.code} active={c.active} />
            </Td>
          </Tr>
        ))}
      </DataTable>
    </>
  );
}
