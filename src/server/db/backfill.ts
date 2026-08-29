/**
 * Additive counterpart to the seed.
 *
 * `db:seed` truncates and rebuilds, which is right for a fresh database and
 * wrong for a deployment that already has real bookings in it. This fills only
 * the fleet-operations tables, and only when they are empty, so it is safe to
 * run against a live environment once `db:push` has introduced them.
 *
 * Run with: npm run db:backfill
 */
import { count } from "drizzle-orm";

import { db } from "./client";
import { coupons, maintenanceJobs, testimonials, vehicleDocuments, vehicleUnits } from "./schema";
import { buildSeed } from "./seed-data";

async function chunked<T>(rows: T[], size: number, fn: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

async function main() {
  const started = Date.now();
  const seed = buildSeed();

  const [units] = await db.select({ n: count() }).from(vehicleUnits);
  if (units?.n) {
    console.log(`  vehicle_units      skipped (${units.n} rows)`);
  } else {
    await chunked(seed.units, 100, (batch) => db.insert(vehicleUnits).values(batch));
    console.log(`  vehicle_units      ${seed.units.length}`);
  }

  const [docs] = await db.select({ n: count() }).from(vehicleDocuments);
  if (docs?.n) {
    console.log(`  vehicle_documents  skipped (${docs.n} rows)`);
  } else {
    await chunked(seed.documents, 200, (batch) => db.insert(vehicleDocuments).values(batch));
    console.log(`  vehicle_documents  ${seed.documents.length}`);
  }

  const [jobs] = await db.select({ n: count() }).from(maintenanceJobs);
  if (jobs?.n) {
    console.log(`  maintenance_jobs   skipped (${jobs.n} rows)`);
  } else {
    await chunked(seed.maintenance, 100, (batch) => db.insert(maintenanceJobs).values(batch));
    console.log(`  maintenance_jobs   ${seed.maintenance.length}`);
  }

  const [promos] = await db.select({ n: count() }).from(coupons);
  if (promos?.n) {
    console.log(`  coupons            skipped (${promos.n} rows)`);
  } else {
    await db.insert(coupons).values(seed.coupons);
    console.log(`  coupons            ${seed.coupons.length}`);
  }

  // The home page renders these; an empty table would silently take the
  // testimonials section off the public site on the deploy that introduced it.
  const [reviews] = await db.select({ n: count() }).from(testimonials);
  if (reviews?.n) {
    console.log(`  testimonials       skipped (${reviews.n} rows)`);
  } else {
    await db.insert(testimonials).values(seed.testimonials);
    console.log(`  testimonials       ${seed.testimonials.length}`);
  }

  console.log(`Done in ${Date.now() - started}ms.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
