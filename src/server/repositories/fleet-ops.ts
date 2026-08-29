import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import {
  coupons,
  maintenanceJobs,
  vehicleDocuments,
  vehicleUnits,
  vehicles,
} from "@/server/db/schema";

/* ------------------------------------------------------------------ Units */

export async function listUnits(opts: { q?: string; status?: string; branch?: string } = {}) {
  const clauses = [];
  if (opts.status && opts.status !== "all") clauses.push(eq(vehicleUnits.status, opts.status));
  if (opts.branch && opts.branch !== "all") clauses.push(eq(vehicleUnits.branch, opts.branch));
  if (opts.q) {
    const like = `%${opts.q.toLowerCase()}%`;
    clauses.push(sql`(lower(${vehicleUnits.registration}) like ${like} or lower(${vehicles.name}) like ${like})`);
  }

  const rows = await db
    .select({
      id: vehicleUnits.id,
      registration: vehicleUnits.registration,
      status: vehicleUnits.status,
      branch: vehicleUnits.branch,
      odometerKm: vehicleUnits.odometerKm,
      acquiredAt: vehicleUnits.acquiredAt,
      vehicleName: vehicles.name,
      vehicleSlug: vehicles.slug,
      segment: vehicles.segment,
      imageUrl: vehicles.imageUrl,
      openJobs: sql<number>`(
        select count(*)::int from ${maintenanceJobs}
        where ${maintenanceJobs.unitId} = ${vehicleUnits.id} and ${maintenanceJobs.status} <> 'done'
      )`,
      /** Days until the soonest document lapses. Negative means already lapsed. */
      soonestExpiryDays: sql<number | null>`(
        select min(${vehicleDocuments.expiresAt} - current_date)::int from ${vehicleDocuments}
        where ${vehicleDocuments.unitId} = ${vehicleUnits.id}
      )`,
    })
    .from(vehicleUnits)
    .innerJoin(vehicles, eq(vehicles.id, vehicleUnits.vehicleId))
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(asc(vehicles.name), asc(vehicleUnits.registration));

  return rows.map((r) => ({
    ...r,
    soonestExpiryDays: r.soonestExpiryDays === null ? null : Number(r.soonestExpiryDays),
  }));
}

export async function getUnitBranches() {
  const rows = await db
    .selectDistinct({ branch: vehicleUnits.branch })
    .from(vehicleUnits)
    .orderBy(asc(vehicleUnits.branch));
  return rows.map((r) => r.branch);
}

/* -------------------------------------------------------------- Documents */

export type DocumentRow = Awaited<ReturnType<typeof listDocuments>>[number];

/**
 * The compliance board.
 *
 * `expiresAt - current_date` is computed in Postgres rather than JavaScript so
 * "days remaining" is measured against the database's date, not the server's
 * clock — the two disagree often enough on a serverless host to matter when
 * the whole page is a sort by that number.
 */
export async function listDocuments(opts: { kind?: string; window?: number } = {}) {
  const clauses = [];
  if (opts.kind && opts.kind !== "all") clauses.push(eq(vehicleDocuments.kind, opts.kind));
  if (opts.window) clauses.push(sql`${vehicleDocuments.expiresAt} - current_date <= ${opts.window}`);

  const rows = await db
    .select({
      id: vehicleDocuments.id,
      kind: vehicleDocuments.kind,
      reference: vehicleDocuments.reference,
      issuedAt: vehicleDocuments.issuedAt,
      expiresAt: vehicleDocuments.expiresAt,
      daysLeft: sql<number>`(${vehicleDocuments.expiresAt} - current_date)::int`,
      registration: vehicleUnits.registration,
      branch: vehicleUnits.branch,
      unitStatus: vehicleUnits.status,
      vehicleName: vehicles.name,
    })
    .from(vehicleDocuments)
    .innerJoin(vehicleUnits, eq(vehicleUnits.id, vehicleDocuments.unitId))
    .innerJoin(vehicles, eq(vehicles.id, vehicleUnits.vehicleId))
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(asc(sql`${vehicleDocuments.expiresAt} - current_date`));

  return rows.map((r) => ({ ...r, daysLeft: Number(r.daysLeft) }));
}

