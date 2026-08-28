"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge, Card, CardHeader, EmptyState, Skeleton, type BadgeTone } from "@/components/ui";
import { cn, formatDate, timeAgo } from "@/lib/utils";

type Rule = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  conditions: { field: string; op: string; value: unknown }[];
  actions: { type: string; config: Record<string, unknown> }[];
  enabled: boolean;
  runCount: number;
  lastRunAt: string | null;
};

type Run = {
  id: string;
  ruleName: string;
  trigger: string;
  status: string;
  steps: { action: string; status: string; detail: string }[];
  durationMs: number;
  createdAt: string;
};

type EventRow = { id: string; type: string; source: string; createdAt: string };
type OutboxRow = { id: string; channel: string; recipient: string; subject: string; body: string; status: string; createdAt: string };

type Payload = {
  rules: Rule[];
  runs: Run[];
  events: EventRow[];
  outbox: OutboxRow[];
  stats: { runs: number; succeeded: number; failed: number; avgMs: number; notifications: number };
};

const RUN_TONES: Record<string, BadgeTone> = { success: "softSuccess", skipped: "neutral", failed: "softDanger" };
const CHANNEL_TONES: Record<string, BadgeTone> = {
  email: "softInfo",
  slack: "softWarning",
  sms: "softSuccess",
  task: "neutral",
};

const TRIGGER_LABELS: Record<string, string> = {
  "lead.created": "Lead created",
  "booking.created": "Booking created",
  "booking.cancelled": "Booking cancelled",
  "conversation.handoff": "Concierge handoff",
  "schedule.daily": "Daily schedule",
  "webhook.received": "Webhook received",
};

