import type { Metadata } from "next";

import { AI_AGENTS } from "@/ai/prompts";
import { describeEngine, resolveProvider } from "@/ai/provider";
import {
  CONCIERGE_CASES,
  HOSTED_PASS_THRESHOLD,
  QUALIFIER_CASES,
  RECOMMENDER_CASES,
  RULES_PASS_THRESHOLD,
} from "@/ai/evaluation/cases";
import { TOOL_SPECS } from "@/ai/tools";
import { KNOWLEDGE } from "@/ai/tools/knowledge";
import { LeadScorer } from "@/components/admin/lead-scorer";
import { PageHeader } from "@/components/admin/table";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { listConversations } from "@/server/repositories/conversations";
import { getLeadFunnel } from "@/server/repositories/leads";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI console" };

export default async function AiConsolePage() {
  const engine = describeEngine(resolveProvider());
  const [conversations, funnel] = await Promise.all([listConversations(12), getLeadFunnel()]);

  const scoredLeads = funnel.reduce((sum, f) => sum + f.n, 0);
  const totalCases = CONCIERGE_CASES.length + RECOMMENDER_CASES.length + QUALIFIER_CASES.length;
  // The gate depends on which engine is answering: a hosted model's wording
  // varies between runs, the rules engine is deterministic and must be perfect.
  const threshold = engine.hosted ? HOSTED_PASS_THRESHOLD : RULES_PASS_THRESHOLD;
  const gate = `${(threshold * 100).toFixed(0)}%${engine.hosted ? "" : " — the rules engine is deterministic"}`;

  return (
    <>
      <PageHeader
        title="AI console"
        subtitle="What the AI layer is doing, which engine is answering, and how it is evaluated."
      />

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader title="Engine" />
          <div className="p-5">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "grid size-11 place-items-center rounded-xl text-white",
                  engine.hosted ? "bg-success" : "bg-ink-900",
                )}
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M12 3a4 4 0 0 1 4 4v1a4 4 0 0 1 0 8v1a4 4 0 0 1-8 0v-1a4 4 0 0 1 0-8V7a4 4 0 0 1 4-4z" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <p className="font-admin text-[15px] font-bold text-ink-900">
                  {engine.hosted ? engine.model : "Deterministic rules engine"}
                </p>
                <p className="text-[13px] text-ink-400">
                  {engine.hosted
                    ? "A hosted model is configured and answering live."
                    : "No vendor key set — every agent is running its built-in rules engine."}
                </p>
              </div>
            </div>

            <p className="mt-5 text-[13px] leading-relaxed text-ink-500">
              The concierge, recommender, lead qualifier and operations analyst are written against one provider
              interface. Setting <code className="rounded bg-ink-50 px-1 py-0.5 font-mono text-[12px]">ANTHROPIC_API_KEY</code>{" "}
              or <code className="rounded bg-ink-50 px-1 py-0.5 font-mono text-[12px]">OPENAI_API_KEY</code> switches all
              four to the hosted model with no other change. If a hosted call fails or returns something unusable, the
              request degrades to the rules engine rather than erroring.
            </p>

            <dl className="mt-5 grid grid-cols-3 gap-3">
              {[
                { label: "Agents", value: String(AI_AGENTS.length) },
                { label: "Tools", value: String(TOOL_SPECS.length) },
                { label: "Policy docs", value: String(KNOWLEDGE.length) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-canvas px-3 py-3 text-center">
                  <dt className="text-[12px] text-ink-400">{stat.label}</dt>
                  <dd className="mt-0.5 font-admin text-lg font-bold text-ink-900">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Evaluation"
            action={<code className="text-[12px] text-ink-400">npm run eval</code>}
          />
          <div className="p-5">
            <p className="text-[13px] leading-relaxed text-ink-500">
              {totalCases} golden cases assert behaviour, not wording, so the same suite grades the rules engine and any
              hosted model. It gates at {gate} here and asserts, among other things, that the concierge never quotes a
              price it did not obtain from a tool.
            </p>
            <ul className="mt-4 space-y-2.5">
              {[
                { suite: "Concierge", n: CONCIERGE_CASES.length, detail: "tool use, refusals, handoff, no unsourced pricing" },
                { suite: "Recommender", n: RECOMMENDER_CASES.length, detail: "hard constraints, budget discipline, reasoning present" },
                { suite: "Lead qualifier", n: QUALIFIER_CASES.length, detail: "tier accuracy, signal count, actionable next step" },
              ].map((row) => (
                <li key={row.suite} className="flex items-start gap-3 rounded-xl bg-canvas px-3.5 py-2.5">
                  <Badge tone="softInfo">{row.n}</Badge>
                  <span className="min-w-0">
                    <span className="block font-admin text-[13px] font-bold text-ink-900">{row.suite}</span>
                    <span className="block text-[12px] text-ink-400">{row.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader
            title="Concierge conversations"
            action={<span className="text-[12px] text-ink-400">{scoredLeads} leads scored</span>}
          />
          {conversations.length === 0 ? (
            <EmptyState
              title="No conversations yet"
              detail="Open the site and talk to the concierge — transcripts land here with the tools each answer used."
            />
          ) : (
            <ul className="divide-y divide-line">
              {conversations.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-50 text-ink-400">
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.4 9.4 0 0 1-2.9-.4L4 21l1.4-4.1A8.2 8.2 0 0 1 3.6 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 8.4 8.4Z" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[12px] text-ink-700">{c.sessionId}</span>
                    <span className="block text-[12px] text-ink-400">
                      {c.messageCount} messages · {c.avgLatency}ms avg
                      {c.lastMessageAt ? ` · ${formatDate(c.lastMessageAt)}` : ""}
                    </span>
                  </span>
                  {c.handoff && <Badge tone="softDanger">Handoff</Badge>}
                  <Badge tone="neutral">{c.engine}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Lead qualifier sandbox" />
          <LeadScorer />
        </Card>
      </div>

      <Card>
        <CardHeader title="Tools available to the concierge" />
        <ul className="divide-y divide-line">
          {TOOL_SPECS.map((tool) => (
            <li key={tool.name} className="px-5 py-3.5">
              <p className="font-mono text-[13px] font-semibold text-ink-900">{tool.name}</p>
              <p className="mt-0.5 text-[13px] text-ink-400">{tool.description}</p>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
