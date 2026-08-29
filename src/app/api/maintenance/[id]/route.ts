import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/server";
import { log } from "@/lib/observability/logger";
import { fail, ok, readJson } from "@/lib/security/http";
import { setMaintenanceStatus } from "@/server/repositories/fleet-ops";

export const dynamic = "force-dynamic";

const schema = z.object({ status: z.enum(["open", "in-progress", "done"]) });

/**
 * Moves a maintenance job, and the car's availability with it.
 *
 * Marking a car off road had no path to `unitsAvailable`, so a car on a garage
 * ramp stayed bookable: the operations board said "off road" while the fleet
 * page still offered it, and a customer could book a car that was in pieces.
 * The stock change and the status change happen together, and the public pages
 * are revalidated so the fleet reflects it now rather than in five minutes.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireAdmin({ role: "admin" });
  if (forbidden) return forbidden;

  const { id } = await params;
  const body = await readJson(req, schema, 4_000);
  if (!body.ok) return body.response;

  const result = await setMaintenanceStatus(id, body.data.status);
  if (!result) return fail(404, "Maintenance job not found.");

  if (result.stockMoved) {
    revalidatePath("/");
    revalidatePath("/cars");
  }

  log.info("maintenance.status", { id, status: result.status, stockMoved: result.stockMoved });
  return ok(result);
}
