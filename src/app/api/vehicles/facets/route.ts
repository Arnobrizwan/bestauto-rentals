import { ok } from "@/lib/security/http";
import { listFacets } from "@/server/repositories/vehicles";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok(await listFacets());
}
