import { z } from "zod";

import { guard, ok, readJson } from "@/lib/security/http";
import { findRedeemableCoupon } from "@/server/repositories/fleet-ops";
import { priceCoupon } from "@/server/services/bookings";

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().min(1).max(40),
  subtotal: z.number().min(0).max(10_000_000),
  days: z.number().int().min(1).max(90),
});

/**
 * Previews a discount code.
 *
 * Preview only — it deliberately does not reserve or redeem anything. The
 * booking endpoint looks the code up again and re-prices it against its own
 * quote, so a customer who edits the response here changes nothing. It returns
 * the same refusal wording the booking would, so the two never disagree.
 */
export async function POST(req: Request) {
  const blocked = await guard(req, "coupon-validate", 30);
  if (blocked) return blocked;

  const body = await readJson(req, schema, 2_000);
  if (!body.ok) return body.response;

  const coupon = await findRedeemableCoupon(body.data.code);
  if (!coupon) return ok({ valid: false, reason: "That code was not recognised." });

  const outcome = priceCoupon(coupon, body.data.subtotal, body.data.days);
  return outcome.ok
    ? ok({ valid: true, code: outcome.code, discount: outcome.discount })
    : ok({ valid: false, reason: outcome.reason });
}
