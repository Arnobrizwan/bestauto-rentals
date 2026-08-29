import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/server";
import { log } from "@/lib/observability/logger";
import { fail, ok, readJson, sanitizeText } from "@/lib/security/http";
import { deleteCoupon, updateCoupon } from "@/server/repositories/fleet-ops";

export const dynamic = "force-dynamic";

/**
 * Every field optional, and `code` is not among them.
 *
 * Bookings record the `couponCode` they were priced with, so renaming a live
 * code would orphan the history of every booking that used it. Stop the old
 * one and create a new one instead.
 */
const patchSchema = z
  .object({
    description: z.string().min(3).max(160),
    value: z.coerce.number().positive().max(1_000_000),
    minDays: z.coerce.number().int().min(1).max(90),
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    usageLimit: z.coerce.number().int().min(0).max(1_000_000),
    active: z.boolean(),
  })
  .partial();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireAdmin({ role: "admin" });
  if (forbidden) return forbidden;

  const { id } = await params;
  const body = await readJson(req, patchSchema, 16_000);
  if (!body.ok) return body.response;
  if (!Object.keys(body.data).length) return fail(400, "Nothing to update.");

  const { value, description, ...rest } = body.data;
  const updated = await updateCoupon(id, {
    ...rest,
    ...(value !== undefined ? { value: String(value) } : {}),
    ...(description !== undefined ? { description: sanitizeText(description, 160) } : {}),
  });
  if (!updated) return fail(404, "Coupon not found.");

  revalidatePath("/");
  log.info("coupon.updated", { code: updated.code, fields: Object.keys(body.data) });
  return ok({ coupon: { ...updated, value: Number(updated.value) } });
}

/**
 * Removes a code, or stops it if it has history.
 *
 * A code with redemptions behind it is deactivated rather than deleted:
 * bookings record the code they were priced with, and deleting the row would
 * leave those totals unexplainable at audit. Stopping it is the actual need
 * when a code leaks, and it takes effect on the next request.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireAdmin({ role: "admin" });
  if (forbidden) return forbidden;

  const { id } = await params;
  const result = await deleteCoupon(id);
  if (!result.ok) return fail(404, "Coupon not found.");

  revalidatePath("/");
  log.info("coupon.removed", { code: result.code, deactivated: result.deactivated });
  return ok({
    code: result.code,
    deactivated: result.deactivated,
    detail: result.deactivated
      ? `${result.code} has ${result.used} redemption${result.used === 1 ? "" : "s"} on record, so it was stopped rather than deleted — the bookings priced with it keep their history.`
      : `${result.code} was never used, so it has been deleted.`,
  });
}
