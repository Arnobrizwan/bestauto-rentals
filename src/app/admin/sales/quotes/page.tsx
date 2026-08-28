import type { Metadata } from "next";
import { Suspense } from "react";

import { DataTable, Td, Tr } from "@/components/admin/data-table";
import { StatRow } from "@/components/admin/stat-row";
import { FilterTabs, PageHeader } from "@/components/admin/table";
import { Badge, Skeleton } from "@/components/ui";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/utils";
import { listQuotes, quoteCandidates } from "@/server/repositories/sales";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quotes" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const TIER_TONE = { hot: "softDanger", warm: "softWarning", cold: "softInfo" } as const;

export default async function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = first(params.status) ?? "all";

  const quotes = await listQuotes({ status });

  // Price the top of the queue against the live fleet, so the desk opens on a
  // number rather than on a name it still has to go and look up.
  const priced = await Promise.all(
    quotes.slice(0, 25).map(async (q) => ({
      ...q,
      candidates: await quoteCandidates(q.partySize, q.budgetPerDay),
    })),
  );

  const hot = quotes.filter((q) => q.tier === "hot").length;
  const budgeted = quotes.filter((q) => q.budgetPerDay);
  const avgBudget = budgeted.length
    ? budgeted.reduce((sum, q) => sum + (q.budgetPerDay ?? 0), 0) / budgeted.length
    : 0;

  return (
    <>
      <PageHeader
        title="Quotes"
        subtitle="Leads carrying enough detail to price — a budget, a party size or a firm timeframe. Each one is matched against the live fleet, ordered by the AI qualifier's score."
      />

      <StatRow
        stats={[
          { label: "Quotable enquiries", value: formatNumber(quotes.length) },
          { label: "Hot", value: formatNumber(hot), tone: hot ? "danger" : "default" },
          { label: "Average stated budget", value: avgBudget ? formatCurrency(avgBudget) : "—", detail: "per day" },
          { label: "Awaiting a number", value: formatNumber(quotes.filter((q) => q.status === "new").length), tone: "warning" },
        ]}
      />

      <DataTable
        rowCount={priced.length}
        minWidth={1040}
        toolbar={
          <Suspense fallback={<Skeleton className="h-10 w-72" />}>
            <FilterTabs
              name="status"
              options={[
                { value: "all", label: "All" },
                { value: "new", label: "New" },
                { value: "contacted", label: "Contacted" },
                { value: "won", label: "Won" },
              ]}
            />
          </Suspense>
        }
        columns={[
          { label: "Enquiry" },
          { label: "Needs" },
          { label: "Budget / day", align: "right" },
          { label: "Best match" },
          { label: "Score", align: "right" },
          { label: "Next action" },
        ]}
        empty={{ title: "Nothing to quote", detail: "No enquiry carries enough detail to price yet." }}
      >
        {priced.map((q) => {
          const best = q.candidates[0];
          return (
            <Tr key={q.id}>
              <Td strong>
                {q.name}
                <span className="block text-[11px] font-normal text-ink-400">
                  {q.company || q.email} · {timeAgo(q.createdAt)}
                </span>
              </Td>
              <Td>
                {q.partySize ? `${q.partySize} passengers` : "party size unstated"}
                <span className="block text-[11px] text-ink-400 capitalize">
                  {q.intent} · {q.timeframe.replace(/-/g, " ")}
                </span>
              </Td>
              <Td align="right" strong>
                {q.budgetPerDay ? formatCurrency(q.budgetPerDay) : "—"}
              </Td>
              <Td>
                {best ? (
                  <>
                    <span className="font-semibold text-ink-700">{best.name}</span>
                    <span className="block text-[11px] text-ink-400">
                      {best.seats} seats · {formatCurrency(best.pricePerDay)}
                    </span>
                  </>
                ) : (
                  <span className="text-ink-400">nothing fits the brief</span>
                )}
              </Td>
              <Td align="right">
                <Badge tone={TIER_TONE[q.tier as keyof typeof TIER_TONE] ?? "neutral"}>{q.score}</Badge>
              </Td>
              <Td muted>{q.aiNextAction || "—"}</Td>
            </Tr>
          );
        })}
      </DataTable>
    </>
  );
}
