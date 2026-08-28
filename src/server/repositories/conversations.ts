import { asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { conversations, messages } from "@/server/db/schema";

export async function ensureConversation(sessionId: string, engine: string) {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.sessionId, sessionId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(conversations)
    .values({ id: `cnv_${sessionId}`, sessionId, engine })
    .returning();
  return created;
}

export async function appendMessage(row: typeof messages.$inferInsert) {
  const [created] = await db.insert(messages).values(row).returning();
  return created;
}

export async function getTranscript(conversationId: string) {
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt));
}

export async function listConversations(limit = 20) {
  const rows = await db
    .select({
      id: conversations.id,
      sessionId: conversations.sessionId,
      engine: conversations.engine,
      handoff: conversations.handoff,
      createdAt: conversations.createdAt,
      messageCount: sql<number>`count(${messages.id})::int`,
      lastMessageAt: sql<Date | null>`max(${messages.createdAt})`,
      avgLatency: sql<number>`coalesce(avg(${messages.latencyMs}) filter (where ${messages.role} = 'assistant'), 0)::float8`,
    })
    .from(conversations)
    .leftJoin(messages, eq(messages.conversationId, conversations.id))
    .groupBy(conversations.id)
    .orderBy(desc(sql`max(${messages.createdAt})`))
    .limit(limit);
  return rows.map((r) => ({ ...r, avgLatency: Math.round(Number(r.avgLatency)) }));
}

export async function markHandoff(conversationId: string) {
  await db.update(conversations).set({ handoff: true }).where(eq(conversations.id, conversationId));
}
