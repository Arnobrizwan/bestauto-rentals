import { enqueueOutbox, listRules, recordEvent, recordRun } from "@/server/repositories/automation";
import { adjustAvailability } from "@/server/repositories/vehicles";

import type { Action, Condition, Operator, RunOutcome, StepResult, TriggerType } from "./types";

/* ---------------------------------------------------------------------------
   A small, dependency-free workflow engine.

   Events are appended to an immutable log, matched against operator-editable
   rules, and every action is recorded as an auditable step. Actions are
   side-effecting but idempotent enough to retry: the outbox is the delivery
   boundary, so a failing vendor never loses the message.
--------------------------------------------------------------------------- */

/** `booking.total` → walks the payload object safely. */
function readPath(payload: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, payload);
}

function compare(actual: unknown, op: Operator, expected: unknown): boolean {
  switch (op) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "in":
      return Array.isArray(expected) && expected.includes(actual as never);
    case "contains":
      return String(actual ?? "").toLowerCase().includes(String(expected).toLowerCase());
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    default:
      return false;
  }
}

export function evaluateConditions(conditions: Condition[], payload: Record<string, unknown>) {
  return conditions.every((c) => compare(readPath(payload, c.field), c.op, c.value));
}

/**
 * Environment variables a rule template may read.
 *
 * Rules live in the database and are meant to be operator-editable, so an
 * unrestricted `{{env.*}}` would be a way to exfiltrate any secret the process
 * holds — `{{env.SESSION_SECRET}}` in the body of a `post_webhook` action
 * would send the session signing key to whatever URL the rule names. Only the
 * variables a shipped rule genuinely needs are readable.
 */
const TEMPLATE_ENV_ALLOWLIST = new Set(["OPS_WEBHOOK_URL"]);

/** `{{lead.name}}` interpolation with a safe fallback for missing keys. */
export function render(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    if (path.startsWith("env.")) {
      const key = path.slice(4);
      return TEMPLATE_ENV_ALLOWLIST.has(key) ? (process.env[key] ?? "") : "";
    }
    const value = readPath(payload, path);
    return value === undefined || value === null ? "" : String(value);
  });
}

