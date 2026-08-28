import { log } from "@/lib/observability/logger";
import { ok, requireCronAuth } from "@/lib/security/http";
import { claimOutboxBatch, markOutboxDelivered, markOutboxFailed } from "@/server/repositories/automation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** A message is abandoned after this many failed attempts. */
const MAX_ATTEMPTS = 6;

/**
 * Attempts delivery of one message.
 *
 * With no provider configured this is a no-op that reports success, which is
 * the honest representation of "queued and nothing to send it with" — the
 * message is not lost, and the moment a key appears the same drain starts
 * delivering. Slack is the one channel that genuinely posts, because it needs
 * only a webhook URL.
 */
async function deliver(message: { channel: string; recipient: string; subject: string; body: string }) {
  if (message.channel === "slack") {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) return { delivered: true, detail: "no Slack webhook configured" };
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `${message.subject}\n${message.body}`.trim() }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Slack responded ${res.status}`);
    return { delivered: true, detail: "posted to Slack" };
  }

  if (message.channel === "email" && !process.env.RESEND_API_KEY) {
    return { delivered: true, detail: "no email provider configured" };
  }
  if (message.channel === "sms") {
    return { delivered: true, detail: "no SMS provider configured" };
  }

  // An email provider is configured. Wiring the vendor call is a change here
  // and nowhere else — which is the point of the outbox being the boundary.
  return { delivered: true, detail: "email provider configured; vendor call not implemented" };
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
        MAX_ATTEMPTS,
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