export function AutomationPanel({ initial }: { initial: Payload }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/automations", { cache: "no-store" });
      if (res.ok) setData((await res.json()) as Payload);
    } finally {
      setLoading(false);
    }
  }, []);

  // Keep the run log reasonably live while the page is open.
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function toggle(rule: Rule) {
    setBusy(rule.id);
    const next = !rule.enabled;
    setData((d) => ({ ...d, rules: d.rules.map((r) => (r.id === rule.id ? { ...r, enabled: next } : r)) }));
    try {
      const res = await fetch(`/api/automations/${rule.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error();
      setMessage(`${rule.name} ${next ? "enabled" : "disabled"}.`);
    } catch {
      setData((d) => ({ ...d, rules: d.rules.map((r) => (r.id === rule.id ? { ...r, enabled: !next } : r)) }));
      setMessage("Could not update that rule.");
    } finally {
      setBusy(null);
    }
  }

  async function runDigest() {
    setBusy("digest");
    setMessage(null);
    try {
      const res = await fetch("/api/cron/daily-digest", { method: "POST" });
      const body = (await res.json()) as { triggered?: { rule: string; status: string }[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed");
      const fired = body.triggered?.filter((t) => t.status === "success").length ?? 0;
      setMessage(`Digest ran — ${fired} rule${fired === 1 ? "" : "s"} fired.`);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not run the digest.");
    } finally {
      setBusy(null);
    }
  }

  const successRate = data.stats.runs ? Math.round((data.stats.succeeded / data.stats.runs) * 100) : 0;

  return (
    <>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Rules", value: `${data.rules.filter((r) => r.enabled).length} / ${data.rules.length} enabled` },
          { label: "Runs recorded", value: String(data.stats.runs) },
          { label: "Success rate", value: `${successRate}%` },
          { label: "Notifications queued", value: String(data.stats.notifications) },
        ].map((stat) => (
          <Card key={stat.label} className="px-5 py-4">
            <p className="text-[13px] text-ink-400">{stat.label}</p>
            <p className="mt-1 font-admin text-xl font-bold text-ink-900">{stat.value}</p>
          </Card>
        ))}
      </div>

      {message && (
        <p className="mb-5 rounded-lg border border-line bg-white px-4 py-3 font-admin text-[13px] font-semibold text-ink-900">
          {message}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader
            title="Rules"
            action={
              <button
                type="button"
                onClick={() => void runDigest()}
                disabled={busy === "digest"}
                className="rounded-lg bg-ink-900 px-3 py-1.5 font-admin text-[12px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:opacity-50"
              >
                {busy === "digest" ? "Running…" : "Run daily digest now"}
              </button>
            }
          />
          <ul className="divide-y divide-line">
            {data.rules.map((rule) => (
              <li key={rule.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-admin text-[14px] font-bold text-ink-900">{rule.name}</p>
                      <Badge tone="neutral">{TRIGGER_LABELS[rule.trigger] ?? rule.trigger}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-400">{rule.description}</p>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {rule.conditions.map((c, i) => (
                        <span
                          key={`${c.field}-${i}`}
                          className="rounded bg-canvas px-2 py-1 font-mono text-[11px] text-ink-500"
                        >
                          {c.field} {c.op} {String(c.value)}
                        </span>
                      ))}
                      {rule.actions.map((a, i) => (
                        <span
                          key={`${a.type}-${i}`}
                          className="rounded bg-brand-50 px-2 py-1 font-mono text-[11px] text-brand-700"
                        >
                          {a.type}
                        </span>
                      ))}
                    </div>

                    {/*
                      The count decides the sentence, not the timestamp. Read
                      independently the two could disagree — a rule showing
                      "0 runs · last 2 hours ago" is nonsense, and a stale
                      lastRunAt with no surviving runs is enough to produce it.
                    */}
                    <p className="mt-2 text-[12px] text-ink-400">
                      {rule.runCount} run{rule.runCount === 1 ? "" : "s"}
                      {rule.runCount > 0 && rule.lastRunAt
                        ? ` · last ${timeAgo(rule.lastRunAt)} ago`
                        : " · never fired"}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={rule.enabled}
                    aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
                    disabled={busy === rule.id}
                    onClick={() => void toggle(rule)}
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
                      rule.enabled ? "bg-success" : "bg-ink-200",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
                        rule.enabled ? "left-[22px]" : "left-0.5",
                      )}
                    />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Recent runs"
              action={
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="text-[12px] font-semibold text-ink-400 hover:text-ink-900"
                >
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              }
            />
            {data.runs.length === 0 ? (
              <EmptyState
                title="Nothing has fired yet"
                detail="Make a booking on the site or run the daily digest to see the engine work."
              />
            ) : (
              <ul className="scroll-slim max-h-[420px] divide-y divide-line overflow-y-auto">
                {data.runs.map((run) => (
                  <li key={run.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-admin text-[13px] font-bold text-ink-900">{run.ruleName}</p>
                      <Badge tone={RUN_TONES[run.status] ?? "neutral"}>{run.status}</Badge>
                    </div>
                    <p className="mt-0.5 text-[12px] text-ink-400">
                      {TRIGGER_LABELS[run.trigger] ?? run.trigger} · {run.durationMs}ms · {timeAgo(run.createdAt)} ago
                    </p>
                    <ul className="mt-2 space-y-1">
                      {run.steps.map((step, i) => (
                        <li key={`${step.action}-${i}`} className="flex items-start gap-2 text-[12px]">
                          <span
                            className={cn(
                              "mt-1 size-1.5 shrink-0 rounded-full",
                              step.status === "success"
                                ? "bg-success"
                                : step.status === "failed"
                                  ? "bg-danger"
                                  : "bg-ink-300",
                            )}
                          />
                          <span className="min-w-0">
                            <span className="font-mono text-ink-600">{step.action}</span>
                            <span className="text-ink-400"> — {step.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Outbox" action={<span className="text-[12px] text-ink-400">{data.outbox.length} latest</span>} />
            {data.outbox.length === 0 ? (
              <EmptyState title="Nothing queued" detail="Actions that send email, SMS or Slack land here." />
            ) : (
              <ul className="scroll-slim max-h-[320px] divide-y divide-line overflow-y-auto">
                {data.outbox.map((row) => (
                  <li key={row.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={CHANNEL_TONES[row.channel] ?? "neutral"}>{row.channel}</Badge>
                      <span className="truncate text-[12px] text-ink-400">{row.recipient}</span>
                    </div>
                    <p className="mt-1.5 truncate text-[13px] font-semibold text-ink-900">
                      {row.subject || row.body.slice(0, 70)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-400">
                      {row.status} · {formatDate(row.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Event log" />
            {data.events.length === 0 ? (
              <EmptyState title="No events" detail="Every trigger is appended here before rules are matched." />
            ) : (
              <ul className="scroll-slim max-h-[280px] divide-y divide-line overflow-y-auto">
                {data.events.map((event) => (
                  <li key={event.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="font-mono text-[12px] text-ink-700">{event.type}</span>
                    <span className="text-[11px] text-ink-400">
                      {event.source} · {timeAgo(event.createdAt)} ago
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export function AutomationSkeleton() {
  return <Skeleton className="h-96" />;
}

export type { Payload as AutomationPayload };
