"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge, type BadgeTone } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

export type LeadView = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  intent: string;
  budgetPerDay: number | null;
  timeframe: string;
  score: number;
  tier: string;
  status: string;
  aiSummary: string;
  aiNextAction: string;
  aiEngine: string;
  aiSignals: { label: string; impact: number; detail: string }[];
  source: string;
  createdAt: string;
};

const TIER_TONES: Record<string, BadgeTone> = { hot: "danger", warm: "warning", cold: "neutral" };
const STATUSES = ["new", "contacted", "qualified", "converted", "lost"];

export function LeadRow({ lead }: { lead: LeadView }) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState(lead.status);
  const [saving, startTransition] = useTransition();
  const router = useRouter();

  async function changeStatus(next: string) {
    const previous = status;
    setStatus(next);
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: lead.id, status: next }),
      });
      if (!res.ok) throw new Error("failed");
      startTransition(() => router.refresh());
    } catch {
      setStatus(previous);
    }
  }

  return (
    <>
      <tr className="transition-colors hover:bg-canvas">
        <td className="px-5 py-3.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex items-center gap-2.5 text-left"
          >
            <svg
              viewBox="0 0 20 20"
              className={cn("size-4 shrink-0 text-ink-300 transition-transform", expanded && "rotate-90")}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m7.5 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="min-w-0">
              <span className="block truncate font-admin text-[14px] font-bold text-ink-900">{lead.name}</span>
              <span className="block truncate text-[12px] text-ink-400">{lead.email}</span>
            </span>
          </button>
        </td>
        <td className="px-5 py-3.5">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-ink-100">
              <span
                className={cn(
                  "block h-full rounded-full",
                  lead.score >= 70 ? "bg-danger" : lead.score >= 40 ? "bg-brand-400" : "bg-ink-300",
                )}
                style={{ width: `${lead.score}%` }}
              />
            </span>
            <span className="font-admin text-[14px] font-bold text-ink-900">{lead.score}</span>
          </span>
        </td>
        <td className="px-5 py-3.5">
          <Badge tone={TIER_TONES[lead.tier] ?? "neutral"} dot>
            {lead.tier}
          </Badge>
        </td>
        <td className="px-5 py-3.5 text-[13px] text-ink-500 capitalize">{lead.intent}</td>
        <td className="px-5 py-3.5 text-[13px] text-ink-500 capitalize">{lead.source.replace(/-/g, " ")}</td>
        <td className="px-5 py-3.5 text-[13px] text-ink-500">{formatDate(lead.createdAt)}</td>
        <td className="px-5 py-3.5 text-right">
          <select
            value={status}
            disabled={saving}
            onChange={(e) => void changeStatus(e.target.value)}
            aria-label={`Status for ${lead.name}`}
            className="h-9 rounded-lg border border-line bg-white px-2.5 font-admin text-[13px] font-semibold text-ink-900 capitalize outline-none focus:border-brand-300 disabled:opacity-50"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-canvas">
          <td colSpan={7} className="px-5 py-5">
            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <p className="font-admin text-[13px] font-bold text-ink-900">What they said</p>
                <blockquote className="mt-2 rounded-xl border border-line bg-white px-4 py-3 text-[13px] leading-relaxed text-ink-500">
                  {lead.message}
                </blockquote>
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-ink-400">
                  {lead.phone && (
                    <div className="flex gap-1.5">
                      <dt>Phone</dt>
                      <dd className="font-semibold text-ink-700">{lead.phone}</dd>
                    </div>
                  )}
                  {lead.company && (
                    <div className="flex gap-1.5">
                      <dt>Company</dt>
                      <dd className="font-semibold text-ink-700">{lead.company}</dd>
                    </div>
                  )}
                  {lead.budgetPerDay ? (
                    <div className="flex gap-1.5">
                      <dt>Budget</dt>
                      <dd className="font-semibold text-ink-700">£{lead.budgetPerDay}/day</dd>
                    </div>
                  ) : null}
                  <div className="flex gap-1.5">
                    <dt>Timeframe</dt>
                    <dd className="font-semibold text-ink-700">{lead.timeframe.replace(/_/g, " ")}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <p className="flex items-center gap-2 font-admin text-[13px] font-bold text-ink-900">
                  Why it scored {lead.score}
                  <span className="rounded bg-ink-900 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                    {lead.aiEngine}
                  </span>
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{lead.aiSummary}</p>
                <ul className="mt-3 space-y-1.5">
                  {lead.aiSignals.slice(0, 5).map((signal, i) => (
                    <li key={`${signal.label}-${i}`} className="flex items-start gap-2 text-[12px]">
                      <span
                        className={cn(
                          "mt-px w-11 shrink-0 rounded px-1 py-0.5 text-center font-bold",
                          signal.impact >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
                        )}
                      >
                        {signal.impact >= 0 ? "+" : ""}
                        {signal.impact}
                      </span>
                      <span className="min-w-0">
                        <span className="font-semibold text-ink-700">{signal.label}</span>
                        <span className="text-ink-400"> — {signal.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[13px] font-semibold text-brand-700">
                  Next: {lead.aiNextAction}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
