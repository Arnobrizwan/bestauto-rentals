import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

/**
 * `APP_DATABASE_URL` wins over everything else.
 *
 * The Vercel Neon integration owns `DATABASE_URL` and the `POSTGRES_*` family
 * and re-syncs them, so pointing the app at a database it does not manage by
 * editing `DATABASE_URL` would be undone silently — and silently moving the
 * database back across the world is exactly the failure that would be hardest
 * to notice. The override is read first and is not managed by anything.
 */
const connectionString =
  process.env.APP_DATABASE_URL ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL_UNPOOLED;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Run `vercel env pull .env.local` or add a Postgres connection string.",
  );
}

/**
 * Retries a transient network failure reaching the database.
 *
 * `neon-http` sends each query as an HTTP request and does not retry, so a
 * single failed fetch surfaces as a failed query. That is survivable at
 * runtime — a page errors and the boundary catches it — but not at build time:
 * the home page and the twelve vehicle pages are prerendered, so one blip
 * fails the entire production deployment. It did, on a build that started
 * after the compute had been idle long enough to suspend.
 *
 * Only genuine network failures are retried. A rejected query — bad SQL, a
 * constraint violation — is returned untouched, because retrying it would just
 * fail again more slowly.
 */
const retryingFetch: typeof fetch = async (input, init) => {
  const delays = [250, 1_000, 2_500];
  let lastError: unknown;

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastError = err;
      if (attempt === delays.length) break;
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
  throw lastError;
};

neonConfig.fetchFunction = retryingFetch;

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
export { schema };
export type Database = typeof db;
