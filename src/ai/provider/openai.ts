import { ProviderError, type CompletionRequest, type CompletionResult, type ContentBlock, type LlmProvider } from "./types";

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
export function createOpenAiProvider(apiKey: string, model: string, baseUrl = API): LlmProvider {
  return {
    id: "openai",
    label: "OpenAI",
    model,
    async complete(req: CompletionRequest): Promise<CompletionResult> {
      const started = Date.now();
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

      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

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
