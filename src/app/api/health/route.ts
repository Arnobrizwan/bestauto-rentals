import { sql } from "drizzle-orm";

import { describeEngine, resolveProvider } from "@/ai/provider";
import { ok } from "@/lib/security/http";
import { db } from "@/server/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let database: "up" | "down" = "up";
  let vehicles = 0;

  try {
    const result = await db.execute(sql`select count(*)::int as n from vehicles`);
    vehicles = Number((result.rows[0] as { n: number } | undefined)?.n ?? 0);
  } catch {
    database = "down";
  }

  const engine = describeEngine(resolveProvider());

  return ok(
    {
      status: database === "up" ? "ok" : "degraded",
      checks: {
        database,
        vehicles,
        ai: { engine: engine.engine, model: engine.model, hosted: engine.hosted },
      },
      latencyMs: Date.now() - started,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      timestamp: new Date().toISOString(),
    },
    { status: database === "up" ? 200 : 503 },
  );
}