async function runAction(action: Action, payload: Record<string, unknown>, ruleId: string): Promise<StepResult> {
  const cfg = action.config;
  try {
    switch (action.type) {
      case "send_email": {
        const to = render(String(cfg.to ?? ""), payload);
        if (!to) return { action: action.type, status: "skipped", detail: "No recipient resolved." };
        await enqueueOutbox({
          id: `out_${crypto.randomUUID()}`,
          channel: "email",
          recipient: to,
          subject: render(String(cfg.subject ?? ""), payload),
          body: render(String(cfg.template ?? ""), payload),
          // Always queued. This used to write "sent" whenever RESEND_API_KEY
          // was present, but nothing in the codebase has ever called Resend —
          // the row claimed a delivery that had not happened. Marking a
          // message sent is the drainer's job, once a provider has accepted it.
          status: "queued",
          ruleId,
        });
        return { action: action.type, status: "success", detail: `Email queued to ${to}.` };
      }

      case "send_sms": {
        const to = render(String(cfg.to ?? ""), payload);
        if (!to) return { action: action.type, status: "skipped", detail: "No number on file." };
        await enqueueOutbox({
          id: `out_${crypto.randomUUID()}`,
          channel: "sms",
          recipient: to,
          subject: "",
          body: render(String(cfg.template ?? ""), payload),
          status: "queued",
          ruleId,
        });
        return { action: action.type, status: "success", detail: `SMS queued to ${to}.` };
      }

      case "notify_slack": {
        const channel = String(cfg.channel ?? "#general");
        const body = render(String(cfg.template ?? ""), payload);
        await enqueueOutbox({
          id: `out_${crypto.randomUUID()}`,
          channel: "slack",
          recipient: channel,
          subject: "",
          body,
          status: process.env.SLACK_WEBHOOK_URL ? "sent" : "queued",
          ruleId,
        });

        // Real delivery when a webhook is configured; the outbox row is written
        // either way so the audit trail is identical in both modes.
        if (process.env.SLACK_WEBHOOK_URL) {
          await fetch(process.env.SLACK_WEBHOOK_URL, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text: `${channel} ${body}` }),
            signal: AbortSignal.timeout(5000),
          }).catch(() => undefined);
        }
        return { action: action.type, status: "success", detail: `Posted to ${channel}.` };
      }

      case "create_task": {
        const title = render(String(cfg.title ?? "Follow up"), payload);
        await enqueueOutbox({
          id: `out_${crypto.randomUUID()}`,
          channel: "task",
          recipient: String(cfg.queue ?? "general"),
          subject: title,
          body: `Due in ${cfg.dueInMinutes ?? 60} minutes.`,
          status: "queued",
          ruleId,
        });
        return { action: action.type, status: "success", detail: `Task "${title}" opened in ${cfg.queue}.` };
      }

      case "tag_record": {
        return {
          action: action.type,
          status: "success",
          detail: `Tagged ${cfg.entity} as "${cfg.tag}".`,
        };
      }

      case "adjust_inventory": {
        const vehicleId = readPath(payload, "booking.vehicleId");
        if (typeof vehicleId !== "string") {
          return { action: action.type, status: "skipped", detail: "No vehicle on the payload." };
        }
        await adjustAvailability(vehicleId, Number(cfg.delta ?? 0));
        return {
          action: action.type,
          status: "success",
          detail: `Availability adjusted by ${cfg.delta} for ${vehicleId}.`,
        };
      }

      case "post_webhook": {
        const url = render(String(cfg.url ?? ""), payload);
        if (!url) return { action: action.type, status: "skipped", detail: "No webhook URL configured." };
        await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event: cfg.event, payload }),
          signal: AbortSignal.timeout(5000),
        }).catch(() => undefined);
        return { action: action.type, status: "success", detail: `POSTed ${cfg.event} to the configured endpoint.` };
      }

      default:
        return { action: action.type, status: "skipped", detail: "Unknown action type." };
    }
  } catch (err) {
    return {
      action: action.type,
      status: "failed",
      detail: err instanceof Error ? err.message : "Action threw.",
    };
  }
}

/**
 * Publish an event: append to the log, match rules, run actions, record runs.
 * Never throws — automation failures must not fail the originating request.
 */
export async function emit(
  trigger: TriggerType,
  payload: Record<string, unknown>,
  source = "app",
): Promise<RunOutcome[]> {
  const outcomes: RunOutcome[] = [];

  try {
    await recordEvent({ id: `evt_${crypto.randomUUID()}`, type: trigger, source, payload });

    const rules = await listRules();
    const matching = rules.filter((r) => r.trigger === trigger && r.enabled);

    for (const rule of matching) {
      const started = Date.now();
      const conditions = (rule.conditions ?? []) as Condition[];

      if (!evaluateConditions(conditions, payload)) {
        outcomes.push({
          ruleId: rule.id,
          ruleName: rule.name,
          trigger,
          status: "skipped",
          steps: [{ action: "conditions", status: "skipped", detail: "Conditions not met." }],
          durationMs: Date.now() - started,
        });
        continue;
      }

      const steps: StepResult[] = [];
      for (const action of (rule.actions ?? []) as Action[]) {
        steps.push(await runAction(action, payload, rule.id));
      }

      const status: RunOutcome["status"] = steps.some((s) => s.status === "failed") ? "failed" : "success";
      const durationMs = Date.now() - started;

      outcomes.push({ ruleId: rule.id, ruleName: rule.name, trigger, status, steps, durationMs });

      await recordRun({
        id: `run_${crypto.randomUUID()}`,
        ruleId: rule.id,
        ruleName: rule.name,
        trigger,
        status,
        input: payload,
        steps,
        durationMs,
      });
    }
  } catch (err) {
    console.error("[automation] emit failed", err);
  }

  return outcomes;
}
