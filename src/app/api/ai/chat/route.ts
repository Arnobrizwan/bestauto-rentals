import { z } from "zod";

import { runConcierge } from "@/ai/agents/concierge";
import { emit } from "@/automation/engine";
import { log } from "@/lib/observability/logger";
import { guard, ok, readJson, sanitizeText } from "@/lib/security/http";
import { appendMessage, ensureConversation, markHandoff } from "@/server/repositories/conversations";
import { createLead } from "@/server/services/leads";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const schema = z.object({
  sessionId: z.string().min(4).max(80),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) }))
    .min(1)
    .max(30),
});

export async function POST(req: Request) {
  const blocked = guard(req, "ai-chat", 25);
  if (blocked) return blocked;

  const body = await readJson(req, schema, 64_000);
  if (!body.ok) return body.response;

  const turns = body.data.messages.map((m) => ({ role: m.role, content: sanitizeText(m.content, 2000) }));
  const lastUser = [...turns].reverse().find((t) => t.role === "user");

  const reply = await runConcierge(turns, {
    // The concierge can capture a lead mid-conversation; it goes through the
    // same intake service as the contact form, so scoring and automation fire.
    createLead: async (input) => {
      const { lead } = await createLead({ ...input, source: "ai-concierge" });
      return { id: lead.id, tier: lead.tier, score: lead.score };
    },
  });

  // Persist the transcript so the admin AI console can review real conversations.
  try {
    const conversation = await ensureConversation(body.data.sessionId, reply.engine.engine);
    if (lastUser) {
      await appendMessage({
        id: `msg_${crypto.randomUUID().slice(0, 12)}`,
        conversationId: conversation.id,
        role: "user",
        content: lastUser.content,
      });
    }
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
