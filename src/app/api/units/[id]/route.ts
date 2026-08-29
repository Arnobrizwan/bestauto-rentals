import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/server";
import { log } from "@/lib/observability/logger";
import { fail, ok, readJson } from "@/lib/security/http";
import { BRANCHES, UNIT_STATUSES } from "@/lib/taxonomy";
import { updateUnit } from "@/server/repositories/fleet-ops";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    // The shared branch vocabulary, not a copy of it: a free-text branch here
    // would be a branch the search panel and the concierge cannot offer.
    branch: z.enum(BRANCHES),
    status: z.enum(UNIT_STATUSES),
  })
  .partial();

/**
 * Repositions a unit, or takes it off the road.
 *
 * The units board listed every registered car and could change nothing about
 * one — a car moved from Gulshan to the airport branch, or pulled off the road
 * after a knock, could only be recorded by editing the database directly.
 *
 * Status moves stock, because `vehicles.unitsAvailable` is what the public
 * fleet offers: without that, a car marked off road here stays bookable on the
 * customer's side, which is the bug the maintenance board already had once.
 * The public pages are revalidated when stock actually moves.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireAdmin({ role: "admin" });
  if (forbidden) return forbidden;

  const { id } = await params;
  const body = await readJson(req, schema, 4_000);
  if (!body.ok) return body.response;
  if (!Object.keys(body.data).length) return fail(400, "Nothing to update.");

  const result = await updateUnit(id, body.data);

  if (!result.ok && result.reason === "not-found") return fail(404, "Unit not found.");
  if (!result.ok) {
    return fail(
      409,
      `${result.registration} has ${result.openJobs} open maintenance job${result.openJobs === 1 ? "" : "s"}. Close the job on the maintenance board — that is what puts the car back into stock.`,
    );
  }

  if (result.stockMoved) {
    revalidatePath("/");
    revalidatePath("/cars");
    revalidatePath(`/cars/${result.slug}`);
  }

  log.info("unit.updated", { id, fields: Object.keys(body.data), stockMoved: result.stockMoved });
  return ok({ unit: result.unit, stockMoved: result.stockMoved });
}
