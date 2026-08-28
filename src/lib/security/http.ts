import { NextResponse } from "next/server";
import { z } from "zod";

import { log } from "@/lib/observability/logger";

import { clientKey, rateLimit } from "./rate-limit";

export type ApiErrorBody = { error: string; detail?: unknown };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
  });
}

export function fail(status: number, error: string, detail?: unknown) {
  return NextResponse.json<ApiErrorBody>({ error, detail }, { status, headers: { "cache-control": "no-store" } });
}

/** Rejects oversized bodies before parsing, then validates against a schema. */
export async function readJson<T extends z.ZodType>(
  req: Request,
  schema: T,
  maxBytes = 32_000,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > maxBytes) {
    return { ok: false, response: fail(413, "Request body too large.") };
  }

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return { ok: false, response: fail(413, "Request body too large.") };
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, response: fail(400, "Body must be valid JSON.") };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: fail(
        422,
        "Validation failed.",
        parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

export function guard(req: Request, scope: string, limit: number, windowMs = 60_000) {
  const result = rateLimit(clientKey(req, scope), limit, windowMs);
  if (!result.allowed) {
    log.warn("rate_limit.blocked", { scope });
    return fail(429, "Too many requests. Please slow down.");
  }
  return null;
}

/** Control characters are collapsed to spaces before any free text is stored. */
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

export function sanitizeText(input: string, maxLength = 2000) {
  return input.replace(CONTROL_CHARS, " ").replace(/\s{3,}/g, "  ").trim().slice(0, maxLength);
}

export function requireCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;

  // Same reasoning as the webhook receiver: an unset secret cannot authorise
  // anything, and the scheduled endpoint runs the digest and fires automation
  // rules. Production refuses rather than running for whoever asks; dev and
  // preview stay open so the job can be triggered by hand.
  if (!secret) {
    return process.env.NODE_ENV === "production"
      ? fail(503, "The scheduled endpoint is not configured. Set CRON_SECRET.")
      : null;
  }
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return null;
  return fail(401, "Unauthorised.");
}
