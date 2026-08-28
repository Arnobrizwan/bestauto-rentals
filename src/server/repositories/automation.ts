import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { automationRules, automationRuns, events, outbox } from "@/server/db/schema";

export async function listRules() {
  return db.select().from(automationRules).orderBy(automationRules.createdAt);
}

export async function getRule(id: string) {
  const [row] = await db.select().from(automationRules).where(eq(automationRules.id, id)).limit(1);
  return row ?? null;
}

export async function setRuleEnabled(id: string, enabled: boolean) {
  const [row] = await db.update(automationRules).set({ enabled }).where(eq(automationRules.id, id)).returning();
  return row ?? null;
}

export async function recordRun(run: typeof automationRuns.$inferInsert) {
  const [created] = await db.insert(automationRuns).values(run).returning();
  await db
    .update(automationRules)
    .set({ runCount: sql`${automationRules.runCount} + 1`, lastRunAt: new Date() })
    .where(eq(automationRules.id, run.ruleId));
  return created;
}

export async function listRuns(limit = 25) {
  return db.select().from(automationRuns).orderBy(desc(automationRuns.createdAt)).limit(limit);
}

export async function recordEvent(row: typeof events.$inferInsert) {
  const [created] = await db.insert(events).values(row).returning();
  return created;
}

export async function listEvents(limit = 40) {
  return db.select().from(events).orderBy(desc(events.createdAt)).limit(limit);
}

export async function enqueueOutbox(row: typeof outbox.$inferInsert) {
  const [created] = await db.insert(outbox).values(row).returning();
  return created;
}

export async function listOutbox(limit = 30) {
  return db.select().from(outbox).orderBy(desc(outbox.createdAt)).limit(limit);
}

export async function automationStats() {
  const [runRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
      ok: sql<number>`count(*) filter (where ${automationRuns.status} = 'success')::int`,
      failed: sql<number>`count(*) filter (where ${automationRuns.status} = 'failed')::int`,
      avgMs: sql<number>`coalesce(avg(${automationRuns.durationMs}), 0)::float8`,
    })
    .from(automationRuns);
  const [outboxRow] = await db.select({ n: sql<number>`count(*)::int` }).from(outbox);
  return {
    runs: runRow?.total ?? 0,
    succeeded: runRow?.ok ?? 0,
    failed: runRow?.failed ?? 0,
    avgMs: Math.round(Number(runRow?.avgMs ?? 0)),
    notifications: outboxRow?.n ?? 0,
  };
}
