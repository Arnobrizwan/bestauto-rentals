import { neon } from "@neondatabase/serverless";
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

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
export { schema };
export type Database = typeof db;
