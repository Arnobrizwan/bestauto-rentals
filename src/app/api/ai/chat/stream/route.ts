import { z } from "zod";

import { runConcierge } from "@/ai/agents/concierge";
import { emit } from "@/automation/engine";
import { log } from "@/lib/observability/logger";
import { guard, readJson, sanitizeText } from "@/lib/security/http";
import {
  appendMessage,
  ensureConversation,
  getTranscript,
  markHandoff,
} from "@/server/repositories/conversations";
import { createLead } from "@/server/services/leads";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const schema = z.object({
  sessionId: z.string().min(4).max(80),
  message: z.string().min(1).max(2000),
});

/**
 * The concierge, streamed.
 *
 * Same contract as `/api/ai/chat` — session id plus the new turn, history read
 * back from the database — but the reply arrives as it is written instead of
 * after it is finished. Against the hosted model that is the difference
 * between a first word at about a second and a wall of text at two.
 *
 * Three event types. `delta` is text; `reset` means the words so far belonged
 * to a turn that then asked for a tool, or to a model call that failed and was
 * replaced by the rules engine, so discard them; `done` carries the full reply
 * — vehicles, suggestions, tool calls, which engine answered. A client that
 * only handles `done` still works, which is what keeps this a superset of the
 * non-streaming route rather than a replacement for it.
 *
 * The rules engine composes its answer in microseconds, so there is nothing to
 * stream: it sends one `done` and no deltas. Pretending otherwise by chunking
 * a finished string would be theatre.
 */
export async function POST(req: Request) {
  const blocked = await guard(req, "ai-chat", 25);
  if (blocked) return blocked;

  const body = await readJson(req, schema, 8_000);
  if (!body.ok) return body.response;

  const userText = sanitizeText(body.data.message, 2000);
  const conversation = await ensureConversation(body.data.sessionId, "heuristic");
  const stored = await getTranscript(conversation.id);

  const turns: { role: "user" | "assistant"; content: string }[] = [
    ...stored
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-24)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userText },
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // The client went away mid-reply; the turn is still persisted below.
        }
      };

      try {
        const reply = await runConcierge(
          turns,
          {
            createLead: async (input) => {
              const { lead } = await createLead({ ...input, source: "ai-concierge" });
              return { id: lead.id, tier: lead.tier, score: lead.score };
            },
          },
          {
            onDelta: (delta) => send({ type: "delta", text: delta }),
            onReset: () => send({ type: "reset" }),
          },
        );

        send({
          type: "done",
          message: reply.message,
          vehicles: reply.vehicles,
          suggestions: reply.suggestions,
          toolCalls: reply.toolCalls.map((t) => ({ name: t.name, input: t.input })),
          engine: reply.engine,
          handoff: reply.handoff,
          latencyMs: reply.latencyMs,
          degraded: reply.degraded,
        });

        // Persisted after the reply is sent, so a slow write never delays a
        // word the customer is waiting on.
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
            await emit("conversation.handoff", { conversation: { id: conversation.id } });
          }
        } catch (err) {
          log.warn("chat.persist_failed", { error: err instanceof Error ? err.message : "unknown" });
        }
      } catch (err) {
        log.error("chat.stream_failed", { error: err instanceof Error ? err.message : "unknown" });
        send({ type: "error", error: "The assistant is unavailable right now." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      // Tells any proxy in front not to buffer the whole reply before sending.
      "x-accel-buffering": "no",
    },
  });
}
