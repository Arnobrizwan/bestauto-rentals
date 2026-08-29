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
 * A missing credential is a failure, not a success.
 *
 * Every channel used to return `{ delivered: true }` when it had nothing to
 * send with, so the drain flipped the row to `sent` and the operations screen
 * said the customer had been told. Nobody had been told: real booking
 * confirmations sat marked as delivered having never left the building, and
 * SMS reported delivery for a vendor that does not exist anywhere in this
 * codebase. A silent false "sent" is worse than a visible failure, because it
 * removes the only signal that anything is wrong.
 *
 * Now an unconfigured channel throws. The message keeps its place in the
 * queue, backs off, and after six attempts is marked `dead` with the reason in
 * `lastError` — so the Automations page shows the truth, and adding the key
 * makes the same drain deliver it.
 */
async function deliver(message: { channel: string; recipient: string; subject: string; body: string }) {
  if (message.channel === "slack") {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) throw new Error("No Slack webhook configured — set SLACK_WEBHOOK_URL.");
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
    if (!apiKey) throw new Error("No email provider configured — set RESEND_API_KEY.");
    return sendEmail(message, apiKey);
  }

  // No SMS vendor exists anywhere in this codebase. Reporting delivery for a
  // channel that has never sent anything is the same lie as above, louder.
  if (message.channel === "sms") {
    throw new Error("No SMS provider configured — nothing can send this.");
  }

  throw new Error(`No provider for channel "${message.channel}".`);
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