export async function getDocumentSummary() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      lapsed: sql<number>`count(*) filter (where ${vehicleDocuments.expiresAt} < current_date)::int`,
      dueThisMonth: sql<number>`count(*) filter (where ${vehicleDocuments.expiresAt} >= current_date and ${vehicleDocuments.expiresAt} - current_date <= 30)::int`,
      unitsBlocked: sql<number>`count(distinct ${vehicleDocuments.unitId}) filter (where ${vehicleDocuments.expiresAt} < current_date)::int`,
    })
    .from(vehicleDocuments);
  return row ?? { total: 0, lapsed: 0, dueThisMonth: 0, unitsBlocked: 0 };
}

/* ------------------------------------------------------------ Maintenance */

export async function listMaintenance(opts: { status?: string } = {}) {
  const clauses = [];
  if (opts.status && opts.status !== "all") {
    if (opts.status === "open") clauses.push(isNull(maintenanceJobs.closedAt));
    else clauses.push(eq(maintenanceJobs.status, opts.status));
  }

  const rows = await db
    .select({
      id: maintenanceJobs.id,
      kind: maintenanceJobs.kind,
      status: maintenanceJobs.status,
      summary: maintenanceJobs.summary,
      garage: maintenanceJobs.garage,
      odometerKm: maintenanceJobs.odometerKm,
      cost: sql<number>`${maintenanceJobs.cost}::float8`,
      openedAt: maintenanceJobs.openedAt,
      closedAt: maintenanceJobs.closedAt,
      registration: vehicleUnits.registration,
      branch: vehicleUnits.branch,
      vehicleName: vehicles.name,
      vehicleSlug: vehicles.slug,
    })
    .from(maintenanceJobs)
    .innerJoin(vehicleUnits, eq(vehicleUnits.id, maintenanceJobs.unitId))
    .innerJoin(vehicles, eq(vehicles.id, vehicleUnits.vehicleId))
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(maintenanceJobs.openedAt));

  return rows.map((r) => ({ ...r, cost: Number(r.cost) }));
}

export async function getMaintenanceSummary() {
  const [row] = await db
    .select({
      openJobs: sql<number>`count(*) filter (where ${maintenanceJobs.status} <> 'done')::int`,
      unitsOffRoad: sql<number>`count(distinct ${maintenanceJobs.unitId}) filter (where ${maintenanceJobs.status} <> 'done')::int`,
      spendYtd: sql<number>`coalesce(sum(${maintenanceJobs.cost}::numeric) filter (where date_part('year', ${maintenanceJobs.openedAt}) = date_part('year', current_date)), 0)::float8`,
      avgCost: sql<number>`coalesce(avg(${maintenanceJobs.cost}::numeric), 0)::float8`,
    })
    .from(maintenanceJobs);
  return {
    openJobs: row?.openJobs ?? 0,
    unitsOffRoad: row?.unitsOffRoad ?? 0,
    spendYtd: Number(row?.spendYtd ?? 0),
    avgCost: Number(row?.avgCost ?? 0),
  };
}

/** Spend and job count per model — the "which car costs us money" view. */
export async function getServiceHistoryByModel() {
  const rows = await db
    .select({
      vehicleName: vehicles.name,
      vehicleSlug: vehicles.slug,
      segment: vehicles.segment,
      jobs: sql<number>`count(*)::int`,
      spend: sql<number>`coalesce(sum(${maintenanceJobs.cost}::numeric), 0)::float8`,
      lastJobAt: sql<Date | null>`max(${maintenanceJobs.openedAt})`,
      avgOdometer: sql<number>`coalesce(avg(${maintenanceJobs.odometerKm}), 0)::float8`,
    })
    .from(maintenanceJobs)
    .innerJoin(vehicleUnits, eq(vehicleUnits.id, maintenanceJobs.unitId))
    .innerJoin(vehicles, eq(vehicles.id, vehicleUnits.vehicleId))
    .groupBy(vehicles.name, vehicles.slug, vehicles.segment)
    .orderBy(desc(sql`sum(${maintenanceJobs.cost}::numeric)`));

  return rows.map((r) => ({
    ...r,
    spend: Number(r.spend),
    avgOdometer: Math.round(Number(r.avgOdometer)),
  }));
}

