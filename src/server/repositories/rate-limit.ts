import { sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { rateLimits } from "@/server/db/schema";

/**
 * Counts one hit against a shared fixed window.
 *
 * The insert and the increment are one statement, and the window reset is
 * folded into the same `case` — so two instances arriving together cannot both
 * read a stale count, and neither can reset a window the other just started.
 *
 * A failure returns `allowed: true`. A rate limiter that fails closed turns a
 * database blip into a total outage, and the in-process limiter is still in
 * front of this, so degrading to per-instance limits is the safer failure.
 */
export async function consumeSharedLimit(key: string, limit: number, windowMs: number) {
  try {
    const [row] = await db
      .insert(rateLimits)
      .values({ key, count: 1, resetAt: sql`now() + (${windowMs} || ' milliseconds')::interval` })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${rateLimits.resetAt} < now() then 1 else ${rateLimits.count} + 1 end`,
          resetAt: sql`case when ${rateLimits.resetAt} < now() then now() + (${windowMs} || ' milliseconds')::interval else ${rateLimits.resetAt} end`,
        },
      })
      .returning({ count: rateLimits.count });

    return { allowed: (row?.count ?? 1) <= limit, count: row?.count ?? 1 };
  } catch {
    return { allowed: true, count: 0 };
  }
}
