import { z } from "zod";

import { requireAdmin } from "@/lib/auth/server";
import { log } from "@/lib/observability/logger";
import { fail, guard, ok, readJson, sanitizeText } from "@/lib/security/http";
import { insertVehicle, listVehicles } from "@/server/repositories/vehicles";

export const dynamic = "force-dynamic";

const query = z.object({
  segment: z.string().optional(),
  brand: z.string().optional(),
  bodyType: z.string().optional(),
  transmission: z.string().optional(),
  fuel: z.string().optional(),
  location: z.string().optional(),
  q: z.string().max(120).optional(),
  seatsMin: z.coerce.number().int().min(1).max(15).optional(),
  priceMin: z.coerce.number().min(0).max(10000).optional(),
  priceMax: z.coerce.number().min(0).max(10000).optional(),
  sort: z.enum(["popular", "price-asc", "price-desc", "rating", "newest"]).optional(),
  page: z.coerce.number().int().min(1).max(100).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(8),
});

export async function GET(req: Request) {
  const blocked = guard(req, "vehicles", 120);
  if (blocked) return blocked;

  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) {
    return fail(422, "Invalid query.", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  const { page, pageSize, ...filters } = parsed.data;

  const { items, total } = await listVehicles({ ...filters, limit: pageSize, offset: (page - 1) * pageSize });

  return ok({
    items: items.map((v) => ({ ...v, pricePerDay: Number(v.pricePerDay), costPerDay: undefined })),
    page,
    pageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  });
}

const createSchema = z.object({
  name: z.string().min(2).max(120),
  brand: z.string().min(2).max(60),
  model: z.string().min(1).max(60),
  year: z.coerce.number().int().min(1990).max(2100),
  segment: z.enum(["popular", "small", "large", "exclusive"]),
  bodyType: z.string().min(2).max(40),
  transmission: z.enum(["Automatic", "Manual"]),
  fuel: z.enum(["Petrol", "Diesel", "Hybrid", "Electric", "CNG"]),
  seats: z.coerce.number().int().min(2).max(15),
  doors: z.coerce.number().int().min(2).max(6),
  bags: z.coerce.number().int().min(0).max(12),
  pricePerDay: z.coerce.number().min(0).max(1_000_000),
  costPerDay: z.coerce.number().min(0).max(1_000_000),
  imageUrl: z.string().url().max(400),
  location: z.string().min(2).max(120),
  unitsTotal: z.coerce.number().int().min(1).max(200),
  description: z.string().max(1200).optional(),
});

/** Slugify to the same shape the seeded fleet uses. */
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

/** Adds a model to the fleet. Admin only — a viewer session receives a 403. */
export async function POST(req: Request) {
  const blocked = await requireAdmin({ role: "admin" });
  if (blocked) return blocked;

  const limited = guard(req, "vehicles-create", 20, 15 * 60_000);
  if (limited) return limited;

  const body = await readJson(req, createSchema, 8_000);
  if (!body.ok) return body.response;

  const input = body.data;
  const slug = slugify(input.name);
  if (!slug) return fail(422, "That name does not produce a usable slug.");

  const created = await insertVehicle({
    id: `veh_${crypto.randomUUID().slice(0, 12)}`,
    slug,
    name: sanitizeText(input.name, 120),
    brand: sanitizeText(input.brand, 60),
    model: sanitizeText(input.model, 60),
    year: input.year,
    segment: input.segment,
    bodyType: sanitizeText(input.bodyType, 40),
    transmission: input.transmission,
    fuel: input.fuel,
    seats: input.seats,
    doors: input.doors,
    bags: input.bags,
    pricePerDay: input.pricePerDay.toFixed(2),
    costPerDay: input.costPerDay.toFixed(2),
    imageUrl: input.imageUrl,
    location: input.location,
    unitsTotal: input.unitsTotal,
    unitsAvailable: input.unitsTotal,
    description: input.description ? sanitizeText(input.description, 1200) : "",
    features: [],
  });

  if (!created) return fail(409, "A vehicle with that name already exists.");

  log.info("vehicle.created", { slug: created.slug });
  return ok({ vehicle: { slug: created.slug, name: created.name } });
}