/* ---------------------------------------------------------------- Coupons */

export async function listCoupons() {
  const rows = await db
    .select({
      id: coupons.id,
      code: coupons.code,
      description: coupons.description,
      kind: coupons.kind,
      value: sql<number>`${coupons.value}::float8`,
      minDays: coupons.minDays,
      startsAt: coupons.startsAt,
      endsAt: coupons.endsAt,
      usageLimit: coupons.usageLimit,
      usedCount: coupons.usedCount,
      active: coupons.active,
      daysLeft: sql<number>`(${coupons.endsAt} - current_date)::int`,
    })
    .from(coupons)
    .orderBy(desc(coupons.active), asc(sql`${coupons.endsAt} - current_date`));

  return rows.map((r) => ({ ...r, value: Number(r.value), daysLeft: Number(r.daysLeft) }));
}

/**
 * The offers a customer is allowed to see.
 *
 * Seven codes were live and there was nowhere on the public site to find one —
 * the booking form had a box to type a code into and no way to learn that any
 * existed, so every offer only reached people who had been told about it
 * elsewhere. This is the same validity test `findRedeemableCoupon` applies, so
 * the site can never advertise a code that would be refused at checkout: live
 * window, still active, and not already exhausted.
 *
 * Deliberately narrower than `listCoupons`, which is the operator's view. The
 * usage limit and redemption count are internal — a customer does not need to
 * know that 45 of 200 have gone, and publishing it invites a rush.
 */
export async function listPublicOffers() {
  const rows = await db
    .select({
      code: coupons.code,
      description: coupons.description,
      kind: coupons.kind,
      value: sql<number>`${coupons.value}::float8`,
      minDays: coupons.minDays,
      endsAt: coupons.endsAt,
      daysLeft: sql<number>`(${coupons.endsAt} - current_date)::int`,
    })
    .from(coupons)
    .where(
      sql`${coupons.active}
        and ${coupons.startsAt} <= current_date
        and ${coupons.endsAt} >= current_date
        and (${coupons.usageLimit} = 0 or ${coupons.usedCount} < ${coupons.usageLimit})`,
    )
    .orderBy(asc(sql`${coupons.endsAt} - current_date`));

  return rows.map((r) => ({ ...r, value: Number(r.value), daysLeft: Number(r.daysLeft) }));
}

/**
 * Looks up a redeemable coupon.
 *
 * Validity is checked in SQL against the database's own `current_date` rather
 * than the server's clock, so a request landing either side of midnight cannot
 * redeem a code the board already shows as expired.
 */
export async function findRedeemableCoupon(code: string) {
  const [row] = await db
    .select({
      id: coupons.id,
      code: coupons.code,
      kind: coupons.kind,
      value: sql<number>`${coupons.value}::float8`,
      minDays: coupons.minDays,
      usageLimit: coupons.usageLimit,
      usedCount: coupons.usedCount,
      live: sql<boolean>`(
        ${coupons.active}
        and ${coupons.startsAt} <= current_date
        and ${coupons.endsAt} >= current_date
      )`,
    })
    .from(coupons)
    .where(eq(sql`upper(${coupons.code})`, code.trim().toUpperCase()))
    .limit(1);

  return row ? { ...row, value: Number(row.value) } : null;
}

/** Conditional increment: the row only moves while the limit still allows it. */
export async function redeemCoupon(id: string) {
  const [row] = await db
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(
      and(
        eq(coupons.id, id),
        sql`(${coupons.usageLimit} = 0 or ${coupons.usedCount} < ${coupons.usageLimit})`,
      ),
    )
    .returning({ id: coupons.id, usedCount: coupons.usedCount });
  return row ?? null;
}
