import { emit } from "@/automation/engine";
import { log } from "@/lib/observability/logger";
import { fail, guard, ok } from "@/lib/security/http";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["stripe", "partner", "crm", "fleet-telematics"]);

/**
 * Inbound webhook receiver.
 *
 * Signature verification is intentionally explicit rather than implied: when a
 * shared secret is configured for a source, an unsigned request is rejected.
 * Accepted payloads are appended to the event log and fan out through the
 * automation engine like any internally-produced event.
 */
async function verify(source: string, req: Request, raw: string) {
  const secret = process.env[`WEBHOOK_SECRET_${source.toUpperCase().replace(/-/g, "_")}`];

  // No secret means nothing can be verified. Accepting the request anyway
  // would let anyone POST to /api/webhooks/stripe and fan their payload
  // straight into the automation engine, so production refuses; a local or
  // preview environment still accepts unsigned calls so the flow can be
  // demonstrated without provisioning secrets.
  if (!secret) return process.env.NODE_ENV !== "production";

  const provided = req.headers.get("x-signature") ?? "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time-ish comparison: equal length and a full pass over the string.
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request, { params }: { params: Promise<{ source: string }> }) {
  const blocked = await guard(req, "webhooks", 60);
  if (blocked) return blocked;

  const { source } = await params;
  if (!ALLOWED.has(source)) return fail(404, "Unknown webhook source.");

  const raw = await req.text();
  if (raw.length > 64_000) return fail(413, "Payload too large.");

  if (!(await verify(source, req, raw))) {
    log.warn("webhook.signature_invalid", { source });
    return fail(401, "Invalid signature.");
  }

  let payload: Record<string, unknown>;
  try {
    payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return fail(400, "Body must be valid JSON.");
  }

  const runs = await emit("webhook.received", { source, ...payload }, source);
  log.info("webhook.received", { source, rules: runs.length });

  return ok({ received: true, source, rulesTriggered: runs.map((r) => r.ruleName) });
}
