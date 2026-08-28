import { fail, ok } from "@/lib/security/http";
import { getVehicleBySlug } from "@/server/repositories/vehicles";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) return fail(404, "Vehicle not found.");
  return ok({ ...vehicle, pricePerDay: Number(vehicle.pricePerDay), costPerDay: undefined });
}
