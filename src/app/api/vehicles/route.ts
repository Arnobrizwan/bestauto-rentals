import { z } from "zod";

import { fail, guard, ok } from "@/lib/security/http";
import { listVehicles } from "@/server/repositories/vehicles";

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
