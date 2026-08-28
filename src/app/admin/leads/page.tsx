import type { Metadata } from "next";
import { Suspense } from "react";

import { LeadRow, type LeadView } from "@/components/admin/lead-row";
import { FilterTabs, PageHeader, Pagination, TableSearch } from "@/components/admin/table";
import { ExportButton } from "@/components/admin/export-button";
import { Card, EmptyState, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getLeadFunnel, listLeads } from "@/server/repositories/leads";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leads" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(first(params.page) ?? 1) || 1);

  const [result, funnel] = await Promise.all([
    listLeads({ tier: first(params.tier), status: first(params.status), q: first(params.q), page, pageSize: 12 }),
    getLeadFunnel(),
  ]);

  const tierCount = (tier: string) => funnel.find((f) => f.tier === tier)?.n ?? 0;
  const total = funnel.reduce((sum, f) => sum + f.n, 0);

  const leads: LeadView[] = result.items.map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    phone: l.phone,
    company: l.company,
    message: l.message,
    intent: l.intent,
    budgetPerDay: l.budgetPerDay,
    timeframe: l.timeframe,
    score: l.score,
    tier: l.tier,
    status: l.status,
    aiSummary: l.aiSummary,
    aiNextAction: l.aiNextAction,
    aiEngine: l.aiEngine,
    aiSignals: l.aiSignals,
    source: l.source,
    createdAt: l.createdAt.toISOString(),
  }));

  const cards = [
    { tier: "hot", label: "Hot", detail: "Call within the hour", tone: "border-l-danger" },
    { tier: "warm", label: "Warm", detail: "Send a matched shortlist", tone: "border-l-brand-400" },
    { tier: "cold", label: "Cold", detail: "Weekly nurture digest", tone: "border-l-ink-300" },
  ];

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${total} inbound enquiries, scored automatically the moment they arrive.`}
      >
        <ExportButton dataset="leads" />
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const funnelRow = funnel.find((f) => f.tier === card.tier);
          return (
            <Card key={card.tier} className={cn("border-l-4 px-5 py-4", card.tone)}>
              <p className="text-[13px] text-ink-400">{card.label} leads</p>
              <p className="mt-1 font-admin text-2xl font-bold text-ink-900">{tierCount(card.tier)}</p>
              <p className="mt-1 text-[12px] text-ink-400">
                Avg score {Math.round(funnelRow?.avgScore ?? 0)} · {card.detail}
              </p>
            </Card>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <Suspense fallback={<Skeleton className="h-10 w-full sm:max-w-xs" />}>
            <TableSearch placeholder="Name, email or message" />
          </Suspense>
          <div className="flex flex-1 flex-wrap items-center gap-3 lg:justify-end">
            <Suspense fallback={<Skeleton className="h-10 w-56" />}>
              <FilterTabs
                name="tier"
                options={[
                  { value: "all", label: "All", count: total },
                  { value: "hot", label: "Hot", count: tierCount("hot") },
                  { value: "warm", label: "Warm", count: tierCount("warm") },
                  { value: "cold", label: "Cold", count: tierCount("cold") },
                ]}
              />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-10 w-56" />}>
              <FilterTabs
                name="status"
                options={[
                  { value: "all", label: "Any status" },
                  { value: "new", label: "New" },
                  { value: "contacted", label: "Contacted" },
                  { value: "converted", label: "Converted" },
                ]}
              />
            </Suspense>
          </div>
        </div>

        {leads.length === 0 ? (
          <EmptyState title="No leads here" detail="Try a different tier, status or search term." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead>
                <tr className="bg-canvas text-left">
                  {["Lead", "AI score", "Tier", "Intent", "Source", "Received", "Status"].map((h) => (
                    <th key={h} className="px-5 py-3 font-admin text-[13px] font-bold text-ink-900 last:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {leads.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} />
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
