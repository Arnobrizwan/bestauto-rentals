import type { Metadata } from "next";

import { AutomationPanel, type AutomationPayload } from "@/components/admin/automation-panel";
import { PageHeader } from "@/components/admin/table";
import { Card, CardHeader } from "@/components/ui";
import { automationStats, listEvents, listOutbox, listRules, listRuns } from "@/server/repositories/automation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Automations" };

export default async function AutomationsPage() {
  const [rules, runs, events, outbox, stats] = await Promise.all([
    listRules(),
    listRuns(20),
    listEvents(20),
    listOutbox(20),
    automationStats(),
  ]);

  const initial: AutomationPayload = {
    rules: rules.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      trigger: r.trigger,
      conditions: r.conditions,
      actions: r.actions,
      enabled: r.enabled,
      runCount: r.runCount,
      lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
    })),
    runs: runs.map((r) => ({
      id: r.id,
      ruleName: r.ruleName,
      trigger: r.trigger,
      status: r.status,
      steps: r.steps,
      durationMs: r.durationMs,
      createdAt: r.createdAt.toISOString(),
    })),
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      source: e.source,
      createdAt: e.createdAt.toISOString(),
    })),
    outbox: outbox.map((o) => ({
      id: o.id,
      channel: o.channel,
      recipient: o.recipient,
      subject: o.subject,
      body: o.body,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
    stats,
  };

  return (
    <>
      <PageHeader
        title="Automations"
        subtitle="Event-driven workflows. Every trigger is logged, every action is auditable, and rules are switchable without a deploy."
      />

      <AutomationPanel initial={initial} />

      <Card className="mt-5">
        <CardHeader title="Integration surface" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Inbound webhooks",
              detail: "POST /api/webhooks/{stripe|partner|crm|fleet-telematics}. HMAC-SHA256 verified when a per-source secret is set; the payload becomes an event like any other.",
            },
            {
              title: "Scheduled jobs",
              detail: "GET /api/cron/daily-digest runs at 07:00 daily via Vercel Cron, protected by CRON_SECRET. The same handler is callable from this page for demos.",
            },
            {
              title: "Outbound delivery",
              detail: "Email, SMS and Slack actions write to an outbox first. Set SLACK_WEBHOOK_URL or RESEND_API_KEY and delivery becomes real without touching a rule.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl bg-canvas px-4 py-3.5">
              <p className="font-admin text-[13px] font-bold text-ink-900">{item.title}</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-400">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
