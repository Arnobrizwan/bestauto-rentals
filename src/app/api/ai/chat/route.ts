import { z } from "zod";

import { runConcierge } from "@/ai/agents/concierge";
import { emit } from "@/automation/engine";
import { log } from "@/lib/observability/logger";
import { guard, ok, readJson, sanitizeText } from "@/lib/security/http";
import { appendMessage, ensureConversation, getTranscript, markHandoff } from "@/server/repositories/conversations";
import { createLead } from "@/server/services/leads";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

/**
 * Only the new turn comes from the client.
 *
 * The browser used to send the whole transcript and the server used it as
 * given, which made the client the authority on what had already been said —
 * a forged assistant turn could assert a price the fleet never quoted. The
 * model happened to re-check its tools and contradict it, but that was the
 * model choosing well, not the architecture preventing it. History is read
 * back from the database by session instead, so the only thing a caller can
 * introduce is their own next sentence.
 */
const schema = z.object({
  sessionId: z.string().min(4).max(80),
  message: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  const blocked = await guard(req, "ai-chat", 25);
  if (blocked) return blocked;

  const body = await readJson(req, schema, 64_000);
  if (!body.ok) return body.response;

  const userText = sanitizeText(body.data.message, 2000);

  // The conversation row is created up front so the transcript this turn is
  // answered from and the transcript it is appended to are the same one.
  const conversation = await ensureConversation(body.data.sessionId, "heuristic");
  const stored = await getTranscript(conversation.id);

  const turns: { role: "user" | "assistant"; content: string }[] = [
    ...stored
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-24)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userText },
  ];

  const reply = await runConcierge(turns, {
    // The concierge can capture a lead mid-conversation; it goes through the
    // same intake service as the contact form, so scoring and automation fire.
    createLead: async (input) => {
      const { lead } = await createLead({ ...input, source: "ai-concierge" });
      return { id: lead.id, tier: lead.tier, score: lead.score };
    },
  });

  // Persist the transcript so the admin AI console can review real
  // conversations — and so the next turn has history to read back.
  try {
    await appendMessage({
      id: `msg_${crypto.randomUUID().slice(0, 12)}`,
      conversationId: conversation.id,
      role: "user",
      content: userText,
    });
    await appendMessage({
      id: `msg_${crypto.randomUUID().slice(0, 12)}`,
      conversationId: conversation.id,
      role: "assistant",
      content: reply.message,
      toolCalls: reply.toolCalls.map((t) => ({ name: t.name, input: t.input, output: t.output })),
      latencyMs: reply.latencyMs,
    });
    if (reply.handoff) {
      await markHandoff(conversation.id);
      await emit("conversation.handoff", {
        conversation: { sessionId: body.data.sessionId, id: conversation.id },
      });
    }
  } catch (err) {
    log.warn("chat.persist_failed", { error: err instanceof Error ? err.message : String(err) });
  }

  return ok({
    message: reply.message,
    vehicles: reply.vehicles,
    suggestions: reply.suggestions,
    engine: reply.engine,
    latencyMs: reply.latencyMs,
    handoff: reply.handoff,
    leadCaptured: reply.leadCaptured,
    toolCalls: reply.toolCalls.map((t) => ({ name: t.name, input: t.input })),
    degraded: reply.degraded,
  });
}
