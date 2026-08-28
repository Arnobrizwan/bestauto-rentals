import type { Metadata } from "next";
import { Suspense } from "react";

import { DataTable, Td, Tr } from "@/components/admin/data-table";
import { StatRow } from "@/components/admin/stat-row";
import { FilterTabs, PageHeader } from "@/components/admin/table";
import { Badge, Skeleton } from "@/components/ui";
import { formatDate, formatNumber } from "@/lib/utils";
import { getDocumentSummary, listDocuments } from "@/server/repositories/fleet-ops";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Document expiry" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const KIND_LABEL: Record<string, string> = {
  fitness: "Fitness certificate",
  "tax-token": "Tax token",
  insurance: "Insurance",
  "route-permit": "Route permit",
};

export default async function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const kind = first(params.kind) ?? "all";

  const [documents, summary] = await Promise.all([listDocuments({ kind }), getDocumentSummary()]);

  return (
    <>
      <PageHeader
        title="Document expiry"
        subtitle="A car in Bangladesh cannot legally carry a paying passenger without a current fitness certificate, tax token, insurance cover note and route permit. This is that board, soonest first."
      />

      <StatRow
        stats={[
          { label: "Documents tracked", value: formatNumber(summary.total) },
          {
            label: "Lapsed",
            value: formatNumber(summary.lapsed),
            tone: summary.lapsed ? "danger" : "success",
            detail: `${formatNumber(summary.unitsBlocked)} units affected`,
          },
          {
            label: "Due within 30 days",
            value: formatNumber(summary.dueThisMonth),
            tone: summary.dueThisMonth ? "warning" : "default",
          },
          {
            label: "Current",
            value: formatNumber(summary.total - summary.lapsed - summary.dueThisMonth),
            tone: "success",
          },
        ]}
      />

      <DataTable
        rowCount={documents.length}
        minWidth={940}
        toolbar={
          <Suspense fallback={<Skeleton className="h-10 w-96" />}>
            <FilterTabs
              name="kind"
              options={[
                { value: "all", label: "All papers" },
                { value: "fitness", label: "Fitness" },
                { value: "tax-token", label: "Tax token" },
                { value: "insurance", label: "Insurance" },
                { value: "route-permit", label: "Route permit" },
              ]}
            />
          </Suspense>
        }
        columns={[
          { label: "Registration" },
          { label: "Vehicle" },
          { label: "Document" },
          { label: "Reference" },
          { label: "Branch" },
          { label: "Expires" },
          { label: "Status", align: "right" },
        ]}
        empty={{ title: "Nothing to show", detail: "No documents match this filter." }}
      >
        {documents.map((d) => (
          <Tr key={d.id}>
            <Td strong>
              <span className="font-mono text-[13px] tracking-tight">{d.registration}</span>
            </Td>
            <Td>{d.vehicleName}</Td>
            <Td>{KIND_LABEL[d.kind] ?? d.kind}</Td>
            <Td muted>
              <span className="font-mono text-[12px]">{d.reference}</span>
            </Td>
            <Td muted>{d.branch}</Td>
            <Td>{formatDate(d.expiresAt, { day: "numeric", month: "short", year: "numeric" })}</Td>
            <Td align="right">
              {d.daysLeft < 0 ? (
                <Badge tone="danger">lapsed {Math.abs(d.daysLeft)}d ago</Badge>
              ) : d.daysLeft === 0 ? (
                <Badge tone="danger">expires today</Badge>
              ) : d.daysLeft <= 30 ? (
                <Badge tone="softWarning">{d.daysLeft} days left</Badge>
              ) : (
                <span className="text-ink-400">{d.daysLeft} days</span>
              )}
            </Td>
          </Tr>
        ))}
      </DataTable>
    </>
  );
}
