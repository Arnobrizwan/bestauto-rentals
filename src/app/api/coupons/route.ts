import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/server";
import { log } from "@/lib/observability/logger";
import { ok, readJson, sanitizeText } from "@/lib/security/http";
import { createCoupon, listCoupons } from "@/server/repositories/fleet-ops";

export const dynamic = "force-dynamic";

/** Admin only, both ways: this is the operator's view, with usage counts. */
export async function GET() {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  return ok({ coupons: await listCoupons() });
}

const createSchema = z
  .object({
    // Uppercased on the way in so "eidsafar" and "EIDSAFAR" cannot both exist
    // — the redemption lookup is case-insensitive, so two rows would race.
    code: z
      .string()
      .min(3)
      .max(24)
      .regex(/^[A-Za-z0-9]+$/, "Letters and numbers only — the code is typed by hand at checkout."),
    description: z.string().min(3).max(160),
    kind: z.enum(["percent", "flat"]),
    value: z.coerce.number().positive().max(1_000_000),
    minDays: z.coerce.number().int().min(1).max(90),
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    usageLimit: z.coerce.number().int().min(0).max(1_000_000),
    active: z.coerce.boolean().optional(),
  })
  .refine((c) => c.endsAt >= c.startsAt, {
    message: "The end date cannot be before the start date.",
    path: ["endsAt"],
  })
  .refine((c) => c.kind !== "percent" || c.value <= 100, {
    message: "A percentage discount cannot exceed 100.",
    path: ["value"],
  });

/**
 * Creates a discount code.
 *
 * Coupons were seed-only: eight were live, the board showed 421 redemptions,
 * and none of them could be added, changed or stopped without a redeploy — a
 * code leaked to a forum had no off switch. The home page lists live offers,
 * so it is revalidated here.
 */
export async function POST(req: Request) {
  const forbidden = await requireAdmin({ role: "admin" });
  if (forbidden) return forbidden;

  const body = await readJson(req, createSchema, 16_000);
  if (!body.ok) return body.response;

  const created = await createCoupon({
    id: `cpn_${nanoid(10)}`,
    code: body.data.code.trim().toUpperCase(),
    description: sanitizeText(body.data.description, 160),
    kind: body.data.kind,
    value: String(body.data.value),
    minDays: body.data.minDays,
    startsAt: body.data.startsAt,
    endsAt: body.data.endsAt,
    usageLimit: body.data.usageLimit,
    active: body.data.active ?? true,
  });

  revalidatePath("/");
  log.info("coupon.created", { code: created.code });
  return ok({ coupon: { ...created, value: Number(created.value) } }, { status: 201 });
}
