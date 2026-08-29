import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/server";
import { log } from "@/lib/observability/logger";
import { fail, ok, readJson, sanitizeText } from "@/lib/security/http";
import { ALLOWED_IMAGE_HOSTS, FUELS, SEGMENTS, TRANSMISSIONS, isAllowedImageUrl } from "@/lib/taxonomy";
import { deleteVehicle, getVehicleBySlug, updateVehicle } from "@/server/repositories/vehicles";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) return fail(404, "Vehicle not found.");
  return ok({ ...vehicle, pricePerDay: Number(vehicle.pricePerDay), costPerDay: undefined });
}

/**
 * Every field optional — this is a patch, not a replace.
 *
 * The same vocabulary and bounds the create endpoint enforces, so a vehicle
 * cannot be edited into a state it could never have been created in. `slug` is
 * deliberately absent: it is the public URL of a page that may already be
 * linked and indexed, and renaming it silently would break every link to it.
 */
const patchSchema = z
  .object({
    name: z.string().min(2).max(120),
    brand: z.string().min(2).max(60),
    model: z.string().min(1).max(60),
    year: z.coerce.number().int().min(1990).max(2100),
    segment: z.enum(SEGMENTS),
    bodyType: z.string().min(2).max(40),
    transmission: z.enum(TRANSMISSIONS),
    fuel: z.enum(FUELS),
    seats: z.coerce.number().int().min(2).max(15),
    doors: z.coerce.number().int().min(2).max(6),
    bags: z.coerce.number().int().min(0).max(12),
    pricePerDay: z.coerce.number().min(0).max(1_000_000),
    costPerDay: z.coerce.number().min(0).max(1_000_000),
    // Restricted to the hosts next/image and the CSP can load. Any other
    // https URL passed validation and then rendered as a broken image on the
    // public site, with no way to correct it before the edit endpoint existed.
    imageUrl: z
      .string()
      .url()
      .max(400)
      .refine(isAllowedImageUrl, `Image must be hosted on ${ALLOWED_IMAGE_HOSTS.join(", ")}.`),
    location: z.string().min(2).max(120),
    unitsTotal: z.coerce.number().int().min(0).max(200),
    unitsAvailable: z.coerce.number().int().min(0).max(200),
    description: z.string().max(1200),
  })
  .partial();

/**
 * Edits a vehicle.
 *
 * The fleet used to be add-only, so a wrong price sat on the public site
 * permanently. Admin role, like every mutation, and the same revalidation the
 * create path performs — an edit nobody can see for five minutes is not an
 * edit, and the pages it touches are cached exactly that long.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const forbidden = await requireAdmin({ role: "admin" });
  if (forbidden) return forbidden;

  const { slug } = await params;
  const body = await readJson(req, patchSchema, 32_000);
  if (!body.ok) return body.response;

  const patch = { ...body.data };
  if (patch.name) patch.name = sanitizeText(patch.name, 120);
  if (patch.description) patch.description = sanitizeText(patch.description, 1200);

  if (!Object.keys(patch).length) return fail(400, "Nothing to update.");

  // Availability can never exceed the fleet size, whichever of the two this
  // request happens to move.
  const existing = await getVehicleBySlug(slug);
  if (!existing) return fail(404, "Vehicle not found.");

  const total = patch.unitsTotal ?? existing.unitsTotal;
  const available = patch.unitsAvailable ?? existing.unitsAvailable;
  if (available > total) return fail(400, "Units available cannot exceed units total.");

  // Money is `numeric` in the schema and arrives as a number from the form, so
  // the two currency columns are handed over as strings and the rest spread.
  const { pricePerDay, costPerDay, ...rest } = patch;
  const updated = await updateVehicle(slug, {
    ...rest,
    ...(pricePerDay !== undefined ? { pricePerDay: String(pricePerDay) } : {}),
    ...(costPerDay !== undefined ? { costPerDay: String(costPerDay) } : {}),
  });
  if (!updated) return fail(404, "Vehicle not found.");

  revalidatePath("/");
  revalidatePath("/cars");
  revalidatePath(`/cars/${slug}`);

  log.info("vehicle.updated", { slug, fields: Object.keys(patch) });
  return ok({ vehicle: { ...updated, pricePerDay: Number(updated.pricePerDay) } });
}

/**
 * Retires a vehicle.
 *
 * Refused while bookings reference it — a booking whose vehicle has vanished
 * cannot be priced, invoiced or handed over, and the customer's confirmation
 * page would break. The response says so and points at the alternative, which
 * is taking the units to zero.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const forbidden = await requireAdmin({ role: "admin" });
  if (forbidden) return forbidden;

  const { slug } = await params;
  const result = await deleteVehicle(slug);

  if (!result.ok) {
    if (result.reason === "not-found") return fail(404, "Vehicle not found.");
    return fail(
      409,
      `This car has ${result.bookings} booking${result.bookings === 1 ? "" : "s"} against it. Set its units to 0 to stop new bookings instead of deleting its history.`,
    );
  }

  revalidatePath("/");
  revalidatePath("/cars");
  revalidatePath(`/cars/${slug}`);

  log.info("vehicle.deleted", { slug });
  return ok({ deleted: result.name });
}
