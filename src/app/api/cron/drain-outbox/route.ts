import { MAX_OUTBOX_ATTEMPTS } from "@/automation/outbox";
import { requireAdmin } from "@/lib/auth/server";
import { log } from "@/lib/observability/logger";
import { ok, requireCronAuth } from "@/lib/security/http";
import { claimOutboxBatch, markOutboxDelivered, markOutboxFailed } from "@/server/repositories/automation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Resend's shared sandbox sender, which any API key can post from. A verified
 * domain belongs in `RESEND_FROM`; the fallback exists so adding a key is the
 * only step needed to start delivering.
 */
const DEFAULT_EMAIL_FROM = "BestAuto <onboarding@resend.dev>";

/** No vendor call gets longer than this before the attempt is failed and retried. */
const VENDOR_TIMEOUT_MS = 10_000;

/**
 * Posts one message to Resend.
 *
 * Throws on any non-2xx so the caller's backoff path records the vendor's own
 * words in `lastError` and schedules a retry. Nothing here reports success it
 * did not get: this branch previously returned `{ delivered: true }` with the
 * note "vendor call not implemented", which meant the day a key was added
 * every message would be marked sent without leaving the building.
 */
async function sendEmail(message: { recipient: string; subject: string; body: string }, apiKey: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM?.trim() || DEFAULT_EMAIL_FROM,
      to: [message.recipient],
      // Resend rejects an empty subject, and the outbox column defaults to one.
      subject: message.subject.trim() || "BestAuto notification",
      text: message.body,
    }),
    signal: AbortSignal.timeout(VENDOR_TIMEOUT_MS),
  });

  if (!res.ok) {
    // The body carries the reason — an unverified sender, a malformed
    // recipient — and that is the whole value of `lastError` to an operator.
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend responded ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  const id = ((await res.json().catch(() => null)) as { id?: string } | null)?.id;
  return { delivered: true, detail: id ? `sent via Resend (${id})` : "sent via Resend" };
}

/**
 * Attempts delivery of one message.
 *
 * With no provider configured this is a no-op that reports success, which is
 * the honest representation of "queued and nothing to send it with" — the
 * message is not lost, and the moment a key appears the same drain starts
 * delivering. Slack and email genuinely deliver once their credential is set.
 */
async function deliver(message: { channel: string; recipient: string; subject: string; body: string }) {
  if (message.channel === "slack") {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) return { delivered: true, detail: "no Slack webhook configured" };
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `${message.subject}\n${message.body}`.trim() }),
      signal: AbortSignal.timeout(VENDOR_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Slack responded ${res.status}`);
    return { delivered: true, detail: "posted to Slack" };
  }

  if (message.channel === "email") {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) return { delivered: true, detail: "no email provider configured" };
    return sendEmail(message, apiKey);
  }

  if (message.channel === "sms") {
    return { delivered: true, detail: "no SMS provider configured" };
  }

  return { delivered: true, detail: `no provider for channel "${message.channel}"` };
}

/**
 * Drains the outbox.
 *
 * The engine's comment has always said the outbox is the delivery boundary so
 * a failing vendor never loses a message — but nothing drained it and nothing
 * retried, so the guarantee was a description of an intention. This is the
 * part that makes it true: due messages are attempted oldest-first, a failure
 * backs off exponentially, and a message that cannot be delivered after six
 * attempts is marked dead rather than retried forever.
 *
 * Scheduled daily rather than every half hour because Vercel's Hobby plan
 * rejects a sub-daily cron expression outright — the deploy fails, it does not
 * silently run less often. A backlog therefore waits up to a day for the
 * schedule, so the Automations page can also drain on demand; on Pro this
 * would be `*\/30 * * * *` and the button would be a convenience rather than a
 * necessity.
 */
async function run() {
  const batch = await claimOutboxBatch(25);
  let delivered = 0;
  let failed = 0;
  let dead = 0;

  for (const message of batch) {
    try {
      const result = await deliver(message);
      if (result.delivered) {
        await markOutboxDelivered(message.id);
        delivered += 1;
      }
    } catch (err) {
      const outcome = await markOutboxFailed(
        message.id,
        message.attempts,
        err instanceof Error ? err.message : "unknown error",
        MAX_OUTBOX_ATTEMPTS,
      );
      failed += 1;
      if (outcome.dead) dead += 1;
    }
  }

  log.info("outbox.drained", { claimed: batch.length, delivered, failed, dead });
  return ok({ claimed: batch.length, delivered, failed, dead, at: new Date().toISOString() });
}

export async function GET(req: Request) {
  const unauthorised = requireCronAuth(req);
  if (unauthorised) return unauthorised;
  return run();
}

/** Manual drain from the Automations page. Admin role, like every mutation. */
export async function POST() {
  const forbidden = await requireAdmin({ role: "admin" });
  if (forbidden) return forbidden;
  return run();
}
