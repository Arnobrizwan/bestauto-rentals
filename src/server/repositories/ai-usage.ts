import { sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { aiUsage } from "@/server/db/schema";

/**
 * Daily ceiling on hosted AI use.
 *
 * Zero or unset means no ceiling, which keeps the deterministic engine and
 * local development unaffected.
 */
const requestLimit = () => Number(process.env.AI_DAILY_REQUEST_LIMIT ?? 0) || 0;
const tokenLimit = () => Number(process.env.AI_DAILY_TOKEN_LIMIT ?? 0) || 0;

export type BudgetState = { withinBudget: boolean; requests: number; tokens: number };

/**
 * Counts one hosted request and reports whether the day still has headroom.
 *
 * The insert and the increment are one statement so two instances answering at
 * the same moment cannot both read the pre-increment total and both decide
 * there is room. A failure here returns `withinBudget: true`: the ledger going
 * down should not take the AI layer with it, and the per-client rate limit is
 * still in force underneath.
 */
export async function consumeAiBudget(): Promise<BudgetState> {
  const reqCap = requestLimit();
  const tokCap = tokenLimit();
  if (!reqCap && !tokCap) return { withinBudget: true, requests: 0, tokens: 0 };

  try {
    const [row] = await db
      .insert(aiUsage)
      .values({ day: sql`current_date` as unknown as string, requests: 1, tokens: 0 })
      .onConflictDoUpdate({
        target: aiUsage.day,
        set: { requests: sql`${aiUsage.requests} + 1`, updatedAt: new Date() },
      })
      .returning({ requests: aiUsage.requests, tokens: aiUsage.tokens });

    const requests = row?.requests ?? 0;
    const tokens = row?.tokens ?? 0;
    const withinBudget = (!reqCap || requests <= reqCap) && (!tokCap || tokens <= tokCap);
    return { withinBudget, requests, tokens };
  } catch {
    return { withinBudget: true, requests: 0, tokens: 0 };
  }
}

/** Adds the tokens a completion actually used. Best-effort; never throws. */
export async function recordAiTokens(tokens: number) {
  if (!tokens || (!requestLimit() && !tokenLimit())) return;
  try {
    await db
      .insert(aiUsage)
      .values({ day: sql`current_date` as unknown as string, requests: 0, tokens })
      .onConflictDoUpdate({
        target: aiUsage.day,
        set: { tokens: sql`${aiUsage.tokens} + ${tokens}`, updatedAt: new Date() },
      });
  } catch {
    // A ledger write must never fail a customer's request.
  }
}
