import { ProviderError, type CompletionRequest, type CompletionResult, type ContentBlock, type LlmProvider, type StreamEvent } from "./types";

const API = "https://api.openai.com/v1/chat/completions";

type OpenAiMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "assistant"; content: string | null; tool_calls: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

function flatten(content: string | ContentBlock[]): { text: string; blocks: ContentBlock[] } {
  if (typeof content === "string") return { text: content, blocks: [] };
  return {
    text: content
      .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join(""),
    blocks: content,
  };
}

/** OpenAI-compatible chat completions (also works with any drop-in gateway). */
/**
 * Builds the request body.
 *
 * Shared by `complete` and `stream` so the two cannot drift — the streamed
 * turn has to carry exactly the same system prompt, history and tool
 * definitions as the non-streamed one, or the model behaves differently
 * depending on which transport the caller picked.
 */
function buildBody(model: string, baseUrl: string, req: CompletionRequest): Record<string, unknown> {
  const messages: OpenAiMessage[] = [{ role: "system", content: req.system }];

  for (const m of req.messages) {
    const { text, blocks } = flatten(m.content);
    const toolUses = blocks.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");
    const toolResults = blocks.filter(
      (b): b is Extract<ContentBlock, { type: "tool_result" }> => b.type === "tool_result",
    );

    if (m.role === "assistant" && toolUses.length) {
      messages.push({
    role: "assistant",
    content: text || null,
    tool_calls: toolUses.map((t) => ({
      id: t.id,
      type: "function" as const,
      function: { name: t.name, arguments: JSON.stringify(t.input) },
    })),
      });
      continue;
    }
    if (toolResults.length) {
      for (const r of toolResults) messages.push({ role: "tool", tool_call_id: r.toolUseId, content: r.content });
      if (text) messages.push({ role: m.role, content: text });
      continue;
    }
    messages.push({ role: m.role, content: text });
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    max_completion_tokens: req.maxTokens ?? 1024,
    temperature: req.temperature ?? 0.3,
  };
  if (req.json) body.response_format = { type: "json_object" };
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));
  }

  return body;
}

export function createOpenAiProvider(apiKey: string, model: string, baseUrl = API): LlmProvider {
  const post = (body: Record<string, unknown>) =>
    fetch(baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

  return {
    id: "openai",
    label: "OpenAI",
    model,
    /**
     * One turn, streamed.
     *
     * Yields text as the model produces it and returns the finished turn, so
     * the caller learns whether tools were requested. Tool-call deltas arrive
     * fragmented and indexed — the name in one chunk, the arguments across
     * several — so they are accumulated by index and only parsed at the end.
     *
     * A chunk can also be split across reads, hence buffering rather than
     * parsing each read whole: that works until a reply is long enough to be
     * fragmented, which is exactly when streaming matters.
     */
    async *stream(req: CompletionRequest) {
      const started = Date.now();
      const res = await post({ ...buildBody(model, baseUrl, req), stream: true });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new ProviderError(
          `OpenAI stream failed (${res.status}): ${detail.slice(0, 200)}`,
          res.status,
          res.status === 429 || res.status >= 500,
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      let finish = "";
      const partial = new Map<number, { id: string; name: string; args: string }>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          let chunk: {
            choices?: {
              delta?: {
                content?: string;
                tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
              };
              finish_reason?: string;
            }[];
          };
          try {
            chunk = JSON.parse(payload);
          } catch {
            continue; // A malformed chunk is skipped rather than ending the turn.
          }

          const choice = chunk.choices?.[0];
          if (choice?.finish_reason) finish = choice.finish_reason;

          const delta = choice?.delta?.content;
          if (delta) {
            text += delta;
            yield { type: "text", delta } satisfies StreamEvent;
          }

          for (const call of choice?.delta?.tool_calls ?? []) {
            const index = call.index ?? 0;
            const existing = partial.get(index) ?? { id: "", name: "", args: "" };
            partial.set(index, {
              id: call.id ?? existing.id,
              name: call.function?.name ?? existing.name,
              args: existing.args + (call.function?.arguments ?? ""),
            });
          }
        }
      }

      const toolCalls = [...partial.values()]
        .filter((c) => c.name)
        .map((c) => {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(c.args || "{}") as Record<string, unknown>;
          } catch {
            input = {};
          }
          return { id: c.id || `call_${c.name}`, name: c.name, input };
        });

      return {
        text: text.trim(),
        toolCalls,
        stopReason: toolCalls.length ? "tool_use" : finish === "length" ? "max_tokens" : "end",
        model,
        // Streamed responses do not carry a usage block, so the ledger sees
        // the request but not its tokens; the request ceiling still applies.
        usage: { inputTokens: 0, outputTokens: 0 },
        latencyMs: Date.now() - started,
      } satisfies CompletionResult;
    },

    async complete(req: CompletionRequest): Promise<CompletionResult> {
      const started = Date.now();
      const body = buildBody(model, baseUrl, req);
      const res = await post(body);

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new ProviderError(
          `OpenAI request failed (${res.status}): ${detail.slice(0, 300)}`,
          res.status,
          res.status === 429 || res.status >= 500,
        );
      }

      const data = (await res.json()) as {
        choices: {
          message: { content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] };
          finish_reason: string;
        }[];
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      const choice = data.choices[0];
      const toolCalls = (choice?.message.tool_calls ?? []).map((t) => {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(t.function.arguments) as Record<string, unknown>;
        } catch {
          input = {};
        }
        return { id: t.id, name: t.function.name, input };
      });

      return {
        text: (choice?.message.content ?? "").trim(),
        toolCalls,
        stopReason: toolCalls.length ? "tool_use" : choice?.finish_reason === "length" ? "max_tokens" : "end",
        model,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        },
        latencyMs: Date.now() - started,
      };
    },
  };
}
