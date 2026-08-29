import { z } from "zod";

import { requireAdmin } from "@/lib/auth/server";
import { log } from "@/lib/observability/logger";
import { fail, ok, readJson, sanitizeText } from "@/lib/security/http";
import { renewDocument } from "@/server/repositories/fleet-ops";

export const dynamic = "force-dynamic";

const schema = z.object({
  months: z.coerce.number().int().min(1).max(60),
  reference: z.string().max(60).optional(),
});

/**
 * Records a renewed statutory document.
 *
 * The expiry board was read-only, so it listed problems with no way to record
 * the fix: a fitness certificate renewed at BRTA this morning still showed as
 * expiring, and kept reappearing in the daily digest until somebody edited the
 * database by hand. Nothing public reads these dates, so there is nothing to
 * revalidate — this is an internal record.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireAdmin({ role: "admin" });
  if (forbidden) return forbidden;

  const { id } = await params;
  const body = await readJson(req, schema, 4_000);
  if (!body.ok) return body.response;

  const renewed = await renewDocument(
    id,
    body.data.months,
    body.data.reference ? sanitizeText(body.data.reference, 60) : undefined,
  );
  if (!renewed) return fail(404, "Document not found.");

  log.info("document.renewed", { id, kind: renewed.kind, expiresAt: renewed.expiresAt });
  return ok({ document: renewed });
}
